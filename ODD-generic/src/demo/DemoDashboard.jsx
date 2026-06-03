import { useState, useMemo, useEffect } from 'react'
import { LayoutDashboard, BarChart3, PieChart, TrendingUp, Table2, Layers, Map, Activity, Sparkles } from 'lucide-react'
import VizPanel from './VizPanel'
import DemoAssistant from './DemoAssistant'

const PAGE_ICONS = [LayoutDashboard, BarChart3, PieChart, TrendingUp, Table2, Layers, Map, Activity]

// Self-contained, interactive dashboard rendered inside the landing window from
// in-code data (no backend / iframe). Mirrors the real app's renderer + theme.
export default function DemoDashboard({ demo }) {
  const spec = demo.spec
  const theme = spec.theme
  const grad = theme?.gradient?.length >= 2 ? `linear-gradient(135deg, ${theme.gradient.join(', ')})` : 'linear-gradient(135deg,#06b6d4,#2563eb,#7c3aed)'
  const accent = theme?.palette?.[0] || theme?.gradient?.[1] || '#2563eb'

  const tablesByName = useMemo(() => {
    const m = {}
    ;(demo.tables || []).forEach((t) => { m[t.name] = t.rows })
    return m
  }, [demo])
  const allRows = useMemo(() => Object.values(tablesByName).flat(), [tablesByName])
  const rowsForPanel = (p) => (p.table && tablesByName[p.table]) || allRows

  const pages = spec.pages || []
  const [activePage, setActivePage] = useState(0)
  const [showInsights, setShowInsights] = useState(false)
  const [insights, setInsights] = useState(null)
  useEffect(() => { setActivePage(0); setShowInsights(false); setInsights(null) }, [demo])

  const page = pages[activePage] || pages[0]

  const onVisualize = (viz) => {
    if (!viz?.panels) return
    const newPanels = viz.panels.map((p, i) => ({ ...p, id: p.id || `v${Date.now()}_${i}` }))
    setInsights((prev) => (viz.append && prev?.panels?.length)
      ? { title: prev.title || viz.title || 'AI Insights', panels: [...prev.panels, ...newPanels] }
      : { title: viz.title || 'AI Insights', panels: newPanels })
    setShowInsights(true)
  }
  const onNavigate = (target) => {
    if (/insight/i.test(String(target))) { setShowInsights(true); return }
    const idx = pages.findIndex((p) => p.id === target || (p.title || '').toLowerCase() === String(target).toLowerCase())
    if (idx !== -1) { setShowInsights(false); setActivePage(idx) }
  }

  const navBtn = (label, Icon, active, onClick) => (
    <button key={label} onClick={onClick} title={label}
      className={`relative flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-semibold transition-colors sm:justify-start sm:px-2.5 ${active ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
      style={active ? { background: grad, boxShadow: `0 8px 18px -8px ${accent}90` } : undefined}>
      {active && <span className="absolute left-0 top-1/2 hidden h-4 w-1 -translate-y-1/2 rounded-r-full bg-white/80 sm:block" />}
      <Icon size={14} className={active ? 'text-white' : 'text-slate-400'} />
      <span className="hidden truncate sm:inline">{label}</span>
    </button>
  )

  const renderPanels = () => {
    const list = showInsights ? (insights?.panels || []) : (page?.panels || [])
    const kpis = list.filter((p) => (p.type || '').toLowerCase() === 'kpi')
    const charts = list.filter((p) => (p.type || '').toLowerCase() !== 'kpi')
    if (!list.length) {
      return (
        <div className="grid place-items-center py-16 text-center text-sm text-slate-400">
          <Sparkles size={26} className="mb-2 text-slate-300" />
          Ask the assistant to chart or compare something — it appears here.
        </div>
      )
    }
    return (
      <div className="space-y-3">
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((p, i) => <VizPanel key={p.id} index={i} panel={p} rows={rowsForPanel(p)} theme={theme} />)}
          </div>
        )}
        {charts.length > 0 && (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {charts.map((p, i) => <VizPanel key={p.id} index={i} panel={p} rows={rowsForPanel(p)} theme={theme} />)}
          </div>
        )}
      </div>
    )
  }

  const c1 = theme?.gradient?.[0] || accent
  const c2 = (theme?.gradient && theme.gradient[theme.gradient.length - 1]) || '#7c3aed'

  return (
    <div className="relative flex h-full w-full">
      {/* Themed ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -left-20 -top-16 h-72 w-72 rounded-full blur-3xl opacity-[0.10]" style={{ background: c1 }} />
        <div className="absolute right-[-8%] top-1/3 h-80 w-80 rounded-full blur-3xl opacity-[0.08]" style={{ background: c2 }} />
      </div>

      {/* Sidebar */}
      <nav className="relative z-10 flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white/70 p-2 sm:w-44">
        <div className="hidden px-2 pb-1 pt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:block">Pages</div>
        {pages.map((p, i) => navBtn(p.title || `Page ${i + 1}`, PAGE_ICONS[i % PAGE_ICONS.length], !showInsights && i === activePage, () => { setShowInsights(false); setActivePage(i) }))}
        <div className="my-1 h-px bg-slate-100" />
        {navBtn('AI Insights', Sparkles, showInsights, () => setShowInsights(true))}
      </nav>

      {/* Content (scrolls) */}
      <div className="relative z-10 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="h-7 w-1.5 rounded-full" style={{ background: grad }} />
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {showInsights ? 'Generated by AI' : `Page ${activePage + 1} of ${pages.length}`}
            </div>
            <h3 className="truncate text-sm font-extrabold tracking-tight text-slate-900">
              {showInsights ? 'AI Insights' : (page?.title || spec.title)}
            </h3>
          </div>
        </div>
        {renderPanels()}
      </div>

      {/* Assistant — anchored to the window, not the scrolling content */}
      <DemoAssistant spec={spec} tablesByName={tablesByName} onVisualize={onVisualize} onNavigate={onNavigate} accent={accent} />
    </div>
  )
}
