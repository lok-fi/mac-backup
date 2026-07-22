/**
 * Visualization Agent Pipeline (manual SequentialAgent)
 * ─────────────────────────────────────────────────────
 * Same architecture as the ADK-based version but built directly on raw Gemini REST
 * so the Catalyst function zip stays well under the 150 MB size limit. ADK pulled in
 * 200+ MB of enterprise plumbing (googleapis, opentelemetry, azure, mcp) we don't use.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Initial state: { question, schema_map }                  │
 *   └─────────────────────────────────────────────────────────┘
 *           │
 *           ▼
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ ① DataResolverAgent (LlmAgent)                           │
 *   │   reads:   {schema_map} + question                       │
 *   │   outputs (outputKey: resolved_intent): JSON             │
 *   │     { dataType, mode: "list"|"group", justification }    │
 *   └─────────────────────────────────────────────────────────┘
 *           │
 *           ▼
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ ② SpecBuilderAgent (LlmAgent)                            │
 *   │   reads:   question + {resolved_intent} + {schema_map}   │
 *   │   outputs (outputKey: proposed_spec): chart spec JSON    │
 *   └─────────────────────────────────────────────────────────┘
 *           │
 *           ▼
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ ③ validateSpec() — pure JS, no LLM                       │
 *   │   drops bad cols/metrics, clamps limit, picks headline   │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Voice mode (Gemini Live) is unaffected. This pipeline is invoked only by
 * /agents/visualize → used by AI Insights tab + text-mode visualize requests.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBUh0n4zBjKJZ7qz34zxZ7o0LqyQGZ3jBA';
const MODEL          = 'gemini-flash-latest';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── Build a schema summary the agents can reason over. Avoids sending all records;
// sends per-dataType field names, sample values, and counts.
function buildSchemaMap(records) {
    const datatypes = {};
    const allTypes = ['opportunity', 'lead', 'quote', 'sap_sales', 'service_request', 'spare_quote'];

    for (const dt of allTypes) {
        const matches = records.filter(r => {
            if (dt === 'opportunity') return r.source !== 'creator' && (!r.dataType || r.dataType === 'opportunity');
            return r.dataType === dt;
        });
        if (matches.length === 0) { datatypes[dt] = { count: 0, fields: [], samples: {} }; continue; }

        const fieldHits = {};
        const samples = {};
        for (const r of matches) {
            for (const [k, v] of Object.entries(r)) {
                if (v == null || v === '') continue;
                fieldHits[k] = (fieldHits[k] || 0) + 1;
                if (!samples[k]) samples[k] = new Set();
                if (samples[k].size < 3) samples[k].add(String(v).slice(0, 60));
            }
        }
        // Keep fields populated on at least 1% of records
        const fields = Object.entries(fieldHits)
            .filter(([, n]) => n / matches.length >= 0.01)
            .map(([k]) => k);

        const sampleMap = {};
        for (const f of fields) sampleMap[f] = Array.from(samples[f] || []);

        datatypes[dt] = { count: matches.length, fields, samples: sampleMap };
    }
    return datatypes;
}

// ── Substitute {key} placeholders in an instruction with values from session state.
function renderInstruction(template, state) {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
        const v = state[key];
        if (v == null) return '';
        return typeof v === 'string' ? v : JSON.stringify(v);
    });
}

// ── Manual LlmAgent — wraps one Gemini REST call. Reads its instruction
// (after {placeholder} substitution from state), calls Gemini, parses the response
// (preferring JSON when possible), writes the result under outputKey.
class LlmAgent {
    constructor({ name, instruction, outputKey, generationConfig }) {
        this.name = name;
        this.instruction = instruction;
        this.outputKey = outputKey;
        this.generationConfig = generationConfig || { temperature: 0.2, maxOutputTokens: 1024 };
    }
    async run(state) {
        const rendered = renderInstruction(this.instruction, state);
        const body = {
            contents: [{ role: 'user', parts: [{ text: rendered }] }],
            generationConfig: this.generationConfig,
        };
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini ${this.name} ${res.status}: ${errText.slice(0, 200)}`);
        }
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = tryParseJSON(text);
        state[this.outputKey] = parsed != null ? parsed : text;
        return state;
    }
}

// ── Manual SequentialAgent — runs sub-agents in order, sharing state.
// Mirrors @google/adk's SequentialAgent. State is a plain JS object the
// sub-agents read from (via {placeholders}) and write to (via outputKey).
class SequentialAgent {
    constructor({ name, subAgents }) {
        this.name = name;
        this.subAgents = subAgents;
    }
    async run(initialState) {
        let state = { ...initialState };
        for (const agent of this.subAgents) {
            state = await agent.run(state);
        }
        return state;
    }
}

// ── Sub-agent factories ──
function makeDataResolverAgent() {
    return new LlmAgent({
        name: 'DataResolverAgent',
        outputKey: 'resolved_intent',
        instruction: `You decide which dataset the user wants visualized.

The data available for this dashboard:
{schema_map}

User's question / request: "{question}"

Pick the SINGLE best dataType and decide whether the user wants individual records (LIST mode) or aggregations (GROUP mode).

Decision guide:
- "spare quote", "spare quotation"  → dataType: spare_quote
- "service request", "SR", "AMC", "technician" → dataType: service_request
- "deal", "opportunity", "pipeline", "won", "lost" → dataType: opportunity
- "lead", "enquiry" → dataType: lead
- "quote" (NOT spare) → dataType: quote
- "sales order", "SAP", "payment" → dataType: sap_sales

LIST vs GROUP:
- "top N", "biggest", "list", "show me the X", "by name" → mode: list
- "how many", "by region", "compare", "breakdown" → mode: group

CRITICAL: only pick a dataType that has count > 0 in the schema_map above.

Output ONLY valid JSON, no markdown:
{
  "dataType": "<one of: opportunity|lead|quote|sap_sales|service_request|spare_quote>",
  "mode":     "<list or group>",
  "justification": "<one sentence — why you picked this dataType>"
}`,
    });
}

function makeSpecBuilderAgent() {
    return new LlmAgent({
        name: 'SpecBuilderAgent',
        outputKey: 'proposed_spec',
        instruction: `Build a chart spec for the user's request. The previous agent already picked the dataType and mode.

User's question: "{question}"

Resolved intent (from DataResolverAgent):
{resolved_intent}

Schema map (use ONLY fields that exist on the chosen dataType):
{schema_map}

If mode is "list":
  - chartType: "table" (or "kpi" if asking for top-N entities as cards)
  - mode: "list"
  - columns: 3-6 from the dataType's available fields, with the human-readable NAME field first (e.g. "name" for opportunity, "subject" for quote, "serviceRequestNumber" for service_request, "quotationNumber" for spare_quote). NEVER include "id" or "recordId".
  - sortBy / sortDir / limit: pick a numeric field if applicable, descending, limit 10

If mode is "group":
  - chartType: "bar" | "pie" | "table" | "kpi" | "line"
  - groupBy: one categorical field from the available fields (NEVER "id", "name", "title", "recordId")
  - metrics: array of valid aggregations for this dataType
      opportunity: count, amount, winRate, wonValue, pipelineValue, won, lost
      lead/service_request/spare_quote: count only
      quote/sap_sales: count, grandTotal, subTotal
  - sortBy / sortDir / limit: optional

Output ONLY valid JSON, no markdown. Required fields: chartType, dataType, title.

{
  "title":   "<concise panel title that matches the question>",
  "chartType": "...",
  "dataType":  "<from resolved_intent>",
  "mode":      "<list if from resolved_intent.mode == list, else omit>",
  "sortBy":  "<optional>",
  "sortDir": "desc",
  "limit":   10
}`,
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    });
}

// ─────────────────────────────────────────────────────────────
// Programmatic validator — pure JS, no LLM
// ─────────────────────────────────────────────────────────────
const VALID_DATA_TYPES = new Set(['opportunity', 'lead', 'quote', 'sap_sales', 'service_request', 'spare_quote']);
const VALID_CHART_TYPES = new Set(['bar', 'pie', 'line', 'table', 'kpi']);
const INTERNAL_ID_FIELDS = new Set(['id', 'recordId', '_id', 'uuid']);
const HEADLINE_FIELD = {
    opportunity: 'name', lead: 'name',
    quote: 'subject', sap_sales: 'subject',
    service_request: 'serviceRequestNumber', spare_quote: 'quotationNumber',
};
const VALID_METRICS = {
    opportunity:     new Set(['count', 'amount', 'winRate', 'wonValue', 'pipelineValue', 'won', 'lost', 'avgProbability']),
    lead:            new Set(['count']),
    quote:           new Set(['count', 'grandTotal', 'subTotal']),
    sap_sales:       new Set(['count', 'grandTotal', 'subTotal']),
    service_request: new Set(['count']),
    spare_quote:     new Set(['count']),
};

function validateSpec(spec, schemaMap) {
    const warnings = [];
    if (!spec || typeof spec !== 'object') {
        return { spec: null, warnings: ['Spec was empty or malformed.'], fatal: true };
    }
    if (!VALID_CHART_TYPES.has(spec.chartType)) {
        warnings.push(`Unsupported chartType "${spec.chartType}" → table`);
        spec.chartType = 'table';
    }
    if (!VALID_DATA_TYPES.has(spec.dataType)) {
        warnings.push(`Invalid dataType "${spec.dataType}" → opportunity`);
        spec.dataType = 'opportunity';
    }
    const dtInfo = schemaMap[spec.dataType] || { count: 0, fields: [] };
    if (dtInfo.count === 0) warnings.push(`No ${spec.dataType} records in current dataset.`);
    const validFields = new Set(dtInfo.fields);

    if (spec.mode === 'list' || (spec.columns && spec.columns.length)) {
        const cleaned = (spec.columns || []).filter(c => validFields.has(c) && !INTERNAL_ID_FIELDS.has(c));
        const headline = HEADLINE_FIELD[spec.dataType];
        if (headline && validFields.has(headline) && !cleaned.includes(headline)) cleaned.unshift(headline);
        spec.columns = cleaned.length ? cleaned : (headline ? [headline] : []);
        spec.mode = 'list';
    }
    if (!spec.mode && spec.groupBy) {
        if (INTERNAL_ID_FIELDS.has(spec.groupBy) || !validFields.has(spec.groupBy)) {
            warnings.push(`groupBy "${spec.groupBy}" invalid; promoting to list mode.`);
            spec.mode = 'list';
            spec.chartType = 'table';
            spec.columns = [HEADLINE_FIELD[spec.dataType]].filter(Boolean);
            delete spec.groupBy;
        }
    }
    if (Array.isArray(spec.metrics)) {
        const allowed = VALID_METRICS[spec.dataType] || new Set(['count']);
        const ok = spec.metrics.filter(m => allowed.has(m));
        if (ok.length === 0) ok.push('count');
        spec.metrics = ok;
    }
    if (spec.limit != null) {
        const n = Number(spec.limit);
        spec.limit = isFinite(n) ? Math.max(1, Math.min(100, Math.floor(n))) : 10;
    }
    return { spec, warnings, fatal: false };
}

// ─────────────────────────────────────────────────────────────
// Robust JSON extractor (strips ```json fences, brace-balanced scan)
// ─────────────────────────────────────────────────────────────
function tryParseJSON(s) {
    if (s == null) return null;
    let txt = String(s).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try { return JSON.parse(txt); } catch (_) {}
    const start = txt.indexOf('{');
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < txt.length; i++) {
        const c = txt[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) {
                try { return JSON.parse(txt.slice(start, i + 1)); } catch (_) { return null; }
            }
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────
// Public entry point — same signature as before
// ─────────────────────────────────────────────────────────────
async function runVisualizationPipeline({ question, records }) {
    const schemaMap = buildSchemaMap(records || []);

    const pipeline = new SequentialAgent({
        name: 'VisualizationPipeline',
        subAgents: [makeDataResolverAgent(), makeSpecBuilderAgent()],
    });

    const initialState = {
        question:   question || '',
        schema_map: JSON.stringify(schemaMap),
    };

    let resolvedIntent = null;
    let proposedSpec   = null;

    try {
        const finalState = await pipeline.run(initialState);
        resolvedIntent = finalState.resolved_intent || null;
        proposedSpec   = finalState.proposed_spec   || null;
    } catch (err) {
        return {
            spec: null,
            warnings: [`Pipeline failed: ${err.message}`],
            debug: { resolved_intent: resolvedIntent, raw_spec: null },
        };
    }

    if (!proposedSpec || typeof proposedSpec !== 'object') {
        return {
            spec: null,
            warnings: ['Spec builder produced no parseable JSON. The pipeline may need adjustment.'],
            debug: { resolved_intent: resolvedIntent, raw_spec: proposedSpec },
        };
    }

    const v = validateSpec(proposedSpec, schemaMap);
    return {
        spec: v.spec,
        warnings: v.warnings,
        debug: { resolved_intent: resolvedIntent, raw_spec: proposedSpec },
    };
}

module.exports = { runVisualizationPipeline, buildSchemaMap, validateSpec, LlmAgent, SequentialAgent };
