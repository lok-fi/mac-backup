import { toNum } from './aggregate'

// Build a compact text summary of the in-code dataset for the AI (same shape the
// odd-app sends), so the assistant grounds on real data and computes correctly.
export function buildDataSummary(spec, tablesByName) {
  const lines = []
  lines.push(`DASHBOARD: ${spec?.title || 'Dashboard'}`)
  const pages = (spec?.pages || []).map((p) => p.title).filter(Boolean)
  if (pages.length) lines.push(`PAGES: ${pages.join(' | ')} | AI Insights`)

  for (const [name, rows] of Object.entries(tablesByName || {})) {
    if (!rows || !rows.length) continue
    const cols = Object.keys(rows[0] || {})
    const numCols = cols.filter((c) => {
      const vals = rows.slice(0, 40).map((r) => r[c]).filter((v) => v !== null && v !== '')
      return vals.length && vals.every((v) => !isNaN(toNum(v)))
    })
    const dimCols = cols.filter((c) => !numCols.includes(c))
    lines.push(`\nTABLE "${name}" — ${rows.length} rows`)
    lines.push(`  dimensions: ${dimCols.join(', ') || '(none)'}`)
    lines.push(`  measures: ${numCols.join(', ') || '(none)'}`)
    numCols.slice(0, 8).forEach((c) => {
      const sum = rows.reduce((s, r) => s + (toNum(r[c]) || 0), 0)
      lines.push(`  sum(${c}) = ${Math.round(sum * 100) / 100}`)
    })
    lines.push(`  sample: ${JSON.stringify(rows.slice(0, 4))}`)
  }
  return lines.join('\n').slice(0, 16000)
}

// AI endpoint on the Catalyst function (derived from the app base URL).
export function aiBase(oddAppUrl) {
  return oddAppUrl.replace(/\/app\/?$/, '') + '/server/api'
}
