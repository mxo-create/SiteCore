/* SiteCore MVP — Application logic (per SiteCore Manual) */

const ROLES = {
  admin: { label: 'SiteCore Administrator', short: 'Admin', icon: '⚙️' },
  field: { label: 'Field Officer', short: 'Field', icon: '🔍' },
  site: { label: 'Mining Site/Cooperative', short: 'Site', icon: '⛏️' },
  government: { label: 'Government / Public Sector', short: 'Gov', icon: '🏛️' },
  partner: { label: 'Development & Technical Partner', short: 'Partner', icon: '🤝' },
  processor: { label: 'Processor/Refinery', short: 'Processor', icon: '🏭' },
  buyer: { label: 'Buyer / Market Actor', short: 'Buyer', icon: '💼' },
  community: { label: 'Community Member', short: 'Community', icon: '👥' }
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
  data: loadData(),
  partnerFilters: { region: '', need: '', priority: '', status: '' },
  processorFilters: { distanceKm: '', commodity: '' }
};

// Restore demo current user mapping from persisted data (so a newly registered site remains "my site" after refresh)
state.currentUserId = state.data.currentUserId || null;

function getCurrentUserId() {
  return state.currentUserId || SITE_REP_SITE_ID;
}

state.offline = state.data.offline ?? false;

document.addEventListener('DOMContentLoaded', () => render());

// Attempt an initial silent pull from Supabase (merge, non-destructive) for demo sync
async function initialSyncFromSupabase() {
  if (!(window.isSupabaseConfigured && window.isSupabaseConfigured())) return;
  try {
    const payload = await window.supabasePullAll();
    if (payload) {
      mergeSupabasePayload(payload);
      persist();
      render();
      console.log('Initial supabase pull merged');
    }
  } catch (e) { console.warn('Initial supabase pull failed', e); }
}
initialSyncFromSupabase();

function persist() {
  state.data.offline = state.offline;
  // persist current demo user mapping so refresh keeps the registered site as the current user
  if (state.currentUserId) state.data.currentUserId = state.currentUserId;
  saveData(state.data);
  renderHeader();
  // Auto push local changes to Supabase (non-blocking). This implements push-on-change.
  if (window.isSupabaseConfigured && window.isSupabaseConfigured()) {
    (async () => {
      try {
        await window.supabasePushAll(state.data);
        console.log('Auto-pushed state to Supabase');
      } catch (e) {
        console.warn('Auto-push to Supabase failed', e);
      }
    })();
  }
}

function setRole(role) {
  if (role === 'admin' && !state.adminAuthenticated) {
    authenticateAdmin();
    return;
  }

  state.role = role;
  state.view = 'dashboard';
  state.tab = getDefaultTab(role);
  state.selectedSiteId = role === 'site' ? getCurrentUserId() : null;
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
  state.selectedSiteId = getCurrentUserId();
  state.fieldMode = 'assess';
  render();
  showToast('Admin access closed', 'info');
}

function getDefaultTab(role) {
  return {
    admin: 'overview',
    field: 'assess',
    site: 'profile',
    government: 'overview',
    partner: 'partner-dashboard',
    processor: 'discover',
    buyer: 'discover',
    community: 'report'
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

// Onboarding removed for demo mode

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
          ${state.adminAuthenticated ? '<button class="btn btn-sm btn-outline" id="btn-force-sync">Force Sync</button>' : ''}
          <button class="btn btn-sm ${state.view === 'map' ? 'btn-gold' : 'btn-outline'}" id="btn-sitemap" style="color:#fff;border-color:rgba(255,255,255,0.3)">Site Map</button>
          ${state.adminAuthenticated ? '<button class="btn btn-sm btn-gold" id="btn-refresh">Refresh Data</button>' : ''}
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
  // Join/Sign-in removed for demo mode; admin access remains via ADMIN LOGIN
  document.getElementById('btn-sitemap')?.addEventListener('click', openMap);
  document.getElementById('btn-refresh')?.addEventListener('click', refreshData);
  document.getElementById('btn-force-sync')?.addEventListener('click', async () => {
    if (!(window.isSupabaseConfigured && window.isSupabaseConfigured())) {
      showToast('Supabase not configured', 'error');
      return;
    }
    showToast('Force syncing: pushing local changes...', 'info');
    try { await window.supabasePushAll(state.data); showToast('Push complete — pulling latest...', 'info'); } catch(e){ console.warn('Force push failed', e); showToast('Force push failed', 'error'); }
    try { const payload = await window.supabasePullAll(); if (payload) { mergeSupabasePayload(payload); persist(); showToast('Force sync completed', 'success'); render(); } } catch(e){ console.warn('Force pull failed', e); showToast('Force pull failed', 'error'); }
  });
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
    // Admin approvals tab (admin only)
    case 'approvals': content = renderAdminApprovals(); break;
    case 'organizations': content = renderAdminOrganizations(); if (state._editingOrg) content = renderOrgEditForm(state._editingOrg); break;
    case 'sites': content = renderAllSites(); break;
    case 'assess': content = renderFieldAssess(); break;
    case 'register': content = renderRegisterForm(); break;
    case 'profile': content = renderSiteRepView(); break;
    case 'requests': content = renderSiteRequests(); break;
    case 'nearby-processors': content = renderSiteNearbyProcessors(); break;
    case 'discover': content = renderBuyerDiscover(); break;
    case 'discover-sites': content = renderProcessorDiscoverSites(); break;
    case 'processor-profile': content = renderProcessorProfile(); break;
    case 'services': content = renderServiceNetwork(); break;
    case 'profile-detail': content = renderTrustProfile(state.selectedSiteId); break;
    case 'report': content = renderCommunityReportForm(); break;
    case 'reports-list': content = renderCommunityReportsList(); break;
    case 'partner-dashboard': content = renderPartnerDashboard(); break;
    case 'partner-interventions': content = renderPartnerInterventions(); break;
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
      { id: 'overview', label: '📊 Dashboard' },
      { id: 'approvals', label: '🔓 Approvals' },
      { id: 'organizations', label: '🏢 Organizations' },
      { id: 'sites', label: '⛏️ All Sites' }
    ],
    field: [
      { id: 'assess', label: 'Assess a Site' },
      { id: 'register', label: 'Register New Site' }
    ],
    site: [
      { id: 'profile', label: 'My Site Profile' },
      { id: 'requests', label: 'My Support Requests' },
      { id: 'nearby-processors', label: 'Nearby Services' }
    ],
    government: [
      { id: 'overview', label: '🏛️ Government Dashboard' },
      { id: 'sites', label: 'All Sites' }
    ],
    partner: [
      { id: 'partner-dashboard', label: '🤝 Support Opportunities' },
      { id: 'partner-interventions', label: 'My Interventions' }
    ],
    processor: [
      { id: 'processor-profile', label: 'My Organization' },
      { id: 'discover-sites', label: 'Discover Sites' },
      { id: 'services', label: 'Service Network' }
    ],
    buyer: [
      { id: 'discover', label: 'Discover Sites' },
      { id: 'services', label: 'Service Network' }
    ],
    community: [
      { id: 'report', label: 'Submit Report' },
      { id: 'reports-list', label: 'All Reports' }
    ]
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

  // Filter sites based on role permissions
  const visibleSites = filterSitesForRole(sites, state.role, getCurrentUserId(), state.data);

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
      ${renderSiteList(visibleSites)}
    </div>
    <div class="card">
      <h2>Community Reports</h2>
      ${renderAdminReportsTable()}
    </div>
    <div class="btn-group">
      <a href="deck.html" class="btn btn-outline btn-sm">Presentation Deck</a>
      <button class="btn btn-outline btn-sm" id="btn-load-demo">Load Demo Data</button>
      <button class="btn btn-outline btn-sm" id="btn-reset">Clear Local Data</button>
    </div>
  `;
}

function renderAdminApprovals() {
  const pending = state.data.pendingApprovals || [];
  if (!pending.length) return '<div class="card"><h2>Pending Approvals</h2><p class="empty-state">No pending approvals.</p></div>';
  return `
    <div class="card">
      <h2>Pending Approvals</h2>
      ${pending.map(p => `
        <div style="padding:0.75rem;border-bottom:1px solid var(--border)">
          <strong>${p.displayName}</strong> · <span style="color:var(--slate-muted)">${p.role}</span>
          <div style="margin-top:0.5rem;font-size:0.85rem;color:var(--slate-muted)">${p.notes || ''}</div>
          <div style="margin-top:0.5rem">
            <button class="btn btn-sm btn-gold" data-approve="${p.id}">Approve</button>
            <button class="btn btn-sm btn-outline" data-reject="${p.id}">Reject</button>
            <button class="btn btn-sm btn-outline" data-view-pending="${p.id}">View</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderAdminOrganizations() {
  const orgs = state.data.organizations || [];
  return `
    <div class="card">
      <h2>Organizations</h2>
      ${orgs.length ? orgs.map(o => `
        <div style="padding:0.75rem;border-bottom:1px solid var(--border)">
          <strong>${o.name}</strong>
          <div style="font-size:0.85rem;color:var(--slate-muted)">Verified: ${o.verified ? 'Yes' : 'No'}</div>
          <div style="margin-top:0.5rem">
            <button class="btn btn-sm btn-outline" data-edit-org="${o.id}">Edit</button>
          </div>
        </div>
      `).join('') : '<p class="empty-state">No organisations yet.</p>'}
    </div>
  `;
}

function renderOrgEditForm(orgId) {
  const org = (state.data.organizations || []).find(o => o.id === orgId) || { id: orgId, name: '', verified: false, contact: '', services: '', mercuryFree: false, location: '' };
  return `
    <div class="card">
      <h2>Edit Organization</h2>
      <form id="form-edit-org">
        <input type="hidden" name="id" value="${org.id}">
        <div class="form-grid">
          <div class="form-group"><label>Name</label><input name="name" value="${org.name}"></div>
          <div class="form-group"><label>Contact</label><input name="contact" value="${org.contact || ''}"></div>
          <div class="form-group"><label>Services (comma-separated)</label><input name="services" value="${(org.services || '').toString()}"></div>
          <div class="form-group"><label>Location</label><input name="location" value="${org.location || ''}"></div>
          <div class="form-group"><label>Mercury-Free Verified</label><select name="mercuryFree"><option value="false" ${org.mercuryFree ? '' : 'selected'}>No</option><option value="true" ${org.mercuryFree ? 'selected' : ''}>Yes</option></select></div>
        </div>
        <div style="margin-top:0.5rem"><button class="btn btn-primary" type="submit">Save</button></div>
      </form>
    </div>
  `;
}

function editOrganization(orgId) {
  state._editingOrg = orgId;
  state.tab = 'organizations';
  render();
}

function saveOrganization(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  const name = fd.get('name');
  const contact = fd.get('contact');
  const services = fd.get('services') || '';
  const location = fd.get('location') || '';
  const mercuryFree = fd.get('mercuryFree') === 'true';

  state.data.organizations = state.data.organizations || [];
  let org = state.data.organizations.find(o => o.id === id);
  if (!org) {
    org = { id, name, contact, services: services.split(',').map(s=>s.trim()), location, mercuryFree, verified: false };
    state.data.organizations.push(org);
  } else {
    org.name = name; org.contact = contact; org.services = services.split(',').map(s=>s.trim()); org.location = location; org.mercuryFree = mercuryFree;
  }
  persist();
  showToast('Organization saved');
  state._editingOrg = null;
  render();
}

function renderSiteList(sites) {
  if (!sites.length) return '<p class="empty-state">No sites registered yet.</p>';
  return sites.map(s => `
    <div class="site-row" data-view-site="${s.id}">
      <div>
        <strong>${s.name}</strong>${syncIcon(s.queued)}
        <span class="site-row-meta">${s.region}, ${s.country}</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem">
        <span class="trust-badge ${getTrustBadgeClass(determineTrustTier(s))}">${getTrustTierLabel(determineTrustTier(s))}</span>
        ${state.adminAuthenticated ? `<button class="btn btn-sm btn-outline" data-delete-site="${s.id}">Delete</button>` : ''}
      </div>
    </div>
  `).join('');
}

function renderAdminReportsTable() {
  // Filter reports based on role permissions
  const reports = filterReportsForRole(state.data.communityReports || [], state.role, getCurrentUserId(), state.data);
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
  const allSites = filterSitesForRole(state.data.sites, state.role, getCurrentUserId(), state.data);
  return `<div class="card"><h2>All Sites</h2>${renderSiteList(allSites)}</div>`;
}

/* ── Government ── */

function renderGovOverview() {
  const allSites = state.data.sites;
  // Filter to verified sites only for government view
  const visibleSites = filterSitesForRole(allSites, state.role, getCurrentUserId(), state.data);
  
  const ready = visibleSites.filter(s => determineTrustTier(s) === 'field_verified');
  const awaiting = visibleSites.filter(s => ['registered', 'self_assessed'].includes(determineTrustTier(s)));
  
  const formalization = filterRequestsForRole(
    (state.data.supportRequests || []).filter(r => r.type === 'formalisation'),
    state.role, getCurrentUserId(), state.data
  );
  
  const concernCounts = {};
  (state.data.communityReports || []).filter(r => r.type === 'concern').forEach(r => {
    concernCounts[r.siteId] = (concernCounts[r.siteId] || 0) + 1;
  });
  const repeatedConcerns = visibleSites.filter(s => (concernCounts[s.id] || 0) >= 2);

  return `
    <div class="card">
      <h2>Government Dashboard</h2>
      <p style="font-size:0.9rem;color:var(--slate-muted);margin-bottom:1rem">Which sites deserve public attention?</p>
      ${renderTierBar(visibleSites)}
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
  const siteId = getCurrentUserId();
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
      <div style="margin-bottom:0.5rem">
        <label style="font-size:0.85rem;color:var(--slate-muted);margin-right:0.5rem">Priority:</label>
        <select id="support-priority" style="padding:0.25rem">
          <option value="high">High</option>
          <option value="medium" selected>Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
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

  // Apply permission filtering first
  let sites = filterSitesForRole(state.data.sites, state.role, getCurrentUserId(), state.data);
  
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
  // Community can report on any site they know about (by name), but we don't show sensitive data
  const sites = state.data.sites.map(s => ({ id: s.id, name: s.name })); // Only name and ID
  const options = sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  return `
    <div class="card">
      <h2>Submit Report</h2>
      <p style="font-size:0.9rem;color:var(--slate-muted);margin-bottom:1rem">Help improve mining practices by sharing what you observe.</p>
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
  // Filter reports based on role - community only sees verified reports, and only improvements (not concerns)
  const allReports = state.data.communityReports || [];
  const visibleReports = allReports.filter(r => {
    // Community sees only verified reports and only improvements for public awareness
    if (state.role === 'community') {
      return r.status === 'verified' && r.type === 'improvement';
    }
    // Admin/field see all reports
    return true;
  });

  if (!visibleReports.length) return '';
  return `
    <div class="card">
      <h2>All Reports</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Site</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            ${[...visibleReports].reverse().map(r => `
              <tr>
                <td>${r.siteName}${syncIcon(r.queued)}</td>
                <td>${r.typeLabel}</td>
                <td>${r.reportedAt}</td>
                <td><span class="status-pill status-${r.status}">${REPORT_STATUS_LABELS[r.status]}</span></td>
                ${state.adminAuthenticated ? `<td><button class="btn btn-sm btn-outline" data-delete-report="${r.id}">Delete</button></td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function deleteSite(siteId) {
  if (!state.adminAuthenticated) { if (!authenticateAdmin()) return; }
  if (!confirm('Delete this site record permanently?')) return;
  state.data.sites = (state.data.sites || []).filter(s => s.id !== siteId);
  // remove related items
  state.data.communityReports = (state.data.communityReports || []).filter(r => r.siteId !== siteId);
  state.data.supportRequests = (state.data.supportRequests || []).filter(r => r.siteId !== siteId);
  persist();
  // attempt server-side delete if configured
  if (window.isSupabaseConfigured && window.isSupabaseConfigured() && window.supabaseDeleteEntity) {
    (async () => {
      try { await window.supabaseDeleteEntity('sites', siteId); console.log('Deleted site on Supabase', siteId); } catch (e) { console.warn('Supabase delete failed', e); }
    })();
  }
  showToast('Site deleted', 'info');
  render();
}

function deleteReport(reportId) {
  if (!state.adminAuthenticated) { if (!authenticateAdmin()) return; }
  if (!confirm('Delete this community report permanently?')) return;
  state.data.communityReports = (state.data.communityReports || []).filter(r => r.id !== reportId);
  persist();
  if (window.isSupabaseConfigured && window.isSupabaseConfigured() && window.supabaseDeleteEntity) {
    (async () => { try { await window.supabaseDeleteEntity('communityReports', reportId); } catch (e) { console.warn('Supabase delete failed', e); } })();
  }
  showToast('Report deleted', 'info');
  render();
}

function deleteSupportRequest(requestId) {
  if (!state.adminAuthenticated) { if (!authenticateAdmin()) return; }
  if (!confirm('Delete this support request permanently?')) return;
  state.data.supportRequests = (state.data.supportRequests || []).filter(r => r.id !== requestId);
  persist();
  if (window.isSupabaseConfigured && window.isSupabaseConfigured() && window.supabaseDeleteEntity) {
    (async () => { try { await window.supabaseDeleteEntity('supportRequests', requestId); } catch (e) { console.warn('Supabase delete failed', e); } })();
  }
  showToast('Support request deleted', 'info');
  render();
}

/* ── Trust Profile ── */

function renderTrustProfile(siteId) {
  const site = state.data.sites.find(s => s.id === siteId);
  if (!site) return '<p>Site not found</p>';

  // Check if user has permission to view this site
  if (!canViewSite(siteId, state.role, getCurrentUserId(), state.data)) {
    return '<p class="notice notice-error">You do not have permission to view this site.</p>';
  }

  // Apply data masking based on role
  const displaySite = maskSensitiveFields(site, state.role);

  const stepIndex = getJourneyStepIndex(displaySite);
  const journey = JOURNEY_STEPS.map((step, i) => {
    let cls = i < stepIndex ? 'done' : i === stepIndex ? 'current' : '';
    const icon = i < stepIndex ? '✓' : i + 1;
    return `<div class="journey-step ${cls}"><div class="journey-dot">${icon}</div><span>${step}</span></div>`;
  }).join('');

  const latest = (displaySite.assessments || []).slice(-1)[0];
  const observed = latest ? latest.observed.map(id => PRACTICES.find(p => p.id === id)?.label).filter(Boolean) : [];
  const timeline = buildTimeline(displaySite);
  const isBuyer = state.role === 'buyer';
  const tier = determineTrustTier(displaySite);

  // Calculate connections
  const supportRequests = (state.data.supportRequests || []).filter(r => r.siteId === siteId);
  const connections = supportRequests.filter(r => r.status === 'matched' || r.status === 'in_progress' || r.status === 'completed').length;

  return `
    ${state.tab === 'profile-detail' ? '<button class="btn btn-outline btn-sm" id="btn-back" style="margin-bottom:1rem">← Back</button>' : ''}
    <div class="card">
      <div class="profile-header">
        <div class="profile-photo">${displaySite.photo || '⛏️'}</div>
        <div class="profile-meta">
          <h2>${displaySite.name}${syncIcon(displaySite.queued)}</h2>
          <div class="site-id">${displaySite.id}</div>
          <p style="color:var(--slate-muted)">${displaySite.location}</p>
          <span class="trust-badge ${getTrustBadgeClass(tier)}">${getTrustTierLabel(tier)}</span>
          <p style="font-size:0.85rem;margin-top:0.5rem">${getLocationTrustLabel(displaySite.locationTrust)}</p>
        </div>
      </div>

      <h3 style="margin-top:1.25rem">Profile Summary</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
        <div style="border-left:3px solid var(--gold);padding-left:1rem">
          <div style="font-size:0.9rem;color:var(--slate-muted)">Registered</div>
          <div style="font-weight:600">${displaySite.registeredAt}</div>
        </div>
        <div style="border-left:3px solid var(--blue-base);padding-left:1rem">
          <div style="font-size:0.9rem;color:var(--slate-muted)">Support Requests</div>
          <div style="font-weight:600">${supportRequests.length}</div>
        </div>
        <div style="border-left:3px solid var(--green-base);padding-left:1rem">
          <div style="font-size:0.9rem;color:var(--slate-muted)">Verified By</div>
          <div style="font-weight:600">${(displaySite.assessments || []).length > 0 ? 'Field Verified' : 'Pending'}</div>
        </div>
        <div style="border-left:3px solid var(--gold-light);padding-left:1rem">
          <div style="font-size:0.9rem;color:var(--slate-muted)">Active Connections</div>
          <div style="font-weight:600">${connections}</div>
        </div>
      </div>

      <h3>Progress Journey</h3>
      <div class="trust-journey">${journey}</div>

      ${latest ? `
        <h3 style="margin-top:1.25rem">Observed Practices</h3>
        <ul class="practice-list">${observed.map(o => `<li>✓ ${o}</li>`).join('')}</ul>
        ${displaySite.openImprovements?.length ? `
          <h3>Open Improvement Areas</h3>
          <ul class="improve-list">${displaySite.openImprovements.map(o => `<li>${o}</li>`).join('')}</ul>
        ` : ''}
        <div class="notice notice-info" style="margin-top:0.75rem">
          <strong>Recommended next step:</strong> ${displaySite.openImprovements?.length
            ? 'Schedule follow-up to address open improvement areas.'
            : 'Ready for formal market introduction.'}
        </div>
      ` : displaySite.selfAssessment ? `
        <p style="color:var(--slate-muted);font-size:0.9rem">Self-assessment submitted — awaiting field verification.</p>
      ` : '<p style="color:var(--slate-muted);font-size:0.9rem">No field assessment yet.</p>'}

      <h3 style="margin-top:1.25rem">Timeline</h3>
      <div class="timeline">${timeline}</div>

      ${supportRequests.length > 0 ? `
        <h3 style="margin-top:1.25rem">Support & Connections</h3>
        ${supportRequests.map(r => `
          <div style="padding:0.75rem;background:var(--off-white);border-radius:6px;margin-bottom:0.5rem">
            <strong>${r.label}</strong>
            <span class="status-pill status-${r.status}" style="margin-left:0.5rem;font-size:0.75rem">${SUPPORT_REQUEST_STATUS_LABELS[r.status]}</span>
            <div style="font-size:0.85rem;color:var(--slate-muted);margin-top:0.25rem">Requested: ${r.date}</div>
          </div>
        `).join('')}
      ` : ''}

      ${isBuyer ? `
        <div class="buyer-panel" style="margin-top:1.25rem;padding:1rem;background:var(--gold-muted);border-radius:6px">
          <h3>Buyer Contact</h3>
          <p><strong>Available Contact:</strong> ${displaySite.contact || '—'} · ${displaySite.cooperative || 'Independent'}</p>
          <div class="btn-group">
            <button class="btn btn-outline" id="btn-contact-site">Contact Site</button>
            <button class="btn btn-gold" id="btn-request-intro" ${displaySite.introductionRequested ? 'disabled' : ''}>
              ${displaySite.introductionRequested ? 'Introduction Requested' : 'Request Introduction'}
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
  // Filter sites based on role permissions
  const allSites = state.data.sites;
  const visibleSites = filterSitesForRole(allSites, state.role, getCurrentUserId(), state.data);
  const providers = state.data.serviceProviders || [];
  
  // Render site dots for visible sites only
  const siteDots = visibleSites.map(s => {
    const pos = mapPosition(s.lat, s.lng, allSites);
    const icon = state.role === 'processor' ? '🏔️' : '⛏️';
    return `<button class="map-dot ${getLocationDotClass(s.locationTrust)}" style="left:${pos.x}%;top:${pos.y}%;font-size:0.8rem;line-height:1;" data-view-site="${s.id}" title="${s.name}">${icon}</button>`;
  }).join('');

  // Render provider dots if role is site, processor, or admin
  const providerDots = (state.role === 'site' || state.role === 'processor' || state.role === 'admin' || state.role === 'government') && providers.length ? providers.map(p => {
    const allLocs = [...allSites, ...providers];
    const pos = mapPosition(p.lat, p.lng, allLocs);
    const typeIcon = { 'Refinery': '🏭', 'Assay Lab': '🔬', 'Training': '📚' }[p.type] || '🏢';
    return `<button class="map-dot" style="left:${pos.x}%;top:${pos.y}%;background:#c9a227;font-size:0.8rem;line-height:1;" data-view-provider="${p.id}" title="${p.name}">${typeIcon}</button>`;
  }).join('') : '';

  const pin = state.mapPin ? `<div class="map-pin" style="left:${state.mapPin.x}%;top:${state.mapPin.y}%"></div>` : '';

  const legend = `
    <div class="map-legend">
      <span><i class="legend-dot loc-approximate"></i> Approximate Site</span>
      <span><i class="legend-dot loc-captured"></i> GPS Captured</span>
      <span><i class="legend-dot loc-verified"></i> GPS Verified</span>
      ${providers.length ? '<span><i class="legend-dot" style="background:#c9a227"></i> Service Provider</span>' : ''}
    </div>
  `;

  return `
    <div class="container container-wide view">
      <button class="btn btn-outline btn-sm" id="btn-back-dashboard" style="margin-bottom:1rem">← Back to Dashboard</button>
      <div class="card">
        <h2>🗺️ Ecosystem Map</h2>
        <p style="font-size:0.85rem;color:var(--slate-muted);margin-bottom:1rem">Schematic layout showing sites${providers.length ? ' and service providers' : ''}. Positions reflect real coordinates relative to each other. Works fully offline.</p>
        <div class="schematic-map" id="schematic-map">
          ${siteDots}${providerDots}${pin}
        </div>
        ${legend}
        ${state.role === 'field' ? '<button class="btn btn-outline" id="btn-self-register">Self-Register (Drop Pin)</button>' : ''}
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
  document.querySelectorAll('[data-delete-site]').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); deleteSite(el.dataset.deleteSite); }); });
  document.querySelectorAll('[data-delete-report]').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); deleteReport(el.dataset.deleteReport); }); });
  document.querySelectorAll('[data-delete-request]').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); deleteSupportRequest(el.dataset.deleteRequest); }); });
  document.querySelectorAll('[data-support]').forEach(el => {
    el.addEventListener('click', () => submitSupportRequest(el.dataset.support));
  });
  document.querySelectorAll('[data-match-request]').forEach(el => {
    el.addEventListener('click', () => matchSupportRequest(el.dataset.matchRequest));
  });
  document.querySelectorAll('[data-advance-request]').forEach(el => {
    el.addEventListener('click', () => advanceSupportRequest(el.dataset.advanceRequest));
  });
  document.querySelectorAll('[data-view-site-detail]').forEach(el => {
    el.addEventListener('click', () => showSiteProfile(el.dataset.viewSiteDetail));
  });
  document.querySelectorAll('[data-complete-intervention]').forEach(el => {
    el.addEventListener('click', () => completeIntervention(el.dataset.completeIntervention));
  });
  document.querySelectorAll('[id^="btn-request-"]').forEach(el => {
    el.addEventListener('click', () => {
      const typeId = el.id.replace('btn-request-', '');
      submitSupportRequest(typeId);
    });
  });
  document.querySelectorAll('[data-request-intro-provider]').forEach(el => {
    el.addEventListener('click', () => requestIntroduction(el.dataset.requestIntroProvider));
  });
  document.querySelectorAll('[data-contact-site]').forEach(el => {
    el.addEventListener('click', () => contactSite(el.dataset.contactSite));
  });

  document.getElementById('form-register')?.addEventListener('submit', handleRegister);
  document.getElementById('btn-capture-gps')?.addEventListener('click', () => {
    state._pendingGPS = simulateGPS();
    render();
  });
  document.getElementById('form-assess')?.addEventListener('submit', handleAssessment);
  document.getElementById('form-community-report')?.addEventListener('submit', handleCommunityReport);
  document.getElementById('form-self-assess')?.addEventListener('submit', handleSelfAssessment);
  document.getElementById('support-priority')?.addEventListener('change', (e) => { state._selectedSupportPriority = e.target.value; });
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
  document.getElementById('btn-load-demo')?.addEventListener('click', () => {
    generateDemoData();
    state.data = loadData();
    state.demoBanner = '✓ Demo data loaded successfully';
    render();
    setTimeout(() => { state.demoBanner = null; render(); }, 5000);
  });

  // Partner filter bindings
  document.getElementById('partner-filter-region')?.addEventListener('change', (e) => { state.partnerFilters.region = e.target.value; render(); });
  document.getElementById('partner-filter-need')?.addEventListener('change', (e) => { state.partnerFilters.need = e.target.value; render(); });
  document.getElementById('partner-filter-priority')?.addEventListener('change', (e) => { state.partnerFilters.priority = e.target.value; render(); });
  document.getElementById('partner-filter-status')?.addEventListener('change', (e) => { state.partnerFilters.status = e.target.value; render(); });
  document.getElementById('partner-clear-filters')?.addEventListener('click', () => { state.partnerFilters = { region: '', need: '', priority: '', status: '' }; render(); });
  // Processor filter bindings
  document.getElementById('processor-filter-distance')?.addEventListener('input', (e) => { state.processorFilters.distanceKm = e.target.value; render(); });
  document.getElementById('processor-filter-commodity')?.addEventListener('change', (e) => { state.processorFilters.commodity = e.target.value; render(); });
  document.getElementById('processor-clear-filters')?.addEventListener('click', () => { state.processorFilters = { distanceKm: '', commodity: '' }; render(); });
  // Admin approval bindings
  document.querySelectorAll('[data-approve]').forEach(el => { el.addEventListener('click', () => approvePending(el.dataset.approve)); });
  document.querySelectorAll('[data-reject]').forEach(el => { el.addEventListener('click', () => rejectPending(el.dataset.reject)); });
  document.querySelectorAll('[data-view-pending]').forEach(el => { el.addEventListener('click', () => viewPending(el.dataset.viewPending)); });
  document.querySelectorAll('[data-edit-org]').forEach(el => { el.addEventListener('click', () => editOrganization(el.dataset.editOrg)); });
  document.getElementById('form-edit-org')?.addEventListener('submit', saveOrganization);
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
  document.querySelectorAll('[data-view-provider]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      showToast(`Provider: ${el.title} — contact information available in service network`, 'info');
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

// Onboarding handlers removed for demo mode

function sendNotification(note) {
  state.data.notifications = state.data.notifications || [];
  const n = { id: `N-${Date.now()}`, to: note.to, subject: note.subject, body: note.body, date: new Date().toISOString() };
  state.data.notifications.push(n);
  // Mock send: log to console
  console.log('Mock email sent:', n);
}

function approvePending(pendingId) {
  const pending = (state.data.pendingApprovals || []).find(p => p.id === pendingId);
  if (!pending) return;
  const user = (state.data.users || []).find(u => u.id === pending.userId);
  if (user) user.status = 'approved';
  if (pending.orgId) {
    const org = (state.data.organizations || []).find(o => o.id === pending.orgId);
    if (org) org.verified = true;
  }
  state.data.pendingApprovals = (state.data.pendingApprovals || []).filter(p => p.id !== pendingId);
  persist();
  showToast(`${pending.displayName} approved`);
  sendNotification({ to: pending.email, subject: 'SiteCore account approved', body: `Hello ${pending.displayName}, your SiteCore account has been approved.` });
  render();
}

function viewPending(pendingId) {
  const pending = (state.data.pendingApprovals || []).find(p => p.id === pendingId);
  if (!pending) return;
  alert(`Pending approval for ${pending.displayName}\nRole: ${pending.role}\nEmail: ${pending.email}\nNotes: ${pending.notes || ''}`);
}

function rejectPending(pendingId) {
  const pending = (state.data.pendingApprovals || []).find(p => p.id === pendingId);
  if (!pending) return;
  const user = (state.data.users || []).find(u => u.id === pending.userId);
  if (user) user.status = 'rejected';
  state.data.pendingApprovals = (state.data.pendingApprovals || []).filter(p => p.id !== pendingId);
  persist();
  showToast(`${pending.displayName} rejected`, 'error');
  sendNotification({ to: pending.email, subject: 'SiteCore account rejected', body: `Hello ${pending.displayName}, your SiteCore registration was rejected.` });
  render();
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
  // Auto-link this newly registered site as the current demo site user and persist immediately
  state.currentUserId = site.id;
  state.role = 'site';
  state.selectedSiteId = site.id;
  persist();
  showToast(state.offline ? `${site.name} registered — queued for sync` : `${site.name} registered`);
  state.tab = 'profile';
  render();

  // Auto-push the new site to Supabase (non-blocking)
  if (window.isSupabaseConfigured && window.isSupabaseConfigured()) {
    (async () => {
      try {
        await window.supabasePushAll({ sites: [site] });
        console.log('Auto-pushed new site to Supabase');
      } catch (e) { console.warn('Auto-push failed', e); }
    })();
  }
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
  // Auto-link and persist so the new site shows on the Site profile immediately
  state.currentUserId = site.id;
  state.role = 'site';
  state.selectedSiteId = site.id;
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
  const site = state.data.sites.find(s => s.id === getCurrentUserId());
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
  const site = state.data.sites.find(s => s.id === getCurrentUserId());
  const type = SUPPORT_TYPES.find(t => t.id === typeId);
  if (!site || !type) return;

  const req = {
    id: generateSupportId((state.data.supportRequests || []).length + 1),
    siteId: site.id,
    siteName: site.name,
    type: typeId,
    label: type.label,
    date: new Date().toISOString().slice(0, 10),
    status: 'submitted',
    queued: false,
    priority: state._selectedSupportPriority || 'medium'
  };

  state.data.supportRequests = state.data.supportRequests || [];
  queueItem({ type: 'support', ref: req });
  state.data.supportRequests.push(req);
  addTimeline(site, `Support Request: ${type.label}`, 'Introduction logged — decision happens directly with provider');
  persist();
  showToast(`${type.label} request logged`);
  render();
}

function advanceSupportRequest(requestId) {
  const req = state.data.supportRequests.find(r => r.id === requestId);
  if (!req) return;
  const idx = SUPPORT_REQUEST_STATUSES.indexOf(req.status);
  if (idx < SUPPORT_REQUEST_STATUSES.length - 1) {
    req.status = SUPPORT_REQUEST_STATUSES[idx + 1];
    if (req.status === 'matched') req.dateMatched = new Date().toISOString().slice(0, 10);
    if (req.status === 'completed') req.dateCompleted = new Date().toISOString().slice(0, 10);
    persist();
    render();
  }
}

function matchSupportRequest(requestId) {
  const req = state.data.supportRequests.find(r => r.id === requestId);
  if (!req) return;

  req.status = 'matched';
  req.dateMatched = new Date().toISOString().slice(0, 10);
  persist();
  showToast(`Request matched — site will be notified`);
  // Notify site contact (mocked)
  const site = state.data.sites.find(s => s.id === req.siteId);
  const to = site?.contact || `${req.siteName}`;
  sendNotification({ to, subject: `Your ${req.label} request was matched`, body: `Your request for ${req.label} has been matched by a partner.` });
  render();
}

function completeIntervention(requestId) {
  const req = state.data.supportRequests.find(r => r.id === requestId);
  if (!req) return;

  req.status = 'completed';
  req.dateCompleted = new Date().toISOString().slice(0, 10);
  persist();
  showToast(`Intervention marked complete`);
  render();
}

function requestIntroduction(providerId) {
  const provider = (state.data.serviceProviders || []).find(p => p.id === providerId);
  if (!provider) return;

  showToast(`Introduction request sent to ${provider.name} — you will be contacted directly`, 'success');
}

async function pushToSupabase() {
  if (!(window.isSupabaseConfigured && window.isSupabaseConfigured())) {
    showToast('Supabase not configured. See README and js/supabase-config.example.js', 'error');
    return;
  }
  try {
    showToast('Pushing data to Supabase...', 'info');
    const res = await window.supabasePushAll(state.data);
    console.log('Supabase push result', res);
    showToast('Data pushed to Supabase', 'success');
  } catch (e) {
    console.error(e);
    showToast('Push to Supabase failed: ' + (e.message || e), 'error');
  }
}

async function pullFromSupabase() {
  if (!(window.isSupabaseConfigured && window.isSupabaseConfigured())) {
    showToast('Supabase not configured. See README and js/supabase-config.example.js', 'error');
    return;
  }
  if (!confirm('Pulling from Supabase will replace local data. Continue?')) return;
  try {
    showToast('Pulling data from Supabase...', 'info');
    const payload = await window.supabasePullAll();
    if (!payload) {
      showToast('No data found in Supabase', 'error');
      return;
    }
    mergeSupabasePayload(payload);
    persist();
    showToast('Data pulled from Supabase and merged locally', 'success');
    render();
  } catch (e) {
    console.error(e);
    showToast('Pull from Supabase failed: ' + (e.message || e), 'error');
  }
}

function mergeSupabasePayload(payload) {
  // payload: { sites: [...], supportRequests: [...], users: [...], organizations: [...], ... }
  if (!payload) return;
  const tables = Object.keys(payload || {});
  tables.forEach(t => {
    const rows = payload[t] || [];
    state.data[t] = state.data[t] || [];

    // Build local index by id
    const localIndex = {};
    state.data[t].forEach((r, i) => { if (r && r.id) localIndex[r.id] = i; });

    rows.forEach(serverRow => {
      const id = serverRow.id || (serverRow.payload && serverRow.payload.id);
      const serverObj = serverRow.payload ? serverRow.payload : serverRow;
      if (!id) return;

      const li = localIndex[id];
      if (typeof li === 'number') {
        // If local item is queued for sync, preserve it; otherwise replace with server version
        const localItem = state.data[t][li];
        if (localItem && localItem.queued) {
          // keep local queued version
          return;
        }
        state.data[t][li] = { ...serverObj };
      } else {
        // new server row -> add to local
        state.data[t].push({ ...serverObj });
      }
    });
  });
}

function contactSite(siteId) {
  const site = state.data.sites.find(s => s.id === siteId);
  if (!site) return;

  showToast(`Contact request logged for ${site.name} — introduction initiated`, 'success');
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
  // Only admin may clear local data
  if (!state.adminAuthenticated) {
    const ok = authenticateAdmin();
    if (!ok) {
      showToast('Admin access required to clear data', 'error');
      return;
    }
  }
  if (!confirm('This will permanently clear all local data. Continue?')) return;
  resetData();
  state.data = loadData();
  state.demoBanner = null;
  state._pendingGPS = null;
  state.currentUserId = state.data.currentUserId || null;
  persist();
  render();
  showToast('Data cleared — ready to load from Supabase');
}

/* ── Site Support Requests ── */

function renderSiteRequests() {
  const site = state.data.sites.find(s => s.id === getCurrentUserId());
  if (!site) return '<p>Site not found</p>';

  const requests = (state.data.supportRequests || []).filter(r => r.siteId === site.id);
  const supportTypeMap = Object.fromEntries(SUPPORT_TYPES.map(t => [t.id, t]));

  const requestsList = requests.length ? requests.map(r => {
    const type = supportTypeMap[r.type];
    const statusLabel = SUPPORT_REQUEST_STATUS_LABELS[r.status] || r.status;
    return `
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h3>${type.label}${syncIcon(r.queued)}</h3>
            <p style="color:var(--slate-muted);font-size:0.9rem">${type.desc}</p>
            <div style="margin-top:0.5rem">
              <span class="status-pill status-${r.status}">${statusLabel}</span>
              <span style="color:var(--slate-muted);font-size:0.85rem;margin-left:0.5rem">Submitted: ${r.date}</span>
            </div>
          </div>
          <div style="text-align:right">
            ${r.status === 'matched' ? '<div style="color:var(--green-strong);font-weight:600">✓ Partner Found</div>' : ''}
            ${r.status === 'in_progress' ? '<div style="color:var(--blue-strong);font-weight:600">In Progress</div>' : ''}
            ${r.status === 'completed' ? '<div style="color:var(--slate-success);font-weight:600">✓ Complete</div>' : ''}
            ${state.adminAuthenticated ? `<div style="margin-top:0.5rem"><button class="btn btn-sm btn-outline" data-delete-request="${r.id}">Delete</button></div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('') : '<p class="empty-state">No support requests yet. Fill out the form below to request support.</p>';

  return `
    <div class="card">
      <h2>Your Support Requests</h2>
      <p style="color:var(--slate-muted)">Track support needs and development partner matches here.</p>
        ${requestsList}
    </div>

    <div class="card">
      <h2>Request Support</h2>
      <p style="color:var(--slate-muted);margin-bottom:1rem">Indicate what type of support would help your site improve.</p>
      <div class="form-group">
        ${SUPPORT_TYPES.map(t => `
          <button class="btn btn-outline" id="btn-request-${t.id}" style="margin-bottom:0.5rem;width:100%;text-align:left;padding:0.75rem">
            <strong>${t.label}</strong><br><span style="font-size:0.85rem;color:var(--slate-muted)">${t.desc}</span>
          </button>
        `).join('')}
      </div>
    </div>

    <div class="notice notice-info">
      <strong>How it works:</strong> When you submit a support request, SiteCore will notify relevant development partners in your region. Partners can offer assistance directly, and you'll see matches appear in this list.
    </div>
  `;
}

/* ── Development Partner Dashboard ── */

function renderPartnerDashboard() {
  const requests = state.data.supportRequests || [];
  const supportTypeMap = Object.fromEntries(SUPPORT_TYPES.map(t => [t.id, t]));

  // Apply partner filters from state.partnerFilters
  const pf = state.partnerFilters || { region: '', need: '', priority: '', status: '' };
  let visible = requests.filter(r => ['submitted', 'under_review', 'matched'].includes(r.status));
  if (pf.need) visible = visible.filter(r => r.type === pf.need);
  if (pf.priority) visible = visible.filter(r => r.priority === pf.priority);
  if (pf.status) visible = visible.filter(r => r.status === pf.status);
  if (pf.region) visible = visible.filter(r => {
    const site = state.data.sites.find(s => s.id === r.siteId);
    return site && site.region === pf.region;
  });

  // Group visible requests by type
  const byType = {};
  visible.forEach(r => { if (!byType[r.type]) byType[r.type] = []; byType[r.type].push(r); });

  const typeGroups = Object.entries(byType).map(([typeId, reqs]) => {
    const type = supportTypeMap[typeId];
    return `
      <div class="card">
        <h3>${type.label} (${reqs.length})</h3>
        ${reqs.map(r => `
          <div style="padding:0.75rem;border-left:3px solid var(--blue-base);background:rgba(59,130,246,0.05);margin-bottom:0.5rem">
            <div style="display:flex;justify-content:space-between">
              <div>
                <strong>${r.siteName}</strong>
                <span style="color:var(--slate-muted);font-size:0.85rem;margin-left:0.5rem">ID: ${r.siteId}</span>
              </div>
              <span class="status-pill status-${r.status}" data-advance-request="${r.id}">${SUPPORT_REQUEST_STATUS_LABELS[r.status]}</span>
            </div>
            <div style="margin-top:0.5rem;font-size:0.9rem;color:var(--slate-muted)">Submitted: ${r.date} · Priority: ${r.priority || 'medium'}</div>
            <div style="margin-top:0.5rem">
              <button class="btn btn-sm btn-gold" data-match-request="${r.id}">Offer Support</button>
              <button class="btn btn-sm btn-outline" data-view-site-detail="${r.siteId}">View Site</button>
              ${state.adminAuthenticated ? `<button class="btn btn-sm btn-outline" data-delete-request="${r.id}">Delete</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  const regions = Array.from(new Set((state.data.sites || []).map(s => s.region).filter(Boolean)));

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${visible.length}</div>
        <div class="label">Support Opportunities</div>
      </div>
      <div class="stat-card">
        <div class="value">${Object.keys(byType).length}</div>
        <div class="label">Types of Need</div>
      </div>
      <div class="stat-card">
        <div class="value">${requests.filter(r => r.status === 'in_progress').length}</div>
        <div class="label">Active Interventions</div>
      </div>
    </div>

    <div class="card">
      <h3>Filter Opportunities</h3>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <select id="partner-filter-region"><option value="">All Regions</option>${regions.map(r => `<option value="${r}" ${pf.region===r? 'selected':''}>${r}</option>`).join('')}</select>
        <select id="partner-filter-need"><option value="">All Needs</option>${SUPPORT_TYPES.map(t => `<option value="${t.id}" ${pf.need===t.id? 'selected':''}>${t.label}</option>`).join('')}</select>
        <select id="partner-filter-priority"><option value="">All Priority</option><option value="high" ${pf.priority==='high'?'selected':''}>High</option><option value="medium" ${pf.priority==='medium'?'selected':''}>Medium</option><option value="low" ${pf.priority==='low'?'selected':''}>Low</option></select>
        <select id="partner-filter-status"><option value="">Any Status</option>${SUPPORT_REQUEST_STATUSES.map(s => `<option value="${s}" ${pf.status===s? 'selected':''}>${SUPPORT_REQUEST_STATUS_LABELS[s]}</option>`).join('')}</select>
        <button class="btn btn-sm btn-outline" id="partner-clear-filters">Clear</button>
      </div>
    </div>

    ${typeGroups.length > 0 ? typeGroups : '<div class="card"><p class="empty-state">No support requests match the selected filters.</p></div>'}

    <div class="card">
      <h3>How the Partnership Works</h3>
      <ol style="color:var(--slate-default)">
        <li><strong>Discover:</strong> Browse requests surfaced from site representatives.</li>
        <li><strong>Assess:</strong> Review the site profile and request details.</li>
        <li><strong>Offer:</strong> Click "Offer Support" to match your organisation to a specific need.</li>
        <li><strong>Assign & Track:</strong> Mark status updates as you progress (Under Review → Matched → In Progress → Completed).</li>
      </ol>
    </div>
  `;
}

/* ── Development Partner Interventions ── */

function renderPartnerInterventions() {
  const requests = state.data.supportRequests || [];
  const inProgress = requests.filter(r => r.status === 'in_progress');
  const completed = requests.filter(r => r.status === 'completed');

  const inProgressCards = inProgress.map(r => `
    <div class="card">
      <div style="display:flex;justify-content:space-between">
        <div>
          <h3>${r.siteName}</h3>
          <p style="color:var(--slate-muted)">${SUPPORT_TYPES.find(t => t.id === r.type)?.label || r.type}</p>
          <p style="font-size:0.85rem;color:var(--slate-muted)">Started: ${r.dateMatched || r.date}</p>
        </div>
        <span class="status-pill status-in_progress">In Progress</span>
      </div>
      <div style="margin-top:0.75rem">
        <button class="btn btn-sm btn-outline" data-view-site-detail="${r.siteId}">View Site Profile</button>
        <button class="btn btn-sm btn-gold" data-complete-intervention="${r.id}">Mark Complete</button>
      </div>
    </div>
  `).join('');

  const completedCards = completed.map(r => `
    <div class="card" style="opacity:0.85;background:var(--slate-lightest)">
      <div style="display:flex;justify-content:space-between">
        <div>
          <h3>${r.siteName}</h3>
          <p style="color:var(--slate-muted)">${SUPPORT_TYPES.find(t => t.id === r.type)?.label || r.type}</p>
          <p style="font-size:0.85rem;color:var(--slate-muted)">Completed: ${r.dateCompleted || r.date}</p>
        </div>
        <span class="status-pill status-completed">✓ Complete</span>
      </div>
    </div>
  `).join('');

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${inProgress.length}</div>
        <div class="label">Active Interventions</div>
      </div>
      <div class="stat-card">
        <div class="value">${completed.length}</div>
        <div class="label">Completed</div>
      </div>
    </div>

    ${inProgress.length > 0 ? `
      <div class="card">
        <h2>Active Interventions</h2>
        ${inProgressCards}
      </div>
    ` : '<div class="card"><p class="empty-state">No active interventions.</p></div>'}

    ${completed.length > 0 ? `
      <div class="card">
        <h2>Completed Interventions</h2>
        ${completedCards}
      </div>
    ` : ''}
  `;
}

/* ── Two-Way Service Discovery ── */

function renderSiteNearbyProcessors() {
  const siteId = getCurrentUserId();
  const site = state.data.sites.find(s => s.id === siteId);
  if (!site) return '<p>Site not found</p>';

  const providers = state.data.serviceProviders || [];
  const nearbyProviders = providers.sort((a, b) => {
    const distA = Math.sqrt(Math.pow(a.lat - site.lat, 2) + Math.pow(a.lng - site.lng, 2));
    const distB = Math.sqrt(Math.pow(b.lat - site.lat, 2) + Math.pow(b.lng - site.lng, 2));
    return distA - distB;
  });

  const providerCards = nearbyProviders.map((p, i) => {
    const distance = Math.round(Math.sqrt(Math.pow(p.lat - site.lat, 2) + Math.pow(p.lng - site.lng, 2)) * 111);
    const typeEmoji = { 'Refinery': '🏭', 'Assay Lab': '🔬', 'Training': '📚' }[p.type] || '🏢';
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h3>${typeEmoji} ${p.name}</h3>
            <p style="color:var(--slate-muted);font-size:0.9rem">${p.type}</p>
            <p style="font-size:0.85rem;color:var(--slate-muted)">${p.location}</p>
            ${p.mercuryFree ? '<span style="color:var(--success);font-weight:600">✓ Mercury-Free Certified</span>' : ''}
            ${p.verified ? '<span style="color:var(--blue-base);font-weight:600" style="margin-left:0.5rem">✓ Verified</span>' : ''}
          </div>
          <div style="text-align:right;font-size:0.9rem">
            <strong style="color:var(--gold-dark)">${distance} km</strong>
            <div style="font-size:0.8rem;color:var(--slate-muted)">away</div>
          </div>
        </div>
        <p style="margin-top:0.75rem;color:var(--slate-default)">${p.description}</p>
        <div style="margin-top:0.75rem">
          <span style="font-size:0.85rem;color:var(--slate-muted)">Services: ${p.services.join(', ')}</span>
        </div>
        <div style="margin-top:0.75rem">
          <button class="btn btn-sm btn-outline" data-view-provider="${p.id}">View Profile</button>
          <button class="btn btn-sm btn-gold" data-request-intro-provider="${p.id}">Request Introduction</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <h2>Nearby Responsible Service Providers</h2>
      <p style="color:var(--slate-muted);margin-bottom:1rem">Mercury-free processing, assay labs, and technical partners in your region.</p>
      ${nearbyProviders.length > 0 ? providerCards : '<p class="empty-state">No service providers nearby yet.</p>'}
    </div>
  `;
}

function renderProcessorProfile() {
  // Simulated processor organization profile
  const processorId = 'SP-DEMO-001';
  
  return `
    <div class="card">
      <h2>My Organization</h2>
      <div class="form-grid">
        <div class="form-group">
          <label>Organization Name</label>
          <input type="text" value="Ethical Gold Refinery Ltd." readonly style="background:var(--off-white)">
        </div>
        <div class="form-group">
          <label>Type</label>
          <input type="text" value="Refinery" readonly style="background:var(--off-white)">
        </div>
        <div class="form-group">
          <label>Location</label>
          <input type="text" value="Dar es Salaam, Tanzania" readonly style="background:var(--off-white)">
        </div>
        <div class="form-group">
          <label>Contact</label>
          <input type="text" value="info@ethicalgold.tz" readonly style="background:var(--off-white)">
        </div>
      </div>
      <div style="margin-top:1rem">
        <p><strong>Services:</strong> Gold refining, assay services</p>
        <p><strong>Status:</strong> <span style="color:var(--gold-dark);font-weight:600">✓ Verified</span></p>
        <p><strong>Last Verification:</strong> February 1, 2024</p>
        <p style="margin-top:0.75rem"><strong>Mercury-Free:</strong> Yes, fully certified</p>
      </div>
    </div>

    <div class="card">
      <h2>Organization Settings</h2>
      <p style="color:var(--slate-muted);margin-bottom:1rem">Update your organization profile and preferences.</p>
      <button class="btn btn-outline" disabled style="opacity:0.5">Edit Profile (coming soon)</button>
    </div>
  `;
}

function renderProcessorDiscoverSites() {
  const providers = state.data.serviceProviders || [];
  const currentProcessor = providers[0]; // Demo: use first provider
  if (!currentProcessor) return '<p>Processor profile not found</p>';

  // Filter sites based on role permissions (processor/buyer can only see verified/public sites)
  const allVisibleSites = filterSitesForRole(state.data.sites || [], state.role, getCurrentUserId(), state.data);
  
  const sites = allVisibleSites.sort((a, b) => {
    const distA = Math.sqrt(Math.pow(a.lat - currentProcessor.lat, 2) + Math.pow(a.lng - currentProcessor.lng, 2));
    const distB = Math.sqrt(Math.pow(b.lat - currentProcessor.lat, 2) + Math.pow(b.lng - currentProcessor.lng, 2));
    return distA - distB;
  });

  const nearbySites = sites.filter(s => {
    const dist = Math.sqrt(Math.pow(s.lat - currentProcessor.lat, 2) + Math.pow(s.lng - currentProcessor.lng, 2));
    return dist * 111 <= currentProcessor.radius; // Within service radius
  });

  const siteCards = nearbySites.map(s => `
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between">
        <div>
          <h3>${s.name}</h3>
          <p style="color:var(--slate-muted);font-size:0.9rem">${s.location}</p>
          <span class="trust-badge ${getTrustBadgeClass(determineTrustTier(s))}">${getTrustTierLabel(determineTrustTier(s))}</span>
        </div>
        <div style="text-align:right">
          <strong style="color:var(--gold-dark)">${Math.round(Math.sqrt(Math.pow(s.lat - currentProcessor.lat, 2) + Math.pow(s.lng - currentProcessor.lng, 2)) * 111)} km</strong>
        </div>
      </div>
      <div style="margin-top:0.75rem">
        <button class="btn btn-sm btn-outline" data-view-site-detail="${s.id}">View Profile</button>
        <button class="btn btn-sm btn-gold" data-contact-site="${s.id}">Contact Site</button>
      </div>
    </div>
  `).join('');

  // Processor-facing: Mercury-Free processing requests
  const mercuryRequestsAll = (state.data.supportRequests || []).filter(r => r.type === 'mercury-free' && ['submitted', 'under_review', 'matched'].includes(r.status));
  const pf = state.processorFilters || {};

  function distKmBetween(aLat, aLng, bLat, bLng) {
    const dLat = (aLat - bLat) * Math.PI / 180;
    const dLng = (aLng - bLng) * Math.PI / 180;
    const lat1 = aLat * Math.PI / 180;
    const lat2 = bLat * Math.PI / 180;
    const R = 6371; // km
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.sin(dLng/2)*Math.sin(dLng/2)*Math.cos(lat1)*Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Optionally filter mercury requests by processor radius or distanceKm filter
  const mercuryRequests = mercuryRequestsAll.filter(r => {
    const site = state.data.sites.find(s => s.id === r.siteId);
    if (!site) return false;
    if (pf.distanceKm) {
      const d = distKmBetween(site.lat, site.lng, currentProcessor.lat, currentProcessor.lng);
      if (d > Number(pf.distanceKm)) return false;
    }
    if (pf.commodity && pf.commodity !== '') {
      if ((site.commodity || '').toLowerCase() !== pf.commodity.toLowerCase()) return false;
    }
    return true;
  });
  const mercuryList = mercuryRequests.length ? mercuryRequests.map(r => `
    <div style="padding:0.5rem;border-left:3px solid var(--gold);margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center">
      <div>
        <strong>${r.siteName}</strong>
        <div style="font-size:0.85rem;color:var(--slate-muted)">Requested: ${r.date} · Status: ${SUPPORT_REQUEST_STATUS_LABELS[r.status]}</div>
      </div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-sm btn-outline" data-view-site-detail="${r.siteId}">View Site</button>
        <button class="btn btn-sm btn-gold" data-request-intro-provider="${currentProcessor.id}">Request Introduction</button>
      </div>
    </div>
  `).join('') : '<p class="empty-state">No Mercury-Free processing requests in your area.</p>';
  // Processor filter controls
  const commodities = Array.from(new Set((state.data.sites || []).map(s => s.commodity).filter(Boolean)));

  return `
    <div class="card">
      <h2>Discover Mining Sites</h2>
      <p style="color:var(--slate-muted);margin-bottom:1rem">Sites within your service radius seeking responsible processors.</p>
      <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem">
        <label style="font-size:0.85rem;color:var(--slate-muted);margin-right:0.25rem">Max distance (km):</label>
        <input id="processor-filter-distance" type="number" min="0" placeholder="e.g. 150" value="${pf.distanceKm || ''}" style="width:80px;padding:0.25rem">
        <label style="font-size:0.85rem;color:var(--slate-muted);margin-left:0.5rem;margin-right:0.25rem">Commodity:</label>
        <select id="processor-filter-commodity" style="padding:0.25rem">
          <option value="">Any</option>
          ${commodities.map(c => `<option value="${c}" ${pf.commodity===c? 'selected':''}>${c}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-outline" id="processor-clear-filters" style="margin-left:0.5rem">Clear</button>
      </div>

      <div style="margin-bottom:1rem">
        <h3>Sites Seeking Mercury-Free Processing</h3>
        ${mercuryList}
      </div>
      ${nearbySites.length > 0 ? siteCards : '<p class="empty-state">No sites within your service radius.</p>'}
    </div>

    <div class="card">
      <h2>All Nearby Sites (Extended Radius)</h2>
      <p style="font-size:0.85rem;color:var(--slate-muted);margin-bottom:1rem">${sites.length} sites in region</p>
      ${sites.length > 0 ? sites.slice(0, 5).map(s => `
        <div style="padding:0.5rem;border-bottom:1px solid var(--border)">
          <strong>${s.name}</strong>
          <span style="color:var(--slate-muted);font-size:0.85rem;margin-left:0.5rem">${Math.round(Math.sqrt(Math.pow(s.lat - currentProcessor.lat, 2) + Math.pow(s.lng - currentProcessor.lng, 2)) * 111)} km</span>
        </div>
      `).join('') : ''}
    </div>
  `;
}
