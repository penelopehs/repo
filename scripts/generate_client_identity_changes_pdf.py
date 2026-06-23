#!/usr/bin/env python3
"""Generate a PDF report documenting the client identity matching feature."""

from datetime import date
from pathlib import Path

from fpdf import FPDF


def ascii_safe(text: str) -> str:
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u2192", "->")
    )


class ChangeReportPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, ascii_safe("Sales Billing - Client Identity Matching"), align="L")
        self.cell(0, 8, date.today().isoformat(), align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title: str):
        self.ln(4)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(20, 40, 80)
        self.cell(0, 10, ascii_safe(title), new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(0, 150, 180)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def subsection(self, title: str):
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(30, 30, 30)
        self.cell(0, 8, ascii_safe(title), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(self.epw, 5.5, ascii_safe(text))
        self.ln(1)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        indent = 6
        self.set_x(self.l_margin)
        self.cell(indent, 5.5, "-")
        self.multi_cell(self.epw - indent, 5.5, ascii_safe(text))
        self.ln(0.5)

    def code_block(self, lines: list[str]):
        self.set_font("Courier", "", 8.5)
        self.set_fill_color(245, 247, 250)
        self.set_text_color(20, 20, 20)
        for line in lines:
            self.cell(0, 4.8, "  " + ascii_safe(line), new_x="LMARGIN", new_y="NEXT", fill=True)
        self.ln(2)

    def ensure_space(self, height: float = 30):
        if self.get_y() + height > self.page_break_trigger:
            self.add_page()

    def file_change_block(self, path: str, summary: str, changes: list[str]):
        self.ensure_space(40)
        self.subsection(path)
        self.body_text(summary)
        for change in changes:
            self.bullet(change)
        self.ln(1)


def build_pdf(output_path: Path) -> None:
    pdf = ChangeReportPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(20, 40, 80)
    pdf.cell(0, 12, "Client Identity Matching", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(
        0,
        8,
        ascii_safe("Frontend change report - unified client profiles from duplicate rows"),
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    pdf.section_title("1. Overview")
    pdf.body_text(
        "Multiple dashboard rows can represent the same real-world client when core identity "
        "fields align. This feature treats those rows as one client: clicking any matching row "
        "opens the same profile, and the profile aggregates record-specific data (years, rep, "
        "calculations, calls, added dates) without merge buttons or new screens. "
        "Implementation is frontend-only with minimal, localized changes."
    )

    pdf.section_title("2. Feature Location")
    pdf.bullet("Client Dashboard -> All Leads & Clients table (Status column / row click)")
    pdf.bullet("Client Profile page (/clients/$id)")
    pdf.ln(2)

    pdf.section_title("3. Matching Rules (ALL required)")
    pdf.bullet("Client name: fullName must match exactly (strict equality).")
    pdf.bullet("Entity: at least one entity name must match exactly (from entityNames or data.entities).")
    pdf.bullet("Contact: normalized phone matches OR normalized email matches (non-empty).")
    pdf.body_text(
        "Clusters use transitive matching: if record A matches B and B matches C, all three "
        "belong to the same client group even when A and C do not match directly."
    )

    pdf.section_title("4. Canonical Profile ID")
    pdf.body_text(
        "Within a cluster, the canonical lead id is the record with the earliest addedAt date; "
        "ties break on lowest numeric id. Pipeline navigation always routes to this id. "
        "Profile mutations (edit, notes, tax history) target the canonical record."
    )

    pdf.section_title("5. Files Changed")
    files = [
        ("frontend/src/utils/clientIdentity.ts", "NEW - matching, clustering, merge utilities"),
        ("frontend/src/utils/clientIdentity.test.ts", "NEW - 6 unit tests"),
        ("frontend/src/pages/PipelinePage.tsx", "Navigate to canonical profile id"),
        ("frontend/src/pages/ProfilePage.tsx", "Cluster load, aggregation, unified display"),
    ]
    for path, desc in files:
        pdf.bullet(f"{path} - {desc}")
    pdf.ln(2)
    pdf.body_text(
        "Note: frontend/package-lock.json may show unrelated local drift and is not part of this feature."
    )

    pdf.add_page()
    pdf.section_title("6. New Utility: clientIdentity.ts")

    pdf.subsection("Exported functions")
    pdf.code_block([
        "entityNamesFor(lead) - collect entity names from list + data",
        "leadsMatch(a, b) - pairwise match on name + entity + contact",
        "getClientCluster(lead, allLeads) - BFS transitive cluster",
        "canonicalLeadId(lead, allLeads) - stable profile id for navigation",
        "mergeLeadsForDisplay(cluster, canonicalId) - merged read model",
        "clientRecordSnapshots(cluster) - per-record field snapshots",
    ])

    pdf.subsection("Contact normalization")
    pdf.code_block([
        "Phone: strip non-digits, compare digit strings",
        "Email: trim + lowercase, compare (must be non-empty)",
    ])

    pdf.file_change_block(
        "frontend/src/pages/PipelinePage.tsx",
        "Client Dashboard table row click handler.",
        [
            "Import canonicalLeadId from @/utils/clientIdentity.",
            "goProfile() resolves canonicalLeadId(l, leads) before navigate.",
            "All matching rows open /clients/{canonicalId}.",
            "goCalc() unchanged - still uses the clicked row's lead for calculator context.",
        ],
    )

    pdf.file_change_block(
        "frontend/src/pages/ProfilePage.tsx",
        "Client Profile - load, display, and mutate unified client.",
        [
            "routeLead: lead loaded by URL id; cluster via getClientCluster.",
            "canonicalId: stable id for writes and sub-navigation.",
            "lead: mergeLeadsForDisplay when cluster size > 1.",
            "primaryLead: canonical record used for EditClientDialog.",
            "Fetch all cluster members (fetchLead, fetchCalls, fetchIntakeNotes).",
            "Merge calls and intake notes from all cluster lead ids.",
            "updateLead / intake notes use canonicalId.",
            "Call toggle/auto-complete resolves owning lead id per call.",
            "Feasibility Call and ScheduleCallDialog use canonicalId.",
        ],
    )

    pdf.add_page()
    pdf.section_title("7. Profile Aggregation (existing UI only)")

    pdf.subsection("Merged automatically on display lead")
    pdf.bullet("taxYears - union of all cluster records, sorted")
    pdf.bullet("entityNames / entitiesCount - combined")
    pdf.bullet("engagements - concatenated from all records")
    pdf.bullet("latestCalculation - most recent date across records")
    pdf.bullet("calls - all follow-up calls from cluster members")
    pdf.bullet("intakeNotes - all notes, newest first")

    pdf.subsection("General Information (when cluster has 2+ records)")
    pdf.bullet("Engagement Years (all records)")
    pdf.bullet("Representatives (all records)")
    pdf.bullet("Latest Calculations (all records)")
    pdf.bullet("Next Calls (all records)")
    pdf.bullet("Added Dates (all records)")

    pdf.subsection("Assigned Sales Representative card")
    pdf.bullet("Shows comma-separated list when multiple reps exist in the cluster.")

    pdf.section_title("8. Expected Behavior")
    pdf.bullet("Duplicate rows with matching name, entity, and phone/email open the same profile.")
    pdf.bullet("No merge button, merge workflow, or new screens added.")
    pdf.bullet("Record-specific data remains visible in aggregated fields.")
    pdf.bullet("Single-record clients behave exactly as before.")
    pdf.bullet("Backend APIs unchanged; no schema or server logic modified.")

    pdf.section_title("9. Unit Tests (clientIdentity.test.ts)")
    pdf.bullet("Matches when name, entity, and email align.")
    pdf.bullet("Rejects match when entity differs.")
    pdf.bullet("Rejects match when contact differs.")
    pdf.bullet("Clusters transitively through a middle record.")
    pdf.bullet("Canonical id prefers earliest addedAt.")
    pdf.bullet("mergeLeadsForDisplay combines tax years and latest calculation.")

    pdf.section_title("10. Validation Checklist")
    pdf.bullet("Find duplicate rows: same fullName, shared entity, shared phone or email.")
    pdf.bullet("Click Status/name from different matching rows -> same profile URL.")
    pdf.bullet("Verify aggregated years, reps, calculations, calls, added dates on profile.")
    pdf.bullet("Confirm filters, search, and single-client workflows still work.")

    pdf.section_title("11. Restrictions Followed")
    pdf.bullet("No push to GitHub.")
    pdf.bullet("No commits created as part of this report.")
    pdf.bullet("Frontend-only; minimal non-invasive changes.")
    pdf.bullet("No new UI components, merge buttons, or screens.")

    pdf.section_title("12. Git Status (at report time)")
    pdf.body_text(
        "Branch: Year-Range-Fix-2022-2026. Client matching changes are local and unstaged: "
        "2 new files, 2 modified source files. Regenerate this PDF after further edits with: "
        "python scripts/generate_client_identity_changes_pdf.py"
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    out = root / "Client_Identity_Matching_Changes.pdf"
    build_pdf(out)
    print(f"Created: {out}")
