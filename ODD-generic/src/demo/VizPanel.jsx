import { useEffect, useState, useId } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';
import {
  X, Pin, TrendingUp, TrendingDown, Activity, BarChart3, Percent, Hash, Gauge,
  LineChart as LineChartIcon, PieChart as PieChartIcon, ScatterChart as ScatterIcon, Table2,
} from 'lucide-react';
import { computePanel, normalizePanel, computeSpark, fmtNum } from './aggregate';

// Formal palette: FI brand + status/accent colors.
const COLORS = ['#2563eb', '#06b6d4', '#7c3aed', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#14b8a6'];
// A diverse, well-separated palette for charts so series/categories are easy to tell apart.
const DIVERSE = ['#2563eb', '#06b6d4', '#7c3aed', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#14b8a6', '#6366f1', '#ec4899', '#84cc16', '#f97316'];
const ACCENTS = ['#2563eb', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];
const KPI_ICONS = [TrendingUp, Activity, BarChart3, Percent, Hash, Gauge];
const CHART_ICONS = { bar: BarChart3, line: LineChartIcon, area: Activity, pie: PieChartIcon, scatter: ScatterIcon, table: Table2 };

// Charts use a diverse palette led by the dashboard's theme colour (harmonised but varied).
function chartPalette(theme) {
  if (!theme) return COLORS;
  const lead = (theme.gradient && theme.gradient[1]) || (theme.palette && theme.palette[0]) || COLORS[0];
  const lc = String(lead).toLowerCase();
  return [lead, ...DIVERSE.filter((c) => c.toLowerCase() !== lc)];
}

const widthClass = (panel) => {
  if (panel.type === 'kpi') return '';
  return panel.width === 'full' ? 'lg:col-span-2' : '';
};

const isEmpty = (panel, computed) => {
  if (!computed) return true;
  if (panel.type === 'kpi') return computed.kpi === null || computed.kpi === undefined || Number.isNaN(computed.kpi);
  return !computed.data || computed.data.length === 0;
};

const tickFmt = (v) => { const s = String(v ?? ''); return s.length > 14 ? s.slice(0, 13) + '…' : s; };

// Animated count-up for KPI values.
function useCountUp(value, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (typeof value !== 'number' || isNaN(value)) { setN(value); return; }
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return n;
}

// Tiny inline sparkline (area) drawn from a real micro-trend series.
function Sparkline({ points, color }) {
  const gid = useId().replace(/:/g, '');
  if (!points || points.length < 2) return null;
  const W = 100, H = 30;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const step = W / (points.length - 1);
  const xy = points.map((v, i) => [i * step, H - ((v - min) / span) * (H - 4) - 2]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 w-full">
      <defs>
        <linearGradient id={`sp-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sp-${gid})`} />
      <motion.polyline
        points={line} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }}
      />
    </svg>
  );
}

function KpiBody({ value, accent, sub, spark }) {
  const n = useCountUp(value);
  let delta = null;
  if (spark && spark.length >= 2) {
    const first = spark[0], last = spark[spark.length - 1];
    if (first !== 0 && isFinite(first)) delta = ((last - first) / Math.abs(first)) * 100;
  }
  const up = delta != null && delta >= 0;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-black tracking-tight" style={{ color: accent }}>{fmtNum(n)}</div>
        {delta != null && Math.abs(delta) >= 0.1 && (
          <span className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      {sub && (
        <div className="mt-1 text-[11px] font-medium text-slate-500">
          {sub.label}: <span className="font-semibold text-slate-700">{fmtNum(sub.value)}</span>
        </div>
      )}
      {spark && <div className="mt-auto pt-3"><Sparkline points={spark} color={accent} /></div>}
    </div>
  );
}

function ChartBody({ panel, computed, colors }) {
  const { data, dimKey, series } = computed;
  const SERIES_FILL = (i) => colors[i % colors.length];

  if (panel.type === 'table') {
    const cols = computed.rawColumns || [dimKey, ...series.map((s) => s.key)];
    return (
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              {cols.map((c) => <th key={c} className="px-2 py-2 font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1.5 text-slate-700">
                    {typeof row[c] === 'number' ? fmtNum(row[c]) : String(row[c] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const many = data.length > 8;
  const xAxis = (
    <XAxis dataKey={dimKey} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={tickFmt}
      interval={many ? 'preserveStartEnd' : 0} angle={many ? -25 : 0} textAnchor={many ? 'end' : 'middle'} height={many ? 54 : 28} minTickGap={6} />
  );
  const yAxis = <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={fmtNum} width={48} />;
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />;
  const tip = <Tooltip formatter={(v) => fmtNum(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />;
  const legend = series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null;
  const margin = { top: 8, right: 12, left: 0, bottom: 0 };
  const single = series.length === 1;

  return (
    <ResponsiveContainer width="100%" height={264}>
      {panel.type === 'bar' ? (
        <BarChart data={data} margin={margin}>
          {grid}{xAxis}{yAxis}{tip}{legend}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES_FILL(i)} radius={[5, 5, 0, 0]} maxBarSize={46}>
              {single && data.map((_, ci) => <Cell key={ci} fill={SERIES_FILL(ci)} />)}
            </Bar>
          ))}
        </BarChart>
      ) : panel.type === 'line' ? (
        <LineChart data={data} margin={margin}>
          {grid}{xAxis}{yAxis}{tip}{legend}
          {series.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES_FILL(i)} strokeWidth={2.5} dot={false} />)}
        </LineChart>
      ) : panel.type === 'area' ? (
        <AreaChart data={data} margin={margin}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`g-${panel.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_FILL(i)} stopOpacity={0.32} />
                <stop offset="100%" stopColor={SERIES_FILL(i)} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {grid}{xAxis}{yAxis}{tip}{legend}
          {series.map((s, i) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES_FILL(i)} strokeWidth={2.5} fill={`url(#g-${panel.id}-${i})`} />)}
        </AreaChart>
      ) : panel.type === 'pie' ? (
        <PieChart>
          <Pie data={data} dataKey={series[0]?.key} nameKey={dimKey} cx="50%" cy="50%" outerRadius={92} innerRadius={52} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={SERIES_FILL(i)} />)}
          </Pie>
          {tip}
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      ) : panel.type === 'scatter' ? (
        <ScatterChart margin={margin}>
          {grid}
          <XAxis dataKey={series[0]?.key} name={series[0]?.label} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={fmtNum} />
          <YAxis dataKey={series[1]?.key || series[0]?.key} name={(series[1] || series[0])?.label} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={fmtNum} width={48} />
          {tip}
          <Scatter data={data} fill={SERIES_FILL(2)} />
        </ScatterChart>
      ) : (
        <div className="grid h-full place-items-center text-sm text-slate-400">Unsupported chart: {panel.type}</div>
      )}
    </ResponsiveContainer>
  );
}

export default function VizPanel({ panel: rawPanel, rows, onRemove, onPin, index = 0, theme }) {
  const panel = normalizePanel(rawPanel);
  let computed = null;
  try { computed = computePanel(panel, rows); } catch (e) { computed = null; }
  const empty = isEmpty(panel, computed);
  const isKpi = panel.type === 'kpi';
  const colors = chartPalette(theme);                              // diverse, theme-led (charts)
  const accents = theme?.palette?.length ? theme.palette : ACCENTS; // theme accents (KPIs)
  const accent = accents[index % accents.length];
  const Icon = isKpi ? KPI_ICONS[index % KPI_ICONS.length] : (CHART_ICONS[panel.type] || BarChart3);
  const spark = isKpi && !empty ? (() => { try { return computeSpark(panel, rows); } catch (_) { return null; } })() : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 p-5 shadow-sm ring-1 ring-slate-900/[0.02] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${isKpi ? '' : 'bg-white/90'} ${widthClass(panel)}`}
      style={isKpi ? { background: `linear-gradient(150deg, ${accent}0f, rgba(255,255,255,0.92) 55%)` } : undefined}
    >
      {/* Ambient corner glow */}
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-[0.13] blur-2xl transition-opacity duration-300 group-hover:opacity-25" style={{ background: accent }} />

      <div className="relative mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}b3)` }}>
            <Icon size={16} />
          </span>
          <h3 className={`font-bold text-slate-800 ${isKpi ? 'text-[11px] uppercase tracking-wide text-slate-500' : 'text-sm'}`}>{panel.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {onPin && (
            <button onClick={() => onPin(rawPanel)} title="Pin to dashboard"
              className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500 opacity-0 transition-all hover:border-brand-blue hover:text-brand-blue group-hover:opacity-100">
              <Pin size={11} /> Pin
            </button>
          )}
          {onRemove && (
            <button onClick={() => onRemove(panel.id)} title="Remove" className="opacity-0 transition-opacity group-hover:opacity-100">
              <X size={15} className="text-slate-400 hover:text-rose-500" />
            </button>
          )}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col">
        {empty ? (
          <div className={`flex items-center text-sm text-slate-300 ${isKpi ? '' : 'h-40 justify-center'}`}>
            {isKpi ? <span className="text-3xl font-black text-slate-300">—</span> : 'No data for this view'}
          </div>
        ) : isKpi ? (
          <KpiBody value={computed.kpi} accent={accent} sub={computed.sub} spark={spark} />
        ) : (
          <ChartBody panel={panel} computed={computed} colors={colors} />
        )}
      </div>
    </motion.div>
  );
}

export { widthClass };
