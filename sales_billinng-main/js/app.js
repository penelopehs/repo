// ─── App Controller ──────────────────────────────────────────────────────────

const App = {

  // ── State ──────────────────────────────────────────────────────────────────
  state: {
    clientName: '',
    taxYear: new Date().getFullYear(),
    taxFilingStatus: 'Single',
    numEntities: 1,
    entities: [],
    results: [],
    notes: '',
    generated: false,
  },

  // ── Formatters ─────────────────────────────────────────────────────────────
  fmt(n) {
    if (!n && n !== 0) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  },
  fmtPct(n) { return n != null ? (n * 100).toFixed(1) + '%' : '—'; },
  fmtHrs(n) { return n != null ? Math.round(n) + ' hrs' : '—'; },

  // ── Init ───────────────────────────────────────────────────────────────────
  init() {
    this.bindClientSetup();
    this.renderTaxYearOptions();
    this.renderFilingStatusOptions();
    this.bindActions();
    document.getElementById('generate-btn').addEventListener('click', () => this.generateEntities());
  },

  // ── Client Setup Bindings ──────────────────────────────────────────────────
  bindClientSetup() {
    const fields = ['clientName', 'taxYear', 'taxFilingStatus', 'numEntities'];
    fields.forEach(f => {
      const el = document.getElementById(f);
      if (!el) return;
      el.addEventListener('change', e => {
        this.state[f] = f === 'numEntities' ? parseInt(e.target.value) || 1 : e.target.value;
        if (f === 'clientName') {
          const display = document.getElementById('client-display');
          if (display) display.textContent = e.target.value || 'New Client';
        }
      });
      el.addEventListener('input', e => {
        this.state[f] = f === 'numEntities' ? parseInt(e.target.value) || 1 : e.target.value;
      });
    });
  },

  bindActions() {
    // No extra bindings needed here, covered in init
  },

  // ── Tax Year dropdown ──────────────────────────────────────────────────────
  renderTaxYearOptions() {
    const sel = document.getElementById('taxYear');
    if (!sel) return;
    const current = new Date().getFullYear();
    for (let y = current; y >= current - 6; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === current) opt.selected = true;
      sel.appendChild(opt);
    }
  },

  // ── Filing status options ──────────────────────────────────────────────────
  renderFilingStatusOptions() {
    const sel = document.getElementById('taxFilingStatus');
    if (!sel) return;
    Object.keys(SalesData.TAX_RATES).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = `${k} (${(SalesData.TAX_RATES[k] * 100).toFixed(0)}%)`;
      sel.appendChild(opt);
    });
  },

  // ── Generate Entity Cards ──────────────────────────────────────────────────
  generateEntities() {
    const n = parseInt(document.getElementById('numEntities').value) || 1;
    this.state.numEntities = n;

    // Preserve existing entity data, add new ones
    const prev = this.state.entities;
    this.state.entities = Array.from({ length: n }, (_, i) => prev[i] || {
      id: i + 1, name: '', state: '', employeeCount: 0, estimateQRAs: 0,
      grossCredit: 0, w2Wages: 0, contractResearch: 0, supplies: 0,
      otherExpenses: 0, managerReviewed: false, notes: '',
    });
    this.state.results = this.state.entities.map(e => Calc.calculateEntity(e));
    this.state.generated = true;

    this.renderEntities();
    this.renderSummary();
    document.getElementById('entities-section').classList.remove('hidden');
    document.getElementById('summary-section').classList.remove('hidden');
    document.getElementById('entities-section').scrollIntoView({ behavior: 'smooth' });
  },

  // ── Render All Entity Cards ────────────────────────────────────────────────
  renderEntities() {
    const container = document.getElementById('entities-container');
    container.innerHTML = '';
    this.state.entities.forEach((entity, i) => {
      container.appendChild(this.buildEntityCard(entity, i));
    });
  },

  // ── Build a Single Entity Card ─────────────────────────────────────────────
  buildEntityCard(entity, idx) {
    const card = document.createElement('div');
    card.className = 'entity-card bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6';
    card.id = `entity-card-${idx}`;

    card.innerHTML = `
      <!-- Card Header -->
      <div class="card-header flex items-center justify-between px-6 py-4 bg-navy border-b border-slate-200">
        <div class="flex items-center gap-3">
          <span class="entity-number flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white font-bold text-sm">${idx + 1}</span>
          <div>
            <p class="text-xs text-blue-200 font-medium uppercase tracking-widest">Entity ${idx + 1}</p>
            <p class="entity-name-display text-white font-semibold text-base">${entity.name || 'Unnamed Entity'}</p>
          </div>
        </div>
        <div id="tier-badge-${idx}" class="tier-badge hidden px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"></div>
      </div>

      <!-- Input Grid -->
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

          <!-- Left Column -->
          <div class="space-y-4">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Entity Info</h3>

            <div class="field-group">
              <label class="field-label">Company / Entity Name</label>
              <input type="text" class="field-input" placeholder="e.g. Smith Tech LLC"
                data-field="name" data-idx="${idx}" value="${entity.name || ''}" />
            </div>

            <div class="field-group">
              <label class="field-label">State of Entity</label>
              <select class="field-input" data-field="state" data-idx="${idx}">
                <option value="">— Select State —</option>
                ${SalesData.ALL_STATES.map(s => `<option value="${s}" ${entity.state === s ? 'selected' : ''}>${s}${SalesData.STATE_CREDIT_ELIGIBLE[s] ? ' ★' : ''}</option>`).join('')}
              </select>
              <p class="text-xs text-slate-400 mt-1">★ State credit eligible</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="field-group">
                <label class="field-label">Employee Count</label>
                <input type="number" class="field-input" placeholder="0" min="0"
                  data-field="employeeCount" data-idx="${idx}" value="${entity.employeeCount || ''}" />
              </div>
              <div class="field-group">
                <label class="field-label">Estimated QRAs</label>
                <input type="number" class="field-input" placeholder="0" min="0"
                  data-field="estimateQRAs" data-idx="${idx}" value="${entity.estimateQRAs || ''}" />
              </div>
            </div>
          </div>

          <!-- Right Column -->
          <div class="space-y-4">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Financial Inputs</h3>

            <div class="field-group">
              <label class="field-label">Gross Credit Amount <span class="text-blue-500">*</span></label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input type="number" class="field-input pl-7" placeholder="0" min="0"
                  data-field="grossCredit" data-idx="${idx}" value="${entity.grossCredit || ''}" />
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">W2 Wages (Qualified Research)</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input type="number" class="field-input pl-7" placeholder="0" min="0"
                  data-field="w2Wages" data-idx="${idx}" value="${entity.w2Wages || ''}" />
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Contract Research Payments</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input type="number" class="field-input pl-7" placeholder="0" min="0"
                  data-field="contractResearch" data-idx="${idx}" value="${entity.contractResearch || ''}" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="field-group">
                <label class="field-label">Supplies</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                  <input type="number" class="field-input pl-7" placeholder="0" min="0"
                    data-field="supplies" data-idx="${idx}" value="${entity.supplies || ''}" />
                </div>
              </div>
              <div class="field-group">
                <label class="field-label">Other Qualified Exp.</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                  <input type="number" class="field-input pl-7" placeholder="0" min="0"
                    data-field="otherExpenses" data-idx="${idx}" value="${entity.otherExpenses || ''}" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Results Panel -->
        <div id="results-${idx}" class="results-panel mt-6"></div>

        <!-- Entity Notes -->
        <div class="mt-4">
          <label class="field-label">Notes for this Entity</label>
          <textarea class="field-input resize-none" rows="2" placeholder="Optional notes..."
            data-field="notes" data-idx="${idx}">${entity.notes || ''}</textarea>
        </div>
      </div>
    `;

    // Bind all inputs in this card
    card.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', e => this.onEntityInput(e));
      el.addEventListener('change', e => this.onEntityInput(e));
    });

    // Render results if entity has data
    if (entity.grossCredit > 0) this.renderEntityResults(idx);

    return card;
  },

  // ── Entity Input Handler ───────────────────────────────────────────────────
  onEntityInput(e) {
    const { field, idx } = e.target.dataset;
    const i = parseInt(idx);
    const numFields = ['employeeCount','estimateQRAs','grossCredit','w2Wages',
                       'contractResearch','supplies','otherExpenses'];
    this.state.entities[i][field] = numFields.includes(field)
      ? parseFloat(e.target.value) || 0
      : e.target.value;

    // Update name display in header
    if (field === 'name') {
      const nameDisplay = document.querySelector(`#entity-card-${i} .entity-name-display`);
      if (nameDisplay) nameDisplay.textContent = e.target.value || 'Unnamed Entity';
    }

    // Recalculate
    this.state.results[i] = Calc.calculateEntity(this.state.entities[i]);
    this.renderEntityResults(i);
    this.renderSummary();
  },

  // ── Render Calculation Results for One Entity ──────────────────────────────
  renderEntityResults(idx) {
    const panel = document.getElementById(`results-${idx}`);
    if (!panel) return;
    const r = this.state.results[idx];
    const e = this.state.entities[idx];
    if (!r) return;

    // Update tier badge
    const badge = document.getElementById(`tier-badge-${idx}`);
    if (badge) {
      const colors = SalesData.TIER_COLORS[r.tier] || SalesData.TIER_COLORS['Out of Range'];
      badge.style.background = colors.bg;
      badge.style.color = colors.text;
      badge.style.border = `1px solid ${colors.border}`;
      badge.textContent = r.tier;
      badge.classList.remove('hidden');
    }

    if (r.error) {
      panel.innerHTML = `
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <span class="text-lg">⚠️</span> ${r.error}
        </div>`;
      return;
    }

    const reviewStatus = e.managerReviewed
      ? `<span class="status-ok">✓ Reviewed by Manager</span>`
      : r.needsReview
        ? `<span class="status-warn">⚠ Needs Manager Review (variance ${this.fmtPct(r.variancePct)})</span>`
        : `<span class="status-ok">✓ OK (variance ${this.fmtPct(r.variancePct)})</span>`;

    panel.innerHTML = `
      <div class="results-grid">

        <!-- SOW Methods -->
        <div class="result-block">
          <h4 class="result-block-title">SOW Estimate Methods</h4>
          <div class="sow-methods">
            <div class="sow-row">
              <span class="sow-label">2% Method</span>
              <span class="sow-value">${this.fmt(r.sow2)}</span>
            </div>
            <div class="sow-row">
              <span class="sow-label">3% Method</span>
              <span class="sow-value">${this.fmt(r.sow3)}</span>
            </div>
            <div class="sow-row">
              <span class="sow-label">50% Test</span>
              <span class="sow-value">${this.fmt(r.sow50)}</span>
            </div>
            <div class="sow-row sow-total">
              <span class="sow-label font-bold">SOW Estimate (avg)</span>
              <span class="sow-value font-bold text-navy">${this.fmt(r.sowEstimate)}</span>
            </div>
          </div>
        </div>

        <!-- Federal Bill -->
        <div class="result-block">
          <h4 class="result-block-title">Federal Final Bill</h4>
          <div class="bill-amount">${this.fmt(r.federalBill)}</div>
          <div class="bill-meta">
            <div>Tier: <strong>${r.tier}</strong></div>
            <div>Target Utilization: <strong>${this.fmtPct(r.targetPct)}</strong></div>
            <div>Tax Rate (${e.taxFilingStatus || this.state.taxFilingStatus}): <strong>${this.fmtPct(r.taxRate)}</strong></div>
            <div>After-tax Adj: <strong>${this.fmt(r.federalAdjustment)}</strong></div>
            <div>Fee as % of Credit: <strong>${this.fmtPct(r.federalPctOfCredit)}</strong></div>
          </div>
          ${r.microCredit ? `<div class="mt-2 text-xs text-blue-600 font-medium">Micro Credit Value: ${this.fmt(r.microCredit)}</div>` : ''}
        </div>

        <!-- State Bill -->
        <div class="result-block">
          <h4 class="result-block-title">State Final Bill</h4>
          ${r.hasStateCalc ? `
            <div class="bill-amount text-emerald-600">${this.fmt(r.stateBill)}</div>
            <div class="bill-meta">
              <div>Utilization Cap: <strong>${this.fmtPct(r.utilizCap)}</strong></div>
              <div>Credit Utilization: <strong>${this.fmt(r.creditUtilization)}</strong></div>
              <div>State Tax Rate: <strong>${this.fmtPct(r.stateData.taxRate)}</strong></div>
              <div>After-cap Adj: <strong>${this.fmt(r.stateAdjustment)}</strong></div>
            </div>
          ` : `
            <div class="text-sm text-slate-500 pt-2">
              ${SalesData.STATE_CREDIT_ELIGIBLE[e.state]
                ? '★ State credit eligible — rate data pending. Contact processing team.'
                : e.state
                  ? 'No state credit applicable for ' + e.state + '.'
                  : 'Select a state to calculate state credit.'}
            </div>
          `}
        </div>

        <!-- Phase Breakdown -->
        <div class="result-block">
          <h4 class="result-block-title">Phase Breakdown</h4>
          <div class="phase-bars">
            ${this.renderPhaseBar('Phase I',   r.phaseI,   r.totalBill, SalesData.PHASE_PCT[r.tier].I)}
            ${this.renderPhaseBar('Phase II',  r.phaseII,  r.totalBill, SalesData.PHASE_PCT[r.tier].II)}
            ${this.renderPhaseBar('Phase III', r.phaseIII, r.totalBill, SalesData.PHASE_PCT[r.tier].III)}
            ${this.renderPhaseBar('Phase IV',  r.phaseIV,  r.totalBill, SalesData.PHASE_PCT[r.tier].IV)}
          </div>
          <div class="mt-3 pt-2 border-t border-slate-100 flex justify-between text-sm font-semibold text-slate-700">
            <span>Total Bill</span><span>${this.fmt(r.totalBill)}</span>
          </div>
        </div>

        <!-- Hours Distribution -->
        <div class="result-block">
          <h4 class="result-block-title">Billable Hours Distribution</h4>
          <div class="hours-grid">
            <div class="hours-item">
              <div class="hours-value">${this.fmtHrs(r.entityHours)}</div>
              <div class="hours-label">Entities (45%)</div>
            </div>
            <div class="hours-item">
              <div class="hours-value">${this.fmtHrs(r.staffHours)}</div>
              <div class="hours-label">Staff (30%)</div>
            </div>
            <div class="hours-item">
              <div class="hours-value">${this.fmtHrs(r.qraHours)}</div>
              <div class="hours-label">QRA (25%)</div>
            </div>
            <div class="hours-item border-t border-slate-100 pt-2 col-span-3">
              <div class="hours-value text-navy">${this.fmtHrs(r.billableHours)}</div>
              <div class="hours-label">Total Billable</div>
            </div>
          </div>
          <div class="mt-2 text-xs text-slate-400">
            Effective rate: ${this.fmt(r.effectiveRate)}/hr
          </div>
        </div>

        <!-- Grand Total + Review -->
        <div class="result-block grand-total-block">
          <h4 class="result-block-title">Grand Total</h4>
          <div class="grand-amount">${this.fmt(r.grandTotal)}</div>
          <div class="text-xs text-slate-500 mb-3">Federal + State</div>
          <div class="review-status">${reviewStatus}</div>
          <label class="review-toggle mt-3">
            <input type="checkbox" ${e.managerReviewed ? 'checked' : ''}
              onchange="App.toggleReview(${idx}, this.checked)" />
            <span>Mark as Manager Reviewed</span>
          </label>
        </div>

      </div>
    `;
  },

  // ── Phase Progress Bar Helper ──────────────────────────────────────────────
  renderPhaseBar(label, amount, total, pct) {
    const barWidth = total > 0 ? Math.max(2, (amount / total) * 100) : 0;
    return `
      <div class="phase-row">
        <div class="phase-row-header">
          <span class="phase-label">${label}</span>
          <span class="phase-pct">${this.fmtPct(pct)}</span>
          <span class="phase-amount">${this.fmt(amount)}</span>
        </div>
        <div class="phase-bar-bg">
          <div class="phase-bar-fill" style="width:${barWidth}%"></div>
        </div>
      </div>`;
  },

  // ── Toggle Manager Review ──────────────────────────────────────────────────
  toggleReview(idx, checked) {
    this.state.entities[idx].managerReviewed = checked;
    this.state.results[idx] = Calc.calculateEntity(this.state.entities[idx]);
    this.renderEntityResults(idx);
    this.renderSummary();
  },

  // ── Render Summary Section ─────────────────────────────────────────────────
  renderSummary() {
    const section = document.getElementById('summary-section');
    if (!section) return;

    const entities = this.state.entities;
    const results  = this.state.results;
    const totals   = Calc.summarize(results);
    const validCount = results.filter(r => !r.error).length;

    // Entity name cards at top
    const nameCards = entities.map((e, i) => {
      const r = results[i];
      if (!r || r.error) return `
        <div class="entity-name-card entity-name-card--error">
          <span class="enc-num">${i + 1}</span>
          <span class="enc-name">${e.name || 'Unnamed Entity'}</span>
          <span class="enc-tier text-red-500">Out of Range</span>
        </div>`;
      return `
        <div class="entity-name-card">
          <span class="enc-num">${i + 1}</span>
          <span class="enc-name">${e.name || 'Unnamed Entity'}</span>
          <span class="enc-tier" style="color:${SalesData.TIER_COLORS[r.tier]?.text || '#64748b'}">${r.tier}</span>
        </div>`;
    }).join('');

    // Detail table rows
    const tableRows = entities.map((e, i) => {
      const r = results[i];
      if (!r || r.error) return `
        <tr class="table-row-error">
          <td class="td-num">${i + 1}</td>
          <td class="td-name">${e.name || '—'}</td>
          <td class="td-state">${e.state || '—'}</td>
          <td colspan="5" class="text-center text-red-500 text-sm py-3">${r?.error || 'Incomplete'}</td>
        </tr>`;
      return `
        <tr class="table-row">
          <td class="td-num">${i + 1}</td>
          <td class="td-name">${e.name || '—'}</td>
          <td class="td-state">${e.state || '—'}</td>
          <td class="td-tier">
            <span class="tier-chip" style="background:${SalesData.TIER_COLORS[r.tier]?.bg};color:${SalesData.TIER_COLORS[r.tier]?.text}">${r.tier}</span>
          </td>
          <td class="td-money">${this.fmt(r.sowEstimate)}</td>
          <td class="td-money">${this.fmt(r.federalBill)}</td>
          <td class="td-money">${r.hasStateCalc ? this.fmt(r.stateBill) : '—'}</td>
          <td class="td-money font-semibold">${this.fmt(r.grandTotal)}</td>
        </tr>`;
    }).join('');

    section.innerHTML = `
      <div class="summary-wrapper">

        <!-- Header -->
        <div class="summary-header">
          <div>
            <h2 class="summary-title">Billing Overview Summary</h2>
            <p class="summary-subtitle">
              ${this.state.clientName || 'Client'} &nbsp;·&nbsp; Tax Year ${this.state.taxYear} &nbsp;·&nbsp;
              ${entities.length} ${entities.length === 1 ? 'Entity' : 'Entities'}
            </p>
          </div>
          <div class="summary-totals-row">
            <div class="summary-kpi">
              <div class="kpi-value">${entities.length}</div>
              <div class="kpi-label">Total Entities</div>
            </div>
            <div class="summary-kpi">
              <div class="kpi-value">${this.fmt(totals.totalSOW)}</div>
              <div class="kpi-label">Total SOW</div>
            </div>
            <div class="summary-kpi">
              <div class="kpi-value">${this.fmt(totals.totalFederal)}</div>
              <div class="kpi-label">Federal Total</div>
            </div>
            <div class="summary-kpi highlight">
              <div class="kpi-value">${this.fmt(totals.totalBill)}</div>
              <div class="kpi-label">Grand Total</div>
            </div>
          </div>
        </div>

        <!-- Entity Name Cards -->
        <div class="enc-section">
          <h3 class="enc-section-title">Entities (${entities.length})</h3>
          <div class="enc-grid">${nameCards}</div>
        </div>

        <!-- Detail Table -->
        <div class="overflow-x-auto mt-6">
          <table class="summary-table">
            <thead>
              <tr>
                <th class="th-num">#</th>
                <th class="th-name">Entity / Company</th>
                <th class="th-state">State</th>
                <th class="th-tier">Tier</th>
                <th class="th-money">SOW Estimate</th>
                <th class="th-money">Federal Bill</th>
                <th class="th-money">State Bill</th>
                <th class="th-money">Total</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr class="table-footer">
                <td colspan="4" class="tf-label">TOTALS</td>
                <td class="td-money font-bold">${this.fmt(totals.totalSOW)}</td>
                <td class="td-money font-bold">${this.fmt(totals.totalFederal)}</td>
                <td class="td-money font-bold">${this.fmt(totals.totalState)}</td>
                <td class="td-money font-bold text-navy">${this.fmt(totals.totalBill)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Notes -->
        <div class="notes-section">
          <label class="field-label">Processing Team Notes</label>
          <textarea id="notes-input" class="field-input resize-none" rows="3"
            placeholder="Enter any important client details for the processing or R&D team..."
          >${this.state.notes}</textarea>
        </div>

        <!-- Actions -->
        <div class="actions-row">
          <button id="pdf-btn" class="btn-primary" onclick="App.printPDF()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
            </svg>
            Download PDF
          </button>
          <button class="btn-secondary" onclick="App.copyForSharePoint()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
            </svg>
            Prepare for SharePoint
          </button>
        </div>

      </div>
    `;

    // Re-bind notes input
    const notesEl = document.getElementById('notes-input');
    if (notesEl) notesEl.addEventListener('input', e => { this.state.notes = e.target.value; });
  },

  // ── PDF / Print ────────────────────────────────────────────────────────────
  printPDF() {
    window.print();
  },

  // ── SharePoint prep ────────────────────────────────────────────────────────
  copyForSharePoint() {
    const msg = document.getElementById('sp-message');
    if (msg) {
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 4000);
    }
    // In a real SharePoint deployment this would use the SP REST API.
    // For now, trigger print/save flow.
    window.print();
  },
};

// Boot
window.addEventListener('DOMContentLoaded', () => App.init());