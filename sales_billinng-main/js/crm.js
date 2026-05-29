// ─── CRM / Client Pipeline Module ────────────────────────────────────────────

const CRM = {

  // ── State ──────────────────────────────────────────────────────────────────
  state: {
    clients: [],
    calculations: [],
    activeClientForCalc: null,
    editingClientId: null,
    overviewClientId: null,
    statusFilter: null,
    contactProfileKey: null,
    contactQuery: '',
  },

  STATUSES:    ['Lead', 'Calculation Sent', 'SOW Signed', 'Active Engagement'],
  SALESPEOPLE: ['Maria Lopez', 'David Kim', 'Sarah Johnson', 'James Carter', 'Unassigned'],

  STATUS_COLORS: {
    'Lead':               { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    'Calculation Sent':   { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
    'SOW Signed':         { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    'Active Engagement':  { bg: '#ecfdf5', text: '#065f46', border: '#6ee7b7' },
  },

  SOURCES: ['Referral', 'Website', 'Cold Call', 'Conference', 'LinkedIn', 'Partner', 'Other'],

  // ── Persistence ────────────────────────────────────────────────────────────
  load() {
    try {
      this.state.clients      = JSON.parse(localStorage.getItem('crm_clients')      || '[]');
      this.state.calculations = JSON.parse(localStorage.getItem('crm_calculations') || '[]');
    } catch (_) {
      this.state.clients = [];
      this.state.calculations = [];
    }
  },

  persist() {
    localStorage.setItem('crm_clients',      JSON.stringify(this.state.clients));
    localStorage.setItem('crm_calculations', JSON.stringify(this.state.calculations));
  },

  // ── Init ───────────────────────────────────────────────────────────────────
  init() {
    this.load();
    this._seedMockData();
    this.createModal();
    this.createToast();
    this.render();
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('crm-modal');
        if (modal && !modal.classList.contains('hidden')) { this.closeModal(); return; }
        if (this.state.contactProfileKey) { this.closeContactProfile(); return; }
        if (this.state.overviewClientId) { this.closeOverview(); }
      }
    });
  },

  // ── Mock Data Seeder ───────────────────────────────────────────────────────
  _seedMockData() {
    const MOCK_VERSION = 'v4';
    const hasMock = this.state.clients.some(c => c.id && c.id.startsWith('mock_'));
    const currentVersion = localStorage.getItem('crm_mock_version');
    if (this.state.clients.length > 0 && (!hasMock || currentVersion === MOCK_VERSION)) return;
    if (hasMock && currentVersion !== MOCK_VERSION) { this.state.clients = []; this.state.calculations = []; }
    this.state.clients = [
      {
        id: 'mock_1',
        name: 'Robert Chen',
        company: 'Apex Manufacturing Group',
        email: 'rchen@apexmfg.com',
        phone: '(801) 555-0192',
        source: 'Referral',
        status: 'Active Engagement',
        salesperson: 'Maria Lopez',
        notes: 'Referred by John Davis at Summit Capital. Multi-entity, high-value client. Very engaged and responsive.',
        createdAt: '2026-01-15T09:00:00.000Z',
        sowSignedAt: '2026-02-01T00:00:00.000Z',
        engagementStartedAt: '2026-02-15T00:00:00.000Z',
        calculationIds: [],
        contacts: [
          { id: 'c1_1', name: 'Robert Chen',  role: 'Point of Contact', title: 'CFO',        email: 'rchen@apexmfg.com',    phone: '(801) 555-0192', isPrimary: true },
          { id: 'c1_2', name: 'Sandra Wu',    role: 'CPA',              title: 'Controller',  email: 'swu@wuassociates.com', phone: '(801) 555-0193', firm: 'Wu & Associates CPA' },
        ],
        subEntities: [
          { id: 'e1_1', name: 'Apex Manufacturing LLC', ein: '82-1234567', state: 'Utah',  entityType: 'LLC',    contactIds: ['c1_1', 'c1_2'] },
          { id: 'e1_2', name: 'Apex Holdings Corp',     ein: '82-7654321', state: 'Utah',  entityType: 'C-Corp', contactIds: ['c1_1'] },
        ],
        engagements: [
          {
            id: 'eng1_1', type: 'R&D Tax Credit', status: 'Active',
            startDate: '2026-02-15', phase: 'Phase II — Study & Documentation',
            yearlyBilling: [
              { year: 2022, billingAmount: 38500 },
              { year: 2023, billingAmount: 47000 },
              { year: 2024, billingAmount: 55000 },
              { year: 2025, billingAmount: 67000 },
            ],
          },
        ],
        followUpCalls: [
          { id: 'fc1_1', date: '2026-05-10', time: '2:00 PM',  notes: 'Review Phase II deliverables and document checklist status.', completed: false },
          { id: 'fc1_2', date: '2026-04-15', time: '10:00 AM', notes: 'Initial document collection check-in and kickoff alignment.', completed: true },
        ],
        questions: [
          { q: 'Do you have multi-state operations?',          a: 'Yes — Utah and Nevada' },
          { q: 'Have you claimed R&D credits before?',         a: 'No, this is our first time' },
          { q: 'Are you using government grants or funding?',  a: 'No' },
          { q: 'Do you have qualified research expenses?',     a: 'Yes — primarily in product development and engineering' },
        ],
      },
      {
        id: 'mock_2',
        name: 'Jennifer Park',
        company: 'Sunrise Biotech',
        email: 'jpark@sunrisebiotech.com',
        phone: '(415) 555-0234',
        source: 'LinkedIn',
        status: 'Calculation Sent',
        salesperson: 'David Kim',
        notes: 'Startup with significant R&D spend. Targeting federal + CA state credit. Previously claimed credits 2021–2022.',
        createdAt: '2026-02-20T14:00:00.000Z',
        sowSignedAt: null,
        engagementStartedAt: null,
        calculationIds: [],
        contacts: [
          { id: 'c2_1', name: 'Jennifer Park', role: 'Point of Contact', title: 'CEO',        email: 'jpark@sunrisebiotech.com', phone: '(415) 555-0234', isPrimary: true },
          { id: 'c2_2', name: 'Tom Alvarez',   role: 'CPA',              title: 'Partner',     email: 'talvarez@alvarezcpa.com', phone: '(415) 555-0289', firm: 'Alvarez & Partners CPA Group' },
          { id: 'c2_3', name: 'Mei Lin',       role: 'Controller',       title: 'VP Finance',  email: 'mlin@sunrisebiotech.com', phone: '(415) 555-0256' },
        ],
        subEntities: [
          { id: 'e2_1', name: 'Sunrise Biotech Inc',        ein: '94-5678901', state: 'California', entityType: 'C-Corp', contactIds: ['c2_1', 'c2_2', 'c2_3'] },
          { id: 'e2_2', name: 'Park Research LLC',          ein: '94-1234567', state: 'New Jersey',  entityType: 'LLC',    contactIds: ['c2_1', 'c2_2'] },
          { id: 'e2_3', name: 'Sunrise IP Holdings LLC',    ein: '94-9876543', state: 'Delaware',    entityType: 'LLC',    contactIds: ['c2_1'] },
        ],
        engagements: [],
        followUpCalls: [
          { id: 'fc2_1', date: '2026-05-20', time: '11:00 AM', notes: 'SOW review and signature — bring final calculation summary.', completed: false },
        ],
        questions: [
          { q: 'Do you have multi-state operations?',         a: 'Headquartered in California, lab in New Jersey' },
          { q: 'Have you claimed R&D credits before?',        a: 'Yes — 2021 and 2022 tax years' },
          { q: 'Are you using government grants or funding?', a: 'Yes — SBIR Phase I grant ($250k)' },
          { q: 'Do you have qualified research expenses?',    a: 'Yes — wages, supplies, and contractor costs' },
        ],
      },
      {
        id: 'mock_3',
        name: 'Marcus Williams',
        company: 'Tri-State Construction',
        email: 'mwilliams@tristatecon.com',
        phone: '(973) 555-0312',
        source: 'Referral',
        status: 'Lead',
        salesperson: 'Sarah Johnson',
        notes: 'Introduced by accountant David Reyes. Exploring eligibility. Needs initial consultation to assess QREs.',
        createdAt: '2026-04-01T11:00:00.000Z',
        sowSignedAt: null,
        engagementStartedAt: null,
        calculationIds: [],
        contacts: [
          { id: 'c3_1', name: 'Marcus Williams', role: 'Point of Contact', title: 'Owner',      email: 'mwilliams@tristatecon.com', phone: '(973) 555-0312', isPrimary: true },
          { id: 'c3_2', name: 'David Reyes',     role: 'CPA',              title: 'Principal',  email: 'dreyes@reyestax.com',        phone: '(973) 555-0389', firm: 'Reyes Tax Advisory' },
          { id: 'c3_3', name: 'Sandra Wu',        role: 'CPA',              title: 'Controller', email: 'swu@wuassociates.com',       phone: '(801) 555-0193', firm: 'Wu & Associates CPA' },
        ],
        subEntities: [
          { id: 'e3_1', name: 'Tri-State Construction LLC', ein: '22-3456789', state: 'New Jersey', entityType: 'LLC', contactIds: ['c3_1', 'c3_2', 'c3_3'] },
        ],
        engagements: [],
        followUpCalls: [
          { id: 'fc3_1', date: '2026-05-08', time: '3:00 PM', notes: 'Eligibility assessment call — review activity list and QRE estimate.', completed: false },
        ],
        questions: [
          { q: 'Do you have multi-state operations?',         a: 'NY, NJ, and CT' },
          { q: 'Have you claimed R&D credits before?',        a: 'Not sure — accountant mentioned it as a possibility' },
          { q: 'Are you using government grants or funding?', a: 'No' },
        ],
      },
      {
        id: 'mock_4',
        name: 'Elena Vasquez',
        company: 'Pacific Coast Innovations',
        email: 'evasquez@pcilab.com',
        phone: '(310) 555-0441',
        source: 'Conference',
        status: 'SOW Signed',
        salesperson: 'James Carter',
        notes: 'Met at SXSW. Strong R&D pipeline in AI/ML. Previously claimed credits 2020–2022. Eager to proceed.',
        createdAt: '2026-03-10T09:00:00.000Z',
        sowSignedAt: '2026-04-28T00:00:00.000Z',
        engagementStartedAt: null,
        calculationIds: [],
        contacts: [
          { id: 'c4_1', name: 'Elena Vasquez', role: 'Point of Contact', title: 'CEO',                    email: 'evasquez@pcilab.com', phone: '(310) 555-0441', isPrimary: true },
          { id: 'c4_2', name: 'Chris Bolton',  role: 'CFO',              title: 'Chief Financial Officer', email: 'cbolton@pcilab.com',  phone: '(310) 555-0442' },
          { id: 'c4_3', name: 'Nancy Park',    role: 'CPA',              title: 'Partner',                 email: 'npark@parkassoc.com', phone: '(310) 555-0511', firm: 'Park & Associates CPA' },
        ],
        subEntities: [
          { id: 'e4_1', name: 'Pacific Coast Innovations Inc', ein: '95-2345678', state: 'California', entityType: 'C-Corp', contactIds: ['c4_1', 'c4_2', 'c4_3'] },
          { id: 'e4_2', name: 'PCI Labs LLC',                  ein: '95-8765432', state: 'California', entityType: 'LLC',    contactIds: ['c4_1', 'c4_2'] },
        ],
        engagements: [],
        followUpCalls: [
          { id: 'fc4_1', date: '2026-05-12', time: '1:30 PM',  notes: 'Kickoff planning session — assign team and set document collection timeline.', completed: false },
          { id: 'fc4_2', date: '2026-05-01', time: '10:00 AM', notes: 'SOW review and execution — finalized and signed by both parties.', completed: true },
        ],
        questions: [
          { q: 'Do you have multi-state operations?',         a: 'California only' },
          { q: 'Have you claimed R&D credits before?',        a: 'Yes — 2020, 2021, and 2022' },
          { q: 'Are you using government grants or funding?', a: 'No' },
          { q: 'Do you have qualified research expenses?',    a: 'Yes — primarily wages and contractor costs for AI/ML development' },
        ],
      },
    ];
    this.persist();
    localStorage.setItem('crm_mock_version', MOCK_VERSION);
  },

  // ── Unique ID ──────────────────────────────────────────────────────────────
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // ── CRUD: Clients ──────────────────────────────────────────────────────────
  addClient(data) {
    const client = {
      id: this.uid(),
      name: data.name,
      company: data.company || '',
      email: data.email || '',
      phone: data.phone || '',
      source: data.source || 'Other',
      notes: data.notes || '',
      status: 'Lead',
      salesperson: data.salesperson || 'Unassigned',
      createdAt: new Date().toISOString(),
      sowSignedAt: null,
      engagementStartedAt: null,
      calculationIds: [],
      contacts: [],
      subEntities: [],
      engagements: [],
      followUpCalls: [],
      questions: [],
    };
    this.state.clients.unshift(client);
    this.persist();
    this.render();
    return client;
  },

  updateClient(id, updates) {
    const i = this.state.clients.findIndex(c => c.id === id);
    if (i === -1) return;
    this.state.clients[i] = { ...this.state.clients[i], ...updates };
    this.persist();
    this.render();
  },

  deleteClient(id) {
    this.state.clients      = this.state.clients.filter(c => c.id !== id);
    this.state.calculations = this.state.calculations.filter(c => c.clientId !== id);
    this.persist();
    this.render();
  },

  getClient(id) {
    return this.state.clients.find(c => c.id === id);
  },

  // ── CRUD: Calculations ─────────────────────────────────────────────────────
  saveCalculation(clientId, calcData) {
    const calc = { id: this.uid(), clientId, createdAt: new Date().toISOString(), ...calcData };
    this.state.calculations.push(calc);
    const client = this.getClient(clientId);
    if (client) {
      if (!client.calculationIds) client.calculationIds = [];
      client.calculationIds.push(calc.id);
      if (client.status === 'Lead') client.status = 'Calculation Sent';
    }
    this.persist();
    this.render();
    return calc;
  },

  getLatestCalc(clientId) {
    const calcs = this.state.calculations.filter(c => c.clientId === clientId);
    return calcs.length ? calcs[calcs.length - 1] : null;
  },

  calcTotal(calc) {
    if (!calc || !calc.results) return null;
    const t = calc.results.reduce((s, r) => s + (r.grandTotal || 0), 0);
    return t > 0 ? t : null;
  },

  // ── Status Transitions ─────────────────────────────────────────────────────
  markSOWSigned(clientId) {
    this.updateClient(clientId, { status: 'SOW Signed', sowSignedAt: new Date().toISOString() });
    this.showToast('SOW marked as signed.');
  },

  startEngagement(clientId) {
    const client = this.getClient(clientId);
    if (!client) return;
    if (!confirm(`Start engagement for "${client.name}"?\nThis moves them to Active Engagements.`)) return;
    this.updateClient(clientId, { status: 'Active Engagement', engagementStartedAt: new Date().toISOString() });
    this.showToast('Engagement started.');
  },

  // ── Calculator Integration ─────────────────────────────────────────────────
  startCalcForClient(clientId) {
    const client = this.getClient(clientId);
    if (!client) return;
    this.state.activeClientForCalc = clientId;
    switchTab('calculator');
    const nameEl = document.getElementById('clientName');
    if (nameEl) {
      nameEl.value = client.name;
      nameEl.dispatchEvent(new Event('input'));
      const display = document.getElementById('client-display');
      if (display) display.textContent = client.name;
    }
    this.renderCalcBanner(client);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderCalcBanner(client) {
    let banner = document.getElementById('crm-calc-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'crm-calc-banner';
      const calcPanel = document.getElementById('tab-calculator');
      if (calcPanel) calcPanel.prepend(banner);
    }
    banner.className = 'crm-calc-banner print:hidden';
    banner.innerHTML = `
      <div class="crm-banner-inner">
        <div class="crm-banner-left">
          <div class="crm-banner-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div>
            <p class="crm-banner-title">Calculation for <strong>${this._esc(client.name)}</strong>${client.company ? ` &middot; ${this._esc(client.company)}` : ''}</p>
            <p class="crm-banner-sub">Fill in the calculator below, then click Save to attach it to this client.</p>
          </div>
        </div>
        <div class="crm-banner-actions">
          <button class="crm-save-btn" onclick="CRM.saveCurrentCalcToClient()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
            </svg>
            Save to ${this._esc(client.name)}
          </button>
          <button class="crm-banner-cancel" onclick="CRM.cancelCalcForClient()" title="Cancel">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  },

  saveCurrentCalcToClient() {
    const clientId = this.state.activeClientForCalc;
    if (!clientId) return;
    if (!App.state.generated || !App.state.entities.length) {
      this.showToast('Generate the calculation first.', 'warn');
      return;
    }
    const calcData = {
      taxYear:         App.state.taxYear,
      taxFilingStatus: App.state.taxFilingStatus,
      entities:        JSON.parse(JSON.stringify(App.state.entities)),
      results:         JSON.parse(JSON.stringify(App.state.results)),
      notes:           App.state.notes,
    };
    this.saveCalculation(clientId, calcData);
    this.cancelCalcForClient();
    this.showToast('Calculation saved — client moved to Calculation Sent.');
    setTimeout(() => switchTab('pipeline'), 1400);
  },

  cancelCalcForClient() {
    this.state.activeClientForCalc = null;
    const banner = document.getElementById('crm-calc-banner');
    if (banner) banner.remove();
  },

  // ── Toast ──────────────────────────────────────────────────────────────────
  createToast() {
    const t = document.createElement('div');
    t.id = 'crm-toast';
    t.className = 'crm-toast hidden';
    document.body.appendChild(t);
  },

  showToast(msg, type = 'success') {
    const t = document.getElementById('crm-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `crm-toast crm-toast--${type}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  createModal() {
    const overlay = document.createElement('div');
    overlay.id = 'crm-modal';
    overlay.className = 'crm-modal-overlay hidden';
    overlay.innerHTML = `<div id="crm-modal-box" class="crm-modal-box"></div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) this.closeModal(); });
    document.body.appendChild(overlay);
  },

  openAddModal() {
    this.state.editingClientId = null;
    this._showModal(null);
  },

  openEditModal(clientId) {
    this.state.editingClientId = clientId;
    this._showModal(this.getClient(clientId));
  },

  _showModal(client) {
    const box     = document.getElementById('crm-modal-box');
    const overlay = document.getElementById('crm-modal');
    if (!box || !overlay) return;
    box.innerHTML = this._modalFormHTML(client);
    overlay.classList.remove('hidden');
    const form = document.getElementById('crm-client-form');
    if (form) form.addEventListener('submit', e => this.submitClientForm(e));
    setTimeout(() => { const f = document.getElementById('cf-name'); if (f) f.focus(); }, 60);
  },

  _modalFormHTML(client) {
    const isEdit = !!client;
    return `
      <div class="crm-modal-header">
        <h3 class="crm-modal-title">${isEdit ? 'Edit Client' : 'Add New Lead'}</h3>
        <button class="crm-modal-close" onclick="CRM.closeModal()" type="button" aria-label="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <form id="crm-client-form" class="crm-modal-body">
        <div class="crm-form-grid">

          <div class="field-group crm-col-span-2">
            <label class="field-label">Full Name <span class="text-red-500">*</span></label>
            <input type="text" id="cf-name" class="field-input" placeholder="e.g. John Smith"
              value="${this._esc(client?.name || '')}" required />
          </div>

          <div class="field-group crm-col-span-2">
            <label class="field-label">Company / Entity</label>
            <input type="text" id="cf-company" class="field-input" placeholder="e.g. Smith Tech LLC"
              value="${this._esc(client?.company || '')}" />
          </div>

          <div class="field-group">
            <label class="field-label">Email</label>
            <input type="email" id="cf-email" class="field-input" placeholder="email@example.com"
              value="${this._esc(client?.email || '')}" />
          </div>

          <div class="field-group">
            <label class="field-label">Phone</label>
            <input type="tel" id="cf-phone" class="field-input" placeholder="(555) 000-0000"
              value="${this._esc(client?.phone || '')}" />
          </div>

          <div class="field-group">
            <label class="field-label">Lead Source</label>
            <select id="cf-source" class="field-input">
              ${this.SOURCES.map(s => `<option value="${s}"${(client?.source || 'Other') === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>

          <div class="field-group">
            <label class="field-label">Assigned Sales Rep</label>
            <select id="cf-salesperson" class="field-input">
              ${this.SALESPEOPLE.map(s => `<option value="${s}"${(client?.salesperson || 'Unassigned') === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>

          ${isEdit ? `
          <div class="field-group crm-col-span-2">
            <label class="field-label">Status</label>
            <select id="cf-status" class="field-input">
              ${this.STATUSES.map(s => `<option value="${s}"${client.status === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          ` : ''}

          <div class="field-group crm-col-span-2">
            <label class="field-label">Notes</label>
            <textarea id="cf-notes" class="field-input resize-none" rows="3"
              placeholder="Referral name, context, or any relevant details...">${this._esc(client?.notes || '')}</textarea>
          </div>

        </div>
        <div class="crm-modal-footer">
          <button type="button" class="btn-secondary" onclick="CRM.closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">${isEdit ? 'Save Changes' : 'Add Lead'}</button>
        </div>
      </form>
    `;
  },

  submitClientForm(e) {
    e.preventDefault();
    const data = {
      name:       document.getElementById('cf-name')?.value.trim() || '',
      company:    document.getElementById('cf-company')?.value.trim() || '',
      email:      document.getElementById('cf-email')?.value.trim() || '',
      phone:      document.getElementById('cf-phone')?.value.trim() || '',
      source:     document.getElementById('cf-source')?.value || 'Other',
      salesperson:document.getElementById('cf-salesperson')?.value || 'Unassigned',
      notes:      document.getElementById('cf-notes')?.value.trim() || '',
    };
    if (!data.name) return;

    if (this.state.editingClientId) {
      const statusEl = document.getElementById('cf-status');
      if (statusEl) data.status = statusEl.value;
      this.updateClient(this.state.editingClientId, data);
      this.showToast('Client updated.');
    } else {
      this.addClient(data);
      this.showToast('Lead added to pipeline.');
    }
    this.closeModal();
  },

  closeModal() {
    const overlay = document.getElementById('crm-modal');
    if (overlay) overlay.classList.add('hidden');
    this.state.editingClientId = null;
  },

  confirmDelete(clientId) {
    const c = this.getClient(clientId);
    if (!c) return;
    if (!confirm(`Remove "${c.name}" from the pipeline?\nThis cannot be undone.`)) return;
    if (this.state.overviewClientId === clientId) this.state.overviewClientId = null;
    this.deleteClient(clientId);
    this.showToast('Client removed.', 'info');
  },

  // ── Follow-up Calls ────────────────────────────────────────────────────────
  openAddCallModal(clientId) {
    const box     = document.getElementById('crm-modal-box');
    const overlay = document.getElementById('crm-modal');
    if (!box || !overlay) return;
    const today = new Date().toISOString().split('T')[0];
    box.innerHTML = `
      <div class="crm-modal-header">
        <h3 class="crm-modal-title">Schedule Follow-up Call</h3>
        <button class="crm-modal-close" onclick="CRM.closeModal()" type="button">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <form id="crm-call-form" class="crm-modal-body">
        <div class="crm-form-grid">
          <div class="field-group">
            <label class="field-label">Date <span class="text-red-500">*</span></label>
            <input type="date" id="cc-date" class="field-input" value="${today}" required />
          </div>
          <div class="field-group">
            <label class="field-label">Time</label>
            <input type="text" id="cc-time" class="field-input" placeholder="e.g. 2:00 PM" />
          </div>
          <div class="field-group crm-col-span-2">
            <label class="field-label">Notes / Agenda</label>
            <textarea id="cc-notes" class="field-input resize-none" rows="3"
              placeholder="What is this call about?"></textarea>
          </div>
        </div>
        <div class="crm-modal-footer">
          <button type="button" class="btn-secondary" onclick="CRM.closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Schedule Call</button>
        </div>
      </form>
    `;
    overlay.classList.remove('hidden');
    const form = document.getElementById('crm-call-form');
    if (form) form.addEventListener('submit', e => this.submitCallForm(e, clientId));
    setTimeout(() => { const f = document.getElementById('cc-date'); if (f) f.focus(); }, 60);
  },

  submitCallForm(e, clientId) {
    e.preventDefault();
    const date  = document.getElementById('cc-date')?.value || '';
    const time  = document.getElementById('cc-time')?.value.trim() || '';
    const notes = document.getElementById('cc-notes')?.value.trim() || '';
    if (!date) return;
    const client = this.getClient(clientId);
    if (!client) return;
    if (!client.followUpCalls) client.followUpCalls = [];
    client.followUpCalls.push({ id: this.uid(), date, time, notes, completed: false });
    this.persist();
    this.closeModal();
    this.renderClientOverview(client);
    this.showToast('Follow-up call scheduled.');
  },

  toggleCallComplete(clientId, callId) {
    const client = this.getClient(clientId);
    if (!client || !client.followUpCalls) return;
    const call = client.followUpCalls.find(c => c.id === callId);
    if (call) call.completed = !call.completed;
    this.persist();
    this.renderClientOverview(client);
  },

  // ── Filter ─────────────────────────────────────────────────────────────────
  setFilter(status) {
    this.state.statusFilter = this.state.statusFilter === status ? null : status;
    this._renderPipeline();
  },

  // ── Overview Navigation ────────────────────────────────────────────────────
  openOverview(clientId) {
    this.state.overviewClientId = clientId;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  closeOverview() {
    this.state.overviewClientId = null;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ── Render: Router ─────────────────────────────────────────────────────────
  render() {
    if (this.state.contactProfileKey) {
      this.renderContactProfile(this.state.contactProfileKey);
      return;
    }
    if (this.state.overviewClientId) {
      const client = this.getClient(this.state.overviewClientId);
      if (client) { this.renderClientOverview(client); return; }
      this.state.overviewClientId = null;
    }
    this._renderPipeline();
  },

  // ── Render: Client Overview ────────────────────────────────────────────────
  renderClientOverview(client) {
    const panel = document.getElementById('tab-pipeline');
    if (!panel) return;
    panel.innerHTML = `
      ${this._ovBreadcrumb(client)}
      ${this._ovHero(client)}
      ${this._ovStats(client)}
      <div class="cov-content-grid">
        <div>
          ${this._ovGeneralInfo(client)}
          ${this._ovEntities(client)}
        </div>
        <div>
          ${this._ovSalesperson(client)}
          ${this._ovContacts(client)}
          ${this._ovEngagements(client)}
          ${this._ovCalls(client)}
        </div>
      </div>
    `;
  },

  _ovBreadcrumb(client) {
    return `
      <div class="cov-breadcrumb">
        <button class="cov-back-btn" onclick="CRM.closeOverview()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          Pipeline
        </button>
        <span class="cov-crumb-sep">/</span>
        <span class="cov-crumb-current">${this._esc(client.name)}</span>
      </div>
    `;
  },

  _ovHero(client) {
    const sc      = this.STATUS_COLORS[client.status] || {};
    const initials = client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const poc      = (client.contacts || []).find(c => c.isPrimary);
    const canNewCalc = ['Lead', 'Calculation Sent', 'Active Engagement'].includes(client.status);
    return `
      <div class="cov-hero">
        <div class="cov-hero-main">
          <div class="cov-hero-avatar">${initials}</div>
          <div class="cov-hero-info">
            <h2 class="cov-hero-name">${this._esc(client.name)}</h2>
            ${client.company ? `<p class="cov-hero-company">${this._esc(client.company)}</p>` : ''}
            <div class="cov-hero-badges">
              <span class="crm-status-pill" style="background:${sc.bg};color:${sc.text};border:1px solid ${sc.border}">${client.status}</span>
              ${poc ? `<span class="cov-role-badge">${this._esc(poc.title || poc.role)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="cov-hero-actions">
          ${canNewCalc ? `
            <button class="btn-primary" onclick="CRM.startCalcForClient('${client.id}')">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              New Engagement
            </button>` : ''}
          ${client.status === 'SOW Signed' ? `
            <button class="btn-primary" onclick="CRM.startEngagement('${client.id}')">Start Engagement</button>` : ''}
          ${client.status === 'Calculation Sent' ? `
            <button class="btn-secondary" onclick="CRM.markSOWSigned('${client.id}')">Mark SOW Signed</button>` : ''}
          <button class="btn-secondary" onclick="CRM.openEditModal('${client.id}')">Edit Client</button>
        </div>
      </div>
    `;
  },

  _ovStats(client) {
    const entities     = client.subEntities  || [];
    const contacts     = client.contacts     || [];
    const engagements  = client.engagements  || [];
    const calls        = client.followUpCalls|| [];
    const upcoming     = calls.filter(c => !c.completed).length;
    const latestCalc   = this.getLatestCalc(client.id);
    const total        = this.calcTotal(latestCalc);

    const chip = (icon, num, lbl, iconBg, iconColor) => `
      <div class="cov-stat-chip">
        <span class="cov-stat-icon" style="background:${iconBg};color:${iconColor}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"/>
          </svg>
        </span>
        <div>
          <span class="cov-stat-num">${num}</span>
          <span class="cov-stat-lbl">${lbl}</span>
        </div>
      </div>`;

    return `
      <div class="cov-stats-row">
        ${chip('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
              entities.length, 'Entit' + (entities.length === 1 ? 'y' : 'ies'), '#eff6ff', '#1d4ed8')}
        ${chip('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
              contacts.length, 'Contact' + (contacts.length !== 1 ? 's' : ''), '#f0fdf4', '#15803d')}
        ${chip('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
              engagements.length, 'Engagement' + (engagements.length !== 1 ? 's' : ''), '#fdf4ff', '#7e22ce')}
        ${chip('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
              upcoming, 'Upcoming Call' + (upcoming !== 1 ? 's' : ''), '#fff7ed', '#c2410c')}
        ${total !== null ? `
          <div class="cov-stat-chip">
            <span class="cov-stat-icon" style="background:#ecfdf5;color:#065f46">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </span>
            <div>
              <span class="cov-stat-num" style="font-size:0.95rem">${App.fmt(total)}</span>
              <span class="cov-stat-lbl">Latest Calc</span>
            </div>
          </div>` : ''}
      </div>
    `;
  },

  _ovGeneralInfo(client) {
    const since = new Date(client.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const questions = client.questions || [];
    return `
      <div class="cov-section">
        <div class="cov-section-header">
          <h3 class="cov-section-title">General Information</h3>
        </div>
        <div class="cov-info-grid">
          <div class="cov-info-item">
            <span class="cov-info-label">Client Since</span>
            <span class="cov-info-value">${since}</span>
          </div>
          <div class="cov-info-item">
            <span class="cov-info-label">Lead Source</span>
            <span class="cov-info-value">${this._esc(client.source || '—')}</span>
          </div>
          <div class="cov-info-item">
            <span class="cov-info-label">Email</span>
            <span class="cov-info-value">
              ${client.email ? `<a href="mailto:${this._esc(client.email)}" class="cov-link">${this._esc(client.email)}</a>` : '—'}
            </span>
          </div>
          <div class="cov-info-item">
            <span class="cov-info-label">Phone</span>
            <span class="cov-info-value">${this._esc(client.phone || '—')}</span>
          </div>
        </div>
        ${client.notes ? `
          <div class="cov-notes-box">
            <span class="cov-info-label">Notes</span>
            <p class="cov-notes-text">${this._esc(client.notes)}</p>
          </div>` : ''}
        ${questions.length ? `
          <div>
            <p class="cov-subsection-title">Intake Questions</p>
            <div class="cov-qa-list">
              ${questions.map(item => `
                <div class="cov-qa-item">
                  <p class="cov-qa-q">${this._esc(item.q)}</p>
                  <p class="cov-qa-a">${this._esc(item.a)}</p>
                </div>`).join('')}
            </div>
          </div>` : ''}
      </div>
    `;
  },

  _ovEntities(client) {
    const entities = client.subEntities || [];
    const contacts = client.contacts    || [];
    return `
      <div class="cov-section">
        <div class="cov-section-header">
          <h3 class="cov-section-title">Entities <span class="cov-count-badge">${entities.length}</span></h3>
        </div>
        ${!entities.length ? '<p class="cov-empty-msg">No entities recorded for this client.</p>' : `
          <div class="cov-entity-list">
            ${entities.map((ent, idx) => {
              const entContacts = contacts.filter(c => (ent.contactIds || []).includes(c.id));
              return `
                <div class="cov-entity-card">
                  <div class="cov-entity-header">
                    <div class="cov-entity-num">${idx + 1}</div>
                    <div class="cov-entity-info">
                      <p class="cov-entity-name">${this._esc(ent.name)}</p>
                      <div class="cov-entity-meta-row">
                        <span class="cov-entity-type-badge">${this._esc(ent.entityType)}</span>
                        <span class="cov-entity-meta-item">${this._esc(ent.state)}</span>
                        ${ent.ein ? `<span class="cov-entity-meta-item">EIN: ${this._esc(ent.ein)}</span>` : ''}
                      </div>
                    </div>
                  </div>
                  ${entContacts.length ? `
                    <div class="cov-entity-contacts">
                      <p class="cov-entity-contacts-label">Associated Contacts</p>
                      <div class="cov-entity-contacts-list">
                        ${entContacts.map(c => `
                          <span class="cov-contact-chip ${c.role === 'CPA' ? 'cov-contact-chip--cpa' : ''}"
                                title="${this._esc(c.role)}${c.firm ? ' · ' + c.firm : ''}">
                            <span class="cov-contact-chip-dot"></span>
                            ${this._esc(c.name)}
                            <span class="cov-contact-chip-role">${this._esc(c.role)}</span>
                          </span>`).join('')}
                      </div>
                    </div>` : ''}
                </div>`;
            }).join('')}
          </div>`}
      </div>
    `;
  },

  _ovSalesperson(client) {
    if (!client.salesperson || client.salesperson === 'Unassigned') return '';
    const initials = client.salesperson.split(' ').map(n => n[0]).join('').slice(0, 2);
    return `
      <div class="cov-section">
        <div class="cov-section-header">
          <h3 class="cov-section-title">Assigned Sales Rep</h3>
        </div>
        <div class="cov-rep-card">
          <div class="cov-rep-avatar">${initials}</div>
          <div>
            <p class="cov-rep-name">${this._esc(client.salesperson)}</p>
            <p class="cov-rep-role">Sales Representative</p>
          </div>
        </div>
      </div>
    `;
  },

  _ovContacts(client) {
    const contacts = client.contacts || [];
    return `
      <div class="cov-section">
        <div class="cov-section-header">
          <h3 class="cov-section-title">People &amp; Contacts <span class="cov-count-badge">${contacts.length}</span></h3>
        </div>
        ${!contacts.length ? '<p class="cov-empty-msg">No contacts recorded.</p>' : `
          <div class="cov-contacts-list">
            ${contacts.map(c => {
              const av = c.name.split(' ').map(n => n[0]).join('').slice(0, 2);
              const roleCls = c.role === 'CPA' ? 'cov-badge--cpa' : c.role === 'Point of Contact' ? 'cov-badge--poc' : 'cov-badge--other';
              return `
                <div class="cov-contact-item${c.isPrimary ? ' cov-contact-item--primary' : ''}">
                  <div class="cov-contact-avatar">${av}</div>
                  <div class="cov-contact-info">
                    <div class="cov-contact-name-row">
                      <span class="cov-contact-name">${this._esc(c.name)}</span>
                      ${c.isPrimary ? '<span class="cov-poc-badge">POC</span>' : ''}
                    </div>
                    <p class="cov-contact-title">${this._esc(c.title || c.role)}</p>
                    ${c.firm ? `<p class="cov-contact-firm">${this._esc(c.firm)}</p>` : ''}
                    <div class="cov-contact-links">
                      ${c.email ? `<a href="mailto:${this._esc(c.email)}" class="cov-link" style="font-size:0.78rem">${this._esc(c.email)}</a>` : ''}
                      ${c.phone ? `<span class="cov-contact-phone">${this._esc(c.phone)}</span>` : ''}
                    </div>
                  </div>
                  <span class="cov-contact-role-badge ${roleCls}">${this._esc(c.role)}</span>
                </div>`;
            }).join('')}
          </div>`}
      </div>
    `;
  },

  _ovEngagements(client) {
    const engagements = client.engagements || [];
    const latestCalc  = this.getLatestCalc(client.id);
    const calcTotal   = this.calcTotal(latestCalc);
    const hasContent  = engagements.length || latestCalc;

    const engCard = eng => {
      const yb         = eng.yearlyBilling || [];
      const isMulti    = yb.length > 0;
      const grandTotal = isMulti
        ? yb.reduce((s, r) => s + r.billingAmount, 0)
        : (eng.billingAmount || 0);
      const yearLabel  = isMulti
        ? (yb.length === 1 ? String(yb[0].year) : `${yb[0].year} – ${yb[yb.length - 1].year}`)
        : (eng.taxYear ? String(eng.taxYear) : '');
      const statusKey  = (eng.status || 'pending').toLowerCase().replace(/\s+/g, '-');

      return `
        <div class="cov-engagement-card">
          <div class="cov-engagement-header">
            <div>
              <p class="cov-engagement-type">${this._esc(eng.type)}${yearLabel ? ' — ' + yearLabel : ''}</p>
              ${isMulti ? `<p class="cov-engagement-phase">${yb.length} year${yb.length !== 1 ? 's' : ''}${eng.phase ? ' · ' + this._esc(eng.phase) : ''}</p>`
                        : (eng.phase ? `<p class="cov-engagement-phase">${this._esc(eng.phase)}</p>` : '')}
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="cov-engagement-status cov-engstatus--${statusKey}">${this._esc(eng.status)}</span>
              <button class="cov-eng-edit-btn" onclick="CRM.openEditEngagementModal('${client.id}','${eng.id}')" title="Edit engagement" type="button">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H7v-3.414a2 2 0 01.586-1.414z"/>
                </svg>
              </button>
            </div>
          </div>
          ${isMulti ? `
            <div class="cov-yearly-billing">
              ${yb.map(r => `
                <div class="cov-yearly-row">
                  <span class="cov-yearly-year">${r.year}</span>
                  <div class="cov-yearly-bar-wrap">
                    <div class="cov-yearly-bar" style="width:${grandTotal ? Math.round(r.billingAmount / grandTotal * 100) : 0}%"></div>
                  </div>
                  <span class="cov-yearly-amt">${App.fmt(r.billingAmount)}</span>
                </div>`).join('')}
              <div class="cov-yearly-total">
                <span>Total engagement</span>
                <strong>${App.fmt(grandTotal)}</strong>
              </div>
            </div>` : `
            <div class="cov-engagement-meta">
              ${eng.startDate ? `<div class="cov-engagement-meta-item">
                <span class="cov-info-label">Start Date</span>
                <span>${new Date(eng.startDate).toLocaleDateString()}</span>
              </div>` : ''}
              ${grandTotal ? `<div class="cov-engagement-meta-item">
                <span class="cov-info-label">Billing Amount</span>
                <strong style="color:#1e3a5f">${App.fmt(grandTotal)}</strong>
              </div>` : ''}
            </div>`}
        </div>`;
    };

    return `
      <div class="cov-section">
        <div class="cov-section-header">
          <h3 class="cov-section-title">Engagements</h3>
          <button class="cov-section-btn" onclick="CRM.openAddEngagementModal('${client.id}')">+ New</button>
        </div>
        ${!hasContent ? '<p class="cov-empty-msg">No engagements yet.</p>' : ''}
        ${engagements.map(engCard).join('')}
        ${latestCalc ? `
          <div class="cov-engagement-card" style="border-style:dashed">
            <div class="cov-engagement-header">
              <div>
                <p class="cov-engagement-type">Calculation — ${latestCalc.taxYear}</p>
                <p class="cov-engagement-phase">${latestCalc.entities?.length || 0} entit${(latestCalc.entities?.length || 0) === 1 ? 'y' : 'ies'}</p>
              </div>
              <span class="cov-engagement-status" style="background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe">On File</span>
            </div>
            ${calcTotal !== null ? `
              <div class="cov-engagement-meta">
                <div class="cov-engagement-meta-item">
                  <span class="cov-info-label">Total Billed</span>
                  <strong style="color:#1e3a5f">${App.fmt(calcTotal)}</strong>
                </div>
              </div>` : ''}
          </div>` : ''}
      </div>
    `;
  },

  // ── Add Engagement Modal ───────────────────────────────────────────────────
  openAddEngagementModal(clientId) {
    const box     = document.getElementById('crm-modal-box');
    const overlay = document.getElementById('crm-modal');
    if (!box || !overlay) return;

    const curYear = new Date().getFullYear();
    const yrs = [];
    for (let y = 2015; y <= curYear; y++) yrs.push(y);
    const opts    = (sel) => yrs.map(y => `<option value="${y}"${y === sel ? ' selected' : ''}>${y}</option>`).join('');

    box.innerHTML = `
      <div class="crm-modal-header">
        <h3 class="crm-modal-title">Add Engagement</h3>
        <button class="crm-modal-close" onclick="CRM.closeModal()" type="button">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <form id="crm-eng-form" class="crm-modal-body" style="max-height:72vh;overflow-y:auto">
        <div class="crm-form-grid">
          <div class="field-group crm-col-span-2">
            <label class="field-label">Engagement Type</label>
            <input type="text" id="ef-type" class="field-input" value="R&D Tax Credit" required />
          </div>
          <div class="field-group">
            <label class="field-label">Status</label>
            <select id="ef-status" class="field-input">
              <option>Active</option><option>Pending</option><option>Completed</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Phase</label>
            <input type="text" id="ef-phase" class="field-input" placeholder="e.g. Phase I" />
          </div>
          <div class="field-group">
            <label class="field-label">Start Year</label>
            <select id="ef-start-year" class="field-input" onchange="CRM._updateEngYears()">
              ${opts(curYear - 1)}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">End Year</label>
            <select id="ef-end-year" class="field-input" onchange="CRM._updateEngYears()">
              ${opts(curYear)}
            </select>
          </div>
        </div>
        <div class="crm-years-section">
          <div class="crm-years-header">
            <span class="crm-years-title">Billing Estimates by Year</span>
            <span class="crm-years-total">Total: <strong id="ef-total">$0</strong></span>
          </div>
          <div id="ef-year-rows"></div>
        </div>
        <div class="crm-modal-footer">
          <button type="button" class="btn-secondary" onclick="CRM.closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Add Engagement</button>
        </div>
      </form>
    `;

    overlay.classList.remove('hidden');
    const form = document.getElementById('crm-eng-form');
    if (form) form.addEventListener('submit', e => this.submitEngagementForm(e, clientId));
    this._updateEngYears();
  },

  _updateEngYears(prefill = {}) {
    const startYear = parseInt(document.getElementById('ef-start-year')?.value) || 0;
    const endYear   = parseInt(document.getElementById('ef-end-year')?.value)   || 0;
    const container = document.getElementById('ef-year-rows');
    if (!container) return;

    if (startYear > endYear) {
      container.innerHTML = `<p style="padding:12px 14px;font-size:0.82rem;color:#dc2626">End year must be ≥ start year.</p>`;
      return;
    }

    const years = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);

    container.innerHTML = years.map(y => `
      <div class="crm-year-row">
        <span class="crm-year-label">${y}</span>
        <div class="crm-year-input-wrap">
          <span class="crm-year-prefix">$</span>
          <input type="number" id="ef-year-${y}" class="field-input crm-year-input"
            placeholder="0" min="0" step="500" value="${prefill[y] || ''}"
            oninput="CRM._updateEngTotal()" />
        </div>
      </div>`).join('');

    this._updateEngTotal();
    setTimeout(() => { const f = document.getElementById(`ef-year-${years[0]}`); if (f) f.focus(); }, 60);
  },

  _updateEngTotal() {
    const container = document.getElementById('ef-year-rows');
    const totalEl   = document.getElementById('ef-total');
    if (!container || !totalEl) return;
    let total = 0;
    container.querySelectorAll('input[type="number"]').forEach(inp => { total += parseFloat(inp.value) || 0; });
    totalEl.textContent = App.fmt(total);
  },

  submitEngagementForm(e, clientId, engId = null) {
    e.preventDefault();
    const startYear = parseInt(document.getElementById('ef-start-year')?.value) || new Date().getFullYear();
    const endYear   = parseInt(document.getElementById('ef-end-year')?.value)   || startYear;
    if (startYear > endYear) { this.showToast('End year must be ≥ start year.', 'warn'); return; }

    const yearlyBilling = [];
    for (let y = startYear; y <= endYear; y++) {
      yearlyBilling.push({ year: y, billingAmount: parseFloat(document.getElementById(`ef-year-${y}`)?.value) || 0 });
    }

    const client = this.getClient(clientId);
    if (!client) return;
    if (!client.engagements) client.engagements = [];

    const updated = {
      type:   document.getElementById('ef-type')?.value.trim()  || 'R&D Tax Credit',
      status: document.getElementById('ef-status')?.value       || 'Active',
      phase:  document.getElementById('ef-phase')?.value.trim() || '',
      yearlyBilling,
    };

    if (engId) {
      const idx = client.engagements.findIndex(e => e.id === engId);
      if (idx !== -1) {
        client.engagements[idx] = { ...client.engagements[idx], ...updated };
        this.persist();
        this.closeModal();
        this.renderClientOverview(client);
        this.showToast('Engagement updated.');
        return;
      }
    }

    client.engagements.push({ id: this.uid(), startDate: new Date().toISOString().split('T')[0], ...updated });
    this.persist();
    this.closeModal();
    this.renderClientOverview(client);
    this.showToast('Engagement added.');
  },

  openEditEngagementModal(clientId, engId) {
    const client = this.getClient(clientId);
    if (!client) return;
    const eng = (client.engagements || []).find(e => e.id === engId);
    if (!eng) return;

    const box     = document.getElementById('crm-modal-box');
    const overlay = document.getElementById('crm-modal');
    if (!box || !overlay) return;

    const yb       = eng.yearlyBilling || [];
    const startYr  = yb.length ? yb[0].year : new Date().getFullYear() - 1;
    const endYr    = yb.length ? yb[yb.length - 1].year : new Date().getFullYear();
    const curYear  = new Date().getFullYear();
    const yrs      = [];
    for (let y = 2015; y <= curYear; y++) yrs.push(y);
    const opts = (sel) => yrs.map(y => `<option value="${y}"${y === sel ? ' selected' : ''}>${y}</option>`).join('');

    const existingAmounts = {};
    yb.forEach(r => { existingAmounts[r.year] = r.billingAmount; });

    box.innerHTML = `
      <div class="crm-modal-header">
        <h3 class="crm-modal-title">Edit Engagement</h3>
        <button class="crm-modal-close" onclick="CRM.closeModal()" type="button">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <form id="crm-eng-form" class="crm-modal-body" style="max-height:72vh;overflow-y:auto">
        <div class="crm-form-grid">
          <div class="field-group crm-col-span-2">
            <label class="field-label">Engagement Type</label>
            <input type="text" id="ef-type" class="field-input" value="${this._esc(eng.type)}" required />
          </div>
          <div class="field-group">
            <label class="field-label">Status</label>
            <select id="ef-status" class="field-input">
              ${['Active','Pending','Completed'].map(s => `<option${s === eng.status ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Phase</label>
            <input type="text" id="ef-phase" class="field-input" value="${this._esc(eng.phase || '')}" placeholder="e.g. Phase I" />
          </div>
          <div class="field-group">
            <label class="field-label">Start Year</label>
            <select id="ef-start-year" class="field-input" onchange="CRM._updateEngYears()">
              ${opts(startYr)}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">End Year</label>
            <select id="ef-end-year" class="field-input" onchange="CRM._updateEngYears()">
              ${opts(endYr)}
            </select>
          </div>
        </div>
        <div class="crm-years-section">
          <div class="crm-years-header">
            <span class="crm-years-title">Billing Estimates by Year</span>
            <span class="crm-years-total">Total: <strong id="ef-total">$0</strong></span>
          </div>
          <div id="ef-year-rows"></div>
        </div>
        <div class="crm-modal-footer">
          <button type="button" class="btn-secondary" onclick="CRM.closeModal()">Cancel</button>
          <button type="submit" class="btn-primary">Save Changes</button>
        </div>
      </form>
    `;

    overlay.classList.remove('hidden');
    const form = document.getElementById('crm-eng-form');
    if (form) form.addEventListener('submit', e => this.submitEngagementForm(e, clientId, engId));
    this._updateEngYears(existingAmounts);
  },

  _ovCalls(client) {
    const calls    = client.followUpCalls || [];
    const upcoming = calls.filter(c => !c.completed);
    const done     = calls.filter(c =>  c.completed);
    return `
      <div class="cov-section">
        <div class="cov-section-header">
          <h3 class="cov-section-title">Follow-up Calls</h3>
          <button class="cov-section-btn" onclick="CRM.openAddCallModal('${client.id}')">+ Add</button>
        </div>
        ${!calls.length ? '<p class="cov-empty-msg">No follow-up calls scheduled.</p>' : ''}
        ${upcoming.length ? `
          <div class="cov-calls-group">
            <p class="cov-calls-group-label">Upcoming</p>
            ${upcoming.map(call => `
              <div class="cov-call-item">
                <input type="checkbox" class="cov-call-checkbox"
                  onchange="CRM.toggleCallComplete('${client.id}', '${call.id}')" title="Mark complete" />
                <div class="cov-call-body">
                  <p class="cov-call-date">${call.date}${call.time ? ' at ' + call.time : ''}</p>
                  <p class="cov-call-notes">${this._esc(call.notes)}</p>
                </div>
              </div>`).join('')}
          </div>` : ''}
        ${done.length ? `
          <div class="cov-calls-group" style="margin-top:${upcoming.length ? '12px' : '0'}">
            <p class="cov-calls-group-label">Completed</p>
            ${done.map(call => `
              <div class="cov-call-item cov-call-item--done">
                <input type="checkbox" class="cov-call-checkbox" checked
                  onchange="CRM.toggleCallComplete('${client.id}', '${call.id}')" title="Mark incomplete" />
                <div class="cov-call-body">
                  <p class="cov-call-date cov-call-date--done">${call.date}${call.time ? ' at ' + call.time : ''}</p>
                  <p class="cov-call-notes cov-call-notes--done">${this._esc(call.notes)}</p>
                </div>
              </div>`).join('')}
          </div>` : ''}
      </div>
    `;
  },

  // ── People / Contact Search ────────────────────────────────────────────────
  _contactKey(contact) {
    const email = (contact.email || '').trim().toLowerCase();
    return email || `${(contact.name || '').toLowerCase()}::${(contact.firm || '').toLowerCase()}`;
  },

  _searchContacts(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const map = new Map();
    this.state.clients.forEach(client => {
      (client.contacts || []).forEach(contact => {
        const k = this._contactKey(contact);
        const match = (contact.name  || '').toLowerCase().includes(q)
          || (contact.firm  || '').toLowerCase().includes(q)
          || (contact.role  || '').toLowerCase().includes(q)
          || (contact.email || '').toLowerCase().includes(q)
          || (contact.title || '').toLowerCase().includes(q);
        if (match) {
          if (!map.has(k)) map.set(k, { key: k, contact, clients: [] });
          map.get(k).clients.push(client);
        }
      });
    });
    return [...map.values()];
  },

  _findContactOccurrences(key) {
    const results = [];
    this.state.clients.forEach(client => {
      (client.contacts || []).forEach(contact => {
        if (this._contactKey(contact) === key) {
          const entities = (client.subEntities || []).filter(e =>
            (e.contactIds || []).includes(contact.id)
          );
          results.push({ client, contact, entities });
        }
      });
    });
    return results;
  },

  _jsenc(s) {
    return encodeURIComponent(String(s));
  },

  searchPeople(value) {
    this.state.contactQuery = value;
    this._renderPipeline();
    setTimeout(() => {
      const inp = document.getElementById('crm-people-search');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }, 0);
  },

  openContactProfile(key) {
    this.state.contactProfileKey = key;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  closeContactProfile() {
    this.state.contactProfileKey = null;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderContactProfile(key) {
    const panel = document.getElementById('tab-pipeline');
    if (!panel) return;

    const occs = this._findContactOccurrences(key);
    if (!occs.length) {
      this.state.contactProfileKey = null;
      this._renderPipeline();
      return;
    }

    const { contact } = occs[0];
    const av = contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const isCPA = contact.role === 'CPA';
    const isPoC = contact.role === 'Point of Contact';
    const roleCls = isCPA ? 'cov-badge--cpa' : isPoC ? 'cov-badge--poc' : 'cov-badge--other';
    const avatarBg = isCPA ? '#7c3aed' : isPoC ? '#1e3a5f' : '#059669';

    panel.innerHTML = `
      <nav class="cov-breadcrumb">
        <button class="cov-bc-btn" onclick="CRM.closeContactProfile()">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
          </svg>
          Pipeline
        </button>
        <span class="cov-bc-sep">›</span>
        <span class="cov-bc-link" onclick="CRM.closeContactProfile()">People</span>
        <span class="cov-bc-sep">›</span>
        <span class="cov-bc-cur">${this._esc(contact.name)}</span>
      </nav>

      <div class="cov-hero">
        <div class="cov-hero-avatar" style="background:${avatarBg}">${av}</div>
        <div class="cov-hero-info">
          <h1 class="cov-hero-name">${this._esc(contact.name)}</h1>
          ${contact.title ? `<p class="cov-hero-company">${this._esc(contact.title)}</p>` : ''}
          ${contact.firm  ? `<p class="cov-hero-meta" style="color:#7c3aed">${this._esc(contact.firm)}</p>` : ''}
          <div style="display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap">
            <span class="cov-contact-role-badge ${roleCls}">${this._esc(contact.role)}</span>
            <span style="font-size:0.8rem;color:#64748b">Linked to <strong>${occs.length}</strong> client record${occs.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        ${(contact.email || contact.phone) ? `
          <div class="crm-cp-contact-box">
            ${contact.email ? `<a href="mailto:${this._esc(contact.email)}" class="crm-cp-contact-item">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              ${this._esc(contact.email)}
            </a>` : ''}
            ${contact.phone ? `<span class="crm-cp-contact-item">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
              ${this._esc(contact.phone)}
            </span>` : ''}
          </div>` : ''}
      </div>

      <div class="cov-content-grid" style="grid-template-columns:1fr">
        <div class="cov-section">
          <div class="cov-section-header">
            <h3 class="cov-section-title">Client Associations</h3>
          </div>
          ${occs.map(({ client, contact: c, entities }) => {
            const cav = client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const sc  = this.STATUS_COLORS[client.status] || { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
            const years = this._engYears(client);
            const cRoleCls = c.role === 'CPA' ? 'cov-badge--cpa' : c.role === 'Point of Contact' ? 'cov-badge--poc' : 'cov-badge--other';
            return `
              <div class="crm-assoc-card">
                <div class="crm-assoc-header">
                  <div style="display:flex;align-items:center;gap:12px">
                    <div class="cov-hero-avatar" style="width:40px;height:40px;font-size:0.85rem;background:#1e3a5f;flex-shrink:0">${cav}</div>
                    <div>
                      <p style="font-weight:700;color:#1e293b;font-size:0.95rem">${this._esc(client.name)}</p>
                      <p style="font-size:0.8rem;color:#64748b">${this._esc(client.company)}</p>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="crm-status-pill" style="background:${sc.bg};color:${sc.text};border:1px solid ${sc.border}">${this._esc(client.status)}</span>
                    <button class="cov-section-btn" onclick="CRM.openOverview('${client.id}')">View Profile</button>
                  </div>
                </div>
                <div class="crm-assoc-detail">
                  <div class="crm-assoc-row">
                    <span class="cov-info-label">Role here</span>
                    <span class="cov-contact-role-badge ${cRoleCls}" style="font-size:0.72rem">${this._esc(c.role)}</span>
                  </div>
                  ${entities.length ? `
                    <div class="crm-assoc-row">
                      <span class="cov-info-label">Entities</span>
                      <div style="display:flex;flex-wrap:wrap;gap:4px">
                        ${entities.map(e => `<span class="crm-yr-chip" style="background:#f1f5f9;border-color:#e2e8f0;color:#475569;font-family:inherit">${this._esc(e.name)}</span>`).join('')}
                      </div>
                    </div>` : ''}
                  ${years.length ? `
                    <div class="crm-assoc-row">
                      <span class="cov-info-label">Eng. Years</span>
                      <div style="display:flex;flex-wrap:wrap;gap:4px">${this._yearChips(years)}</div>
                    </div>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    `;
  },

  _renderPeopleResults() {
    const results = this._searchContacts(this.state.contactQuery);
    if (!results.length) return `
      <div class="crm-empty" style="padding:48px 32px">
        <p class="crm-empty-title">No contacts found for "${this._esc(this.state.contactQuery)}"</p>
        <p class="crm-empty-sub" style="margin-top:4px">Try name, firm, role, or email.</p>
      </div>`;
    return `
      <section class="crm-pipeline-section">
        <div class="crm-section-hdr">
          <span class="crm-section-dot" style="background:#7c3aed"></span>
          <h3 class="crm-section-ttl">People matching "${this._esc(this.state.contactQuery)}"</h3>
          <span class="crm-count-pill">${results.length}</span>
        </div>
        <div class="crm-people-grid">
          ${results.map(r => this._personCard(r)).join('')}
        </div>
      </section>`;
  },

  _personCard({ key, contact, clients }) {
    const av = contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const isCPA = contact.role === 'CPA';
    const isPoC = contact.role === 'Point of Contact';
    const roleCls = isCPA ? 'cov-badge--cpa' : isPoC ? 'cov-badge--poc' : 'cov-badge--other';
    const avatarBg = isCPA ? '#7c3aed' : isPoC ? '#1e3a5f' : '#059669';
    const encKey = this._jsenc(key);
    return `
      <div class="crm-person-card" onclick="CRM.openContactProfile(decodeURIComponent('${encKey}'))">
        <div class="crm-person-avatar" style="background:${avatarBg}">${av}</div>
        <div class="crm-person-main">
          <div class="crm-person-name-row">
            <span class="crm-person-name">${this._esc(contact.name)}</span>
            <span class="cov-contact-role-badge ${roleCls}" style="font-size:0.72rem">${this._esc(contact.role)}</span>
          </div>
          ${contact.title ? `<p class="crm-person-meta">${this._esc(contact.title)}</p>` : ''}
          ${contact.firm  ? `<p class="crm-person-firm">${this._esc(contact.firm)}</p>`  : ''}
          ${contact.email ? `<p class="crm-person-email">${this._esc(contact.email)}</p>` : ''}
        </div>
        <div class="crm-person-clients">
          <span class="crm-person-clients-lbl">In ${clients.length} client${clients.length !== 1 ? 's' : ''}:</span>
          ${clients.map(c => `<span class="crm-person-client-pill">${this._esc(c.name)}</span>`).join('')}
        </div>
      </div>`;
  },

  // ── Render: Main Pipeline View ─────────────────────────────────────────────
  _renderPipeline() {
    const panel = document.getElementById('tab-pipeline');
    if (!panel) return;

    const { clients } = this.state;
    const byStatus    = s => clients.filter(c => c.status === s);
    const engagements = byStatus('Active Engagement');
    const signed      = byStatus('SOW Signed');
    const calcSent    = byStatus('Calculation Sent');
    const leads       = byStatus('Lead');

    const sf       = this.state.statusFilter;
    const visible  = sf ? clients.filter(c => c.status === sf) : clients;
    const sc       = sf ? (this.STATUS_COLORS[sf] || {}) : {};

    // Card-section groups shown only when no filter or when filter matches
    const showEngCards  = !sf || sf === 'Active Engagement';
    const showSignCards = !sf || sf === 'SOW Signed';

    panel.innerHTML = `
      <div class="crm-stats-row">
        ${this._statCard('Total Leads', leads.length, '#3b82f6',
          'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', 'Lead')}
        ${this._statCard('Calculations Sent', calcSent.length, '#d97706',
          'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z', 'Calculation Sent')}
        ${this._statCard('SOW Signed', signed.length, '#059669',
          'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', 'SOW Signed')}
        ${this._statCard('Active Engagements', engagements.length, '#1e3a5f',
          'M13 10V3L4 14h7v7l9-11h-7z', 'Active Engagement')}
      </div>

      <div class="crm-page-header">
        <div>
          <h2 class="crm-page-title">Client Pipeline</h2>
          <p class="crm-page-sub">
            ${sf
              ? `Showing <strong style="color:${sc.text || '#1e293b'}">${sf}</strong> — ${visible.length} client${visible.length !== 1 ? 's' : ''}`
              : 'Manage leads, send proposals, and track active engagements'}
          </p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div class="crm-people-search-wrap">
            <svg class="crm-people-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <input id="crm-people-search" type="text" class="crm-people-search-input"
              placeholder="Search contacts, CPAs…"
              value="${this._esc(this.state.contactQuery)}"
              oninput="CRM.searchPeople(this.value)"
              autocomplete="off" />
            ${this.state.contactQuery ? `
              <button class="crm-people-clear" onclick="CRM.searchPeople('')" type="button">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>` : ''}
          </div>
          ${sf ? `
            <button class="crm-filter-clear" onclick="CRM.setFilter('${sf}')">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Clear filter
            </button>` : ''}
          <button class="btn-primary" onclick="CRM.openAddModal()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Add New Lead
          </button>
        </div>
      </div>

      ${this.state.contactQuery ? this._renderPeopleResults() : `
        ${showEngCards && engagements.length ? `
          <section class="crm-pipeline-section">
            <div class="crm-section-hdr">
              <span class="crm-section-dot" style="background:#065f46"></span>
              <h3 class="crm-section-ttl">Active Engagements</h3>
              <span class="crm-count-pill">${engagements.length}</span>
            </div>
            <div class="crm-cards-grid">
              ${engagements.map(c => this._clientCard(c)).join('')}
            </div>
          </section>` : ''}

        ${showSignCards && signed.length ? `
          <section class="crm-pipeline-section">
            <div class="crm-section-hdr">
              <span class="crm-section-dot" style="background:#15803d"></span>
              <h3 class="crm-section-ttl">Signed SOW — Ready to Engage</h3>
              <span class="crm-count-pill">${signed.length}</span>
            </div>
            <div class="crm-cards-grid">
              ${signed.map(c => this._clientCard(c)).join('')}
            </div>
          </section>` : ''}

        <section class="crm-pipeline-section">
          <div class="crm-section-hdr">
            <span class="crm-section-dot" style="background:${sf ? (sc.border || '#94a3b8') : '#94a3b8'}"></span>
            <h3 class="crm-section-ttl">${sf ? sf : 'All Leads &amp; Clients'}</h3>
            <span class="crm-count-pill">${visible.length}</span>
          </div>
          ${visible.length === 0
            ? `<div class="crm-empty" style="padding:32px">
                 <p class="crm-empty-title">No clients with status "${sf}"</p>
                 <p class="crm-empty-sub" style="margin-top:4px">Try a different filter or add a new lead.</p>
               </div>`
            : `<div class="crm-table-wrap">
                 <table class="crm-table">
                   <thead>
                     <tr>
                       <th>Name / Company</th>
                       <th>Status</th>
                       <th>Rep</th>
                       <th>Eng. Years</th>
                       <th>Latest Calc</th>
                       <th>Added</th>
                       <th class="text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${visible.map(c => this._clientRow(c)).join('')}
                   </tbody>
                 </table>
               </div>`}
        </section>`}
    `;
  },

  // ── Render Helpers ─────────────────────────────────────────────────────────
  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  _statCard(label, value, color, path, status) {
    const active = this.state.statusFilter === status;
    return `
      <button class="crm-stat-card${active ? ' crm-stat-card--active' : ''}"
              onclick="CRM.setFilter('${status}')"
              style="${active ? `border-color:${color};box-shadow:0 0 0 3px ${color}22` : ''}">
        <div class="crm-stat-icon" style="background:${active ? color : color + '18'};color:${active ? '#fff' : color}">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/>
          </svg>
        </div>
        <div>
          <div class="crm-stat-value" style="color:${color}">${value}</div>
          <div class="crm-stat-label">${label}</div>
        </div>
      </button>
    `;
  },

  _engYears(client) {
    return [...new Set(
      (client.engagements || []).flatMap(e =>
        e.yearlyBilling ? e.yearlyBilling.map(y => y.year) : (e.taxYear ? [e.taxYear] : [])
      )
    )].sort((a, b) => a - b);
  },

  _yearChips(years, cls = 'crm-yr-chip') {
    return years.map(y => `<span class="${cls}">${y}</span>`).join('');
  },

  _clientCard(client) {
    const calc      = this.getLatestCalc(client.id);
    const total     = this.calcTotal(calc);
    const sc        = this.STATUS_COLORS[client.status] || {};
    const years     = this._engYears(client);
    const dateLabel = client.engagementStartedAt
      ? `Engaged ${new Date(client.engagementStartedAt).toLocaleDateString()}`
      : client.sowSignedAt
        ? `SOW Signed ${new Date(client.sowSignedAt).toLocaleDateString()}`
        : `Added ${new Date(client.createdAt).toLocaleDateString()}`;

    return `
      <div class="crm-card">
        <div class="crm-card-top">
          <div class="crm-avatar">${(client.name[0] || '?').toUpperCase()}</div>
          <div class="crm-card-title-block">
            <p class="crm-card-name">${this._esc(client.name)}</p>
            ${client.company ? `<p class="crm-card-company">${this._esc(client.company)}</p>` : ''}
          </div>
          <span class="crm-status-pill" style="background:${sc.bg};color:${sc.text};border-color:${sc.border}">${client.status}</span>
        </div>
        ${years.length ? `<div class="crm-card-years">${this._yearChips(years)}</div>` : ''}
        <div class="crm-card-meta-list">
          <div class="crm-card-meta-row text-slate-400 text-xs">${dateLabel}</div>
          ${client.salesperson && client.salesperson !== 'Unassigned' ? `
            <div class="crm-card-meta-row">
              <span class="text-slate-400">Rep</span>
              <span class="text-xs">${this._esc(client.salesperson)}</span>
            </div>` : ''}
          ${total !== null ? `
            <div class="crm-card-meta-row">
              <span class="text-slate-400">Total Bill</span>
              <strong class="text-navy">${App.fmt(total)}</strong>
            </div>` : ''}
          ${(client.subEntities || []).length ? `
            <div class="crm-card-meta-row">
              <span class="text-slate-400">Entities</span>
              <span>${client.subEntities.length}</span>
            </div>` : ''}
        </div>
        <div class="crm-card-footer-actions">
          ${this._cardActionBtns(client)}
        </div>
      </div>
    `;
  },

  _cardActionBtns(client) {
    const b = [];
    b.push(`<button class="crm-act-btn crm-act-view" onclick="CRM.openOverview('${client.id}')">View Profile</button>`);
    if (client.status === 'Lead' || client.status === 'Active Engagement') {
      b.push(`<button class="crm-act-btn crm-act-primary" onclick="CRM.startCalcForClient('${client.id}')">New Calc</button>`);
    }
    if (client.status === 'Calculation Sent') {
      b.push(`<button class="crm-act-btn crm-act-primary" onclick="CRM.startCalcForClient('${client.id}')">New Calc</button>`);
      b.push(`<button class="crm-act-btn crm-act-success" onclick="CRM.markSOWSigned('${client.id}')">Sign SOW</button>`);
    }
    if (client.status === 'SOW Signed') {
      b.push(`<button class="crm-act-btn crm-act-success" onclick="CRM.startEngagement('${client.id}')">Start Engagement</button>`);
    }
    b.push(`<button class="crm-act-btn crm-act-ghost" onclick="CRM.openEditModal('${client.id}')">Edit</button>`);
    return b.join('');
  },

  _clientRow(client) {
    const calc  = this.getLatestCalc(client.id);
    const total = this.calcTotal(calc);
    const sc    = this.STATUS_COLORS[client.status] || {};
    const added = new Date(client.createdAt).toLocaleDateString();
    const years = this._engYears(client);

    return `
      <tr class="crm-tr">
        <td class="crm-td">
          <div class="flex items-center gap-2">
            <div class="crm-row-avatar">${(client.name[0] || '?').toUpperCase()}</div>
            <div>
              <p class="text-sm font-semibold text-slate-800">${this._esc(client.name)}</p>
              ${client.company ? `<p class="text-xs text-slate-400">${this._esc(client.company)}</p>` : ''}
            </div>
          </div>
        </td>
        <td class="crm-td">
          <span class="crm-status-pill" style="background:${sc.bg};color:${sc.text};border:1px solid ${sc.border}">${client.status}</span>
        </td>
        <td class="crm-td text-sm text-slate-500">${this._esc(client.salesperson || '—')}</td>
        <td class="crm-td">
          ${years.length
            ? `<div class="crm-row-years">${this._yearChips(years, 'crm-yr-chip crm-yr-chip--sm')}</div>`
            : '<span class="text-xs text-slate-400">—</span>'}
        </td>
        <td class="crm-td text-sm font-semibold text-slate-700">${total !== null ? App.fmt(total) : '—'}</td>
        <td class="crm-td text-xs text-slate-400">${added}</td>
        <td class="crm-td">
          <div class="flex items-center justify-end gap-1 flex-wrap">
            <button class="crm-row-btn crm-row-view"    onclick="CRM.openOverview('${client.id}')">View</button>
            ${client.status === 'Lead'
              ? `<button class="crm-row-btn crm-row-primary" onclick="CRM.startCalcForClient('${client.id}')">Create Calc</button>`
              : ''}
            ${client.status === 'Calculation Sent'
              ? `<button class="crm-row-btn crm-row-success" onclick="CRM.markSOWSigned('${client.id}')">Sign SOW</button>`
              : ''}
            ${client.status === 'SOW Signed'
              ? `<button class="crm-row-btn crm-row-success" onclick="CRM.startEngagement('${client.id}')">Start Engagement</button>`
              : ''}
            ${client.status === 'Active Engagement'
              ? `<button class="crm-row-btn crm-row-primary" onclick="CRM.startCalcForClient('${client.id}')">New Calc</button>`
              : ''}
            <button class="crm-row-btn crm-row-ghost"  onclick="CRM.openEditModal('${client.id}')">Edit</button>
            <button class="crm-row-btn crm-row-danger" onclick="CRM.confirmDelete('${client.id}')" title="Remove">✕</button>
          </div>
        </td>
      </tr>
    `;
  },

  _emptyState() {
    return `
      <div class="crm-empty">
        <div class="crm-empty-icon">
          <svg class="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <p class="crm-empty-title">No clients in the pipeline yet</p>
        <p class="crm-empty-sub">Add your first lead to start tracking the sales process.</p>
        <button class="btn-primary mt-5" onclick="CRM.openAddModal()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Add New Lead
        </button>
      </div>
    `;
  },
};

// ── Tab Switcher (global) ──────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  const calc     = document.getElementById('tab-calculator');
  const pipeline = document.getElementById('tab-pipeline');
  if (calc)     calc.classList.toggle('hidden', tab !== 'calculator');
  if (pipeline) pipeline.classList.toggle('hidden', tab !== 'pipeline');
  if (tab === 'pipeline') CRM.render();
}

window.addEventListener('DOMContentLoaded', () => CRM.init());
