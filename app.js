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
  const subtitle = document.querySelector('.login-subtitle');
  if (subtitle) subtitle.textContent = 'Sign in with your Google account to continue';
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
  void initCalculator();
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

async function handleSignOut() {
  await flushTeamCostsToServer();
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
  { key: 'totalSalary', label: 'Payroll COGS ($)', placeholder: 'e.g. 475000', step: '0.01' },
];

const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getCurrentMonthString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ---- State ----

const state = {
  unitEconomics: {
    currentMonth: getCurrentMonthString(),
    currentYear: new Date().getFullYear(),
    months: {},
    teamPeriods: {},
    sectionsExpanded: {},
  },
};

function getDefaultTeamMonthData() {
  const data = { lineItems: [] };
  VOLUME_FIELDS.forEach((f) => { data[f.key] = 0; });
  COST_FIELDS.forEach((f) => { data[f.key] = 0; });
  return data;
}

function ensureMonthData(month) {
  if (!state.unitEconomics.months[month]) {
    state.unitEconomics.months[month] = {};
  }
  TEAMS.forEach((team) => {
    let t = state.unitEconomics.months[month][team.id];
    if (!t || typeof t !== 'object') {
      state.unitEconomics.months[month][team.id] = { ...getDefaultTeamMonthData(), lineItems: [] };
      t = state.unitEconomics.months[month][team.id];
    }
    if (!Array.isArray(t.lineItems)) t.lineItems = [];
    if (t.avgSalary != null && (t.totalSalary == null || t.totalSalary === 0)) {
      t.totalSalary = (t.headcount || 0) * (t.avgSalary || 0);
    }
  });
  return state.unitEconomics.months[month];
}

function getMonthData(teamId) {
  const month = state.unitEconomics.currentMonth;
  ensureMonthData(month);
  return state.unitEconomics.months[month][teamId] || getDefaultTeamMonthData();
}

function getYearMonthKeys(year) {
  const y = year || state.unitEconomics.currentYear;
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
}

function ensureYearMonths(year) {
  getYearMonthKeys(year).forEach((ym) => ensureMonthData(ym));
}

function getMonthDataFor(teamId, ym) {
  ensureMonthData(ym);
  return state.unitEconomics.months[ym][teamId] || getDefaultTeamMonthData();
}

/** Reset client state to defaults (used before applying server payload or on failed load). */
function resetUnitEconomicsState() {
  state.unitEconomics = {
    currentMonth: getCurrentMonthString(),
    currentYear: new Date().getFullYear(),
    months: {},
    teamPeriods: {},
    sectionsExpanded: {},
  };
}

/** Apply a persisted unitEconomics object from the server (same shape as state.unitEconomics). */
function applyUnitEconomicsPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return;
  if (parsed.currentMonth) state.unitEconomics.currentMonth = parsed.currentMonth;
  if (parsed.currentYear != null) state.unitEconomics.currentYear = Number(parsed.currentYear) || new Date().getFullYear();
  if (parsed.months && typeof parsed.months === 'object') {
    state.unitEconomics.months = parsed.months;
    Object.keys(state.unitEconomics.months).forEach((m) => ensureMonthData(m));
  }
  if (parsed.sectionsExpanded && typeof parsed.sectionsExpanded === 'object') {
    state.unitEconomics.sectionsExpanded = parsed.sectionsExpanded;
  }
  if (parsed.teamPeriods && typeof parsed.teamPeriods === 'object') {
    state.unitEconomics.teamPeriods = parsed.teamPeriods;
  } else {
    const year = state.unitEconomics.currentYear;
    const fallbackKeys = getYearMonthKeys(year);
    TEAMS.forEach((team) => {
      const existing = [];
      Object.keys(state.unitEconomics.months || {}).forEach((ym) => {
        const t = state.unitEconomics.months[ym] && state.unitEconomics.months[ym][team.id];
        if (t && typeof t === 'object') existing.push(ym);
      });
      state.unitEconomics.teamPeriods[team.id] = existing.length > 0 ? [...new Set(existing)].sort() : [...fallbackKeys];
    });
  }
}

let teamCostsSaveTimer = null;
let teamCostsDirty = false;
const TEAM_COSTS_SAVE_DEBOUNCE_MS = 800;

function schedulePersistTeamCosts() {
  teamCostsDirty = true;
  if (teamCostsSaveTimer) clearTimeout(teamCostsSaveTimer);
  teamCostsSaveTimer = setTimeout(() => {
    teamCostsSaveTimer = null;
    flushTeamCostsToServer();
  }, TEAM_COSTS_SAVE_DEBOUNCE_MS);
}

/** Persists Team Costs to Firestore via API (debounced). */
function saveUnitEconomicsToStorage() {
  schedulePersistTeamCosts();
}

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

function formatDelta(current, previous) {
  if (previous == null || previous === 0 || !isFinite(current) || !isFinite(previous)) return '';
  const pctChange = ((current - previous) / previous) * 100;
  const arrow = pctChange > 0 ? '\u2191' : pctChange < 0 ? '\u2193' : '\u2192';
  const cls = pctChange > 0 ? 'delta-up' : pctChange < 0 ? 'delta-down' : 'delta-flat';
  return ` <span class="delta ${cls}">${arrow} ${Math.abs(pctChange).toFixed(1)}%</span>`;
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

function handleNumericInputFocus(e) {
  if (!e.target.matches('input[type="number"]')) return;
  const el = e.target;
  if (el.value !== '' && Number(el.value) === 0) el.value = '';
}

function handleNumericInputBlur(e) {
  if (!e.target.matches('input[type="number"]')) return;
  const el = e.target;
  if (el.value === '' || String(el.value).trim() === '') {
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function initNumericInputClearOnFocus() {
  document.addEventListener('focus', handleNumericInputFocus, true);
  document.addEventListener('blur', handleNumericInputBlur, true);
}

function getTeamTotal(teamId) {
  const t = getMonthData(teamId);
  const salaryCost = Number(t.totalSalary) || 0;
  const lineTotal = (t.lineItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return salaryCost + lineTotal;
}

function getTeamTotalForMonth(teamId, ym) {
  const t = getMonthDataFor(teamId, ym);
  const salaryCost = Number(t.totalSalary) || 0;
  const lineTotal = (t.lineItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return salaryCost + lineTotal;
}

function getTeamTotalForPeriod(teamId, ym) {
  return getTeamTotalForMonth(teamId, ym);
}

function getTeamPeriods(teamId) {
  const raw = state.unitEconomics.teamPeriods && state.unitEconomics.teamPeriods[teamId]
    ? state.unitEconomics.teamPeriods[teamId]
    : [];
  return [...raw].sort();
}

function getTeamAllPeriodsTotal(teamId) {
  return getTeamPeriods(teamId).reduce((sum, ym) => sum + getTeamTotalForPeriod(teamId, ym), 0);
}

function getTeamAllPeriodsProjects(teamId) {
  return getTeamPeriods(teamId).reduce((sum, ym) => sum + (getMonthDataFor(teamId, ym).numProjects || 0), 0);
}

function getTeamAllPeriodsResponses(teamId) {
  return getTeamPeriods(teamId).reduce((sum, ym) => sum + (getMonthDataFor(teamId, ym).numResponses || 0), 0);
}

function getTeamAllPeriodsHeadcount(teamId) {
  return getTeamPeriods(teamId).reduce((sum, ym) => sum + (getMonthDataFor(teamId, ym).headcount || 0), 0);
}

function getTotalHeadcountAllPeriods() {
  return TEAMS.reduce((sum, t) => sum + getTeamAllPeriodsHeadcount(t.id), 0);
}

function getGrandTotalAllPeriods() {
  return TEAMS.reduce((sum, team) => sum + getTeamAllPeriodsTotal(team.id), 0);
}

function getTotalProjectsAllPeriods() {
  return TEAMS.reduce((sum, team) => sum + getTeamAllPeriodsProjects(team.id), 0);
}

function getTotalResponsesAllPeriods() {
  return TEAMS.reduce((sum, team) => sum + getTeamAllPeriodsResponses(team.id), 0);
}

function getGrandTotal() {
  return TEAMS.reduce((sum, team) => sum + getTeamTotal(team.id), 0);
}

function getTotalProjects() {
  return TEAMS.reduce((sum, team) => sum + (getMonthData(team.id).numProjects || 0), 0);
}

function getTotalResponses() {
  return TEAMS.reduce((sum, team) => sum + (getMonthData(team.id).numResponses || 0), 0);
}

function getTeamYearTotal(teamId) {
  return getTeamAllPeriodsTotal(teamId);
}

function getTeamYearProjects(teamId) {
  return getTeamAllPeriodsProjects(teamId);
}

function getTeamYearResponses(teamId) {
  return getTeamAllPeriodsResponses(teamId);
}

function getYearGrandTotal() {
  return getGrandTotalAllPeriods();
}

function getYearTotalProjects() {
  return getTotalProjectsAllPeriods();
}

function getYearTotalResponses() {
  return getTotalResponsesAllPeriods();
}

// ---- Render Team Cards ----

function getLineItemsTotal(teamId, ym) {
  const t = getMonthDataFor(teamId, ym);
  return (t.lineItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function getPeriodLabel(ym) {
  const [y, m] = (ym || '').split('-');
  const monthLabel = m ? (MONTH_LABELS[parseInt(m, 10) - 1] || m) : ym;
  return y && monthLabel ? `${monthLabel} ${y}` : ym || '';
}

function renderInlineLineItems(teamId, ym) {
  const items = getMonthDataFor(teamId, ym).lineItems || [];
  const list = items.map((item) => {
    const label = typeof item.label === 'string' ? item.label.replace(/"/g, '&quot;') : '';
    const amount = Number(item.amount) || 0;
    return `<li class="line-item-row ue-inline-line-item" data-team="${teamId}" data-month="${ym}" data-line-id="${item.id}">
      <input type="text" class="line-item-label" value="${label}" placeholder="Label" data-team="${teamId}" data-month="${ym}" data-line-id="${item.id}">
      <input type="number" class="line-item-amount" value="${amount}" min="0" step="0.01" placeholder="0" data-team="${teamId}" data-month="${ym}" data-line-id="${item.id}">
      <button type="button" class="btn btn-small btn-compact btn-delete line-item-remove" data-team="${teamId}" data-month="${ym}" data-line-id="${item.id}" aria-label="Remove">Remove</button>
    </li>`;
  }).join('');
  return `<ul class="line-items-list ue-inline-line-items" data-team="${teamId}" data-month="${ym}">${list}</ul>
    <button type="button" class="btn btn-small btn-compact btn-secondary ue-add-line-item" data-team="${teamId}" data-month="${ym}">Add expense</button>`;
}

function renderUnitEconomicsGrid() {
  const container = document.getElementById('unitEconomicsTeamsContainer');
  if (!container) return;
  container.innerHTML = '';

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  TEAMS.forEach((team) => {
    const periods = getTeamPeriods(team.id);
    const section = document.createElement('div');
    section.className = 'ue-team-section ue-collapsible-section';
    section.setAttribute('data-team', team.id);
    const expanded = state.unitEconomics.sectionsExpanded[team.id] !== false;
    const sectionId = `ue-section-${team.id}`;
    const totalCost = getTeamAllPeriodsTotal(team.id);
    const totalProjects = getTeamAllPeriodsProjects(team.id);
    const summaryText = `${periods.length} period${periods.length !== 1 ? 's' : ''} · ${formatCurrency(totalCost)} total · ${formatNumber(totalProjects)} projects`;

    let rows = '';
    periods.forEach((ym) => {
      const data = getMonthDataFor(team.id, ym);
      const totalSalary = Number(data.totalSalary) || 0;
      const hc = Number(data.headcount) || 0;
      const avgPerPerson = hc > 0 ? totalSalary / hc : 0;
      const other = getLineItemsTotal(team.id, ym);
      const periodLabel = getPeriodLabel(ym);
      const projVal = data.numProjects !== undefined && data.numProjects !== '' ? Number(data.numProjects) : '';
      const respVal = data.numResponses !== undefined && data.numResponses !== '' ? Number(data.numResponses) : '';
      const hcVal = data.headcount !== undefined && data.headcount !== '' ? Number(data.headcount) : '';
      const salVal = data.totalSalary !== undefined && data.totalSalary !== '' ? Number(data.totalSalary) : '';
      const idBase = `ue-${team.id}-${ym.replace(/[^a-zA-Z0-9]/g, '')}`;
      rows += `
        <div class="ue-month-card" data-ym="${ym}">
          <div class="ue-month-card-header">
            <span class="ue-month-card-title">${escapeHtml(periodLabel)}</span>
            <button type="button" class="btn btn-row-action btn-delete ue-remove-period" data-team="${team.id}" data-month="${ym}" aria-label="Remove period">Remove</button>
          </div>
          <div class="ue-month-card-fields">
            <div class="ue-field">
              <label for="${idBase}-proj">Projects</label>
              <input id="${idBase}-proj" type="number" data-team="${team.id}" data-month="${ym}" data-field="numProjects" min="0" step="1" placeholder="0" value="${projVal}">
            </div>
            <div class="ue-field">
              <label for="${idBase}-resp">Response Groups</label>
              <input id="${idBase}-resp" type="number" data-team="${team.id}" data-month="${ym}" data-field="numResponses" min="0" step="1" placeholder="0" value="${respVal}">
            </div>
            <div class="ue-field">
              <label for="${idBase}-hc">Headcount</label>
              <input id="${idBase}-hc" type="number" data-team="${team.id}" data-month="${ym}" data-field="headcount" min="0" step="1" placeholder="0" value="${hcVal}">
            </div>
            <div class="ue-field">
              <label for="${idBase}-sal">Payroll COGS ($)</label>
              <input id="${idBase}-sal" type="number" data-team="${team.id}" data-month="${ym}" data-field="totalSalary" min="0" step="0.01" placeholder="0" value="${salVal}">
            </div>
            <div class="ue-field ue-field-readonly">
              <label>Avg per person</label>
              <span class="ue-field-value ue-avg-cell">${hc > 0 ? formatCurrency(avgPerPerson) : '—'}</span>
            </div>
            <div class="ue-field ue-field-readonly">
              <label>Other</label>
              <span class="ue-field-value ue-other-sum">${formatCurrency(other)}</span>
            </div>
          </div>
          <div class="ue-month-card-expenses">
            <div class="ue-expenses-block">
              <span class="line-items-title">Other expenses</span>
              ${renderInlineLineItems(team.id, ym)}
            </div>
          </div>
        </div>`;
    });

    section.innerHTML = `
      <div class="ue-section-header" role="region" aria-label="${team.name}">
        <button type="button" class="ue-section-toggle" aria-expanded="${expanded}" aria-controls="${sectionId}" data-team="${team.id}">
          <span class="ue-section-chevron" aria-hidden="true"></span>
          <span class="ue-section-title">${team.name}</span>
          <span class="ue-section-summary">${summaryText}</span>
        </button>
      </div>
      <div id="${sectionId}" class="ue-section-body" ${expanded ? '' : 'hidden'}>
        <div class="table-wrapper ue-team-periods">
          <div class="ue-month-cards-stack">
            ${rows}
          </div>
          <div class="ue-add-period-footer">
            <div class="ue-add-period-wrap">
              <label for="ue-month-${team.id}">Add period</label>
              <select id="ue-month-${team.id}" class="ue-period-month" data-team="${team.id}" aria-label="Month">
                ${MONTH_LABELS.map((name, i) => `<option value="${String(i + 1).padStart(2, '0')}">${name}</option>`).join('')}
              </select>
              <select class="ue-period-year" data-team="${team.id}" aria-label="Year">
                ${yearOptions.map((y) => `<option value="${y}"${y === currentYear ? ' selected' : ''}>${y}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-small btn-compact btn-secondary ue-add-period-btn" data-team="${team.id}">Add month</button>
            </div>
          </div>
        </div>
      </div>`;
    container.appendChild(section);
  });

  container.querySelectorAll('input[data-team][data-month][data-field]').forEach((input) => {
    input.addEventListener('input', handleGridInput);
  });
  container.querySelectorAll('.ue-add-period-btn').forEach((btn) => {
    btn.addEventListener('click', handleAddPeriod);
  });
  container.querySelectorAll('.ue-remove-period').forEach((btn) => {
    btn.addEventListener('click', handleRemovePeriod);
  });
  container.querySelectorAll('.ue-section-toggle').forEach((btn) => {
    btn.addEventListener('click', toggleSection);
  });
  container.querySelectorAll('.ue-add-line-item').forEach((btn) => {
    btn.addEventListener('click', handleAddLineItemInline);
  });
  container.querySelectorAll('.ue-inline-line-items').forEach((ul) => {
    ul.querySelectorAll('.line-item-label, .line-item-amount').forEach((input) => {
      input.addEventListener('change', handleLineItemChangeInline);
    });
    ul.querySelectorAll('.line-item-remove').forEach((b) => {
      b.addEventListener('click', handleRemoveLineItemInline);
    });
  });
}

function handleAddPeriod(e) {
  const teamId = e.target.dataset.team;
  const section = document.querySelector(`#unitEconomicsTeamsContainer [data-team="${teamId}"]`);
  const monthSelect = section && section.querySelector('.ue-period-month');
  const yearSelect = section && section.querySelector('.ue-period-year');
  if (!monthSelect || !yearSelect) return;
  const month = monthSelect.value;
  const year = yearSelect.value;
  const ym = `${year}-${month}`;
  if (!state.unitEconomics.teamPeriods[teamId]) state.unitEconomics.teamPeriods[teamId] = [];
  if (state.unitEconomics.teamPeriods[teamId].includes(ym)) return;
  state.unitEconomics.teamPeriods[teamId].push(ym);
  ensureMonthData(ym);
  saveUnitEconomicsToStorage();
  renderUnitEconomicsGrid();
  recalculate();
}

function handleRemovePeriod(e) {
  const { team: teamId, month: ym } = e.target.dataset;
  if (!teamId || !ym) return;
  const arr = state.unitEconomics.teamPeriods[teamId];
  if (!arr) return;
  const idx = arr.indexOf(ym);
  if (idx !== -1) {
    arr.splice(idx, 1);
    saveUnitEconomicsToStorage();
    renderUnitEconomicsGrid();
    recalculate();
  }
}

function toggleSection(e) {
  const teamId = e.currentTarget.dataset.team;
  const btn = e.currentTarget;
  const body = document.getElementById(`ue-section-${teamId}`);
  if (!body) return;
  const expanded = body.hidden;
  body.hidden = !expanded;
  btn.setAttribute('aria-expanded', String(!expanded));
  state.unitEconomics.sectionsExpanded[teamId] = expanded;
  saveUnitEconomicsToStorage();
}

function handleAddLineItemInline(e) {
  const { team: teamId, month: ym } = e.target.dataset;
  if (!teamId || !ym) return;
  ensureMonthData(ym);
  const list = state.unitEconomics.months[ym][teamId].lineItems;
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'li-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  list.push({ id, label: '', amount: 0 });
  saveUnitEconomicsToStorage();
  renderUnitEconomicsGrid();
  recalculate();
  const firstNew = document.querySelector(`.ue-inline-line-items[data-team="${teamId}"][data-month="${ym}"] .line-item-row[data-line-id="${id}"] .line-item-label`);
  if (firstNew) firstNew.focus();
}

function handleLineItemChangeInline(e) {
  const { team: teamId, month: ym, lineId } = e.target.dataset;
  if (!teamId || !ym) return;
  const list = state.unitEconomics.months[ym][teamId].lineItems;
  const item = list.find((x) => x.id === lineId);
  if (!item) return;
  if (e.target.classList.contains('line-item-label')) {
    item.label = e.target.value.trim();
  } else {
    item.amount = parseNumericInput(e.target.value);
  }
  saveUnitEconomicsToStorage();
  const card = e.target.closest('.ue-month-card');
  if (card) {
    const sumEl = card.querySelector('.ue-other-sum');
    if (sumEl) sumEl.textContent = formatCurrency(getLineItemsTotal(teamId, ym));
  }
  recalculate();
}

function handleRemoveLineItemInline(e) {
  const { team: teamId, month: ym, lineId } = e.target.dataset;
  if (!teamId || !ym) return;
  const list = state.unitEconomics.months[ym][teamId].lineItems;
  const idx = list.findIndex((x) => x.id === lineId);
  if (idx !== -1) {
    list.splice(idx, 1);
    saveUnitEconomicsToStorage();
    renderUnitEconomicsGrid();
    recalculate();
  }
}

// ---- Event Handlers ----

function handleTeamInput(e) {
  const { team, field } = e.target.dataset;
  const month = e.target.dataset.month || state.unitEconomics.currentMonth;
  ensureMonthData(month);
  state.unitEconomics.months[month][team][field] = parseNumericInput(e.target.value);
  saveUnitEconomicsToStorage();
  recalculate();
}

function handleGridInput(e) {
  const { team, month, field } = e.target.dataset;
  if (!team || !month || !field) return;
  ensureMonthData(month);
  state.unitEconomics.months[month][team][field] = parseNumericInput(e.target.value);
  saveUnitEconomicsToStorage();
  const card = e.target.closest('.ue-month-card');
  if (card) {
    const data = getMonthDataFor(team, month);
    const totalSalary = Number(data.totalSalary) || 0;
    const hc = Number(data.headcount) || 0;
    const avgCell = card.querySelector('.ue-avg-cell');
    if (avgCell) avgCell.textContent = hc > 0 ? formatCurrency(totalSalary / hc) : '—';
  }
  recalculate();
}

// ---- Recalculate Everything ----

function recalculate() {
  const grandTotal = getYearGrandTotal();
  const totalProjects = getYearTotalProjects();
  const totalResponses = getYearTotalResponses();
  const totalHeadcount = getTotalHeadcountAllPeriods();
  const overallCostPerProject = totalProjects > 0 ? grandTotal / totalProjects : 0;
  const overallCostPerResponse = totalResponses > 0 ? grandTotal / totalResponses : 0;
  const overallCostPerHeadcount = totalHeadcount > 0 ? grandTotal / totalHeadcount : 0;

  document.getElementById('totalCost').textContent = formatCurrency(grandTotal);
  document.getElementById('costPerProject').textContent = formatCurrency(overallCostPerProject);
  document.getElementById('costPerResponse').textContent = formatCurrency(overallCostPerResponse);
  const costPerHcEl = document.getElementById('costPerHeadcount');
  if (costPerHcEl) costPerHcEl.textContent = formatCurrency(overallCostPerHeadcount);

  renderResultsByTeam();
  renderBreakdownTable(grandTotal, totalProjects, totalResponses);
  renderTrendCharts();
}

// ---- Results by Team (dashboard summary) ----

function renderResultsByTeam() {
  const tbody = document.getElementById('resultsByTeamBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  TEAMS.forEach((team) => {
    const teamCost = getTeamYearTotal(team.id);
    const teamProjects = getTeamYearProjects(team.id);
    const teamResponses = getTeamYearResponses(team.id);
    const teamHeadcount = getTeamAllPeriodsHeadcount(team.id);
    const perProject = teamProjects > 0 ? teamCost / teamProjects : 0;
    const perResponse = teamResponses > 0 ? teamCost / teamResponses : 0;
    const perHeadcount = teamHeadcount > 0 ? teamCost / teamHeadcount : 0;

    const periods = getTeamPeriods(team.id);
    let deltaProject = '';
    let deltaResponse = '';
    if (periods.length >= 2) {
      const prev = periods[periods.length - 2];
      const curr = periods[periods.length - 1];
      const costPrev = getTeamTotalForPeriod(team.id, prev);
      const costCurr = getTeamTotalForPeriod(team.id, curr);
      const projPrev = getMonthDataFor(team.id, prev).numProjects || 0;
      const projCurr = getMonthDataFor(team.id, curr).numProjects || 0;
      const respPrev = getMonthDataFor(team.id, prev).numResponses || 0;
      const respCurr = getMonthDataFor(team.id, curr).numResponses || 0;
      const perProjPrev = projPrev > 0 ? costPrev / projPrev : 0;
      const perProjCurr = projCurr > 0 ? costCurr / projCurr : 0;
      const perRespPrev = respPrev > 0 ? costPrev / respPrev : 0;
      const perRespCurr = respCurr > 0 ? costCurr / respCurr : 0;
      deltaProject = formatDelta(perProjCurr, perProjPrev);
      deltaResponse = formatDelta(perRespCurr, perRespPrev);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(team.name)}</strong></td>
      <td>${formatCurrency(teamCost)}</td>
      <td>${formatCurrency(perProject)}${deltaProject}</td>
      <td>${formatCurrency(perResponse)}${deltaResponse}</td>
      <td>${formatCurrency(perHeadcount)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---- Breakdown Table ----

function getPeriodGrandTotal(ym) {
  return TEAMS.reduce((sum, t) => sum + getTeamTotalForPeriod(t.id, ym), 0);
}

function renderBreakdownTable(grandTotal, totalProjects, totalResponses) {
  const tbody = document.getElementById('breakdownBody');
  tbody.innerHTML = '';

  TEAMS.forEach((team) => {
    const teamCost = getTeamYearTotal(team.id);
    const teamProjects = getTeamYearProjects(team.id);
    const teamResponses = getTeamYearResponses(team.id);
    const pct = grandTotal > 0 ? teamCost / grandTotal : 0;
    const perProject = teamProjects > 0 ? teamCost / teamProjects : 0;
    const perResponse = teamResponses > 0 ? teamCost / teamResponses : 0;
    const expandedKey = `breakdown_${team.id}`;
    const expanded = state.unitEconomics.sectionsExpanded[expandedKey] === true;
    const periods = getTeamPeriods(team.id);

    const teamRow = document.createElement('tr');
    teamRow.className = 'breakdown-team-row';
    teamRow.setAttribute('data-team', team.id);
    teamRow.setAttribute('role', 'button');
    teamRow.setAttribute('tabindex', '0');
    teamRow.setAttribute('aria-expanded', String(expanded));
    teamRow.innerHTML = `
      <td><span class="breakdown-toggle" aria-hidden="true">${expanded ? 'v' : '>'}</span> <strong>${escapeHtml(team.name)}</strong></td>
      <td>${formatCurrency(teamCost)}</td>
      <td>${formatPercent(pct)}</td>
      <td>${formatNumber(teamProjects)}</td>
      <td>${formatCurrency(perProject)}</td>
      <td>${formatNumber(teamResponses)}</td>
      <td>${formatCurrency(perResponse)}</td>
    `;
    teamRow.addEventListener('click', () => {
      state.unitEconomics.sectionsExpanded[expandedKey] = !state.unitEconomics.sectionsExpanded[expandedKey];
      saveUnitEconomicsToStorage();
      renderBreakdownTable(getYearGrandTotal(), getYearTotalProjects(), getYearTotalResponses());
    });
    teamRow.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        teamRow.click();
      }
    });
    tbody.appendChild(teamRow);

    periods.forEach((ym, idx) => {
      const periodCost = getTeamTotalForPeriod(team.id, ym);
      const periodProjects = getMonthDataFor(team.id, ym).numProjects || 0;
      const periodResponses = getMonthDataFor(team.id, ym).numResponses || 0;
      const periodGrandTotal = getPeriodGrandTotal(ym);
      const periodPct = periodGrandTotal > 0 ? periodCost / periodGrandTotal : 0;
      const periodPerProject = periodProjects > 0 ? periodCost / periodProjects : 0;
      const periodPerResponse = periodResponses > 0 ? periodCost / periodResponses : 0;

      let deltaProject = '';
      let deltaResponse = '';
      if (idx > 0) {
        const prevYm = periods[idx - 1];
        const costPrev = getTeamTotalForPeriod(team.id, prevYm);
        const projPrev = getMonthDataFor(team.id, prevYm).numProjects || 0;
        const respPrev = getMonthDataFor(team.id, prevYm).numResponses || 0;
        const perProjPrev = projPrev > 0 ? costPrev / projPrev : 0;
        const perRespPrev = respPrev > 0 ? costPrev / respPrev : 0;
        deltaProject = formatDelta(periodPerProject, perProjPrev);
        deltaResponse = formatDelta(periodPerResponse, perRespPrev);
      }

      const periodRow = document.createElement('tr');
      periodRow.className = 'breakdown-period-row';
      periodRow.setAttribute('data-team', team.id);
      periodRow.setAttribute('data-ym', ym);
      periodRow.hidden = !expanded;
      periodRow.innerHTML = `
        <td class="breakdown-period-label">${escapeHtml(getPeriodLabel(ym))}</td>
        <td>${formatCurrency(periodCost)}</td>
        <td>${formatPercent(periodPct)}</td>
        <td>${formatNumber(periodProjects)}</td>
        <td>${formatCurrency(periodPerProject)}${deltaProject}</td>
        <td>${formatNumber(periodResponses)}</td>
        <td>${formatCurrency(periodPerResponse)}${deltaResponse}</td>
      `;
      tbody.appendChild(periodRow);
    });
  });
}

// ---- Trend Charts (Chart.js) ----

const TEAM_COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
const _chartInstances = {};

function getAllPeriods() {
  const set = new Set();
  TEAMS.forEach((t) => getTeamPeriods(t.id).forEach((ym) => set.add(ym)));
  return [...set].sort();
}

function renderTrendCharts() {
  const periods = getAllPeriods();
  const chartSection = document.querySelector('.chart-section .trend-charts');
  if (chartSection) chartSection.classList.toggle('app-hidden', periods.length === 0);

  const makeDatasets = (valueFn) =>
    TEAMS.map((team, i) => ({
      label: team.name,
      data: periods.map((ym) => valueFn(team.id, ym)),
      borderColor: TEAM_COLORS[i % TEAM_COLORS.length],
      backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] + '22',
      tension: 0.3,
      pointRadius: 4,
      fill: false,
    }));

  const volumeProjects = periods.map((ym) =>
    TEAMS.reduce((sum, t) => sum + (getMonthDataFor(t.id, ym).numProjects || 0), 0));
  const volumeResponses = periods.map((ym) =>
    TEAMS.reduce((sum, t) => sum + (getMonthDataFor(t.id, ym).numResponses || 0), 0));

  const chartDefs = [
    {
      id: 'chartCostPerProject',
      datasets: makeDatasets((id, ym) => {
        const projects = getMonthDataFor(id, ym).numProjects || 0;
        const cost = getTeamTotalForPeriod(id, ym);
        return projects > 0 ? cost / projects / 100 : null;
      }),
      yLabel: '$ per Project',
      volumeLabel: 'Projects',
      volumeData: volumeProjects,
    },
    {
      id: 'chartCostPerResponse',
      datasets: makeDatasets((id, ym) => {
        const responses = getMonthDataFor(id, ym).numResponses || 0;
        const cost = getTeamTotalForPeriod(id, ym);
        return responses > 0 ? cost / responses / 100 : null;
      }),
      yLabel: '$ per Response Group',
      volumeLabel: 'Response Groups',
      volumeData: volumeResponses,
    },
  ];

  const labels = periods.length ? periods.map(getPeriodLabel) : [];

  chartDefs.forEach(({ id, datasets, yLabel, volumeLabel, volumeData }) => {
    if (_chartInstances[id]) _chartInstances[id].destroy();
    const ctx = document.getElementById(id);
    if (!ctx) return;

    const volumeDataset = {
      label: volumeLabel,
      data: volumeData,
      yAxisID: 'y1',
      borderColor: '#9ca3af',
      backgroundColor: 'transparent',
      borderDash: [6, 3],
      tension: 0.3,
      pointRadius: 3,
      fill: false,
    };

    const allDatasets = [...datasets, volumeDataset];

    _chartInstances[id] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: allDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.5,
        spanGaps: true,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y ?? 0;
                if (ctx.dataset.yAxisID === 'y1') {
                  return ` ${ctx.dataset.label}: ${Number(val).toLocaleString('en-US')}`;
                }
                return ` ${ctx.dataset.label}: $${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              },
            },
          },
        },
        scales: {
          y: {
            title: { display: true, text: yLabel },
            beginAtZero: false,
          },
          y1: {
            position: 'right',
            title: { display: true, text: volumeLabel },
            grid: { drawOnChartArea: false },
            beginAtZero: true,
          },
          x: { grid: { display: false } },
        },
      },
    });
  });
}

// ---- Export Functions ----

function exportCSV() {
  const grandTotal = getYearGrandTotal();
  const totalProjects = getYearTotalProjects();
  const totalResponses = getYearTotalResponses();

  let csv = 'Team,Period,Team Cost,% of Total,Projects,Cost per Project,Response Groups,Cost per Response Group\n';

  TEAMS.forEach((team) => {
    const teamCost = getTeamYearTotal(team.id);
    const teamProjects = getTeamYearProjects(team.id);
    const teamResponses = getTeamYearResponses(team.id);
    const pct = grandTotal > 0 ? ((teamCost / grandTotal) * 100).toFixed(1) + '%' : '0.0%';
    const perProject = teamProjects > 0 ? (teamCost / teamProjects).toFixed(2) : '0.00';
    const perResponse = teamResponses > 0 ? (teamCost / teamResponses).toFixed(2) : '0.00';
    csv += `"${team.name}","(all)",${teamCost.toFixed(2)},${pct},${teamProjects},${perProject},${teamResponses},${perResponse}\n`;
    getTeamPeriods(team.id).forEach((ym) => {
      const periodCost = getTeamTotalForPeriod(team.id, ym);
      const periodProjects = getMonthDataFor(team.id, ym).numProjects || 0;
      const periodResponses = getMonthDataFor(team.id, ym).numResponses || 0;
      const periodGrandTotal = getPeriodGrandTotal(ym);
      const periodPct = periodGrandTotal > 0 ? ((periodCost / periodGrandTotal) * 100).toFixed(1) + '%' : '0.0%';
      const periodPerProject = periodProjects > 0 ? (periodCost / periodProjects).toFixed(2) : '0.00';
      const periodPerResponse = periodResponses > 0 ? (periodCost / periodResponses).toFixed(2) : '0.00';
      csv += `"${team.name}","${getPeriodLabel(ym)}",${periodCost.toFixed(2)},${periodPct},${periodProjects},${periodPerProject},${periodResponses},${periodPerResponse}\n`;
    });
  });

  const overallCostPerProject = totalProjects > 0 ? (grandTotal / totalProjects).toFixed(2) : '0.00';
  const overallCostPerResponse = totalResponses > 0 ? (grandTotal / totalResponses).toFixed(2) : '0.00';
  csv += `"Total","(all)",${grandTotal.toFixed(2)},100.0%,${totalProjects},${overallCostPerProject},${totalResponses},${overallCostPerResponse}\n`;

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
  const grandTotal = getYearGrandTotal();
  const totalProjects = getYearTotalProjects();
  const totalResponses = getYearTotalResponses();
  const overallCostPerProject = totalProjects > 0 ? grandTotal / totalProjects : 0;
  const overallCostPerResponse = totalResponses > 0 ? grandTotal / totalResponses : 0;

  let summary = `Unit Economics Summary (All periods)\n`;
  summary += `===========================\n\n`;
  summary += `Total Cost: ${formatCurrency(grandTotal)}\n`;
  summary += `Total Projects: ${formatNumber(totalProjects)}\n`;
  summary += `Total Response Groups: ${formatNumber(totalResponses)}\n\n`;
  summary += `Overall Cost per Project: ${formatCurrency(overallCostPerProject)}\n`;
  summary += `Overall Cost per Response Group: ${formatCurrency(overallCostPerResponse)}\n\n`;
  summary += `Per-Team Breakdown:\n`;
  summary += `-------------------\n`;

  TEAMS.forEach((team) => {
    const teamCost = getTeamYearTotal(team.id);
    const teamProjects = getTeamYearProjects(team.id);
    const teamResponses = getTeamYearResponses(team.id);
    const pct = grandTotal > 0 ? formatPercent(teamCost / grandTotal) : '0.0%';
    const perProject = teamProjects > 0 ? formatCurrency(teamCost / teamProjects) : '$0.00';
    const perResponse = teamResponses > 0 ? formatCurrency(teamCost / teamResponses) : '$0.00';
    summary += `\n${team.name}: ${formatCurrency(teamCost)} (${pct})\n`;
    summary += `  Projects: ${formatNumber(teamProjects)} | Cost/Project: ${perProject}\n`;
    summary += `  Response Groups: ${formatNumber(teamResponses)} | Cost/Response Group: ${perResponse}\n`;
    getTeamPeriods(team.id).forEach((ym) => {
      const periodCost = getTeamTotalForPeriod(team.id, ym);
      const periodProjects = getMonthDataFor(team.id, ym).numProjects || 0;
      const periodResponses = getMonthDataFor(team.id, ym).numResponses || 0;
      const periodGrandTotal = getPeriodGrandTotal(ym);
      const periodPct = periodGrandTotal > 0 ? formatPercent(periodCost / periodGrandTotal) : '0.0%';
      const periodPerProject = periodProjects > 0 ? formatCurrency(periodCost / periodProjects) : '$0.00';
      const periodPerResponse = periodResponses > 0 ? formatCurrency(periodCost / periodResponses) : '$0.00';
      summary += `  ${getPeriodLabel(ym)}: ${formatCurrency(periodCost)} (${periodPct}) | Projects: ${formatNumber(periodProjects)} | Cost/Proj: ${periodPerProject} | RGs: ${formatNumber(periodResponses)} | Cost/RG: ${periodPerResponse}\n`;
    });
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
    ...(options.method ? {} : { cache: 'no-store' }),
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
  if (res.status === 403) {
    clearStoredUser();
    currentUser = null;
    showLogin();
    const subtitle = document.querySelector('.login-subtitle');
    if (subtitle) subtitle.textContent = 'Your account does not have access to this app.';
    return { ok: false, status: 403 };
  }
  return res;
}

async function flushTeamCostsToServer() {
  if (teamCostsSaveTimer) {
    clearTimeout(teamCostsSaveTimer);
    teamCostsSaveTimer = null;
  }
  const token = getAuthToken();
  if (!token) return;
  const res = await apiFetch('/api/team-costs', {
    method: 'PUT',
    body: JSON.stringify({ unitEconomics: state.unitEconomics }),
  });
  if (!res || !res.ok) {
    if (res && res.status !== 401 && res.status !== 403) {
      let msg = 'Could not save team costs';
      if (res.status === 503) {
        try {
          const data = await res.json();
          if (data.code === 'GOOGLE_CLIENT_ID_MISSING') msg = 'Sign-in not configured. Set GOOGLE_CLIENT_ID in Vercel.';
          else if (data.code === 'FIRESTORE_NOT_CONFIGURED') msg = 'Database not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON in Vercel (see README).';
          else if (data.code === 'FIRESTORE_INVALID_JSON') msg = 'Invalid Firebase JSON in Vercel.';
          else msg = 'Server configuration error. Check Vercel env and logs.';
        } catch (_) {}
      } else if (res.status >= 500) msg = 'Server error while saving team costs.';
      showToast(msg);
    }
    return;
  }
  teamCostsDirty = false;
}

function showTeamCostsLoading(show) {
  const el = document.getElementById('teamCostsSyncBanner');
  if (!el) return;
  if (show) {
    el.textContent = 'Loading team costs from server…';
    el.classList.remove('app-hidden');
  } else {
    el.classList.add('app-hidden');
    el.textContent = '';
  }
}

async function showTeamCostsLoadErrorToast(res) {
  let msg = 'Could not load team costs';
  if (res.status === 401) msg = 'Sign-in expired or invalid. Try signing out and back in.';
  else if (res.status === 503) {
    try {
      const data = await res.json();
      if (data.code === 'GOOGLE_CLIENT_ID_MISSING') msg = 'Sign-in not configured. Set GOOGLE_CLIENT_ID in Vercel.';
      else if (data.code === 'FIRESTORE_NOT_CONFIGURED') msg = 'Database not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON in Vercel (see README).';
      else if (data.code === 'FIRESTORE_INVALID_JSON') msg = 'Invalid Firebase JSON in Vercel.';
      else msg = 'Server configuration error. Check Vercel env and logs.';
    } catch (_) {}
  } else if (res.status >= 500) msg = 'Server configuration error. Check Vercel env and logs.';
  showToast(msg);
}

async function loadTeamCostsFromServer() {
  resetUnitEconomicsState();
  const res = await apiFetch('/api/team-costs');
  if (!res || !res.ok) {
    if (res && res.status !== 401 && res.status !== 403) {
      await showTeamCostsLoadErrorToast(res);
    }
    return;
  }
  let data;
  try {
    data = await res.json();
  } catch (_) {
    showToast('Could not load team costs (invalid response).');
    return;
  }
  if (data.unitEconomics && typeof data.unitEconomics === 'object') {
    applyUnitEconomicsPayload(data.unitEconomics);
  }
}

let billsInitialized = false;
let expensesList = [];
let selectedExpenseIds = new Set();
let billsMetricsCollapsed = false;

async function showExpensesLoadErrorToast(res) {
  let msg = 'Could not load existing expenses';
  if (res.status === 401) msg = 'Sign-in expired or invalid. Try signing out and back in.';
  else if (res.status === 503) {
    try {
      const data = await res.json();
      if (data.code === 'GOOGLE_CLIENT_ID_MISSING') msg = 'Sign-in not configured. Set GOOGLE_CLIENT_ID in Vercel.';
      else if (data.code === 'POSTGRES_URL_MISSING' || data.code === 'FIRESTORE_NOT_CONFIGURED') msg = 'Database not configured. Set up Firestore: add FIREBASE_SERVICE_ACCOUNT_JSON in Vercel (see README).';
      else if (data.code === 'FIRESTORE_INVALID_JSON') msg = 'Invalid Firebase JSON in Vercel. Paste the entire file as one line, or use base64 (see README).';
      else if (data.code === 'FIRESTORE_INDEX_REQUIRED') {
        msg = 'Firestore index required. Opening link to create it…';
        if (data.indexUrl) window.open(data.indexUrl, '_blank');
      } else msg = 'Server configuration error. Check Vercel env and logs.';
    } catch (_) {}
  } else if (res.status >= 500) msg = 'Server configuration error. Check Vercel env and logs.';
  showToast(msg);
}

let billsSelectedPeriods = new Set();

async function loadExpenses() {
  const status = document.getElementById('billsFilterStatus').value || '';
  const category = document.getElementById('billsFilterCategory').value.trim() || '';
  const vendor = document.getElementById('billsFilterVendor').value.trim() || '';
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  const periods = Array.from(billsSelectedPeriods);
  periods.forEach((ym) => params.append('period', ym));
  if (vendor) params.set('vendor', vendor);
  params.set('_', Date.now());
  const res = await apiFetch(`/api/expenses?${params}`);
  if (!res.ok) {
    await showExpensesLoadErrorToast(res);
    return;
  }
  let list = await res.json();
  if (periods.length > 0) {
    const set = new Set(periods);
    list = list.filter((e) => set.has((e.date || '').slice(0, 7)));
  }
  expensesList = list;
  renderBillsTable();
  renderBillsMetrics(expensesList);
}

const BILLS_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPeriodLabel(ym) {
  if (!ym || ym.length < 7) return ym;
  const y = ym.slice(0, 4);
  const m = parseInt(ym.slice(5, 7), 10);
  const monthName = BILLS_MONTH_LABELS[m - 1] || ym;
  return `${monthName} ${y}`;
}

function getDefaultPeriodOptions() {
  const currentYear = new Date().getFullYear();
  const out = [];
  for (let y = currentYear + 2; y >= currentYear - 2; y--) {
    for (let m = 12; m >= 1; m--) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}

function getPeriodOptions() {
  const fromData = [...new Set(expensesList.map((e) => (e.date || '').slice(0, 7)).filter(Boolean))];
  const defaultOpts = getDefaultPeriodOptions();
  const set = new Set([...fromData, ...defaultOpts]);
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

function updateBillsPeriodFilterButtonLabel() {
  const btn = document.getElementById('billsFilterPeriodBtn');
  if (!btn) return;
  if (billsSelectedPeriods.size === 0) btn.textContent = 'All periods';
  else btn.textContent = Array.from(billsSelectedPeriods).sort((a, b) => b.localeCompare(a)).map(formatPeriodLabel).join(', ');
}

function renderBillsTable() {
  const tbody = document.getElementById('billsTableBody');
  const emptyEl = document.getElementById('billsEmpty');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (expensesList.length === 0) {
    emptyEl.classList.remove('app-hidden');
    selectedExpenseIds.clear();
    const selectAll = document.getElementById('billsSelectAll');
    if (selectAll) selectAll.checked = false;
    updateBillsDeleteSelectedButton();
    return;
  }
  emptyEl.classList.add('app-hidden');
  selectedExpenseIds = new Set([...selectedExpenseIds].filter((id) => expensesList.some((e) => e.id === id)));
  expensesList.forEach((e) => {
    const tr = document.createElement('tr');
    const amount = (e.amount_cents / 100).toFixed(2);
    const dateStr = e.date ? new Date(e.date).toLocaleDateString() : '—';
    const checked = selectedExpenseIds.has(e.id) ? ' checked' : '';
    tr.innerHTML = `
      <td class="bills-td-checkbox"><input type="checkbox" class="bills-row-checkbox" data-id="${escapeAttr(e.id)}"${checked} aria-label="Select row"></td>
      <td>${escapeHtml(e.vendor)}</td>
      <td>$${amount}</td>
      <td>${dateStr}</td>
      <td>${escapeHtml(e.status)}</td>
      <td>${escapeHtml(e.category || '—')}</td>
      <td>${e.third_party_invoice_url ? `<a href="${escapeAttr(e.third_party_invoice_url)}" target="_blank" rel="noopener">View</a>` : '—'}</td>
      <td>
        <button type="button" class="btn btn-row-action btn-edit" data-id="${escapeAttr(e.id)}">Edit</button>
        <button type="button" class="btn btn-row-action btn-delete" data-id="${escapeAttr(e.id)}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-edit').forEach((btn) => btn.addEventListener('click', () => openExpenseModal(btn.dataset.id)));
  tbody.querySelectorAll('.btn-delete').forEach((btn) => btn.addEventListener('click', () => deleteExpenseById(btn.dataset.id)));
  tbody.querySelectorAll('.bills-row-checkbox').forEach((cb) => {
    cb.addEventListener('change', function () {
      const id = this.dataset.id;
      if (this.checked) selectedExpenseIds.add(id);
      else selectedExpenseIds.delete(id);
      syncBillsSelectAllCheckbox();
      updateBillsDeleteSelectedButton();
    });
  });
  syncBillsSelectAllCheckbox();
  updateBillsDeleteSelectedButton();
}

function syncBillsSelectAllCheckbox() {
  const selectAll = document.getElementById('billsSelectAll');
  if (!selectAll) return;
  const checkboxes = document.querySelectorAll('.bills-row-checkbox');
  const checked = document.querySelectorAll('.bills-row-checkbox:checked');
  selectAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
  selectAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
}

function updateBillsDeleteSelectedButton() {
  const btn = document.getElementById('billsDeleteSelectedBtn');
  if (!btn) return;
  btn.disabled = selectedExpenseIds.size === 0;
  btn.textContent = selectedExpenseIds.size > 0 ? `Delete selected (${selectedExpenseIds.size})` : 'Delete selected';
}

async function deleteSelectedExpenses() {
  if (selectedExpenseIds.size === 0) {
    showToast('No rows selected');
    return;
  }
  const n = selectedExpenseIds.size;
  if (!confirm(`Delete ${n} selected expense${n !== 1 ? 's' : ''}?`)) return;
  const ids = [...selectedExpenseIds];
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    const res = await apiFetch(`/api/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) ok += 1;
    else failed += 1;
  }
  selectedExpenseIds.clear();
  await loadExpenses();
  if (failed > 0) showToast(`Deleted ${ok}, ${failed} failed`);
  else showToast(`Deleted ${ok}`);
}

function exportBillsToCsv() {
  if (expensesList.length === 0) {
    showToast('No data to export');
    return;
  }
  const header = ['Vendor', 'Amount', 'Date', 'Status', 'Category', 'Notes', '3rd party invoice URL'];
  const escapeCsv = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const rows = [
    header.map(escapeCsv).join(','),
    ...expensesList.map((e) =>
      [
        e.vendor,
        (e.amount_cents / 100).toFixed(2),
        (e.date || '').slice(0, 10),
        e.status,
        e.category || '',
        e.notes || '',
        e.third_party_invoice_url || '',
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];
  const csv = rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported');
}

function formatYearMonth(ym) {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = [ym.slice(0, 4), parseInt(ym.slice(5, 7), 10)];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1] || ''} ${y}`;
}

function renderBillsMetrics(list) {
  const el = document.getElementById('billsMetrics');
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<p class="bills-metrics-empty">No data</p>';
    el.classList.remove('app-hidden');
    return;
  }
  const TEAM_BUILDING_CATEGORIES = [
    'Travel and Entertainment: Team Travel & Meals',
    'General and Admin: Gifts',
    'General and Admin: Team Building Events'
  ];
  const TEAM_BUILDING_LABEL = 'Travel and Entertainment/Team Building';
  const TEAM_BUILDING_EXCEPTION_VENDOR = 'Google Cloud';

  const byYear = {};
  const byMonth = {};
  const byVendor = {};
  let teamBuildingCents = 0;
  list.forEach((e) => {
    const cents = e.amount_cents || 0;
    const year = (e.date || '').slice(0, 4);
    const ym = (e.date || '').slice(0, 7);
    if (year) byYear[year] = (byYear[year] || 0) + cents;
    if (ym) byMonth[ym] = (byMonth[ym] || 0) + cents;
    const category = (e.category || '').trim();
    const vendor = (e.vendor || '').trim();
    const isTeamBuildingCategory = TEAM_BUILDING_CATEGORIES.includes(category);
    const isExceptionVendor = vendor === TEAM_BUILDING_EXCEPTION_VENDOR;
    if (isTeamBuildingCategory && !isExceptionVendor) {
      teamBuildingCents += cents;
    } else {
      const v = e.vendor || '—';
      byVendor[v] = (byVendor[v] || 0) + cents;
    }
  });
  const fmt = (c) => '$' + (c / 100).toFixed(2);
  const totalCents = list.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
  const yearEntries = Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0]));
  const monthEntries = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]));
  const vendorEntriesRaw = Object.entries(byVendor);
  if (teamBuildingCents > 0) {
    vendorEntriesRaw.push([TEAM_BUILDING_LABEL, teamBuildingCents]);
  }
  const vendorEntries = vendorEntriesRaw.sort((a, b) => b[1] - a[1]);
  const maxMonths = 24;
  const maxVendors = 20;
  const monthShow = monthEntries.slice(0, maxMonths);
  const vendorShow = vendorEntries.slice(0, maxVendors);
  const monthMore = monthEntries.length - maxMonths;
  const vendorMore = vendorEntries.length - maxVendors;

  const yearList = yearEntries.length
    ? yearEntries.map(([y, c]) => `<li class="bills-metrics-item"><span class="bills-metrics-label">${escapeHtml(y)}</span><span class="bills-metrics-amount">${fmt(c)}</span></li>`).join('')
    : '<li class="bills-metrics-item bills-metrics-empty-line">—</li>';
  const monthList = monthShow.length
    ? monthShow.map(([ym, c]) => `<li class="bills-metrics-item"><span class="bills-metrics-label">${escapeHtml(formatYearMonth(ym))}</span><span class="bills-metrics-amount">${fmt(c)}</span></li>`).join('') +
      (monthMore > 0 ? `<li class="bills-metrics-more">+ ${monthMore} more</li>` : '')
    : '<li class="bills-metrics-item bills-metrics-empty-line">—</li>';
  const vendorList = vendorShow.length
    ? vendorShow.map(([v, c]) => `<li class="bills-metrics-item"><span class="bills-metrics-label">${escapeHtml(v)}</span><span class="bills-metrics-amount">${fmt(c)}</span></li>`).join('') +
      (vendorMore > 0 ? `<li class="bills-metrics-more">+ ${vendorMore} more</li>` : '')
    : '<li class="bills-metrics-item bills-metrics-empty-line">—</li>';

  const collapsedClass = billsMetricsCollapsed ? ' bills-metrics-collapsed' : '';
  el.innerHTML = `
    <div class="bills-metrics-inner">
      <button type="button" class="bills-metrics-toggle" id="billsMetricsToggle" aria-expanded="${!billsMetricsCollapsed}" aria-controls="billsMetricsBody">
        <span class="bills-metrics-toggle-title">Summary</span>
        <span class="bills-metrics-total-inline">Total: <strong class="bills-metrics-total-value">${fmt(totalCents)}</strong></span>
        <span class="bills-metrics-chevron" aria-hidden="true">${billsMetricsCollapsed ? '▶' : '▼'}</span>
      </button>
      <div id="billsMetricsBody" class="bills-metrics-body${collapsedClass}" role="region">
        <div class="bills-metrics-grid">
          <div class="bills-metrics-module">
            <h4 class="bills-metrics-module-title">By year</h4>
            <ul class="bills-metrics-list">${yearList}</ul>
          </div>
          <div class="bills-metrics-module">
            <h4 class="bills-metrics-module-title">By month</h4>
            <ul class="bills-metrics-list bills-metrics-list-scroll">${monthList}</ul>
          </div>
          <div class="bills-metrics-module">
            <h4 class="bills-metrics-module-title">By vendor</h4>
            <ul class="bills-metrics-list bills-metrics-list-scroll">${vendorList}</ul>
          </div>
        </div>
      </div>
    </div>
  `;
  const toggleBtn = document.getElementById('billsMetricsToggle');
  const bodyEl = document.getElementById('billsMetricsBody');
  if (toggleBtn && bodyEl) {
    toggleBtn.addEventListener('click', () => {
      billsMetricsCollapsed = !billsMetricsCollapsed;
      bodyEl.classList.toggle('bills-metrics-collapsed', billsMetricsCollapsed);
      toggleBtn.setAttribute('aria-expanded', String(!billsMetricsCollapsed));
      const chevron = toggleBtn.querySelector('.bills-metrics-chevron');
      if (chevron) chevron.textContent = billsMetricsCollapsed ? '▶' : '▼';
    });
  }
  el.classList.remove('app-hidden');
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

/** Parse a single line of CSV respecting quoted fields. */
function parseCsvLine(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === ',') {
      out.push('');
      i += 1;
      continue;
    }
    if (line[i] === '"') {
      i += 1;
      let field = '';
      while (i < line.length) {
        if (line[i] === '"') {
          i += 1;
          if (line[i] === '"') { field += '"'; i += 1; }
          else break;
        } else { field += line[i]; i += 1; }
      }
      out.push(field);
      if (line[i] === ',') i += 1;
    } else {
      let field = '';
      while (i < line.length && line[i] !== ',') { field += line[i]; i += 1; }
      out.push(field.trim());
      if (line[i] === ',') i += 1;
    }
  }
  if (line.endsWith(',')) out.push('');
  return out;
}

/** Detect CSV format from header line. Returns 'billcom' | 'tipalti' | null. */
function detectBillsCsvFormat(headerLine) {
  const header = parseCsvLine(headerLine);
  const has = (name) => header.some((h) => normalizeHeader(h).toLowerCase() === name.toLowerCase());
  if (has('Transaction ID') && (has('Merchant') || has('Clean Merchant Name')) && has('Date (UTC)')) return 'billcom';
  if (has('Payee Name') && has('Bill Date')) return 'tipalti';
  return null;
}

/** Parse Bill.com transaction export CSV; return array of { vendor, amount_cents, date, status, category, notes }. */
function parseBillComCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const get = (row, name) => {
    const i = header.indexOf(name);
    return i >= 0 ? (row[i] || '').trim() : '';
  };
  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const row = parseCsvLine(lines[r]);
    if (row.length < 2) continue;
    const merchant = get(row, 'Merchant');
    const cleanMerchant = get(row, 'Clean Merchant Name');
    const vendor = (cleanMerchant || merchant || '').trim();
    if (!vendor) continue;
    const amountStr = get(row, 'Amount');
    const amountNum = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0;
    const amount_cents = Math.round(Math.abs(amountNum) * 100);
    const dateUtc = get(row, 'Date (UTC)');
    const date = dateUtc && dateUtc.length >= 10 ? dateUtc.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const statusStr = (get(row, 'Status') || '').toLowerCase();
    const status = statusStr.includes('approved') ? 'paid' : 'pending';
    const categoryCol = header.includes('2. Category') ? get(row, '2. Category') : get(row, 'Budget');
    const category = (categoryCol || '').trim() || null;
    const notes = (get(row, 'Notes') || get(row, 'Transaction ID') || '').trim() || null;
    rows.push({
      vendor,
      amount_cents,
      date,
      status,
      category,
      notes,
    });
  }
  return rows;
}

/** Normalize CSV header for matching: trim, collapse spaces, strip BOM/zero-width. */
function normalizeHeader(h) {
  const s = String(h ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

/** Normalized header for case-insensitive comparison (Tipalti export casing can vary). */
function headerKey(h) {
  return normalizeHeader(h).toLowerCase();
}

/** Parse Tipalti BillList-style CSV; return array of { vendor, amount_cents, date, status, category, notes }. Uses "Amount" (col 13) only, not "Amount due" (col 14). */
function parseTipaltiBillsCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const get = (row, name) => {
    const i = header.findIndex((h) => headerKey(h) === name.toLowerCase());
    return i >= 0 ? (row[i] || '').trim() : '';
  };
  // Tipalti order (from export): ... 12=Currency, 13=Amount, 14=Amount due, ...
  const amountDueKey = 'amount due';
  const amountDueColIndex = header.findIndex((h) => headerKey(h) === amountDueKey);
  let amountColIndex = header.findIndex((h) => {
    const k = headerKey(h);
    return k === 'amount' || (k.startsWith('amount') && k !== amountDueKey && !k.includes('amount due'));
  });
  if (amountColIndex === amountDueColIndex) amountColIndex = -1;
  // If still no "Amount" by name, use fixed position 12 (canonical Tipalti column 13 = Amount).
  if (amountColIndex < 0 && header.length > 12) amountColIndex = 12;
  const parseAmount = (str) => parseFloat(String(str || '').replace(/[^0-9.-]/g, '')) || 0;
  const getAmountCents = (row) => {
    if (amountColIndex >= 0 && row.length > amountColIndex) {
      const num = parseAmount((row[amountColIndex] || '').trim());
      return Math.round(num * 100);
    }
    if (amountDueColIndex >= 0 && row.length > amountDueColIndex) {
      const before = amountDueColIndex > 0 ? parseAmount((row[amountDueColIndex - 1] || '').trim()) : 0;
      const due = parseAmount((row[amountDueColIndex] || '').trim());
      const after = row.length > amountDueColIndex + 1 ? parseAmount((row[amountDueColIndex + 1] || '').trim()) : 0;
      return Math.round(Math.max(before, due, after) * 100);
    }
    const at12 = row.length > 12 ? parseAmount((row[12] || '').trim()) : 0;
    const at13 = row.length > 13 ? parseAmount((row[13] || '').trim()) : 0;
    return Math.round(Math.max(at12, at13) * 100);
  };
  const monthNames = 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'.split(',');
  const parseBillDate = (s) => {
    if (!s) return '';
    const parts = s.split('-').map((p) => p.trim());
    if (parts.length !== 3) return '';
    const day = parseInt(parts[0], 10);
    const monthIdx = monthNames.indexOf(parts[1]);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || monthIdx < 0 || isNaN(year)) return '';
    const d = new Date(year, monthIdx, day);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };
  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const row = parseCsvLine(lines[r]);
    if (row.length < 2) continue;
    const payeeName = get(row, 'Payee Name');
    const billDate = get(row, 'Bill Date');
    const invoiceNumber = get(row, 'Invoice Number');
    const billStatus = get(row, 'Bill Status');
    const paymentStatus = get(row, 'Payment Status');
    const description = get(row, 'Description');
    if (!payeeName) continue;
    const amount_cents = getAmountCents(row);
    const date = parseBillDate(billDate);
    let status = 'pending';
    const statusLower = (billStatus + ' ' + paymentStatus).toLowerCase();
    if (statusLower.includes('paid')) status = 'paid';
    else if (statusLower.includes('pending') || statusLower.includes('unpaid')) status = 'pending';
    rows.push({
      vendor: payeeName,
      amount_cents,
      date: date || new Date().toISOString().slice(0, 10),
      status,
      category: description || null,
      notes: invoiceNumber || null,
    });
  }
  return rows;
}

/** Parse CSV from either Bill.com or Tipalti; return array of { vendor, amount_cents, date, status, category, notes }. */
function parseBillsCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const format = detectBillsCsvFormat(lines[0]);
  if (format === 'billcom') return parseBillComCsv(text);
  if (format === 'tipalti') return parseTipaltiBillsCsv(text);
  return parseTipaltiBillsCsv(text);
}

/**
 * Parse expense fields from a bill filename.
 * Handles names like "Bill #B9265733-0158 from Opines, LLC re...@storesight.com - Field Agent Inc Mail.pdf"
 * or "Bill #INV-004416 from RetailStat, LLC r...@storesight.com - Field Agent Inc Mail.pdf".
 * @param {string} filename
 * @returns {{ vendor: string, notes: string }}
 */
function parseExpenseFromFilename(filename) {
  const out = { vendor: '', notes: '' };
  if (!filename || typeof filename !== 'string') return out;
  const name = filename.replace(/\.pdf$/i, '');

  // Vendor: text after "from " and before " re" / " r..." / " @"
  const fromMatch = name.match(/from\s+([^@]+?)\s+r[\s.]/i) || name.match(/from\s+([^@]+?)\s+@/i);
  if (fromMatch) out.vendor = fromMatch[1].trim();

  // Reference for notes: "Bill #XXX" or "INV-XXX"
  const billRef = name.match(/(Bill\s*#\s*[^\s-]+(?:-[^\s]+)?)/i);
  const invRef = name.match(/(INV-[^\s]+)/i);
  if (billRef) out.notes = billRef[1].trim();
  else if (invRef) out.notes = invRef[1].trim();

  return out;
}

function openExpenseModal(editId = null) {
  const modal = document.getElementById('expenseModal');
  const form = document.getElementById('expenseForm');
  const title = document.getElementById('expenseModalTitle');
  form.reset();
  document.getElementById('expenseId').value = editId || '';
  document.getElementById('expenseThirdPartyInvoice').value = '';
  document.getElementById('expenseThirdPartyInvoiceLabel').textContent = 'Choose file or attach later';
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
  let third_party_invoice_url = null;
  const thirdInput = document.getElementById('expenseThirdPartyInvoice');
  if (thirdInput.files && thirdInput.files[0]) {
    third_party_invoice_url = await uploadFile(thirdInput);
    if (!third_party_invoice_url) showToast('Failed to upload 3rd party invoice');
  } else if (id) {
    const existing = expensesList.find((x) => x.id === id);
    if (existing) third_party_invoice_url = existing.third_party_invoice_url;
  }
  const payload = { vendor, amount_cents, date, status, category: category || null, notes: notes || null };
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
  const res = await apiFetch(`/api/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    let msg = 'Failed to delete';
    try {
      const data = await res.json();
      if (res.status === 404) msg = data.error || 'Expense not found';
      else if (data.error || data.detail) msg = data.error || data.detail;
    } catch {
      if (res.status === 404) msg = 'Expense not found';
    }
    showToast(msg);
    return;
  }
  showToast('Deleted');
  await loadExpenses();
}

function matchKey(e) {
  return `${e.vendor}|${(e.date || '').slice(0, 10)}|${(e.notes || '').trim()}`;
}

function expenseFieldsEqual(a, b) {
  return (a.amount_cents || 0) === (b.amount_cents || 0)
    && (a.status || '') === (b.status || '')
    && (a.category || '') === (b.category || '')
    && (a.notes || '').trim() === (b.notes || '').trim();
}

async function importBillsFromCsv(file) {
  const text = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsText(file, 'UTF-8');
  });
  const rows = parseBillsCsv(text);
  if (rows.length === 0) {
    showToast('No valid rows in CSV');
    return;
  }
  const res = await apiFetch('/api/expenses');
  if (!res.ok) {
    await showExpensesLoadErrorToast(res);
    return;
  }
  const existing = await res.json();
  const existingByKey = new Map(existing.map((e) => [matchKey(e), e]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let firstErrorMsg = null;
  for (const row of rows) {
    const key = matchKey(row);
    const existingRow = existingByKey.get(key);
    if (existingRow) {
      if (expenseFieldsEqual(existingRow, row)) {
        skipped += 1;
        continue;
      }
      const patchRes = await apiFetch(`/api/expenses/${existingRow.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          vendor: row.vendor,
          amount_cents: row.amount_cents,
          date: row.date,
          status: row.status,
          category: row.category,
          notes: row.notes,
        }),
      });
      if (patchRes.ok) {
        updated += 1;
        existingByKey.set(key, { ...existingRow, ...row });
      } else {
        failed += 1;
        if (firstErrorMsg == null) {
          try {
            const data = await patchRes.json();
            firstErrorMsg = data.error || data.detail || null;
          } catch {
            firstErrorMsg = null;
          }
        }
      }
      continue;
    }
    const createRes = await apiFetch('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        vendor: row.vendor,
        amount_cents: row.amount_cents,
        date: row.date,
        status: row.status,
        category: row.category,
        notes: row.notes,
      }),
    });
    let createData;
    try {
      createData = await createRes.json();
    } catch {
      createData = null;
    }
    if (createRes.ok && createData) {
      added += 1;
      existingByKey.set(key, createData);
    } else {
      failed += 1;
      if (firstErrorMsg == null) firstErrorMsg = (createData && (createData.error || createData.detail)) || null;
    }
  }
  if (added > 0 || updated > 0) loadExpenses();
  if (failed > 0) {
    const parts = [];
    if (added) parts.push(`${added} added`);
    if (updated) parts.push(`${updated} updated`);
    if (skipped) parts.push(`${skipped} unchanged`);
    const msg = (parts.length ? `Imported: ${parts.join(', ')}. ` : '') + `${failed} failed${firstErrorMsg ? `: ${firstErrorMsg}` : '.'}`;
    showToast(msg);
  } else {
    const parts = [];
    if (added) parts.push(`${added} added`);
    if (updated) parts.push(`${updated} updated`);
    if (skipped) parts.push(`${skipped} unchanged`);
    showToast(parts.length ? `Imported: ${parts.join(', ')}.` : 'No rows to import.');
  }
}

function renderBillsPeriodList(filterText) {
  const listEl = document.getElementById('billsFilterPeriodList');
  if (!listEl) return;
  const options = getPeriodOptions();
  const lower = (filterText || '').toLowerCase();
  const filtered = lower
    ? options.filter((ym) => formatPeriodLabel(ym).toLowerCase().includes(lower) || ym.slice(0, 4).includes(lower))
    : options;

  const byYear = {};
  filtered.forEach((ym) => {
    const y = ym.slice(0, 4);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(ym);
  });

  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
  let html = '';
  years.forEach((y) => {
    const months = byYear[y];
    const checkedMonths = months.filter((ym) => billsSelectedPeriods.size === 0 || billsSelectedPeriods.has(ym));
    const allChecked = checkedMonths.length === months.length;
    const someChecked = checkedMonths.length > 0 && !allChecked;
    html += `<div class="bills-filter-year-group">
      <label class="bills-filter-year-row">
        <input type="checkbox" class="bills-filter-year-cb" data-year="${escapeAttr(y)}"
          ${allChecked ? ' checked' : ''} ${someChecked ? ' data-indeterminate="true"' : ''} aria-label="Year ${escapeAttr(y)}">
        <strong>${escapeHtml(y)}</strong>
      </label>`;
    months.forEach((ym) => {
      const checked = billsSelectedPeriods.size === 0 || billsSelectedPeriods.has(ym);
      html += `<label class="bills-filter-period-option bills-filter-period-month">
        <input type="checkbox" class="bills-filter-period-cb" value="${escapeAttr(ym)}" ${checked ? ' checked' : ''} aria-label="${escapeAttr(formatPeriodLabel(ym))}">${escapeHtml(formatPeriodLabel(ym))}</label>`;
    });
    html += `</div>`;
  });
  listEl.innerHTML = html;

  listEl.querySelectorAll('.bills-filter-year-cb[data-indeterminate="true"]').forEach((cb) => {
    cb.indeterminate = true;
  });
}

function initBillsPeriodFilter() {
  const listEl = document.getElementById('billsFilterPeriodList');
  const btn = document.getElementById('billsFilterPeriodBtn');
  const dropdown = document.getElementById('billsFilterPeriodDropdown');
  const allCb = document.getElementById('billsFilterPeriodAll');
  const searchInput = document.getElementById('billsFilterPeriodSearch');
  const applyBtn = document.getElementById('billsFilterPeriodApply');
  const cancelBtn = document.getElementById('billsFilterPeriodCancel');
  const wrap = document.getElementById('billsFilterPeriodWrap');
  if (!listEl || !btn || !dropdown || !wrap) return;

  renderBillsPeriodList('');

  btn.addEventListener('click', () => {
    const open = !dropdown.classList.contains('app-hidden');
    if (open) {
      renderBillsPeriodList(searchInput ? searchInput.value : '');
      allCb.checked = billsSelectedPeriods.size === 0;
    }
    dropdown.classList.toggle('app-hidden', open);
    btn.setAttribute('aria-expanded', String(!open));
  });

  document.addEventListener('click', (e) => {
    if (wrap && !wrap.contains(e.target)) {
      dropdown.classList.add('app-hidden');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => renderBillsPeriodList(searchInput.value));
  }

  if (allCb) {
    allCb.addEventListener('change', () => {
      if (allCb.checked) {
        listEl.querySelectorAll('.bills-filter-period-cb').forEach((cb) => { cb.checked = false; });
        listEl.querySelectorAll('.bills-filter-year-cb').forEach((cb) => { cb.checked = false; cb.indeterminate = false; });
      }
    });
  }

  listEl.addEventListener('change', (e) => {
    if (e.target.classList.contains('bills-filter-year-cb')) {
      const year = e.target.dataset.year;
      const checked = e.target.checked;
      e.target.indeterminate = false;
      listEl.querySelectorAll('.bills-filter-period-cb').forEach((cb) => {
        if (cb.value.startsWith(year + '-')) cb.checked = checked;
      });
      if (allCb) allCb.checked = false;
    }
    if (e.target.classList.contains('bills-filter-period-cb')) {
      const year = e.target.value.slice(0, 4);
      const yearCb = listEl.querySelector(`.bills-filter-year-cb[data-year="${year}"]`);
      if (yearCb) {
        const allInYear = [...listEl.querySelectorAll('.bills-filter-period-cb')].filter((cb) => cb.value.startsWith(year + '-'));
        const checkedInYear = allInYear.filter((cb) => cb.checked);
        yearCb.checked = checkedInYear.length === allInYear.length;
        yearCb.indeterminate = checkedInYear.length > 0 && checkedInYear.length < allInYear.length;
      }
      if (allCb) allCb.checked = false;
    }
  });

  const selectAllBtn = document.getElementById('billsFilterPeriodSelectAll');
  const selectNoneBtn = document.getElementById('billsFilterPeriodSelectNone');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      listEl.querySelectorAll('.bills-filter-period-cb').forEach((cb) => { cb.checked = true; });
      listEl.querySelectorAll('.bills-filter-year-cb').forEach((cb) => { cb.checked = true; cb.indeterminate = false; });
      if (allCb) allCb.checked = false;
    });
  }
  if (selectNoneBtn) {
    selectNoneBtn.addEventListener('click', () => {
      listEl.querySelectorAll('.bills-filter-period-cb').forEach((cb) => { cb.checked = false; });
      listEl.querySelectorAll('.bills-filter-year-cb').forEach((cb) => { cb.checked = false; cb.indeterminate = false; });
      if (allCb) allCb.checked = false;
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (allCb && allCb.checked) {
        billsSelectedPeriods = new Set();
      } else {
        const checked = listEl.querySelectorAll('.bills-filter-period-cb:checked');
        billsSelectedPeriods = new Set(Array.from(checked).map((cb) => cb.value));
      }
      updateBillsPeriodFilterButtonLabel();
      dropdown.classList.add('app-hidden');
      btn.setAttribute('aria-expanded', 'false');
      loadExpenses();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      dropdown.classList.add('app-hidden');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  updateBillsPeriodFilterButtonLabel();
}

function initBillsOnce() {
  if (billsInitialized) return;
  billsInitialized = true;
  document.getElementById('billsAddBtn').addEventListener('click', () => openExpenseModal());
  const csvInput = document.getElementById('billsCsvInput');
  const importCsvBtn = document.getElementById('billsImportCsvBtn');
  if (importCsvBtn && csvInput) {
    importCsvBtn.addEventListener('click', () => csvInput.click());
    csvInput.addEventListener('change', function () {
      const file = this.files && this.files[0];
      if (file) {
        importBillsFromCsv(file);
        this.value = '';
      }
    });
  }
  document.getElementById('billsSelectAll').addEventListener('change', function () {
    const checkboxes = document.querySelectorAll('.bills-row-checkbox');
    const checked = this.checked;
    checkboxes.forEach((cb) => {
      cb.checked = checked;
      if (checked) selectedExpenseIds.add(cb.dataset.id);
      else selectedExpenseIds.delete(cb.dataset.id);
    });
    updateBillsDeleteSelectedButton();
  });
  document.getElementById('billsDeleteSelectedBtn').addEventListener('click', deleteSelectedExpenses);
  document.getElementById('billsExportBtn').addEventListener('click', exportBillsToCsv);
  document.getElementById('billsFilterStatus').addEventListener('change', loadExpenses);
  initBillsPeriodFilter();
  document.getElementById('billsFilterVendor').addEventListener('input', () => { clearTimeout(window._billsFilterTimeout); window._billsFilterTimeout = setTimeout(loadExpenses, 300); });
  document.getElementById('billsFilterCategory').addEventListener('input', () => { clearTimeout(window._billsFilterTimeout); window._billsFilterTimeout = setTimeout(loadExpenses, 300); });
  document.getElementById('expenseModalCancel').addEventListener('click', closeExpenseModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeExpenseModal);
  document.getElementById('expenseForm').addEventListener('submit', saveExpenseForm);
  document.getElementById('expenseThirdPartyInvoice').addEventListener('change', function () {
    document.getElementById('expenseThirdPartyInvoiceLabel').textContent = this.files && this.files[0] ? this.files[0].name : 'Choose file or attach later';
  });
  loadExpenses();
}

// ---- Unit Economics Drawer ----

function openTeamCostsDrawer() {
  const drawer = document.getElementById('ueDrawer');
  const overlay = document.getElementById('ueDrawerOverlay');
  if (!drawer || !overlay) return;
  drawer.classList.add('open');
  drawer.classList.remove('app-hidden');
  overlay.classList.add('open');
  overlay.classList.remove('app-hidden');
}

function closeTeamCostsDrawer() {
  void flushTeamCostsToServer();
  const drawer = document.getElementById('ueDrawer');
  const overlay = document.getElementById('ueDrawerOverlay');
  if (!drawer || !overlay) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  setTimeout(() => {
    drawer.classList.add('app-hidden');
    overlay.classList.add('app-hidden');
  }, 300);
}

// ---- Initialize ----

let ueCalculatorListenersBound = false;
let ueTeamCostsPagehideBound = false;

async function initCalculator() {
  showTeamCostsLoading(true);
  try {
    await loadTeamCostsFromServer();
  } finally {
    showTeamCostsLoading(false);
  }
  renderUnitEconomicsGrid();
  recalculate();
  if (!ueCalculatorListenersBound) {
    ueCalculatorListenersBound = true;
    document.getElementById('exportCsv').addEventListener('click', exportCSV);
    document.getElementById('copyClipboard').addEventListener('click', copySummary);
    const openBtn = document.getElementById('ueOpenDrawerBtn');
    const closeBtn = document.getElementById('ueDrawerClose');
    const overlay = document.getElementById('ueDrawerOverlay');
    if (openBtn) {
      openBtn.addEventListener('click', openTeamCostsDrawer);
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', closeTeamCostsDrawer);
    }
    if (overlay) {
      overlay.addEventListener('click', closeTeamCostsDrawer);
    }
  }
  if (!ueTeamCostsPagehideBound) {
    ueTeamCostsPagehideBound = true;
    window.addEventListener('pagehide', () => {
      if (teamCostsSaveTimer) clearTimeout(teamCostsSaveTimer);
      const token = getAuthToken();
      if (!token || !teamCostsDirty) return;
      fetch('/api/team-costs', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unitEconomics: state.unitEconomics }),
        keepalive: true,
      }).catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  authInit();
  initNumericInputClearOnFocus();
});
