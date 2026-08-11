/* SiteCore MVP — Seed data, practices, persistence */

const STORAGE_KEY = 'sitecore_mvp_data_v2';

const COUNTRIES = ['Ghana', 'Tanzania', 'Mali', 'Burkina Faso', 'Kenya'];

const PRACTICES = [
  { id: 'env-1', pillar: 'environment', label: 'No mercury use in processing' },
  { id: 'env-2', pillar: 'environment', label: 'Tailings contained or managed' },
  { id: 'env-3', pillar: 'environment', label: 'Rehabilitation plan in place' },
  { id: 'hs-1', pillar: 'health', label: 'PPE available and used' },
  { id: 'hs-2', pillar: 'health', label: 'First aid kit on site' },
  { id: 'hs-3', pillar: 'health', label: 'No child labour observed' },
  { id: 'gov-1', pillar: 'governance', label: 'Production records maintained' },
  { id: 'gov-2', pillar: 'governance', label: 'Cooperative or group structure' },
  { id: 'com-1', pillar: 'community', label: 'Community liaison identified' },
  { id: 'com-2', pillar: 'community', label: 'Grievance mechanism accessible' }
];

const PILLARS = [
  { key: 'environment', label: 'Environment' },
  { key: 'health', label: 'Health & Safety' },
  { key: 'governance', label: 'Governance' },
  { key: 'community', label: 'Community Relations' }
];

const JOURNEY_STEPS = ['Registered', 'Self-Assessed', 'Field Verified', 'Connected to Formal Market'];

const SERVICE_PARTNERS = [
  { type: 'Refinery', name: 'Ethical Gold Refinery Ltd.', desc: 'Responsible gold refining & traceability' },
  { type: 'Assay Lab', name: 'West Africa Assay Services', desc: 'Independent gold purity testing' },
  { type: 'Microfinance', name: 'ASGM Growth Fund', desc: 'Pre-shipment advances against trust profile' },
  { type: 'Training', name: 'Mercury-Free Processing Collective', desc: 'Workshops on safer processing methods' }
];

const SUPPORT_TYPES = [
  { id: 'training', label: 'Training', desc: 'Mercury-free processing workshop' },
  { id: 'equipment', label: 'Equipment financing', desc: 'Loan for containment/PPE equipment' },
  { id: 'advance', label: 'Pre-shipment advance', desc: 'Cash advance against trust profile' },
  { id: 'formalization', label: 'Formalization support', desc: 'Help navigating licensing' }
];

const REPORT_STATUSES = ['submitted', 'under_review', 'verified', 'resolved'];
const REPORT_STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  verified: 'Verified',
  resolved: 'Resolved'
};

const LEGACY_DEMO_SITE_IDS = new Set(['SC-TZ-001', 'SC-GH-002', 'SC-GH-003', 'SC-TZ-DEMO']);
const LEGACY_DEMO_REPORT_IDS = new Set(['CR-001', 'CR-002', 'CR-DEMO']);

function migrateSite(site) {
  if (site.trustTier) return site;
  const migrated = { ...site };
  const levelMap = {
    registered: 'registered',
    baseline: 'self_assessed',
    progressing: 'field_verified_open',
    established: 'field_verified'
  };
  migrated.trustTier = levelMap[site.trustLevel] || 'registered';
  migrated.locationTrust = site.locationTrust || (site.gpsCapture ? 'gps_captured' : 'approximate');
  migrated.lat = site.lat ?? -2.5 + Math.random() * 5;
  migrated.lng = site.lng ?? 32 + Math.random() * 5;
  migrated.connectedToMarket = site.connectedToMarket ?? false;
  migrated.introductionRequested = site.introductionRequested ?? false;
  migrated.openImprovements = site.openImprovements || (site.openIssues || []).map(i => `Improve: ${i}`);
  migrated.timeline = site.timeline || [];
  migrated.queued = site.queued ?? false;
  if (site.assessments?.length && site.assessments[0].scores) {
    migrated.assessments = site.assessments.map(a => ({
      ...a,
      observed: a.observed || PRACTICES.filter((_, i) => (Object.values(a.scores)[i % 4] || 0) >= 3).map(p => p.id)
    }));
  }
  delete migrated.status;
  delete migrated.trustLevel;
  delete migrated.openIssues;
  delete migrated.improvements;
  delete migrated.introductions;
  return migrated;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('sitecore_mvp_data');
    if (raw) {
      const data = JSON.parse(raw);
      data.sites = (data.sites || []).filter(s => !LEGACY_DEMO_SITE_IDS.has(s.id)).map(migrateSite);
      data.communityReports = (data.communityReports || []).filter(r => !LEGACY_DEMO_REPORT_IDS.has(r.id)).map(r => ({
        ...r,
        status: r.status === 'pending' ? 'submitted' : r.status === 'dismissed' ? 'resolved' : r.status,
        type: r.type === 'positive' ? 'improvement' : r.type === 'concern' ? 'concern' : (r.type || 'concern'),
        typeLabel: r.typeLabel || (r.type === 'improvement' || r.type === 'positive' ? 'Improvement' : 'Concern'),
        queued: r.queued ?? false
      }));
      data.supportRequests = data.supportRequests || [];
      data.pendingSync = data.pendingSync || [];
      data.offline = data.offline ?? false;
      return data;
    }
  } catch (e) { /* fall through */ }
  return {
    sites: [],
    communityReports: [],
    supportRequests: [],
    pendingSync: [],
    offline: false
  };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('sitecore_mvp_data');
}

function getTrustTierLabel(tier) {
  const map = {
    registered: 'Registered',
    self_assessed: 'Self-Assessed',
    field_verified_open: 'Field-Verified · Open Item',
    field_verified: 'Field-Verified'
  };
  return map[tier] || tier;
}

function getTrustBadgeClass(tier) {
  const map = {
    registered: 'trust-registered',
    self_assessed: 'trust-self-assessed',
    field_verified_open: 'trust-field-open',
    field_verified: 'trust-field-verified'
  };
  return map[tier] || 'trust-registered';
}

function getLocationTrustLabel(level) {
  const map = {
    approximate: '📍 Approximate (Self-Reported)',
    gps_captured: '📍 GPS Captured (Field Officer Recorded)',
    gps_verified: '📍 GPS Verified (Confirmed During Assessment)'
  };
  return map[level] || level;
}

function getLocationDotClass(level) {
  const map = {
    approximate: 'loc-approximate',
    gps_captured: 'loc-captured',
    gps_verified: 'loc-verified'
  };
  return map[level] || 'loc-approximate';
}

function determineTrustTier(site) {
  if (site.connectedToMarket) return site.openImprovements?.length ? 'field_verified_open' : 'field_verified';
  const fieldAssessments = (site.assessments || []).filter(a => a.verified);
  if (fieldAssessments.length > 0) {
    return site.openImprovements?.length ? 'field_verified_open' : 'field_verified';
  }
  if (site.selfAssessment) return 'self_assessed';
  return 'registered';
}

function getJourneyStepIndex(site) {
  if (site.connectedToMarket || site.introductionRequested) return 3;
  if ((site.assessments || []).some(a => a.verified)) return 2;
  if (site.selfAssessment) return 1;
  return 0;
}

function generateSiteId(country, count) {
  const codes = { Ghana: 'GH', Tanzania: 'TZ', Mali: 'ML', 'Burkina Faso': 'BF', Kenya: 'KE' };
  const code = codes[country] || 'XX';
  return `SC-${code}-${String(count).padStart(3, '0')}`;
}

function generateReportId(count) {
  return `CR-${String(count).padStart(3, '0')}`;
}

function generateSupportId(count) {
  return `SR-${String(count).padStart(3, '0')}`;
}

function countByTier(sites) {
  const tiers = ['registered', 'self_assessed', 'field_verified_open', 'field_verified'];
  return tiers.map(t => ({
    tier: t,
    label: getTrustTierLabel(t),
    count: sites.filter(s => determineTrustTier(s) === t).length
  }));
}

function simulateGPS() {
  const baseLat = -6 + Math.random() * 12;
  const baseLng = 28 + Math.random() * 14;
  return {
    lat: Math.round(baseLat * 10000) / 10000,
    lng: Math.round(baseLng * 10000) / 10000,
    accuracy: Math.floor(8 + Math.random() * 15),
    timestamp: new Date().toISOString()
  };
}

function mapPosition(lat, lng, sites) {
  const lats = sites.map(s => s.lat).filter(Boolean);
  const lngs = sites.map(s => s.lng).filter(Boolean);
  if (!lats.length) return { x: 50, y: 50 };
  const minLat = Math.min(...lats, lat);
  const maxLat = Math.max(...lats, lat);
  const minLng = Math.min(...lngs, lng);
  const maxLng = Math.max(...lngs, lng);
  const pad = 0.0001;
  const x = ((lng - minLng) / (maxLng - minLng + pad)) * 80 + 10;
  const y = 90 - ((lat - minLat) / (maxLat - minLat + pad)) * 80;
  return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
}

