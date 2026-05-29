import { useState, useEffect } from "react";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const ENGAGEMENTS = [
  {
    id: "ENG-2024-001",
    clientName: "Northshore Surgical Associates",
    entityType: "S-Corp",
    ein: "82-4471203",
    years: [2021, 2022, 2023],
    entities: [
      { id: "e1", name: "Northshore Surgical Associates, PC", type: "Practice Entity" },
      { id: "e2", name: "Northshore Real Estate Holdings LLC", type: "Real Estate Entity" },
      { id: "e3", name: "Dr. Harpreet Gill", type: "Individual" },
    ],
    contacts: [
      { id: "c1", name: "Dr. Harpreet Gill", role: "Owner / Physician", email: "hgill@northshoresurgical.com" },
      { id: "c2", name: "Amanda Torres", role: "Office Manager", email: "atorres@northshoresurgical.com" },
      { id: "c3", name: "David Kim, CPA", role: "External Accountant", email: "dkim@brightlinecpa.com" },
    ],
  },
  {
    id: "ENG-2024-002",
    clientName: "Blue Ridge Dermatology Group",
    entityType: "Partnership",
    ein: "71-9934021",
    years: [2022, 2023],
    entities: [
      { id: "e4", name: "Blue Ridge Dermatology Group, PLLC", type: "Practice Entity" },
      { id: "e5", name: "BR Derm Management Co.", type: "Management Company" },
      { id: "e6", name: "Dr. Candace Monroe", type: "Individual" },
      { id: "e7", name: "Dr. James Whitfield", type: "Individual" },
    ],
    contacts: [
      { id: "c4", name: "Dr. Candace Monroe", role: "Managing Partner", email: "cmonroe@blueridgederm.com" },
      { id: "c5", name: "Rachel Nguyen", role: "Practice Administrator", email: "rnguyen@blueridgederm.com" },
      { id: "c6", name: "Tom Schafer", role: "Controller", email: "tschafer@blueridgederm.com" },
    ],
  },
  {
    id: "ENG-2023-014",
    clientName: "Summit Valley Orthopedics",
    entityType: "C-Corp",
    ein: "59-2218847",
    years: [2020, 2021, 2022, 2023],
    entities: [
      { id: "e8", name: "Summit Valley Orthopedics, Inc.", type: "Practice Entity" },
      { id: "e9", name: "SVO Ambulatory Surgery Center LLC", type: "ASC Entity" },
      { id: "e10", name: "Summit Medical Properties LLC", type: "Real Estate Entity" },
      { id: "e11", name: "Dr. Nathaniel Park", type: "Individual" },
    ],
    contacts: [
      { id: "c7", name: "Dr. Nathaniel Park", role: "CEO / Physician Owner", email: "npark@summitvalleyortho.com" },
      { id: "c8", name: "Lisa Brennan", role: "CFO", email: "lbrennan@summitvalleyortho.com" },
      { id: "c9", name: "Hernandez & Cho LLP", role: "External Tax Firm", email: "info@hcllp.com" },
    ],
  },
];

const DOCUMENT_CATEGORIES = [
  {
    category: "Tax Returns",
    icon: "📋",
    docs: [
      { id: "d1", label: "Federal Business Tax Return (Form 1120 / 1120-S / 1065)", short: "Federal Business Return" },
      { id: "d2", label: "Federal Individual Tax Return (Form 1040)", short: "Form 1040" },
      { id: "d3", label: "State Tax Return(s)", short: "State Return(s)" },
      { id: "d4", label: "Payroll Tax Returns (Form 941)", short: "Form 941" },
      { id: "d5", label: "Prior Year Tax Returns (All Entities)", short: "Prior Year Returns" },
    ],
  },
  {
    category: "Financial Records",
    icon: "📊",
    docs: [
      { id: "d6", label: "General Ledger (GL) — Full Detail", short: "General Ledger" },
      { id: "d7", label: "Profit & Loss Statement", short: "P&L Statement" },
      { id: "d8", label: "Balance Sheet", short: "Balance Sheet" },
      { id: "d9", label: "Trial Balance", short: "Trial Balance" },
      { id: "d10", label: "Chart of Accounts", short: "Chart of Accounts" },
    ],
  },
  {
    category: "R&D Documentation",
    icon: "🔬",
    docs: [
      { id: "d11", label: "W-2 Wages for Qualified Research Employees", short: "W-2 / QRE Wages" },
      { id: "d12", label: "Contract Research Agreements", short: "Contract Research Docs" },
      { id: "d13", label: "Supply & Lab Expense Records", short: "Supply / Lab Records" },
      { id: "d14", label: "Time Tracking / Timesheets", short: "Timesheets" },
      { id: "d15", label: "Project Notes / Lab Notebooks", short: "Project Notes" },
    ],
  },
  {
    category: "Corporate & Entity Docs",
    icon: "🏢",
    docs: [
      { id: "d16", label: "Articles of Incorporation / Organization", short: "Articles of Org." },
      { id: "d17", label: "Operating Agreement / Bylaws", short: "Operating Agreement" },
      { id: "d18", label: "Ownership / Shareholder Agreement", short: "Ownership Agreement" },
      { id: "d19", label: "EIN / IRS Assignment Letters", short: "EIN Letters" },
    ],
  },
  {
    category: "Payroll & HR",
    icon: "👥",
    docs: [
      { id: "d20", label: "Payroll Detail Reports by Employee", short: "Payroll Detail" },
      { id: "d21", label: "W-2 / W-3 Summary", short: "W-2 / W-3" },
      { id: "d22", label: "1099-NEC / Contractor Payments", short: "1099-NEC" },
      { id: "d23", label: "Benefits & Compensation Summaries", short: "Benefits Summary" },
    ],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function badge(type) {
  const map = {
    "Practice Entity": "#1a4a6b",
    "Real Estate Entity": "#3d6b3a",
    "Management Company": "#6b4a1a",
    "ASC Entity": "#4a1a6b",
    Individual: "#1a5a5a",
  };
  return map[type] || "#444";
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function DocRequestPortal() {
  const [step, setStep] = useState(1); // 1=select engagement, 2=configure request, 3=review+send, 4=done
  const [engagement, setEngagement] = useState(null);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [customNote, setCustomNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [dueDate, setDueDate] = useState("");

  const filteredEngagements = ENGAGEMENTS.filter(
    (e) =>
      e.clientName.toLowerCase().includes(searchQ.toLowerCase()) ||
      e.id.toLowerCase().includes(searchQ.toLowerCase())
  );

  function toggleYear(y) {
    setSelectedYears((prev) => prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]);
  }
  function toggleEntity(id) {
    setSelectedEntities((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleDoc(id) {
    setSelectedDocs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function selectAllDocsInCategory(docs) {
    const ids = docs.map((d) => d.id);
    const allSelected = ids.every((id) => selectedDocs.includes(id));
    if (allSelected) setSelectedDocs((prev) => prev.filter((id) => !ids.includes(id)));
    else setSelectedDocs((prev) => [...new Set([...prev, ...ids])]);
  }

  const allDocs = DOCUMENT_CATEGORIES.flatMap((c) => c.docs);
  const selectedDocLabels = selectedDocs.map((id) => allDocs.find((d) => d.id === id)?.short).filter(Boolean);
  const selectedEntityNames = selectedEntities.map((id) => engagement?.entities.find((e) => e.id === id)?.name).filter(Boolean);
  const contactObj = engagement?.contacts.find((c) => c.id === selectedContact);

  async function handleSend() {
    if (!contactObj) return;
    setSending(true);
    try {
      const prompt = `You are an assistant at Acquire Tax Credits (Acquire Wealth Collective), a firm specializing in R&D tax credit studies for physician-owned medical practices.

Write a professional, warm, and clear document request email to ${contactObj.name} (${contactObj.role}) for client "${engagement.clientName}" (EIN: ${engagement.ein}).

Details:
- Engagement ID: ${engagement.id}
- Tax Years Requested: ${selectedYears.join(", ")}
- Entities in Scope: ${selectedEntityNames.join("; ")}
- Documents Requested: ${selectedDocLabels.join(", ")}
- Due Date: ${dueDate || "as soon as possible"}
- Additional Notes from team: ${customNote || "None"}

The email should:
1. Reference the engagement and purpose (R&D tax credit study)
2. List the documents in a clean, organized way grouped by category
3. Explain why each category is needed at a high level
4. Be specific about the years and entities
5. Include a clear call to action and due date
6. Offer contact info for questions
7. Be signed from "The Acquire Tax Credits Team"

Output ONLY the email body (subject line first, then body). Do not include any preamble.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").join("") || "Error generating email.";
      setSentResult(text);
      setStep(4);
    } catch (e) {
      setSentResult("Error sending request. Please try again.");
      setStep(4);
    }
    setSending(false);
  }

  const canProceedStep2 = selectedYears.length > 0 && selectedEntities.length > 0 && selectedDocs.length > 0;
  const canProceedStep3 = canProceedStep2 && selectedContact;

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: "#0b0f1a", minHeight: "100vh", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0b0f1a; }
        .portal { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }
        .header { 
          background: linear-gradient(135deg, #0d1422 0%, #111827 100%);
          border-bottom: 1px solid #c9a84c33;
          padding: 24px 48px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .logo-text { font-size: 22px; font-weight: 600; letter-spacing: 0.08em; color: #c9a84c; font-family: 'Cormorant Garamond', serif; }
        .logo-sub { font-size: 11px; letter-spacing: 0.2em; color: #8a9bb0; font-family: 'DM Mono', monospace; text-transform: uppercase; margin-top: 2px; }
        .step-bar { display: flex; gap: 0; background: #0d1422; border-bottom: 1px solid #1e2a3a; padding: 0 48px; }
        .step-item { 
          padding: 14px 28px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;
          font-family: 'DM Mono', monospace; color: #4a5a70; border-bottom: 2px solid transparent;
          cursor: default; display: flex; align-items: center; gap: 8px;
        }
        .step-item.active { color: #c9a84c; border-bottom-color: #c9a84c; }
        .step-item.done { color: #5a8a60; }
        .step-num { 
          width: 20px; height: 20px; border-radius: 50%; font-size: 10px;
          display: flex; align-items: center; justify-content: center; border: 1px solid currentColor;
        }
        .main { max-width: 1100px; margin: 0 auto; padding: 48px; }
        .section-title { font-size: 32px; font-weight: 300; color: #e8e0d0; letter-spacing: 0.02em; margin-bottom: 6px; }
        .section-sub { font-size: 13px; color: #6a7a8a; letter-spacing: 0.05em; font-family: 'DM Mono', monospace; margin-bottom: 32px; }
        .search-bar {
          background: #111827; border: 1px solid #1e2a3a; border-radius: 4px;
          padding: 12px 16px; font-size: 15px; color: #e8e0d0; width: 100%; margin-bottom: 24px;
          font-family: 'Cormorant Garamond', serif; outline: none;
          transition: border-color 0.2s;
        }
        .search-bar:focus { border-color: #c9a84c66; }
        .search-bar::placeholder { color: #3a4a5a; }
        .eng-card {
          background: #111827; border: 1px solid #1e2a3a; border-radius: 6px;
          padding: 24px 28px; margin-bottom: 12px; cursor: pointer;
          transition: all 0.2s; display: flex; align-items: center; justify-content: space-between;
        }
        .eng-card:hover { border-color: #c9a84c55; background: #141d2e; }
        .eng-card.selected { border-color: #c9a84c; background: #141d2e; }
        .eng-id { font-family: 'DM Mono', monospace; font-size: 11px; color: #c9a84c; letter-spacing: 0.1em; margin-bottom: 6px; }
        .eng-name { font-size: 20px; font-weight: 400; color: #e8e0d0; }
        .eng-meta { font-size: 12px; color: #5a6a7a; font-family: 'DM Mono', monospace; margin-top: 4px; }
        .eng-years { display: flex; gap: 6px; flex-wrap: wrap; }
        .yr-chip { 
          background: #1a2535; border: 1px solid #2a3545; border-radius: 3px;
          padding: 3px 10px; font-size: 11px; font-family: 'DM Mono', monospace; color: #8a9bb0;
        }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .panel { background: #111827; border: 1px solid #1e2a3a; border-radius: 6px; padding: 24px; }
        .panel-title { 
          font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #c9a84c;
          font-family: 'DM Mono', monospace; margin-bottom: 16px; padding-bottom: 12px;
          border-bottom: 1px solid #1e2a3a;
        }
        .toggle-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: #1a2535; border: 1px solid #2a3545; border-radius: 4px;
          padding: 8px 14px; margin: 4px; cursor: pointer; font-size: 14px;
          color: #8a9bb0; transition: all 0.15s; user-select: none;
        }
        .toggle-chip:hover { border-color: #c9a84c44; color: #c0b080; }
        .toggle-chip.on { background: #1e2d1e; border-color: #4a8a50; color: #7acc82; }
        .toggle-chip.yr { font-family: 'DM Mono', monospace; font-size: 13px; }
        .entity-chip {
          padding: 10px 16px; border-radius: 4px; font-size: 14px; cursor: pointer;
          border: 1px solid #2a3545; background: #1a2535; color: #8a9bb0;
          display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
          transition: all 0.15s; user-select: none;
        }
        .entity-chip:hover { border-color: #c9a84c44; }
        .entity-chip.on { background: #1e2d1e; border-color: #4a8a50; color: #aaeaaa; }
        .entity-type-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .entity-type-label { font-size: 10px; font-family: 'DM Mono', monospace; color: #4a5a6a; margin-left: auto; }
        .doc-category { margin-bottom: 20px; }
        .cat-header { 
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 0; cursor: pointer; border-bottom: 1px solid #1e2a3a; margin-bottom: 10px;
        }
        .cat-title { font-size: 13px; color: #c0a860; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px; }
        .cat-select-all { 
          font-size: 10px; font-family: 'DM Mono', monospace; color: #4a6a7a; 
          cursor: pointer; padding: 3px 8px; border: 1px solid #2a3545; border-radius: 3px;
          transition: all 0.15s;
        }
        .cat-select-all:hover { color: #c9a84c; border-color: #c9a84c44; }
        .doc-item {
          display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 4px;
          cursor: pointer; font-size: 14px; color: #7a8a9a; transition: all 0.15s;
          margin-bottom: 2px;
        }
        .doc-item:hover { background: #1a2535; color: #c0b8a8; }
        .doc-item.on { background: #1a2535; color: #c0dfc0; }
        .checkbox { 
          width: 14px; height: 14px; border: 1px solid #3a4a5a; border-radius: 2px;
          flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .checkbox.on { background: #4a8a50; border-color: #4a8a50; }
        .contact-card {
          padding: 14px 18px; border-radius: 5px; border: 1px solid #2a3545;
          background: #1a2535; cursor: pointer; margin-bottom: 8px;
          transition: all 0.15s; display: flex; align-items: center; gap: 14px;
        }
        .contact-card:hover { border-color: #c9a84c44; }
        .contact-card.on { border-color: #c9a84c; background: #1e2a1a; }
        .contact-avatar { 
          width: 36px; height: 36px; border-radius: 50%; background: #1e2d3e;
          display: flex; align-items: center; justify-content: center; font-size: 14px;
          color: #c9a84c; font-weight: 600; flex-shrink: 0; border: 1px solid #2a3a4a;
          font-family: 'Cormorant Garamond', serif;
        }
        .contact-name { font-size: 15px; color: #c8c0b0; }
        .contact-role { font-size: 11px; color: #5a6a7a; font-family: 'DM Mono', monospace; margin-top: 2px; }
        .contact-email { font-size: 11px; color: #c9a84c88; font-family: 'DM Mono', monospace; margin-top: 1px; }
        .btn {
          padding: 12px 28px; border-radius: 4px; font-size: 13px; letter-spacing: 0.1em;
          text-transform: uppercase; font-family: 'DM Mono', monospace; cursor: pointer;
          border: 1px solid; transition: all 0.2s;
        }
        .btn-gold {
          background: #c9a84c; border-color: #c9a84c; color: #0b0f1a;
        }
        .btn-gold:hover { background: #debb5e; border-color: #debb5e; }
        .btn-gold:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-outline { background: transparent; border-color: #2a3545; color: #7a8a9a; }
        .btn-outline:hover { border-color: #c9a84c44; color: #c0b080; }
        .btn-row { display: flex; gap: 12px; margin-top: 32px; align-items: center; }
        .textarea {
          width: 100%; background: #0e1520; border: 1px solid #1e2a3a; border-radius: 4px;
          padding: 12px 16px; color: #c8c0b0; font-family: 'Cormorant Garamond', serif;
          font-size: 15px; resize: vertical; min-height: 90px; outline: none;
          transition: border-color 0.2s;
        }
        .textarea:focus { border-color: #c9a84c44; }
        .textarea::placeholder { color: #2a3a4a; }
        .input-date {
          background: #0e1520; border: 1px solid #1e2a3a; border-radius: 4px;
          padding: 10px 14px; color: #c8c0b0; font-family: 'DM Mono', monospace;
          font-size: 13px; outline: none; transition: border-color 0.2s;
          color-scheme: dark;
        }
        .input-date:focus { border-color: #c9a84c44; }
        .review-block {
          background: #0e1520; border: 1px solid #1e2a3a; border-radius: 5px;
          padding: 20px 24px; margin-bottom: 16px;
        }
        .review-label { font-size: 10px; letter-spacing: 0.2em; font-family: 'DM Mono', monospace; color: #4a6a7a; text-transform: uppercase; margin-bottom: 8px; }
        .review-val { font-size: 16px; color: #c8c0b0; }
        .review-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
        .review-tag { 
          background: #1a2535; border: 1px solid #2a3545; border-radius: 3px;
          padding: 4px 10px; font-size: 12px; font-family: 'DM Mono', monospace; color: #8a9bb0;
        }
        .divider { border: none; border-top: 1px solid #1e2a3a; margin: 28px 0; }
        .spinner { 
          width: 20px; height: 20px; border: 2px solid #c9a84c33; border-top-color: #c9a84c;
          border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .done-banner { 
          text-align: center; padding: 48px 0 32px;
        }
        .done-icon { font-size: 48px; margin-bottom: 16px; }
        .done-title { font-size: 36px; font-weight: 300; color: #c9a84c; margin-bottom: 8px; }
        .done-sub { font-size: 13px; font-family: 'DM Mono', monospace; color: #5a7a5a; letter-spacing: 0.05em; }
        .email-preview {
          background: #0a0e18; border: 1px solid #c9a84c22; border-radius: 6px;
          padding: 28px 32px; margin-top: 28px; white-space: pre-wrap;
          font-family: 'Cormorant Garamond', serif; font-size: 15px; line-height: 1.75;
          color: #c8c0b0; max-height: 500px; overflow-y: auto;
        }
        .count-badge {
          background: #c9a84c; color: #0b0f1a; border-radius: 10px; font-size: 10px;
          padding: 1px 6px; font-family: 'DM Mono', monospace; font-weight: 600;
        }
      `}</style>

      <div className="portal">
        {/* Header */}
        <div className="header">
          <div>
            <div className="logo-text">Acquire Tax Credits</div>
            <div className="logo-sub">Document Request Portal</div>
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#3a4a5a", letterSpacing: "0.1em" }}>
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase()}
          </div>
        </div>

        {/* Step bar */}
        <div className="step-bar">
          {[
            [1, "Select Engagement"],
            [2, "Select Documents"],
            [3, "Review & Send"],
          ].map(([n, label]) => (
            <div key={n} className={`step-item ${step === n ? "active" : step > n ? "done" : ""}`}>
              <div className="step-num">{step > n ? "✓" : n}</div>
              {label}
            </div>
          ))}
        </div>

        <div className="main">

          {/* STEP 1 — SELECT ENGAGEMENT */}
          {step === 1 && (
            <div>
              <div className="section-title">Select an Engagement</div>
              <div className="section-sub">Choose the client engagement you are requesting documents for</div>
              <input
                className="search-bar"
                placeholder="Search by client name or engagement ID..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
              {filteredEngagements.map((eng) => (
                <div
                  key={eng.id}
                  className={`eng-card ${engagement?.id === eng.id ? "selected" : ""}`}
                  onClick={() => { setEngagement(eng); setSelectedYears([]); setSelectedEntities([]); setSelectedDocs([]); setSelectedContact(null); }}
                >
                  <div>
                    <div className="eng-id">{eng.id}</div>
                    <div className="eng-name">{eng.clientName}</div>
                    <div className="eng-meta">{eng.entityType} · EIN {eng.ein}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="eng-years">
                      {eng.years.map((y) => <div key={y} className="yr-chip">{y}</div>)}
                    </div>
                    <div style={{ fontSize: 11, color: "#3a4a5a", fontFamily: "'DM Mono', monospace", marginTop: 8 }}>
                      {eng.entities.length} entities · {eng.contacts.length} contacts
                    </div>
                  </div>
                </div>
              ))}
              <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                <button
                  className="btn btn-gold"
                  disabled={!engagement}
                  onClick={() => setStep(2)}
                >Continue →</button>
              </div>
            </div>
          )}

          {/* STEP 2 — SELECT DOCUMENTS */}
          {step === 2 && engagement && (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
                <div className="section-title">Configure Request</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#c9a84c", letterSpacing: "0.08em" }}>{engagement.id}</div>
              </div>
              <div className="section-sub">{engagement.clientName} — Select years, entities, and documents</div>

              <div className="grid-2" style={{ marginBottom: 24 }}>
                {/* Years */}
                <div className="panel">
                  <div className="panel-title">Tax Years</div>
                  <div>
                    {engagement.years.map((y) => (
                      <span
                        key={y}
                        className={`toggle-chip yr ${selectedYears.includes(y) ? "on" : ""}`}
                        onClick={() => toggleYear(y)}
                      >
                        <div className="checkbox on" style={{ display: selectedYears.includes(y) ? "flex" : "flex", background: selectedYears.includes(y) ? "#4a8a50" : "transparent" }}>
                          {selectedYears.includes(y) && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
                        </div>
                        {y}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Entities */}
                <div className="panel">
                  <div className="panel-title">Entities in Scope</div>
                  {engagement.entities.map((ent) => (
                    <div
                      key={ent.id}
                      className={`entity-chip ${selectedEntities.includes(ent.id) ? "on" : ""}`}
                      onClick={() => toggleEntity(ent.id)}
                    >
                      <div className="checkbox" style={{ background: selectedEntities.includes(ent.id) ? "#4a8a50" : "transparent", borderColor: selectedEntities.includes(ent.id) ? "#4a8a50" : "#3a4a5a" }}>
                        {selectedEntities.includes(ent.id) && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: selectedEntities.includes(ent.id) ? "#c0efc0" : "#8a9bb0" }}>{ent.name}</div>
                      </div>
                      <div className="entity-type-label">{ent.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents */}
              <div className="panel" style={{ marginBottom: 24 }}>
                <div className="panel-title" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Documents Requested</span>
                  {selectedDocs.length > 0 && <span className="count-badge">{selectedDocs.length} selected</span>}
                </div>
                {DOCUMENT_CATEGORIES.map((cat) => {
                  const allCatSelected = cat.docs.every((d) => selectedDocs.includes(d.id));
                  return (
                    <div key={cat.category} className="doc-category">
                      <div className="cat-header">
                        <div className="cat-title">
                          <span>{cat.icon}</span>
                          <span>{cat.category}</span>
                          {cat.docs.some((d) => selectedDocs.includes(d.id)) && (
                            <span className="count-badge">{cat.docs.filter((d) => selectedDocs.includes(d.id)).length}</span>
                          )}
                        </div>
                        <div
                          className="cat-select-all"
                          onClick={() => selectAllDocsInCategory(cat.docs)}
                        >
                          {allCatSelected ? "Deselect All" : "Select All"}
                        </div>
                      </div>
                      {cat.docs.map((doc) => (
                        <div
                          key={doc.id}
                          className={`doc-item ${selectedDocs.includes(doc.id) ? "on" : ""}`}
                          onClick={() => toggleDoc(doc.id)}
                        >
                          <div className={`checkbox ${selectedDocs.includes(doc.id) ? "on" : ""}`}>
                            {selectedDocs.includes(doc.id) && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
                          </div>
                          {doc.label}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Contact + Options */}
              <div className="grid-2">
                <div className="panel">
                  <div className="panel-title">Send Request To</div>
                  {engagement.contacts.map((c) => (
                    <div
                      key={c.id}
                      className={`contact-card ${selectedContact === c.id ? "on" : ""}`}
                      onClick={() => setSelectedContact(c.id)}
                    >
                      <div className="contact-avatar">
                        {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="contact-name">{c.name}</div>
                        <div className="contact-role">{c.role}</div>
                        <div className="contact-email">{c.email}</div>
                      </div>
                      {selectedContact === c.id && (
                        <div style={{ marginLeft: "auto", color: "#c9a84c", fontSize: 16 }}>✓</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="panel">
                  <div className="panel-title">Request Options</div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#5a7a7a", letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>Due Date</div>
                    <input
                      type="date"
                      className="input-date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#5a7a7a", letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>Additional Notes</div>
                    <textarea
                      className="textarea"
                      placeholder="Any special instructions or context for the client..."
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
                <button
                  className="btn btn-gold"
                  disabled={!canProceedStep3}
                  onClick={() => setStep(3)}
                >Review Request →</button>
                {!canProceedStep3 && (
                  <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#4a5a6a" }}>
                    {!selectedYears.length ? "Select at least one year" : !selectedEntities.length ? "Select at least one entity" : !selectedDocs.length ? "Select at least one document" : "Select a recipient"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 — REVIEW */}
          {step === 3 && engagement && (
            <div>
              <div className="section-title">Review & Send</div>
              <div className="section-sub">Confirm all selections before generating and sending the request email</div>

              <div className="grid-2">
                <div>
                  <div className="review-block">
                    <div className="review-label">Engagement</div>
                    <div className="review-val">{engagement.clientName}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#c9a84c88", marginTop: 4 }}>{engagement.id} · {engagement.entityType}</div>
                  </div>
                  <div className="review-block">
                    <div className="review-label">Tax Years</div>
                    <div className="review-list">
                      {selectedYears.sort().map((y) => <div key={y} className="review-tag">{y}</div>)}
                    </div>
                  </div>
                  <div className="review-block">
                    <div className="review-label">Entities ({selectedEntities.length})</div>
                    <div className="review-list">
                      {selectedEntityNames.map((n) => <div key={n} className="review-tag">{n}</div>)}
                    </div>
                  </div>
                  {dueDate && (
                    <div className="review-block">
                      <div className="review-label">Due Date</div>
                      <div className="review-val" style={{ fontFamily: "'DM Mono', monospace", fontSize: 14 }}>
                        {new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="review-block">
                    <div className="review-label">Sending To</div>
                    {contactObj && (
                      <div>
                        <div style={{ fontSize: 18, color: "#c8c0b0" }}>{contactObj.name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#5a7a7a", marginTop: 4 }}>{contactObj.role}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#c9a84c77", marginTop: 2 }}>{contactObj.email}</div>
                      </div>
                    )}
                  </div>
                  <div className="review-block">
                    <div className="review-label">Documents Requested ({selectedDocs.length})</div>
                    {DOCUMENT_CATEGORIES.map((cat) => {
                      const catSelected = cat.docs.filter((d) => selectedDocs.includes(d.id));
                      if (!catSelected.length) return null;
                      return (
                        <div key={cat.category} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: "#c0a860", fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>{cat.icon} {cat.category}</div>
                          <div className="review-list">
                            {catSelected.map((d) => <div key={d.id} className="review-tag">{d.short}</div>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {customNote && (
                    <div className="review-block">
                      <div className="review-label">Notes</div>
                      <div style={{ fontSize: 14, color: "#8a9aaa", lineHeight: 1.6 }}>{customNote}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-outline" onClick={() => setStep(2)}>← Edit</button>
                <button
                  className="btn btn-gold"
                  disabled={sending}
                  onClick={handleSend}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  {sending ? <><div className="spinner" /> Generating Email...</> : "✉ Send Document Request"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — DONE */}
          {step === 4 && (
            <div>
              <div className="done-banner">
                <div className="done-icon">✉</div>
                <div className="done-title">Request Sent</div>
                <div className="done-sub">
                  Email generated and dispatched to {contactObj?.email}
                </div>
              </div>
              {sentResult && (
                <div>
                  <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#4a6a7a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
                    Generated Email Preview
                  </div>
                  <div className="email-preview">{sentResult}</div>
                </div>
              )}
              <div className="btn-row" style={{ justifyContent: "center", marginTop: 32 }}>
                <button
                  className="btn btn-gold"
                  onClick={() => { setStep(1); setEngagement(null); setSelectedYears([]); setSelectedEntities([]); setSelectedDocs([]); setSelectedContact(null); setCustomNote(""); setDueDate(""); setSentResult(null); }}
                >
                  + New Request
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
