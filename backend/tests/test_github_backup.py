"""Tests for the personal GitHub archive."""

import json
from types import SimpleNamespace

import httpx

from github_backup.archive import build_archive, counts, write_archive
from github_backup.cli import main, resolve_token
from github_backup.client import GitHubClient, GitHubError
from github_backup.html_report import format_timestamp, render_report

ORG = "Acquire-Wealth-Collective"
BILLING = f"{ORG}/billing"
SECRET = f"{ORG}/secret"


class FakeGitHub:
    def __init__(self, pages, gets):
        self.pages = pages
        self.gets = gets
        self.calls = []

    def paginate(self, path, params=None, list_key=None):
        params = params or {}
        self.calls.append(("paginate", path, dict(params), list_key))
        for spec in self.pages:
            if spec["path"] != path:
                continue
            expected = spec.get("params") or {}
            if any(params.get(key) != value for key, value in expected.items()):
                continue
            if "error" in spec:
                raise spec["error"]
            return iter(spec["items"])
        raise AssertionError(f"unexpected paginate {path} {params} list_key={list_key}")

    def get_json(self, path, params=None):
        self.calls.append(("get", path))
        if path not in self.gets:
            raise AssertionError(f"unexpected get {path}")
        value = self.gets[path]
        if isinstance(value, Exception):
            raise value
        return value

    def close(self):
        self.calls.append(("close",))


def _person(login):
    return {"login": login, "html_url": f"https://github.com/{login}"}


def _repo(full_name, **extra):
    owner, name = full_name.split("/", 1)
    payload = {
        "full_name": full_name,
        "private": True,
        "archived": False,
        "description": extra.pop("description", ""),
        "default_branch": "main",
        "html_url": f"https://github.com/{full_name}",
        "owner": {"login": owner},
    }
    payload.update(extra)
    return payload


def _issue(number, **extra):
    payload = {
        "id": number,
        "number": number,
        "title": extra.pop("title", f"Issue {number}"),
        "state": extra.pop("state", "open"),
        "state_reason": extra.pop("state_reason", None),
        "body": extra.pop("body", "A description."),
        "user": extra.pop("user", _person("ada")),
        "assignees": extra.pop("assignees", [_person("ada")]),
        "labels": extra.pop("labels", []),
        "comments": extra.pop("comments", 0),
        "created_at": "2026-10-01T15:00:00Z",
        "updated_at": extra.pop("updated_at", "2026-10-01T15:00:00Z"),
        "closed_at": extra.pop("closed_at", None),
        "html_url": f"https://github.com/{BILLING}/issues/{number}",
    }
    payload.update(extra)
    return payload


def _client():
    comment_early = {
        "id": 2,
        "user": _person("ben"),
        "body": "The earlier note mentions https://example.com/spec.",
        "created_at": "2026-10-03T15:00:00Z",
        "updated_at": "2026-10-03T15:00:00Z",
        "html_url": f"https://github.com/{BILLING}/issues/4#issuecomment-2",
    }
    comment_late = {
        "id": 1,
        "user": _person("ada"),
        "body": "Thanks, I will update the draft.",
        "created_at": "2026-10-04T15:00:00Z",
        "updated_at": "2026-10-04T15:00:00Z",
        "html_url": f"https://github.com/{BILLING}/issues/4#issuecomment-1",
    }
    review = {
        "id": 50,
        "user": _person("ben"),
        "state": "APPROVED",
        "body": "Please rename this helper.",
        "submitted_at": "2026-10-05T16:00:00Z",
        "html_url": f"https://github.com/{BILLING}/pull/9#pullrequestreview-50",
        "commit_id": "abc",
    }
    review_comment = {
        "id": 70,
        "pull_request_review_id": 50,
        "user": _person("ben"),
        "body": "This name is unclear.",
        "path": "app.py",
        "line": 12,
        "original_line": 12,
        "side": "RIGHT",
        "diff_hunk": "@@ -10,3 +10,3 @@\n-old\n+new",
        "in_reply_to_id": None,
        "created_at": "2026-10-05T16:05:00Z",
        "updated_at": "2026-10-05T16:05:00Z",
        "html_url": f"https://github.com/{BILLING}/pull/9#discussion_r70",
        "commit_id": "abc",
    }
    orphan = {
        "id": 71,
        "pull_request_review_id": None,
        "user": _person("cara"),
        "body": "One more thought on the import.",
        "path": "app.py",
        "line": None,
        "original_line": 4,
        "side": "RIGHT",
        "diff_hunk": "",
        "created_at": "2026-10-06T12:00:00Z",
        "updated_at": "2026-10-06T12:00:00Z",
        "html_url": f"https://github.com/{BILLING}/pull/9#discussion_r71",
    }
    assigned = [
        _issue(
            4,
            title="Please review <script>alert(1)</script>",
            body="Need a second look.",
            comments=2,
            labels=[{"name": "bug", "color": "b60205", "description": "Defect"}],
            updated_at="2026-10-20T18:00:00Z",
        ),
        _issue(
            5,
            title="Retire the old import",
            state="closed",
            state_reason="completed",
            comments=0,
            closed_at="2026-10-02T18:00:00Z",
            updated_at="2026-10-02T18:00:00Z",
        ),
        _issue(
            9,
            title="Assigned pull request",
            user=_person("cara"),
            comments=1,
            review_comments=2,
            html_url=f"https://github.com/{BILLING}/pull/9",
            pull_request={"url": "https://api.github.com/pulls/9"},
        ),
        _issue(
            2,
            title="Unassigned idea that must stay out",
            assignees=[],
            user=_person("ada"),
        ),
    ]
    created = [
        _issue(2, title="Unassigned idea that must stay out", assignees=[], user=_person("ada")),
        _issue(
            8,
            title="Open draft from Ada",
            user=_person("ada"),
            assignees=[],
            comments=0,
            review_comments=0,
            html_url=f"https://github.com/{BILLING}/pull/8",
            pull_request={"url": "https://api.github.com/pulls/8"},
        ),
        _issue(
            11,
            title="Closed without merging",
            state="closed",
            user=_person("ada"),
            assignees=[],
            comments=0,
            review_comments=0,
            closed_at="2026-09-01T12:00:00Z",
            html_url=f"https://github.com/{BILLING}/pull/11",
            pull_request={"url": "https://api.github.com/pulls/11"},
        ),
        _issue(
            3,
            title="Someone else's pull request",
            user=_person("someoneelse"),
            assignees=[_person("someoneelse")],
            pull_request={"url": "https://api.github.com/pulls/3"},
        ),
    ]
    pages = [
        {
            "path": "/user/repos",
            "params": {
                "per_page": 100,
                "affiliation": "owner,collaborator,organization_member",
                "visibility": "all",
            },
            "items": [
                _repo(BILLING, description="Billing service"),
                _repo(SECRET),
                _repo("penelopehs/repo", private=False),
            ],
        },
        {
            "path": f"/orgs/{ORG}/repos",
            "params": {"per_page": 100, "type": "all"},
            "items": [_repo(BILLING, description="Billing service"), _repo(SECRET)],
        },
        {
            "path": f"/repos/{BILLING}/issues",
            "params": {"assignee": "ada"},
            "items": assigned,
        },
        {
            "path": f"/repos/{BILLING}/issues",
            "params": {"creator": "ada"},
            "items": created,
        },
        {
            "path": f"/repos/{SECRET}/issues",
            "params": {"assignee": "ada"},
            "error": GitHubError(403, "Resource not accessible by integration", f"/repos/{SECRET}/issues"),
        },
        {
            "path": f"/repos/{BILLING}/issues/4/comments",
            "items": [comment_late, comment_early],
        },
        {"path": f"/repos/{BILLING}/issues/9/comments", "items": [comment_early]},
        {"path": f"/repos/{BILLING}/pulls/9/reviews", "items": [review]},
        {"path": f"/repos/{BILLING}/pulls/9/comments", "items": [review_comment, orphan]},
        {"path": f"/repos/{BILLING}/pulls/8/reviews", "items": []},
        {"path": f"/repos/{BILLING}/pulls/11/reviews", "items": []},
    ]
    gets = {
        "/user": {"login": "ada", "name": "Ada Lovelace", "html_url": "https://github.com/ada"},
        f"/repos/{BILLING}/pulls/9": {
            "id": 900,
            "number": 9,
            "title": "Assigned pull request",
            "state": "open",
            "draft": False,
            "merged": False,
            "body": "Ready for review.",
            "user": _person("cara"),
            "assignees": [_person("ada")],
            "labels": [{"name": "review", "color": "0e8a16", "description": None}],
            "comments": 1,
            "review_comments": 2,
            "created_at": "2026-10-04T12:00:00Z",
            "updated_at": "2026-10-21T12:00:00Z",
            "closed_at": None,
            "merged_at": None,
            "merge_commit_sha": None,
            "base": {"ref": "main", "sha": "base123"},
            "head": {"ref": "feature", "sha": "head123"},
            "html_url": f"https://github.com/{BILLING}/pull/9",
        },
        f"/repos/{BILLING}/pulls/8": {
            "id": 800,
            "number": 8,
            "title": "Open draft from Ada",
            "state": "open",
            "draft": True,
            "merged": False,
            "body": "",
            "user": _person("ada"),
            "assignees": [],
            "labels": [],
            "comments": 0,
            "review_comments": 0,
            "created_at": "2026-10-08T12:00:00Z",
            "updated_at": "2026-10-18T12:00:00Z",
            "closed_at": None,
            "merged_at": None,
            "base": {"ref": "main", "sha": "aaa"},
            "head": {"ref": "draft", "sha": "bbb"},
            "html_url": f"https://github.com/{BILLING}/pull/8",
        },
        f"/repos/{BILLING}/pulls/11": {
            "id": 1100,
            "number": 11,
            "title": "Closed without merging",
            "state": "closed",
            "draft": False,
            "merged": False,
            "body": "Superseded.",
            "user": _person("ada"),
            "assignees": [],
            "labels": [],
            "comments": 0,
            "review_comments": 0,
            "created_at": "2026-08-01T12:00:00Z",
            "updated_at": "2026-09-01T12:00:00Z",
            "closed_at": "2026-09-01T12:00:00Z",
            "merged_at": None,
            "base": {"ref": "main", "sha": "ccc"},
            "head": {"ref": "old", "sha": "ddd"},
            "html_url": f"https://github.com/{BILLING}/pull/11",
        },
    }
    return FakeGitHub(pages, gets)


def test_archive_selects_assigned_issues_and_own_pull_requests():
    client = _client()
    archive = build_archive(client, organization=ORG)

    assert archive["schema_version"] == "1.0"
    assert archive["subject_login"] == "ada"
    assert archive["account"]["name"] == "Ada Lovelace"
    assert [repo["full_name"] for repo in archive["repositories"]] == [BILLING, SECRET]
    assert "penelopehs/repo" not in {repo["full_name"] for repo in archive["repositories"]}
    assert any("penelopehs/repo" in warning for warning in archive["warnings"])
    assert any("could not be read" in warning for warning in archive["warnings"])

    issues = {item["number"]: item for item in archive["issues"]}
    assert set(issues) == {4, 5}
    assert "Unassigned idea that must stay out" not in {item["title"] for item in archive["issues"]}
    assert issues[4]["status"] == "open"
    assert issues[4]["labels"] == [{"name": "bug", "color": "b60205", "description": "Defect"}]
    assert [comment["id"] for comment in issues[4]["comments"]] == [2, 1]
    assert issues[5]["status"] == "closed"
    assert issues[5]["state_reason"] == "completed"
    assert issues[5]["comments"] == []
    assert [item["number"] for item in archive["issues"]] == [4, 5]

    pulls = {item["number"]: item for item in archive["pull_requests"]}
    assert set(pulls) == {8, 9, 11}
    assert "Someone else's pull request" not in {item["title"] for item in archive["pull_requests"]}
    assert pulls[9]["status"] == "open"
    assert pulls[9]["author"]["login"] == "cara"
    assert pulls[9]["base"] == {"ref": "main", "sha": "base123"}
    assert pulls[9]["reviews"][0]["state"] == "APPROVED"
    notes = {comment["id"]: comment for comment in pulls[9]["review_comments"]}
    assert notes[70]["path"] == "app.py"
    assert notes[70]["line"] == 12
    assert notes[70]["review_id"] == 50
    assert notes[71]["review_id"] is None
    assert notes[71]["original_line"] == 4
    assert pulls[9]["comments"][0]["body"].startswith("The earlier note")
    assert pulls[8]["draft"] is True
    assert pulls[8]["status"] == "open"
    assert pulls[8]["merged"] is False
    assert pulls[11]["status"] == "closed"
    assert pulls[11]["merged"] is False
    assert archive["counts"] == counts(archive)
    assert archive["counts"]["issues"] == 2
    assert archive["counts"]["pull_requests"] == 3
    assert archive["counts"]["reviews"] == 1
    assert archive["counts"]["review_comments"] == 2

    report = render_report(archive)
    assert "<script>alert(1)</script>" not in report
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in report
    assert "innerHTML" not in report
    assert report.count("<script>") == 1
    assert 'id="q"' in report
    assert 'id="repo"' in report
    assert 'id="kind"' in report
    assert 'id="state"' in report
    assert f"https://github.com/{BILLING}/issues/4" in report
    assert f"https://github.com/{BILLING}/pull/9" in report
    assert "Closed as completed" in report
    assert "This name is unclear." in report
    assert "app.py, line 12" in report
    assert "Additional comments on the code" in report
    assert "the line has since moved" in report
    assert "https://example.com/spec" in report
    assert 'style="background:#b60205"' in report
    assert "October 20, 2026, 12:00 PM Mountain Time (America/Denver)" in report
    assert "No description was provided." in report
    assert "Unassigned idea that must stay out" not in report
    assert "penelopehs/repo" in report
    assert "Please note" in report
    assert "No records match these filters." in report


def test_timestamp_uses_mountain_time():
    assert (
        format_timestamp("2026-10-23T03:25:00Z")
        == "October 22, 2026, 9:25 PM Mountain Time (America/Denver)"
    )


def test_empty_organization_is_reported_without_outside_repositories():
    client = FakeGitHub(
        pages=[
            {
                "path": "/user/repos",
                "error": GitHubError(403, "Resource not accessible by integration", "/user/repos"),
            },
            {
                "path": "/installation/repositories",
                "params": {"per_page": 100},
                "items": [_repo("penelopehs/repo", private=False)],
            },
            {
                "path": f"/orgs/{ORG}/repos",
                "params": {"per_page": 100, "type": "all"},
                "items": [],
            },
        ],
        gets={"/user": GitHubError(403, "Resource not accessible by integration", "/user")},
    )
    archive = build_archive(client, organization=ORG)
    assert archive["repositories"] == []
    assert archive["issues"] == []
    assert archive["pull_requests"] == []
    assert archive["subject_login"] is None
    assert any("No repositories in Acquire-Wealth-Collective" in warning for warning in archive["warnings"])
    assert any("penelopehs/repo" in warning for warning in archive["warnings"])
    assert any("--all-repos" in warning for warning in archive["warnings"])
    report = render_report(archive)
    assert "no GitHub username was available" in report
    assert "There are no issues in this archive." in report
    assert "There are no records to filter yet." in report


def test_all_repositories_include_everything_the_credentials_can_read():
    client = FakeGitHub(
        pages=[
            {
                "path": "/user/repos",
                "items": [_repo("penelopehs/repo", private=False), _repo(BILLING)],
            }
        ],
        gets={"/user": {"login": "ada", "name": None, "html_url": "https://github.com/ada"}},
    )
    # The issue listing is not registered, so collection must not start
    # unless a repository is actually selected. Provide empty listings.
    client.pages.extend(
        [
            {"path": "/repos/penelopehs/repo/issues", "params": {"assignee": "ada"}, "items": []},
            {"path": "/repos/penelopehs/repo/issues", "params": {"creator": "ada"}, "items": []},
            {"path": f"/repos/{BILLING}/issues", "params": {"assignee": "ada"}, "items": []},
            {"path": f"/repos/{BILLING}/issues", "params": {"creator": "ada"}, "items": []},
        ]
    )
    archive = build_archive(client, organization=None)
    assert [repo["full_name"] for repo in archive["repositories"]] == [BILLING, "penelopehs/repo"]


def test_write_archive_saves_json_and_html_together(tmp_path):
    client = _client()
    archive = build_archive(client, organization=ORG)
    json_path, html_path = write_archive(tmp_path, archive)
    assert json_path.parent == html_path.parent
    assert json_path.name == "backup.json"
    assert html_path.name == "report.html"
    saved = json.loads(json_path.read_text(encoding="utf-8"))
    assert saved["counts"]["issues"] == 2
    report = html_path.read_text(encoding="utf-8")
    assert "Assigned pull request" in report
    assert "backup.json" in report


def test_client_paginates_and_refuses_unsafe_redirects():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        if request.url.path == "/repos" and request.url.params.get("page") != "2":
            return httpx.Response(
                200,
                json=[{"id": 1}],
                headers={
                    "Link": '<https://api.github.com/repos?page=2>; rel="next", '
                    '<https://api.github.com/repos?page=2>; rel="last"'
                },
            )
        if request.url.path == "/repos":
            return httpx.Response(200, json=[{"id": 2}])
        if request.url.path == "/installation/repositories":
            return httpx.Response(200, json={"repositories": [{"full_name": "octo/repo"}]})
        if request.url.path == "/moved":
            return httpx.Response(302, headers={"location": "https://evil.example/steal"})
        if request.url.path == "/same-host":
            return httpx.Response(302, headers={"location": "https://api.github.com/landed"})
        if request.url.path == "/landed":
            return httpx.Response(200, json={"login": "ada"})
        return httpx.Response(404, json={"message": "missing"})

    http = httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(handler))
    client = GitHubClient("super-secret-token", http=http)
    assert [item["id"] for item in client.paginate("/repos")] == [1, 2]
    assert list(client.paginate("/installation/repositories", list_key="repositories")) == [
        {"full_name": "octo/repo"}
    ]
    try:
        client.get_json("/moved")
    except GitHubError as exc:
        assert exc.status == 302
        assert "super-secret-token" not in str(exc)
    else:
        raise AssertionError("redirect to another site was followed")
    assert "/steal" not in seen
    assert client.get_json("/same-host") == {"login": "ada"}


def test_client_retries_rate_limits_but_not_permission_errors():
    calls = {"rate": 0}
    sleeps = []

    def rate_handler(request: httpx.Request) -> httpx.Response:
        calls["rate"] += 1
        if calls["rate"] == 1:
            return httpx.Response(
                403,
                json={"message": "API rate limit exceeded"},
                headers={"x-ratelimit-remaining": "0", "retry-after": "0"},
            )
        return httpx.Response(200, json={"ok": True})

    http = httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(rate_handler))
    client = GitHubClient("token", http=http, sleeper=sleeps.append)
    assert client.get_json("/user") == {"ok": True}
    assert sleeps == [1]

    def denied(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"message": "Resource not accessible by integration"})

    denied_sleeps = []
    denied_client = GitHubClient(
        "token",
        http=httpx.Client(base_url="https://api.github.com", transport=httpx.MockTransport(denied)),
        sleeper=denied_sleeps.append,
    )
    try:
        denied_client.get_json("/user")
    except GitHubError as exc:
        assert exc.status == 403
        assert "Resource not accessible by integration" in exc.brief()
    else:
        raise AssertionError("permission error was treated as success")
    assert denied_sleeps == []


def test_resolve_token_prefers_the_explicit_value_then_the_environment():
    assert resolve_token(" explicit ", {"GITHUB_TOKEN": "env"}, gh_runner=lambda *a, **k: None) == "explicit"
    assert resolve_token(None, {"GITHUB_TOKEN": " from-env "}, gh_runner=lambda *a, **k: None) == "from-env"
    assert resolve_token(" ", {"GH_TOKEN": "gh-env"}, gh_runner=lambda *a, **k: None) == "gh-env"

    def runner(command, **kwargs):
        assert command == ["gh", "auth", "token"]
        return SimpleNamespace(returncode=0, stdout="cli-token\n")

    assert resolve_token(None, {}, gh_runner=runner) == "cli-token"


def test_cli_writes_both_files_and_rejects_a_missing_token(tmp_path, capsys):
    archive = {
        "generated_at": "2026-10-23T03:25:00Z",
        "account": {"login": "ada", "name": "Ada Lovelace", "html_url": "https://github.com/ada"},
        "subject_login": "ada",
        "organization": ORG,
        "warnings": ["A polite note for the reader."],
        "repositories": [],
        "issues": [],
        "pull_requests": [],
    }

    class Closable:
        def __init__(self):
            self.closed = False

        def close(self):
            self.closed = True

    closable = Closable()
    code = main(
        ["--token", "secret-token", "--output", str(tmp_path), "--login", "ada"],
        builder=lambda client, **kwargs: archive,
        client_factory=lambda token, api_url: closable,
        gh_runner=lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("gh should not be called")),
    )
    assert code == 0
    assert closable.closed is True
    written = list(tmp_path.rglob("*"))
    names = {path.name for path in written}
    assert "backup.json" in names
    assert "report.html" in names
    captured = capsys.readouterr()
    assert "A polite note for the reader." in captured.err
    assert "secret-token" not in captured.out
    assert "secret-token" not in captured.err
    report = next(path for path in written if path.name == "report.html").read_text(encoding="utf-8")
    assert "secret-token" not in report

    missing = main(["--output", str(tmp_path)], gh_runner=lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout=""))
    assert missing == 1
    assert "A GitHub token is required" in capsys.readouterr().err


def test_cli_rejects_an_invalid_organization_before_calling_github(capsys):
    called = []

    class Client:
        def get_json(self, *args, **kwargs):
            called.append(args)

        def close(self):
            pass

    code = main(
        ["--token", "token", "--org", "../not a name"],
        builder=build_archive,
        client_factory=lambda token, api_url: Client(),
    )
    assert code == 1
    assert called == []
    assert "organization name" in capsys.readouterr().err.lower()
