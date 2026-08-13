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
  { id: 'formalisation', label: 'Formalisation', desc: 'Help navigating licensing & official recognition' },
  { id: 'mercury-free', label: 'Mercury-Free Processing', desc: 'Support transitioning to mercury-free methods' },
  { id: 'equipment', label: 'Equipment', desc: 'Loan or grant for containment/PPE equipment' },
  { id: 'training', label: 'Training', desc: 'Workshops on safer processing methods' },
  { id: 'finance', label: 'Finance', desc: 'Microfinance or pre-shipment advances' },
  { id: 'environmental', label: 'Environmental Rehabilitation', desc: 'Land restoration & tailings management' },
  { id: 'safety', label: 'Safety Improvement', desc: 'Workplace safety protocols & equipment' },
  { id: 'business', label: 'Business Development', desc: 'Business planning & market linkage' },
  { id: 'market-access', label: 'Market Access', desc: 'Connection to formal buyers & processors' },
  { id: 'technical', label: 'Technical Assistance', desc: 'Specialized technical support' },
  { id: 'other', label: 'Other', desc: 'Other support not listed above' }
];

const SUPPORT_REQUEST_STATUSES = ['submitted', 'under_review', 'matched', 'in_progress', 'completed'];
const SUPPORT_REQUEST_STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  matched: 'Matched',
  in_progress: 'In Progress',
  completed: 'Completed'
};

/* ── Role-Based Access Control ── */

const ROLE_PERMISSIONS = {
  admin: {
    canViewAllSites: true,
    canViewAllReports: true,
    canViewAllRequests: true,
    canEditSites: true,
    canManageRoles: true,
    siteVisibility: 'all'
  },
  government: {
    canViewAllSites: true,
    canViewVerifiedOnly: false,
    canViewReports: true,
    canViewFormalisation: true,
    siteVisibility: 'public_and_verified',
    maskSensitiveFields: false,
    canSeeLocations: true
  },
  partner: {
    canViewOpenRequests: true,
    canViewAssignedSites: true,
    canViewRelevantReports: true,
    siteVisibility: 'matched_requests',
    maskContact: false,
    canSeeLocations: true
  },
  field: {
    canViewAssignedSites: true,
    canViewAllReports: true,
    canVerifyReports: true,
    siteVisibility: 'assigned',
    canSeeLocations: true
  },
  site: {
    canViewOwnProfile: true,
    canViewOwnRequests: true,
    canViewNearbyProviders: true,
    canViewPublicSites: false,
    siteVisibility: 'own',
    maskOtherSites: true
  },
  processor: {
    canViewNearbySites: true,
    canViewPublicProfiles: true,
    canRequestIntroductions: true,
    siteVisibility: 'public_nearby',
    maskContact: true,
    maskExactLocation: true
  },
  buyer: {
    canViewVerifiedSites: true,
    canSearchSites: true,
    canRequestIntroductions: true,
    siteVisibility: 'verified',
    maskContact: true,
    maskExactLocation: true
  },
  community: {
    canSubmitReports: true,
    canViewOwnReports: true,
    canViewPublicImprovements: true,
    siteVisibility: 'none',
    maskAllData: true,
    allowAnonymous: true
  }
};

/* ── Sensitive Site Fields ── */
const SENSITIVE_FIELDS = ['phone', 'contact', 'lat', 'lng', 'registeredBy', 'gpsCapture'];
const RESTRICTED_FIELDS = {
  openImprovements: ['site', 'community'],
  assessments: ['site', 'community', 'processor', 'buyer'],
  selfAssessment: ['site', 'community', 'processor', 'buyer']
};

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
      data.serviceProviders = data.serviceProviders || [];
      data.developmentPartners = data.developmentPartners || [];
      data.connections = data.connections || [];
      data.pendingSync = data.pendingSync || [];
      data.offline = data.offline ?? false;
      return initializeServiceProviders(data);
    }
  } catch (e) { /* fall through */ }
  return initializeServiceProviders({
    sites: [],
    communityReports: [],
    supportRequests: [],
    serviceProviders: [],
    developmentPartners: [],
    connections: [],
    pendingSync: [],
    users: [],
    organizations: [],
    pendingApprovals: [],
    offline: false
  });
}

function generateUserId(count) {
  return `U-${String(count).padStart(3, '0')}`;
}

function generateOrgId(count) {
  return `ORG-${String(count).padStart(3, '0')}`;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('sitecore_mvp_data');
}

function generateDemoData() {
  const data = {
    sites: [
      {
        id: 'SC-TZ-001', name: 'Sunrise Cooperative', photo: '⛏️', location: 'Mbeya, Tanzania', region: 'Mbeya', country: 'Tanzania',
        commodity: 'Gold', cooperative: 'Sunrise Cooperative', contact: 'John Mwale', phone: '+255754123456',
        registeredAt: '2024-01-15', registeredBy: 'Field Officer — Alice', trustTier: 'field_verified',
        locationTrust: 'gps_verified', lat: -8.9, lng: 33.4, gpsCapture: { lat: -8.9, lng: 33.4, accuracy: 12, timestamp: '2024-01-15T10:30:00Z' },
        selfAssessment: { date: '2024-01-20', observed: ['env-1', 'hs-1', 'hs-3', 'gov-2', 'com-1'] },
        assessments: [{
          date: '2024-02-10', officer: 'Alice', notes: 'Good practices on site', verified: true,
          observed: ['env-1', 'env-2', 'hs-1', 'hs-2', 'hs-3', 'gov-1', 'gov-2', 'com-1']
        }],
        openImprovements: [],
        connectedToMarket: false, introductionRequested: false, timeline: [],
        queued: false
      },
      {
        id: 'SC-GH-002', name: 'Gold Dreams Ltd', photo: '⛏️', location: 'Ashanti, Ghana', region: 'Ashanti', country: 'Ghana',
        commodity: 'Gold', cooperative: 'Independent', contact: 'Kwame Asante', phone: '+233501234567',
        registeredAt: '2024-01-18', registeredBy: 'Field Officer — Bob', trustTier: 'self_assessed',
        locationTrust: 'gps_captured', lat: -6.5, lng: -1.2, gpsCapture: { lat: -6.5, lng: -1.2, accuracy: 25, timestamp: '2024-01-18T14:00:00Z' },
        selfAssessment: { date: '2024-02-01', observed: ['env-2', 'hs-1', 'gov-2', 'com-1'] },
        assessments: [],
        openImprovements: [],
        connectedToMarket: false, introductionRequested: false, timeline: [],
        queued: false
      },
      {
        id: 'SC-ML-003', name: 'Bamako Mining Group', photo: '⛏️', location: 'Bamako, Mali', region: 'Bamako', country: 'Mali',
        commodity: 'Gold', cooperative: 'Bamako Mining Group', contact: 'Fatima Diallo', phone: '+223612345678',
        registeredAt: '2024-02-05', registeredBy: 'Field Officer — Carlos', trustTier: 'registered',
        locationTrust: 'approximate', lat: -12.6, lng: -8.0, gpsCapture: null,
        selfAssessment: null,
        assessments: [],
        openImprovements: [],
        connectedToMarket: false, introductionRequested: false, timeline: [],
        queued: false
      }
    ],
    communityReports: [
      {
        id: 'CR-001', siteId: 'SC-TZ-001', siteName: 'Sunrise Cooperative', type: 'improvement',
        typeLabel: 'Improvement', description: 'Saw new containment tanks being built', reportedAt: '2024-02-20',
        status: 'verified', queued: false
      },
      {
        id: 'CR-002', siteId: 'SC-GH-002', siteName: 'Gold Dreams Ltd', type: 'concern',
        typeLabel: 'Concern', description: 'Observed tailings runoff after rain', reportedAt: '2024-02-18',
        status: 'under_review', queued: false
      }
    ],
      supportRequests: [
      {
        id: 'SR-001', siteId: 'SC-TZ-001', siteName: 'Sunrise Cooperative', type: 'mercury-free',
        label: 'Mercury-Free Processing', date: '2024-02-15', status: 'matched',
        dateMatched: '2024-02-17', queued: false, priority: 'medium'
      },
      {
        id: 'SR-002', siteId: 'SC-GH-002', siteName: 'Gold Dreams Ltd', type: 'formalisation',
        label: 'Formalisation', date: '2024-02-12', status: 'submitted', queued: false, priority: 'high'
      },
      {
        id: 'SR-003', siteId: 'SC-ML-003', siteName: 'Bamako Mining Group', type: 'equipment',
        label: 'Equipment', date: '2024-02-08', status: 'in_progress',
        dateMatched: '2024-02-09', dateCompleted: null, queued: false, priority: 'low'
      }
    ],
    serviceProviders: [],
    developmentPartners: [],
    connections: [],
    pendingSync: [],
    offline: false
  };
  saveData(data);
  return data;
}

function initializeServiceProviders(data) {
  // Populate sample service providers if not already present
  if (!data.serviceProviders || data.serviceProviders.length === 0) {
    data.serviceProviders = [
      {
        id: 'SP-001', name: 'Ethical Gold Refinery Ltd.', type: 'Refinery',
        location: 'Dar es Salaam, Tanzania', contact: 'info@ethicalgold.tz', phone: '+255223456789',
        description: 'Responsible gold refining with full traceability',
        services: ['refining', 'assay'], mercuryFree: true, verified: true, lastVerified: '2024-02-01',
        lat: -6.8, lng: 39.3, radius: 150
      },
      {
        id: 'SP-002', name: 'West Africa Assay Services', type: 'Assay Lab',
        location: 'Accra, Ghana', contact: 'lab@waassay.gh', phone: '+233302123456',
        description: 'Independent gold purity testing with certified results',
        services: ['assay', 'certification'], mercuryFree: true, verified: true, lastVerified: '2024-01-15',
        lat: -5.6, lng: -0.2, radius: 100
      },
      {
        id: 'SP-003', name: 'Mercury-Free Processing Collective', type: 'Training',
        location: 'Mbeya, Tanzania', contact: 'training@mercuryfree.tz', phone: '+255754987654',
        description: 'Workshops and support for mercury-free processing transition',
        services: ['training', 'technical'], mercuryFree: true, verified: true, lastVerified: '2024-02-10',
        lat: -8.9, lng: 33.4, radius: 200
      }
    ];
    saveData(data);
  }
  return data;
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

function generatePartnerId(count) {
  return `DP-${String(count).padStart(3, '0')}`;
}

function generateProviderId(count) {
  return `SP-${String(count).padStart(3, '0')}`;
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

/* ════════════════════════════════════════════════════════════════════
   ROLE-BASED ACCESS CONTROL & DATA FILTERING
   ════════════════════════════════════════════════════════════════════ */

function canViewSite(siteId, role, currentUserId, data) {
  if (role === 'admin') return true;
  if (!siteId || !data || !data.sites) return false;
  
  const site = data.sites.find(s => s.id === siteId);
  if (!site) return false;
  
  switch (role) {
    case 'government':
      // Government sees all verified sites and their own research
      return site.trustTier && ['field_verified', 'field_verified_open'].includes(site.trustTier);
    case 'field':
      // Field officers see all sites (they need to assess)
      return true;
    case 'site':
      // Sites only see their own profile
      return site.id === currentUserId;
    case 'partner':
      // Partners see sites with active requests matching their programs
      return (data.supportRequests || []).some(sr =>
        sr.siteId === siteId && ['submitted', 'under_review', 'matched', 'in_progress'].includes(sr.status)
      );
    case 'processor':
    case 'buyer':
      // Processors/buyers see public, verified sites
      return site.trustTier === 'field_verified';
    case 'community':
      // Community cannot view specific sites
      return false;
    default:
      return false;
  }
}

function canEditSite(siteId, role, currentUserId, data) {
  if (role === 'admin') return true;
  if (role === 'site') return siteId === currentUserId;
  if (role === 'field') return true; // Field officers can edit/assess any site
  return false;
}

function canViewReport(reportId, role, currentUserId, data) {
  if (role === 'admin') return true;
  if (!reportId || !data || !data.communityReports) return false;
  
  const report = data.communityReports.find(r => r.id === reportId);
  if (!report) return false;
  
  switch (role) {
    case 'government':
    case 'field':
      // Gov and field see all reports (for verification/analysis)
      return report.status === 'verified' || role === 'field';
    case 'site':
      // Sites see verified reports about their own sites
      return report.siteId === currentUserId && report.status === 'verified';
    case 'partner':
    case 'processor':
    case 'buyer':
      // External roles see only verified reports
      return report.status === 'verified';
    case 'community':
      // Community sees only verified reports about public improvements
      return report.status === 'verified' && report.type === 'improvement';
    default:
      return false;
  }
}

function maskSensitiveFields(site, role, maskLevel = 'default') {
  if (role === 'admin' || role === 'field' || role === 'government') {
    // These roles see full data
    return { ...site };
  }
  
  const masked = { ...site };
  
  // Deep copy nested objects to avoid mutation
  if (site.gpsCapture) masked.gpsCapture = { ...site.gpsCapture };
  if (site.selfAssessment) masked.selfAssessment = { ...site.selfAssessment };
  if (site.assessments) masked.assessments = site.assessments.map(a => ({ ...a }));
  
  switch (role) {
    case 'site':
      // Sites can see their own data with minimal redaction
      return masked;
      
    case 'partner':
      // Partners see enough to coordinate but not sensitive contacts
      masked.phone = '***-****-***'; // Mask phone
      return masked;
      
    case 'processor':
    case 'buyer':
      // External actors see minimal contact info
      masked.contact = '[Contact Coordinator]';
      masked.phone = '[Available upon request]';
      masked.registeredBy = '[Field Verified]';
      // Generalize location
      if (masked.lat && masked.lng) {
        const fudge = 0.3; // ~30km uncertainty
        masked.lat = Math.round((masked.lat + (Math.random() - 0.5) * fudge) * 100) / 100;
        masked.lng = Math.round((masked.lng + (Math.random() - 0.5) * fudge) * 100) / 100;
      }
      return masked;
      
    case 'community':
      // Community sees no sensitive fields
      masked.contact = '[Anonymous]';
      masked.phone = null;
      masked.registeredBy = null;
      masked.lat = null;
      masked.lng = null;
      masked.gpsCapture = null;
      masked.selfAssessment = null;
      masked.assessments = [];
      return masked;
      
    default:
      return masked;
  }
}

function filterSitesForRole(sites, role, currentUserId, data) {
  return sites.filter(site => canViewSite(site.id, role, currentUserId, data))
    .map(site => maskSensitiveFields(site, role, data));
}

function filterReportsForRole(reports, role, currentUserId, data) {
  return reports.filter(report => canViewReport(report.id, role, currentUserId, data));
}

function canViewRequest(requestId, role, currentUserId, data) {
  if (role === 'admin') return true;
  if (!requestId || !data || !data.supportRequests) return false;
  
  const req = data.supportRequests.find(r => r.id === requestId);
  if (!req) return false;
  
  switch (role) {
    case 'site':
      // Sites see their own requests
      return req.siteId === currentUserId;
    case 'partner':
      // Partners see active requests (potential matches)
      return ['submitted', 'under_review', 'matched', 'in_progress'].includes(req.status);
    case 'field':
    case 'government':
      // Field and gov see all requests
      return true;
    case 'processor':
      // Processors see mercury-free processing opportunities only
      return req.type === 'mercury-free' && ['submitted', 'under_review', 'matched'].includes(req.status);
    default:
      return false;
  }
}

function filterRequestsForRole(requests, role, currentUserId, data) {
  return requests.filter(req => canViewRequest(req.id, role, currentUserId, data));
}
