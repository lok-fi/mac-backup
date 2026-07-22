
// const express = require('express');
// const catalyst = require('zcatalyst-sdk-node');
// const cors    = require('cors');
// const XLSX    = require('xlsx');

// const app = express();
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: true }));
// app.use(cors());

// // ──────────────────────────────────────────────
// // HELPERS
// // ──────────────────────────────────────────────
// const num = (v) => {
//     if (v === null || v === undefined || v === '#N/A' || v === '') return 0;
//     const n = Number(v);
//     return isNaN(n) ? 0 : n;
// };

// const yn = (v) => {
//     if (v === null || v === undefined || v === '#N/A') return 'N';
//     return String(v).trim().toUpperCase() === 'Y' ? 'Y' : 'N';
// };

// const clean = (v) => {
//     if (v === null || v === undefined || v === '#N/A') return '';
//     return String(v).trim();
// };

// const hasValue = (v) =>
//     v !== null && v !== undefined && v !== '#N/A' && v !== '' && v !== '0' && Number(v) !== 0;

// const findLatestMonthCol = (rows, step, startCol) => {
//     let lastDataCol = startCol;
//     for (let col = startCol; col < (rows[0] || []).length; col += step) {
//         const actualCol = col + 1;
//         const hasData = rows.slice(2).some(r => hasValue(r[actualCol]));
//         if (hasData) lastDataCol = col;
//     }
//     return lastDataCol;
// };

// const buildLookup = (rows, keyCol = 1) => {
//     const map = {};
//     for (let i = 2; i < rows.length; i++) {
//         const row = rows[i];
//         if (!row || !row[0]) continue;
//         const key = clean(row[keyCol]);
//         const nameKey = 'name:' + clean(row[0]).toLowerCase();
//         if (key && key !== '#N/A') map[key] = row;
//         if (nameKey !== 'name:') map[nameKey] = row;
//     }
//     return map;
// };

// const lookup = (map, code, name) => {
//     if (code && code !== '#N/A' && map[code]) return map[code];
//     return map['name:' + (name || '').toLowerCase()] || null;
// };

// const monthLabel = (rows, col) => {
//     const v = rows[0] && rows[0][col];
//     if (!v) return 'Latest';
//     try {
//         const d = new Date(v);
//         if (!isNaN(d)) return d.toLocaleString('en-AU', { month: 'short', year: '2-digit' });
//     } catch (_) {}
//     return String(v);
// };

// // ──────────────────────────────────────────────
// // DATA QUALITY CHECK
// // ──────────────────────────────────────────────
// //
// // Thresholds are set based on what a healthy real scorecard actually looks like.
// // Some sheets (CX, Google) naturally have lower coverage because NZ dealers and
// // A "WARN" status saves but flags the issue to the user.
// //
// const runQualityCheck = (dealers) => {
//     const total = dealers.length;
//     const counts = {
//         dealers:      total,
//         sales_actual: 0, sales_target: 0,
//         mkt_total:    0, parts_actual: 0, parts_target: 0,
//         ci:           0, doty_total:   0,
//         cx_score:     0, google_score: 0,
//     };
//     dealers.forEach(d => {
//         const m = d.monthly[0];
//         if (m.sales.actual > 0)                                     counts.sales_actual++;
//         if (m.sales.target > 0)                                     counts.sales_target++;
//         if (m.market.total > 0)                                     counts.mkt_total++;
//         if (m.parts.actual > 0)                                     counts.parts_actual++;
//         if (m.parts.target > 0)                                     counts.parts_target++;
//         if ((m.ci.status && m.ci.status !== 'No') || m.ci.pts > 0)  counts.ci++;
//         if (m.doty.total > 0)                                       counts.doty_total++;
//         if (m.service.score === 'Y' || m.service.response === 'Y')  counts.cx_score++;
//         if (m.google.score > 0)                                     counts.google_score++;
//     });
//     const summary = {};
//     for (const [field, count] of Object.entries(counts)) {
//         summary[field] = field === 'dealers'
//             ? count
//             : { count, total, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
//     }
//     return { summary };
// };


// // ──────────────────────────────────────────────
// // CORE PARSER
// // ──────────────────────────────────────────────
// const parseScorecard = (base64Data) => {
//     const buf = Buffer.from(base64Data, 'base64');
//     const wb  = XLSX.read(buf, { type: 'buffer', cellDates: true });

//     const sheetRows = (name) => {
//         const ws = wb.Sheets[name];
//         if (!ws) return [];
//         return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
//     };

//     const dealerListRows = sheetRows('DEALER LIST');
//     const salesRows      = sheetRows('SALES');
//     const mktRows        = sheetRows('MKT SHARE');
//     const stockRows      = sheetRows('STOCK');
//     const partsRows      = sheetRows('PARTS (2)');
//     const cxRows         = sheetRows('SERVICE CX');
//     const googleRows     = sheetRows('GOOGLE REVIEWS');
//     const ciRows         = sheetRows('CI');
//     const dotyRows       = sheetRows('DOTY');

//     const salesMap  = buildLookup(salesRows);
//     const mktMap    = buildLookup(mktRows);
//     const stockMap  = buildLookup(stockRows);
//     const partsMap  = buildLookup(partsRows);
//     const cxMap     = buildLookup(cxRows);
//     const googleMap = buildLookup(googleRows, 2);
//     const ciMap     = buildLookup(ciRows);
//     const dotyMap   = buildLookup(dotyRows);

//     const salesMonthCol = findLatestMonthCol(salesRows, 2, 2);
//     const mktMonthCol   = findLatestMonthCol(mktRows, 2, 2);
//     const partsMonthCol = findLatestMonthCol(partsRows, 2, 2);
//     const stockMonthCol = findLatestMonthCol(stockRows, 3, 2);
//     const cxMonthCol    = findLatestMonthCol(cxRows, 4, 2);

//     const dealers = [];

//     for (let i = 1; i < dealerListRows.length; i++) {
//         const dl = dealerListRows[i];
//         if (!dl || !dl[0]) continue;

//         const name   = clean(dl[0]);
//         const code   = clean(dl[1]);
//         const region = clean(dl[2]);
//         const pma    = clean(dl[3]);
//         if (!name) continue;

//         const sRow  = lookup(salesMap, code, name);
//         const mRow  = lookup(mktMap, code, name);
//         const stRow = lookup(stockMap, code, name);
//         const pRow  = lookup(partsMap, code, name);
//         const cxRow = lookup(cxMap, code, name);
//         const gRow  = lookup(googleMap, code, name);
//         const ciRow = lookup(ciMap, code, name);
//         const dRow  = lookup(dotyMap, code, name);

//         dealers.push({
//             dealer: { name, region, pma },
//             meta:   { recordId: code || String(i) },
//             monthly: [{
//                 month:   monthLabel(salesRows, salesMonthCol),
//                 sales:   { target: num(sRow?.[salesMonthCol]),     actual: num(sRow?.[salesMonthCol + 1]) },
//                 market:  { total:  num(mRow?.[mktMonthCol]),       mg:     num(mRow?.[mktMonthCol + 1]) },
//                 stock:   { ice:    num(stRow?.[stockMonthCol]),    hev:    num(stRow?.[stockMonthCol + 1]), bev: num(stRow?.[stockMonthCol + 2]) },
//                 parts:   { target: num(pRow?.[partsMonthCol]),     actual: num(pRow?.[partsMonthCol + 1]) },
//                 service: { response: yn(cxRow?.[cxMonthCol]), score: yn(cxRow?.[cxMonthCol + 1]), leadTime: yn(cxRow?.[cxMonthCol + 2]), training: yn(cxRow?.[cxMonthCol + 3]) },
//                 google:  { score: num(gRow?.[3]), responses: num(gRow?.[4]) },
//                 ci:      { status: clean(ciRow?.[2]) || 'No', pts: num(ciRow?.[3]) },
//                 doty:    { sales: num(dRow?.[3]), aftersales: num(dRow?.[4]), google: num(dRow?.[5]), ci: num(dRow?.[6]), total: num(dRow?.[7]) }
//             }]
//         });
//     }

//     return dealers;
// };


// // ──────────────────────────────────────────────
// // GET  /  — serve dealers from data store
// // ──────────────────────────────────────────────
// app.get('/', async (req, res) => {
//     try {
//         const catalystApp = catalyst.initialize(req);
//         const zcql = catalystApp.zcql();

//         if (!req.query?.id) return res.status(400).json({ error: 'Missing ID' });

//         const result = await zcql.executeZCQLQuery('SELECT * FROM dashboard_data');
//         let allDealers = [];

//         if (result && result.length > 0) {
//             result.forEach(r => {
//                 try {
//                     const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
//                     if (row && row.data) {
//                         const parsed = JSON.parse(row.data);
//                         if (Array.isArray(parsed)) allDealers = allDealers.concat(parsed);
//                     }
//                 } catch (e) { console.log('Skipping row:', e.message); }
//             });
//         }

//         return res.status(200).json(allDealers);
//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ error: err.message });
//     }
// });


// // ──────────────────────────────────────────────
// // POST  /process-scorecard  — parse, quality-check, store
// // ──────────────────────────────────────────────
// app.post('/process-scorecard', async (req, res) => {
//     try {
//         const catalystApp = catalyst.initialize(req);
//         const zcql = catalystApp.zcql();

//         const { fileData } = req.body;
//         if (!fileData) return res.status(400).json({ error: 'No file data received' });

//         // 1. Parse
//         console.log('Parsing Excel...');
//         const dealers = parseScorecard(fileData);
//         console.log(`Parsed ${dealers.length} dealers`);

//         // 2. Quality check — informational only, never blocks
//         const quality = runQualityCheck(dealers);
//         console.log('Quality summary:', JSON.stringify(quality.summary));

//         // 3. Save to data store
//         const base = 'SCORECARD_01';
//         await zcql.executeZCQLQuery(`DELETE FROM dashboard_data WHERE record_id LIKE '${base}%'`);

//         for (let i = 0; i < dealers.length; i += 5) {
//             const batch = dealers.slice(i, i + 5);
//             const esc   = JSON.stringify(batch).replace(/'/g, "''");
//             await zcql.executeZCQLQuery(
//                 `INSERT INTO dashboard_data (record_id, data) VALUES ('${base}_batch_${i}', '${esc}')`
//             );
//         }

//         // 4. Return result with quality report
//         return res.status(200).json({
//             message:     'Success',
//             dealerCount: dealers.length,
//             quality:     quality.summary
//         });

//     } catch (err) {
//         console.error('POST /process-scorecard error:', err);
//         return res.status(500).json({ error: err.message });
//     }
// });

// module.exports = app;


// // ──────────────────────────────────────────────
// // POST  /ask  — AI assistant (Gemini 2.0 Flash)
// // ──────────────────────────────────────────────
// app.post('/ask', async (req, res) => {
//     try {
//         const { question, dealers, currentState, history } = req.body;

//         if (!question) return res.status(400).json({ error: 'No question provided' });
//         if (!dealers || !dealers.length) return res.status(400).json({ error: 'No dealer data provided' });

//         const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
//         const summary = buildDataSummary(dealers);

//         const systemInstruction = `You are an AI assistant embedded inside the MG Motor Australia dealer network dashboard.
// You have full access to all dealer performance data and can control the dashboard filters and tabs.

// DASHBOARD STATE:
// - Current tab: ${currentState.tab}
// - Current region filter: ${currentState.region}
// - Current PMA filter: ${currentState.pma}
// - Current dealer filter: ${currentState.dealer}

// AVAILABLE TABS: overview | sales | aftersales | network | doty
// AVAILABLE REGIONS: All Regions | Eastern Region | Southern Region | Northern Region | Central Region | Western Region | North Island NZ | South Island NZ
// AVAILABLE PMAS: All PMA | Metro A | Metro B | Provincial | Rural | NZ Metro | NZ Provincial | NZ Rural

// ${summary}

// RESPONSE FORMAT — always respond with ONLY valid JSON, no markdown fences:
// {
//   "reply": "Your answer with specific numbers and insights",
//   "actions": [
//     { "type": "setRegion", "value": "Eastern Region" },
//     { "type": "setPma",    "value": "Metro A" },
//     { "type": "setDealer", "value": "Alto Blacktown MG" },
//     { "type": "setTab",    "value": "sales" }
//   ]
// }

// RULES:
// - "reply" is always required. Be specific — use real numbers, dealer names, rankings from the data.
// - "actions" is optional. Only add actions the user actually asked for (filter/tab changes).
// - Reset a filter by using "All Regions", "All PMA", or "All Dealers".
// - If asked about a dealer → setDealer to that exact name + go to the relevant tab.
// - If asked about a region → setRegion to that region.
// - Tab routing: sales questions → "sales", aftersales/parts/CX → "aftersales", google/CI/network → "network", DOTY/rankings → "doty", general → "overview".
// - For month/history questions: the data contains the most recently uploaded month. Tell the user which month is loaded and answer from it.
// - Always include real numbers in your reply. Never say "I don't have access" — the full dataset is above.`;

//         // Build Gemini contents array.
//         // systemInstruction is only supported on v1beta; instead we prepend it
//         // as the first user/model exchange so it works on the stable v1 endpoint.
//         const contents = [
//             { role: 'user',  parts: [{ text: systemInstruction }] },
//             { role: 'model', parts: [{ text: 'Understood. I am ready to answer questions about the MG dealer network using the data provided.' }] },
//         ];

//         // Inject conversation history (alternating user/model turns)
//         if (history && history.length) {
//             history.forEach(msg => {
//                 contents.push({
//                     role: msg.role === 'user' ? 'user' : 'model',
//                     parts: [{ text: msg.text }]
//                 });
//             });
//         }

//         // Add the current question
//         contents.push({ role: 'user', parts: [{ text: question }] });

//         const geminiRes = await fetch(
//             `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
//             {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     contents,
//                     generationConfig: {
//                         temperature:     0.2,
//                         maxOutputTokens: 1024,
//                     }
//                 })
//             }
//         );

//         if (!geminiRes.ok) {
//             const errText = await geminiRes.text();
//             throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`);
//         }

//         const geminiData = await geminiRes.json();
//         const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

//         let parsed;
//         try {
//             const stripped = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
//             parsed = JSON.parse(stripped);
//         } catch (_) {
//             parsed = { reply: rawText, actions: [] };
//         }

//         return res.status(200).json({
//             reply:   parsed.reply   || 'I could not generate a response.',
//             actions: parsed.actions || []
//         });

//     } catch (err) {
//         console.error('POST /ask error:', err);
//         return res.status(500).json({ error: err.message });
//     }
// });

// // Build a compact, token-efficient summary of all dealer data for the AI.
// // The frontend sends the already-flattened masterList objects (d.name, d.salesActual, etc.)
// // so we normalise both shapes here.
// function buildDataSummary(dealers) {
//     const total = dealers.length;

//     // Normalise: handle both raw store shape {dealer:{name}, monthly:[...]}
//     // and the flattened frontend shape {name, region, salesActual, ...}
//     const norm = dealers.map(d => {
//         if (d.dealer) {
//             const m = d.monthly?.[0] || {};
//             return {
//                 name:        d.dealer.name,
//                 region:      d.dealer.region,
//                 pma:         d.dealer.pma,
//                 salesActual: m.sales?.actual     || 0,
//                 salesTarget: m.sales?.target     || 0,
//                 mktMG:       m.market?.mg        || 0,
//                 mktTotal:    m.market?.total     || 0,
//                 partsActual: m.parts?.actual     || 0,
//                 partsTarget: m.parts?.target     || 0,
//                 googleScore: m.google?.score     || 0,
//                 googleResp:  m.google?.responses || 0,
//                 dotyTotal:   m.doty?.total       || 0,
//                 ciStatus:    m.ci?.status        || 'No',
//                 cxR: m.service?.response || 'N',
//                 cxS: m.service?.score    || 'N',
//                 cxL: m.service?.leadTime || 'N',
//                 cxT: m.service?.training || 'N',
//             };
//         }
//         // Flattened frontend shape
//         return {
//             name:        d.name        || '',
//             region:      d.region      || '',
//             pma:         d.pma         || '',
//             salesActual: d.salesActual || 0,
//             salesTarget: d.salesTarget || 0,
//             mktMG:       d.mktMG       || 0,
//             mktTotal:    d.mktTotal    || 0,
//             partsActual: d.partsActual || 0,
//             partsTarget: d.partsTarget || 0,
//             googleScore: d.googleScore || 0,
//             googleResp:  d.googleResp  || 0,
//             dotyTotal:   d.dotyTotal   || 0,
//             ciStatus:    d.ciStatus    || 'No',
//             cxR: d.cxResponse ? 'Y' : 'N',
//             cxS: d.cxScore    ? 'Y' : 'N',
//             cxL: d.cxLeadTime ? 'Y' : 'N',
//             cxT: d.cxTraining ? 'Y' : 'N',
//         };
//     });

//     const rows = norm.map(d => [
//         d.name,
//         d.region,
//         d.pma,
//         `sales:${d.salesActual}/${d.salesTarget}`,
//         `mkt:${d.mktMG}/${d.mktTotal}`,
//         `parts:$${Math.round(d.partsActual/1000)}k/$${Math.round(d.partsTarget/1000)}k`,
//         `google:${d.googleScore}(${d.googleResp}rev)`,
//         `doty:${d.dotyTotal}pts`,
//         `ci:${d.ciStatus}`,
//         `cx:R${d.cxR}/S${d.cxS}/L${d.cxL}/T${d.cxT}`,
//     ].join(' | '));

//     const regions = {};
//     norm.forEach(d => {
//         const r = d.region || 'Unknown';
//         if (!regions[r]) regions[r] = { count: 0, salesA: 0, salesT: 0, partsA: 0, dotyTop: null };
//         regions[r].count++;
//         regions[r].salesA += d.salesActual;
//         regions[r].salesT += d.salesTarget;
//         regions[r].partsA += d.partsActual;
//         if (!regions[r].dotyTop || d.dotyTotal > regions[r].dotyTop.score) {
//             regions[r].dotyTop = { name: d.name, score: d.dotyTotal };
//         }
//     });

//     const regionSummary = Object.entries(regions).map(([r, v]) =>
//         `  ${r}: ${v.count} dealers | sales ${v.salesA}/${v.salesT} (${v.salesT ? Math.round(v.salesA/v.salesT*100) : 0}% ach) | parts $${Math.round(v.partsA/1000)}k | top DOTY: ${v.dotyTop?.name} (${v.dotyTop?.score}pts)`
//     ).join('\n');

//     const dataMonth = dealers[0]?.monthly?.[0]?.month || 'Latest';

//     return `DATA MONTH: ${dataMonth}
// TOTAL DEALERS: ${total}

// REGIONAL AGGREGATES:
// ${regionSummary}

// ALL DEALERS (name | region | pma | sales actual/target | mkt mg/total | parts $actual/$target | google score(reviews) | doty pts | ci status | cx R/S/L/T):
// ${rows.join('\n')}`;
// }

// ============================================================
// MG Motor AU — get-json function
// Parses the dealer scorecard Excel directly using xlsx.
// Includes a data-quality check before saving.
// ============================================================
// ============================================================
// MG Motor AU — get-json function
// Parses the dealer scorecard Excel directly using xlsx.
// Includes a data-quality check before saving.
// ============================================================

// ============================================================
// MG Motor AU — get-json function
// Parses the dealer scorecard Excel directly using xlsx.
// Includes a data-quality check before saving.
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express    = require('express');
const catalyst   = require('zcatalyst-sdk-node');
const cors       = require('cors');
const XLSX       = require('xlsx');
const nodemailer = require('nodemailer');
const multer     = require('multer');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Multer: store uploaded files in memory (buffer) — no disk I/O needed
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
const num = (v) => {
    if (v === null || v === undefined || v === '#N/A' || v === '') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

const yn = (v) => {
    if (v === null || v === undefined || v === '#N/A') return 'N';
    return String(v).trim().toUpperCase() === 'Y' ? 'Y' : 'N';
};

const clean = (v) => {
    if (v === null || v === undefined || v === '#N/A') return '';
    return String(v).trim();
};

const hasValue = (v) =>
    v !== null && v !== undefined && v !== '#N/A' && v !== '' && v !== '0' && Number(v) !== 0;

// Indian city → region mapping for WOHR
const CITY_REGION = {
    'mumbai': 'West', 'pune': 'West', 'nagpur': 'West', 'nashik': 'West',
    'lonavala': 'West', 'thane': 'West', 'navi mumbai': 'West', 'borivali': 'West',
    'ahmedabad': 'West', 'surat': 'West', 'vadodara': 'West', 'goa': 'West',
    'sangli': 'West', 'kolhapur': 'West', 'aurangabad': 'West', 'vasai': 'West',
    'delhi': 'North', 'new delhi': 'North', 'gurgaon': 'North', 'noida': 'North',
    'chandigarh': 'North', 'jaipur': 'North', 'lucknow': 'North', 'agra': 'North',
    'faridabad': 'North', 'ghaziabad': 'North', 'kanpur': 'North', 'dehradun': 'North',
    'amritsar': 'North', 'ludhiana': 'North',
    'chennai': 'South', 'hyderabad': 'South', 'bangalore': 'South', 'bengaluru': 'South',
    'coimbatore': 'South', 'kochi': 'South', 'kozhikode': 'South', 'vizag': 'South',
    'visakhapatnam': 'South', 'thiruvananthapuram': 'South', 'madurai': 'South',
    'mysore': 'South', 'mysuru': 'South', 'ernakulam': 'South', 'calicut': 'South',
    'kolkata': 'East', 'siliguri': 'East', 'bhubaneswar': 'East',
    'patna': 'East', 'ranchi': 'East', 'guwahati': 'East',
    'bhopal': 'Central', 'indore': 'Central', 'raipur': 'Central',
};

const deriveRegion = (city, typeOfBusiness) => {
    if (typeOfBusiness && typeOfBusiness.toLowerCase().includes('export')) return 'ASIA';
    const c = (city || '').toLowerCase().trim();
    for (const [key, region] of Object.entries(CITY_REGION)) {
        if (c.includes(key)) return region;
    }
    return '';
};

// INR amount formatter
const fmtINR = (n) => {
    if (!n) return '₹0';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000)   return `₹${(n / 100000).toFixed(0)}L`;
    return `₹${Math.round(n / 1000)}K`;
};

// ──────────────────────────────────────────────
// DATA QUALITY CHECK (WOHR)
// ──────────────────────────────────────────────
const runWOHRQualityCheck = (records) => {
    const total = records.length;
    const counts = {
        stage: 0, city: 0, region: 0,
        salesPerson: 0, accountName: 0,
        closedDate: 0, psNumber: 0,
    };
    records.forEach(r => {
        if (r.stage)                             counts.stage++;
        if (r.city)                              counts.city++;
        if (r.region && r.region !== 'Unknown')  counts.region++;
        if (r.salesPerson)                       counts.salesPerson++;
        if (r.accountName)                       counts.accountName++;
        if (r.closedWonDate || r.closedLostDate) counts.closedDate++;
        if (r.psNumber)                          counts.psNumber++;
    });
    const summary = { records: total };
    for (const [field, count] of Object.entries(counts)) {
        summary[field] = { count, total, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
    }
    return { summary };
};


// ──────────────────────────────────────────────
// CORE PARSER  (WOHR Zoho CRM export)
// Direct column-name mapping from actual export headers.
// ──────────────────────────────────────────────
const parseWOHRData = (base64Data) => {
    const buf = Buffer.from(base64Data, 'base64');
    const wb  = XLSX.read(buf, { type: 'buffer', cellDates: true });

    // Find the first sheet whose name matches any of the candidates (case-insensitive).
    // If none match, fall back to the first sheet in the workbook (handles direct single-sheet exports).
    const findSheet = (...names) => {
        for (const n of names) {
            const found = wb.SheetNames.find(s => s.toLowerCase() === n.toLowerCase());
            if (found) {
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[found], { header: 1, defval: null, raw: false });
                if (rows.length > 1) return rows;
            }
        }
        return [];
    };

    // Helper: read any sheet by name, or fall back to first sheet
    const readFirstSheet = () => {
        const sheetName = wb.SheetNames[0];
        if (!sheetName) return [];
        return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, raw: false });
    };

    // For Opportunities: try named sheets first, then fall back to the first sheet
    const _oppRows  = findSheet('OPPORTUNITIES', 'Opportunities', 'OPPORTUNITY', 'Opportunity');
    const oppRows   = _oppRows.length > 1 ? _oppRows : readFirstSheet();

    if (oppRows.length < 2) return [];

    // Build header-name → column-index map from first row (case-insensitive, trimmed)
    const hdr = {};
    (oppRows[0] || []).forEach((h, i) => {
        if (h) {
            const k = String(h).trim().toLowerCase();
            if (!(k in hdr)) hdr[k] = i;
        }
    });

    // Flexible getter — tries each key name variant in order
    const g = (row, ...keys) => {
        for (const k of keys) {
            const idx = hdr[k.toLowerCase()];
            if (idx !== undefined) {
                const v = row[idx];
                if (v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A') {
                    return String(v).trim();
                }
            }
        }
        return '';
    };

    const records = [];

    for (let i = 1; i < oppRows.length; i++) {
        const row = oppRows[i]; if (!row) continue;

        // Core identifiers — skip rows with nothing useful
        const recordId  = g(row, 'record id');
        const oppName   = g(row, 'opportunity name', 'name of project', 'subject');
        if (!oppName && !recordId) continue;

        // ── Key business fields (exact column names from Zoho CRM export) ──
        const stage          = g(row, 'stage');
        const salesPerson    = g(row, 'opportunity owner');
        const accountName    = g(row, 'account name');
        const projectName    = g(row, 'name of project', 'opportunity name');
        const city           = g(row, 'project city', 'city');
        const region         = g(row, 'region') || deriveRegion(city, g(row, 'type of business'));
        const psNumber       = g(row, 'ps number', 'quotation number');
        const oppId          = g(row, 'opp id');
        const closingDate    = g(row, 'closing date');
        const closedWonDate  = g(row, 'closed won date');
        const closedLostDate = g(row, 'closed lost date');
        const lossReason     = g(row, 'remarks of close lost', 'remarks of close of lost', 'reason of closed quote won date', 'reason of close');
        const competitor     = g(row, 'list of competitors');
        const typeOfBusiness = g(row, 'type of business');
        const productType    = g(row, 'new product or existing product', 'product type');
        const typeOfSystem   = g(row, 'type of system');
        const contractType   = g(row, 'contract types');
        const country        = g(row, 'project country', 'country') || 'India';
        const street         = g(row, 'project street 1');
        const createdTime    = g(row, 'created time');
        const modifiedTime   = g(row, 'modified time');
        const probability    = num(g(row, 'probability (%)'));
        const totalPrice     = num(g(row, 'total price', 'amount', 'grand total'));
        const parkingSpaces  = num(g(row, 'expected no. of parking spaces', 'expected no of parking spaces'));
        const salesCycleDays = num(g(row, 'sales cycle duration', 'overall sales duration'));
        const enquiryFor     = g(row, 'enquiry for');

        records.push({
            source:          'crm',
            dataType:        'opportunity',
            id:              recordId || `opp_${i}`,
            oppId:           oppId || '',
            psNumber:        psNumber || '',
            name:            projectName || oppName,
            salesPerson:     salesPerson || '',
            accountName:     accountName || '',
            stage:           stage || '',
            amount:          totalPrice,
            probability:     probability,
            city:            city || '',
            region:          region || 'Unknown',
            country:         country,
            street:          street || '',
            closingDate:     closingDate || '',
            closedWonDate:   closedWonDate || '',
            closedLostDate:  closedLostDate || '',
            lossReason:      lossReason || '',
            competitor:      competitor || '',
            typeOfBusiness:  typeOfBusiness || '',
            productType:     productType || '',
            typeOfSystem:    typeOfSystem || '',
            contractType:    contractType || '',
            enquiryFor:      enquiryFor || '',
            parkingSpaces:   parkingSpaces,
            salesCycleDays:  salesCycleDays,
            createdDate:     createdTime || '',
            modifiedDate:    modifiedTime || '',
            currency:        'INR',
        });
    }

    return records;
};

// ── Parse Leads CSV ──────────────────────────────────────────────────────────
const parseLeadsData = (base64Data) => {
    if (!base64Data) return [];
    try {
        const buf  = Buffer.from(base64Data, 'base64');
        const wb   = XLSX.read(buf, { type: 'buffer', cellDates: true });
        const name = wb.SheetNames.find(s => s.toLowerCase().includes('lead')) || wb.SheetNames[0];
        if (!name) return [];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false });
        if (rows.length < 2) return [];

        const hdr = {};
        (rows[0] || []).forEach((h, i) => { if (h) hdr[String(h).trim().toLowerCase()] = i; });
        const g = (row, ...keys) => {
            for (const k of keys) {
                const idx = hdr[k.toLowerCase()];
                if (idx !== undefined) {
                    const v = row[idx];
                    if (v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A') return String(v).trim();
                }
            }
            return '';
        };

        return rows.slice(1).filter(Boolean).map((row, i) => {
            const id        = g(row, 'record id');
            const firstName = g(row, 'first name');
            const lastName  = g(row, 'last name');
            const name_     = g(row, 'lead name') || [firstName, lastName].filter(Boolean).join(' ');
            if (!name_ && !id) return null;
            return {
                source:         'crm',
                dataType:       'lead',
                id:             id || `lead_${i}`,
                name:           name_,
                leadOwner:      g(row, 'lead owner'),
                company:        g(row, 'company'),
                leadSource:     g(row, 'lead source'),
                leadStatus:     g(row, 'lead status'),
                city:           g(row, 'project city'),
                region:         g(row, 'region', 'regions'),
                typeOfSystem:   g(row, 'type of system'),
                typeOfBusiness: g(row, 'type of business'),
                typeOfContact:  g(row, 'type of contact'),
                nameOfProject:  g(row, 'name of project'),
                parkingSpaces:  num(g(row, 'expected no. of parking ùnit / spaces', 'expected no. of parking unit / spaces', 'expected no of parking spaces')),
                budget:         g(row, 'budget'),
                enquiryFor:     g(row, 'enquiry for'),
                sector:         g(row, 'sector'),
                isConverted:    g(row, 'is converted').toLowerCase() === 'true',
                createdDate:    g(row, 'created time'),
            };
        }).filter(Boolean);
    } catch (e) {
        console.error('parseLeadsData error:', e.message);
        return [];
    }
};

// ── Parse Sales Orders CSV (works for SAP_Sales_Orders or Sales_Orders export) ─
const parseSalesOrdersData = (base64Data) => {
    if (!base64Data) return [];
    try {
        const buf  = Buffer.from(base64Data, 'base64');
        const wb   = XLSX.read(buf, { type: 'buffer', cellDates: true });
        const name = wb.SheetNames[0];
        if (!name) return [];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false });
        if (rows.length < 2) return [];

        const hdr = {};
        (rows[0] || []).forEach((h, i) => { if (h) hdr[String(h).trim().toLowerCase()] = i; });
        const g = (row, ...keys) => {
            for (const k of keys) {
                const idx = hdr[k.toLowerCase()];
                if (idx !== undefined) {
                    const v = row[idx];
                    if (v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A') return String(v).trim();
                }
            }
            return '';
        };

        return rows.slice(1).filter(Boolean).map((row, i) => {
            const id      = g(row, 'record id');
            const subject = g(row, 'subject');
            if (!subject && !id) return null;
            return {
                source:          'crm',
                dataType:        'sap_sales',
                id:              id || `sap_${i}`,
                subject:         subject,
                oppName:         g(row, 'opportunity name'),
                accountName:     g(row, 'account name'),
                quoteName:       g(row, 'quote name'),
                grandTotal:      num(g(row, 'grand total')),
                subTotal:        num(g(row, 'sub total')),
                paymentStatus:   g(row, 'payment status'),
                status:          g(row, 'status'),
                billingCity:     g(row, 'billing city'),
                billingState:    g(row, 'billing state'),
                sapCustomerCode: g(row, 'sap customer code'),
                epsApsPs:        g(row, 'eps/aps/ps number', 'epsaps/ps number'),
                sapOrderCode:    g(row, 'sap sales order code'),
                dueDate:         g(row, 'due date'),
                createdDate:     g(row, 'sap sales order created date', 'created time'),
                region:          g(row, 'region'),
                employeeCode:    g(row, 'employee code'),
                autoNumber:      g(row, 'auto-number'),
                currency:        g(row, 'order currency', 'currency') || 'INR',
            };
        }).filter(Boolean);
    } catch (e) {
        console.error('parseSalesOrdersData error:', e.message);
        return [];
    }
};

// ── Parse Quotes CSV ─────────────────────────────────────────────────────────
const parseQuotesData = (base64Data) => {
    if (!base64Data) return [];
    try {
        const buf  = Buffer.from(base64Data, 'base64');
        const wb   = XLSX.read(buf, { type: 'buffer', cellDates: true });
        const name = wb.SheetNames.find(s => s.toLowerCase().includes('quote')) || wb.SheetNames[0];
        if (!name) return [];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false });
        if (rows.length < 2) return [];

        const hdr = {};
        (rows[0] || []).forEach((h, i) => { if (h) hdr[String(h).trim().toLowerCase()] = i; });
        const g = (row, ...keys) => {
            for (const k of keys) {
                const idx = hdr[k.toLowerCase()];
                if (idx !== undefined) {
                    const v = row[idx];
                    if (v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A') return String(v).trim();
                }
            }
            return '';
        };

        return rows.slice(1).filter(Boolean).map((row, i) => {
            const id      = g(row, 'record id');
            const subject = g(row, 'subject');
            if (!subject && !id) return null;
            return {
                source:         'crm',
                dataType:       'quote',
                id:             id || `quote_${i}`,
                subject:        subject,
                oppName:        g(row, 'opportunity name'),
                accountName:    g(row, 'account name'),
                quoteStage:     g(row, 'quote stage'),
                psNumber:       g(row, 'ps number', 'quotation number'),
                quotationNumber: g(row, 'quotation number'),
                autoNumber:     g(row, 'auto-number'),
                grandTotal:     num(g(row, 'grand total')),
                subTotal:       num(g(row, 'sub total')),
                productType:    g(row, 'product type'),
                typeOfSystem:   g(row, 'type of system'),
                region:         g(row, 'region'),
                quoteOwner:     g(row, 'quote owner'),
                quoteDate:      g(row, 'quote date'),
                validUntil:     g(row, 'valid until'),
                typeOfBusiness: g(row, 'type of business'),
                nameOfProject:  g(row, 'name of project'),
                billingCity:    g(row, 'billing city'),
                currency:       g(row, 'quote currency', 'currency') || 'INR',
                contractType:   g(row, 'contract type'),
                createdDate:    g(row, 'created time'),
            };
        }).filter(Boolean);
    } catch (e) {
        console.error('parseQuotesData error:', e.message);
        return [];
    }
};



// ── Parse Open Service Requests XLSX (Zoho Creator export) ──────────────────
const parseServiceRequests = (base64Data) => {
    if (!base64Data) return [];
    try {
        const buf  = Buffer.from(base64Data, 'base64');
        const wb   = XLSX.read(buf, { type: 'buffer', cellDates: true });
        const name = wb.SheetNames.find(s => s.toLowerCase().includes('service'))
                  || wb.SheetNames.find(s => s.toLowerCase().includes('request'))
                  || wb.SheetNames[0];
        if (!name) return [];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false });
        if (rows.length < 2) return [];

        const hdr = {};
        (rows[0] || []).forEach((h, i) => { if (h) hdr[String(h).trim().toLowerCase()] = i; });

        // ─── Schema guard: reject files that aren't actually a Service Request export ───
        // Required marker columns unique to SR files. If any are missing, the user has
        // probably uploaded the wrong file into this slot (e.g. Spare Quotations or an
        // Opportunity export). Refuse to parse anything from it.
        const REQUIRED_SR = ['service request number', 'service request type', 'service technician name'];
        const missing = REQUIRED_SR.filter(k => hdr[k] === undefined);
        if (missing.length > 0) {
            console.warn(`parseServiceRequests: file rejected — missing columns: ${missing.join(', ')}. Sheet: "${name}".`);
            return [];
        }

        const g = (row, ...keys) => {
            for (const k of keys) {
                const idx = hdr[k.toLowerCase()];
                if (idx !== undefined) {
                    const v = row[idx];
                    if (v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A') return String(v).trim();
                }
            }
            return '';
        };

        return rows.slice(1).filter(Boolean).map((row, i) => {
            const id  = g(row, 'id', 'record id');
            const srn = g(row, 'service request number');
            if (!id && !srn) return null;
            return {
                source:               'creator',
                dataType:             'service_request',
                id:                   id || `sr_${i}`,
                status:               g(row, 'status'),
                serviceRequestNumber: srn,
                serviceRequestType:   g(row, 'service request type'),
                apsPsNumber:          g(row, 'aps/ps parking number', 'ps number'),
                parentEsnNumber:      g(row, 'parent esn number'),
                childEsnNumber:       g(row, 'child esn number'),
                customerName:         g(row, 'customer name'),
                routeName:             g(row, 'route name'),
                region:               g(row, 'region') || 'Unknown',
                serviceContractType:  g(row, 'service contract type'),
                technicianName:       g(row, 'service technician name'),
                callStatus:           g(row, 'call status'),
                callValidity:         g(row, 'call validity'),
                dueDate:              g(row, 'due date'),
                closedDate:           g(row, 'closed date'),
                createdBy:            g(row, 'created by'),
                createdDate:          g(row, 'created time'),
            };
        }).filter(Boolean);
    } catch (e) {
        console.error('parseServiceRequests error:', e.message);
        return [];
    }
};

// ── Parse All Spare Quotations XLSX (Zoho Creator export) ───────────────────
const parseSpareQuotations = (base64Data) => {
    if (!base64Data) return [];
    try {
        const buf  = Buffer.from(base64Data, 'base64');
        const wb   = XLSX.read(buf, { type: 'buffer', cellDates: true });
        const name = wb.SheetNames.find(s => s.toLowerCase().includes('spare'))
                  || wb.SheetNames.find(s => s.toLowerCase().includes('quotation'))
                  || wb.SheetNames[0];
        if (!name) return [];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false });
        if (rows.length < 2) return [];

        const hdr = {};
        (rows[0] || []).forEach((h, i) => { if (h) hdr[String(h).trim().toLowerCase()] = i; });

        // ─── Schema guard: reject files that aren't a real Spare Quotations export ───
        // Required marker columns unique to spare quotes. If missing, the user has
        // dropped the wrong file in this slot (e.g. Service Requests). Refuse it.
        const REQUIRED_SP = ['quotation number', 'approval status'];
        const missing = REQUIRED_SP.filter(k => hdr[k] === undefined);
        if (missing.length > 0) {
            console.warn(`parseSpareQuotations: file rejected — missing columns: ${missing.join(', ')}. Sheet: "${name}".`);
            return [];
        }

        const g = (row, ...keys) => {
            for (const k of keys) {
                const idx = hdr[k.toLowerCase()];
                if (idx !== undefined) {
                    const v = row[idx];
                    if (v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== 'N/A') return String(v).trim();
                }
            }
            return '';
        };

        return rows.slice(1).filter(Boolean).map((row, i) => {
            const id  = g(row, 'id', 'record id');
            const qn  = g(row, 'quotation number');
            if (!id && !qn) return null;
            return {
                source:           'creator',
                dataType:         'spare_quote',
                id:               id || `spq_${i}`,
                status:           g(row, 'status'),
                approvalStatus:   g(row, 'approval status'),
                quotationNumber:  qn,
                apsPsNumber:      g(row, 'aps/ps parking number', 'ps number'),
                parentEsnNumber:  g(row, 'parent esn number'),
                routeName:         g(row, 'route name'),
                salesPersonName:  g(row, 'service sales person name'),
                quotationDate:    g(row, 'quotation date'),
                category:         g(row, 'category'),
                addedTime:        g(row, 'added time'),
                createdBy:        g(row, 'created by'),
                // primary date used for date filtering
                createdDate:      g(row, 'added time', 'quotation date'),
            };
        }).filter(Boolean);
    } catch (e) {
        console.error('parseSpareQuotations error:', e.message);
        return [];
    }
};


// ──────────────────────────────────────────────
// POST  /get-months  — scan file, return available months with coverage
// ──────────────────────────────────────────────
app.post('/get-months', async (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No file data' });

        const buf = Buffer.from(fileData, 'base64');
        const wb  = XLSX.read(buf, { type: 'buffer', cellDates: true });

        // Find the Opportunities sheet — fall back to first sheet if not named exactly
        const oppSheetName =
            wb.SheetNames.find(s => ['opportunities', 'opportunity'].includes(s.toLowerCase())) ||
            wb.SheetNames[0];
        if (!oppSheetName) {
            return res.status(400).json({ error: 'No sheets found in this file.' });
        }

        const rows = XLSX.utils.sheet_to_json(wb.Sheets[oppSheetName], {
            header: 1, defval: null, raw: false
        });
        if (rows.length < 2) {
            return res.status(400).json({ error: 'The sheet appears to be empty.' });
        }

        // Build header map
        const hdr = {};
        (rows[0] || []).forEach((h, i) => {
            if (h) hdr[String(h).trim().toLowerCase()] = i;
        });

        // Helper: pick first matching column value
        const g = (row, ...keys) => {
            for (const k of keys) {
                const idx = hdr[k.toLowerCase()];
                if (idx !== undefined && row[idx] != null && String(row[idx]).trim() !== '') {
                    return String(row[idx]).trim();
                }
            }
            return '';
        };

        // Collect all months from date columns.
        // Priority: Created Time (every record has this) → close dates
        const monthCounts = {}; // "YYYY-MM" -> { total, withStage, withCity, withRegion }

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            // Use Created Time as primary (every CRM record has it)
            const dateStr = g(row,
                'created time', 'closed won date', 'closed lost date',
                'modified time', 'closing date'
            );
            if (!dateStr) continue;

            let d;
            try { d = new Date(dateStr); } catch (_) { continue; }
            if (isNaN(d)) continue;

            // Ignore clearly invalid years (Zoho sometimes has 2050 placeholders)
            if (d.getFullYear() < 2020 || d.getFullYear() > 2030) continue;

            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthCounts[ym]) {
                monthCounts[ym] = { total: 0, withStage: 0, withCity: 0, withRegion: 0 };
            }
            monthCounts[ym].total++;
            if (g(row, 'stage'))            monthCounts[ym].withStage++;
            if (g(row, 'project city', 'city')) monthCounts[ym].withCity++;
            if (g(row, 'region'))           monthCounts[ym].withRegion++;
        }

        if (Object.keys(monthCounts).length === 0) {
            // No date columns found — return a single "All Data" option
            const totalRows = rows.length - 1;
            return res.status(200).json({
                months: [{
                    ym:    'ALL',
                    label: 'All Data',
                    coverage: { sales: totalRows, parts: totalRows, cx: totalRows },
                }]
            });
        }

        // Sort months descending (most recent first)
        const months = Object.entries(monthCounts)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([ym, c]) => {
                const [year, month] = ym.split('-');
                const label = new Date(Number(year), Number(month) - 1, 1)
                    .toLocaleString('en-AU', { month: 'short', year: '2-digit' });
                return {
                    ym,
                    label,
                    // Reuse the coverage shape DataUploader.jsx expects
                    coverage: {
                        sales:  c.withStage,
                        parts:  c.withCity,
                        cx:     c.withRegion,
                    },
                };
            });

        return res.status(200).json({ months });
    } catch (err) {
        console.error('POST /get-months error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// POST  /validate-upload  — preview row counts for up to 4 separate CSV files
// ──────────────────────────────────────────────
app.post('/validate-upload', async (req, res) => {
    try {
        const { opportunityData, leadsData, sapSalesData, quotesData,
                serviceRequestData, spareQuotationsData } = req.body;
        if (!opportunityData && !serviceRequestData && !spareQuotationsData) {
            return res.status(400).json({ error: 'At least one file (CRM or Creator) is required' });
        }

        const countFile = (b64) => {
            if (!b64) return 0;
            try {
                const wb   = XLSX.read(Buffer.from(b64, 'base64'), { type: 'buffer' });
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
                return Math.max(0, rows.length - 1);
            } catch (_) { return 0; }
        };

        return res.status(200).json({
            opportunities:   countFile(opportunityData),
            leads:           countFile(leadsData),
            sapSales:        countFile(sapSalesData),
            quotes:          countFile(quotesData),
            serviceRequests: countFile(serviceRequestData),
            spareQuotations: countFile(spareQuotationsData),
        });
    } catch (err) {
        console.error('POST /validate-upload error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// GET  /list-scorecards  — return all stored upload IDs
// ──────────────────────────────────────────────
app.get('/list-scorecards', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const result = await zcql.executeZCQLQuery('SELECT record_id FROM dashboard_data');
        const seen = new Set();
        if (result && result.length > 0) {
            result.forEach(r => {
                const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                const rid = row?.record_id || '';
                const m = rid.match(/^(WOHR_\d{4}_\d{2}_\d{2})(?:_batch_\d+)?$/);
                if (m) seen.add(m[1]);
            });
        }
        return res.status(200).json({ ids: [...seen] });
    } catch (err) {
        console.error('GET /list-scorecards error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// GET  /  — serve dealers from data store
// ──────────────────────────────────────────────
app.get('/', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();

        const requestedId = req.query?.id;
        if (!requestedId) return res.status(400).json({ error: 'Missing ID' });

        // Fetch only rows that belong to this scorecard (record_id starts with the requested ID)
        const result = await zcql.executeZCQLQuery('SELECT * FROM dashboard_data');
        let allDealers = [];

        if (result && result.length > 0) {
            result.forEach(r => {
                try {
                    const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                    // Only include rows whose record_id belongs to this scorecard
                    if (row && row.record_id && !row.record_id.startsWith(requestedId)) return;
                    if (row && row.data) {
                        const parsed = JSON.parse(row.data);
                        if (Array.isArray(parsed)) allDealers = allDealers.concat(parsed);
                    }
                } catch (e) { console.log('Skipping row:', e.message); }
            });
        }

        return res.status(200).json(allDealers);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
});


// ──────────────────────────────────────────────
// POST  /process-scorecard  — parse WOHR data (up to 4 files), quality-check, store
// ──────────────────────────────────────────────
app.post('/process-scorecard', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();

        const { opportunityData, leadsData, sapSalesData, quotesData,
                serviceRequestData, spareQuotationsData,
                fileData } = req.body;  // fileData kept for backward-compat

        const oppFile = opportunityData || fileData;
        if (!oppFile && !serviceRequestData && !spareQuotationsData) {
            return res.status(400).json({ error: 'At least one file (CRM or Creator) is required' });
        }

        // 1. Parse all provided files (CRM + Creator)
        console.log('Parsing WOHR data...');
        const opps     = oppFile ? parseWOHRData(oppFile) : [];
        const leads    = parseLeadsData(leadsData);
        const sales    = parseSalesOrdersData(sapSalesData);
        const qs       = parseQuotesData(quotesData);

        // ── Creator files: AUTO-DETECT by trying both parsers on each slot. Whichever
        // one returns records wins — so the user can't break the dashboard by dropping
        // the Service Request file into the Spare Quotations slot (or vice-versa).
        const detectCreator = (b64) => {
            if (!b64) return { kind: null, records: [] };
            const sr = parseServiceRequests(b64);
            if (sr.length) return { kind: 'service_request', records: sr };
            const sp = parseSpareQuotations(b64);
            if (sp.length) return { kind: 'spare_quote', records: sp };
            return { kind: null, records: [] };
        };

        const aDet = detectCreator(serviceRequestData);
        const bDet = detectCreator(spareQuotationsData);

        // Combine results — handles all four slot/file permutations
        let srs = [], spares = [];
        const detectionNotes = [];
        [
            { det: aDet, slot: "Open Service Requests slot" },
            { det: bDet, slot: "All Spare Quotations slot" },
        ].forEach(({ det, slot }) => {
            if (det.kind === 'service_request') {
                srs = srs.concat(det.records);
                if (slot.includes("Spare")) detectionNotes.push(`Detected a Service Request file in ${slot} — parsed it correctly anyway.`);
            } else if (det.kind === 'spare_quote') {
                spares = spares.concat(det.records);
                if (slot.includes("Service")) detectionNotes.push(`Detected a Spare Quotations file in ${slot} — parsed it correctly anyway.`);
            }
        });

        const records = [...opps, ...leads, ...sales, ...qs, ...srs, ...spares];
        console.log(`Parsed: ${opps.length} opps, ${leads.length} leads, ${sales.length} sales orders, ${qs.length} quotes, ${srs.length} service requests, ${spares.length} spare quotes`);

        // 1b. Surface upload warnings
        const warnings = [...detectionNotes];
        if (serviceRequestData  && aDet.kind === null) warnings.push("File in Open Service Requests slot wasn't recognised — neither SR nor Spare schema matched. Skipped.");
        if (spareQuotationsData && bDet.kind === null) warnings.push("File in All Spare Quotations slot wasn't recognised — neither SR nor Spare schema matched. Skipped.");
        if (leadsData    && leads.length === 0) warnings.push("Leads file produced 0 records — check the file contents.");
        if (sapSalesData && sales.length === 0) warnings.push("SAP Sales Orders file produced 0 records — check the file contents.");
        if (quotesData   && qs.length === 0)    warnings.push("Quotes file produced 0 records — check the file contents.");
        if (oppFile      && opps.length === 0)  warnings.push("Opportunities file produced 0 records — check the file contents.");
        if (warnings.length) console.warn('Upload warnings:', warnings);

        // 2. Quality check (opportunity fields only — CRM side)
        const quality = runWOHRQualityCheck(opps);
        console.log('Quality summary:', JSON.stringify(quality.summary));

        // 4. Upload ID: WOHR_YYYY_MM_DD (or include month if selected)
        const now = new Date();
        const dateStr = `${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}_${String(now.getDate()).padStart(2,'0')}`;
        const base = `WOHR_${dateStr}`;
        console.log(`Using upload ID: ${base}`);

        // 5. Delete existing batch rows for this ID (upsert)
        try {
            const toDelete = await zcql.executeZCQLQuery('SELECT record_id FROM dashboard_data');
            if (toDelete && toDelete.length > 0) {
                for (const r of toDelete) {
                    const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                    const rid = row?.record_id || '';
                    if (rid.startsWith(base + '_batch_')) {
                        await zcql.executeZCQLQuery(`DELETE FROM dashboard_data WHERE record_id = '${rid}'`);
                    }
                }
            }
        } catch (e) {
            console.log('Pre-delete step skipped:', e.message);
        }

        // 6. Insert in batches of 10
        for (let i = 0; i < records.length; i += 10) {
            const batch = records.slice(i, i + 10);
            const esc   = JSON.stringify(batch).replace(/'/g, "''");
            await zcql.executeZCQLQuery(
                `INSERT INTO dashboard_data (record_id, data) VALUES ('${base}_batch_${i}', '${esc}')`
            );
        }

        const qualitySummary = {
            ...quality.summary,
            records:              opps.length,
            leadsCount:           leads.length,
            sapSalesCount:        sales.length,
            quotesCount:          qs.length,
            serviceRequestsCount: srs.length,
            spareQuotationsCount: spares.length,
        };

        return res.status(200).json({
            message:     'Success',
            recordCount: records.length,
            dealerCount: records.length,
            scorecardId: base,
            uploadDate:  now.toISOString(),
            quality:     qualitySummary,
            warnings,
        });

    } catch (err) {
        console.error('POST /process-scorecard error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST  /process-scorecard-multipart  — same logic but accepts files via
//   multipart/form-data (avoids Catalyst gateway JSON body-size limits).
//   Field names: opportunity, leads, sapSales, quotes,
//                serviceRequest, spareQuotations  (all optional)
// ──────────────────────────────────────────────────────────────────────────────
app.post(
    '/process-scorecard-multipart',
    upload.fields([
        { name: 'opportunity',     maxCount: 1 },
        { name: 'leads',           maxCount: 1 },
        { name: 'sapSales',        maxCount: 1 },
        { name: 'quotes',          maxCount: 1 },
        { name: 'serviceRequest',  maxCount: 1 },
        { name: 'spareQuotations', maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const catalystApp = catalyst.initialize(req);
            const zcql = catalystApp.zcql();

            // Convert an uploaded file buffer to the base64 string our parsers expect
            const toB64 = (fieldName) => {
                const files = req.files?.[fieldName];
                if (!files || !files[0]) return null;
                return files[0].buffer.toString('base64');
            };

            const oppFile          = toB64('opportunity');
            const leadsFile        = toB64('leads');
            const sapSalesFile     = toB64('sapSales');
            const quotesFile       = toB64('quotes');
            const serviceReqFile   = toB64('serviceRequest');
            const spareQuotesFile  = toB64('spareQuotations');

            if (!oppFile && !serviceReqFile && !spareQuotesFile) {
                return res.status(400).json({ error: 'At least one file (CRM or Creator) is required' });
            }

            // ── Parse (reuse exact same logic as /process-scorecard) ──
            console.log('Parsing WOHR data (multipart)...');
            const opps  = oppFile      ? parseWOHRData(oppFile)         : [];
            const leads = leadsFile    ? parseLeadsData(leadsFile)       : [];
            const sales = sapSalesFile ? parseSalesOrdersData(sapSalesFile) : [];
            const qs    = quotesFile   ? parseQuotesData(quotesFile)     : [];

            const detectCreator = (b64) => {
                if (!b64) return { kind: null, records: [] };
                const sr = parseServiceRequests(b64);
                if (sr.length) return { kind: 'service_request', records: sr };
                const sp = parseSpareQuotations(b64);
                if (sp.length) return { kind: 'spare_quote', records: sp };
                return { kind: null, records: [] };
            };

            const aDet = detectCreator(serviceReqFile);
            const bDet = detectCreator(spareQuotesFile);

            let srs = [], spares = [];
            const detectionNotes = [];
            [
                { det: aDet, slot: 'Open Service Requests slot' },
                { det: bDet, slot: 'All Spare Quotations slot' },
            ].forEach(({ det, slot }) => {
                if (det.kind === 'service_request') {
                    srs = srs.concat(det.records);
                    if (slot.includes('Spare')) detectionNotes.push(`Detected a Service Request file in ${slot} — parsed it correctly anyway.`);
                } else if (det.kind === 'spare_quote') {
                    spares = spares.concat(det.records);
                    if (slot.includes('Service')) detectionNotes.push(`Detected a Spare Quotations file in ${slot} — parsed it correctly anyway.`);
                }
            });

            const records = [...opps, ...leads, ...sales, ...qs, ...srs, ...spares];
            console.log(`Parsed: ${opps.length} opps, ${leads.length} leads, ${sales.length} sales orders, ${qs.length} quotes, ${srs.length} service requests, ${spares.length} spare quotes`);

            const warnings = [...detectionNotes];
            if (serviceReqFile  && aDet.kind === null) warnings.push("File in Open Service Requests slot wasn't recognised — skipped.");
            if (spareQuotesFile && bDet.kind === null) warnings.push("File in All Spare Quotations slot wasn't recognised — skipped.");
            if (leadsFile    && leads.length === 0) warnings.push('Leads file produced 0 records — check the file.');
            if (sapSalesFile && sales.length === 0) warnings.push('SAP Sales Orders file produced 0 records — check the file.');
            if (quotesFile   && qs.length === 0)    warnings.push('Quotes file produced 0 records — check the file.');
            if (oppFile      && opps.length === 0)  warnings.push('Opportunities file produced 0 records — check the file.');

            const quality = runWOHRQualityCheck(opps);
            console.log('Quality summary:', JSON.stringify(quality.summary));

            const now = new Date();
            const dateStr = `${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}_${String(now.getDate()).padStart(2,'0')}`;
            const base = `WOHR_${dateStr}`;
            console.log(`Using upload ID: ${base}`);

            // Delete previous batches
            try {
                const toDelete = await zcql.executeZCQLQuery('SELECT record_id FROM dashboard_data');
                if (toDelete && toDelete.length > 0) {
                    for (const r of toDelete) {
                        const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                        const rid = row?.record_id || '';
                        if (rid.startsWith(base + '_batch_')) {
                            await zcql.executeZCQLQuery(`DELETE FROM dashboard_data WHERE record_id = '${rid}'`);
                        }
                    }
                }
            } catch (e) {
                console.log('Pre-delete step skipped:', e.message);
            }

            // Insert in batches of 10
            for (let i = 0; i < records.length; i += 10) {
                const batch = records.slice(i, i + 10);
                const esc   = JSON.stringify(batch).replace(/'/g, "''");
                await zcql.executeZCQLQuery(
                    `INSERT INTO dashboard_data (record_id, data) VALUES ('${base}_batch_${i}', '${esc}')`
                );
            }

            const qualitySummary = {
                ...quality.summary,
                records:              opps.length,
                leadsCount:           leads.length,
                sapSalesCount:        sales.length,
                quotesCount:          qs.length,
                serviceRequestsCount: srs.length,
                spareQuotationsCount: spares.length,
            };

            return res.status(200).json({
                message:     'Success',
                recordCount: records.length,
                dealerCount: records.length,
                scorecardId: base,
                uploadDate:  now.toISOString(),
                quality:     qualitySummary,
                warnings,
            });

        } catch (err) {
            console.error('POST /process-scorecard-multipart error:', err);
            return res.status(500).json({ error: err.message });
        }
    }
);

// ──────────────────────────────────────────────
// SMTP transporter (Gmail)
// ──────────────────────────────────────────────
const mailer = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER || 'sherlockloke@gmail.com',
        pass: process.env.SMTP_PASS || 'ryvm bvoa rfnv npxt',
    },
});

// ──────────────────────────────────────────────
// POST  /send-email  — send WOHR dashboard report
// ──────────────────────────────────────────────
app.post('/send-email', async (req, res) => {
    try {
        const { to, toName, subject, format, pdfBase64, records, currentState } = req.body;
        if (!to)      return res.status(400).json({ error: 'Recipient email is required' });
        if (!records) return res.status(400).json({ error: 'No records data provided' });

        const sendFormat   = format === 'pdf' ? 'pdf' : 'link';
        const dashboardUrl = 'https://wohr-odd-60317726357.development.catalystserverless.in/app/index.html';
        const region       = currentState?.region || 'All Regions';
        const tab          = currentState?.tab    || 'overview';
        const total        = records.length;

        const won    = records.filter(r => r.stage === 'Closed Won');
        const active = records.filter(r => !['Closed Won','Closed Lost'].includes(r.stage));
        const wonAmt = won.reduce((s, r) => s + (r.amount || 0), 0);
        const pipelineAmt = active.reduce((s, r) => s + (r.amount || 0), 0);
        const winRate = records.filter(r => ['Closed Won','Closed Lost'].includes(r.stage)).length
            ? Math.round(won.length / records.filter(r => ['Closed Won','Closed Lost'].includes(r.stage)).length * 100) : 0;

        const top5Won = [...won].sort((a,b) => (b.amount||0)-(a.amount||0)).slice(0,5);
        const top5Rows = top5Won.map(r =>
            `<tr>
              <td style="padding:6px 12px;border-bottom:1px solid #2a2a2a">${r.name}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #2a2a2a">${r.region||'-'}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #2a2a2a">${r.productType||'-'}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #2a2a2a;text-align:right">${fmtINR(r.amount||0)}</td>
            </tr>`
        ).join('');

        const kpiBlock = `
    <tr><td style="background:#141414;padding:24px 32px">
      <table width="100%" cellspacing="8"><tr>
        <td style="background:#1e1e1e;border:1px solid #2a2a2a;border-radius:10px;padding:16px 20px;width:25%">
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px">Active Pipeline</div>
          <div style="font-size:22px;font-weight:800;color:#1E88E5;margin:6px 0">${fmtINR(pipelineAmt)}</div>
          <div style="font-size:11px;color:#555">${active.length} deals</div>
        </td>
        <td style="background:#1e1e1e;border:1px solid #2a2a2a;border-radius:10px;padding:16px 20px;width:25%">
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px">Won Revenue</div>
          <div style="font-size:22px;font-weight:800;color:#22C55E;margin:6px 0">${fmtINR(wonAmt)}</div>
          <div style="font-size:11px;color:#555">${won.length} deals closed</div>
        </td>
        <td style="background:#1e1e1e;border:1px solid #2a2a2a;border-radius:10px;padding:16px 20px;width:25%">
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px">Win Rate</div>
          <div style="font-size:22px;font-weight:800;color:#F59E0B;margin:6px 0">${winRate}%</div>
          <div style="font-size:11px;color:#555">of closed deals</div>
        </td>
        <td style="background:#1e1e1e;border:1px solid #2a2a2a;border-radius:10px;padding:16px 20px;width:25%">
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px">Total Records</div>
          <div style="font-size:22px;font-weight:800;color:#8B5CF6;margin:6px 0">${total}</div>
          <div style="font-size:11px;color:#555">opportunities</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#141414;padding:0 32px 24px">
      <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Top 5 Won Deals by Value</div>
      <table width="100%" style="border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#1e1e1e">
          <th style="padding:8px 12px;text-align:left;color:#aaa;font-weight:600;border-bottom:1px solid #333">Project</th>
          <th style="padding:8px 12px;text-align:left;color:#aaa;font-weight:600;border-bottom:1px solid #333">Region</th>
          <th style="padding:8px 12px;text-align:left;color:#aaa;font-weight:600;border-bottom:1px solid #333">Product</th>
          <th style="padding:8px 12px;text-align:right;color:#aaa;font-weight:600;border-bottom:1px solid #333">Value</th>
        </tr></thead>
        <tbody>${top5Rows}</tbody>
      </table>
    </td></tr>`;

        const headerBlock = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Segoe UI',Arial,sans-serif;color:#e5e5e5">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:32px auto">
    <tr><td style="background:linear-gradient(135deg,#1E3A5F,#1E88E5);padding:28px 32px;border-radius:12px 12px 0 0">
      <table width="100%"><tr>
        <td>
          <div style="font-size:11px;letter-spacing:3px;color:#90CAF9;text-transform:uppercase;margin-bottom:6px">WOHR Parking Systems</div>
          <div style="font-size:22px;font-weight:800;color:#fff">Sales Analytics Dashboard</div>
          <div style="font-size:13px;color:#90CAF9;margin-top:4px">CRM Pipeline Report</div>
        </td>
        <td style="text-align:right;font-size:36px;color:#ffffff44">⬡</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#1a1a1a;padding:12px 32px;border-bottom:1px solid #2a2a2a">
      <span style="font-size:12px;color:#888">Region: <strong style="color:#ccc">${region}</strong>
      &nbsp;·&nbsp; Tab: <strong style="color:#ccc">${tab}</strong>
      &nbsp;·&nbsp; Records: <strong style="color:#ccc">${total}</strong></span>
    </td></tr>`;

        const footerBlock = `
    <tr><td style="background:#0d0d0d;padding:16px 32px;border-radius:0 0 12px 12px;border-top:1px solid #222">
      <span style="font-size:11px;color:#555">Sent from WOHR Sales Analytics Dashboard
      &nbsp;·&nbsp; ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
    </td></tr>
  </table></body></html>`;

        const linkSection = `
    <tr><td style="background:#141414;padding:24px 32px;text-align:center">
      <a href="${dashboardUrl}" style="display:inline-block;background:#1E88E5;color:#fff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.5px">Open Live Dashboard →</a>
      <div style="margin-top:12px;font-size:11px;color:#555">${dashboardUrl}</div>
    </td></tr>`;

        const pdfSection = `
    <tr><td style="background:#141414;padding:20px 32px;text-align:center">
      <div style="font-size:13px;color:#aaa">📎 The full dashboard is attached as a PDF to this email.</div>
    </td></tr>`;

        const html = sendFormat === 'pdf'
            ? headerBlock + kpiBlock + pdfSection + footerBlock
            : headerBlock + kpiBlock + linkSection + footerBlock;

        const finalSubject = subject || `WOHR Sales Dashboard — ${region}`;
        const greeting     = toName ? `Hi ${toName},` : 'Hi,';
        const plainText    = `${greeting}\n\nWOHR Parking Systems — Sales Analytics\nRegion: ${region} | Active Pipeline: ${fmtINR(pipelineAmt)} | Won: ${fmtINR(wonAmt)} | Win Rate: ${winRate}%\nRecords: ${total}\n\n${sendFormat === 'pdf' ? 'See attached PDF.' : `Open dashboard: ${dashboardUrl}`}\n\n— WOHR Sales Analytics`;

        const attachments = (sendFormat === 'pdf' && pdfBase64)
            ? [{ filename: `wohr-dashboard.pdf`, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }]
            : [];

        await mailer.sendMail({
            from: '"WOHR Sales Analytics" <sherlockloke@gmail.com>',
            to,
            subject: finalSubject,
            html,
            text: plainText,
            attachments,
        });

        return res.status(200).json({ success: true, message: `Dashboard report sent to ${to}` });

    } catch (err) {
        console.error('POST /send-email error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// POST  /ask-stream  — streaming AI assistant (SSE)
// ─────────────────────────────────────────────────────────────
app.post('/ask-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    let closed = false;
    req.on('close', () => { closed = true; });

    try {
        const { question, dealers: records, currentState, history } = req.body;

        if (!question)                    { send({ error: 'No question provided' });    return res.end(); }
        if (!records || !records.length)  { send({ error: 'No records data provided' }); return res.end(); }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const dashSummary    = buildWOHRDataSummary(records);

        const systemInstruction = `You are an AI assistant embedded inside the WOHR Parking Systems sales analytics dashboard.
WOHR sells automated parking solutions (Parklift, Combilift) to builders and developers across India and Asia.
You have full access to all CRM opportunity and pipeline data.

DASHBOARD STATE:
- Current tab: ${currentState?.tab || 'overview'}
- Region filter: ${currentState?.region || 'All Regions'}
- Product filter: ${currentState?.product || 'All Products'}
- Stage filter: ${currentState?.stage || 'All Stages'}

AVAILABLE TABS: overview | pipeline | revenue | leads | products | serviceRequests | spareQuotes
AVAILABLE SOURCES: crm | creator | both  (CRM = sales pipeline; Creator = post-sale service ops)
AVAILABLE REGIONS: All Regions | North | South | East | West | ASIA | Unknown
AVAILABLE PRODUCT TYPES: All Products | Parklift | Combilift
AVAILABLE STAGES: All Stages | DWG Solutioning | Proposal | Qualification | On Hold | Closed Won | Closed Lost

--- CURRENT DATA ---
${dashSummary}

RESPONSE FORMAT — output EXACTLY in this two-part format, nothing else:
<your plain-text answer here>
<<<ACTIONS>>>
{"actions":[...]}

CRITICAL RULES:
- Text answer FIRST, then <<<ACTIONS>>> on its own line, then JSON.
- actions array may be empty [] but must always be present.
- Tab routing: pipeline/stage/funnel/deal → "pipeline", revenue/won/closed → "revenue", lead/source/enquiry → "leads", parklift/combilift/product → "products", general → "overview".
- Reset: use "All Regions", "All Products", "All Stages".
- Always cite real numbers from the data above.
- EMAIL: extract email + format ("link"/"pdf"). If format unknown, ask first. Action: {"type":"sendEmail","to":"...","toName":"...","format":"link|pdf"}.`;

        const contents = [
            { role: 'user', parts: [{ text: systemInstruction }] },
            { role: 'model', parts: [{ text: 'Understood. I will respond with plain-text first, then <<<ACTIONS>>> with the JSON.' }] },
        ];

        if (history && history.length) {
            history.forEach(msg => {
                contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
            });
        }
        contents.push({ role: 'user', parts: [{ text: question }] });

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents, generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } })
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            send({ error: `Gemini error ${geminiRes.status}: ${errText}` });
            return res.end();
        }

        const reader = geminiRes.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let fullText  = '';
        let replyDone = false; // true once we've passed <<<ACTIONS>>>

        while (true) {
            if (closed) break;
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop(); // keep incomplete line

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const dataStr = line.slice(6).trim();
                if (!dataStr || dataStr === '[DONE]') continue;

                let chunk = '';
                try {
                    const parsed = JSON.parse(dataStr);
                    chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } catch (_) { continue; }

                if (!chunk) continue;
                fullText += chunk;

                if (!replyDone) {
                    if (fullText.includes('<<<ACTIONS>>>')) {
                        replyDone = true;
                        // Send the portion of this chunk that's still reply text
                        const chunkReplyPart = chunk.includes('<<<ACTIONS>>>')
                            ? chunk.split('<<<ACTIONS>>>')[0]
                            : '';
                        if (chunkReplyPart.trim()) send({ chunk: chunkReplyPart });
                    } else {
                        send({ chunk });
                    }
                }
            }
        }

        // Parse the complete response
        const sepIdx    = fullText.indexOf('<<<ACTIONS>>>');
        const replyText = (sepIdx >= 0 ? fullText.slice(0, sepIdx) : fullText).trim();
        let actions = [], crossMonth = false;

        if (sepIdx >= 0) {
            try {
                const actionsStr = fullText.slice(sepIdx + 13).trim();
                const actParsed  = JSON.parse(actionsStr);
                actions    = actParsed.actions    || [];
                crossMonth = actParsed.crossMonth || false;
            } catch (_) {}
        }

        send({ done: true, reply: replyText, actions, crossMonth });
        res.end();

    } catch (err) {
        console.error('POST /ask-stream error:', err);
        send({ error: err.message });
        res.end();
    }
});

// ──────────────────────────────────────────────
// POST  /ask  — AI assistant (non-streaming)
// ──────────────────────────────────────────────
app.post('/ask', async (req, res) => {
    try {
        const { question, dealers: records, currentState, history } = req.body;

        if (!question)                   return res.status(400).json({ error: 'No question provided' });
        if (!records || !records.length) return res.status(400).json({ error: 'No records data provided' });

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const dashSummary    = buildWOHRDataSummary(records);

        const panelsBlock = currentState?.panelsContext
            ? `\n\nWHAT THE USER IS LOOKING AT RIGHT NOW (panels with their FULL ROW DATA embedded below):\n${currentState.panelsContext}\n\nIMPORTANT — when the user asks to "read", "speak", "tell me", "list out", "what does it say", "go through" a panel: READ THE ACTUAL ROWS shown above. Each row's key=value pairs ARE the data — quote them by name. Do NOT refuse — the data is right there.\n\nExample: row "name=Acme Corp | company=Acme | region=West" → say "First, Acme Corp from Acme in the West region."`
            : "";

        const systemInstruction = `You are the WOHR data assistant — a FULL data exploration tool, not just an analyzer.

✅ YOU CAN AND SHOULD:
  • LIST INDIVIDUAL RECORDS by name (deals, leads, customers, service requests, spare quotations, etc.)
  • Show tables with project names, customer names, salesperson names, technician names, quote numbers
  • Answer "what are the leads in West region", "list all overdue service requests", "names of accounts in Pune"
  • Filter, sort, slice — every row in the database is fair game

❌ NEVER SAY any of these:
  "I can't list names" / "I'm only designed for analysis" / "I do summaries not lists" /
  "the dataset is too large" / "I can't show individual records" / "I'm limited to aggregates"
  These are all FALSE. You are explicitly designed to list individual records. If the user asks for names, EMIT A VISUALIZE ACTION with mode:"list" and the appropriate columns — the dashboard handles rendering the full table.

WOHR sells automated parking systems (Parklift, Combilift) to builders across India and Asia.

DASHBOARD STATE:
- Tab: ${currentState?.tab || 'overview'}
- Region: ${currentState?.region || 'All Regions'}
- Product: ${currentState?.product || 'All Products'}
- Stage: ${currentState?.stage || 'All Stages'}${panelsBlock}

AVAILABLE TABS: overview | pipeline | revenue | leads | products | serviceRequests | spareQuotes
AVAILABLE SOURCES: crm | creator | both
AVAILABLE REGIONS: All Regions | North | South | East | West | ASIA
AVAILABLE PRODUCT TYPES: All Products | Parklift | Combilift
AVAILABLE STAGES: All Stages | DWG Solutioning | Proposal | Qualification | On Hold | Closed Won | Closed Lost

--- DATA ---
${dashSummary}

RESPONSE FORMAT — ONLY valid JSON, no markdown:
{"reply":"...","actions":[],"insights":[]}

RULES:
- Always cite real numbers. Tab routing: pipeline/stage → "pipeline", revenue/won → "revenue", lead/source → "leads", product → "products", service/technician/AMC → "serviceRequests", spare → "spareQuotes", else → "overview".
- Reset: "All Regions", "All Products", "All Stages".
- The "insights" field is OPTIONAL — only include it when the user explicitly asks to "generate insights", "analyze", "summarize key findings", or similar. Each insight: {"title":"...","body":"...","severity":"critical|warning|info|success|insight","metric":"...","actionLabel":"...","actionTab":"...","actionRegion":"..."}. Include 6-8 mixed-severity insights covering BOTH CRM (pipeline/wins/losses) AND Creator (service/spares) when both have data.
- EMAIL: get email + format first. Action: {"type":"sendEmail","to":"...","toName":"...","format":"link|pdf"}.
- ACTIONS: {"type":"setTab","tab":"..."} | {"type":"setSource","source":"crm|creator|both"} | {"type":"setRegion","region":"..."} | {"type":"setSalesperson","salesperson":"..."} | {"type":"setDateRange","preset":"all|this-month|last-month|last-3|last-6|ytd"}.
- VISUALIZE: Whenever the user asks to "show", "chart", "plot", "visualize", "compare", "graph", or "table" something, emit a visualize action. The chart appears in the AI Insights tab.

  CRITICAL — your textual reply and the visualization MUST describe the same data. Before emitting the spec, re-read the user's question and pick the dataType/groupBy/metrics that genuinely match what they asked. If your reply mentions "deals worth ₹Xcr by region" then the spec MUST be dataType=opportunity groupBy=region metric=amount. Mismatched visualizations are worse than no visualization.

  DATA TYPE DECISION GUIDE (use the EXACT word the user said, then pick the dataType):
    "deal" / "deals" / "opportunity" / "opportunities" / "pipeline" / "won" / "lost" / "stage"          → dataType: opportunity
    "lead" / "leads" / "enquiry" / "enquiries" / "lead source" / "lead status"                          → dataType: lead
    "quote" / "quotes" / "quotation" (NEW-customer, sales pipeline)                                     → dataType: quote
    "sales order" / "SAP" / "SAP order" / "order" / "payment"                                           → dataType: sap_sales
    "service request" / "SR" / "technician" / "AMC" / "service call" / "overdue service"                → dataType: service_request
    "spare" / "spare quote" / "spare quotation" / "spare part" / "spare quotations"                     → dataType: spare_quote

  ⚠ CRITICAL — DISAMBIGUATION FOR "QUOTE"-LIKE WORDS:
    If the user says "spare" anywhere → dataType MUST be "spare_quote" (Creator). NEVER "sap_sales" or "quote".
    If the user says "SAP" or "order" → dataType MUST be "sap_sales". NEVER "quote" or "spare_quote".
    If the user says "quote" WITHOUT "spare" → dataType is "quote" (CRM quotation, not Creator spare).
    These three are completely different datasets — picking the wrong one returns 0 records and a broken chart.
    BEFORE you write a spec: re-read the user's question, find the exact qualifier, and match it above.

  GROUP-BY GUIDE (use the EXACT field the user mentioned):
    "by region" → region; "by salesperson"/"by owner" → salesPerson; "by stage" → stage; "by product" → productType;
    "by month"/"over time"/"trend" → month; "by source" → leadSource; "by technician" → technicianName;
    "by contract" → serviceContractType; "by approval" → approvalStatus; "by status" → status;
    "by account"/"by builder"/"by customer" → accountName.

  METRIC GUIDE (match metric to dataType — DO NOT cross over):
    opportunity      → count, amount, winRate, wonValue, pipelineValue, won, lost, avgProbability
    lead             → count only
    quote            → count, grandTotal, subTotal
    sap_sales        → count, grandTotal, subTotal
    service_request  → count only
    spare_quote      → count only

  TWO PANEL MODES — pick based on what the user asked:

  ★★★ HARD RULE ★★★
  If the user's question contains "top N" (e.g. "top 5", "top 10"), "list", "show me the ___", "biggest ___", "highest ___", "names of ___", "which ___", OR any phrasing that asks for INDIVIDUAL records by name — you MUST use mode:"list". GROUP mode is forbidden in this case. If you use groupBy with a non-existent field like "title", the chart will be empty.

  ★★★ NEVER SHOW IDs ★★★
  NEVER use "id" or "recordId" anywhere in a spec — not as groupBy, not as a column, not as sortBy, not as a filter key. These are internal database identifiers and the user must never see them. Always use the human name fields instead:
    opportunity     → first column "name" (project name), never "id" or "oppId"
    lead            → first column "name", never "id"
    quote           → first column "subject" or "nameOfProject", never "id"
    sap_sales       → first column "subject", never "id"
    service_request → first column "serviceRequestNumber" (e.g. FY2627-SR-00057653 — a business identifier, not a database id)
    spare_quote     → first column "quotationNumber" (e.g. SPQ2026-00013 — business identifier)
  If you want to count records, use metric "count" — never use groupBy:"id".

  (A) GROUP mode. Use when the user asks "how many", "by region", "compare", "distribution", "breakdown".
      Format: {"chartType":"bar|pie|line|table|kpi","dataType":"...","groupBy":"<field>","metrics":["count|amount|..."],"sortBy":"<metric>","sortDir":"desc","limit":10}
      NEVER set groupBy to "title", "name", "id", "deal", "deals" — those are not group dimensions.

  (B) LIST mode (default for "top N" and any individual-record request).
      Format: {"chartType":"table","mode":"list","dataType":"...","columns":["name","region","salesPerson","amount","stage"],"filter":{"stage":"Closed Won"},"sortBy":"amount","sortDir":"desc","limit":10}
      The FIRST column is the headline (e.g. "name" for opportunities, "serviceRequestNumber" for SRs). Pick 3-6 columns from the registry below.

  AVAILABLE COLUMNS PER dataType (for LIST mode):
    opportunity:     name, accountName, salesPerson, region, stage, amount, probability, city, productType, typeOfBusiness, contractType, closingDate, closedWonDate, closedLostDate, psNumber, competitor, lossReason, parkingSpaces, createdDate
    lead:            name, leadOwner, company, leadSource, leadStatus, region, city, typeOfBusiness, nameOfProject, sector, parkingSpaces, createdDate
    quote:           subject, accountName, nameOfProject, quoteStage, psNumber, quotationNumber, productType, region, quoteOwner, grandTotal, subTotal, quoteDate, billingCity, contractType
    sap_sales:       subject, oppName, accountName, sapOrderCode, grandTotal, status, paymentStatus, billingCity, billingState, region, dueDate, createdDate
    service_request: serviceRequestNumber, status, serviceRequestType, customerName, apsPsNumber, region, routeName, serviceContractType, technicianName, dueDate, closedDate, createdDate
    spare_quote:     quotationNumber, status, approvalStatus, apsPsNumber, routeName, salesPersonName, quotationDate, category, addedTime

  COMMON LIST EXAMPLES:
    "show top 10 won deals"         → {mode:"list",dataType:"opportunity",columns:["name","accountName","region","salesPerson","amount"],filter:{stage:"Closed Won"},sortBy:"amount",sortDir:"desc",limit:10}
    "biggest quotes this year"      → {mode:"list",dataType:"quote",columns:["subject","accountName","productType","grandTotal","quoteDate"],sortBy:"grandTotal",sortDir:"desc",limit:10}
    "overdue service requests"      → {mode:"list",dataType:"service_request",columns:["serviceRequestNumber","customerName","technicianName","region","dueDate"],filter:{status:"Overdue"},sortBy:"dueDate",sortDir:"asc",limit:20}
    "leads from referrals"          → {mode:"list",dataType:"lead",columns:["name","company","leadSource","region","leadStatus"],filter:{leadSource:"Referral"},limit:20}

  Rule of thumb: if your textual reply would name specific deals/customers/SRs by their proper names, the visualization MUST use mode:"list" with those same names as the first column.

  Set append=true if user says "also add", "and another", "include"; otherwise false replaces the grid.

  KPI panel layouts:
    - Multiple metrics, no grouping → omit groupBy (or set groupBy="total"). Renderer shows ONE card per metric. Good for "Total Pipeline · Won Revenue · Win Rate" summaries.
    - Multiple groups, one metric  → groupBy region/stage/etc + ONE metric. Renderer shows ONE card per group.
    - Aim for 3-6 cards per KPI panel.`;

        // Build Gemini contents array.
        // systemInstruction is only supported on v1beta; instead we prepend it
        // as the first user/model exchange so it works on the stable v1 endpoint.
        const contents = [
            { role: 'user', parts: [{ text: systemInstruction }] },
            { role: 'model', parts: [{ text: 'Understood. I am ready to answer questions about the MG dealer network using the data provided.' }] },
        ];

        // Inject conversation history (alternating user/model turns)
        if (history && history.length) {
            history.forEach(msg => {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                });
            });
        }

        // Add the current question
        contents.push({ role: 'user', parts: [{ text: question }] });

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 4096,
                    }
                })
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`);
        }

        const geminiData = await geminiRes.json();
        const candidate = geminiData.candidates?.[0];
        const finishReason = candidate?.finishReason || candidate?.finish_reason || '';
        const rawText = candidate?.content?.parts?.[0]?.text || '{}';

        if (finishReason === 'MAX_TOKENS') {
            return res.status(200).json({
                reply: 'The response was too long to complete. Try asking about a specific region or dealer instead of the full network.',
                actions: []
            });
        }

        let parsed;
        try {
            const stripped = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            parsed = JSON.parse(stripped);
        } catch (_) {
            parsed = { reply: rawText, actions: [] };
        }

        return res.status(200).json({
            reply: parsed.reply || 'I could not generate a response.',
            actions: parsed.actions || []
        });

    } catch (err) {
        console.error('POST /ask error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Build a compact, token-efficient summary of all WOHR opportunity data for the AI.
function buildWOHRDataSummary(records) {
    // Split CRM vs Creator so each gets the right shape of summary
    const crmRecords     = records.filter(r => r.source !== 'creator' && (!r.dataType || r.dataType === 'opportunity'));
    const serviceReqs    = records.filter(r => r.dataType === 'service_request');
    const spareQuotes    = records.filter(r => r.dataType === 'spare_quote');

    const total = crmRecords.length;
    const stages = {}, regions = {}, products = {}, sources = {}, owners = {};
    let totalAmt = 0, wonAmt = 0, wonCount = 0, lostCount = 0, activeCount = 0;

    crmRecords.forEach(r => {
        const stage   = r.stage   || 'Unknown';
        const region  = r.region  || 'Unknown';
        const product = r.productType || 'Unknown';
        const source  = r.leadSource  || 'Unknown';
        const owner   = r.leadOwner   || 'Unknown';
        const amt     = r.amount || 0;

        if (!stages[stage])   stages[stage]   = { count: 0, amount: 0 };
        stages[stage].count++;  stages[stage].amount += amt;

        if (!regions[region])  regions[region] = { count: 0, amount: 0 };
        regions[region].count++; regions[region].amount += amt;

        if (!products[product]) products[product] = { count: 0, amount: 0 };
        products[product].count++; products[product].amount += amt;

        if (!sources[source]) sources[source] = { count: 0 };
        sources[source].count++;

        if (!owners[owner]) owners[owner] = { count: 0, won: 0, amount: 0 };
        owners[owner].count++;

        if (stage === 'Closed Won')  { wonCount++;  wonAmt += amt; owners[owner].won++; owners[owner].amount += amt; }
        if (stage === 'Closed Lost') { lostCount++; }
        if (!['Closed Won','Closed Lost'].includes(stage)) activeCount++;
        totalAmt += amt;
    });

    const totalClosed = wonCount + lostCount;
    const winRate = totalClosed ? Math.round(wonCount / totalClosed * 100) : 0;

    const fmt = fmtINR;
    const lines = (obj, valFn) => Object.entries(obj).sort((a,b)=>b[1].count-a[1].count)
        .map(([k,v]) => `  ${k}: ${v.count} deals${valFn ? ' ('+valFn(v)+')' : ''}`).join('\n');

    const topOwners = Object.entries(owners).sort((a,b)=>b[1].count-a[1].count).slice(0,10)
        .map(([o,v]) => `  ${o}: ${v.count} deals, ${v.won} won (${fmt(v.amount)})`).join('\n');

    const topDeals = [...records].filter(r => r.stage === 'Closed Won')
        .sort((a,b)=>(b.amount||0)-(a.amount||0)).slice(0,10)
        .map((r,i) => `  ${i+1}. ${r.name} — ${fmt(r.amount)} | ${r.region} | ${r.productType}`).join('\n');

    // ── Creator-side summary (Service Requests + Spare Quotes) ──
    const srByStatus = {}, srByRegion = {}, srByContract = {}, srByTech = {};
    serviceReqs.forEach(r => {
        const st = r.status || 'Unknown';
        const rg = r.region || 'Unknown';
        const ct = r.serviceContractType || 'Unknown';
        const tc = r.technicianName       || 'Unknown';
        srByStatus[st]   = (srByStatus[st]   || 0) + 1;
        srByRegion[rg]   = (srByRegion[rg]   || 0) + 1;
        srByContract[ct] = (srByContract[ct] || 0) + 1;
        srByTech[tc]     = (srByTech[tc]     || 0) + 1;
    });
    const srLines = (obj) => Object.entries(obj).sort((a,b)=>b[1]-a[1])
        .map(([k,v]) => `  ${k}: ${v}`).join('\n');
    const topTechs = Object.entries(srByTech).sort((a,b)=>b[1]-a[1]).slice(0,5)
        .map(([k,v]) => `  ${k}: ${v} requests`).join('\n');

    const spByStatus = {}, spByApproval = {}, spBySalesPerson = {};
    spareQuotes.forEach(r => {
        spByStatus[r.status || 'Unknown']             = (spByStatus[r.status || 'Unknown']             || 0) + 1;
        spByApproval[r.approvalStatus || 'Unknown']   = (spByApproval[r.approvalStatus || 'Unknown']   || 0) + 1;
        spBySalesPerson[r.salesPersonName || 'Unknown'] = (spBySalesPerson[r.salesPersonName || 'Unknown'] || 0) + 1;
    });

    const creatorBlock = (serviceReqs.length || spareQuotes.length) ? `

=== CREATOR (POST-SALE SERVICE OPS) ===
OPEN SERVICE REQUESTS: ${serviceReqs.length}
${serviceReqs.length ? `BY STATUS:
${srLines(srByStatus)}

BY REGION:
${srLines(srByRegion)}

BY CONTRACT TYPE:
${srLines(srByContract)}

TOP 5 TECHNICIANS BY OPEN REQUESTS:
${topTechs}` : ''}

SPARE QUOTATIONS: ${spareQuotes.length}
${spareQuotes.length ? `BY STATUS:
${srLines(spByStatus)}

BY APPROVAL STATUS:
${srLines(spByApproval)}

BY SALES PERSON:
${srLines(spBySalesPerson)}` : ''}` : '';

    return `=== CRM (SALES PIPELINE) ===
TOTAL OPPORTUNITIES: ${total}
PIPELINE VALUE: ${fmt(totalAmt)} | ACTIVE: ${activeCount} deals
WON: ${wonCount} deals (${fmt(wonAmt)}) | LOST: ${lostCount} deals | WIN RATE: ${winRate}%

BY STAGE:
${lines(stages, v => fmt(v.amount))}

BY REGION:
${lines(regions, v => fmt(v.amount))}

BY PRODUCT TYPE:
${lines(products, v => fmt(v.amount))}

BY LEAD SOURCE:
${lines(sources)}

TOP SALES OWNERS:
${topOwners}

TOP 10 WON DEALS BY VALUE:
${topDeals}${creatorBlock}`;
}

// POST /sarvam-tts — proxy Sarvam TTS (browser can't send custom auth headers via WebSocket)
app.post('/sarvam-tts', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });

  try {
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": "sk_8921n9v1_99j8aAfdt5dyr62Wc2lvS0Qv",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_language_code: "en-IN",
        speaker:              "anushka",
        model:                "bulbul:v2",
        text,
        speech_sample_rate:   24000,
        output_audio_codec:   "linear16",
        enable_preprocessing: false,
        pitch:                0,
        pace:                 1.0,
        loudness:             1.5,
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });

    // Sarvam returns { audios: ["<base64>", ...] }
    const audio = data.audios?.[0] ?? data.audio_content ?? data.audio ?? null;
    if (!audio) return res.status(500).json({ error: "no audio in Sarvam response", raw: data });

    res.json({ audio });
  } catch (err) {
    console.error("POST /sarvam-tts error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET  /pinned-viz?id=SCORECARD_01  — load pinned viz spec
// POST /pinned-viz  { id, spec }    — save pinned viz spec
// DELETE /pinned-viz?id=SCORECARD_01 — remove pinned viz
// ──────────────────────────────────────────────
app.get('/pinned-viz', async (req, res) => {
    try {
        const id = req.query?.id;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const key = `${id}_pinned_viz`;
        const result = await zcql.executeZCQLQuery('SELECT record_id, data FROM dashboard_data');
        if (!result?.length) return res.json({ spec: null });
        const match = result.find(r => {
            const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
            return row?.record_id === key;
        });
        if (!match) return res.json({ spec: null });
        const row = match.dashboard_data || match.DASHBOARD_DATA || Object.values(match)[0];
        return res.json({ spec: JSON.parse(row.data) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/pinned-viz', async (req, res) => {
    try {
        const { id, spec } = req.body;
        if (!id || !spec) return res.status(400).json({ error: 'Missing id or spec' });
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const key = `${id}_pinned_viz`;
        const esc = JSON.stringify(spec).replace(/'/g, "''");
        try { await zcql.executeZCQLQuery(`DELETE FROM dashboard_data WHERE record_id = '${key}'`); } catch (_) {}
        await zcql.executeZCQLQuery(`INSERT INTO dashboard_data (record_id, data) VALUES ('${key}', '${esc}')`);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/pinned-viz', async (req, res) => {
    try {
        const id = req.query?.id;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const key = `${id}_pinned_viz`;
        await zcql.executeZCQLQuery(`DELETE FROM dashboard_data WHERE record_id = '${key}'`);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = app;