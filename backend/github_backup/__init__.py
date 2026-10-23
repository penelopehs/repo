"""Personal GitHub archive for assigned issues and your pull requests.

The archive is written as two files in one folder:

* ``report.html`` — a readable report with sections, filters, and links
* ``backup.json`` — the same records, structured for later processing
"""

from github_backup.archive import build_archive, write_archive

__all__ = ["build_archive", "write_archive"]
