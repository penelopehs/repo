"""Render the archive as a self-contained HTML report."""

from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from github_backup.archive import counts

_MOUNTAIN = ZoneInfo("America/Denver")
_URL = re.compile(r"https?://[^\s<>()]+")
_COLOR = re.compile(r"^[0-9a-fA-F]{6}$")

_REVIEW_LABELS = {
    "APPROVED": "Approved",
    "CHANGES_REQUESTED": "Changes requested",
    "COMMENTED": "Commented",
    "DISMISSED": "Dismissed",
    "PENDING": "Pending",
}

_REASON_LABELS = {
    "completed": "Closed as completed",
    "not_planned": "Closed as not planned",
    "reopened": "Reopened",
}


def render_report(archive: dict) -> str:
    """Return a complete HTML document for ``archive``."""
    totals = counts(archive)
    subject = archive.get("subject_login")
    organization = archive.get("organization")
    title = _page_title(subject, organization)
    records = list(archive.get("issues") or []) + list(archive.get("pull_requests") or [])
    repositories = list(archive.get("repositories") or [])
    repo_names = []
    for repo in repositories:
        name = repo.get("full_name")
        if name and name not in repo_names:
            repo_names.append(name)
    for record in records:
        name = record.get("repository")
        if name and name not in repo_names:
            repo_names.append(name)

    parts = [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{_esc(title)}</title>",
        f"<style>{_CSS}</style>",
        "</head>",
        "<body>",
        '<header class="masthead">',
        '<p class="eyebrow">Personal GitHub archive</p>',
        f"<h1>{_esc(title)}</h1>",
        f'<p class="lede">{_intro(archive)}</p>',
        _facts(archive, totals),
        "</header>",
        _warnings(archive.get("warnings") or []),
        _filters(repo_names),
        '<nav class="contents" aria-label="On this page">',
        "<a href=\"#issues\">Issues</a>",
        "<a href=\"#pull-requests\">Pull requests</a>",
        "<a href=\"#repositories\">Repositories</a>",
        "</nav>",
        _issue_section(archive.get("issues") or []),
        _pull_section(archive.get("pull_requests") or []),
        _repository_section(repositories),
        "<footer>",
        "<p>This page and the <code>backup.json</code> file beside it were generated together. "
        "Please keep them in the same folder. Each link leaves this archive and opens the original page on GitHub.</p>",
        "</footer>",
        f"<script>{_SCRIPT}</script>",
        "</body>",
        "</html>",
        "",
    ]
    return "\n".join(parts)


def format_timestamp(value: str | None) -> str | None:
    """Format a GitHub timestamp in the reader's Mountain Time zone."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    local = parsed.astimezone(_MOUNTAIN)
    clock = local.strftime("%I:%M %p").lstrip("0")
    return f"{local.strftime('%B')} {local.day}, {local.year}, {clock} Mountain Time (America/Denver)"


def _page_title(subject: str | None, organization: str | None) -> str:
    if subject and organization:
        return f"GitHub archive for @{subject}"
    if subject:
        return f"GitHub archive for @{subject}"
    if organization:
        return f"GitHub archive for {organization}"
    return "GitHub archive"


def _intro(archive: dict) -> str:
    subject = archive.get("subject_login")
    account = archive.get("account") or {}
    name = account.get("name") if isinstance(account, dict) else None
    organization = archive.get("organization")
    if subject and name and str(name).casefold() != str(subject).casefold():
        prepared = f"This archive was prepared for {_esc(str(name))} (@{_esc(subject)})."
    elif subject:
        prepared = f"This archive was prepared for @{_esc(subject)}."
    else:
        prepared = (
            "This archive lists the repositories these credentials can read. "
            "It could not be limited to one person's assigned work, because no GitHub username was available."
        )
    if subject:
        prepared += (
            " It includes issues that are assigned to you now, whether they are open or closed, "
            "and pull requests that you opened or that are assigned to you. "
            "Each record keeps its description, labels, status, dates, and a link to the original page, "
            "together with the conversation. Pull requests also include reviews and comments left on the code."
        )
    if organization:
        prepared += f" The repositories were limited to {_esc(organization)}."
    else:
        prepared += " Every repository these credentials can read was considered."
    prepared += " The same records are stored beside this page in <code>backup.json</code>."
    return prepared


def _facts(archive: dict, totals: dict) -> str:
    rows = [
        ("Prepared", _time(archive.get("generated_at")) or "Not available"),
        ("GitHub account", _account_label(archive)),
        (
            "Organization",
            _esc(archive.get("organization")) if archive.get("organization") else "Every readable repository",
        ),
        ("Repositories reviewed", str(totals["repositories"])),
        ("Issues", str(totals["issues"])),
        ("Pull requests", str(totals["pull_requests"])),
        ("Conversation comments", str(totals["issue_comments"] + totals["pull_request_comments"])),
        ("Reviews", str(totals["reviews"])),
        ("Comments on the code", str(totals["review_comments"])),
    ]
    body = "".join(f"<div><dt>{_esc(label)}</dt><dd>{value}</dd></div>" for label, value in rows)
    return f'<dl class="summary">{body}</dl>'


def _account_label(archive: dict) -> str:
    subject = archive.get("subject_login")
    account = archive.get("account") if isinstance(archive.get("account"), dict) else None
    if account and account.get("html_url") and account.get("login"):
        login = _esc(str(account["login"]))
        link = f'<a href="{_esc(account["html_url"])}">@{login}</a>'
        if subject and subject.casefold() != str(account["login"]).casefold():
            return f'{link} <span class="quiet">(records selected for @{_esc(subject)})</span>'
        if account.get("name"):
            return f"{_esc(str(account['name']))} ({link})"
        return link
    if subject:
        return f"@{_esc(subject)}"
    return "Not available"


def _warnings(warnings: list[str]) -> str:
    if not warnings:
        return ""
    items = "".join(f"<li>{_esc(warning)}</li>" for warning in warnings)
    return (
        '<aside class="notice" role="note">'
        "<h2>Please note</h2>"
        f"<ul>{items}</ul>"
        "</aside>"
    )


def _filters(repo_names: list[str]) -> str:
    options = ['<option value="all">All repositories</option>']
    options.extend(
        f'<option value="{_esc(name)}">{_esc(name)}</option>' for name in repo_names
    )
    return f"""
<form class="filters" role="search">
  <div class="fields">
    <label>Search
      <input id="q" type="search" autocomplete="off" placeholder="Title, description, comment, or file">
    </label>
    <label>Repository
      <select id="repo">{''.join(options)}</select>
    </label>
    <label>Kind
      <select id="kind">
        <option value="all">All records</option>
        <option value="issue">Issues</option>
        <option value="pull_request">Pull requests</option>
      </select>
    </label>
    <label>Status
      <select id="state">
        <option value="all">All statuses</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
        <option value="merged">Merged</option>
      </select>
    </label>
  </div>
  <p id="filter-summary" aria-live="polite"></p>
</form>
<noscript><p class="quiet">Filters use JavaScript. Every record is still listed below.</p></noscript>
"""


def _issue_section(issues: list[dict]) -> str:
    body = "".join(_issue_article(issue) for issue in issues)
    empty = "" if issues else '<p class="none">There are no issues in this archive.</p>'
    return (
        '<section id="issues" data-section="issue">'
        "<h2>Issues</h2>"
        '<p class="section-empty" hidden>No issues match these filters.</p>'
        f"{empty}{body}"
        "</section>"
    )


def _pull_section(pulls: list[dict]) -> str:
    body = "".join(_pull_article(pull) for pull in pulls)
    empty = "" if pulls else '<p class="none">There are no pull requests in this archive.</p>'
    return (
        '<section id="pull-requests" data-section="pull_request">'
        "<h2>Pull requests</h2>"
        '<p class="section-empty" hidden>No pull requests match these filters.</p>'
        f"{empty}{body}"
        "</section>"
    )


def _repository_section(repositories: list[dict]) -> str:
    if not repositories:
        body = '<p class="none">No repositories were available to review.</p>'
    else:
        rows = "".join(_repository_row(repo) for repo in repositories)
        body = (
            "<table>"
            "<thead><tr>"
            '<th scope="col">Repository</th>'
            '<th scope="col">Visibility</th>'
            '<th scope="col">Default branch</th>'
            '<th scope="col">Issues</th>'
            '<th scope="col">Pull requests</th>'
            '<th scope="col">Notes</th>'
            "</tr></thead>"
            f"<tbody>{rows}</tbody></table>"
        )
    return f'<section id="repositories"><h2>Repositories reviewed</h2>{body}</section>'


def _issue_article(issue: dict) -> str:
    status = issue.get("status") or issue.get("state") or "unknown"
    reason = _REASON_LABELS.get(issue.get("state_reason") or "", "")
    facts = [
        _fact("Author", _person_html(issue.get("author"))),
        _fact("Assignees", _people_html(issue.get("assignees"))),
        _fact("Labels", _labels_html(issue.get("labels"))),
        _fact("Opened", _time(issue.get("created_at"))),
        _fact("Updated", _time(issue.get("updated_at"))),
        _fact("Closed", _time(issue.get("closed_at"))),
    ]
    if reason:
        facts.append(_fact("Outcome", _esc(reason)))
    return _article(
        kind="issue",
        status=status,
        record=issue,
        facts="".join(facts),
        extra="",
        threads=_comment_thread("Conversation", issue.get("comments") or [], issue.get("comments_error")),
    )


def _pull_article(pull: dict) -> str:
    status = pull.get("status") or pull.get("state") or "unknown"
    base = (pull.get("base") or {}).get("ref")
    head = (pull.get("head") or {}).get("ref")
    branches = None
    if head or base:
        branches = f"{_esc(head or 'the working branch')} → {_esc(base or 'the base branch')}"
    facts = [
        _fact("Author", _person_html(pull.get("author"))),
        _fact("Assignees", _people_html(pull.get("assignees"))),
        _fact("Labels", _labels_html(pull.get("labels"))),
        _fact("Branches", branches) if branches else "",
        _fact("Opened", _time(pull.get("created_at"))),
        _fact("Updated", _time(pull.get("updated_at"))),
        _fact("Closed", _time(pull.get("closed_at"))),
        _fact("Merged", _time(pull.get("merged_at"))),
    ]
    if pull.get("draft"):
        facts.insert(0, _fact("Draft", "Yes, this pull request is still a draft."))
    extra = ""
    if pull.get("detail_error"):
        extra = f'<p class="quiet">Some pull request details could not be downloaded. {_esc(pull["detail_error"])}</p>'
    threads = "".join(
        [
            _comment_thread("Conversation", pull.get("comments") or [], pull.get("comments_error")),
            _reviews_html(pull),
        ]
    )
    return _article(kind="pull_request", status=status, record=pull, facts="".join(facts), extra=extra, threads=threads)


def _article(*, kind: str, status: str, record: dict, facts: str, extra: str, threads: str) -> str:
    number = record.get("number")
    repository = record.get("repository") or ""
    title = record.get("title") or "Untitled"
    url = record.get("html_url")
    anchor = _anchor(kind, repository, number)
    pill = f'<span class="pill pill-{_esc(status)}">{_esc(_status_label(status))}</span>'
    repo_link = _link(_repo_url(repository), repository) if repository else ""
    heading = _link(url, title) if url else _esc(title)
    original = (
        f'<p class="original"><a href="{_esc(url)}">Open the original on GitHub</a></p>' if url else ""
    )
    return (
        f'<article id="{_esc(anchor)}" class="record" data-kind="{_esc(kind)}" '
        f'data-state="{_esc(status)}" data-repo="{_esc(repository)}" '
        f'data-text="{_esc(_search_text(record))}">'
        '<header class="record-head">'
        f'<p class="kicker">{pill} {repo_link} <span class="quiet">#{_esc(number)}</span></p>'
        f"<h3>{heading}</h3>"
        "</header>"
        f"{original}"
        f'<dl class="facts">{facts}</dl>'
        f"{extra}"
        f'<div class="prose">{_text(record.get("body"), "No description was provided.")}</div>'
        f"{threads}"
        "</article>"
    )


def _reviews_html(pull: dict) -> str:
    reviews = list(pull.get("reviews") or [])
    comments = list(pull.get("review_comments") or [])
    error = pull.get("reviews_error") or pull.get("review_comments_error")
    if not reviews and not comments and not error:
        return (
            '<section class="thread"><h4>Reviews</h4>'
            '<p class="quiet">There are no reviews on this pull request.</p></section>'
            '<section class="thread"><h4>Comments on the code</h4>'
            '<p class="quiet">There are no comments on the code.</p></section>'
        )
    grouped: dict[object, list[dict]] = {}
    orphans: list[dict] = []
    for comment in comments:
        review_id = comment.get("review_id")
        if review_id is None:
            orphans.append(comment)
        else:
            grouped.setdefault(review_id, []).append(comment)
    items = []
    seen = set()
    for review in reviews:
        seen.add(review.get("id"))
        notes = "".join(_code_comment(comment) for comment in grouped.get(review.get("id"), []))
        notes_html = f'<div class="code-notes"><h5>Comments on the code</h5>{notes}</div>' if notes else ""
        label = _REVIEW_LABELS.get(review.get("state") or "", review.get("state") or "Review")
        body = _text(review.get("body"), "No written summary was included.")
        link = ""
        if review.get("html_url"):
            link = f'<p class="original"><a href="{_esc(review["html_url"])}">View this review on GitHub</a></p>'
        items.append(
            "<li>"
            f'<p class="who">{_esc(label)} · {_person_html(review.get("author"))} · {_time(review.get("submitted_at"))}</p>'
            f'<div class="prose">{body}</div>'
            f"{link}{notes_html}"
            "</li>"
        )
    for review_id, notes in grouped.items():
        if review_id in seen:
            continue
        orphan_notes = "".join(_code_comment(comment) for comment in notes)
        items.append(f'<li><div class="code-notes"><h5>Comments on the code</h5>{orphan_notes}</div></li>')
    if orphans:
        orphan_notes = "".join(_code_comment(comment) for comment in orphans)
        items.append(
            "<li><h5>Additional comments on the code</h5>"
            f'<div class="code-notes">{orphan_notes}</div></li>'
        )
    error_html = f'<p class="quiet">{_esc(error)}</p>' if error else ""
    return (
        '<section class="thread"><h4>Reviews and comments on the code</h4>'
        f"{error_html}<ol>{''.join(items)}</ol></section>"
    )


def _code_comment(comment: dict) -> str:
    reply = ""
    if comment.get("in_reply_to_id"):
        reply = '<p class="quiet">This note replies to an earlier comment on the same code.</p>'
    hunk = comment.get("diff_hunk") or ""
    diff = ""
    if hunk:
        open_attr = " open" if hunk.count("\n") < 20 else ""
        diff = (
            f"<details{open_attr}>"
            "<summary>View the code that was discussed</summary>"
            f"<pre class=\"diff\">{_esc(hunk)}</pre>"
            "</details>"
        )
    link = ""
    if comment.get("html_url"):
        link = f'<p class="original"><a href="{_esc(comment["html_url"])}">View this comment on GitHub</a></p>'
    return (
        '<article class="code-comment">'
        f'<p class="who">{_esc(_line_label(comment))} · {_person_html(comment.get("author"))} · {_time(comment.get("created_at"))}</p>'
        f"{reply}"
        f'<div class="prose">{_text(comment.get("body"), "This comment has no text.")}</div>'
        f"{diff}{link}"
        "</article>"
    )


def _comment_thread(title: str, comments: list[dict], error: str | None) -> str:
    if error:
        body = f'<p class="quiet">The conversation could not be downloaded. {_esc(error)}</p>'
    elif not comments:
        body = '<p class="quiet">There are no conversation comments.</p>'
    else:
        items = []
        for comment in comments:
            link = ""
            if comment.get("html_url"):
                link = (
                    f'<p class="original"><a href="{_esc(comment["html_url"])}">'
                    "View this comment on GitHub</a></p>"
                )
            items.append(
                "<li>"
                f'<p class="who">{_person_html(comment.get("author"))} · {_time(comment.get("created_at"))}</p>'
                f'<div class="prose">{_text(comment.get("body"), "This comment has no text.")}</div>'
                f"{link}"
                "</li>"
            )
        body = f"<ol>{''.join(items)}</ol>"
    return f'<section class="thread"><h4>{_esc(title)}</h4>{body}</section>'


def _repository_row(repo: dict) -> str:
    full_name = repo.get("full_name") or ""
    notes = []
    if repo.get("archived"):
        notes.append("Archived on GitHub.")
    if repo.get("error"):
        notes.append(f"This repository could not be read. {repo['error']}")
    elif not notes:
        notes.append("Included.")
    visibility = "Private" if repo.get("private") else "Public"
    issues = "Not read" if repo.get("error") else str(repo.get("issues_included") or 0)
    pulls = "Not read" if repo.get("error") else str(repo.get("pull_requests_included") or 0)
    return (
        f'<tr data-repo-row="{_esc(full_name)}">'
        f"<td>{_link(repo.get('html_url'), full_name)}</td>"
        f"<td>{visibility}</td>"
        f"<td>{_esc(repo.get('default_branch') or 'Not listed')}</td>"
        f"<td>{_esc(issues)}</td>"
        f"<td>{_esc(pulls)}</td>"
        f"<td>{_esc(' '.join(notes))}</td>"
        "</tr>"
    )


def _fact(label: str, value: str | None) -> str:
    if not value:
        return ""
    return f"<div><dt>{_esc(label)}</dt><dd>{value}</dd></div>"


def _person_html(person: dict | None) -> str:
    if not isinstance(person, dict) or not person.get("login") or person.get("login") == "unknown":
        return "Not available"
    if person.get("html_url"):
        return _link(person["html_url"], person["login"])
    return _esc(str(person["login"]))


def _people_html(people: list | None) -> str:
    if not people:
        return "No assignee is listed."
    return ", ".join(_person_html(person) for person in people)


def _labels_html(labels: list | None) -> str:
    if not labels:
        return "No labels."
    chips = []
    for label in labels:
        name = label.get("name") if isinstance(label, dict) else str(label)
        color = label.get("color") if isinstance(label, dict) else ""
        dot = ""
        if isinstance(color, str) and _COLOR.fullmatch(color):
            dot = f'<span class="dot" style="background:#{color}"></span>'
        chips.append(f'<span class="chip">{dot}{_esc(name or "")}</span>')
    return " ".join(chips)


def _line_label(comment: dict) -> str:
    path = comment.get("path") or "a file"
    line = comment.get("line")
    if isinstance(line, int):
        return f"{path}, line {line}"
    original = comment.get("original_line")
    if isinstance(original, int):
        return f"{path}, original line {original} (the line has since moved)"
    return path


def _time(value: str | None) -> str:
    if not value:
        return ""
    shown = format_timestamp(value) or value
    return f'<time datetime="{_esc(value)}">{_esc(shown)}</time>'


def _text(value: str | None, empty: str) -> str:
    if not value or not str(value).strip():
        return f'<span class="quiet">{_esc(empty)}</span>'
    return _linkify(str(value))


def _linkify(value: str) -> str:
    parts: list[str] = []
    cursor = 0
    for match in _URL.finditer(value):
        parts.append(_esc(value[cursor : match.start()]))
        raw = match.group(0)
        trimmed = raw.rstrip(".,;:!?")
        parts.append(f'<a href="{_esc(trimmed)}">{_esc(trimmed)}</a>')
        parts.append(_esc(raw[len(trimmed) :]))
        cursor = match.end()
    parts.append(_esc(value[cursor:]))
    return "".join(parts)


def _link(url: str | None, label: object) -> str:
    text = _esc(label if label is not None else "")
    if not url:
        return text
    return f'<a href="{_esc(str(url))}">{text}</a>'


def _repo_url(full_name: str) -> str:
    return f"https://github.com/{full_name}"


def _status_label(status: str) -> str:
    labels = {"open": "Open", "closed": "Closed", "merged": "Merged"}
    return labels.get(status, status.replace("_", " ").title() or "Unknown")


def _anchor(kind: str, repository: str, number: object) -> str:
    slug = repository.replace("/", "--")
    prefix = "issue" if kind == "issue" else "pull"
    return f"{prefix}-{slug}-{number}"


def _search_text(record: dict) -> str:
    parts: list[str] = [
        str(record.get("title") or ""),
        str(record.get("body") or ""),
        str(record.get("repository") or ""),
        f"#{record.get('number')}",
        str((record.get("author") or {}).get("login") or ""),
    ]
    for label in record.get("labels") or []:
        if isinstance(label, dict):
            parts.append(str(label.get("name") or ""))
    for comment in record.get("comments") or []:
        parts.append(str(comment.get("body") or ""))
    for review in record.get("reviews") or []:
        parts.append(str(review.get("body") or ""))
        parts.append(str(review.get("state") or ""))
    for comment in record.get("review_comments") or []:
        parts.append(str(comment.get("body") or ""))
        parts.append(str(comment.get("path") or ""))
    raw = " ".join(part for part in parts if part)
    return " ".join(raw.casefold().split())


def _esc(value: object) -> str:
    return html.escape("" if value is None else str(value), quote=True)


_CSS = """
:root {
  color-scheme: light;
  --paper: #f4f0e8;
  --card: #fffcf8;
  --ink: #1c1915;
  --muted: #5e584e;
  --line: #ddd4c6;
  --navy: #1e3348;
  --open: #1d6b45;
  --closed: #6d4b28;
  --merged: #3a4678;
  --serif: Palatino, "Palatino Linotype", "Iowan Old Style", "Book Antiqua", Georgia, serif;
  --sans: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16.5px;
  line-height: 1.55;
}
body > header, body > aside, body > form, body > nav, body > section, body > footer, body > noscript {
  width: min(920px, calc(100% - 2rem));
  margin-left: auto;
  margin-right: auto;
}
.masthead { padding: 2.5rem 0 1rem; border-top: 6px solid var(--navy); }
.eyebrow {
  margin: 0 0 0.4rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.78rem;
  color: var(--navy);
}
h1, h2, h3, h4, h5 { font-family: var(--serif); font-weight: 600; line-height: 1.25; }
h1 { margin: 0 0 0.8rem; font-size: 2.15rem; }
h2 { margin: 2rem 0 0.8rem; font-size: 1.55rem; border-bottom: 1px solid var(--line); padding-bottom: 0.3rem; }
h3 { margin: 0; font-size: 1.28rem; }
h4 { margin: 0 0 0.6rem; font-size: 1.05rem; }
h5 { margin: 0.8rem 0 0.4rem; font-size: 0.95rem; }
a { color: var(--navy); }
p { margin: 0.6rem 0; }
.lede { font-size: 1.05rem; }
.quiet, .none { color: var(--muted); }
.summary, .facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem 1.25rem;
  margin: 1.2rem 0;
  padding: 0;
}
.summary div, .facts div { margin: 0; }
dt { font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
dd { margin: 0.15rem 0 0; }
.notice {
  background: #f8f1e3;
  border: 1px solid #c4a46a;
  padding: 0.9rem 1.1rem;
  margin-top: 0.5rem;
}
.notice h2 { margin: 0 0 0.4rem; border: 0; font-size: 1.15rem; }
.filters {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgba(244, 240, 232, 0.96);
  padding: 0.85rem 0;
  margin-top: 1rem;
}
.fields {
  display: grid;
  grid-template-columns: 1.4fr 1fr 0.8fr 0.8fr;
  gap: 0.75rem;
}
label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.78rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
input, select {
  font: inherit;
  text-transform: none;
  letter-spacing: 0;
  color: var(--ink);
  background: white;
  border: 1px solid var(--line);
  padding: 0.45rem 0.55rem;
}
.contents { display: flex; gap: 1rem; padding-bottom: 0.4rem; }
.record {
  background: var(--card);
  border: 1px solid var(--line);
  padding: 1.1rem 1.2rem 1.2rem;
  margin: 0 0 1rem;
}
.kicker { margin: 0 0 0.35rem; color: var(--muted); }
.pill {
  display: inline-block;
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.pill-open { color: var(--open); }
.pill-closed { color: var(--closed); }
.pill-merged { color: var(--merged); }
.prose { white-space: pre-wrap; overflow-wrap: anywhere; }
.thread { margin-top: 1rem; padding-top: 0.4rem; border-top: 1px solid var(--line); }
.thread ol { margin: 0; padding-left: 1.2rem; }
.thread li { margin: 0.85rem 0; }
.who { margin: 0; color: var(--muted); font-size: 0.92rem; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
  margin: 0 0.2rem 0.2rem 0;
  background: #f7f4ee;
}
.dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; display: inline-block; }
.diff {
  overflow-x: auto;
  background: #f6f3ec;
  border: 1px solid var(--line);
  padding: 0.75rem 1rem;
  font-family: var(--mono);
  font-size: 0.82rem;
  line-height: 1.45;
  white-space: pre;
}
.code-comment { margin: 0.7rem 0 0.9rem; }
table { width: 100%; border-collapse: collapse; background: var(--card); }
th, td { text-align: left; vertical-align: top; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--line); }
th { font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
footer { padding: 1rem 0 3rem; color: var(--muted); }
@media (max-width: 800px) { .fields { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .fields { grid-template-columns: 1fr; } }
@media print {
  .filters, .contents, noscript { display: none !important; }
  .record { break-inside: avoid; }
  body { background: white; }
}
"""

_SCRIPT = """
(function () {
  var form = document.querySelector(".filters");
  var query = document.getElementById("q");
  var repo = document.getElementById("repo");
  var kind = document.getElementById("kind");
  var state = document.getElementById("state");
  var summary = document.getElementById("filter-summary");
  if (!form || !query || !repo || !kind || !state || !summary) return;
  var records = Array.prototype.slice.call(document.querySelectorAll("[data-kind]"));
  var rows = Array.prototype.slice.call(document.querySelectorAll("[data-repo-row]"));
  function apply() {
    var text = query.value.trim().toLowerCase();
    var shown = 0;
    records.forEach(function (record) {
      var visible = (kind.value === "all" || record.getAttribute("data-kind") === kind.value)
        && (state.value === "all" || record.getAttribute("data-state") === state.value)
        && (repo.value === "all" || record.getAttribute("data-repo") === repo.value)
        && (text === "" || (record.getAttribute("data-text") || "").indexOf(text) !== -1);
      record.hidden = !visible;
      if (visible) shown += 1;
    });
    rows.forEach(function (row) {
      row.hidden = repo.value !== "all" && row.getAttribute("data-repo-row") !== repo.value;
    });
    if (records.length === 0) {
      summary.textContent = "There are no records to filter yet.";
      return;
    }
    if (shown === 0) {
      summary.textContent = "No records match these filters.";
    } else if (shown === records.length) {
      summary.textContent = records.length === 1
        ? "1 record matches these filters."
        : records.length + " records match these filters.";
    } else {
      var verb = shown === 1 ? "matches" : "match";
      summary.textContent = shown + " of " + records.length + " records " + verb + " these filters.";
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-section]"), function (section) {
      var note = section.querySelector(".section-empty");
      var visible = section.querySelectorAll("[data-kind]:not([hidden])").length;
      var total = section.querySelectorAll("[data-kind]").length;
      if (note) note.hidden = total === 0 || visible !== 0;
    });
  }
  form.addEventListener("submit", function (event) { event.preventDefault(); apply(); });
  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  apply();
})();
"""
