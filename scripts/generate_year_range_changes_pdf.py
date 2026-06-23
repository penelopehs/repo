#!/usr/bin/env python3
"""Generate a PDF report documenting the tax year range fix (2020/2021 removal)."""

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
        self.cell(0, 8, ascii_safe("Sales Billing - Tax Year Range Fix"), align="L")
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

    def ensure_space(self, height: float = 30):
        if self.get_y() + height > self.page_break_trigger:
            self.add_page()

    def code_block(self, lines: list[str]):
        self.set_font("Courier", "", 8.5)
        self.set_fill_color(245, 247, 250)
        self.set_text_color(20, 20, 20)
        for line in lines:
            self.cell(0, 4.8, "  " + ascii_safe(line), new_x="LMARGIN", new_y="NEXT", fill=True)
        self.ln(2)

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
    pdf.cell(0, 12, "Tax Year Range Fix", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 8, ascii_safe("Frontend change report - remove 2020 and 2021"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    pdf.section_title("1. Overview")
    pdf.body_text(
        "This change restricts tax year selection across the frontend to 2022 through 2026. "
        "Years 2020 and 2021 were removed from the centralized type definition and all "
        "dependent UI components. The fix was applied with minimal scope: frontend only, "
        "no backend, API, database, or server-side logic changes."
    )

    pdf.section_title("2. Year Range")
    pdf.subsection("Before")
    pdf.code_block([
        "TaxYear = 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026",
        "ALL_TAX_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]",
    ])
    pdf.subsection("After")
    pdf.code_block([
        "TaxYear = 2022 | 2023 | 2024 | 2025 | 2026",
        "ALL_TAX_YEARS = [2022, 2023, 2024, 2025, 2026]",
        "SELECTABLE_TAX_YEARS = [2022, 2023, 2024, 2025, 2026]  (new constant)",
    ])

    pdf.section_title("3. Files Modified (10 source files)")
    files = [
        ("frontend/src/types/crm.ts", "Central definition — primary fix"),
        ("frontend/src/components/MultiYearSelect.tsx", "Year dropdown, buttons, chips"),
        ("frontend/src/components/pipeline/AddLeadDialog.tsx", "Add lead year selector"),
        ("frontend/src/components/pipeline/EditClientDialog.tsx", "Edit client year selector"),
        ("frontend/src/components/profile/AddEngagementDialog.tsx", "Add engagement years"),
        ("frontend/src/pages/CalculatorPage.tsx", "Calculator year label logic"),
        ("frontend/src/pages/ProfilePage.tsx", "Tax history panel years & layout"),
        ("frontend/src/store/calculatorStore.ts", "Select-all tax years action"),
        ("frontend/src/utils/calculationContext.ts", "Doc comment update"),
        ("frontend/src/utils/calculationContext.test.ts", "Unit test data update"),
    ]
    for path, desc in files:
        pdf.bullet(f"{path} — {desc}")
    pdf.ln(2)
    pdf.body_text(
        "Note: frontend/package-lock.json also shows local dependency version drift "
        "(unrelated to this feature). It was not part of the year-range fix."
    )

    pdf.add_page()
    pdf.section_title("4. Detailed Changes by File")

    pdf.file_change_block(
        "frontend/src/types/crm.ts",
        "Centralized type and constants. All components importing these inherit the new range.",
        [
            "Removed 2020 and 2021 from TaxYear union type.",
            "Removed 2020 and 2021 from ALL_TAX_YEARS array.",
            "Added SELECTABLE_TAX_YEARS constant: [2022, 2023, 2024, 2025, 2026].",
            "Updated JSDoc example from \"2021\" to \"2022\" in LeadData.calculations.",
        ],
    )

    pdf.file_change_block(
        "frontend/src/components/MultiYearSelect.tsx",
        "Shared multi-select popover and inline year button components.",
        [
            "Import changed from ALL_TAX_YEARS to SELECTABLE_TAX_YEARS.",
            "allSelected check now uses SELECTABLE_TAX_YEARS.every(...).",
            "Label updated: \"All Years (2020–2026)\" → \"All Years (2022–2026)\".",
            "Popover grid layout: grid-cols-2 → grid-cols-3 (5 years, balanced 3+2).",
            "YearButtons default years prop: SELECTABLE_TAX_YEARS.",
            "YearChips \"All Years\" badge uses SELECTABLE_TAX_YEARS.length.",
        ],
    )

    pdf.file_change_block(
        "frontend/src/components/pipeline/AddLeadDialog.tsx",
        "Add New Lead modal — engagement year multi-select.",
        [
            "Import: ALL_TAX_YEARS replaced with SELECTABLE_TAX_YEARS.",
            "onSelectAll handler: setYears([...SELECTABLE_TAX_YEARS]).",
        ],
    )

    pdf.file_change_block(
        "frontend/src/components/pipeline/EditClientDialog.tsx",
        "Edit Client modal — tax year multi-select.",
        [
            "Import: ALL_TAX_YEARS replaced with SELECTABLE_TAX_YEARS.",
            "onSelectAll handler: taxYears: [...SELECTABLE_TAX_YEARS].",
        ],
    )

    pdf.file_change_block(
        "frontend/src/components/profile/AddEngagementDialog.tsx",
        "Add Engagement modal — year selection and billing amounts.",
        [
            "Import: ALL_TAX_YEARS replaced with SELECTABLE_TAX_YEARS.",
            "onSelectAll sets years and amounts from SELECTABLE_TAX_YEARS only.",
        ],
    )

    pdf.file_change_block(
        "frontend/src/pages/CalculatorPage.tsx",
        "Calculator client information section.",
        [
            "Added SELECTABLE_TAX_YEARS import.",
            "yearsLabel \"All Tax Years\" check: length === 7 → length === SELECTABLE_TAX_YEARS.length.",
        ],
    )

    pdf.add_page()
    pdf.file_change_block(
        "frontend/src/pages/ProfilePage.tsx",
        "R&D Tax Credit History panel (TaxHistoryPanel).",
        [
            "Added SELECTABLE_TAX_YEARS import.",
            "Replaced rolling 7 calendar years (currentYear - i) with SELECTABLE_TAX_YEARS + legacyYears.",
            "legacyYears: years in ALL_TAX_YEARS outside SELECTABLE with saved status or engagement.",
            "Year cards grid: grid-cols-4 sm:grid-cols-7 → grid-cols-3 sm:grid-cols-5.",
        ],
    )

    pdf.file_change_block(
        "frontend/src/store/calculatorStore.ts",
        "Zustand calculator store.",
        [
            "Added SELECTABLE_TAX_YEARS import.",
            "selectAllTaxYears action: uses SELECTABLE_TAX_YEARS instead of ALL_TAX_YEARS.",
            "Year validation filter (line 169) still uses ALL_TAX_YEARS — inherits updated range.",
        ],
    )

    pdf.file_change_block(
        "frontend/src/utils/calculationContext.ts",
        "Helper to derive tax years from lead calculation keys.",
        [
            "Doc comment example updated: \"2021\" → \"2022\".",
            "Validation filter uses ALL_TAX_YEARS — inherits updated range automatically.",
        ],
    )

    pdf.file_change_block(
        "frontend/src/utils/calculationContext.test.ts",
        "Unit tests for calculation context helpers.",
        [
            "Test fixture calculations key: \"2021\" → \"2022\".",
            "Expected result: [2021, 2024] → [2022, 2024].",
        ],
    )

    pdf.section_title("5. Files That Inherit (no direct edits)")
    pdf.body_text(
        "These files reference ALL_TAX_YEARS or TaxYear and automatically use the new "
        "2022–2026 range after the crm.ts update:"
    )
    inherited = [
        "frontend/src/services/leads.ts — TAX_YEARS validation set",
        "frontend/src/store/calculatorStore.ts — calculation year filter",
        "frontend/src/pages/ProfilePage.tsx — engaged-year calculation sync loop",
        "Pipeline, Documents, Calculator, and Review pages using YearChips / TaxYear types",
    ]
    for item in inherited:
        pdf.bullet(item)

    pdf.section_title("6. UI Layout Adjustments")
    pdf.ensure_space(35)
    pdf.body_text(
        "Removing two years (7 → 5) required minor layout tweaks so horizontal year "
        "controls remain visually balanced:"
    )
    pdf.bullet("MultiYearSelect popover: 2-column grid → 3-column grid (3+2 layout for 5 years).")
    pdf.bullet("ProfilePage tax history cards: sm:grid-cols-7 → sm:grid-cols-5.")
    pdf.bullet("YearButtons (inline): flex-wrap unchanged — buttons reflow naturally.")
    pdf.body_text("No color, typography, or broader styling changes were made.")

    pdf.section_title("7. Out of Scope (unchanged)")
    for item in [
        "Backend code, APIs, database schemas",
        "Server-side calculations and business logic",
        "Seed/mock data in documentsStore and engagementsStore (already 2022+)",
        "ESLint ecmaVersion: 2020 (JavaScript language version, not a tax year)",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Expected Behavior")
    pdf.bullet("Users can only select 2022, 2023, 2024, 2025, or 2026 in any year selector.")
    pdf.bullet("No dropdown, filter, chip, tab, or button group displays 2020 or 2021.")
    pdf.bullet("\"Select all years\" selects exactly the five allowed years.")
    pdf.bullet("Backend remains fully compatible; existing API contracts unchanged.")

    pdf.section_title("9. Git Status")
    pdf.body_text(
        "Branch: penelope. Changes are local and unstaged. No commit or push was performed "
        "as part of this task."
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    out = root / "Year_Range_Fix_Changes.pdf"
    build_pdf(out)
    print(f"Created: {out}")
