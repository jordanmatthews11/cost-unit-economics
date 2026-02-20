// ============================================
// Cost Unit Economics Calculator — App Logic
// ============================================

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

// ---- Initialize ----

function init() {
  renderTeamCards();
  recalculate();

  // Export buttons
  document.getElementById('exportCsv').addEventListener('click', exportCSV);
  document.getElementById('copyClipboard').addEventListener('click', copySummary);
}

document.addEventListener('DOMContentLoaded', init);
