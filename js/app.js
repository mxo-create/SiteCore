/* SiteCore MVP — Application logic (per SiteCore Manual) */

const ROLES = {
  admin: { label: 'Site Administrator', short: 'Admin' },
  field: { label: 'Field Officer', short: 'Field' },
  site: { label: 'Mining Site Rep', short: 'Site Rep' },
  buyer: { label: 'Buyer/Processor', short: 'Buyer' },
  community: { label: 'Community', short: 'Community' },
  government: { label: 'Government', short: 'Gov' }
};

const SITE_REP_SITE_ID = 'SC-TZ-001';

const DISCLAIMER = 'SiteCore makes introductions only — it does not hold funds, issue permits, or send messages on your behalf.';

let state = {
  role: 'site',
  view: 'dashboard',
  tab: 'profile',
  fieldMode: 'assess',
  selectedSiteId: null,
  offline: false,
  adminAuthenticated: false,
  demoBanner: null,
  mapPin: null,
  data: loadData()
};

state.offline = state.data.offline ?? false;

document.addEventListener('DOMContentLoaded', () => render());

function persist() {
  state.data.offline = state.offline;
  saveData(state.data);
  renderHeader();
}

function setRole(role) {
  if (role === 'admin' && !state.adminAuthenticated) {
    authenticateAdmin();
    return;
  }

  state.role = role;
  state.view = 'dashboard';
  state.tab = getDefaultTab(role);
  state.selectedSiteId = role === 'site' ? SITE_REP_SITE_ID : null;
  state.fieldMode = 'assess';
  render();
}

function authenticateAdmin() {
  const entered = window.prompt('Enter admin password');
  if (entered === 'Portal_RE-versal') {
    state.adminAuthenticated = true;
    state.role = 'admin';
    state.view = 'dashboard';
    state.tab = 'overview';
    state.selectedSiteId = null;
    state.fieldMode = 'assess';
    render();
    showToast('Admin access granted', 'success');
    return true;
  }

  if (entered !== null) {
    showToast('Incorrect admin password', 'error');
  }
  return false;
}

function logoutAdmin() {
  state.adminAuthenticated = false;
  state.role = 'site';
  state.view = 'dashboard';
  state.tab = 'profile';
  state.selectedSiteId = SITE_REP_SITE_ID;
  state.fieldMode = 'assess';
  render();
  showToast('Admin access closed', 'info');
}

function getDefaultTab(role) {
  return {
    admin: 'overview',
    field: 'assess',
    site: 'profile',
    buyer: 'discover',
    community: 'report',
    government: 'overview'
  }[role];
}

function setTab(tab) {
  state.tab = tab;
  state.selectedSiteId = null;
  render();
}

function showSiteProfile(siteId) {
  state.selectedSiteId = siteId;
  state.view = 'dashboard';
  state.tab = 'profile-detail';
  render();
}

function openMap() {
  state.view = 'map';
  state.mapPin = null;
  render();
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.className = `notice notice-${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function addTimeline(site, title, desc) {
  site.timeline = site.timeline || [];
  site.timeline.unshift({
    date: new Date().toISOString().slice(0, 10),
    title,
    desc
  });
}

function queueItem(item) {
  if (state.offline) {
    state.data.pendingSync = state.data.pendingSync || [];
    state.data.pendingSync.push(item);
    if (item.ref) item.ref.queued = true;
  }
}

function getQueuedCount() {
  const sync = (state.data.pendingSync || []).length;
  const siteQueued = state.data.sites.filter(s => s.queued).length;
  const reportQueued = (state.data.communityReports || []).filter(r => r.queued).length;
  return sync || siteQueued + reportQueued;
}

/* ── Render ── */

function render() {
  renderHeader();
  const main = document.getElementById('main');
  if (!main) return;

  if (state.view === 'map') {
    main.innerHTML = renderMapView();
    bindMapEvents();
  } else {
    main.innerHTML = renderDashboard();
    bindDashboardEvents();
  }
  renderFooter();
}

function renderHeader() {
  const header = document.getElementById('header');
  if (!header) return;

  const queued = getQueuedCount();
  const rolePills = Object.entries(ROLES)
    .filter(([key]) => key === 'admin' ? state.adminAuthenticated : true)
    .map(([key, r]) =>
      `<button class="role-pill ${state.role === key ? 'active' : ''}" data-role="${key}">${r.short}</button>`
    ).join('');

  header.innerHTML = `
    <div class="top-bar">
      <div class="top-bar-row">
        <div class="logo-wrap">
          <div class="logo"><div class="logo-mark">SC</div> SiteCore</div>
          <button class="btn btn-sm ${state.adminAuthenticated ? 'btn-gold' : 'btn-outline'}" id="btn-admin-login" style="color:#fff;border-color:rgba(255,255,255,0.3);margin-left:0.75rem">
            ${state.adminAuthenticated ? 'LOG OUT ADMIN' : 'ADMIN LOGIN'}
          </button>
        </div>
        <div class="role-pills">${rolePills}</div>
        <div class="top-controls">
          <button class="btn btn-sm ${state.view === 'map' ? 'btn-gold' : 'btn-outline'}" id="btn-sitemap" style="color:#fff;border-color:rgba(255,255,255,0.3)">Site Map</button>
          <button class="btn btn-sm btn-gold" id="btn-refresh">Refresh Data</button>
          <button class="btn btn-sm ${state.offline ? 'btn-gold' : 'btn-outline'}" id="btn-offline" style="color:#fff;border-color:rgba(255,255,255,0.3)">
            ${state.offline ? '📴 Offline' : '🌐 Online'}
          </button>
          ${queued && !state.offline ? `<button class="btn btn-sm btn-primary" id="btn-sync">Sync ${queued} item${queued > 1 ? 's' : ''}</button>` : ''}
        </div>
      </div>
    </div>
  `;

  header.querySelectorAll('[data-role]').forEach(btn => {
    btn.addEventListener('click', () => setRole(btn.dataset.role));
  });
  document.getElementById('btn-sitemap')?.addEventListener('click', openMap);
  document.getElementById('btn-refresh')?.addEventListener('click', refreshData);
  document.getElementById('btn-admin-login')?.addEventListener('click', () => {
    if (state.adminAuthenticated) {
      logoutAdmin();
    } else {
      authenticateAdmin();
    }
  });
  document.getElementById('btn-offline')?.addEventListener('click', toggleOffline);
  document.getElementById('btn-sync')?.addEventListener('click', syncAll);
}

function renderFooter() {
  let footer = document.getElementById('app-footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.id = 'app-footer';
    footer.className = 'app-footer';
    document.body.appendChild(footer);
  }
  footer.innerHTML = `<p>${DISCLAIMER}</p>`;
}

function renderDashboard() {
  const tabs = getTabsForRole();
  const tabNav = tabs.length > 1 ? `
    <nav class="nav-tabs">${tabs.map(t =>
      `<button class="nav-tab ${state.tab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('')}</nav>
  ` : '';

  let content = '';
  switch (state.tab) {
    case 'overview': content = state.role === 'government' ? renderGovOverview() : renderAdminOverview(); break;
    case 'sites': content = renderAllSites(); break;
    case 'assess': content = renderFieldAssess(); break;
    case 'register': content = renderRegisterForm(); break;
    case 'profile': content = renderSiteRepView(); break;
    case 'discover': content = renderBuyerDiscover(); break;
    case 'services': content = renderServiceNetwork(); break;
    case 'profile-detail': content = renderTrustProfile(state.selectedSiteId); break;
    case 'report': content = renderCommunityReportForm(); break;
    case 'reports-list': content = renderCommunityReportsList(); break;
    default: content = '<p>View not found</p>';
  }

  const banner = state.demoBanner ? `<div class="notice notice-success">${state.demoBanner}</div>` : '';
  const offlineNote = state.offline ? `<div class="notice notice-warning">Offline mode — new submissions are saved locally and marked queued.</div>` : '';

  return `
    <div class="container container-wide view">
      <div id="toast" class="notice notice-success hidden"></div>
      ${banner}${offlineNote}
      ${tabNav}
      ${content}
    </div>
  `;
}

function getTabsForRole() {
  const map = {
    admin: [
      { id: 'overview', label: 'Dashboard' },
      { id: 'sites', label: 'All Sites' }
    ],
    field: [
      { id: 'assess', label: 'Assess a Site' },
      { id: 'register', label: 'Register New Site' }
    ],
    site: [{ id: 'profile', label: 'My Site' }],
    buyer: [
      { id: 'discover', label: 'Discover' },
      { id: 'services', label: 'Service Network' }
    ],
    community: [
      { id: 'report', label: 'Submit Report' },
      { id: 'reports-list', label: 'All Reports' }
    ],
    government: [{ id: 'overview', label: 'Dashboard' }]
  };
  return map[state.role] || [];
}

function renderTierBar(sites) {
  const counts = countByTier(sites);
  return `
    <div class="tier-bar">
      ${counts.map(c => `
        <div class="tier-item">
          <span class="tier-count">${c.count}</span>
          <span class="tier-label">${c.label}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function syncIcon(queued) {
  return queued ? ' <span class="queued-icon" title="Queued — not yet synced">📵</span>' : '';
}

/* ── Admin ── */

function renderAdminOverview() {
  const sites = state.data.sites;
  const assessments = sites.reduce((n, s) => n + (s.assessments || []).length, 0);
  const reports = (state.data.communityReports || []).length;
  const support = (state.data.supportRequests || []).length;
  const verified = sites.filter(s => determineTrustTier(s) === 'field_verified' || determineTrustTier(s) === 'field_verified_open').length;

  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="value">${sites.length}</div><div class="label">Registered Sites</div></div>
      <div class="stat-card"><div class="value">${assessments}</div><div class="label">Field Assessments</div></div>
      <div class="stat-card"><div class="value">${reports}</div><div class="label">Community Reports</div></div>
      <div class="stat-card"><div class="value">${support}</div><div class="label">Support Requests</div></div>
      <div class="stat-card"><div class="value">${verified}</div><div class="label">Verified Sites</div></div>
    </div>
    <div class="card">
      <h2>Trust Tiers</h2>
      ${renderTierBar(sites)}
    </div>
    <div class="card">
      <h2>All Sites</h2>
      ${renderSiteList(sites)}
    </div>
    <div class="card">
      <h2>Community Reports</h2>
      ${renderAdminReportsTable()}
    </div>
    <div class="btn-group">
      <a href="deck.html" class="btn btn-outline btn-sm">Presentation Deck</a>
      <button class="btn btn-outline btn-sm" id="btn-reset">Clear Local Data</button>
    </div>
  `;
}

function renderSiteList(sites) {
  if (!sites.length) return '<p class="empty-state">No sites registered yet.</p>';
  return sites.map(s => `
    <div class="site-row" data-view-site="${s.id}">
      <div>
        <strong>${s.name}</strong>${syncIcon(s.queued)}
        <span class="site-row-meta">${s.region}, ${s.country}</span>
      </div>
      <span class="trust-badge ${getTrustBadgeClass(determineTrustTier(s))}">${getTrustTierLabel(determineTrustTier(s))}</span>
    </div>
  `).join('');
}

function renderAdminReportsTable() {
  const reports = state.data.communityReports || [];
  if (!reports.length) return '<p style="color:var(--slate-muted)">No reports yet.</p>';
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Site</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>
          ${reports.map(r => `
            <tr>
              <td>${r.siteName}</td>
              <td>${r.typeLabel}</td>
              <td>${r.reportedAt}</td>
              <td><button class="status-pill status-${r.status}" data-advance-report="${r.id}">${REPORT_STATUS_LABELS[r.status] || r.status}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p style="font-size:0.8rem;color:var(--slate-muted);margin-top:0.5rem">Tap status to advance: Submitted → Under Review → Verified → Resolved</p>
  `;
}

function renderAllSites() {
  return `<div class="card"><h2>All Sites</h2>${renderSiteList(state.data.sites)}</div>`;
}

/* ── Government ── */

function renderGovOverview() {
  const sites = state.data.sites;
  const ready = sites.filter(s => determineTrustTier(s) === 'field_verified');
  const awaiting = sites.filter(s => ['registered', 'self_assessed'].includes(determineTrustTier(s)));
  const formalization = (state.data.supportRequests || []).filter(r => r.type === 'formalization');
  const concernCounts = {};
  (state.data.communityReports || []).filter(r => r.type === 'concern').forEach(r => {
    concernCounts[r.siteId] = (concernCounts[r.siteId] || 0) + 1;
  });
  const repeatedConcerns = sites.filter(s => (concernCounts[s.id] || 0) >= 2);

  return `
    <div class="card">
      <h2>Government Dashboard</h2>
      <p style="font-size:0.9rem;color:var(--slate-muted);margin-bottom:1rem">Which sites deserve public attention?</p>
      ${renderTierBar(sites)}
    </div>
    <div class="gov-sections">
      <div class="card">
        <h2>Sites Ready for Licensing</h2>
        <p style="font-size:0.8rem;color:var(--slate-muted);margin-bottom:0.75rem">Field-Verified with no open concerns</p>
        ${ready.length ? renderSiteList(ready) : '<p class="empty-state">None yet</p>'}
      </div>
      <div class="card">
        <h2>Sites Awaiting Verification</h2>
        <p style="font-size:0.8rem;color:var(--slate-muted);margin-bottom:0.75rem">Registered or Self-Assessed — need Field Officer visit</p>
        ${awaiting.length ? renderSiteList(awaiting) : '<p class="empty-state">None</p>'}
      </div>
      <div class="card">
        <h2>Sites Requesting Formalization Support</h2>
        ${formalization.length ? formalization.map(r => `
          <div class="site-row" data-view-site="${r.siteId}">
            <div><strong>${r.siteName}</strong><span class="site-row-meta">${r.date}</span></div>
          </div>
        `).join('') : '<p class="empty-state">None</p>'}
      </div>
      <div class="card">
        <h2>Sites with Repeated Community Concerns</h2>
        <p style="font-size:0.8rem;color:var(--slate-muted);margin-bottom:0.75rem">Two or more Concern reports — early warning</p>
        ${repeatedConcerns.length ? repeatedConcerns.map(s => `
          <div class="site-row" data-view-site="${s.id}">
            <div><strong>${s.name}</strong><span class="site-row-meta">${concernCounts[s.id]} concerns logged</span></div>
          </div>
        `).join('') : '<p class="empty-state">None</p>'}
      </div>
    </div>
    <div class="disclaimer">SiteCore surfaces patterns only — licensing decisions, fee relief, and enforcement remain with your office.</div>
  `;
}

/* ── Field Officer ── */

function renderFieldAssess() {
  const sites = state.data.sites;
  const siteButtons = sites.map(s =>
    `<button type="button" class="site-pick-btn ${state.selectedSiteId === s.id ? 'active' : ''}" data-pick-site="${s.id}">${s.name}</button>`
  ).join('');

  const selected = sites.find(s => s.id === state.selectedSiteId) || sites[0];
  if (selected && !state.selectedSiteId) state.selectedSiteId = selected?.id;

  const checklist = PILLARS.map(pillar => {
    const items = PRACTICES.filter(p => p.pillar === pillar.key);
    return `
      <div class="pillar-card">
        <h4>${pillar.label}</h4>
        ${items.map(p => `
          <label class="practice-check">
            <input type="checkbox" name="practice" value="${p.id}">
            <span>${p.label}</span>
          </label>
        `).join('')}
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <h2>Assess a Site</h2>
      <p style="font-size:0.85rem;color:var(--slate-muted);margin-bottom:1rem">Tap each practice you personally observed. Unchecked items stay open for next time.</p>
      <div class="site-pick-row">${siteButtons || '<p>No sites registered yet.</p>'}</div>
      ${selected ? `
        <form id="form-assess">
          <input type="hidden" name="siteId" value="${selected.id}">
          <div class="pillar-grid">${checklist}</div>
          <div class="form-group full" style="margin-top:1rem">
            <label>Field Notes</label>
            <textarea name="notes" placeholder="Additional observations..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Submit Assessment</button>
        </form>
      ` : ''}
    </div>
  `;
}

function renderRegisterForm() {
  const gps = state._pendingGPS;
  return `
    <div class="card">
      <h2>Register New Site</h2>
      <form id="form-register">
        <div class="form-grid">
          <div class="form-group"><label>Site Name *</label><input name="name" required placeholder="e.g. Sunrise Cooperative"></div>
          <div class="form-group"><label>Country *</label>
            <select name="country" required>${COUNTRIES.map(c => `<option>${c}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>Commodity *</label><input name="commodity" value="Gold" readonly></div>
          <div class="form-group"><label>District / Region</label><input name="region" placeholder="Optional"></div>
          <div class="form-group"><label>Contact Person</label><input name="contact" placeholder="Optional"></div>
        </div>
        <div class="gps-block">
          <button type="button" class="btn btn-outline" id="btn-capture-gps">Capture GPS Location</button>
          ${gps ? `
            <div class="gps-result">
              <strong>GPS Captured</strong><br>
              ${gps.lat}, ${gps.lng}<br>
              Accuracy: ±${gps.accuracy}m · ${new Date(gps.timestamp).toLocaleString()}
            </div>
          ` : '<p style="font-size:0.85rem;color:var(--slate-muted);margin-top:0.5rem">Simulates device GPS — works without network.</p>'}
        </div>
        <button type="submit" class="btn btn-primary" ${!gps ? 'disabled' : ''}>Register Site</button>
      </form>
    </div>
  `;
}

/* ── Site Rep ── */

function renderSiteRepView() {
  const siteId = SITE_REP_SITE_ID;
  const site = state.data.sites.find(s => s.id === siteId);
  if (!site) return '<p>Site not found</p>';

  const supportHtml = SUPPORT_TYPES.map(s => `
    <button class="support-btn" data-support="${s.id}">
      <strong>${s.label}</strong>
      <span>${s.desc}</span>
    </button>
  `).join('');

  const requests = (state.data.supportRequests || []).filter(r => r.siteId === siteId);

  const canSelfAssess = !site.selfAssessment && !(site.assessments || []).length;

  return `
    ${renderTrustProfile(siteId)}
    ${canSelfAssess ? `
    <div class="card">
      <h2>Self-Assessment Checklist</h2>
      <p style="font-size:0.85rem;color:var(--slate-muted);margin-bottom:1rem">Submit your own checklist — unconfirmed until a Field Officer visits.</p>
      <form id="form-self-assess">
        <div class="pillar-grid">${PILLARS.map(pillar => {
          const items = PRACTICES.filter(p => p.pillar === pillar.key);
          return `<div class="pillar-card"><h4>${pillar.label}</h4>${items.map(p => `
            <label class="practice-check"><input type="checkbox" name="practice" value="${p.id}"><span>${p.label}</span></label>
          `).join('')}</div>`;
        }).join('')}</div>
        <button type="submit" class="btn btn-primary" style="margin-top:1rem">Submit Self-Assessment</button>
      </form>
    </div>` : ''}
    <div class="card">
      <h2>Request Support</h2>
      <p style="font-size:0.85rem;color:var(--slate-muted);margin-bottom:1rem">SiteCore sends the introduction — the loan, advance, or licensing decision happens directly between you and that provider.</p>
      <div class="support-grid">${supportHtml}</div>
      ${requests.length ? `
        <h3 style="margin-top:1.25rem">Your Requests</h3>
        <ul class="request-list">
          ${requests.map(r => `<li>${r.label} — ${r.date}${syncIcon(r.queued)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
}

/* ── Buyer ── */

function renderBuyerDiscover() {
  return `
    <div class="card">
      <h2>Discover Sites</h2>
      <div class="search-bar">
        <input id="search-input" placeholder="Search by name, region, or commodity...">
        <select id="filter-country"><option value="">All Countries</option>${COUNTRIES.map(c => `<option>${c}</option>`).join('')}</select>
        <select id="filter-commodity"><option value="">All Commodities</option><option>Gold</option></select>
        <select id="filter-trust">
          <option value="">All Trust Levels</option>
          <option value="registered">Registered</option>
          <option value="self_assessed">Self-Assessed</option>
          <option value="field_verified_open">Field-Verified · Open Item</option>
          <option value="field_verified">Field-Verified</option>
        </select>
      </div>
      <div id="search-results">${renderSearchResultsHTML()}</div>
    </div>
  `;
}

function renderSearchResultsHTML() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase();
  const country = document.getElementById('filter-country')?.value || '';
  const commodity = document.getElementById('filter-commodity')?.value || '';
  const trust = document.getElementById('filter-trust')?.value || '';

  let sites = [...state.data.sites];
  if (q) sites = sites.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.region || '').toLowerCase().includes(q) ||
    (s.country || '').toLowerCase().includes(q) ||
    (s.commodity || '').toLowerCase().includes(q)
  );
  if (country) sites = sites.filter(s => s.country === country);
  if (commodity) sites = sites.filter(s => s.commodity === commodity);
  if (trust) sites = sites.filter(s => determineTrustTier(s) === trust);

  if (!sites.length) return '<div class="empty-state"><div class="icon">🔍</div><p>No sites match</p></div>';

  return `<div class="site-cards">${sites.map(s => `
    <div class="site-card" data-view-site="${s.id}">
      <h3>${s.name}</h3>
      <div class="location">${s.region}, ${s.country}</div>
      <span class="trust-badge ${getTrustBadgeClass(determineTrustTier(s))}">${getTrustTierLabel(determineTrustTier(s))}</span>
      <div class="site-card-footer"><span style="color:var(--gold-dark)">View profile →</span></div>
    </div>
  `).join('')}</div>`;
}

function renderServiceNetwork() {
  return `
    <div class="card">
      <h2>Service Network</h2>
      <p style="font-size:0.85rem;color:var(--slate-muted);margin-bottom:1rem">Partner types sites can be connected to through SiteCore introductions.</p>
      <div class="service-grid">
        ${SERVICE_PARTNERS.map(p => `
          <div class="service-card">
            <span class="service-type">${p.type}</span>
            <strong>${p.name}</strong>
            <p>${p.desc}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ── Community ── */

function renderCommunityReportForm() {
  const sites = state.data.sites;
  const options = sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  return `
    <div class="card">
      <h2>Submit Report</h2>
      <form id="form-community-report">
        <div class="form-grid">
          <div class="form-group"><label>Report Type *</label>
            <select name="type" required>
              <option value="concern">Concern</option>
              <option value="improvement">Improvement</option>
            </select>
          </div>
          <div class="form-group"><label>Mining Site *</label>
            <select name="siteId" required>${options || '<option value="">No sites</option>'}</select>
          </div>
          <div class="form-group full"><label>Description *</label>
            <textarea name="description" required placeholder="Describe what you observed..."></textarea>
          </div>
          <div class="form-group full">
            <button type="button" class="btn btn-outline btn-sm" disabled>📷 Attach Photo (placeholder)</button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Submit Report</button>
      </form>
    </div>
    ${renderCommunityReportsList()}
  `;
}

function renderCommunityReportsList() {
  const reports = state.data.communityReports || [];
  if (!reports.length) return '';
  return `
    <div class="card">
      <h2>All Reports</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Site</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            ${[...reports].reverse().map(r => `
              <tr>
                <td>${r.siteName}${syncIcon(r.queued)}</td>
                <td>${r.typeLabel}</td>
                <td>${r.reportedAt}</td>
                <td><span class="status-pill status-${r.status}">${REPORT_STATUS_LABELS[r.status]}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ── Trust Profile ── */

function renderTrustProfile(siteId) {
  const site = state.data.sites.find(s => s.id === siteId);
  if (!site) return '<p>Site not found</p>';

  const stepIndex = getJourneyStepIndex(site);
  const journey = JOURNEY_STEPS.map((step, i) => {
    let cls = i < stepIndex ? 'done' : i === stepIndex ? 'current' : '';
    const icon = i < stepIndex ? '✓' : i + 1;
    return `<div class="journey-step ${cls}"><div class="journey-dot">${icon}</div><span>${step}</span></div>`;
  }).join('');

  const latest = (site.assessments || []).slice(-1)[0];
  const observed = latest ? latest.observed.map(id => PRACTICES.find(p => p.id === id)?.label).filter(Boolean) : [];
  const timeline = buildTimeline(site);
  const isBuyer = state.role === 'buyer';
  const tier = determineTrustTier(site);

  return `
    ${state.tab === 'profile-detail' ? '<button class="btn btn-outline btn-sm" id="btn-back" style="margin-bottom:1rem">← Back</button>' : ''}
    <div class="card">
      <div class="profile-header">
        <div class="profile-photo">${site.photo || '⛏️'}</div>
        <div class="profile-meta">
          <h2>${site.name}${syncIcon(site.queued)}</h2>
          <div class="site-id">${site.id}</div>
          <p style="color:var(--slate-muted)">${site.location}</p>
          <span class="trust-badge ${getTrustBadgeClass(tier)}">${getTrustTierLabel(tier)}</span>
          <p style="font-size:0.85rem;margin-top:0.5rem">${getLocationTrustLabel(site.locationTrust)}</p>
        </div>
      </div>

      <h3>Progress Journey</h3>
      <div class="trust-journey">${journey}</div>

      ${latest ? `
        <h3 style="margin-top:1.25rem">Observed Practices</h3>
        <ul class="practice-list">${observed.map(o => `<li>✓ ${o}</li>`).join('')}</ul>
        ${site.openImprovements?.length ? `
          <h3>Open Improvement Areas</h3>
          <ul class="improve-list">${site.openImprovements.map(o => `<li>${o}</li>`).join('')}</ul>
        ` : ''}
        <div class="notice notice-info" style="margin-top:0.75rem">
          <strong>Recommended next step:</strong> ${site.openImprovements?.length
            ? 'Schedule follow-up to address open improvement areas.'
            : 'Ready for formal market introduction.'}
        </div>
      ` : site.selfAssessment ? `
        <p style="color:var(--slate-muted);font-size:0.9rem">Self-assessment submitted — awaiting field verification.</p>
      ` : '<p style="color:var(--slate-muted);font-size:0.9rem">No field assessment yet.</p>'}

      <h3 style="margin-top:1.25rem">Timeline</h3>
      <div class="timeline">${timeline}</div>

      ${isBuyer ? `
        <div class="buyer-panel">
          <h3>Buyer Panel</h3>
          <p><strong>Available Contact:</strong> ${site.contact || '—'} · ${site.cooperative || 'Independent'}</p>
          <div class="btn-group">
            <button class="btn btn-outline" id="btn-contact-site">Contact Site</button>
            <button class="btn btn-gold" id="btn-request-intro" ${site.introductionRequested ? 'disabled' : ''}>
              ${site.introductionRequested ? 'Introduction Requested' : 'Request Introduction'}
            </button>
          </div>
        </div>
      ` : ''}

      <div class="btn-group no-print" style="margin-top:1rem">
        <button class="btn btn-outline btn-sm" id="btn-print-profile">Print Trust Profile</button>
      </div>
    </div>
  `;
}

function buildTimeline(site) {
  const items = [];
  items.push({ date: site.registeredAt, title: 'Site Registered', desc: site.registeredBy });
  if (site.selfAssessment) {
    items.push({ date: site.selfAssessment.date, title: 'Self-Assessment Submitted', desc: 'Site representative completed checklist' });
  }
  (site.assessments || []).forEach(a => {
    items.push({
      date: a.date,
      title: 'Field Assessment',
      desc: `${a.officer}: ${a.observed.length}/${PRACTICES.length} practices observed. ${a.notes || ''}`
    });
  });
  (site.timeline || []).forEach(t => items.push(t));
  (state.data.supportRequests || []).filter(r => r.siteId === site.id).forEach(r => {
    items.push({ date: r.date, title: `Support Request: ${r.label}`, desc: r.queued ? 'Queued for sync' : 'Introduction logged' });
  });
  if (site.introductionRequested) {
    items.push({ date: site.introDate || new Date().toISOString().slice(0, 10), title: 'Connected to Formal Market', desc: 'Buyer requested introduction' });
  }
  (state.data.communityReports || []).filter(r => r.siteId === site.id).forEach(r => {
    items.push({ date: r.reportedAt, title: `Community ${r.typeLabel}`, desc: r.description });
  });

  return items.sort((a, b) => b.date.localeCompare(a.date)).map(i => `
    <div class="timeline-item">
      <div class="date">${i.date}</div>
      <div class="title">${i.title}</div>
      <div class="desc">${i.desc}</div>
    </div>
  `).join('') || '<p style="color:var(--slate-muted)">No history yet.</p>';
}

/* ── Site Map ── */

function renderMapView() {
  const sites = state.data.sites;
  const dots = sites.map(s => {
    const pos = mapPosition(s.lat, s.lng, sites);
    return `<button class="map-dot ${getLocationDotClass(s.locationTrust)}" style="left:${pos.x}%;top:${pos.y}%" data-view-site="${s.id}" title="${s.name}"></button>`;
  }).join('');

  const pin = state.mapPin ? `<div class="map-pin" style="left:${state.mapPin.x}%;top:${state.mapPin.y}%"></div>` : '';

  return `
    <div class="container container-wide view">
      <button class="btn btn-outline btn-sm" id="btn-back-dashboard" style="margin-bottom:1rem">← Back to Dashboard</button>
      <div class="card">
        <h2>Site Map</h2>
        <p style="font-size:0.85rem;color:var(--slate-muted);margin-bottom:1rem">Schematic layout — positions reflect real coordinates relative to each other. Works fully offline.</p>
        <div class="schematic-map" id="schematic-map">
          ${dots}${pin}
        </div>
        <div class="map-legend">
          <span><i class="legend-dot loc-approximate"></i> Approximate</span>
          <span><i class="legend-dot loc-captured"></i> GPS Captured</span>
          <span><i class="legend-dot loc-verified"></i> GPS Verified</span>
        </div>
        <button class="btn btn-outline" id="btn-self-register">Self-Register (Drop Pin)</button>
        ${state.mapPin ? renderMapRegisterForm() : ''}
      </div>
    </div>
  `;
}

function renderMapRegisterForm() {
  return `
    <form id="form-map-register" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
      <h3>Register Approximate Site</h3>
      <div class="form-grid">
        <div class="form-group"><label>Name *</label><input name="name" required></div>
        <div class="form-group"><label>Country *</label><select name="country" required>${COUNTRIES.map(c => `<option>${c}</option>`).join('')}</select></div>
        <div class="form-group"><label>Commodity</label><input name="commodity" value="Gold" readonly></div>
        <div class="form-group"><label>Contact</label><input name="contact"></div>
      </div>
      <button type="submit" class="btn btn-primary">Register Site</button>
    </form>
  `;
}

/* ── Event Handlers ── */

function bindDashboardEvents() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });
  document.querySelectorAll('[data-view-site]').forEach(el => {
    el.addEventListener('click', () => showSiteProfile(el.dataset.viewSite));
  });
  document.querySelectorAll('[data-pick-site]').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedSiteId = el.dataset.pickSite;
      render();
    });
  });
  document.querySelectorAll('[data-advance-report]').forEach(el => {
    el.addEventListener('click', () => advanceReportStatus(el.dataset.advanceReport));
  });
  document.querySelectorAll('[data-support]').forEach(el => {
    el.addEventListener('click', () => submitSupportRequest(el.dataset.support));
  });

  document.getElementById('form-register')?.addEventListener('submit', handleRegister);
  document.getElementById('btn-capture-gps')?.addEventListener('click', () => {
    state._pendingGPS = simulateGPS();
    render();
  });
  document.getElementById('form-assess')?.addEventListener('submit', handleAssessment);
  document.getElementById('form-community-report')?.addEventListener('submit', handleCommunityReport);
  document.getElementById('form-self-assess')?.addEventListener('submit', handleSelfAssessment);
  document.getElementById('btn-back')?.addEventListener('click', () => {
    state.selectedSiteId = null;
    state.tab = state.role === 'buyer' ? 'discover' : getDefaultTab(state.role);
    render();
  });
  document.getElementById('btn-print-profile')?.addEventListener('click', () => {
    window.open(`print-profile.html?site=${state.selectedSiteId}`, '_blank');
  });
  document.getElementById('btn-contact-site')?.addEventListener('click', () => {
    showToast('Contact request logged — SiteCore simulates the introduction (no real message sent)', 'info');
  });
  document.getElementById('btn-request-intro')?.addEventListener('click', handleIntroRequest);
  document.getElementById('search-input')?.addEventListener('input', updateSearch);
  document.getElementById('filter-country')?.addEventListener('change', updateSearch);
  document.getElementById('filter-commodity')?.addEventListener('change', updateSearch);
  document.getElementById('filter-trust')?.addEventListener('change', updateSearch);
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    if (confirm('Clear local data and start fresh?')) {
      refreshData();
    }
  });
}

function bindMapEvents() {
  document.getElementById('btn-back-dashboard')?.addEventListener('click', () => {
    state.view = 'dashboard';
    state.mapPin = null;
    render();
  });
  document.querySelectorAll('[data-view-site]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      showSiteProfile(el.dataset.viewSite);
    });
  });
  document.getElementById('btn-self-register')?.addEventListener('click', () => {
    state.mapPin = { x: 50, y: 50 };
    render();
  });
  document.getElementById('schematic-map')?.addEventListener('click', e => {
    if (e.target.classList.contains('map-dot')) return;
    if (state.mapPin !== null || document.getElementById('form-map-register')) {
      const rect = e.currentTarget.getBoundingClientRect();
      state.mapPin = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100
      };
      render();
    }
  });
  document.getElementById('form-map-register')?.addEventListener('submit', handleMapRegister);
}

function updateSearch() {
  const el = document.getElementById('search-results');
  if (el) {
    el.innerHTML = renderSearchResultsHTML();
    document.querySelectorAll('[data-view-site]').forEach(el2 => {
      el2.addEventListener('click', () => showSiteProfile(el2.dataset.viewSite));
    });
  }
}

function handleRegister(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const gps = state._pendingGPS;
  if (!gps) return;

  const count = state.data.sites.length + 1;
  const country = fd.get('country');
  const site = {
    id: generateSiteId(country, count),
    name: fd.get('name'),
    location: `${fd.get('region') || 'Unknown'}, ${country}`,
    region: fd.get('region') || '',
    country,
    commodity: fd.get('commodity') || 'Gold',
    cooperative: 'Independent',
    contact: fd.get('contact') || '',
    phone: '',
    productionEstimate: 'Unknown',
    trustTier: 'registered',
    locationTrust: 'gps_captured',
    lat: gps.lat,
    lng: gps.lng,
    gpsCapture: gps,
    registeredAt: new Date().toISOString().slice(0, 10),
    registeredBy: 'Field Officer — Current User',
    photo: '⛏️',
    selfAssessment: null,
    assessments: [],
    openImprovements: [],
    connectedToMarket: false,
    introductionRequested: false,
    timeline: [],
    queued: false
  };

  queueItem({ type: 'register', ref: site });
  state.data.sites.push(site);
  addTimeline(site, 'Site Registered', `GPS captured at ${gps.lat}, ${gps.lng}`);
  state._pendingGPS = null;
  persist();
  showToast(state.offline ? `${site.name} registered — queued for sync` : `${site.name} registered`);
  state.tab = 'register';
  render();
}

function handleMapRegister(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const count = state.data.sites.length + 1;
  const country = fd.get('country');
  const lat = -6 + Math.random() * 12;
  const lng = 28 + Math.random() * 14;

  const site = {
    id: generateSiteId(country, count),
    name: fd.get('name'),
    location: `${country} (approximate)`,
    region: '',
    country,
    commodity: 'Gold',
    cooperative: 'Independent',
    contact: fd.get('contact') || '',
    phone: '',
    productionEstimate: 'Unknown',
    trustTier: 'registered',
    locationTrust: 'approximate',
    lat, lng,
    registeredAt: new Date().toISOString().slice(0, 10),
    registeredBy: 'Self-registered via map',
    photo: '📍',
    selfAssessment: null,
    assessments: [],
    openImprovements: [],
    connectedToMarket: false,
    introductionRequested: false,
    timeline: [],
    queued: false
  };

  queueItem({ type: 'register', ref: site });
  state.data.sites.push(site);
  addTimeline(site, 'Self-Registered', 'Approximate location — pending Field Officer confirmation');
  state.mapPin = null;
  persist();
  showToast('Site registered with approximate location');
  render();
}

function handleAssessment(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const siteId = fd.get('siteId');
  const site = state.data.sites.find(s => s.id === siteId);
  if (!site) return;

  const observed = fd.getAll('practice');
  const unchecked = PRACTICES.filter(p => !observed.includes(p.id));

  const assessment = {
    id: `A${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    officer: 'Field Officer — Current User',
    observed,
    notes: fd.get('notes') || '',
    verified: true
  };

  site.assessments = site.assessments || [];
  site.assessments.push(assessment);
  site.openImprovements = unchecked.map(p => `Improve: ${p.label}`);
  site.locationTrust = 'gps_verified';
  site.trustTier = determineTrustTier(site);

  queueItem({ type: 'assessment', ref: site });
  addTimeline(site, 'Field Assessment', `${observed.length}/${PRACTICES.length} practices observed`);
  persist();
  showToast(state.offline ? 'Assessment saved — queued for sync' : `Assessment submitted for ${site.name}`);
  showSiteProfile(siteId);
}

function handleCommunityReport(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const siteId = fd.get('siteId');
  const site = state.data.sites.find(s => s.id === siteId);
  if (!site) return;

  const type = fd.get('type');
  const report = {
    id: generateReportId((state.data.communityReports || []).length + 1),
    siteId,
    siteName: site.name,
    type,
    typeLabel: type === 'improvement' ? 'Improvement' : 'Concern',
    description: fd.get('description'),
    reporterName: 'Community Member',
    reportedAt: new Date().toISOString().slice(0, 10),
    status: 'submitted',
    queued: false
  };

  state.data.communityReports = state.data.communityReports || [];
  queueItem({ type: 'report', ref: report });
  state.data.communityReports.push(report);
  persist();
  showToast(state.offline ? 'Report queued for sync' : 'Report submitted');
  state.tab = 'reports-list';
  render();
}

function handleSelfAssessment(e) {
  e.preventDefault();
  const site = state.data.sites.find(s => s.id === SITE_REP_SITE_ID);
  if (!site) return;

  const observed = new FormData(e.target).getAll('practice');
  site.selfAssessment = {
    date: new Date().toISOString().slice(0, 10),
    observed
  };
  site.trustTier = determineTrustTier(site);
  queueItem({ type: 'self_assess', ref: site });
  addTimeline(site, 'Self-Assessment Submitted', `${observed.length} practices self-reported`);
  persist();
  showToast('Self-assessment submitted — awaiting field verification');
  render();
}

function submitSupportRequest(typeId) {
  const site = state.data.sites.find(s => s.id === SITE_REP_SITE_ID);
  const type = SUPPORT_TYPES.find(t => t.id === typeId);
  if (!site || !type) return;

  const req = {
    id: generateSupportId((state.data.supportRequests || []).length + 1),
    siteId: site.id,
    siteName: site.name,
    type: typeId,
    label: type.label,
    date: new Date().toISOString().slice(0, 10),
    queued: false
  };

  state.data.supportRequests = state.data.supportRequests || [];
  queueItem({ type: 'support', ref: req });
  state.data.supportRequests.push(req);
  addTimeline(site, `Support Request: ${type.label}`, 'Introduction logged — decision happens directly with provider');
  persist();
  showToast(`${type.label} request logged`);
  render();
}

function handleIntroRequest() {
  const site = state.data.sites.find(s => s.id === state.selectedSiteId);
  if (!site || site.introductionRequested) return;

  site.introductionRequested = true;
  site.connectedToMarket = true;
  site.introDate = new Date().toISOString().slice(0, 10);
  site.trustTier = determineTrustTier(site);
  addTimeline(site, 'Connected to Formal Market', 'Buyer requested introduction via SiteCore');
  persist();
  showToast(`${site.name} marked Connected to Formal Market`);
  render();
}

function advanceReportStatus(reportId) {
  const report = state.data.communityReports.find(r => r.id === reportId);
  if (!report) return;
  const idx = REPORT_STATUSES.indexOf(report.status);
  if (idx < REPORT_STATUSES.length - 1) {
    report.status = REPORT_STATUSES[idx + 1];
    persist();
    render();
  }
}

function toggleOffline() {
  state.offline = !state.offline;
  persist();
  render();
}

function syncAll() {
  state.data.pendingSync = [];
  state.data.sites.forEach(s => { s.queued = false; });
  (state.data.communityReports || []).forEach(r => { r.queued = false; });
  (state.data.supportRequests || []).forEach(r => { r.queued = false; });
  persist();
  showToast('All items synced');
  render();
}

function refreshData() {
  resetData();
  state.data = loadData();
  state.demoBanner = null;
  state._pendingGPS = null;
  persist();
  render();
  showToast('Data cleared — ready to load from Supabase');
}
