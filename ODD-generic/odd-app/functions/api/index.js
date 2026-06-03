// ─────────────────────────────────────────────────────────────────────────────
// ODD — On Demand Dashboards (FI Digitals)
// Catalyst Node function "api": data-store CRUD + multi-format file parsing +
// orchestration. The AI itself lives in a separate ADK service (Cloud Run) that
// this function calls over HTTP (AGENT_SERVICE_URL + AGENT_SECRET).
//
// Data Store tables (create these in the Catalyst console):
//   datasets(dataset_id, name, source_type, source_meta, schema_json, row_count)
//   dataset_rows(dataset_id, table_name, batch_index, data)
//   dashboards(dashboard_id, dataset_id, title, spec_json)
// ─────────────────────────────────────────────────────────────────────────────

const express    = require('express');
const cors       = require('cors');
const catalyst   = require('zcatalyst-sdk-node');
const XLSX       = require('xlsx');
const nodemailer = require('nodemailer');

// ── Email (Nodemailer over Gmail SMTP) ────────────────────────────────────────
// Catalyst Mail requires DNS domain verification (blocks gmail.com), so demo
// notifications go out via Gmail SMTP with an App Password — the same approach
// the MG app uses. Set these via env vars (GMAIL_USER / GMAIL_APP_PASSWORD).
const GMAIL_USER = process.env.GMAIL_USER || 'nagendrayesuri3@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || 'iwjrdkneokmqupvh'; // Google App Password (spaces removed)
const DEMO_RECIPIENTS = ['pratik@fristinetech.com', 'shreyash@fristinetech.com', 'lok@fristinetech.com', 'nagendrayesuri3@gmail.com'];
const mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});
let pdfParse;
try { pdfParse = require('pdf-parse'); } catch (_) { pdfParse = null; }
const { getDemos } = require('./demos');

const app = express();
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));
app.use(cors());

// Catalyst Text columns hold max 10,000 chars, so every stored string must stay
// under that. We pack table rows into <9KB JSON batches and chunk big blobs
// (schema/spec) the same way, reassembling on read.
const COL_MAX = 9000;                // safe cap below the 10,000-char column limit
const BATCH_BYTES = 8000;            // JSON size per dataset_rows.data record (leaves array overhead room)
const INSERT_CHUNK = 100;            // bulk insertRows per call (Catalyst max 200)
const MAX_ROWS_PER_TABLE = 20000;    // cap to keep ingest + read within limits
const ZCQL_PAGE = 200;               // ZCQL returns ≤300 rows/query → paginate

// ── Agent service client ─────────────────────────────────────────────────────
async function callAgent(path, body) {
    const base   = process.env.AGENT_SERVICE_URL || 'http://localhost:8080';
    const secret = process.env.AGENT_SECRET || '';
    const res = await fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ODD-Secret': secret },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`agent ${path} ${res.status}: ${text.slice(0, 300)}`);
    try { return JSON.parse(text); } catch (_) { return {}; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const genId = (prefix) =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const esc = (v) => String(v).replace(/'/g, "''");

// ZCQL rows come back keyed by table name; normalise to the inner object.
const rowOf = (r, table) =>
    r[table] || r[table.toUpperCase()] || r[table.toLowerCase()] || Object.values(r)[0] || {};

// ZCQL returns ≤300 rows per query — page through with LIMIT offset,count.
async function zcqlAll(zcql, baseQuery) {
    const out = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const page = await zcql.executeZCQLQuery(`${baseQuery} LIMIT ${offset}, ${ZCQL_PAGE}`);
        if (!page || !page.length) break;
        out.push(...page);
        if (page.length < ZCQL_PAGE) break;
        offset += ZCQL_PAGE;
    }
    return out;
}

const splitChunks = (str, size = COL_MAX) => {
    const parts = [];
    for (let i = 0; i < str.length; i += size) parts.push(str.slice(i, i + size));
    return parts.length ? parts : [''];
};

// Store a big string as ordered chunk records in dataset_rows under a reserved
// table_name marker (e.g. "__spec__"); reassembled by readBlob.
async function writeBlob(app0, datasetId, marker, str) {
    const ds = app0.datastore();
    const zcql = app0.zcql();
    const existing = await zcqlAll(zcql,
        `SELECT ROWID FROM dataset_rows WHERE dataset_id = '${esc(datasetId)}' AND table_name = '${esc(marker)}'`);
    for (const r of existing) {
        const row = rowOf(r, 'dataset_rows');
        if (row.ROWID) { try { await ds.table('dataset_rows').deleteRow(row.ROWID); } catch (_) {} }
    }
    const chunks = splitChunks(str).map((data, i) => ({
        dataset_id: datasetId, table_name: marker, batch_index: i, data,
    }));
    for (let i = 0; i < chunks.length; i += INSERT_CHUNK) {
        await ds.table('dataset_rows').insertRows(chunks.slice(i, i + INSERT_CHUNK));
    }
}

async function readBlob(app0, datasetId, marker) {
    const rows = await zcqlAll(app0.zcql(),
        `SELECT data, batch_index FROM dataset_rows WHERE dataset_id = '${esc(datasetId)}' AND table_name = '${esc(marker)}' ORDER BY batch_index`);
    return rows.map((r) => rowOf(r, 'dataset_rows').data || '').join('');
}

// ── File parsing → tables [{ name, rows:[obj] }] ─────────────────────────────
function jsonToTables(parsed) {
    const tables = [];
    if (Array.isArray(parsed)) {
        const rows = parsed.map((v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : { value: v }));
        tables.push({ name: 'data', rows });
        return tables;
    }
    if (parsed && typeof parsed === 'object') {
        const scalars = {};
        let nested = false;
        for (const [key, val] of Object.entries(parsed)) {
            if (Array.isArray(val) && val.length && typeof val[0] === 'object') {
                tables.push({ name: key, rows: val });
                nested = true;
            } else {
                scalars[key] = val;
            }
        }
        if (!nested) return [{ name: 'data', rows: [parsed] }];
        if (Object.keys(scalars).length) tables.push({ name: 'summary', rows: [scalars] });
        return tables;
    }
    return [{ name: 'data', rows: [{ value: parsed }] }];
}

// ── Smart spreadsheet parsing ────────────────────────────────────────────────
const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
const isBlank = (v) => v === null || v === undefined || v === '';

function dateLabel(v) {
    // Returns a clean label string if `v` looks like a month/date header, else null.
    if (v instanceof Date && !isNaN(v)) {
        return v.toLocaleString('en-US', { month: 'short', year: '2-digit' }); // e.g. Jan 25
    }
    const s = String(v).trim();
    if (new RegExp(`^(${MONTHS})[ \\-/]?\\d{2,4}$`, 'i').test(s)) return s;       // Jan-25
    if (/^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$/.test(s)) return s;                      // 2025-01
    if (/^\d{1,2}[-/]\d{4}$/.test(s)) return s;                                    // 01/2025
    return null;
}

const cleanHeader = (v, i) => {
    if (isBlank(v)) return `Column ${i + 1}`;
    if (v instanceof Date) return dateLabel(v) || v.toISOString().slice(0, 10);
    return String(v).replace(/\s+/g, ' ').trim();
};

// Pick the most header-like row in the first dozen rows of a sheet.
function detectHeaderRow(aoa) {
    const limit = Math.min(aoa.length, 12);
    let bestRow = 0, bestScore = -Infinity;
    for (let i = 0; i < limit; i++) {
        const row = aoa[i] || [];
        const nonEmpty = row.filter((c) => !isBlank(c));
        if (nonEmpty.length < 2) continue;
        const textCells = nonEmpty.filter((c) => typeof c === 'string' && isNaN(Number(c))).length;
        const uniq = new Set(nonEmpty.map((c) => String(c).trim().toLowerCase())).size;
        const next = aoa[i + 1] || [];
        const nextFilled = next.filter((c) => !isBlank(c)).length;
        // Headers: wide, mostly text, unique, followed by a data row, near the top.
        const score = nonEmpty.length + textCells * 1.5 + uniq + (nextFilled >= 2 ? 3 : 0) - i * 0.75;
        if (score > bestScore) { bestScore = score; bestRow = i; }
    }
    return bestRow;
}

function sheetToTable(sheetName, ws) {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });
    if (!aoa.length) return null;

    const h = detectHeaderRow(aoa);
    const rawHeader = aoa[h] || [];
    const headers = rawHeader.map(cleanHeader);

    // De-duplicate header names.
    const seen = {};
    const finalHeaders = headers.map((name) => {
        if (seen[name] === undefined) { seen[name] = 0; return name; }
        seen[name] += 1; return `${name} (${seen[name]})`;
    });

    // Build row objects from rows after the header.
    let rows = [];
    for (let r = h + 1; r < aoa.length; r++) {
        const arr = aoa[r] || [];
        if (arr.every(isBlank)) continue;
        const obj = {};
        finalHeaders.forEach((name, c) => { obj[name] = arr[c] === undefined ? null : arr[c]; });
        rows.push(obj);
    }
    if (!rows.length) return null;

    // Drop columns that are entirely empty.
    const keep = finalHeaders.filter((name) => rows.some((row) => !isBlank(row[name])));
    if (keep.length !== finalHeaders.length) {
        rows = rows.map((row) => { const o = {}; keep.forEach((k) => { o[k] = row[k]; }); return o; });
    }

    // Auto-unpivot a wide month/date layout into long form (period + value).
    const dateCols = keep.filter((k) => dateLabel(k));
    const idCols = keep.filter((k) => !dateLabel(k));
    if (dateCols.length >= 3 && idCols.length >= 1) {
        const long = [];
        for (const row of rows) {
            for (const dc of dateCols) {
                if (isBlank(row[dc])) continue;
                const rec = {};
                idCols.forEach((c) => { rec[c] = row[c]; });
                rec.period = dateLabel(dc) || dc;
                rec.value = row[dc];
                long.push(rec);
            }
        }
        if (long.length) rows = long;
    }

    return { name: sheetName || 'Sheet', rows };
}

async function parseAnyFile(buffer, fileName, mime) {
    const lower = (fileName || '').toLowerCase();
    const ext = lower.includes('.') ? lower.split('.').pop() : '';
    const isJson = ext === 'json' || /json/.test(mime || '');
    const isPdf  = ext === 'pdf'  || /pdf/.test(mime || '');

    if (isJson) {
        const parsed = JSON.parse(buffer.toString('utf8'));
        return { tables: jsonToTables(parsed), rawText: '' };
    }
    if (isPdf) {
        if (!pdfParse) throw new Error('PDF parsing is unavailable on the server');
        const data = await pdfParse(buffer);
        return { tables: [], rawText: data.text || '' };
    }
    // xlsx / xls / csv / tsv — smart header detection + cleaning + unpivot per sheet.
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const tables = [];
    for (const sheetName of wb.SheetNames) {
        const t = sheetToTable(sheetName, wb.Sheets[sheetName]);
        if (t) tables.push(t);
    }
    if (!tables.length) throw new Error('No rows found in the file');
    return { tables, rawText: '' };
}

// ── Profiling → schema with per-column types + stats ─────────────────────────
const looksDate = (v) =>
    v instanceof Date ||
    (typeof v === 'string' && /^\d{4}-\d{1,2}(-\d{1,2})?/.test(v)) ||
    (typeof v === 'string' && !isNaN(Date.parse(v)) && /[-/:]/.test(v) && isNaN(Number(v)));

function inferType(values) {
    let n = 0, num = 0, bool = 0, date = 0;
    for (const v of values) {
        if (v === null || v === undefined || v === '') continue;
        n++;
        if (typeof v === 'boolean') bool++;
        else if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))) num++;
        else if (looksDate(v)) date++;
    }
    if (!n) return 'string';
    if (num / n > 0.8) return 'number';
    if (date / n > 0.8) return 'date';
    if (bool / n > 0.8) return 'boolean';
    return 'string';
}

function profileTables(tables) {
    return {
        tables: tables.map((t) => {
            const rows = t.rows || [];
            const colNames = [];
            const seen = new Set();
            for (const row of rows.slice(0, 200)) {
                for (const k of Object.keys(row || {})) {
                    if (!seen.has(k)) { seen.add(k); colNames.push(k); }
                }
            }
            const sampleN = Math.min(rows.length, 300) || 1;
            const columns = colNames
                .filter((name) => !/^__EMPTY/i.test(name)) // drop spreadsheet artifacts defensively
                .map((name) => {
                    const values = rows.slice(0, 300).map((r) => (r ? r[name] : null));
                    const type = inferType(values);
                    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
                    const distinct = new Set(nonNull.map((v) => String(v)));
                    const col = {
                        name, type, distinct: distinct.size,
                        fill: Math.round((nonNull.length / sampleN) * 100), // % non-empty
                        samples: [...distinct].slice(0, 6),
                    };
                    if (type === 'number') {
                        const nums = nonNull.map(Number).filter((x) => !isNaN(x));
                        if (nums.length) { col.min = Math.min(...nums); col.max = Math.max(...nums); }
                    }
                    return col;
                });
            return { name: t.name, rowCount: rows.length, columns };
        }),
    };
}

// ── Data Store writes (datastore API avoids SQL-escaping big JSON) ────────────
function batchRows(rows) {
    const batches = [];
    let cur = [], size = 0;
    for (const row of rows) {
        const s = JSON.stringify(row).length;
        if (size + s > BATCH_BYTES && cur.length) { batches.push(cur); cur = []; size = 0; }
        cur.push(row); size += s;
    }
    if (cur.length) batches.push(cur);
    return batches;
}

async function storeDatasetMeta(app0, { datasetId, name, sourceType, sourceMeta, schemaJson, rowCount }) {
    await app0.datastore().table('datasets').insertRow({
        dataset_id:  datasetId,
        name:        name || 'Dataset',
        source_type: sourceType,
        source_meta: JSON.stringify(sourceMeta || {}).slice(0, COL_MAX),
        // Fits in the column → keep it inline; otherwise '' and read from __schema__ blob.
        schema_json: schemaJson.length <= COL_MAX ? schemaJson : '',
        row_count:   rowCount,
    });
}

// Store all rows as batched records — using bulk insertRows (chunked) so a
// large file is a handful of calls instead of hundreds of sequential ones.
async function storeDatasetRows(app0, { datasetId, tables }) {
    const rowsTable = app0.datastore().table('dataset_rows');
    const records = [];
    let batchIndex = 0;
    for (const t of tables) {
        for (const batch of batchRows(t.rows || [])) {
            records.push({
                dataset_id:  datasetId,
                table_name:  t.name,
                batch_index: batchIndex++,
                data:        JSON.stringify(batch),
            });
        }
    }
    for (let i = 0; i < records.length; i += INSERT_CHUNK) {
        await rowsTable.insertRows(records.slice(i, i + INSERT_CHUNK));
    }
}

// Insert or update a dashboard row (+ spec blob if the spec is too big for the column).
async function upsertDashboard(app0, { dashboardId, datasetId, spec }) {
    const ds = app0.datastore();
    const specJson = JSON.stringify(spec);
    const fits = specJson.length <= COL_MAX;
    const fields = {
        title:     (spec.title || 'Dashboard').slice(0, COL_MAX),
        spec_json: fits ? specJson : '',
    };
    const existing = await app0.zcql().executeZCQLQuery(
        `SELECT ROWID FROM dashboards WHERE dashboard_id = '${esc(dashboardId)}' LIMIT 1`
    );
    if (existing && existing.length) {
        await ds.table('dashboards').updateRow({ ROWID: rowOf(existing[0], 'dashboards').ROWID, ...fields });
    } else {
        await ds.table('dashboards').insertRow({ dashboard_id: dashboardId, dataset_id: datasetId, ...fields });
    }
    if (!fits) await writeBlob(app0, datasetId, '__spec__', specJson);
    else await writeBlob(app0, datasetId, '__spec__', ''); // clear any stale chunks
}

// ASYNC build (step A): parse → store dataset + rows + schema, create a "building"
// placeholder dashboard, then hand the slow AI work to the agent service's
// /architect-async, which calls /build-callback when done. Returns immediately.
async function startBuild(app0, { name, sourceType, sourceMeta, tables, description, callbackUrl }) {
    let truncated = false;
    for (const t of tables) {
        if (t.rows && t.rows.length > MAX_ROWS_PER_TABLE) {
            t.rows = t.rows.slice(0, MAX_ROWS_PER_TABLE);
            truncated = true;
        }
    }

    const profile = profileTables(tables);
    const schemaJson = JSON.stringify(profile);
    const rowCount = tables.reduce((s, t) => s + (t.rows ? t.rows.length : 0), 0);
    const sampleRows = [];
    for (const t of tables) {
        for (const r of (t.rows || []).slice(0, 8)) sampleRows.push({ _table: t.name, ...r });
    }

    const datasetId = genId('DS');
    await storeDatasetMeta(app0, { datasetId, name, sourceType, sourceMeta, schemaJson, rowCount });

    // Store rows + schema blob (the fast part) before responding.
    const storeTasks = [storeDatasetRows(app0, { datasetId, tables })];
    if (schemaJson.length > COL_MAX) storeTasks.push(writeBlob(app0, datasetId, '__schema__', schemaJson));
    await Promise.all(storeTasks);

    // Placeholder dashboard the UI can navigate to and poll.
    await upsertDashboard(app0, {
        dashboardId: datasetId, datasetId,
        spec: { title: name || 'Dashboard', datasetId, building: true, pages: [] },
    });

    // Kick off the slow AI build in the background (returns ~instantly).
    await callAgent('/architect-async', { profile, sampleRows, description: description || '', callbackUrl, datasetId });

    return { datasetId, dashboardId: datasetId, title: name || 'Dashboard', status: 'building', rowCount, truncated };
}

const callbackUrlFrom = (req) => {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `https://${host}/server/api/build-callback`;
};

// Parse one uploaded file descriptor into tables (PDF → agent extraction).
async function parseUpload(file) {
    const buffer = Buffer.from(file.fileData, 'base64');
    let { tables, rawText } = await parseAnyFile(buffer, file.fileName, file.mime);
    if ((!tables || !tables.length) && rawText) {
        const out = await callAgent('/extract', { rawText, name: file.fileName || 'document' });
        tables = out.tables || [];
    }
    return tables || [];
}

// Merge tables from several files, namespacing names on collision so the agent can tell
// "Sheet1 from sales.csv" apart from "Sheet1 from targets.csv".
function mergeTables(perFile) {
    const used = new Set();
    const out = [];
    for (const { fileName, tables } of perFile) {
        const base = (fileName || 'file').replace(/\.[^.]+$/, '');
        for (const t of tables) {
            let nm = t.name;
            if (perFile.length > 1) nm = `${base} · ${t.name}`;
            while (used.has(nm)) nm = `${nm}_2`;
            used.add(nm);
            out.push({ name: nm, rows: t.rows });
        }
    }
    return out;
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ ok: true, service: 'odd-api' }));

// POST /ingest — upload one or more files (+ optional description) → dashboard(s)
app.post('/ingest', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const { description } = req.body;
        // Accept the new multi-file shape, or fall back to the legacy single-file fields.
        let files = req.body.files;
        if (!files && req.body.fileData) {
            files = [{ fileName: req.body.fileName, mime: req.body.mime, fileData: req.body.fileData }];
        }
        if (!files || !files.length) return res.status(400).json({ error: 'No file data received' });

        const perFile = [];
        for (const f of files) {
            if (!f.fileData) continue;
            const tables = await parseUpload(f);
            if (tables.length) perFile.push({ fileName: f.fileName, tables });
        }
        const tables = mergeTables(perFile);
        if (!tables.length) return res.status(422).json({ error: 'Could not extract any data from the uploaded file(s)' });

        const name = files.length === 1 ? (files[0].fileName || 'Uploaded data') : `${files.length} files`;
        const result = await startBuild(app0, {
            name,
            sourceType: 'file',
            sourceMeta: { files: files.map((f) => f.fileName), description: description || '' },
            tables,
            description,
            callbackUrl: callbackUrlFrom(req),
        });
        return res.json(result);
    } catch (err) {
        console.error('POST /ingest:', err);
        return res.status(500).json({ error: err.message });
    }
});

// POST /mcp/connect — list tools the MCP server exposes
app.post('/mcp/connect', async (req, res) => {
    try {
        const { mcpUrl, token } = req.body;
        if (!mcpUrl) return res.status(400).json({ error: 'mcpUrl is required' });
        const out = await callAgent('/mcp/connect', { mcpUrl, token: token || '' });
        return res.json(out);
    } catch (err) {
        console.error('POST /mcp/connect:', err);
        return res.status(502).json({ error: err.message });
    }
});

// POST /mcp/ingest — pull data from MCP → dashboard
app.post('/mcp/ingest', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const { mcpUrl, token, request, name, description } = req.body;
        if (!mcpUrl) return res.status(400).json({ error: 'mcpUrl is required' });

        const out = await callAgent('/mcp/ingest', { mcpUrl, token: token || '', request: request || '' });
        const tables = out.tables || [];
        if (!tables.length) return res.status(422).json({ error: 'No data returned from the MCP source' });

        const result = await startBuild(app0, {
            name: name || 'MCP source',
            sourceType: 'mcp',
            sourceMeta: { mcpUrl },
            tables,
            description: description || request || '',
            callbackUrl: callbackUrlFrom(req),
        });
        return res.json(result);
    } catch (err) {
        console.error('POST /mcp/ingest:', err);
        return res.status(500).json({ error: err.message });
    }
});

const safeParse = (s, fallback) => { try { return JSON.parse(s); } catch (_) { return fallback; } };

// GET /dataset?id= — dataset meta + schema
app.get('/dataset', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const rows = await app0.zcql().executeZCQLQuery(
            `SELECT dataset_id, name, source_type, schema_json, row_count FROM datasets WHERE dataset_id = '${esc(id)}' LIMIT 1`
        );
        if (!rows || !rows.length) return res.status(404).json({ error: 'Dataset not found' });
        const r = rowOf(rows[0], 'datasets');
        let schema = safeParse(r.schema_json, null);
        if (schema === null) schema = safeParse(await readBlob(app0, id, '__schema__'), {});
        return res.json({
            datasetId: r.dataset_id, name: r.name, sourceType: r.source_type,
            rowCount: r.row_count, schema,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /dataset-rows?id= — all data rows grouped by source table (reserved __markers__ excluded)
app.get('/dataset-rows', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const rows = await zcqlAll(app0.zcql(),
            `SELECT table_name, batch_index, data FROM dataset_rows WHERE dataset_id = '${esc(id)}' ORDER BY batch_index`);
        const tables = {};
        for (const raw of rows) {
            const r = rowOf(raw, 'dataset_rows');
            if (!r.table_name || r.table_name.startsWith('__')) continue; // skip blob chunks
            const arr = safeParse(r.data, []);
            (tables[r.table_name] = tables[r.table_name] || []).push(...arr);
        }
        return res.json({ tables: Object.entries(tables).map(([name, data]) => ({ name, rows: data })) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /dashboard?id= — the dashboard spec
app.get('/dashboard', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const rows = await app0.zcql().executeZCQLQuery(
            `SELECT dashboard_id, dataset_id, title, spec_json FROM dashboards WHERE dashboard_id = '${esc(id)}' LIMIT 1`
        );
        if (!rows || !rows.length) return res.status(404).json({ error: 'Dashboard not found' });
        const r = rowOf(rows[0], 'dashboards');
        let spec = safeParse(r.spec_json, null);
        if (spec === null) spec = safeParse(await readBlob(app0, r.dataset_id || id, '__spec__'), {});
        return res.json({ dashboardId: r.dashboard_id, datasetId: r.dataset_id, title: r.title, spec });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /dashboard — upsert an edited spec
app.post('/dashboard', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const { id, spec } = req.body;
        if (!id || !spec) return res.status(400).json({ error: 'id and spec are required' });
        const ds = app0.datastore();
        const existing = await app0.zcql().executeZCQLQuery(
            `SELECT ROWID, dataset_id FROM dashboards WHERE dashboard_id = '${esc(id)}' LIMIT 1`
        );
        const specJson = JSON.stringify(spec);
        const fits = specJson.length <= COL_MAX;
        const datasetId = (existing && existing.length && rowOf(existing[0], 'dashboards').dataset_id) || spec.datasetId || id;
        if (existing && existing.length) {
            const r = rowOf(existing[0], 'dashboards');
            await ds.table('dashboards').updateRow({
                ROWID: r.ROWID, title: (spec.title || 'Dashboard').slice(0, COL_MAX), spec_json: fits ? specJson : '',
            });
        } else {
            await ds.table('dashboards').insertRow({
                dashboard_id: id, dataset_id: datasetId, title: (spec.title || 'Dashboard').slice(0, COL_MAX), spec_json: fits ? specJson : '',
            });
        }
        if (!fits) await writeBlob(app0, datasetId, '__spec__', specJson);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /list-dashboards — recent dashboards for the home page
app.get('/list-dashboards', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const rows = await app0.zcql().executeZCQLQuery(
            'SELECT dashboard_id, title, CREATEDTIME FROM dashboards ORDER BY CREATEDTIME DESC LIMIT 50'
        );
        const list = (rows || [])
            .map((raw) => rowOf(raw, 'dashboards'))
            .filter((r) => !String(r.dashboard_id || '').startsWith('demo_')) // hide seeded demos
            .map((r) => ({ dashboardId: r.dashboard_id, title: r.title, createdTime: r.CREATEDTIME }));
        return res.json({ dashboards: list });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /ask — embedded assistant (proxies to the ADK service with context)
app.post('/ask', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const { dashboardId, question, spec, history } = req.body;
        if (!question) return res.status(400).json({ error: 'No question provided' });

        // Inline-data mode (e.g. the landing-page in-code demos): caller passes the
        // summary/profile directly, so we skip the Data Store and proxy straight to the agent.
        if (req.body.summary || req.body.profile) {
            const out = await callAgent('/ask', {
                profile: req.body.profile || {}, plan: req.body.plan || {}, summary: req.body.summary || '',
                spec: spec || {}, question, history: history || [],
            });
            return res.json({ reply: out.reply || '', actions: out.actions || [] });
        }

        // Load dataset profile + plan + a sample of rows for grounding.
        let profile = {}, summary = '', plan = {};
        // dashboardId may differ from datasetId for secondary dashboards; resolve the dataset.
        const reqId = dashboardId || (spec && spec.datasetId);
        let dashId = reqId;
        if (reqId) {
            const dRow = await app0.zcql().executeZCQLQuery(
                `SELECT dataset_id FROM dashboards WHERE dashboard_id = '${esc(reqId)}' LIMIT 1`
            );
            if (dRow && dRow.length) dashId = rowOf(dRow[0], 'dashboards').dataset_id || reqId;
        }
        if (dashId) {
            const dsRows = await app0.zcql().executeZCQLQuery(
                `SELECT dataset_id, schema_json FROM datasets WHERE dataset_id = '${esc(dashId)}' LIMIT 1`
            );
            if (dsRows && dsRows.length) {
                const r = rowOf(dsRows[0], 'datasets');
                profile = safeParse(r.schema_json, null);
                if (profile === null) profile = safeParse(await readBlob(app0, dashId, '__schema__'), {});
            }
            plan = safeParse(await readBlob(app0, dashId, '__plan__'), {});
            const sample = await app0.zcql().executeZCQLQuery(
                `SELECT table_name, data FROM dataset_rows WHERE dataset_id = '${esc(dashId)}' ORDER BY batch_index LIMIT 6`
            );
            const parts = [];
            for (const raw of (sample || [])) {
                const r = rowOf(raw, 'dataset_rows');
                if (!r.table_name || r.table_name.startsWith('__')) continue;
                const arr = safeParse(r.data, []).slice(0, 10);
                parts.push(`Table ${r.table_name} sample:\n${JSON.stringify(arr)}`);
            }
            summary = parts.join('\n\n').slice(0, 14000);
        }

        const out = await callAgent('/ask', {
            profile, plan, summary, spec: spec || {}, question, history: history || [],
        });
        return res.json({ reply: out.reply || '', actions: out.actions || [] });
    } catch (err) {
        console.error('POST /ask:', err);
        return res.status(500).json({ error: err.message });
    }
});

// POST /build-callback — the agent service posts the finished build here.
app.post('/build-callback', async (req, res) => {
    try {
        if ((req.headers['x-odd-secret'] || '') !== (process.env.AGENT_SECRET || '')) {
            return res.status(401).json({ error: 'bad secret' });
        }
        const app0 = catalyst.initialize(req);
        const { datasetId, plan, dashboards, error } = req.body;
        if (!datasetId) return res.status(400).json({ error: 'datasetId required' });

        // Look up the dataset's display name for fallbacks.
        const dsRow = await app0.zcql().executeZCQLQuery(
            `SELECT name FROM datasets WHERE dataset_id = '${esc(datasetId)}' LIMIT 1`
        );
        const dsName = (dsRow && dsRow.length && rowOf(dsRow[0], 'datasets').name) || 'Dashboard';

        if (error || !dashboards || !dashboards.length) {
            await upsertDashboard(app0, {
                dashboardId: datasetId, datasetId,
                spec: { title: dsName, datasetId, error: error || 'The agent could not build a dashboard.', pages: [] },
            });
            return res.json({ ok: true });
        }

        await writeBlob(app0, datasetId, '__plan__', JSON.stringify(plan || {}));

        for (let i = 0; i < dashboards.length; i++) {
            const spec = dashboards[i].spec || { title: dashboards[i].title || dsName, pages: [] };
            spec.datasetId = datasetId;
            if (!spec.title) spec.title = dashboards[i].title || dsName;
            delete spec.building;
            const dashboardId = i === 0 ? datasetId : genId('DB');
            await upsertDashboard(app0, { dashboardId, datasetId, spec });
        }
        return res.json({ ok: true });
    } catch (err) {
        console.error('POST /build-callback:', err);
        return res.status(500).json({ error: err.message });
    }
});

// POST /delete-dashboard — remove a dashboard and (if no longer referenced) its dataset.
app.post('/delete-dashboard', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const ds = app0.datastore();
        const zcql = app0.zcql();
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'id required' });

        const dashRows = await zcql.executeZCQLQuery(
            `SELECT ROWID, dataset_id FROM dashboards WHERE dashboard_id = '${esc(id)}' LIMIT 1`
        );
        if (!dashRows || !dashRows.length) return res.json({ ok: true }); // already gone
        const dash = rowOf(dashRows[0], 'dashboards');
        const datasetId = dash.dataset_id;
        await ds.table('dashboards').deleteRow(dash.ROWID);

        // If no other dashboard uses this dataset, delete the dataset + all its rows/blobs.
        const others = await zcql.executeZCQLQuery(
            `SELECT ROWID FROM dashboards WHERE dataset_id = '${esc(datasetId)}' LIMIT 1`
        );
        if (!others || !others.length) {
            const rowRecs = await zcqlAll(zcql,
                `SELECT ROWID FROM dataset_rows WHERE dataset_id = '${esc(datasetId)}'`);
            const ids = rowRecs.map((r) => rowOf(r, 'dataset_rows').ROWID).filter(Boolean);
            for (let i = 0; i < ids.length; i += INSERT_CHUNK) {
                try { await ds.table('dataset_rows').deleteRows(ids.slice(i, i + INSERT_CHUNK)); } catch (_) {}
            }
            const dsRecs = await zcql.executeZCQLQuery(
                `SELECT ROWID FROM datasets WHERE dataset_id = '${esc(datasetId)}' LIMIT 1`
            );
            if (dsRecs && dsRecs.length) {
                try { await ds.table('datasets').deleteRow(rowOf(dsRecs[0], 'datasets').ROWID); } catch (_) {}
            }
        }
        return res.json({ ok: true });
    } catch (err) {
        console.error('POST /delete-dashboard:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Remove a dataset + its rows/blobs + dashboard row entirely.
async function wipeDataset(app0, datasetId) {
    const ds = app0.datastore();
    const zcql = app0.zcql();
    const rowRecs = await zcqlAll(zcql, `SELECT ROWID FROM dataset_rows WHERE dataset_id = '${esc(datasetId)}'`);
    const ids = rowRecs.map((r) => rowOf(r, 'dataset_rows').ROWID).filter(Boolean);
    for (let i = 0; i < ids.length; i += INSERT_CHUNK) {
        try { await ds.table('dataset_rows').deleteRows(ids.slice(i, i + INSERT_CHUNK)); } catch (_) {}
    }
    for (const tbl of ['datasets', 'dashboards']) {
        const col = tbl === 'datasets' ? 'dataset_id' : 'dashboard_id';
        const recs = await zcql.executeZCQLQuery(`SELECT ROWID FROM ${tbl} WHERE ${col} = '${esc(datasetId)}' LIMIT 1`);
        if (recs && recs.length) { try { await ds.table(tbl).deleteRow(rowOf(recs[0], tbl).ROWID); } catch (_) {} }
    }
}

// POST /seed-demos — (re)create the curated per-industry demo dashboards. Run once
// after deploy. Protected by the shared secret (X-ODD-Secret == AGENT_SECRET).
app.post('/seed-demos', async (req, res) => {
    try {
        if ((process.env.AGENT_SECRET || '') && (req.headers['x-odd-secret'] || '') !== (process.env.AGENT_SECRET || '')) {
            return res.status(401).json({ error: 'bad secret' });
        }
        const app0 = catalyst.initialize(req);
        const seeded = [];
        for (const d of getDemos()) {
            const datasetId = `demo_${d.id}`;
            await wipeDataset(app0, datasetId);
            const profile = profileTables(d.tables);
            const schemaJson = JSON.stringify(profile);
            const rowCount = d.tables.reduce((s, t) => s + (t.rows ? t.rows.length : 0), 0);
            await storeDatasetMeta(app0, { datasetId, name: d.name, sourceType: 'demo', sourceMeta: { industry: d.id }, schemaJson, rowCount });
            await storeDatasetRows(app0, { datasetId, tables: d.tables });
            if (schemaJson.length > COL_MAX) await writeBlob(app0, datasetId, '__schema__', schemaJson);
            await upsertDashboard(app0, { dashboardId: datasetId, datasetId, spec: { ...d.spec, datasetId } });
            seeded.push(datasetId);
        }
        return res.json({ seeded });
    } catch (err) {
        console.error('POST /seed-demos:', err);
        return res.status(500).json({ error: err.message });
    }
});

// POST /request-demo — capture a "Request your own demo" submission.
// (Email to pratik@/shreyash@/lok@fristinetech.com to be wired with the MG method next.)
app.post('/request-demo', async (req, res) => {
    try {
        const app0 = catalyst.initialize(req);
        const { name, email, company, role, industry, message } = req.body || {};
        if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
        const row = {
            name: String(name).slice(0, 255),
            email: String(email).slice(0, 255),
            company: String(company || '').slice(0, 255),
            role: String(role || '').slice(0, 255),
            industry: String(industry || '').slice(0, 100),
            message: String(message || '').slice(0, 2000),
        };
        try {
            await app0.datastore().table('demo_requests').insertRow(row);
        } catch (e) {
            console.error('demo_requests insert failed (create the table):', e.message);
        }
        // Notify the team via Gmail SMTP (Nodemailer) — no domain verification needed.
        let mail = 'skipped';
        try {
            const esc = (s) => String(s == null || s === '' ? '—' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
            const html = `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:28px auto">
  <tr><td style="background:linear-gradient(135deg,#06b6d4,#2563eb,#7c3aed);padding:24px 28px;border-radius:12px 12px 0 0">
    <div style="font-size:11px;letter-spacing:2px;color:#e0f2fe;text-transform:uppercase">FI Digital · ODD</div>
    <div style="font-size:20px;font-weight:800;color:#fff;margin-top:4px">New Demo Request</div>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px">
    <table style="border-collapse:collapse;font-size:14px;line-height:1.7;color:#0f172a;width:100%">
      <tr><td style="padding:4px 14px 4px 0;color:#64748b;width:90px">Name</td><td><b>${esc(row.name)}</b></td></tr>
      <tr><td style="padding:4px 14px 4px 0;color:#64748b">Email</td><td>${esc(row.email)}</td></tr>
      <tr><td style="padding:4px 14px 4px 0;color:#64748b">Company</td><td>${esc(row.company)}</td></tr>
      <tr><td style="padding:4px 14px 4px 0;color:#64748b">Role</td><td>${esc(row.role)}</td></tr>
      <tr><td style="padding:4px 14px 4px 0;color:#64748b">Industry</td><td>${esc(row.industry)}</td></tr>
      <tr><td style="padding:4px 14px 4px 0;color:#64748b;vertical-align:top">Message</td><td>${esc(row.message)}</td></tr>
    </table>
    <p style="color:#94a3b8;font-size:12px;margin:18px 0 0">Sent from the ODD landing page · reply to reach the requester directly.</p>
  </td></tr>
</table></body></html>`;
            const text = `New ODD demo request\n\nName: ${row.name}\nEmail: ${row.email}\nCompany: ${row.company}\nRole: ${row.role}\nIndustry: ${row.industry}\nMessage: ${row.message}`;
            await mailer.sendMail({
                from: `"FI Digital · ODD" <${GMAIL_USER}>`,
                to: DEMO_RECIPIENTS.join(', '),
                replyTo: row.email,
                subject: `New ODD demo request — ${row.name}${row.company ? ' (' + row.company + ')' : ''}`,
                html,
                text,
            });
            mail = 'sent';
        } catch (e) {
            mail = 'error: ' + (e && e.message ? e.message : String(e));
            console.error('demo notify email failed:', e);
        }
        return res.json({ ok: true, mail });
    } catch (err) {
        console.error('POST /request-demo:', err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = app;
