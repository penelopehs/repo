"""Command line entry for the personal GitHub archive."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path

from github_backup.archive import DEFAULT_ORG, build_archive, write_archive
from github_backup.client import GitHubClient, GitHubError


def main(
    argv: list[str] | None = None,
    *,
    builder: Callable = build_archive,
    client_factory: Callable = GitHubClient,
    gh_runner: Callable | None = None,
) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    token = resolve_token(args.token, os.environ, gh_runner)
    if not token:
        print(
            "A GitHub token is required. Set GITHUB_TOKEN, or sign in with the GitHub CLI, "
            "and then run this command again.",
            file=sys.stderr,
        )
        return 1

    organization = None if args.all_repos else args.org
    output = Path(args.output).expanduser()
    folder = output / datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")

    def progress(message: str) -> None:
        print(message, file=sys.stderr)

    client = client_factory(token, api_url=args.api_url)
    try:
        archive = builder(
            client,
            organization=organization,
            login=args.login,
            progress=progress,
        )
    except GitHubError as exc:
        print(f"The archive could not be created. {exc.brief()}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        close = getattr(client, "close", None)
        if close:
            close()

    json_path, html_path = write_archive(folder, archive)
    for warning in archive.get("warnings") or []:
        print(f"Note: {warning}", file=sys.stderr)
    print(f"Wrote {json_path}")
    print(f"Wrote {html_path}")
    return 0


def resolve_token(
    explicit: str | None,
    env: dict[str, str],
    gh_runner: Callable | None = None,
) -> str | None:
    for candidate in (explicit, env.get("GITHUB_TOKEN"), env.get("GH_TOKEN")):
        if candidate and candidate.strip():
            return candidate.strip()
    return token_from_gh(gh_runner)


def token_from_gh(runner: Callable | None = None) -> str | None:
    run = runner or subprocess.run
    try:
        completed = run(
            ["gh", "auth", "token"],
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if getattr(completed, "returncode", 1) != 0:
        return None
    token = (getattr(completed, "stdout", "") or "").strip()
    return token or None


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m github_backup",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=(
            "Build a personal archive of GitHub issues and pull requests.\n"
            "\n"
            "The archive contains two files in the same folder:\n"
            "  report.html    a readable report with sections, filters, and links to GitHub\n"
            "  backup.json    the same records in a structured form for later processing\n"
            "\n"
            "Issues include open and closed items currently assigned to you.\n"
            "Pull requests include items you opened and items currently assigned to you.\n"
            "Conversation comments, reviews, and comments on the code are included."
        ),
        epilog=(
            "Example:\n"
            "  python -m github_backup --org Acquire-Wealth-Collective\n"
        ),
    )
    parser.add_argument(
        "--org",
        default=DEFAULT_ORG,
        help=f"Organization to archive (default: {DEFAULT_ORG}).",
    )
    parser.add_argument(
        "--all-repos",
        action="store_true",
        help="Include every repository these credentials can read, including repositories outside the organization.",
    )
    parser.add_argument(
        "--login",
        help="GitHub username whose assigned issues and pull requests should be archived. Defaults to the account that owns the token.",
    )
    parser.add_argument(
        "--token",
        help=(
            "Personal access token. When omitted, GITHUB_TOKEN, GH_TOKEN, and the GitHub CLI "
            "login are used, in that order. Prefer an environment variable so the token is not "
            "saved in your shell history."
        ),
    )
    parser.add_argument(
        "--output",
        default="backups/github",
        help="Directory in which a new timestamped folder will be created. That folder contains backup.json and report.html.",
    )
    parser.add_argument(
        "--api-url",
        default="https://api.github.com",
        help=argparse.SUPPRESS,
    )
    return parser
