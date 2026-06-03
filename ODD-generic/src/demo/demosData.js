// ─────────────────────────────────────────────────────────────────────────────
// Curated, themed demo dashboards — one per industry. Rich, entity-level data
// (12 months × ~12-14 named entities) so charts/tables look full and professional.
// Each demo has 4 KPIs + 5 pages of varied charts and its own natural colour theme.
// Seeded by POST /seed-demos under fixed IDs (demo_<id>).
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = ['Jan 25', 'Feb 25', 'Mar 25', 'Apr 25', 'May 25', 'Jun 25', 'Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25'];
const TERMS = ['T1 23', 'T2 23', 'T1 24', 'T2 24', 'T1 25', 'T2 25'];

function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const ri = (r, a, b) => Math.round(a + r() * (b - a));
const rf = (r, a, b, d = 1) => +(a + r() * (b - a)).toFixed(d);

// ── Panel helpers ─────────────────────────────────────────────────────────────
const kpi = (id, title, column, agg = 'sum', sub) => ({
  id, type: 'kpi', title, table: 'data', value: { column, agg },
  sub: sub ? { column: sub[0], agg: sub[1] || 'sum', label: sub[2] } : undefined, width: 'third',
});
const chart = (id, type, title, dimension, measures, opts = {}) => ({
  id, type, title, table: 'data', dimension,
  measures: measures.map((m) => ({ column: m[0], agg: m[1] || 'sum', label: m[2] || m[0] })),
  sort: opts.sort, limit: opts.limit, width: opts.width || 'half',
});
const table = (id, title, opts = {}) => ({ id, type: 'table', title, table: 'data', limit: opts.limit || 14, width: 'full' });

// Generate entity × time rows.
function genData(seed, cfg, entities, mk) {
  const r = rng(seed);
  const timeKey = cfg.timeKey || 'month';
  const times = cfg.times || MONTHS;
  const rows = [];
  for (const e of entities) for (const t of times) rows.push({ [cfg.entityKey]: e.name, [cfg.catKey]: e.cat, [timeKey]: t, ...mk(r, e) });
  return rows;
}

// Build 5 rich pages from a config. m = measures [{col,agg,label}]; M(i) shorthand.
function standardPages(o) {
  const m = o.measures;
  const tri = (i) => { const x = m[Math.min(i, m.length - 1)]; return [x.col, x.agg, x.label]; };
  const [m0, m1, m2] = [tri(0), tri(1), tri(2)];
  const EL = o.entityLabel, CL = o.catLabel, T = o.timeKey || 'month';
  const ent = o.entityKey, cat = o.catKey;
  return [
    { id: 'overview', title: o.names[0], panels: [
      ...o.kpis.map((k, i) => kpi('k' + i, k[0], k[1], k[2] || 'sum', k[3])),
      chart('o1', 'area', `${m0[2]} & ${m1[2]} Trend`, T, [m0, m1], { width: 'full' }),
      chart('o2', 'bar', `${m0[2]} by ${EL}`, ent, [m0], { sort: { by: m0[0], dir: 'desc' }, limit: 12 }),
      chart('o3', 'pie', `${m0[2]} by ${CL}`, cat, [m0]),
    ] },
    { id: 'entities', title: o.names[1], panels: [
      chart('e1', 'bar', `Top ${EL}s — ${m0[2]} vs ${m1[2]}`, ent, [m0, m1], { sort: { by: m0[0], dir: 'desc' }, limit: 12, width: 'full' }),
      chart('e2', 'bar', `${m2[2]} by ${EL}`, ent, [m2], { sort: { by: m2[0], dir: 'desc' }, limit: 12 }),
      chart('e3', 'scatter', `${m0[2]} vs ${m1[2]}`, ent, [m0, m1]),
      table('e4', `${EL} Detail`, { limit: 14 }),
    ] },
    { id: 'category', title: o.names[2], panels: [
      chart('c1', 'bar', `${m0[2]} & ${m1[2]} by ${CL}`, cat, [m0, m1], { sort: { by: m0[0], dir: 'desc' }, width: 'full' }),
      chart('c2', 'pie', `${m2[2]} by ${CL}`, cat, [m2]),
      chart('c3', 'bar', `${m1[2]} by ${CL}`, cat, [m1], { sort: { by: m1[0], dir: 'desc' } }),
    ] },
    { id: 'trends', title: o.names[3], panels: [
      chart('t1', 'line', `${m0[2]} & ${m1[2]} Over Time`, T, [m0, m1], { width: 'full' }),
      chart('t2', 'area', `${m2[2]} Trend`, T, [m2]),
      chart('t3', 'bar', `${m0[2]} by Period`, T, [m0]),
    ] },
    { id: 'detail', title: o.names[4], panels: [
      table('d1', 'Full Records', { limit: 20 }),
      chart('d2', 'bar', `${m1[2]} by ${CL}`, cat, [m1], { sort: { by: m1[0], dir: 'desc' } }),
      chart('d3', 'bar', `${m2[2]} by ${EL}`, ent, [m2], { sort: { by: m2[0], dir: 'desc' }, limit: 10 }),
    ] },
  ];
}

function demo(id, name, theme, rows, pages) {
  return { id, name, theme, tables: [{ name: 'data', rows }], spec: { title: name, isDemo: true, theme, datasetId: `demo_${id}`, pages } };
}

// ── Finance & Banking ────────────────────────────────────────────────────────
function finance() {
  const regions = ['North', 'South', 'East', 'West'], segs = ['Retail', 'Corporate', 'Wealth', 'SME'];
  const names = ['Hawthorn', 'Riverside', 'Summit', 'Harbour', 'Parkview', 'Central', 'Westgate', 'Lakeside', 'Pinnacle', 'Crossroads', 'Eastwood', 'Northbridge', 'Maple', 'Granite'];
  const entities = names.map((n, i) => ({ name: `${n} Branch`, cat: segs[i % 4], region: regions[i % 4] }));
  const rows = genData(11, { entityKey: 'branch', catKey: 'segment' }, entities, (r) => {
    const revenue = ri(r, 120, 900) * 1000; const cost = Math.round(revenue * rf(r, 0.45, 0.72, 2));
    return { revenue, cost, profit: revenue - cost, accounts: ri(r, 60, 480), deposits: ri(r, 200, 2400) * 1000, loans: ri(r, 80, 1600) * 1000 };
  });
  const theme = { gradient: ['#4f46e5', '#2563eb', '#06b6d4'], palette: ['#2563eb', '#6366f1', '#06b6d4', '#10b981', '#14b8a6', '#8b5cf6'] };
  return demo('finance', 'Finance & Banking', theme, rows, standardPages({
    entityKey: 'branch', entityLabel: 'Branch', catKey: 'segment', catLabel: 'Segment',
    names: ['Overview', 'Branches', 'Segments', 'Trends', 'Ledger'],
    kpis: [['Total Revenue', 'revenue', 'sum', ['cost', 'sum', 'Cost']], ['Net Profit', 'profit', 'sum', ['profit', 'avg', 'Avg / branch']], ['Deposits', 'deposits', 'sum', ['loans', 'sum', 'Loans']], ['Active Accounts', 'accounts', 'sum', ['accounts', 'avg', 'Avg / branch']]],
    measures: [{ col: 'revenue', agg: 'sum', label: 'Revenue' }, { col: 'profit', agg: 'sum', label: 'Profit' }, { col: 'deposits', agg: 'sum', label: 'Deposits' }],
  }));
}

// ── Healthcare ─────────────────────────────────────────────────────────────
function healthcare() {
  const depts = ['Cardiology', 'Orthopedics', 'Pediatrics', 'Oncology', 'Emergency', 'Neurology'];
  const names = ['St. Mary', 'Riverside', 'Grandview', 'Lakeshore', 'Summit', 'Mercy', 'Hopewell', 'Northside', 'Bayview', 'Greenfield', 'Highland', 'Parkland'];
  const entities = names.map((n, i) => ({ name: `${n} Hospital`, cat: depts[i % depts.length] }));
  const rows = genData(23, { entityKey: 'hospital', catKey: 'department' }, entities, (r) => ({
    patients: ri(r, 120, 900), admissions: ri(r, 20, 200), avg_wait_min: ri(r, 8, 55), satisfaction: rf(r, 3.4, 4.9, 1), readmissions: ri(r, 2, 40), beds: ri(r, 40, 300),
  }));
  const theme = { gradient: ['#2563eb', '#06b6d4', '#14b8a6'], palette: ['#3b82f6', '#06b6d4', '#14b8a6', '#10b981', '#6366f1', '#0ea5e9'] };
  return demo('healthcare', 'Healthcare', theme, rows, standardPages({
    entityKey: 'hospital', entityLabel: 'Hospital', catKey: 'department', catLabel: 'Department',
    names: ['Operations', 'Hospitals', 'Departments', 'Trends', 'Records'],
    kpis: [['Total Patients', 'patients', 'sum', ['admissions', 'sum', 'Admissions']], ['Admissions', 'admissions', 'sum', ['readmissions', 'sum', 'Readmissions']], ['Avg Wait (min)', 'avg_wait_min', 'avg', ['avg_wait_min', 'max', 'Worst']], ['Satisfaction', 'satisfaction', 'avg', ['beds', 'sum', 'Beds']]],
    measures: [{ col: 'patients', agg: 'sum', label: 'Patients' }, { col: 'admissions', agg: 'sum', label: 'Admissions' }, { col: 'readmissions', agg: 'sum', label: 'Readmissions' }],
  }));
}

// ── Retail & E-commerce ──────────────────────────────────────────────────────
function retail() {
  const cats = ['Apparel', 'Electronics', 'Home', 'Beauty', 'Grocery', 'Sports'];
  const names = ['Downtown', 'Mall Plaza', 'Airport', 'Riverside', 'Westfield', 'Harbour', 'Central', 'Northgate', 'Lakeview', 'Eastside', 'Southpoint', 'Uptown', 'Parkway', 'Metro'];
  const entities = names.map((n, i) => ({ name: `${n} Store`, cat: cats[i % cats.length] }));
  const rows = genData(31, { entityKey: 'store', catKey: 'category' }, entities, (r) => {
    const units = ri(r, 300, 4200); return { units, revenue: units * ri(r, 15, 95), returns: ri(r, 5, 240), margin: rf(r, 18, 52, 1), footfall: ri(r, 2000, 28000) };
  });
  const theme = { gradient: ['#ea580c', '#f59e0b', '#f43f5e'], palette: ['#f97316', '#fbbf24', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'] };
  return demo('retail', 'Retail & E-commerce', theme, rows, standardPages({
    entityKey: 'store', entityLabel: 'Store', catKey: 'category', catLabel: 'Category',
    names: ['Sales', 'Stores', 'Categories', 'Trends', 'Transactions'],
    kpis: [['Revenue', 'revenue', 'sum', ['units', 'sum', 'Units']], ['Units Sold', 'units', 'sum', ['footfall', 'sum', 'Footfall']], ['Returns', 'returns', 'sum', ['returns', 'avg', 'Avg / store']], ['Avg Margin %', 'margin', 'avg', ['margin', 'max', 'Best']]],
    measures: [{ col: 'revenue', agg: 'sum', label: 'Revenue' }, { col: 'units', agg: 'sum', label: 'Units' }, { col: 'returns', agg: 'sum', label: 'Returns' }],
  }));
}

// ── Manufacturing ─────────────────────────────────────────────────────────────
function manufacturing() {
  const shifts = ['Morning', 'Evening', 'Night'];
  const names = ['Detroit', 'Stuttgart', 'Osaka', 'Pune', 'Monterrey', 'Shenzhen', 'Turin', 'Gothenburg', 'Busan', 'Chennai', 'Brno', 'Toledo'];
  const entities = names.map((n, i) => ({ name: `${n} Plant`, cat: shifts[i % 3] }));
  const rows = genData(43, { entityKey: 'plant', catKey: 'shift' }, entities, (r) => ({
    output: ri(r, 1200, 9000), defects: ri(r, 5, 220), downtime_hrs: rf(r, 2, 38, 1), oee: rf(r, 62, 94, 1), units_scrapped: ri(r, 2, 120),
  }));
  const theme = { gradient: ['#334155', '#3b82f6', '#06b6d4'], palette: ['#3b82f6', '#0ea5e9', '#64748b', '#14b8a6', '#f59e0b', '#6366f1'] };
  return demo('manufacturing', 'Manufacturing', theme, rows, standardPages({
    entityKey: 'plant', entityLabel: 'Plant', catKey: 'shift', catLabel: 'Shift',
    names: ['Production', 'Plants', 'Shifts', 'Trends', 'Quality'],
    kpis: [['Total Output', 'output', 'sum', ['output', 'avg', 'Avg / plant']], ['Avg OEE %', 'oee', 'avg', ['oee', 'min', 'Lowest']], ['Defects', 'defects', 'sum', ['units_scrapped', 'sum', 'Scrapped']], ['Downtime (hrs)', 'downtime_hrs', 'sum', ['downtime_hrs', 'avg', 'Avg / plant']]],
    measures: [{ col: 'output', agg: 'sum', label: 'Output' }, { col: 'defects', agg: 'sum', label: 'Defects' }, { col: 'downtime_hrs', agg: 'sum', label: 'Downtime' }],
  }));
}

// ── Logistics & Supply ───────────────────────────────────────────────────────
function logistics() {
  const zones = ['Metro', 'Regional', 'Interstate', 'Export'];
  const names = ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Auckland', 'Singapore', 'Dubai', 'Mumbai', 'Hamburg', 'Dallas', 'Toronto'];
  const entities = names.map((n, i) => ({ name: `${n} Hub`, cat: zones[i % 4] }));
  const rows = genData(57, { entityKey: 'hub', catKey: 'zone' }, entities, (r) => ({
    shipments: ri(r, 300, 4200), on_time_pct: rf(r, 78, 99, 1), transit_days: rf(r, 0.5, 7, 1), cost: ri(r, 20000, 180000), volume_tonnes: ri(r, 200, 5400),
  }));
  const theme = { gradient: ['#0891b2', '#06b6d4', '#3b82f6'], palette: ['#06b6d4', '#0ea5e9', '#3b82f6', '#14b8a6', '#10b981', '#6366f1'] };
  return demo('logistics', 'Logistics & Supply', theme, rows, standardPages({
    entityKey: 'hub', entityLabel: 'Hub', catKey: 'zone', catLabel: 'Zone',
    names: ['Operations', 'Hubs', 'Zones', 'Trends', 'Shipments'],
    kpis: [['Shipments', 'shipments', 'sum', ['volume_tonnes', 'sum', 'Tonnes']], ['Avg On-Time %', 'on_time_pct', 'avg', ['on_time_pct', 'min', 'Worst']], ['Total Cost', 'cost', 'sum', ['cost', 'avg', 'Avg / hub']], ['Avg Transit (days)', 'transit_days', 'avg', ['transit_days', 'max', 'Slowest']]],
    measures: [{ col: 'shipments', agg: 'sum', label: 'Shipments' }, { col: 'cost', agg: 'sum', label: 'Cost' }, { col: 'volume_tonnes', agg: 'sum', label: 'Volume (t)' }],
  }));
}

// ── Education ────────────────────────────────────────────────────────────────
function education() {
  const campuses = ['Main', 'City', 'Online', 'North'];
  const names = ['Engineering', 'Business', 'Arts', 'Science', 'Medicine', 'Law', 'Design', 'Computing', 'Nursing', 'Economics', 'Psychology', 'Architecture'];
  const entities = names.map((n, i) => ({ name: n, cat: campuses[i % 4] }));
  const rows = genData(67, { entityKey: 'faculty', catKey: 'campus', timeKey: 'term', times: TERMS }, entities, (r) => {
    const enrolled = ri(r, 120, 1200); return { enrolled, graduated: Math.round(enrolled * rf(r, 0.18, 0.34, 2)), attendance_pct: rf(r, 74, 96, 1), satisfaction: rf(r, 3.3, 4.8, 1), staff: ri(r, 12, 110) };
  });
  const theme = { gradient: ['#7c3aed', '#8b5cf6', '#a78bfa'], palette: ['#7c3aed', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#ec4899'] };
  return demo('education', 'Education', theme, rows, standardPages({
    entityKey: 'faculty', entityLabel: 'Faculty', catKey: 'campus', catLabel: 'Campus', timeKey: 'term',
    names: ['Enrolment', 'Faculties', 'Campuses', 'Trends', 'Records'],
    kpis: [['Total Enrolled', 'enrolled', 'sum', ['staff', 'sum', 'Staff']], ['Graduates', 'graduated', 'sum', ['graduated', 'avg', 'Avg / faculty']], ['Avg Attendance %', 'attendance_pct', 'avg', ['attendance_pct', 'min', 'Lowest']], ['Satisfaction', 'satisfaction', 'avg', ['satisfaction', 'max', 'Best']]],
    measures: [{ col: 'enrolled', agg: 'sum', label: 'Enrolled' }, { col: 'graduated', agg: 'sum', label: 'Graduates' }, { col: 'staff', agg: 'sum', label: 'Staff' }],
  }));
}

// ── Real Estate ──────────────────────────────────────────────────────────────
function realestate() {
  const types = ['Residential', 'Office', 'Retail', 'Warehouse'];
  const names = ['Skyline Tower', 'Harbour Lofts', 'Maple Court', 'Granite Plaza', 'Bayview Offices', 'Cedar Mall', 'Ironworks', 'Park Residences', 'Summit Centre', 'Lakeshore', 'Westend Depot', 'Crown Heights', 'Vista Apartments', 'Metro Hub'];
  const entities = names.map((n, i) => ({ name: n, cat: types[i % 4] }));
  const rows = genData(79, { entityKey: 'property', catKey: 'property_type' }, entities, (r) => ({
    occupancy_pct: rf(r, 72, 99, 1), rent: ri(r, 20000, 180000), vacancies: ri(r, 0, 22), yield_pct: rf(r, 3.2, 8.4, 1), sqft: ri(r, 5000, 90000),
  }));
  const theme = { gradient: ['#059669', '#10b981', '#14b8a6'], palette: ['#10b981', '#14b8a6', '#0d9488', '#0ea5e9', '#6366f1', '#f59e0b'] };
  return demo('realestate', 'Real Estate', theme, rows, standardPages({
    entityKey: 'property', entityLabel: 'Property', catKey: 'property_type', catLabel: 'Type',
    names: ['Portfolio', 'Properties', 'Types', 'Trends', 'Listings'],
    kpis: [['Rental Income', 'rent', 'sum', ['rent', 'avg', 'Avg / property']], ['Avg Occupancy %', 'occupancy_pct', 'avg', ['occupancy_pct', 'min', 'Lowest']], ['Vacancies', 'vacancies', 'sum', ['sqft', 'sum', 'Total sqft']], ['Avg Yield %', 'yield_pct', 'avg', ['yield_pct', 'max', 'Best']]],
    measures: [{ col: 'rent', agg: 'sum', label: 'Rent' }, { col: 'occupancy_pct', agg: 'avg', label: 'Occupancy %' }, { col: 'vacancies', agg: 'sum', label: 'Vacancies' }],
  }));
}

// ── Marketing & Sales ────────────────────────────────────────────────────────
function marketing() {
  const channels = ['Search', 'Social', 'Email', 'Display', 'Affiliate', 'Video'];
  const names = ['Spring Launch', 'Summer Sale', 'Brand Awareness', 'Retarget Q3', 'Holiday Push', 'Lead Gen A', 'Lead Gen B', 'Loyalty Drive', 'Product Hunt', 'Webinar Series', 'Referral', 'Flash Promo'];
  const entities = names.map((n, i) => ({ name: n, cat: channels[i % channels.length] }));
  const rows = genData(91, { entityKey: 'campaign', catKey: 'channel' }, entities, (r) => {
    const spend = ri(r, 4000, 60000); const leads = ri(r, 60, 1600); const conversions = Math.round(leads * rf(r, 0.04, 0.22, 2));
    return { spend, leads, conversions, revenue: conversions * ri(r, 120, 900), impressions: ri(r, 20000, 900000) };
  });
  const theme = { gradient: ['#db2777', '#ec4899', '#f43f5e'], palette: ['#ec4899', '#f43f5e', '#8b5cf6', '#6366f1', '#06b6d4', '#f59e0b'] };
  return demo('marketing', 'Marketing & Sales', theme, rows, standardPages({
    entityKey: 'campaign', entityLabel: 'Campaign', catKey: 'channel', catLabel: 'Channel',
    names: ['Funnel', 'Campaigns', 'Channels', 'Trends', 'Records'],
    kpis: [['Revenue', 'revenue', 'sum', ['spend', 'sum', 'Spend']], ['Conversions', 'conversions', 'sum', ['leads', 'sum', 'Leads']], ['Leads', 'leads', 'sum', ['impressions', 'sum', 'Impressions']], ['Marketing Spend', 'spend', 'sum', ['spend', 'avg', 'Avg / campaign']]],
    measures: [{ col: 'revenue', agg: 'sum', label: 'Revenue' }, { col: 'spend', agg: 'sum', label: 'Spend' }, { col: 'conversions', agg: 'sum', label: 'Conversions' }],
  }));
}

function getDemos() {
  return [finance(), healthcare(), retail(), manufacturing(), logistics(), education(), realestate(), marketing()];
}

export { getDemos };
