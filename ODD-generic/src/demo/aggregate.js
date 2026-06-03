// Client-side aggregation: turn raw rows + a panel spec into chart-ready data.
// The agent decides WHAT to show; this computes it from the dataset.

export const toNum = (v) => {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[, $%]/g, ''));
  return isNaN(n) ? NaN : n;
};

const measureKey = (m) => m.label || m.column || 'value';

function applyAgg(rows, column, agg) {
  if (agg === 'count') return rows.length;
  const nums = rows.map((r) => toNum(r[column])).filter((n) => !isNaN(n));
  if (!nums.length) return 0;
  switch (agg) {
    case 'avg': return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    case 'sum':
    default: return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
  }
}

function matchFilter(row, cond) {
  const left = row[cond.column];
  const rhs = cond.value;
  switch (cond.op) {
    case '!=': return String(left) !== String(rhs);
    case '>': return toNum(left) > toNum(rhs);
    case '<': return toNum(left) < toNum(rhs);
    case '>=': return toNum(left) >= toNum(rhs);
    case '<=': return toNum(left) <= toNum(rhs);
    case 'in': return String(rhs).split(',').map((s) => s.trim()).includes(String(left));
    case 'contains': return String(left ?? '').toLowerCase().includes(String(rhs).toLowerCase());
    case '=':
    default: return String(left) === String(rhs);
  }
}

function filterRows(rows, filter) {
  if (!filter || !filter.length) return rows;
  return rows.filter((r) => filter.every((c) => matchFilter(r, c)));
}

// The analyst agent (structured output) emits the canonical shape, but the
// free-form assistant sometimes uses alternate field names (xAxis/yAxis/
// aggregate/chartType/groupBy/metric). Normalise any panel to the canonical
// { type, dimension, measures:[{column,agg,label}], value, sort:{by,dir} }.
export function normalizePanel(p) {
  if (!p) return p;
  const panel = { ...p };
  panel.type = (panel.type || panel.chartType || 'bar').toLowerCase();

  if (!panel.dimension) {
    panel.dimension =
      (panel.xAxis && (panel.xAxis.column || panel.xAxis.field)) ||
      panel.groupBy || panel.category || panel.dimension;
  }

  if (!panel.measures) {
    const fromAxis = panel.yAxis
      ? (Array.isArray(panel.yAxis) ? panel.yAxis : [panel.yAxis])
      : null;
    const fromMetrics = panel.metrics
      ? (Array.isArray(panel.metrics) ? panel.metrics : [panel.metrics])
      : null;
    const src = fromAxis || fromMetrics;
    if (src) {
      panel.measures = src.map((m) =>
        typeof m === 'string'
          ? { column: m, agg: 'sum', label: m }
          : { column: m.column || m.field, agg: m.aggregate || m.agg || 'sum', label: m.label || m.column || m.field }
      );
    }
  }

  if (!panel.value && panel.metric) {
    const m = panel.metric;
    panel.value = typeof m === 'string'
      ? { column: m, agg: 'sum' }
      : { column: m.column || m.field, agg: m.aggregate || m.agg || 'sum' };
  }

  if (panel.sort && (panel.sort.column || panel.sort.direction)) {
    panel.sort = { by: panel.sort.column || panel.sort.by, dir: panel.sort.direction || panel.sort.dir || 'desc' };
  }
  return panel;
}

// Returns { data, dimKey, series:[{key,label}], kpi } for a panel.
export function computePanel(rawPanel, rows) {
  const panel = normalizePanel(rawPanel);
  const filtered = filterRows(rows || [], panel.filter);

  // KPI — a single aggregate (+ optional secondary "sub" metric).
  if (panel.type === 'kpi') {
    const v = panel.value || (panel.measures && panel.measures[0]);
    const value = v ? applyAgg(filtered, v.column, v.agg || 'sum') : filtered.length;
    let sub = null;
    if (panel.sub && panel.sub.column) {
      sub = { label: panel.sub.label || panel.sub.column, value: applyAgg(filtered, panel.sub.column, panel.sub.agg || 'sum') };
    }
    return { kpi: value, sub, dimKey: null, series: [], data: [] };
  }

  const measures = panel.measures && panel.measures.length
    ? panel.measures
    : [{ column: '__count', agg: 'count', label: 'Count' }];
  const series = measures.map((m) => ({ key: measureKey(m), label: m.label || m.column }));

  // Table without a dimension → show raw records.
  if (panel.type === 'table' && !panel.dimension) {
    const cols = Object.keys(filtered[0] || {}).filter((c) => c !== '_table');
    const limited = filtered.slice(0, panel.limit || 50);
    return { data: limited, dimKey: null, series: [], rawColumns: cols };
  }

  // Grouped aggregation by dimension.
  const dimKey = panel.dimension || 'group';
  const groups = new Map();
  for (const r of filtered) {
    const key = panel.dimension ? r[panel.dimension] : 'All';
    const k = key === null || key === undefined || key === '' ? '—' : String(key);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  let data = [...groups.entries()].map(([k, groupRows]) => {
    const out = { [dimKey]: k };
    measures.forEach((m) => { out[measureKey(m)] = applyAgg(groupRows, m.column, m.agg || 'sum'); });
    return out;
  });

  // Sort: explicit, else line/area by dimension ascending, else by first measure desc.
  if (panel.sort && panel.sort.by) {
    const by = panel.sort.by;
    const dir = panel.sort.dir === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      const av = a[by] ?? a[dimKey]; const bv = b[by] ?? b[dimKey];
      const an = toNum(av); const bn = toNum(bv);
      if (!isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  } else if (panel.type === 'line' || panel.type === 'area') {
    data.sort((a, b) => String(a[dimKey]).localeCompare(String(b[dimKey]), undefined, { numeric: true }));
  } else {
    const first = series[0]?.key;
    if (first) data.sort((a, b) => (b[first] || 0) - (a[first] || 0));
  }

  if (panel.limit) data = data.slice(0, panel.limit);
  return { data, dimKey, series };
}

// Honest micro-trend for a KPI: aggregate its measure over a detected
// date/period column. Returns up to 16 points (oldest→newest) or null.
const DATEY = /(date|month|period|year|quarter|qtr|week|day|time|yr|fy|mon)/i;
export function computeSpark(rawPanel, rows) {
  const panel = normalizePanel(rawPanel);
  if (panel.type !== 'kpi') return null;
  const v = panel.value || (panel.measures && panel.measures[0]);
  if (!v || !v.column) return null;
  const filtered = filterRows(rows || [], panel.filter);
  if (filtered.length < 3) return null;
  const cols = Object.keys(filtered[0] || {});
  const dim = cols.find((c) => DATEY.test(c));
  if (!dim) return null;
  const groups = new Map();
  for (const r of filtered) {
    const k = r[dim];
    if (k === null || k === undefined || k === '') continue;
    const key = String(k);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  let pts = [...groups.entries()].map(([k, g]) => ({ k, val: applyAgg(g, v.column, v.agg || 'sum') }));
  pts.sort((a, b) => String(a.k).localeCompare(String(b.k), undefined, { numeric: true }));
  if (pts.length < 3) return null;
  return pts.slice(-16).map((p) => p.val);
}

export const fmtNum = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return String(n ?? '—');
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n * 100) / 100);
};
