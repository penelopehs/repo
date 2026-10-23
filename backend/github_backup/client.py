"""A small GitHub REST client with pagination and respectful retries."""

from __future__ import annotations

import time
from collections.abc import Callable, Iterator
from urllib.parse import urljoin, urlparse

import httpx

API_VERSION = "2022-11-28"
USER_AGENT = "acquire-github-archive"


class GitHubError(Exception):
    """A GitHub request failed. The message never includes the access token."""

    def __init__(self, status: int, message: str, path: str):
        self.status = status
        self.message = " ".join((message or "unexpected response").split())
        if len(self.message) > 240:
            self.message = self.message[:237] + "..."
        self.path = path
        super().__init__(self.brief())

    def brief(self) -> str:
        return f"HTTP {self.status} for {self.path}: {self.message}"


class GitHubClient:
    def __init__(
        self,
        token: str,
        *,
        api_url: str = "https://api.github.com",
        http: httpx.Client | None = None,
        sleeper: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.time,
        max_attempts: int = 3,
    ):
        token = (token or "").strip()
        if not token:
            raise ValueError(
                "A GitHub token is required. Set GITHUB_TOKEN, or sign in with the GitHub CLI, "
                "and then run this command again."
            )
        self._sleeper = sleeper
        self._clock = clock
        self._max_attempts = max_attempts
        self._owns_http = http is None
        self._http = http or httpx.Client(
            base_url=api_url.rstrip("/"),
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": API_VERSION,
                "User-Agent": USER_AGENT,
            },
            timeout=httpx.Timeout(60.0, connect=15.0),
            follow_redirects=False,
        )

    def close(self) -> None:
        if self._owns_http:
            self._http.close()

    def __enter__(self) -> GitHubClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def get_json(self, path: str, params: dict | None = None) -> dict | list:
        return self._request("GET", path, params=params).json()

    def paginate(
        self,
        path: str,
        params: dict | None = None,
        *,
        list_key: str | None = None,
    ) -> Iterator[dict]:
        url: str | None = path
        next_params = params
        while url:
            response = self._request("GET", url, params=next_params)
            payload = response.json()
            yield from _items(payload, response.status_code, _safe_path(url), list_key)
            url = _next_link(response)
            next_params = None

    def _request(self, method: str, url: str, *, params: dict | None) -> httpx.Response:
        current = url
        current_params = params
        redirects = 0
        attempt = 0
        while True:
            response = self._http.request(method, current, params=current_params)
            if response.status_code in {301, 302, 303, 307, 308}:
                redirects += 1
                location = response.headers.get("location")
                if redirects > 3 or not location or not self._allowed_redirect(location):
                    raise GitHubError(
                        response.status_code,
                        "the response redirected somewhere this archive will not follow",
                        _safe_path(current),
                    )
                current = urljoin(str(response.url), location)
                current_params = None
                continue
            if _is_rate_limited(response) and attempt + 1 < self._max_attempts:
                self._sleeper(min(_retry_delay(response, self._clock), 60))
                attempt += 1
                continue
            if response.status_code in {502, 503, 504} and attempt + 1 < self._max_attempts:
                self._sleeper(min(2**attempt, 8))
                attempt += 1
                continue
            if response.status_code >= 400:
                raise GitHubError(response.status_code, _error_message(response), _safe_path(current))
            return response

    def _allowed_redirect(self, location: str) -> bool:
        target = urlparse(urljoin(str(self._http.base_url), location))
        base = urlparse(str(self._http.base_url))
        return target.scheme == "https" and bool(target.netloc) and target.netloc == base.netloc


def _items(payload: object, status: int, path: str, list_key: str | None) -> list[dict]:
    if list_key is not None:
        if not isinstance(payload, dict):
            raise GitHubError(status, "expected a paged object", path)
        items = payload.get(list_key) or []
    elif isinstance(payload, list):
        items = payload
    else:
        raise GitHubError(status, "expected a list", path)
    if not isinstance(items, list):
        raise GitHubError(status, "expected a list of records", path)
    return [item for item in items if isinstance(item, dict)]


def _next_link(response: httpx.Response) -> str | None:
    header = response.headers.get("link") or response.headers.get("Link")
    if not header:
        return None
    for part in header.split(","):
        if 'rel="next"' not in part:
            continue
        start = part.find("<")
        end = part.find(">")
        if start != -1 and end != -1 and end > start:
            return part[start + 1 : end]
    return None


def _safe_path(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme or parsed.netloc:
        return parsed.path or "/"
    return url.split("?", 1)[0] or url


def _error_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return "unexpected response"
    if isinstance(payload, dict) and isinstance(payload.get("message"), str):
        return payload["message"]
    return "unexpected response"


def _is_rate_limited(response: httpx.Response) -> bool:
    if response.status_code == 429:
        return True
    if response.status_code != 403:
        return False
    if response.headers.get("x-ratelimit-remaining") == "0":
        return True
    try:
        message = response.json().get("message", "")
    except ValueError:
        message = ""
    if not isinstance(message, str):
        return False
    lowered = message.lower()
    return "rate limit" in lowered or "secondary rate" in lowered


def _retry_delay(response: httpx.Response, clock: Callable[[], float]) -> float:
    retry_after = response.headers.get("retry-after")
    if retry_after and retry_after.isdigit():
        return int(retry_after) + 1
    reset = response.headers.get("x-ratelimit-reset")
    if reset and reset.isdigit():
        return max(int(reset) - int(clock()), 1) + 1
    return 2
