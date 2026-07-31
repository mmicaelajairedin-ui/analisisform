/* MultiCoach Utilities */

// Format numbers with locale
function formatNumber(num) {
  return new Intl.NumberFormat('es-ES').format(num);
}

// Format currency EUR
function formatCurrency(num) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
}

// Format date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Format short date
function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
}

// Calculate days ago
function daysAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} semanas`;
  return `Hace ${Math.floor(days / 30)} meses`;
}

// Calculate percentage
function calcPercentage(current, total) {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

// Get status badge class
function getStatusClass(status) {
  const statusMap = {
    'active': 'badge-success',
    'inactive': 'badge-muted',
    'completed': 'badge-primary',
    'pending': 'badge-warning',
    'risk': 'badge-danger'
  };
  return statusMap[status] || 'badge-muted';
}

// Get status label
function getStatusLabel(status) {
  const statusMap = {
    'active': 'Activo',
    'inactive': 'Inactivo',
    'completed': 'Completado',
    'pending': 'Pendiente',
    'risk': 'En riesgo'
  };
  return statusMap[status] || status;
}

// Get risk level color
function getRiskColor(level) {
  const riskMap = {
    'low': '#27AE60',
    'medium': '#F39C12',
    'high': '#E74C3C'
  };
  return riskMap[level] || '#6C6561';
}

// Get risk level label
function getRiskLabel(level) {
  const riskMap = {
    'low': 'Bajo',
    'medium': 'Medio',
    'high': 'Alto'
  };
  return riskMap[level] || level;
}

// Escape HTML special characters
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Find coach by ID
function findCoach(coachId) {
  return COACHES.find(c => c.id === coachId);
}

// Find client by ID
function findClient(clientId) {
  return CLIENTS.find(c => c.id === clientId);
}

// Filter coaches by search term
function filterCoaches(term) {
  if (!term) return COACHES;
  const lower = term.toLowerCase();
  return COACHES.filter(c =>
    c.name.toLowerCase().includes(lower) ||
    c.email.toLowerCase().includes(lower) ||
    c.specialty.toLowerCase().includes(lower)
  );
}

// Filter clients by search term
function filterClients(term) {
  if (!term) return CLIENTS;
  const lower = term.toLowerCase();
  return CLIENTS.filter(c =>
    c.name.toLowerCase().includes(lower) ||
    c.email.toLowerCase().includes(lower) ||
    c.role.toLowerCase().includes(lower) ||
    c.sector.toLowerCase().includes(lower)
  );
}

// Sort array by property
function sortBy(arr, prop, desc = false) {
  return [...arr].sort((a, b) => {
    if (a[prop] < b[prop]) return desc ? 1 : -1;
    if (a[prop] > b[prop]) return desc ? -1 : 1;
    return 0;
  });
}

// Get coach utilization percentage
function getCoachUtilization(coach) {
  return Math.round((coach.clientsAssigned / coach.capacity) * 100);
}

// Get coaching capacity status
function getCapacityStatus(assigned, capacity) {
  const pct = Math.round((assigned / capacity) * 100);
  if (pct >= 90) return { status: 'high', label: 'Cupo lleno', color: '#E74C3C' };
  if (pct >= 70) return { status: 'medium', label: 'Cupo medio', color: '#F39C12' };
  return { status: 'low', label: 'Con disponibilidad', color: '#27AE60' };
}

// Get program week label
function getProgramWeekLabel(week) {
  return `Semana ${week}`;
}

// Get program progress label
function getProgramProgressLabel(progress) {
  if (progress === 100) return 'Completado';
  if (progress >= 75) return 'Muy avanzado';
  if (progress >= 50) return 'A mitad de camino';
  if (progress >= 25) return 'En marcha';
  return 'Recién comenzado';
}

// Calculate organization KPIs
function calcOrgKPIs() {
  return {
    totalClients: ANALYTICS_DATA.kpis.totalClients,
    activeCoaches: ANALYTICS_DATA.kpis.activeCoaches,
    completionRate: ANALYTICS_DATA.kpis.completionRate,
    avgNps: (COACHES.reduce((sum, c) => sum + c.nps, 0) / COACHES.length).toFixed(1),
    totalRevenue: ANALYTICS_DATA.kpis.totalRevenue,
    avgRetention: Math.round(COACHES.reduce((sum, c) => sum + c.retentionRate, 0) / COACHES.length)
  };
}

// Get chart data for coach performance
function getCoachPerformanceData() {
  return COACHES.map(c => ({
    name: c.name,
    nps: c.nps,
    retention: c.retentionRate,
    completion: c.completionRate,
    utilization: getCoachUtilization(c)
  }));
}

// Get chart data for monthly growth
function getMonthlyGrowthData() {
  return ANALYTICS_DATA.monthlyGrowth;
}

// Get chart data for retention curve
function getRetentionData() {
  return ANALYTICS_DATA.retention;
}

// Build query string from object
function buildQueryString(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      query.append(key, value);
    }
  }
  return query.toString();
}

// Parse query string to object
function parseQueryString() {
  const params = {};
  const query = new URLSearchParams(window.location.search);
  for (const [key, value] of query.entries()) {
    params[key] = value;
  }
  return params;
}

// Navigate to page
function navigateTo(page, params = {}) {
  let url = `${page}.html`;
  if (Object.keys(params).length > 0) {
    url += `?${buildQueryString(params)}`;
  }
  window.location.href = url;
}

// Get query parameter
function getQueryParam(name) {
  const params = parseQueryString();
  return params[name] || null;
}
