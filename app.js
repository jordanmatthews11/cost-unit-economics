// ============================================
// Cost Unit Economics Calculator — App Logic
// ============================================

// Replace with your Google OAuth 2.0 Web client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = '25032009454-sitfdne7k6u6m38q5nj54idg1ghc6aef.apps.googleusercontent.com';

const SESSION_KEY = 'cost_unit_economics_user';
const AUTH_TOKEN_KEY = 'cost_unit_economics_token';

let currentUser = null;

// ---- Auth ----

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function setStoredToken(token) {
  if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  else sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function getStoredToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function clearStoredUser() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function parseJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function showLogin() {
  currentUser = null;
  document.getElementById('loginContainer').classList.remove('app-hidden');
  document.getElementById('appContent').classList.add('app-hidden');
  renderGoogleButton();
}

function showApp(user) {
  currentUser = user;
  setStoredUser(user);
  document.getElementById('loginContainer').classList.add('app-hidden');
  document.getElementById('appContent').classList.remove('app-hidden');
  const emailEl = document.getElementById('headerUserEmail');
  if (emailEl) emailEl.textContent = user.email || 'Signed in';
  document.getElementById('signOutBtn').addEventListener('click', handleSignOut);
  setupTabs();
  initCalculator();
}

function renderGoogleButton() {
  const el = document.getElementById('googleSignInButton');
  if (!el) return;
  if (typeof google === 'undefined') return;
  el.innerHTML = '';
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
  });
  google.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'filled_blue',
    size: 'large',
    text: 'signin_with',
    width: 280,
  });
}

function handleCredentialResponse(response) {
  const credential = response.credential;
  const payload = credential ? parseJwtPayload(credential) : null;
  if (!payload) return showLogin();
  const user = {
    email: payload.email || '',
    name: payload.name || payload.email || '',
  };
  setStoredToken(credential);
  showApp(user);
}

function handleSignOut() {
  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  clearStoredUser();
  currentUser = null;
  document.getElementById('signOutBtn').replaceWith(document.getElementById('signOutBtn').cloneNode(true));
  showLogin();
}

function getAuthToken() {
  return getStoredToken();
}

function setupTabs() {
  const tabUE = document.getElementById('tabUnitEconomics');
  const tabBills = document.getElementById('tabBills');
  const panelUE = document.getElementById('panelUnitEconomics');
  const panelBills = document.getElementById('panelBills');
  const subtitle = document.getElementById('headerSubtitle');
  if (!tabUE || !tabBills) return;
  tabUE.addEventListener('click', () => {
    tabUE.classList.add('active');
    tabUE.setAttribute('aria-selected', 'true');
    tabBills.classList.remove('active');
    tabBills.setAttribute('aria-selected', 'false');
    panelUE.classList.remove('app-hidden');
    panelUE.setAttribute('aria-hidden', 'false');
    panelBills.classList.add('app-hidden');
    panelBills.setAttribute('aria-hidden', 'true');
    if (subtitle) subtitle.textContent = 'Unit Economics & Bills';
  });
  tabBills.addEventListener('click', () => {
    tabBills.classList.add('active');
    tabBills.setAttribute('aria-selected', 'true');
    tabUE.classList.remove('active');
    tabUE.setAttribute('aria-selected', 'false');
    panelBills.classList.remove('app-hidden');
    panelBills.setAttribute('aria-hidden', 'false');
    panelUE.classList.add('app-hidden');
    panelUE.setAttribute('aria-hidden', 'true');
    if (subtitle) subtitle.textContent = 'Bills & Expenses';
    initBillsOnce();
  });
}

function authInit() {
  const user = getStoredUser();
  if (user && user.email) {
    showApp(user);
    return;
  }
  if (typeof google === 'undefined') {
    document.getElementById('googleSignInButton').innerHTML =
      '<p class="login-loading">Loading sign-in…</p>';
    function checkGoogle() {
      if (typeof google !== 'undefined') {
        renderGoogleButton();
        return;
      }
      requestAnimationFrame(checkGoogle);
    }
    requestAnimationFrame(checkGoogle);
    showLogin();
    return;
  }
  showLogin();
}

// ---- Calculator (existing logic) ----

const TEAMS = [
  { id: 'projectMgmt', name: 'Project Management' },
  { id: 'platform', name: 'Platform' },
  { id: 'solutionsArch', name: 'Solutions Architect' },
];

const VOLUME_FIELDS = [
  { key: 'numProjects', label: 'Projects', placeholder: 'e.g. 10', step: '1' },
  { key: 'numResponses', label: 'Response Groups (survey responses)', placeholder: 'e.g. 5000', step: '1' },
];

const COST_FIELDS = [
  { key: 'headcount', label: 'Headcount', placeholder: 'e.g. 5', step: '1' },
  { key: 'avgSalary', label: 'Avg. Salary per Person ($)', placeholder: 'e.g. 95000', step: '0.01' },
  { key: 'toolsCost', label: 'Tools & Software ($)', placeholder: 'e.g. 12000', step: '0.01' },
  { key: 'overhead', label: 'Overhead / Operational ($)', placeholder: 'e.g. 8000', step: '0.01' },
  { key: 'other', label: 'Other Costs ($)', placeholder: 'e.g. 3000', step: '0.01' },
];

// ---- State ----

const state = {
  teams: {},
};

// Initialize state for each team
TEAMS.forEach((team) => {
  state.teams[team.id] = {};
  VOLUME_FIELDS.forEach((field) => {
    state.teams[team.id][field.key] = 0;
  });
  COST_FIELDS.forEach((field) => {
    state.teams[team.id][field.key] = 0;
  });
});

// ---- Helpers ----

function formatCurrency(value) {
  if (!isFinite(value) || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  if (!isFinite(value) || isNaN(value)) return '0.0%';
  return (value * 100).toFixed(1) + '%';
}

function formatNumber(value) {
  if (!isFinite(value) || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

function parseNumericInput(value) {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getTeamTotal(teamId) {
  const t = state.teams[teamId];
  const salaryCost = (t.headcount || 0) * (t.avgSalary || 0);
  const tools = t.toolsCost || 0;
  const overhead = t.overhead || 0;
  const other = t.other || 0;
  return salaryCost + tools + overhead + other;
}

function getGrandTotal() {
  return TEAMS.reduce((sum, team) => sum + getTeamTotal(team.id), 0);
}

function getTotalProjects() {
  return TEAMS.reduce((sum, team) => sum + (state.teams[team.id].numProjects || 0), 0);
}

function getTotalResponses() {
  return TEAMS.reduce((sum, team) => sum + (state.teams[team.id].numResponses || 0), 0);
}

// ---- Render Team Cards ----

function renderTeamCards() {
  const grid = document.getElementById('teamsGrid');
  grid.innerHTML = '';

  TEAMS.forEach((team) => {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.setAttribute('data-team', team.id);

    // Volume fields (top of card)
    let volumeHTML = '';
    VOLUME_FIELDS.forEach((field) => {
      volumeHTML += `
        <div class="input-row">
          <label for="${team.id}_${field.key}">${field.label}</label>
          <input
            type="number"
            id="${team.id}_${field.key}"
            data-team="${team.id}"
            data-field="${field.key}"
            min="0"
            step="${field.step}"
            placeholder="${field.placeholder}"
            value=""
          >
        </div>`;
    });

    // Cost fields (below divider)
    let costHTML = '';
    COST_FIELDS.forEach((field) => {
      costHTML += `
        <div class="input-row">
          <label for="${team.id}_${field.key}">${field.label}</label>
          <input
            type="number"
            id="${team.id}_${field.key}"
            data-team="${team.id}"
            data-field="${field.key}"
            min="0"
            step="${field.step}"
            placeholder="${field.placeholder}"
            value=""
          >
        </div>`;
    });

    card.innerHTML = `
      <h3>${team.name}</h3>
      ${volumeHTML}
      <div class="volume-divider"></div>
      ${costHTML}
      <div class="team-footer">
        <div class="team-footer-row team-footer-total">
          <span class="team-footer-label">Team Total</span>
          <span class="team-footer-value" id="total_${team.id}">$0.00</span>
        </div>
        <div class="team-footer-row">
          <span class="team-footer-label">Cost / Project</span>
          <span class="team-footer-value" id="cpp_${team.id}">$0.00</span>
        </div>
        <div class="team-footer-row">
          <span class="team-footer-label">Cost / Response Group</span>
          <span class="team-footer-value" id="cpr_${team.id}">$0.00</span>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Attach input listeners
  grid.querySelectorAll('input[data-team]').forEach((input) => {
    input.addEventListener('input', handleTeamInput);
  });
}

// ---- Event Handlers ----

function handleTeamInput(e) {
  const { team, field } = e.target.dataset;
  state.teams[team][field] = parseNumericInput(e.target.value);
  recalculate();
}

// ---- Recalculate Everything ----

function recalculate() {
  const grandTotal = getGrandTotal();
  const totalProjects = getTotalProjects();
  const totalResponses = getTotalResponses();
  const overallCostPerProject = totalProjects > 0 ? grandTotal / totalProjects : 0;
  const overallCostPerResponse = totalResponses > 0 ? grandTotal / totalResponses : 0;

  // Update top-level results
  document.getElementById('totalCost').textContent = formatCurrency(grandTotal);
  document.getElementById('costPerProject').textContent = formatCurrency(overallCostPerProject);
  document.getElementById('costPerResponse').textContent = formatCurrency(overallCostPerResponse);

  // Update each team card footer
  TEAMS.forEach((team) => {
    const teamCost = getTeamTotal(team.id);
    const teamProjects = state.teams[team.id].numProjects || 0;
    const teamResponses = state.teams[team.id].numResponses || 0;

    const totalEl = document.getElementById(`total_${team.id}`);
    const cppEl = document.getElementById(`cpp_${team.id}`);
    const cprEl = document.getElementById(`cpr_${team.id}`);

    if (totalEl) totalEl.textContent = formatCurrency(teamCost);
    if (cppEl) cppEl.textContent = teamProjects > 0 ? formatCurrency(teamCost / teamProjects) : '$0.00';
    if (cprEl) cprEl.textContent = teamResponses > 0 ? formatCurrency(teamCost / teamResponses) : '$0.00';
  });

  // Update breakdown table
  renderBreakdownTable(grandTotal, totalProjects, totalResponses);

  // Update chart
  renderChart(grandTotal);
}

// ---- Breakdown Table ----

function renderBreakdownTable(grandTotal, totalProjects, totalResponses) {
  const tbody = document.getElementById('breakdownBody');
  tbody.innerHTML = '';

  TEAMS.forEach((team) => {
    const teamCost = getTeamTotal(team.id);
    const teamProjects = state.teams[team.id].numProjects || 0;
    const teamResponses = state.teams[team.id].numResponses || 0;
    const pct = grandTotal > 0 ? teamCost / grandTotal : 0;
    const perProject = teamProjects > 0 ? teamCost / teamProjects : 0;
    const perResponse = teamResponses > 0 ? teamCost / teamResponses : 0;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${team.name}</strong></td>
      <td>${formatCurrency(teamCost)}</td>
      <td>${formatPercent(pct)}</td>
      <td>${formatNumber(teamProjects)}</td>
      <td>${formatCurrency(perProject)}</td>
      <td>${formatNumber(teamResponses)}</td>
      <td>${formatCurrency(perResponse)}</td>
    `;
    tbody.appendChild(row);
  });

  // Totals row
  const overallCostPerProject = totalProjects > 0 ? grandTotal / totalProjects : 0;
  const overallCostPerResponse = totalResponses > 0 ? grandTotal / totalResponses : 0;
  const totalsRow = document.createElement('tr');
  totalsRow.innerHTML = `
    <td><strong>Total</strong></td>
    <td><strong>${formatCurrency(grandTotal)}</strong></td>
    <td><strong>100.0%</strong></td>
    <td><strong>${formatNumber(totalProjects)}</strong></td>
    <td><strong>${formatCurrency(overallCostPerProject)}</strong></td>
    <td><strong>${formatNumber(totalResponses)}</strong></td>
    <td><strong>${formatCurrency(overallCostPerResponse)}</strong></td>
  `;
  totalsRow.style.borderTop = '2px solid var(--color-border)';
  tbody.appendChild(totalsRow);
}

// ---- Bar Chart ----

function renderChart(grandTotal) {
  const container = document.getElementById('chartContainer');
  container.innerHTML = '';

  const maxCost = Math.max(...TEAMS.map((t) => getTeamTotal(t.id)), 1);

  TEAMS.forEach((team) => {
    const teamCost = getTeamTotal(team.id);
    const widthPct = maxCost > 0 ? (teamCost / maxCost) * 100 : 0;

    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    row.innerHTML = `
      <div class="chart-bar-label">${team.name}</div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width: ${Math.max(widthPct, 0)}%">
          <span>${formatCurrency(teamCost)}</span>
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

// ---- Export Functions ----

function exportCSV() {
  const grandTotal = getGrandTotal();
  const totalProjects = getTotalProjects();
  const totalResponses = getTotalResponses();

  let csv = 'Team,Team Cost,% of Total,Projects,Cost per Project,Response Groups,Cost per Response Group\n';

  TEAMS.forEach((team) => {
    const teamCost = getTeamTotal(team.id);
    const teamProjects = state.teams[team.id].numProjects || 0;
    const teamResponses = state.teams[team.id].numResponses || 0;
    const pct = grandTotal > 0 ? ((teamCost / grandTotal) * 100).toFixed(1) + '%' : '0.0%';
    const perProject = teamProjects > 0 ? (teamCost / teamProjects).toFixed(2) : '0.00';
    const perResponse = teamResponses > 0 ? (teamCost / teamResponses).toFixed(2) : '0.00';
    csv += `"${team.name}",${teamCost.toFixed(2)},${pct},${teamProjects},${perProject},${teamResponses},${perResponse}\n`;
  });

  const overallCostPerProject = totalProjects > 0 ? (grandTotal / totalProjects).toFixed(2) : '0.00';
  const overallCostPerResponse = totalResponses > 0 ? (grandTotal / totalResponses).toFixed(2) : '0.00';
  csv += `"Total",${grandTotal.toFixed(2)},100.0%,${totalProjects},${overallCostPerProject},${totalResponses},${overallCostPerResponse}\n`;

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cost_unit_economics.csv';
  a.click();
  URL.revokeObjectURL(url);

  showToast('CSV exported successfully');
}

function copySummary() {
  const grandTotal = getGrandTotal();
  const totalProjects = getTotalProjects();
  const totalResponses = getTotalResponses();
  const overallCostPerProject = totalProjects > 0 ? grandTotal / totalProjects : 0;
  const overallCostPerResponse = totalResponses > 0 ? grandTotal / totalResponses : 0;

  let summary = `Cost Unit Economics Summary\n`;
  summary += `===========================\n\n`;
  summary += `Total Cost: ${formatCurrency(grandTotal)}\n`;
  summary += `Total Projects: ${formatNumber(totalProjects)}\n`;
  summary += `Total Response Groups: ${formatNumber(totalResponses)}\n\n`;
  summary += `Overall Cost per Project: ${formatCurrency(overallCostPerProject)}\n`;
  summary += `Overall Cost per Response Group: ${formatCurrency(overallCostPerResponse)}\n\n`;
  summary += `Per-Team Breakdown:\n`;
  summary += `-------------------\n`;

  TEAMS.forEach((team) => {
    const teamCost = getTeamTotal(team.id);
    const teamProjects = state.teams[team.id].numProjects || 0;
    const teamResponses = state.teams[team.id].numResponses || 0;
    const pct = grandTotal > 0 ? formatPercent(teamCost / grandTotal) : '0.0%';
    const perProject = teamProjects > 0 ? formatCurrency(teamCost / teamProjects) : '$0.00';
    const perResponse = teamResponses > 0 ? formatCurrency(teamCost / teamResponses) : '$0.00';
    summary += `\n${team.name}: ${formatCurrency(teamCost)} (${pct})\n`;
    summary += `  Projects: ${formatNumber(teamProjects)} | Cost/Project: ${perProject}\n`;
    summary += `  Response Groups: ${formatNumber(teamResponses)} | Cost/Response Group: ${perResponse}\n`;
  });

  navigator.clipboard.writeText(summary).then(() => {
    showToast('Summary copied to clipboard');
  }).catch(() => {
    showToast('Failed to copy — try again');
  });
}

// ---- Toast ----

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ---- Bills API ----

async function apiFetch(path, options = {}) {
  const token = getAuthToken();
  if (!token) {
    clearStoredUser();
    currentUser = null;
    showLogin();
    return { ok: false, status: 401 };
  }
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      ...(options.body && typeof options.body === 'string' && !options.headers?.['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) {
    clearStoredUser();
    currentUser = null;
    showLogin();
    return { ok: false, status: 401 };
  }
  return res;
}

let billsInitialized = false;
let expensesList = [];

async function loadExpenses() {
  const status = document.getElementById('billsFilterStatus').value || '';
  const category = document.getElementById('billsFilterCategory').value.trim() || '';
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  const res = await apiFetch(`/api/expenses?${params}`);
  if (!res.ok) return;
  expensesList = await res.json();
  renderBillsTable();
}

function renderBillsTable() {
  const tbody = document.getElementById('billsTableBody');
  const emptyEl = document.getElementById('billsEmpty');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (expensesList.length === 0) {
    emptyEl.classList.remove('app-hidden');
    return;
  }
  emptyEl.classList.add('app-hidden');
  expensesList.forEach((e) => {
    const tr = document.createElement('tr');
    const amount = (e.amount_cents / 100).toFixed(2);
    const dateStr = e.date ? new Date(e.date).toLocaleDateString() : '—';
    tr.innerHTML = `
      <td>${escapeHtml(e.vendor)}</td>
      <td>$${amount}</td>
      <td>${dateStr}</td>
      <td>${escapeHtml(e.status)}</td>
      <td>${escapeHtml(e.category || '—')}</td>
      <td>${e.internal_bill_url ? `<a href="${escapeAttr(e.internal_bill_url)}" target="_blank" rel="noopener">View</a>` : '—'}</td>
      <td>${e.third_party_invoice_url ? `<a href="${escapeAttr(e.third_party_invoice_url)}" target="_blank" rel="noopener">View</a>` : '—'}</td>
      <td>
        <button type="button" class="btn btn-small btn-edit" data-id="${escapeAttr(e.id)}">Edit</button>
        <button type="button" class="btn btn-small btn-delete" data-id="${escapeAttr(e.id)}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => openExpenseModal(btn.dataset.id)));
  tbody.querySelectorAll('.btn-delete').forEach((btn) => btn.addEventListener('click', () => deleteExpenseById(btn.dataset.id)));
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function openExpenseModal(editId = null) {
  const modal = document.getElementById('expenseModal');
  const form = document.getElementById('expenseForm');
  const title = document.getElementById('expenseModalTitle');
  form.reset();
  document.getElementById('expenseId').value = editId || '';
  document.getElementById('expenseInternalBill').value = '';
  document.getElementById('expenseThirdPartyInvoice').value = '';
  document.getElementById('expenseInternalBillLabel').textContent = 'Choose file or attach later';
  document.getElementById('expenseThirdPartyInvoiceLabel').textContent = 'Choose file or attach later';
  document.getElementById('expenseInternalBillLink').classList.add('app-hidden');
  document.getElementById('expenseThirdPartyInvoiceLink').classList.add('app-hidden');
  if (editId) {
    const e = expensesList.find((x) => x.id === editId);
    if (e) {
      title.textContent = 'Edit expense';
      document.getElementById('expenseVendor').value = e.vendor;
      document.getElementById('expenseAmount').value = (e.amount_cents / 100).toFixed(2);
      document.getElementById('expenseDate').value = e.date ? e.date.slice(0, 10) : '';
      document.getElementById('expenseStatus').value = e.status;
      document.getElementById('expenseCategory').value = e.category || '';
      document.getElementById('expenseNotes').value = e.notes || '';
      if (e.internal_bill_url) {
        document.getElementById('expenseInternalBillLink').href = e.internal_bill_url;
        document.getElementById('expenseInternalBillLink').classList.remove('app-hidden');
      }
      if (e.third_party_invoice_url) {
        document.getElementById('expenseThirdPartyInvoiceLink').href = e.third_party_invoice_url;
        document.getElementById('expenseThirdPartyInvoiceLink').classList.remove('app-hidden');
      }
    }
  } else {
    title.textContent = 'Add expense';
    document.getElementById('expenseDate').value = new Date().toISOString().slice(0, 10);
  }
  modal.classList.remove('app-hidden');
}

function closeExpenseModal() {
  document.getElementById('expenseModal').classList.add('app-hidden');
}

async function uploadFile(fileInput) {
  if (!fileInput.files || !fileInput.files[0]) return null;
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (res.status === 401) {
    clearStoredUser();
    currentUser = null;
    showLogin();
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json();
  return data.url || null;
}

async function saveExpenseForm(e) {
  e.preventDefault();
  const id = document.getElementById('expenseId').value;
  const vendor = document.getElementById('expenseVendor').value.trim();
  const amount = parseFloat(document.getElementById('expenseAmount').value);
  const date = document.getElementById('expenseDate').value;
  const status = document.getElementById('expenseStatus').value;
  const category = document.getElementById('expenseCategory').value.trim();
  const notes = document.getElementById('expenseNotes').value.trim();
  const amount_cents = Math.round(amount * 100);
  let internal_bill_url = null;
  let third_party_invoice_url = null;
  const internalInput = document.getElementById('expenseInternalBill');
  const thirdInput = document.getElementById('expenseThirdPartyInvoice');
  if (internalInput.files && internalInput.files[0]) {
    internal_bill_url = await uploadFile(internalInput);
    if (!internal_bill_url) showToast('Failed to upload internal bill');
  } else if (id) {
    const existing = expensesList.find((x) => x.id === id);
    if (existing) internal_bill_url = existing.internal_bill_url;
  }
  if (thirdInput.files && thirdInput.files[0]) {
    third_party_invoice_url = await uploadFile(thirdInput);
    if (!third_party_invoice_url) showToast('Failed to upload 3rd party invoice');
  } else if (id) {
    const existing = expensesList.find((x) => x.id === id);
    if (existing) third_party_invoice_url = existing.third_party_invoice_url;
  }
  const payload = { vendor, amount_cents, date, status, category: category || null, notes: notes || null };
  if (internal_bill_url !== null) payload.internal_bill_url = internal_bill_url;
  if (third_party_invoice_url !== null) payload.third_party_invoice_url = third_party_invoice_url;
  if (id) {
    const res = await apiFetch(`/api/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    if (!res.ok) { showToast('Failed to update'); return; }
    showToast('Updated');
  } else {
    const res = await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) { showToast('Failed to add'); return; }
    showToast('Added');
  }
  closeExpenseModal();
  loadExpenses();
}

async function deleteExpenseById(id) {
  if (!confirm('Delete this expense?')) return;
  const res = await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
  if (!res.ok) { showToast('Failed to delete'); return; }
  showToast('Deleted');
  loadExpenses();
}

function initBillsOnce() {
  if (billsInitialized) return;
  billsInitialized = true;
  document.getElementById('billsAddBtn').addEventListener('click', () => openExpenseModal());
  document.getElementById('billsFilterStatus').addEventListener('change', loadExpenses);
  document.getElementById('billsFilterCategory').addEventListener('input', () => { clearTimeout(window._billsFilterTimeout); window._billsFilterTimeout = setTimeout(loadExpenses, 300); });
  document.getElementById('expenseModalCancel').addEventListener('click', closeExpenseModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeExpenseModal);
  document.getElementById('expenseForm').addEventListener('submit', saveExpenseForm);
  document.getElementById('expenseInternalBill').addEventListener('change', function () {
    document.getElementById('expenseInternalBillLabel').textContent = this.files && this.files[0] ? this.files[0].name : 'Choose file or attach later';
  });
  document.getElementById('expenseThirdPartyInvoice').addEventListener('change', function () {
    document.getElementById('expenseThirdPartyInvoiceLabel').textContent = this.files && this.files[0] ? this.files[0].name : 'Choose file or attach later';
  });
  loadExpenses();
}

// ---- Initialize ----

function initCalculator() {
  renderTeamCards();
  recalculate();

  // Export buttons
  document.getElementById('exportCsv').addEventListener('click', exportCSV);
  document.getElementById('copyClipboard').addEventListener('click', copySummary);
}

document.addEventListener('DOMContentLoaded', authInit);
