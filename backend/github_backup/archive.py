"""Collect assigned issues and your pull requests, then write the archive."""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from github_backup.client import GitHubClient, GitHubError

DEFAULT_ORG = "Acquire-Wealth-Collective"
SCHEMA_VERSION = "1.0"

_LOGIN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$")
_ORG = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,98}[A-Za-z0-9])?$")

Progress = Callable[[str], None]


def build_archive(
    client: GitHubClient,
    *,
    organization: str | None,
    login: str | None = None,
    progress: Progress | None = None,
) -> dict:
    """Return the structured archive. The caller writes it to disk."""
    if organization is not None and not _ORG.fullmatch(organization):
        raise ValueError(
            "The organization name does not look like a GitHub organization. "
            "Please check the spelling and run the archive again."
        )
    if login is not None and login.strip() and not _LOGIN.fullmatch(login.strip()):
        raise ValueError(
            "The GitHub username does not look valid. "
            "Please check the spelling and run the archive again."
        )

    def note(message: str) -> None:
        if progress:
            progress(message)

    warnings: list[str] = []
    subject, account, identity_warnings = resolve_identity(client, login)
    warnings.extend(identity_warnings)

    if organization:
        note(f"Looking for repositories in {organization}.")
    else:
        note("Looking for every repository these credentials can read.")
    repositories, discovery_warnings = discover_repositories(client, organization)
    warnings.extend(discovery_warnings)

    issues: list[dict] = []
    pull_requests: list[dict] = []
    summaries: list[dict] = []
    if subject:
        for repo in repositories:
            full_name = repo.get("full_name") or "a repository"
            note(f"Reading {full_name}.")
            summary, repo_issues, repo_pulls, repo_warnings = collect_repository(client, repo, subject)
            summaries.append(summary)
            issues.extend(repo_issues)
            pull_requests.extend(repo_pulls)
            warnings.extend(repo_warnings)
    else:
        summaries = [_repo_summary(repo) for repo in repositories]

    issues.sort(key=_updated, reverse=True)
    pull_requests.sort(key=_updated, reverse=True)
    archive = {
        "schema_version": SCHEMA_VERSION,
        "generator": "github-archive",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "account": account,
        "subject_login": subject,
        "organization": organization,
        "scope": _scope(organization, subject),
        "warnings": warnings,
        "repositories": summaries,
        "issues": issues,
        "pull_requests": pull_requests,
    }
    archive["counts"] = counts(archive)
    return archive


def write_archive(directory: Path, archive: dict) -> tuple[Path, Path]:
    """Write ``backup.json`` and ``report.html`` into ``directory``."""
    from github_backup.html_report import render_report

    directory.mkdir(parents=True, exist_ok=True)
    json_path = directory / "backup.json"
    html_path = directory / "report.html"
    json_path.write_text(
        json.dumps(archive, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    html_path.write_text(render_report(archive), encoding="utf-8")
    return json_path, html_path


def counts(archive: dict) -> dict:
    issues = archive.get("issues") or []
    pull_requests = archive.get("pull_requests") or []
    return {
        "repositories": len(archive.get("repositories") or []),
        "issues": len(issues),
        "pull_requests": len(pull_requests),
        "issue_comments": sum(len(item.get("comments") or []) for item in issues),
        "pull_request_comments": sum(len(item.get("comments") or []) for item in pull_requests),
        "reviews": sum(len(item.get("reviews") or []) for item in pull_requests),
        "review_comments": sum(len(item.get("review_comments") or []) for item in pull_requests),
    }


def resolve_identity(client: GitHubClient, login_override: str | None) -> tuple[str | None, dict | None, list[str]]:
    warnings: list[str] = []
    account = None
    try:
        user = client.get_json("/user")
    except GitHubError as exc:
        if exc.status not in {401, 403}:
            raise
        warnings.append(
            f"These credentials cannot read the signed-in GitHub profile ({exc.brief()})."
        )
    else:
        if isinstance(user, dict):
            account = {
                "login": user.get("login"),
                "name": user.get("name"),
                "html_url": user.get("html_url"),
            }

    override = (login_override or "").strip() or None
    account_login = (account or {}).get("login")
    if account_login and (override is None or override.casefold() == str(account_login).casefold()):
        subject = str(account_login)
    else:
        subject = override
    if (
        override
        and account_login
        and override.casefold() != str(account_login).casefold()
    ):
        warnings.append(
            f"Records were selected for @{override}. "
            f"The credentials themselves belong to @{account_login}."
        )
    if not subject:
        warnings.append(
            "No GitHub username was available, so issues and pull requests could not be selected. "
            "Please run this archive again with a personal access token, or pass --login with your GitHub username."
        )
    return subject, account, warnings


def discover_repositories(client: GitHubClient, organization: str | None) -> tuple[list[dict], list[str]]:
    warnings: list[str] = []
    accessible, access_warnings = _list_accessible(client)

    if organization is None:
        warnings.extend(access_warnings)
        repos = _unique_repos(accessible)
        repos.sort(key=lambda repo: repo["full_name"].casefold())
        return repos, warnings

    org_repos, org_warning = _list_org(client, organization)
    if org_warning:
        warnings.append(org_warning)

    selected = _unique_repos(org_repos)
    known = {repo["full_name"].casefold() for repo in selected}
    outside: list[str] = []
    for repo in accessible:
        full_name = repo.get("full_name") if isinstance(repo.get("full_name"), str) else ""
        owner = ((repo.get("owner") or {}).get("login") or "") if isinstance(repo.get("owner"), dict) else ""
        in_org = owner.casefold() == organization.casefold() or full_name.casefold().startswith(
            organization.casefold() + "/"
        )
        if in_org and full_name and full_name.casefold() not in known:
            selected.append(repo)
            known.add(full_name.casefold())
        elif full_name and not in_org:
            outside.append(full_name)

    if access_warnings and not selected and not accessible:
        warnings.extend(access_warnings)
    if not selected:
        warnings.append(
            f"No repositories in {organization} were visible to these credentials. "
            "Private repositories stay hidden unless the token belongs to an account with access, "
            "or a GitHub App has been granted those repositories."
        )
    if outside:
        unique_outside = sorted(set(outside), key=str.casefold)
        pronoun_was = "It was" if len(unique_outside) == 1 else "They were"
        pronoun_is = "it is" if len(unique_outside) == 1 else "they are"
        warnings.append(
            f"These credentials can also read {_human_join(unique_outside)}. "
            f"{pronoun_was} left out of this archive because {pronoun_is} outside {organization}. "
            "Run the archive again with --all-repos if you would like every readable repository included."
        )
    selected.sort(key=lambda repo: repo["full_name"].casefold())
    return selected, warnings


def collect_repository(
    client: GitHubClient,
    repo: dict,
    login: str,
) -> tuple[dict, list[dict], list[dict], list[str]]:
    summary = _repo_summary(repo)
    full_name = summary["full_name"]
    warnings: list[str] = []
    api = _repo_api(full_name)
    try:
        assigned = list(
            client.paginate(
                f"{api}/issues",
                {"state": "all", "per_page": 100, "assignee": login},
            )
        )
        created = list(
            client.paginate(
                f"{api}/issues",
                {"state": "all", "per_page": 100, "creator": login},
            )
        )
    except GitHubError as exc:
        summary["error"] = exc.brief()
        warnings.append(f"{full_name} could not be read. {exc.brief()}")
        return summary, [], [], warnings

    issue_items: dict[int, dict] = {}
    pull_items: dict[int, dict] = {}
    for item in assigned:
        number = item.get("number")
        if not isinstance(number, int):
            continue
        if _is_pull(item):
            if _is_assigned(item, login):
                pull_items[number] = item
        elif _is_assigned(item, login):
            issue_items[number] = item
    for item in created:
        number = item.get("number")
        if not isinstance(number, int) or not _is_pull(item):
            continue
        if _is_author(item, login):
            pull_items.setdefault(number, item)

    issues = []
    for item in issue_items.values():
        comments, comments_error = _conversation(client, api, item)
        if comments_error:
            warnings.append(
                f"Conversation comments for {full_name}#{item.get('number')} could not be downloaded. {comments_error}"
            )
        issues.append(_issue_record(full_name, item, comments, comments_error))
    pull_requests: list[dict] = []
    for number, item in pull_items.items():
        record, record_warnings = _pull_record(client, full_name, api, number, item)
        pull_requests.append(record)
        warnings.extend(record_warnings)

    issues.sort(key=_updated, reverse=True)
    pull_requests.sort(key=_updated, reverse=True)
    summary["issues_included"] = len(issues)
    summary["pull_requests_included"] = len(pull_requests)
    return summary, issues, pull_requests, warnings


def _conversation(client: GitHubClient, api: str, item: dict) -> tuple[list[dict], str | None]:
    number = item.get("number")
    count = item.get("comments")
    if count == 0:
        return [], None
    comments, error = _safe_list(client, f"{api}/issues/{number}/comments", {"per_page": 100})
    return _sorted_comments(comments), error


def _pull_record(
    client: GitHubClient,
    full_name: str,
    api: str,
    number: int,
    item: dict,
) -> tuple[dict, list[str]]:
    warnings: list[str] = []
    detail_error = None
    try:
        pull = client.get_json(f"{api}/pulls/{number}")
        if not isinstance(pull, dict):
            pull = None
            detail_error = f"HTTP 200 for {api}/pulls/{number}: expected an object"
    except GitHubError as exc:
        pull = None
        detail_error = exc.brief()
        warnings.append(f"The details for {full_name}#{number} could not be downloaded. {exc.brief()}")

    source = pull or item
    comments, comments_error = _conversation_from(client, api, number, source, item)
    reviews, reviews_error = _safe_list(client, f"{api}/pulls/{number}/reviews", {"per_page": 100})
    review_count = source.get("review_comments")
    if review_count is None:
        review_count = item.get("review_comments")
    if review_count == 0:
        review_comments, review_comments_error = [], None
    else:
        review_comments, review_comments_error = _safe_list(
            client,
            f"{api}/pulls/{number}/comments",
            {"per_page": 100},
        )
    if comments_error:
        warnings.append(f"Conversation comments for {full_name}#{number} could not be downloaded. {comments_error}")
    if reviews_error:
        warnings.append(f"Reviews for {full_name}#{number} could not be downloaded. {reviews_error}")
    if review_comments_error:
        warnings.append(
            f"Code comments for {full_name}#{number} could not be downloaded. {review_comments_error}"
        )

    record = {
        "kind": "pull_request",
        "id": source.get("id") or item.get("id"),
        "number": number,
        "repository": full_name,
        "title": source.get("title") or item.get("title") or "",
        "state": _github_state(source, item),
        "status": _pull_status(source, item),
        "draft": bool(source.get("draft")),
        "merged": _is_merged(source, item),
        "body": _prefer_body(pull, item),
        "author": _person(source.get("user") or item.get("user")),
        "assignees": _people(source.get("assignees") or item.get("assignees")),
        "labels": _labels(source.get("labels") or item.get("labels")),
        "created_at": _when(source.get("created_at") or item.get("created_at")),
        "updated_at": _when(source.get("updated_at") or item.get("updated_at")),
        "closed_at": _when(source.get("closed_at") or item.get("closed_at")),
        "merged_at": _when(source.get("merged_at")),
        "merge_commit_sha": source.get("merge_commit_sha"),
        "base": _branch(source.get("base")),
        "head": _branch(source.get("head")),
        "html_url": source.get("html_url") or item.get("html_url") or f"https://github.com/{full_name}/pull/{number}",
        "detail_error": detail_error,
        "comments": comments,
        "comments_error": comments_error,
        "reviews": _sorted_reviews(reviews),
        "reviews_error": reviews_error,
        "review_comments": _sorted_review_comments(review_comments),
        "review_comments_error": review_comments_error,
    }
    return record, warnings


def _conversation_from(
    client: GitHubClient,
    api: str,
    number: int,
    source: dict,
    fallback: dict,
) -> tuple[list[dict], str | None]:
    count = source.get("comments")
    if count is None:
        count = fallback.get("comments")
    if count == 0:
        return [], None
    comments, error = _safe_list(client, f"{api}/issues/{number}/comments", {"per_page": 100})
    return _sorted_comments(comments), error


def _issue_record(full_name: str, item: dict, comments: list[dict], comments_error: str | None) -> dict:
    number = item.get("number")
    return {
        "kind": "issue",
        "id": item.get("id"),
        "number": number,
        "repository": full_name,
        "title": item.get("title") or "",
        "state": item.get("state") or "unknown",
        "state_reason": item.get("state_reason"),
        "status": item.get("state") if item.get("state") in {"open", "closed"} else "unknown",
        "body": item.get("body") or "",
        "author": _person(item.get("user")),
        "assignees": _people(item.get("assignees")),
        "labels": _labels(item.get("labels")),
        "created_at": _when(item.get("created_at")),
        "updated_at": _when(item.get("updated_at")),
        "closed_at": _when(item.get("closed_at")),
        "html_url": item.get("html_url") or f"https://github.com/{full_name}/issues/{number}",
        "comments": comments,
        "comments_error": comments_error,
    }


def _list_accessible(client: GitHubClient) -> tuple[list[dict], list[str]]:
    try:
        repos = list(
            client.paginate(
                "/user/repos",
                {
                    "per_page": 100,
                    "affiliation": "owner,collaborator,organization_member",
                    "visibility": "all",
                },
            )
        )
        return repos, []
    except GitHubError as user_error:
        if user_error.status not in {401, 403, 404}:
            raise
    try:
        repos = list(
            client.paginate(
                "/installation/repositories",
                {"per_page": 100},
                list_key="repositories",
            )
        )
        return repos, []
    except GitHubError as app_error:
        if app_error.status not in {401, 403, 404}:
            raise
        return [], [
            "The account's repositories could not be listed "
            f"({user_error.brief()}). "
            "The GitHub App installation repositories could not be listed either "
            f"({app_error.brief()})."
        ]


def _list_org(client: GitHubClient, organization: str) -> tuple[list[dict], str | None]:
    path = f"/orgs/{quote(organization, safe='')}/repos"
    try:
        return list(client.paginate(path, {"per_page": 100, "type": "all"})), None
    except GitHubError as exc:
        if exc.status not in {401, 403, 404}:
            raise
        return [], f"Repositories in {organization} could not be listed ({exc.brief()})."


def _safe_list(client: GitHubClient, path: str, params: dict | None = None) -> tuple[list[dict], str | None]:
    try:
        return list(client.paginate(path, params)), None
    except GitHubError as exc:
        return [], exc.brief()


def _repo_summary(repo: dict) -> dict:
    full_name = repo.get("full_name") or ""
    return {
        "full_name": full_name,
        "private": bool(repo.get("private")),
        "archived": bool(repo.get("archived")),
        "description": repo.get("description") or "",
        "default_branch": repo.get("default_branch") or "",
        "html_url": repo.get("html_url") or (f"https://github.com/{full_name}" if full_name else None),
        "issues_included": 0,
        "pull_requests_included": 0,
        "error": None,
    }


def _repo_api(full_name: str) -> str:
    owner, name = full_name.split("/", 1)
    return f"/repos/{quote(owner, safe='')}/{quote(name, safe='')}"


def _unique_repos(repos: list[dict]) -> list[dict]:
    chosen: dict[str, dict] = {}
    for repo in repos:
        full_name = repo.get("full_name")
        if isinstance(full_name, str) and "/" in full_name:
            chosen.setdefault(full_name.casefold(), repo)
    return list(chosen.values())


def _scope(organization: str | None, subject: str | None) -> dict:
    where = (
        f"repositories in {organization} that these credentials can read"
        if organization
        else "every repository these credentials can read"
    )
    who = f"@{subject}" if subject else "the selected account"
    return {
        "repositories": where,
        "issues": f"Open and closed issues currently assigned to {who}.",
        "pull_requests": (
            f"Pull requests created by {who}, and pull requests currently assigned to {who}."
        ),
        "included_with_each_record": [
            "description",
            "labels",
            "status",
            "dates",
            "link to the original GitHub page",
            "conversation comments",
            "pull request reviews",
            "comments on the code",
        ],
    }


def _is_pull(item: dict) -> bool:
    return "pull_request" in item


def _is_author(item: dict, login: str) -> bool:
    user = item.get("user")
    if not isinstance(user, dict):
        return False
    return (user.get("login") or "").casefold() == login.casefold()


def _is_assigned(item: dict, login: str) -> bool:
    people = []
    assignees = item.get("assignees")
    if isinstance(assignees, list):
        people.extend(person for person in assignees if isinstance(person, dict))
    assignee = item.get("assignee")
    if isinstance(assignee, dict):
        people.append(assignee)
    return any((person.get("login") or "").casefold() == login.casefold() for person in people)


def _person(value: object) -> dict:
    if isinstance(value, dict) and value.get("login"):
        return {"login": value["login"], "html_url": value.get("html_url")}
    return {"login": "unknown", "html_url": None}


def _people(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    return [_person(person) for person in value if isinstance(person, dict) and person.get("login")]


def _labels(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    labels = []
    for label in value:
        if isinstance(label, str):
            labels.append({"name": label, "color": None, "description": None})
        elif isinstance(label, dict) and label.get("name"):
            labels.append(
                {
                    "name": label.get("name"),
                    "color": label.get("color"),
                    "description": label.get("description"),
                }
            )
    return labels


def _branch(value: object) -> dict:
    if not isinstance(value, dict):
        return {"ref": None, "sha": None}
    return {"ref": value.get("ref"), "sha": value.get("sha")}


def _prefer_body(pull: dict | None, fallback: dict) -> str:
    if isinstance(pull, dict) and pull.get("body") is not None:
        return pull.get("body") or ""
    return fallback.get("body") or ""


def _when(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None


def _github_state(source: dict, fallback: dict) -> str:
    state = source.get("state") or fallback.get("state") or "unknown"
    if state == "merged":
        return "closed"
    return state


def _is_merged(source: dict, fallback: dict) -> bool:
    return bool(source.get("merged") or source.get("merged_at") or fallback.get("merged_at") or source.get("state") == "merged")


def _pull_status(source: dict, fallback: dict) -> str:
    if _is_merged(source, fallback):
        return "merged"
    state = source.get("state") or fallback.get("state")
    if state in {"open", "closed"}:
        return state
    return "unknown"


def _comment(item: dict) -> dict:
    return {
        "id": item.get("id"),
        "author": _person(item.get("user")),
        "body": item.get("body") or "",
        "created_at": _when(item.get("created_at")),
        "updated_at": _when(item.get("updated_at")),
        "html_url": item.get("html_url"),
    }


def _review(item: dict) -> dict:
    return {
        "id": item.get("id"),
        "author": _person(item.get("user")),
        "state": item.get("state") or "COMMENTED",
        "body": item.get("body") or "",
        "submitted_at": _when(item.get("submitted_at")),
        "html_url": item.get("html_url"),
        "commit_id": item.get("commit_id"),
    }


def _review_comment(item: dict) -> dict:
    line = item.get("line") if isinstance(item.get("line"), int) else None
    original = item.get("original_line") if isinstance(item.get("original_line"), int) else None
    return {
        "id": item.get("id"),
        "review_id": item.get("pull_request_review_id"),
        "author": _person(item.get("user")),
        "body": item.get("body") or "",
        "path": item.get("path"),
        "line": line,
        "original_line": original,
        "side": item.get("side"),
        "diff_hunk": item.get("diff_hunk") or "",
        "in_reply_to_id": item.get("in_reply_to_id"),
        "created_at": _when(item.get("created_at")),
        "updated_at": _when(item.get("updated_at")),
        "html_url": item.get("html_url"),
        "commit_id": item.get("commit_id"),
    }


def _sorted_comments(items: list[dict]) -> list[dict]:
    comments = [_comment(item) for item in items]
    comments.sort(key=lambda comment: comment.get("created_at") or "")
    return comments


def _sorted_reviews(items: list[dict]) -> list[dict]:
    reviews = [_review(item) for item in items]
    reviews.sort(key=lambda review: review.get("submitted_at") or "")
    return reviews


def _sorted_review_comments(items: list[dict]) -> list[dict]:
    comments = [_review_comment(item) for item in items]
    comments.sort(
        key=lambda comment: (
            comment.get("path") or "",
            comment.get("line") if isinstance(comment.get("line"), int) else comment.get("original_line") or 0,
            comment.get("created_at") or "",
        )
    )
    return comments


def _updated(item: dict) -> str:
    return item.get("updated_at") or item.get("created_at") or ""


def _human_join(items: list[str], limit: int = 12) -> str:
    extra = max(0, len(items) - limit)
    shown = items[:limit]
    if not shown:
        return ""
    if extra:
        if len(shown) == 1:
            return f"{shown[0]}, and {extra} more"
        return f"{', '.join(shown)}, and {extra} more"
    if len(shown) == 1:
        return shown[0]
    if len(shown) == 2:
        return f"{shown[0]} and {shown[1]}"
    return f"{', '.join(shown[:-1])}, and {shown[-1]}"
