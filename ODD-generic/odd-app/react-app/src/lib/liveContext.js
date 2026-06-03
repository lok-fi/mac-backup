import { toNum } from './aggregate';

// Build a compact text summary of the loaded dataset for the Live system prompt.
export function buildDataSummary(spec, tablesByName) {
  const lines = [];
  lines.push(`DASHBOARD: ${spec?.title || 'Dashboard'}`);
  const pages = (spec?.pages || []).map((p) => p.title).filter(Boolean);
  if (pages.length) lines.push(`PAGES: ${pages.join(' | ')} | AI Insights`);

  for (const [name, rows] of Object.entries(tablesByName || {})) {
    if (!rows || !rows.length) continue;
    const cols = Object.keys(rows[0] || {});
    const numCols = cols.filter((c) => {
      const vals = rows.slice(0, 40).map((r) => r[c]).filter((v) => v !== null && v !== '');
      return vals.length && vals.every((v) => !isNaN(toNum(v)));
    });
    const dimCols = cols.filter((c) => !numCols.includes(c));
    lines.push(`\nTABLE "${name}" — ${rows.length} rows`);
    lines.push(`  dimensions: ${dimCols.join(', ') || '(none)'}`);
    lines.push(`  measures: ${numCols.join(', ') || '(none)'}`);
    numCols.slice(0, 8).forEach((c) => {
      const sum = rows.reduce((s, r) => s + (toNum(r[c]) || 0), 0);
      lines.push(`  sum(${c}) = ${Math.round(sum * 100) / 100}`);
    });
    lines.push(`  sample: ${JSON.stringify(rows.slice(0, 4))}`);
  }
  return lines.join('\n').slice(0, 16000);
}

// Generic dashboard-control tools exposed to the Live model.
export const DASHBOARD_TOOLS = [{
  functionDeclarations: [
    {
      name: 'navigatePage',
      description: "Switch the dashboard to a page by its title, or to 'AI Insights'.",
      parameters: {
        type: 'OBJECT',
        properties: { page: { type: 'STRING', description: "Page title, or 'AI Insights'." } },
        required: ['page'],
      },
    },
    {
      name: 'askAnalyst',
      description:
        "Delegate any question that needs exact numbers, calculations, rankings, comparisons, or a chart/KPI to the data analyst, which has full access to the underlying data. Pass the user's request in plain English. The analyst computes the precise result, renders any chart/KPI in the AI Insights tab, and returns an 'answer' (and exact 'data' values) for you to read back. ALWAYS use this instead of computing numbers yourself.",
      parameters: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING', description: "The user's data question or chart request, verbatim." },
        },
        required: ['question'],
      },
    },
  ],
}];
