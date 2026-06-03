import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, LayoutDashboard, Sparkles, Wand2, BarChart3, PieChart, TrendingUp, Table2, Layers, Map, Activity } from 'lucide-react';
import Brand from './components/Brand';
import VizPanel from './components/VizPanel';
import Assistant from './components/Assistant';
import RequestDemoModal from './components/RequestDemoModal';

// Distinct icon per page tab (cycled by index).
const PAGE_ICONS = [LayoutDashboard, BarChart3, PieChart, TrendingUp, Table2, Layers, Map, Activity];

const newId = (p) => `${p}_${Math.random().toString(36).slice(2, 7)}`;

// Apply assistant actions to the spec. Returns { spec, navigateTo }.
function applyActions(spec, actions) {
  const next = JSON.parse(JSON.stringify(spec));
  next.pages = next.pages || [];
  let navigateTo = null;

  const findPanel = (id) => {
    for (const page of next.pages) {
      const idx = (page.panels || []).findIndex((p) => p.id === id);
      if (idx !== -1) return { page, idx };
    }
    return null;
  };

  for (const a of actions) {
    if (!a || !a.type) continue;
    if (a.type === 'setTitle') {
      next.title = a.value || next.title;
    } else if (a.type === 'addPage' && a.page) {
      const page = { ...a.page, id: a.page.id || newId('page'), panels: (a.page.panels || []).map((p) => ({ ...p, id: p.id || newId('p') })) };
      next.pages.push(page);
      navigateTo = page.id;
    } else if (a.type === 'addPanel' && a.panel) {
      const panel = { ...a.panel, id: a.panel.id || newId('p') };
      let page = next.pages.find((pg) => pg.id === a.pageId);
      if (!page) page = next.pages[0];
      if (!page) { page = { id: newId('page'), title: 'Page', panels: [] }; next.pages.push(page); }
      page.panels = page.panels || [];
      page.panels.push(panel);
      navigateTo = page.id;
    } else if (a.type === 'updatePanel' && a.panelId) {
      const hit = findPanel(a.panelId);
      if (hit) hit.page.panels[hit.idx] = { ...hit.page.panels[hit.idx], ...(a.panel || {}) };
    } else if (a.type === 'removePanel' && a.panelId) {
      const hit = findPanel(a.panelId);
      if (hit) hit.page.panels.splice(hit.idx, 1);
    } else if (a.type === 'navigate' && a.pageId) {
      navigateTo = a.pageId;
    }
  }
  return { spec: next, navigateTo };
}

export default function Dashboard() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const [spec, setSpec] = useState(null);
  const [tablesByName, setTablesByName] = useState({});
  const [activePage, setActivePage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AI Insights tab — ephemeral (in-memory, clears on refresh).
  const [insights, setInsights] = useState(null);   // { title, panels: [] }
  const [showInsights, setShowInsights] = useState(false);

  const [building, setBuilding] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const isDemo = String(dashboardId || '').startsWith('demo_');

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    setLoading(true); setError('');

    const load = async (isPoll) => {
      try {
        const { api } = await import('./api');
        const dash = await api.getDashboard(dashboardId);
        if (cancelled) return;
        const sp = dash.spec || {};

        if (sp.error) { setError(sp.error); setBuilding(false); setLoading(false); return; }

        if (sp.building) {
          // AI is still designing — show progress and poll.
          setBuilding(true);
          setSpec(sp);
          setLoading(false);
          timer = setTimeout(() => load(true), 3000);
          return;
        }

        // Ready — load rows (once) and render.
        setBuilding(false);
        const rows = await api.getRows(dashboardId);
        if (cancelled) return;
        const map = {};
        (rows.tables || []).forEach((t) => { map[t.name] = t.rows; });
        setTablesByName(map);
        setSpec(sp.pages ? sp : { title: dash.title || 'Dashboard', pages: [] });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (isPoll) { timer = setTimeout(() => load(true), 3000); return; } // transient during build
        setError(err.message); setLoading(false);
      }
    };

    load(false);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [dashboardId]);

  const allRows = useMemo(() => {
    const merged = [];
    Object.values(tablesByName).forEach((rows) => merged.push(...rows));
    return merged;
  }, [tablesByName]);

  const rowsForPanel = useCallback(
    (panel) => (panel.table && tablesByName[panel.table]) || allRows,
    [tablesByName, allRows]
  );

  const persist = useCallback(async (newSpec) => {
    if (isDemo) return; // demos are read-only — never overwrite the seeded spec
    try {
      const { api } = await import('./api');
      await api.saveDashboard(dashboardId, newSpec);
    } catch (_) { /* non-fatal */ }
  }, [dashboardId, isDemo]);

  const handleActions = useCallback((actions) => {
    setSpec((prev) => {
      const { spec: nextSpec, navigateTo } = applyActions(prev, actions);
      if (navigateTo) {
        const idx = nextSpec.pages.findIndex((p) => p.id === navigateTo);
        if (idx !== -1) setActivePage(idx);
      }
      persist(nextSpec);
      return nextSpec;
    });
  }, [persist]);

  const removePanel = useCallback((panelId) => {
    handleActions([{ type: 'removePanel', panelId }]);
  }, [handleActions]);

  // Assistant → render charts in the ephemeral AI Insights tab.
  const handleVisualize = useCallback((viz) => {
    if (!viz || !viz.panels) return;
    const newPanels = viz.panels.map((p, i) => ({ ...p, id: p.id || `viz_${Date.now()}_${i}` }));
    setInsights((prev) => (viz.append && prev?.panels?.length)
      ? { title: prev.title || viz.title || 'AI Insights', panels: [...prev.panels, ...newPanels] }
      : { title: viz.title || 'AI Insights', panels: newPanels });
    setShowInsights(true);
  }, []);

  // Assistant → navigate to a page by title/id, or to AI Insights.
  const handleNavigate = useCallback((target) => {
    if (!target) return;
    if (/insight/i.test(String(target))) { setShowInsights(true); return; }
    setSpec((prev) => {
      const idx = (prev?.pages || []).findIndex((p) => p.id === target || (p.title || '').toLowerCase() === String(target).toLowerCase());
      if (idx !== -1) { setShowInsights(false); setActivePage(idx); }
      return prev;
    });
  }, []);

  // Pin an insight panel into the real dashboard (page 0) and persist.
  const pinPanel = useCallback((panel) => {
    const pageId = spec?.pages?.[0]?.id;
    handleActions([{ type: 'addPanel', pageId, panel: { ...panel, id: `p_${Date.now()}` } }]);
    setShowInsights(false);
  }, [spec, handleActions]);

  if (loading) {
    return (
      <div className="relative z-10 grid min-h-screen place-items-center">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" /> Loading dashboard…
        </div>
      </div>
    );
  }
  if (building) {
    return (
      <div className="relative z-10 grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-cyan via-brand-blue to-brand-violet text-white shadow-lg">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">
            {spec?.title || 'Building your dashboard'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            The data agent is analysing your data, deciding how to use it, and designing the
            dashboard. This usually takes under a minute — the page updates automatically.
          </p>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-violet" />
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="relative z-10 grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-800">Couldn't load this dashboard</p>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <button onClick={() => navigate('/')} className="mt-5 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white">
            Back to upload
          </button>
        </div>
      </div>
    );
  }

  const pages = spec?.pages || [];
  const page = pages[activePage] || pages[0];
  const theme = spec?.theme;
  const grad = theme?.gradient?.length >= 2 ? `linear-gradient(135deg, ${theme.gradient.join(', ')})` : 'linear-gradient(135deg,#06b6d4,#2563eb,#7c3aed)';
  const accent = theme?.palette?.[0] || theme?.gradient?.[1] || '#2563eb';

  const c1 = theme?.gradient?.[0] || accent;
  const c2 = (theme?.gradient && theme.gradient[theme.gradient.length - 1]) || '#7c3aed';

  const navButton = (label, IconC, active, onClick, vertical) => (
    <button
      onClick={onClick}
      title={label}
      className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${vertical ? 'w-full text-left' : 'shrink-0'} ${
        active ? 'text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
      style={active ? { background: grad, boxShadow: `0 8px 20px -6px ${accent}80` } : undefined}
    >
      {active && vertical && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/80" />}
      <IconC size={15} className={active ? 'text-white' : 'text-slate-400'} />
      <span className="truncate">{label}</span>
    </button>
  );

  const renderNav = (vertical) => (
    <>
      {pages.map((p, i) => navButton(
        p.title || `Page ${i + 1}`, PAGE_ICONS[i % PAGE_ICONS.length], !showInsights && i === activePage,
        () => { setShowInsights(false); setActivePage(i); }, vertical,
      ))}
      {vertical && <div className="my-1 h-px bg-slate-100" />}
      {navButton('AI Insights', Sparkles, showInsights, () => setShowInsights(true), vertical)}
    </>
  );

  return (
    <div className="relative z-10 min-h-screen">
      {/* Themed ambient background — gives each industry dashboard its own mood */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-24 h-96 w-96 rounded-full blur-3xl opacity-[0.10]" style={{ background: c1 }} />
        <div className="absolute right-[-10%] top-1/3 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-[0.09]" style={{ background: c2 }} />
        <div className="absolute bottom-[-10%] left-1/3 h-80 w-80 rounded-full blur-3xl opacity-[0.06]" style={{ background: accent }} />
      </div>
      {/* Fixed full-height sidebar (desktop) */}
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white/80 backdrop-blur lg:flex">
        <div className="flex h-[68px] items-center border-b border-slate-200/70 px-4">
          <Brand to="/" />
        </div>
        <div className="px-4 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Pages</div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">{renderNav(true)}</nav>
      </aside>

      {/* Main column */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/70 px-5 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => navigate('/')} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/70 text-slate-600 hover:bg-slate-100">
              <ArrowLeft size={16} />
            </button>
            <div className="lg:hidden"><Brand to="/" /></div>
            <h1 className="hidden truncate text-xl font-black tracking-tight text-slate-900 sm:block">{spec?.title || 'Dashboard'}</h1>
            {isDemo && <span className="hidden rounded-full border border-slate-200 bg-white/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:inline">Demo</span>}
          </div>
          {isDemo && (
            <button onClick={() => setRequestOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.03]" style={{ background: grad }}>
              <Wand2 size={16} /> <span className="hidden sm:inline">Request your own demo</span><span className="sm:hidden">Demo</span>
            </button>
          )}
        </header>

        {/* Mobile horizontal nav */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200/70 px-4 py-2 lg:hidden">{renderNav(false)}</div>

        {/* Content */}
        <div className="mx-auto max-w-[1700px] px-4 py-6 pb-28 sm:px-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-9 w-1.5 rounded-full" style={{ background: grad }} />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {showInsights ? 'Generated by AI' : `Page ${activePage + 1} of ${pages.length}`}
              </div>
              <h2 className="truncate text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                {showInsights ? (insights?.title || 'AI Insights') : (page?.title || spec?.title || 'Dashboard')}
              </h2>
            </div>
          </div>
          {showInsights ? (
            insights && insights.panels.length ? (
              <div>
                <p className="mb-4 text-sm text-slate-500">
                  {insights.title} · ephemeral — <span className="font-medium text-slate-600">Pin</span> any panel to add it to your dashboard. Clears on refresh.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {insights.panels.map((panel, i) => (
                    <VizPanel key={panel.id} index={i} panel={panel} rows={rowsForPanel(panel)} onPin={pinPanel} theme={theme} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid place-items-center rounded-3xl border border-dashed border-slate-300 bg-white/60 py-20 text-center">
                <Sparkles size={28} className="text-slate-300" />
                <p className="mt-3 max-w-sm text-sm text-slate-500">
                  Ask the assistant to <span className="font-medium">chart, compare or visualize</span> anything — the result appears here, and you can pin it to your dashboard.
                </p>
              </div>
            )
          ) : page && page.panels && page.panels.length ? (
            (() => {
              const kpis = page.panels.filter((p) => (p.type || '').toLowerCase() === 'kpi');
              const charts = page.panels.filter((p) => (p.type || '').toLowerCase() !== 'kpi');
              return (
                <div className="space-y-4">
                  {kpis.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                      {kpis.map((panel, i) => (
                        <VizPanel key={panel.id} index={i} panel={panel} rows={rowsForPanel(panel)} onRemove={isDemo ? undefined : removePanel} theme={theme} />
                      ))}
                    </div>
                  )}
                  {charts.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {charts.map((panel, i) => (
                        <VizPanel key={panel.id} index={i} panel={panel} rows={rowsForPanel(panel)} onRemove={isDemo ? undefined : removePanel} theme={theme} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="grid place-items-center rounded-3xl border border-dashed border-slate-300 bg-white/60 py-20 text-center">
              <LayoutDashboard size={28} className="text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">This page has no panels yet. Ask the assistant to add one.</p>
            </div>
          )}
        </div>
      </div>

      <Assistant
        dashboardId={dashboardId}
        spec={spec}
        tablesByName={tablesByName}
        onActions={handleActions}
        onVisualize={handleVisualize}
        onNavigate={handleNavigate}
      />

      <RequestDemoModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        industry={spec?.title || dashboardId}
        accent={accent}
      />
    </div>
  );
}
