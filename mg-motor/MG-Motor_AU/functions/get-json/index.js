
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

//         const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCso5BkK-NOVapxKczSfyOm_IHsk7LbH3U';
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
//             `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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

const express    = require('express');
const catalyst   = require('zcatalyst-sdk-node');
const cors       = require('cors');
const XLSX       = require('xlsx');
const nodemailer = require('nodemailer');

// ── Environment configuration ──────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-3-flash-preview';
const BASE_URL       = process.env.BASE_URL        || '';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// ──────────────────────────────────────────────
// AUTH HELPERS  (Catalyst native auth)
// Roles come directly from the Catalyst project roles assigned in the console.
// App Administrator role ID → admin | App User role ID → dealer
// ──────────────────────────────────────────────

const CATALYST_ADMIN_ROLE_ID = '27414000000142433'; // "App Administrator"

const catalystRole = (cu) =>
    cu?.role_details?.role_id === CATALYST_ADMIN_ROLE_ID ? 'admin' : 'dealer';

// Middleware: verifies the caller is an admin.
// Primary check: Catalyst App Administrator role_id on the user object.
// Fallback: look up the email in the app's own users DataStore table.
// The fallback handles local-dev quirks where getCurrentUser() returns
// different role_details on POST vs GET requests.
const requireCatalystAdmin = async (req, res, next) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const cu = await catalystApp.userManagement().getCurrentUser();

        // Primary: Catalyst application role
        if (catalystRole(cu) === 'admin') {
            req.currentUser = { email: cu.email_id, role: 'admin' };
            return next();
        }

        // Fallback: app users table
        if (cu?.email_id) {
            const zcql = catalystApp.zcql();
            const safe = cu.email_id.replace(/'/g, "''");
            const rows = await zcql.executeZCQLQuery(
                `SELECT role FROM users WHERE email = '${safe}' LIMIT 1`
            );
            const row = (rows || [])[0];
            const appRole = row?.users?.role || row?.USERS?.role;
            if (appRole === 'admin') {
                req.currentUser = { email: cu.email_id, role: 'admin' };
                return next();
            }
        }

        return res.status(403).json({ error: 'Admin access required' });
    } catch {
        return res.status(401).json({ error: 'Not authenticated' });
    }
};

// ──────────────────────────────────────────────
// GET /me  — returns the logged-in user's email, name and role
// Role is determined by the Catalyst project role assigned in the console.
// ──────────────────────────────────────────────
app.get('/me', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const cu   = await catalystApp.userManagement().getCurrentUser();
        const role = catalystRole(cu);
        return res.json({
            email: cu.email_id,
            name:  `${cu.first_name || ''} ${cu.last_name || ''}`.trim() || cu.email_id,
            role,
        });
    } catch {
        return res.status(401).json({ error: 'Not authenticated' });
    }
});

// ──────────────────────────────────────────────
// POST /create-user  (admin only)
// Body: { email, name, role }
// ──────────────────────────────────────────────
app.post('/create-user', requireCatalystAdmin, async (req, res) => {
    try {
        const { email, name, role } = req.body;
        if (!email || !name || !role) {
            return res.status(400).json({ error: 'email, name and role are required' });
        }
        if (!['admin', 'dealer'].includes(role)) {
            return res.status(400).json({ error: 'role must be admin or dealer' });
        }
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const safeEmail = email.trim().toLowerCase().replace(/'/g, "''");
        const existing  = await zcql.executeZCQLQuery(
            `SELECT email FROM users WHERE email = '${safeEmail}'`
        );
        if (existing && existing.length > 0) {
            return res.status(409).json({ error: 'A user with this email already exists' });
        }
        const safeName = (name || '').replace(/'/g, "''");
        const safeRole = role.replace(/'/g, "''");
        await zcql.executeZCQLQuery(
            `INSERT INTO users (email, password_hash, name, role) VALUES ('${safeEmail}', '', '${safeName}', '${safeRole}')`
        );
        return res.status(201).json({ message: `User ${safeEmail} registered`, role });
    } catch (err) {
        console.error('POST /create-user error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// GET /list-users  (admin only)
// Returns all Catalyst project users with their app role derived from Catalyst role.
// ──────────────────────────────────────────────
app.get('/list-users', requireCatalystAdmin, async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const allUsers = await catalystApp.userManagement().getAllUsers();
        const users = (allUsers || []).map(u => ({
            email:     u.email_id,
            name:      `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email_id,
            role:      catalystRole(u),
            userId:    u.user_id,
            createdAt: u.created_time,
        }));
        return res.status(200).json({ users });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// DELETE /delete-user?email=x  (admin only)
// ──────────────────────────────────────────────
app.delete('/delete-user', requireCatalystAdmin, async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: 'email query param required' });
        if (email.toLowerCase() === req.currentUser.email) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        await zcql.executeZCQLQuery(`DELETE FROM users WHERE email = '${email.replace(/'/g, "''")}'`);
        return res.status(200).json({ message: `User ${email} removed` });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// POST /setup-admin  — one-time seed when users table is empty
// Body: { email, name, setupKey }  (no password — Catalyst handles auth)
// ──────────────────────────────────────────────
app.post('/setup-admin', async (req, res) => {
    try {
        const { email, name, setupKey } = req.body;
        const expectedKey = process.env.SETUP_KEY;
        if (setupKey !== expectedKey) return res.status(403).json({ error: 'Invalid setup key' });
        if (!email) return res.status(400).json({ error: 'email is required' });

        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const existing = await zcql.executeZCQLQuery('SELECT email FROM users');
        if (existing && existing.length > 0) {
            return res.status(409).json({ error: 'Setup already done — users exist' });
        }

        const safeEmail = (email || '').trim().toLowerCase().replace(/'/g, "''");
        const safeName  = (name  || 'Admin').replace(/'/g, "''");
        await zcql.executeZCQLQuery(
            `INSERT INTO users (email, password_hash, name, role) VALUES ('${safeEmail}', '', '${safeName}', 'admin')`
        );
        return res.status(201).json({ message: 'Admin registered. You can now log in.' });
    } catch (err) {
        console.error('POST /setup-admin error:', err);
        return res.status(500).json({ error: err.message });
    }
});

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

// Normalise dealer name for fuzzy matching — strips legal suffixes, punctuation,
// and redundant words so "ABC Motors Pty Ltd" matches "ABC Motors"
const normalizeDealer = (name) => {
    if (!name) return '';
    return String(name)
        .toLowerCase()
        .replace(/\b(pty\.?\s*ltd\.?|pty|p\/l|ltd\.?|inc\.?|llc|plc|co\.?\s*ltd\.?|incorporated|limited|australia|group|holdings|automotive|dealership|dealer)\b/g, '')
        .replace(/['''\-&,\./\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const hasValue = (v) =>
    v !== null && v !== undefined && v !== '#N/A' && v !== '' && v !== '0' && Number(v) !== 0;

// ── Date parsing ──────────────────────────────────────────────────────────────
// Handles: native Date, "Jan-25", "Jan 25", "Jan 2025", "January 2025",
//          "01/2025", "2025-01", and generic ISO strings.
const parseCellDate = (v) => {
    if (v instanceof Date) return v;
    const s = String(v).trim();

    // "Jan-25" / "Jan/25" / "Jan 25" — 3-letter month + 2-digit year
    const mmmYY = s.match(/^([A-Za-z]{3})[-\/\s](\d{2})$/);
    if (mmmYY) {
        const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(mmmYY[1].toLowerCase());
        if (mi >= 0) return new Date(2000 + parseInt(mmmYY[2], 10), mi, 1);
    }

    // "Jan 2025" / "Jan-2025" / "January 2025" — full or short month + 4-digit year
    const mmmYYYY = s.match(/^([A-Za-z]+)[-\/\s](\d{4})$/);
    if (mmmYYYY) {
        const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
        const mi = MONTHS.findIndex(m => m.startsWith(mmmYYYY[1].toLowerCase()));
        if (mi >= 0) return new Date(parseInt(mmmYYYY[2], 10), mi, 1);
    }

    // "01/2025" or "1/2025" — MM/YYYY
    const mmYYYY = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (mmYYYY) return new Date(parseInt(mmYYYY[2], 10), parseInt(mmYYYY[1], 10) - 1, 1);

    // "2025-01" — YYYY-MM
    const yyyyMM = s.match(/^(\d{4})-(\d{2})$/);
    if (yyyyMM) return new Date(parseInt(yyyyMM[1], 10), parseInt(yyyyMM[2], 10) - 1, 1);

    // Generic fallback (handles full ISO dates, etc.)
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
};

// ── Sheet layout auto-detection ───────────────────────────────────────────────
// Scans rows 0-2 for date-like values to detect: which row has month headers,
// which columns they're in, the step between them, and where data rows begin.
// This replaces hardcoded step/startCol assumptions, so any variation of the
// scorecard file structure works without code changes.
const detectLayout = (rows) => {
    for (let hr = 0; hr <= Math.min(2, rows.length - 1); hr++) {
        const row = rows[hr] || [];
        const dateCols = [];
        for (let col = 0; col < row.length; col++) {
            const v = row[col];
            if (!v) continue;
            try {
                const d = parseCellDate(v);
                if (d && !isNaN(d.getTime())) dateCols.push(col);
            } catch (_) {}
        }
        if (dateCols.length > 0) {
            const step = dateCols.length >= 2 ? (dateCols[1] - dateCols[0]) : 2;
            return { headerRow: hr, dateCols, step, dataStartRow: hr + 1 };
        }
    }
    return { headerRow: 0, dateCols: [], step: 2, dataStartRow: 2 };
};

// Returns the col index of the latest month that has actual data in the sheet
const findLatestMonthCol = (rows, _step, _startCol) => {
    const { dateCols, dataStartRow } = detectLayout(rows);
    if (dateCols.length === 0) return _startCol || 2;
    let lastDataCol = dateCols[0];
    for (const col of dateCols) {
        if (rows.slice(dataStartRow).some(r => hasValue(r[col + 1]))) lastDataCol = col;
    }
    return lastDataCol;
};

// Returns the col index for a specific YYYY-MM target month, or falls back to latest
const findMonthCol = (rows, _step, _startCol, targetYM) => {
    const { dateCols, headerRow } = detectLayout(rows);
    if (!targetYM) return findLatestMonthCol(rows, _step, _startCol);
    for (const col of dateCols) {
        const v = rows[headerRow][col];
        if (!v) continue;
        try {
            const d = parseCellDate(v);
            if (!d || isNaN(d.getTime())) continue;
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (ym === targetYM) return col;
        } catch (_) {}
    }
    return findLatestMonthCol(rows, _step, _startCol);
};

// Returns all months found in a sheet with per-month dealer data counts
const getAvailableMonths = (rows, _step, _startCol) => {
    const { dateCols, headerRow, dataStartRow } = detectLayout(rows);
    const months = [];
    for (const col of dateCols) {
        const v = rows[headerRow][col];
        if (!v) continue;
        try {
            const d = parseCellDate(v);
            if (!d || isNaN(d.getTime())) continue;
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleString('en-AU', { month: 'short', year: 'numeric' });
            const valueCol = col + 1;
            const dealersWithData = rows.slice(dataStartRow)
                .filter(r => r[valueCol] && r[valueCol] !== '#N/A' && Number(r[valueCol]) !== 0).length;
            months.push({ ym, label, col, dealersWithData });
        } catch (_) {}
    }
    return months;
};

// Returns a human-readable month label for any column — reads the correct header row
const monthLabel = (rows, col) => {
    const { headerRow } = detectLayout(rows);
    const v = rows[headerRow] && rows[headerRow][col];
    if (!v) return 'Latest';
    try {
        const d = parseCellDate(v);
        if (d && !isNaN(d.getTime())) return d.toLocaleString('en-AU', { month: 'short', year: '2-digit' });
    } catch (_) {}
    return String(v);
};

const buildLookup = (rows, keyCol = 1) => {
    const map = {};
    for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        const key     = clean(row[keyCol]);
        const nameKey = 'name:' + clean(row[0]).toLowerCase();
        const normKey = 'norm:' + normalizeDealer(row[0]);
        if (key && key !== '#N/A') map[key]  = row;
        if (nameKey !== 'name:')   map[nameKey] = row;
        if (normKey !== 'norm:')   map[normKey] = row;
    }
    return map;
};

// 3-tier lookup: exact code → exact name → normalised name
// sheet param is used only for logging — it does not affect matching
const lookup = (map, code, name, sheet = '') => {
    // Tier 1: exact dealer code
    if (code && code !== '#N/A' && map[code]) return map[code];
    // Tier 2: exact name (case-insensitive)
    const nameKey = 'name:' + (name || '').toLowerCase();
    if (map[nameKey]) return map[nameKey];
    // Tier 3: normalised name (strips Pty Ltd, punctuation, etc.)
    const normKey = 'norm:' + normalizeDealer(name || '');
    if (normKey !== 'norm:' && map[normKey]) {
        console.info(`[match:fuzzy] "${name}" → normalised match${sheet ? ` in ${sheet}` : ''}`);
        return map[normKey];
    }
    // No match — log so it's visible in Catalyst function logs
    if (name || code) {
        console.warn(`[match:miss] code="${code}" name="${name}"${sheet ? ` sheet=${sheet}` : ''}`);
    }
    return null;
};

// ──────────────────────────────────────────────
// DATA QUALITY CHECK
// ──────────────────────────────────────────────
//
// Thresholds are set based on what a healthy real scorecard actually looks like.
// Some sheets (CX, Google) naturally have lower coverage because NZ dealers and
// A "WARN" status saves but flags the issue to the user.
//
const runQualityCheck = (dealers) => {
    const total = dealers.length;
    const counts = {
        dealers: total,
        sales_actual: 0, sales_target: 0,
        mkt_total: 0, parts_actual: 0, parts_target: 0,
        ci: 0, doty_total: 0,
        cx_score: 0, google_score: 0,
    };
    dealers.forEach(d => {
        const m = d.monthly[0];
        if (m.sales.actual > 0) counts.sales_actual++;
        if (m.sales.target > 0) counts.sales_target++;
        if (m.market.total > 0) counts.mkt_total++;
        if (m.parts.actual > 0) counts.parts_actual++;
        if (m.parts.target > 0) counts.parts_target++;
        if ((m.ci.status && m.ci.status !== 'No') || m.ci.pts > 0) counts.ci++;
        if (m.doty.total > 0) counts.doty_total++;
        if (m.service.score === 'Y' || m.service.response === 'Y') counts.cx_score++;
        if (m.google.score > 0) counts.google_score++;
    });
    const summary = {};
    for (const [field, count] of Object.entries(counts)) {
        summary[field] = field === 'dealers'
            ? count
            : { count, total, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
    }
    return { summary };
};


// ──────────────────────────────────────────────
// CORE PARSER
// ──────────────────────────────────────────────
const parseScorecard = (base64Data, targetMonth = null) => {
    const buf = Buffer.from(base64Data, 'base64');
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });

    // Case-insensitive sheet lookup — tries each name in order, first match wins
    const findSheet = (...names) => {
        const available = wb.SheetNames.map(n => ({ key: n.toLowerCase().trim(), orig: n }));
        for (const name of names) {
            const needle = name.toLowerCase().trim();
            const match = available.find(s => s.key === needle);
            if (match && wb.Sheets[match.orig]) return wb.Sheets[match.orig];
        }
        return null;
    };

    const sheetRows = (...names) => {
        const ws = findSheet(...names);
        if (!ws) {
            console.warn(`[parseScorecard] Sheet not found: ${names.join(' / ')}. Available: ${wb.SheetNames.join(', ')}`);
            return [];
        }
        return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    };

    const dealerListRows = sheetRows('DEALER LIST', 'Dealer List', 'dealer list');
    const salesRows      = sheetRows('SALES', 'Sales');
    const mktRows        = sheetRows('MKT SHARE', 'MKT Share', 'Market Share', 'MKT SHARE');
    const stockRows      = sheetRows('STOCK', 'Stock');
    const partsRows      = sheetRows('PARTS (2)', 'PARTS', 'Parts (2)', 'Parts', 'PARTS(2)', 'Parts(2)');
    const cxRows         = sheetRows('SERVICE CX', 'Service CX', 'SERVICE CX', 'CX', 'SERVICECX');
    const googleRows     = sheetRows('GOOGLE REVIEWS', 'Google Reviews', 'GOOGLE', 'Google');
    const ciRows         = sheetRows('CI', 'Ci');
    const dotyRows       = sheetRows('DOTY', 'Doty');

    const salesMap = buildLookup(salesRows);
    const mktMap = buildLookup(mktRows);
    const stockMap = buildLookup(stockRows);
    const partsMap = buildLookup(partsRows);
    const cxMap = buildLookup(cxRows);
    const googleMap = buildLookup(googleRows, 2);
    const ciMap = buildLookup(ciRows);
    const dotyMap = buildLookup(dotyRows);

    // Use targetMonth (YYYY-MM) if provided, otherwise auto-detect latest
    const salesMonthCol = findMonthCol(salesRows, 2, 2, targetMonth);
    const mktMonthCol = findMonthCol(mktRows, 2, 2, targetMonth);
    const partsMonthCol = findMonthCol(partsRows, 2, 2, targetMonth);
    const stockMonthCol = findLatestMonthCol(stockRows, 3, 2); // stock has no month selector
    const cxMonthCol = findMonthCol(cxRows, 4, 2, targetMonth);

    const dealers = [];

    const mismatches = [];

    for (let i = 1; i < dealerListRows.length; i++) {
        const dl = dealerListRows[i];
        if (!dl || !dl[0]) continue;

        const name = clean(dl[0]);
        const code = clean(dl[1]);
        const region = clean(dl[2]);
        const pma = clean(dl[3]);
        if (!name) continue;

        const sRow  = lookup(salesMap,   code, name, 'SALES');
        const mRow  = lookup(mktMap,     code, name, 'MKT SHARE');
        const stRow = lookup(stockMap,   code, name, 'STOCK');
        const pRow  = lookup(partsMap,   code, name, 'PARTS');
        const cxRow = lookup(cxMap,      code, name, 'SERVICE CX');
        const gRow  = lookup(googleMap,  code, name, 'GOOGLE REVIEWS');
        const ciRow = lookup(ciMap,      code, name, 'CI');
        const dRow  = lookup(dotyMap,    code, name, 'DOTY');

        // Collect sheets where this dealer had no match
        const missed = [
            !sRow  && 'SALES',
            !pRow  && 'PARTS',
            !cxRow && 'SERVICE CX',
            !mRow  && 'MKT SHARE',
            !gRow  && 'GOOGLE REVIEWS',
            !ciRow && 'CI',
            !dRow  && 'DOTY',
        ].filter(Boolean);
        if (missed.length) mismatches.push({ dealer: name, code, missingSheets: missed });

        dealers.push({
            dealer: { name, region, pma },
            meta: { recordId: code || String(i) },
            monthly: [{
                month: monthLabel(salesRows, salesMonthCol),
                sales:   { target: num(sRow?.[salesMonthCol]),  actual: num(sRow?.[salesMonthCol + 1]) },
                market:  { total:  num(mRow?.[mktMonthCol]),    mg:     num(mRow?.[mktMonthCol + 1]) },
                stock:   { ice:    num(stRow?.[stockMonthCol]), hev:    num(stRow?.[stockMonthCol + 1]), bev: num(stRow?.[stockMonthCol + 2]) },
                parts:   { target: num(pRow?.[partsMonthCol]),  actual: num(pRow?.[partsMonthCol + 1]) },
                service: { response: yn(cxRow?.[cxMonthCol]), score: yn(cxRow?.[cxMonthCol + 1]), leadTime: yn(cxRow?.[cxMonthCol + 2]), training: yn(cxRow?.[cxMonthCol + 3]) },
                google:  { score: num(gRow?.[3]),  responses: num(gRow?.[4]) },
                ci:      { status: clean(ciRow?.[2]) || 'No', pts: num(ciRow?.[3]) },
                doty:    { sales: num(dRow?.[3]), aftersales: num(dRow?.[4]), google: num(dRow?.[5]), ci: num(dRow?.[6]), total: num(dRow?.[7]) }
            }]
        });
    }

    return { dealers, mismatches };
};


// ──────────────────────────────────────────────
// POST  /get-months  — parse file, return available months only (no storage)
// ──────────────────────────────────────────────
app.post('/get-months', async (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No file data' });

        const buf = Buffer.from(fileData, 'base64');
        const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });

        const findSheet = (...names) => {
            const available = wb.SheetNames.map(n => ({ key: n.toLowerCase().trim(), orig: n }));
            for (const name of names) {
                const match = available.find(s => s.key === name.toLowerCase().trim());
                if (match && wb.Sheets[match.orig]) return wb.Sheets[match.orig];
            }
            return null;
        };
        const sheetRows = (...names) => {
            const ws = findSheet(...names);
            if (!ws) return [];
            return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
        };

        const salesRows = sheetRows('SALES', 'Sales');
        const cxRows    = sheetRows('SERVICE CX', 'Service CX', 'CX');
        const partsRows = sheetRows('PARTS (2)', 'PARTS', 'Parts (2)', 'Parts', 'PARTS(2)', 'Parts(2)');

        // Build union of all months that appear in Sales (primary source)
        const salesMonths = getAvailableMonths(salesRows, 2, 2).filter(m => m.dealersWithData > 0);
        const cxMonths = getAvailableMonths(cxRows, 4, 2).filter(m => m.dealersWithData > 0);
        const partsMonths = getAvailableMonths(partsRows, 2, 2).filter(m => m.dealersWithData > 0);

        // Annotate each sales month with coverage in other sheets
        const months = salesMonths.map(m => ({
            ym: m.ym,
            label: m.label,
            coverage: {
                sales: m.dealersWithData,
                parts: (partsMonths.find(p => p.ym === m.ym) || {}).dealersWithData || 0,
                cx: (cxMonths.find(p => p.ym === m.ym) || {}).dealersWithData || 0,
            }
        }));

        return res.status(200).json({ months });
    } catch (err) {
        console.error('POST /get-months error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// GET  /list-scorecards  — return all stored scorecard IDs
// ──────────────────────────────────────────────
app.get('/list-scorecards', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        // LIMIT 200 prevents a full-table scan that can hang on Catalyst Data Store.
        // Each scorecard creates ~7 batch rows, so 200 covers ~28 months of data.
        const result = await zcql.executeZCQLQuery('SELECT record_id FROM dashboard_data LIMIT 200');
        const seen = new Set();
        if (result && result.length > 0) {
            result.forEach(r => {
                const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                const rid = row?.record_id || '';
                const newFmt = rid.match(/^(SCORECARD_[A-Z]{3}_\d{4})(?:_batch_\d+)?$/);
                const oldFmt = rid.match(/^(SCORECARD_\d+)(?:_batch_\d+)?$/);
                const m = newFmt || oldFmt;
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
// POST  /process-scorecard  — parse, quality-check, store
// ──────────────────────────────────────────────
app.post('/process-scorecard', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();

        const { fileData } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No file data received' });

        // 1. Parse — use targetMonth if provided
        const targetMonth = req.body.targetMonth || null;
        console.log('Parsing Excel for month:', targetMonth || 'latest');
        const { dealers, mismatches } = parseScorecard(fileData, targetMonth);
        console.log(`Parsed ${dealers.length} dealers, ${mismatches.length} match warnings`);

        // 2. Quality check — informational only, never blocks
        const quality = runQualityCheck(dealers);
        console.log('Quality summary:', JSON.stringify(quality.summary));

        // 3. Derive scorecard ID from selected month: SCORECARD_MAR_2025
        const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        let base;
        if (targetMonth) {
            const [yearStr, monthStr] = targetMonth.split('-');
            const abbr = MONTH_ABBR[parseInt(monthStr, 10) - 1] || monthStr;
            base = `SCORECARD_${abbr}_${yearStr}`;
        } else {
            const m0 = dealers[0]?.monthly?.[0]?.month || 'LATEST';
            base = `SCORECARD_${m0.replace(/[\s']/g, '_').toUpperCase()}`;
        }
        console.log(`Using scorecard ID: ${base}`);

        // 4. Delete existing batch rows for this month (upsert — replaces old data, keeps pinned viz)
        try {
            const toDelete = await zcql.executeZCQLQuery('SELECT record_id FROM dashboard_data');
            if (toDelete && toDelete.length > 0) {
                for (const r of toDelete) {
                    const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                    const rid = row?.record_id || '';
                    if (rid.startsWith(base + '_batch_')) {
                        await zcql.executeZCQLQuery(
                            `DELETE FROM dashboard_data WHERE record_id = '${rid}'`
                        );
                    }
                }
            }
        } catch (e) {
            console.log('Pre-delete step skipped:', e.message);
        }

        // 5. Insert in batches of 5
        for (let i = 0; i < dealers.length; i += 5) {
            const batch = dealers.slice(i, i + 5);
            const esc = JSON.stringify(batch).replace(/'/g, "''");
            await zcql.executeZCQLQuery(
                `INSERT INTO dashboard_data (record_id, data) VALUES ('${base}_batch_${i}', '${esc}')`
            );
        }

        // 6. Return result with quality report, match warnings, and the dashboard link
        return res.status(200).json({
            message: 'Success',
            dealerCount: dealers.length,
            scorecardId: base,
            targetMonth: targetMonth || dealers[0]?.monthly?.[0]?.month || 'Latest',
            quality: quality.summary,
            mismatches: mismatches.length ? mismatches : undefined,
            matchWarningCount: mismatches.length || undefined,
        });

    } catch (err) {
        console.error('POST /process-scorecard error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// POST  /process-all-months  — average all months into annual aggregate
// ──────────────────────────────────────────────
app.post('/process-all-months', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();

        const { fileData } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No file data received' });

        // 1. Discover all available months from SALES sheet
        const buf = Buffer.from(fileData, 'base64');
        const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
        const sheetRows = (name) => {
            const ws = wb.Sheets[name];
            if (!ws) return [];
            return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
        };
        const salesMonths = getAvailableMonths(sheetRows('SALES'), 2, 2).filter(m => m.dealersWithData > 0);
        if (salesMonths.length === 0) {
            return res.status(400).json({ error: 'No months with data found in file' });
        }

        // 2. Parse each month and measure quality
        const monthlyDataSets = [];
        const allMismatches = [];
        for (const month of salesMonths) {
            const { dealers, mismatches } = parseScorecard(fileData, month.ym);
            allMismatches.push(...mismatches);
            const q = runQualityCheck(dealers);
            const keyFields = ['sales_actual', 'sales_target', 'parts_actual', 'cx_score', 'mkt_total'];
            const avgCov = keyFields.reduce((s, f) => s + (q.summary[f]?.pct || 0), 0) / keyFields.length;
            monthlyDataSets.push({ ym: month.ym, label: month.label, dealers, avgCov });
        }

        // 3. Compute overall coverage (informational only — no blocking)
        const overallCov = Math.round(
            monthlyDataSets.reduce((s, m) => s + m.avgCov, 0) / monthlyDataSets.length
        );

        // 4. Merge all months per dealer — average numerics, majority-vote Y/N
        const avgNum = (vals) => {
            const pos = vals.filter(v => v > 0);
            if (!pos.length) return 0;
            return Math.round(pos.reduce((a, b) => a + b, 0) / pos.length);
        };
        const majorityYN = (vals) => vals.filter(v => v === 'Y').length >= vals.length / 2 ? 'Y' : 'N';

        const dealerMap = {};
        for (const { dealers } of monthlyDataSets) {
            for (const d of dealers) {
                const key = d.meta.recordId || d.dealer.name;
                if (!dealerMap[key]) dealerMap[key] = { dealer: d.dealer, meta: d.meta, months: [] };
                dealerMap[key].months.push(d.monthly[0]);
            }
        }

        const mergedDealers = Object.values(dealerMap).map(({ dealer, meta, months }) => ({
            dealer, meta,
            monthly: [{
                month: 'Annual Average',
                sales:   { target: avgNum(months.map(m => m.sales.target)),   actual: avgNum(months.map(m => m.sales.actual)) },
                market:  { total:  avgNum(months.map(m => m.market.total)),   mg:     avgNum(months.map(m => m.market.mg)) },
                stock:   { ice:    avgNum(months.map(m => m.stock.ice)),      hev:    avgNum(months.map(m => m.stock.hev)),  bev: avgNum(months.map(m => m.stock.bev)) },
                parts:   { target: avgNum(months.map(m => m.parts.target)),   actual: avgNum(months.map(m => m.parts.actual)) },
                service: {
                    response: majorityYN(months.map(m => m.service.response)),
                    score:    majorityYN(months.map(m => m.service.score)),
                    leadTime: majorityYN(months.map(m => m.service.leadTime)),
                    training: majorityYN(months.map(m => m.service.training))
                },
                google:  { score: avgNum(months.map(m => m.google.score)),    responses: avgNum(months.map(m => m.google.responses)) },
                ci:      { status: months[months.length - 1].ci.status,       pts: avgNum(months.map(m => m.ci.pts)) },
                doty:    {
                    sales:      avgNum(months.map(m => m.doty.sales)),
                    aftersales: avgNum(months.map(m => m.doty.aftersales)),
                    google:     avgNum(months.map(m => m.doty.google)),
                    ci:         avgNum(months.map(m => m.doty.ci)),
                    total:      avgNum(months.map(m => m.doty.total))
                }
            }]
        }));

        // 5. ID: SCORECARD_AVG_<latest year>
        const latestYear = Math.max(...salesMonths.map(m => parseInt(m.ym.split('-')[0])));
        const base = `SCORECARD_AVG_${latestYear}`;

        // 6. Delete old rows for this ID
        try {
            const existing = await zcql.executeZCQLQuery('SELECT record_id FROM dashboard_data LIMIT 200');
            for (const r of (existing || [])) {
                const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                const rid = row?.record_id || '';
                if (rid.startsWith(base + '_batch_')) {
                    await zcql.executeZCQLQuery(`DELETE FROM dashboard_data WHERE record_id = '${rid}'`);
                }
            }
        } catch (e) { console.log('Pre-delete skipped:', e.message); }

        // 7. Store in batches of 5
        for (let i = 0; i < mergedDealers.length; i += 5) {
            const batch = mergedDealers.slice(i, i + 5);
            const esc = JSON.stringify(batch).replace(/'/g, "''");
            await zcql.executeZCQLQuery(
                `INSERT INTO dashboard_data (record_id, data) VALUES ('${base}_batch_${i}', '${esc}')`
            );
        }

        const quality = runQualityCheck(mergedDealers);
        // Deduplicate mismatches across months (same dealer missing same sheet)
        const seenMismatch = new Set();
        const uniqueMismatches = allMismatches.filter(m => {
            const key = `${m.code}|${m.dealer}|${m.missingSheets.join(',')}`;
            if (seenMismatch.has(key)) return false;
            seenMismatch.add(key);
            return true;
        });
        return res.status(200).json({
            message: 'Success',
            dealerCount: mergedDealers.length,
            scorecardId: base,
            monthCount: salesMonths.length,
            coverage: overallCov,
            months: monthlyDataSets.map(m => ({ ym: m.ym, label: m.label, coverage: Math.round(m.avgCov) })),
            quality: quality.summary,
            mismatches: uniqueMismatches.length ? uniqueMismatches : undefined,
            matchWarningCount: uniqueMismatches.length || undefined,
        });

    } catch (err) {
        console.error('POST /process-all-months error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// SMTP transporter (Gmail)
// ──────────────────────────────────────────────
const mailer = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// ──────────────────────────────────────────────
// POST  /send-email  — send dashboard report
// ──────────────────────────────────────────────
app.post('/send-email', async (req, res) => {
    try {
        const { to, toName, subject, format, pdfBase64, captureTab, recordId, dealers, dashboardMonth, currentState } = req.body;
        if (!to)      return res.status(400).json({ error: 'Recipient email is required' });
        if (!dealers) return res.status(400).json({ error: 'No dealer data provided' });

        const sendFormat   = format === 'pdf' ? 'pdf' : 'link';
        const baseUrl      = BASE_URL;
        // Link points to the specific scorecard dashboard, not the generic app root
        const dashboardUrl = recordId
            ? `${baseUrl}/app/${recordId}`
            : `${baseUrl}/app/index.html`;
        const month        = dashboardMonth || 'Latest';
        const region       = currentState?.region || 'All Regions';
        const total        = dealers.length;
        const dateStr      = new Date().toLocaleDateString('en-AU', { timeZone:'Australia/Sydney', day:'numeric', month:'short', year:'numeric' });
        const timeStr      = new Date().toLocaleString('en-AU', { timeZone:'Australia/Sydney' });

        // KPI aggregates
        const totalSalesA = dealers.reduce((s,d) => s+(d.salesActual||0), 0);
        const totalSalesT = dealers.reduce((s,d) => s+(d.salesTarget||0), 0);
        const totalMktMG  = dealers.reduce((s,d) => s+(d.mktMG||0), 0);
        const totalMktTot = dealers.reduce((s,d) => s+(d.mktTotal||0), 0);
        const totalParts  = dealers.reduce((s,d) => s+(d.partsActual||0), 0);
        const achPct      = totalSalesT ? Math.round(totalSalesA/totalSalesT*100) : 0;
        const mktPct      = totalMktTot ? (totalMktMG/totalMktTot*100).toFixed(1) : '0.0';
        const achColor    = achPct>=100 ? '#22C55E' : achPct>=80 ? '#F59E0B' : '#EF4444';
        const achLabel    = achPct>=100 ? 'On Target' : achPct>=80 ? 'Near Target' : 'Below Target';

        // Top 5 dealers
        const top5 = [...dealers].sort((a,b)=>(b.salesActual||0)-(a.salesActual||0)).slice(0,5);
        const top5Rows = top5.map((d,i) => `
            <tr style="background:${i%2===0?'#161616':'#121212'}">
              <td style="padding:9px 14px;font-size:12px;color:#ccc;border-bottom:1px solid #1e1e1e">${d.name}</td>
              <td style="padding:9px 14px;font-size:11px;color:#666;border-bottom:1px solid #1e1e1e">${d.region||'-'}</td>
              <td style="padding:9px 14px;font-size:13px;font-weight:700;color:#C8102E;text-align:right;border-bottom:1px solid #1e1e1e">${d.salesActual||0}</td>
              <td style="padding:9px 14px;font-size:11px;color:#555;text-align:right;border-bottom:1px solid #1e1e1e">${d.salesTarget||0}</td>
            </tr>`).join('');

        // Tab metadata for PDF page listing
        const ALL_TABS = [
            { key:'overview',   icon:'📊', label:'Executive Overview',  desc:'Network health index, top 12 dealers, sales distribution, regional breakdown' },
            { key:'sales',      icon:'📈', label:'Sales & Market',       desc:'Achievement rankings, market share analysis, bottom performers' },
            { key:'aftersales', icon:'🔧', label:'Aftersales & CX',      desc:'Parts revenue, customer experience compliance, service metrics' },
            { key:'network',    icon:'🌐', label:'Network & Google',      desc:'Google ratings scatter, Corporate Identity status, CI leaderboard' },
            { key:'doty',       icon:'🏆', label:'DOTY Leaderboard',      desc:'Dealer of the Year points, category breakdown, top 3 medal positions' },
        ];
        const pdfTabs = captureTab ? ALL_TABS.filter(t => t.key === captureTab) : ALL_TABS;

        // ── PDF delivery card ──────────────────────────────────────────────
        const pdfPageRows = pdfTabs.map((t,i) => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #222;vertical-align:top">
                <table width="100%" cellpadding="0" cellspacing="0"><tr>
                  <td style="width:28px;font-size:16px;vertical-align:top;padding-top:1px">${t.icon}</td>
                  <td>
                    <div style="font-size:13px;font-weight:600;color:#e0e0e0">${t.label}</div>
                    <div style="font-size:11px;color:#555;margin-top:2px">${t.desc}</div>
                  </td>
                  <td style="width:40px;text-align:right;vertical-align:top">
                    <span style="font-size:10px;color:#333;background:#1e1e1e;padding:2px 7px;border-radius:4px">p.${i+1}</span>
                  </td>
                </tr></table>
              </td>
            </tr>`).join('');

        const pdfDeliveryCard = `
        <div style="background:#141414;border:1px solid #2a2a2a;border-left:3px solid #C8102E;border-radius:10px;overflow:hidden;margin-bottom:8px">
          <div style="padding:16px 20px;background:#1a1a1a;border-bottom:1px solid #222;display:flex;align-items:center">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <div style="font-size:14px;font-weight:700;color:#fff">📄 PDF Report Attached</div>
                <div style="font-size:11px;color:#555;margin-top:3px">mg-dashboard-${month.replace(/\s/g,'-').toLowerCase()}.pdf</div>
              </td>
              <td style="text-align:right">
                <span style="font-size:10px;font-weight:700;color:#C8102E;background:#C8102E1a;padding:4px 10px;border-radius:20px;border:1px solid #C8102E33">
                  ${pdfTabs.length} page${pdfTabs.length>1?'s':''}
                </span>
              </td>
            </tr></table>
          </div>
          <div style="padding:4px 20px 8px">
            <div style="font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1.5px;padding:12px 0 6px">
              ${captureTab ? 'Included tab:' : `All ${pdfTabs.length} dashboard tabs:`}
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">${pdfPageRows}</table>
          </div>
        </div>`;

        // ── Link delivery card ─────────────────────────────────────────────
        const linkDeliveryCard = `
        <div style="background:#141414;border:1px solid #2a2a2a;border-left:3px solid #3B82F6;border-radius:10px;padding:20px;text-align:center;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600;color:#3B82F6;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px">🔗 Live Dashboard Link</div>
          <a href="${dashboardUrl}" style="display:inline-block;background:#C8102E;color:#fff;font-weight:700;font-size:14px;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.5px">
            Open Live Dashboard →
          </a>
          <div style="margin-top:12px;font-size:10px;color:#333;word-break:break-all">${dashboardUrl}</div>
          <div style="margin-top:8px;font-size:11px;color:#444">Updates in real-time &nbsp;·&nbsp; All 5 tabs accessible &nbsp;·&nbsp; Requires authorised access</div>
        </div>`;

        // ── Build full HTML ────────────────────────────────────────────────
        const greeting = toName ? `Hi ${toName},` : 'Hi,';
        const introText = sendFormat === 'pdf'
            ? `Please find the MG Motor Australia Dealer Performance Centre report for <strong style="color:#ccc">${month}</strong> attached to this email as a PDF.`
            : `Your live MG Motor Australia Dealer Performance Centre dashboard for <strong style="color:#ccc">${month}</strong> is ready to view.`;

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px 8px;background:#080808;font-family:'Segoe UI',Arial,sans-serif;color:#e0e0e0">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto">

  <!-- ── HEADER ── -->
  <tr><td style="background:linear-gradient(135deg,#C8102E 0%,#9a0c1e 55%,#5a0008 100%);padding:28px 32px;border-radius:14px 14px 0 0">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="font-size:10px;letter-spacing:4px;color:rgba(255,180,180,0.9);text-transform:uppercase;margin-bottom:5px">MG Motor Australia</div>
        <div style="font-size:23px;font-weight:800;color:#fff;letter-spacing:-0.3px">Dealer Performance Centre</div>
        <div style="font-size:13px;color:rgba(255,200,200,0.75);margin-top:5px">Performance Analytics Report &mdash; ${month}</div>
      </td>
      <td style="text-align:right;vertical-align:middle">
        <div style="width:52px;height:52px;background:rgba(255,255,255,0.13);border:2px solid rgba(255,255,255,0.22);border-radius:50%;display:inline-block;text-align:center;line-height:52px;font-size:18px;font-weight:900;color:rgba(255,255,255,0.85);font-family:Georgia,serif">MG</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- ── CONTEXT BAR ── -->
  <tr><td style="background:#1a1a1a;padding:10px 32px;border-bottom:1px solid #252525">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="font-size:11px;color:#555">
        Region:&nbsp;<strong style="color:#aaa">${region}</strong>
        &nbsp;&middot;&nbsp;Dealers:&nbsp;<strong style="color:#aaa">${total}</strong>
        &nbsp;&middot;&nbsp;Format:&nbsp;<strong style="color:${sendFormat==='pdf'?'#C8102E':'#3B82F6'}">${sendFormat==='pdf'?'PDF Report':'Live Link'}</strong>
      </span></td>
      <td style="text-align:right"><span style="font-size:10px;color:#333">${dateStr}</span></td>
    </tr></table>
  </td></tr>

  <!-- ── GREETING + DELIVERY TYPE ── -->
  <tr><td style="background:#0f0f0f;padding:28px 32px">
    <div style="font-size:16px;font-weight:600;color:#e0e0e0;margin-bottom:6px">${greeting}</div>
    <div style="font-size:13px;color:#777;line-height:1.7;margin-bottom:22px">${introText}</div>
    ${sendFormat === 'pdf' ? pdfDeliveryCard : linkDeliveryCard}
  </td></tr>

  <!-- ── DIVIDER ── -->
  <tr><td style="padding:0 32px;background:#0f0f0f">
    <div style="height:1px;background:linear-gradient(to right,transparent,#2a2a2a 30%,#2a2a2a 70%,transparent)"></div>
  </td></tr>

  <!-- ── SNAPSHOT HEADER ── -->
  <tr><td style="background:#0f0f0f;padding:20px 32px 8px">
    <div style="font-size:10px;font-weight:700;color:#C8102E;letter-spacing:2px;text-transform:uppercase">Performance Snapshot &mdash; ${month}</div>
    <div style="font-size:11px;color:#444;margin-top:4px">${region} &middot; ${total} active dealers</div>
  </td></tr>

  <!-- ── KPI CARDS ── -->
  <tr><td style="background:#0f0f0f;padding:8px 32px 20px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:25%;padding:0 4px 0 0">
          <div style="background:#141414;border:1px solid #252525;border-top:2px solid #C8102E;border-radius:8px;padding:14px 16px">
            <div style="font-size:9px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1.5px">Sales Volume</div>
            <div style="font-size:24px;font-weight:800;color:#C8102E;margin:6px 0;line-height:1">${totalSalesA.toLocaleString()}</div>
            <div style="font-size:10px;color:#444">of ${totalSalesT.toLocaleString()} target</div>
            <div style="margin-top:8px;height:3px;background:#1e1e1e;border-radius:2px;overflow:hidden">
              <div style="width:${Math.min(achPct,100)}%;height:100%;background:${achColor};border-radius:2px"></div>
            </div>
            <div style="font-size:10px;font-weight:700;color:${achColor};margin-top:4px">${achPct}% &middot; ${achLabel}</div>
          </div>
        </td>
        <td style="width:25%;padding:0 4px">
          <div style="background:#141414;border:1px solid #252525;border-top:2px solid #3B82F6;border-radius:8px;padding:14px 16px">
            <div style="font-size:9px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1.5px">Market Share</div>
            <div style="font-size:24px;font-weight:800;color:#3B82F6;margin:6px 0;line-height:1">${mktPct}%</div>
            <div style="font-size:10px;color:#444">${totalMktMG.toLocaleString()} MG of ${totalMktTot.toLocaleString()} TIV</div>
          </div>
        </td>
        <td style="width:25%;padding:0 4px">
          <div style="background:#141414;border:1px solid #252525;border-top:2px solid #14B8A6;border-radius:8px;padding:14px 16px">
            <div style="font-size:9px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1.5px">Parts Revenue</div>
            <div style="font-size:24px;font-weight:800;color:#14B8A6;margin:6px 0;line-height:1">$${Math.round(totalParts/1000)}k</div>
            <div style="font-size:10px;color:#444">Actual this month</div>
          </div>
        </td>
        <td style="width:25%;padding:0 0 0 4px">
          <div style="background:#141414;border:1px solid #252525;border-top:2px solid #8B5CF6;border-radius:8px;padding:14px 16px">
            <div style="font-size:9px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1.5px">Network</div>
            <div style="font-size:24px;font-weight:800;color:#8B5CF6;margin:6px 0;line-height:1">${total}</div>
            <div style="font-size:10px;color:#444">Active dealers</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ── TOP 5 TABLE ── -->
  <tr><td style="background:#0f0f0f;padding:0 32px 24px">
    <div style="font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">Top 5 Dealers by Sales</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #1e1e1e">
      <thead>
        <tr style="background:#1a1a1a">
          <th style="padding:9px 14px;font-size:10px;font-weight:700;color:#555;text-align:left;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #222">Dealer</th>
          <th style="padding:9px 14px;font-size:10px;font-weight:700;color:#555;text-align:left;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #222">Region</th>
          <th style="padding:9px 14px;font-size:10px;font-weight:700;color:#555;text-align:right;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #222">Actual</th>
          <th style="padding:9px 14px;font-size:10px;font-weight:700;color:#555;text-align:right;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #222">Target</th>
        </tr>
      </thead>
      <tbody>${top5Rows}</tbody>
    </table>
  </td></tr>

  <!-- ── FOOTER ── -->
  <tr><td style="background:#0a0a0a;padding:18px 32px;border-radius:0 0 14px 14px;border-top:1px solid #1a1a1a">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="font-size:11px;color:#333">Sent from <strong style="color:#444">MG Motor Australia Dealer Performance Centre</strong></div>
        <div style="font-size:10px;color:#252525;margin-top:3px">${timeStr} AEST &middot; Authorised distribution only</div>
      </td>
      <td style="text-align:right;vertical-align:middle">
        <div style="font-size:14px;font-weight:900;color:#2a2a2a;font-family:Georgia,serif;letter-spacing:1px">MG</div>
      </td>
    </tr></table>
  </td></tr>

</table>
</body></html>`;

        const finalSubject = subject || (sendFormat === 'pdf'
            ? `MG Dashboard PDF${captureTab ? ` — ${ALL_TABS.find(t=>t.key===captureTab)?.label||captureTab}` : ' — All Tabs'} · ${region} · ${month}`
            : `MG Network Dashboard — ${region} · ${month}`);

        const greeting2 = toName ? `Hi ${toName},` : 'Hi,';
        const plainText = `${greeting2}\n\nMG Motor Australia — Dealer Performance Centre\nMonth: ${month} | Region: ${region} | Dealers: ${total}\n\nSales: ${totalSalesA}/${totalSalesT} (${achPct}% achieved)\nMarket Share: ${mktPct}% | Parts: $${Math.round(totalParts/1000)}k\n\n${
            sendFormat === 'pdf'
                ? `PDF attached — ${pdfTabs.length} page(s): ${pdfTabs.map(t=>t.label).join(', ')}`
                : `Open dashboard: ${dashboardUrl}`
        }\n\n— MG Motor Dealer Performance Centre`;

        const attachments = (sendFormat === 'pdf' && pdfBase64)
            ? [{ filename: `mg-dashboard-${month.replace(/\s/g,'-').toLowerCase()}.pdf`, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }]
            : [];

        await mailer.sendMail({
            from: `"MG Motor Network" <${process.env.SMTP_USER}>`,
            to, subject: finalSubject, html, text: plainText, attachments,
        });

        return res.status(200).json({ success: true, message: `Dashboard report sent to ${to}` });

    } catch (err) {
        console.error('POST /send-email error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Compute available quarters and years from allMonthsData keys (e.g. "Jan 25" → "Q1 2025", "2025")
const buildFilterOptions = (allMonthsData) => {
    const M2Q = { Jan:1,Feb:1,Mar:1,Apr:2,May:2,Jun:2,Jul:3,Aug:3,Sep:3,Oct:4,Nov:4,Dec:4 };
    const qSet = new Set(); const ySet = new Set();
    Object.keys(allMonthsData || {}).forEach(k => {
        const [abbr, yr] = k.split(' ');
        if (abbr && yr && M2Q[abbr]) { qSet.add(`Q${M2Q[abbr]} 20${yr}`); ySet.add(`20${yr}`); }
    });
    return {
        quarters: [...qSet].sort().reverse().join(' | ') || 'none',
        years:    [...ySet].sort().reverse().join(' | ') || 'none',
    };
};

// ─────────────────────────────────────────────────────────────
// POST  /ask-stream  — streaming AI assistant (SSE)
// Streams reply text in real-time so the frontend can display
// text progressively and start TTS after the first sentence.
// ─────────────────────────────────────────────────────────────
app.post('/ask-stream', async (req, res) => {
    // SSE headers — must be set before any write
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    // Close stream cleanly if client disconnects
    let closed = false;
    req.on('close', () => { closed = true; });

    try {
        const { question, dealers, currentState, history, allMonthsData, dashboardMonth } = req.body;

        if (!question) { send({ error: 'No question provided' }); return res.end(); }
        if (!dealers || !dealers.length) { send({ error: 'No dealer data provided' }); return res.end(); }

        const dashSummary = buildDataSummary(dealers, dashboardMonth || 'current');

        let otherMonthsSummary = '';
        if (allMonthsData && Object.keys(allMonthsData).length > 0) {
            const otherMonths = Object.entries(allMonthsData)
                .filter(([month]) => month !== dashboardMonth)
                .map(([month, mDealers]) => {
                    if (!mDealers || !mDealers.length) return '';
                    return `\n--- HISTORICAL DATA: ${month} ---\n${buildDataSummary(mDealers, month)}`;
                }).filter(Boolean).join('\n');
            if (otherMonths) otherMonthsSummary = `\n\nHISTORICAL MONTHS DATA (read-only — do NOT trigger dashboard actions for these months):${otherMonths}`;
        }

        // Output format uses a plain-text reply followed by a separator, which
        // lets us stream the reply to the client immediately without waiting for
        // the whole JSON object to be assembled.
        const systemInstruction = `You are an AI assistant embedded inside the MG Motor Australia dealer network dashboard.
You have full access to all dealer performance data across all uploaded months.

DASHBOARD STATE:
- Current tab: ${currentState.tab}
- Current region filter: ${currentState.region}
- Current PMA filter: ${currentState.pma}
- Current dealer filter: ${currentState.dealer}
- Dashboard month: ${dashboardMonth || 'latest'}

AVAILABLE TABS: overview | sales | aftersales | network | doty
AVAILABLE REGIONS: All Regions | Eastern Region | Southern Region | Northern Region | Central Region | Western Region | North Island NZ | South Island NZ
AVAILABLE PMAS: All PMA | Metro A | Metro B | Provincial | Rural | NZ Metro | NZ Provincial | NZ Rural
AVAILABLE MONTHS: ${Object.keys(allMonthsData || {}).join(' | ') || dashboardMonth || 'none'}
AVAILABLE QUARTERS: ${buildFilterOptions(allMonthsData).quarters}
AVAILABLE YEARS: ${buildFilterOptions(allMonthsData).years}

--- CURRENT DASHBOARD DATA: ${dashboardMonth || 'latest'} ---
${dashSummary}${otherMonthsSummary}

RESPONSE FORMAT — output EXACTLY in this two-part format, nothing else:
<your plain-text answer here, multiple lines allowed>
<<<ACTIONS>>>
{"actions":[...],"crossMonth":false}

EXAMPLES:
Eastern Region achieved 87% of its sales target this month with 142 units sold across 8 dealers.
<<<ACTIONS>>>
{"actions":[{"type":"setRegion","value":"Eastern Region"},{"type":"setTab","value":"sales"}],"crossMonth":false}

Sales were strong across the board.
<<<ACTIONS>>>
{"actions":[],"crossMonth":false}

CRITICAL RULES:
- Your text answer must come FIRST, before <<<ACTIONS>>>.
- Always end with <<<ACTIONS>>> followed by the JSON on the next line.
- actions array may be empty [] but must always be present.
- crossMonth: true only when answering about a historical month (do NOT add dashboard actions in that case).
- Reset a filter: use "All Regions", "All PMA", or "All Dealers".
- Tab routing: sales → "sales", aftersales/parts/CX → "aftersales", google/CI/network → "network", DOTY/rankings → "doty".
- Always use real numbers from the data. Never say "I don't have access".
- DATE FILTER: Use setMonthFilter when the user asks to switch/filter to any time period: exact month (e.g. "Jan 25"), quarter (e.g. "Q4 2025"), or year (e.g. "2025"). Always use exact values from AVAILABLE MONTHS / AVAILABLE QUARTERS / AVAILABLE YEARS.
- EMAIL: If the user wants to send/email/share the dashboard, extract email address AND format ("link" or "pdf"). If format not mentioned, ask before emitting sendEmail. When both known, add: {"type":"sendEmail","to":"...","toName":"...","format":"link|pdf","captureRegion":"...","capturePma":"...","captureDealer":"...","captureTab":"..."}. For captureTab: if the user mentions a specific tab ("send only the DOTY tab", "email the sales report", "just the overview"), set captureTab to the matching key: overview | sales | aftersales | network | doty. Leave captureTab empty to send all 5 tabs.`;

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
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
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
// POST  /ask  — AI assistant (Gemini 2.0 Flash)
// ──────────────────────────────────────────────
app.post('/ask', async (req, res) => {
    try {
        const { question, dealers, currentState, history, allMonthsData, dashboardMonth } = req.body;

        if (!question) return res.status(400).json({ error: 'No question provided' });
        if (!dealers || !dealers.length) return res.status(400).json({ error: 'No dealer data provided' });

        // Build current dashboard month summary
        const dashSummary = buildDataSummary(dealers, dashboardMonth || 'current');

        // Build summaries for all other months if provided
        let otherMonthsSummary = '';
        if (allMonthsData && Object.keys(allMonthsData).length > 0) {
            const otherMonths = Object.entries(allMonthsData)
                .filter(([month]) => month !== dashboardMonth)
                .map(([month, mDealers]) => {
                    if (!mDealers || !mDealers.length) return '';
                    const s = buildDataSummary(mDealers, month);
                    return `\n--- HISTORICAL DATA: ${month} ---\n${s}`;
                })
                .filter(Boolean)
                .join('\n');
            if (otherMonths) otherMonthsSummary = `\n\nHISTORICAL MONTHS DATA (read-only — do NOT trigger dashboard actions for these months):${otherMonths}`;
        }

        const systemInstruction = `You are an AI assistant embedded inside the MG Motor Australia dealer network dashboard.
You have full access to all dealer performance data across all uploaded months.

DASHBOARD STATE:
- Current tab: ${currentState.tab}
- Current region filter: ${currentState.region}
- Current PMA filter: ${currentState.pma}
- Current dealer filter: ${currentState.dealer}
- Dashboard month: ${dashboardMonth || 'latest'}

AVAILABLE TABS: overview | sales | aftersales | network | doty
AVAILABLE REGIONS: All Regions | Eastern Region | Southern Region | Northern Region | Central Region | Western Region | North Island NZ | South Island NZ
AVAILABLE PMAS: All PMA | Metro A | Metro B | Provincial | Rural | NZ Metro | NZ Provincial | NZ Rural
AVAILABLE MONTHS: ${Object.keys(allMonthsData || {}).join(' | ') || dashboardMonth || 'none'}
AVAILABLE QUARTERS: ${buildFilterOptions(allMonthsData).quarters}
AVAILABLE YEARS: ${buildFilterOptions(allMonthsData).years}

--- CURRENT DASHBOARD DATA: ${dashboardMonth || 'latest'} ---
${dashSummary}${otherMonthsSummary}

RESPONSE FORMAT — always respond with ONLY valid JSON, no markdown fences:
{
  "reply": "Your answer with specific numbers and insights",
  "actions": []
}

CRITICAL RULES:
- "reply" is always required. Be specific — use real numbers, dealer names, rankings from the data.
- "actions" is optional array. Only include actions for the CURRENT dashboard month (${dashboardMonth || 'latest'}).
- NEVER emit actions if the user is asking about a different/historical month — just answer in "reply".
- Reset a filter: use "All Regions", "All PMA", or "All Dealers".
- If asked about a dealer → setDealer + go to relevant tab.
- Tab routing: sales → "sales", aftersales/parts/CX → "aftersales", google/CI/network → "network", DOTY/rankings → "doty", general → "overview".
- Always include real numbers. Never say "I don't have access" — the full dataset is above.
- DATE FILTER: Use setMonthFilter when the user asks to switch/filter to any time period: exact month (e.g. "Jan 25"), quarter (e.g. "Q4 2025"), or year (e.g. "2025"). Always use exact values from AVAILABLE MONTHS / AVAILABLE QUARTERS / AVAILABLE YEARS.

ACTION TYPES:
{ "type": "setRegion", "value": "Eastern Region" }
{ "type": "setPma", "value": "Metro A" }
{ "type": "setDealer", "value": "Dealer Name" }
{ "type": "setTab", "value": "sales" }
{ "type": "setMonthFilter", "value": "Jan 25" }  ← exact month from AVAILABLE MONTHS
{ "type": "setMonthFilter", "value": "Q4 2025" } ← quarter from AVAILABLE QUARTERS
{ "type": "setMonthFilter", "value": "2025" }    ← full year from AVAILABLE YEARS
{ "type": "sendEmail", "to": "email@example.com", "toName": "Name", "format": "link or pdf" }
{ "type": "visualize", "spec": { "title": "...", "panels": [...] } }

VISUALIZATION RULES — use "visualize" action whenever user asks to chart, plot, compare, visualize, or show a graph:
- Available chartTypes: "bar", "pie", "table", "kpi", "scatter"
- Available groupBy values: "region", "pma", "dealer"
- Available metrics: salesActual, salesTarget, salesAch, mktMG, mktTotal, mktShare, partsActual, partsTarget, partsAch, googleScore, googleReviews, dotyTotal, dotySales, dotyAftersales, dotyGoogle, dotyCi
- filter object: { "regions": ["Western Region", "Southern Region"], "pmas": ["Metro A"], "dealers": ["Dealer Name"] } — CRITICAL: when user asks to compare or show SPECIFIC regions/PMAs/dealers, you MUST populate the filter with only those items. An empty filter {} means show ALL. Never use empty filter when user named specific regions.
- Always include "sortBy" and "sortDir" for dealer-level charts, and "limit" (max 20 for dealer groupBy)
- For "all dealers" comparisons: groupBy "region" to keep it readable, not groupBy "dealer"

VISUALIZATION EXAMPLES:

User: "Show sales by region as a bar chart"
actions: [{"type":"visualize","spec":{"title":"Sales by Region","panels":[{"id":"p1","chartType":"bar","title":"Sales Actual vs Target","groupBy":"region","filter":{},"metrics":["salesActual","salesTarget"],"sortBy":"salesActual","sortDir":"desc"},{"id":"p2","chartType":"table","title":"Regional Detail","groupBy":"region","filter":{},"metrics":["salesActual","salesTarget","salesAch"],"sortBy":"salesActual","sortDir":"desc"}]}}]

User: "Compare Western Region vs Southern Region sales"
actions: [{"type":"visualize","spec":{"title":"Western vs Southern Region","panels":[{"id":"p1","chartType":"bar","title":"Sales Comparison","groupBy":"region","filter":{"regions":["Western Region","Southern Region"]},"metrics":["salesActual","salesTarget","salesAch"],"sortBy":"salesActual","sortDir":"desc"},{"id":"p2","chartType":"table","title":"Detail","groupBy":"region","filter":{"regions":["Western Region","Southern Region"]},"metrics":["salesActual","salesTarget","salesAch","mktMG","partsActual"],"sortBy":"salesActual","sortDir":"desc"}]}}]

User: "Compare top 15 dealers by DOTY points"
actions: [{"type":"visualize","spec":{"title":"Top 15 Dealers — DOTY Points","panels":[{"id":"p1","chartType":"bar","title":"DOTY Breakdown","groupBy":"dealer","filter":{},"metrics":["dotyTotal","dotySales","dotyAftersales"],"sortBy":"dotyTotal","sortDir":"desc","limit":15},{"id":"p2","chartType":"table","title":"DOTY Detail","groupBy":"dealer","filter":{},"metrics":["dotyTotal","dotySales","dotyAftersales","dotyGoogle","dotyCi"],"sortBy":"dotyTotal","sortDir":"desc","limit":15}]}}]

User: "Market share by region as pie chart"
actions: [{"type":"visualize","spec":{"title":"Market Share by Region","panels":[{"id":"p1","chartType":"pie","title":"MG Market Share","groupBy":"region","filter":{},"metrics":["mktMG"],"sortBy":"mktMG","sortDir":"desc"},{"id":"p2","chartType":"table","title":"Market Detail","groupBy":"region","filter":{},"metrics":["mktMG","mktTotal","mktShare"],"sortBy":"mktMG","sortDir":"desc"}]}}]

- EMAIL: If the user says to send / email / share the dashboard to someone, extract their email address. You MUST also identify the format they want: "link" (just the dashboard URL) or "pdf" (a PDF screenshot). If the user has NOT mentioned which format they want, ask them in your "reply" before emitting the sendEmail action — do NOT emit sendEmail until you know both the recipient AND the format. Once both are known, add a sendEmail action with "to", "toName" (if mentioned), and "format" set to "link" or "pdf". For PDF: if the user says they want the PDF filtered to a specific region, also set "captureRegion". If they mention a specific PMA, set "capturePma". If a specific dealer, set "captureDealer". IMPORTANT — if the user asks to send only a SPECIFIC TAB (e.g. "send only the DOTY tab", "email just the sales report", "send the overview only", "email the network tab"), set "captureTab" to the matching key: overview | sales | aftersales | network | doty. If no specific tab is mentioned, leave captureTab empty and all 5 tabs are included.`;

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
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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

// Build a compact, token-efficient summary of all dealer data for the AI.
// The frontend sends the already-flattened masterList objects (d.name, d.salesActual, etc.)
// so we normalise both shapes here.
function buildDataSummary(dealers) {
    const total = dealers.length;

    // Normalise: handle both raw store shape {dealer:{name}, monthly:[...]}
    // and the flattened frontend shape {name, region, salesActual, ...}
    const norm = dealers.map(d => {
        if (d.dealer) {
            const m = d.monthly?.[0] || {};
            return {
                name: d.dealer.name,
                region: d.dealer.region,
                pma: d.dealer.pma,
                salesActual: m.sales?.actual || 0,
                salesTarget: m.sales?.target || 0,
                mktMG: m.market?.mg || 0,
                mktTotal: m.market?.total || 0,
                partsActual: m.parts?.actual || 0,
                partsTarget: m.parts?.target || 0,
                googleScore: m.google?.score || 0,
                googleResp: m.google?.responses || 0,
                dotyTotal: m.doty?.total || 0,
                ciStatus: m.ci?.status || 'No',
                cxR: m.service?.response || 'N',
                cxS: m.service?.score || 'N',
                cxL: m.service?.leadTime || 'N',
                cxT: m.service?.training || 'N',
            };
        }
        // Flattened frontend shape
        return {
            name: d.name || '',
            region: d.region || '',
            pma: d.pma || '',
            salesActual: d.salesActual || 0,
            salesTarget: d.salesTarget || 0,
            mktMG: d.mktMG || 0,
            mktTotal: d.mktTotal || 0,
            partsActual: d.partsActual || 0,
            partsTarget: d.partsTarget || 0,
            googleScore: d.googleScore || 0,
            googleResp: d.googleResp || 0,
            dotyTotal: d.dotyTotal || 0,
            ciStatus: d.ciStatus || 'No',
            cxR: d.cxResponse ? 'Y' : 'N',
            cxS: d.cxScore ? 'Y' : 'N',
            cxL: d.cxLeadTime ? 'Y' : 'N',
            cxT: d.cxTraining ? 'Y' : 'N',
        };
    });

    const rows = norm.map(d => [
        d.name,
        d.region,
        d.pma,
        `sales:${d.salesActual}/${d.salesTarget}`,
        `mkt:${d.mktMG}/${d.mktTotal}`,
        `parts:$${Math.round(d.partsActual / 1000)}k/$${Math.round(d.partsTarget / 1000)}k`,
        `google:${d.googleScore}(${d.googleResp}rev)`,
        `doty:${d.dotyTotal}pts`,
        `ci:${d.ciStatus}`,
        `cx:R${d.cxR}/S${d.cxS}/L${d.cxL}/T${d.cxT}`,
    ].join(' | '));

    const regions = {};
    norm.forEach(d => {
        const r = d.region || 'Unknown';
        if (!regions[r]) regions[r] = { count: 0, salesA: 0, salesT: 0, partsA: 0, dotyTop: null };
        regions[r].count++;
        regions[r].salesA += d.salesActual;
        regions[r].salesT += d.salesTarget;
        regions[r].partsA += d.partsActual;
        if (!regions[r].dotyTop || d.dotyTotal > regions[r].dotyTop.score) {
            regions[r].dotyTop = { name: d.name, score: d.dotyTotal };
        }
    });

    const regionSummary = Object.entries(regions).map(([r, v]) =>
        `  ${r}: ${v.count} dealers | sales ${v.salesA}/${v.salesT} (${v.salesT ? Math.round(v.salesA / v.salesT * 100) : 0}% ach) | parts $${Math.round(v.partsA / 1000)}k | top DOTY: ${v.dotyTop?.name} (${v.dotyTop?.score}pts)`
    ).join('\n');

    const dataMonth = dealers[0]?.monthly?.[0]?.month || dealers[0]?.month || 'Latest';

    const rank = (arr, key, n = 10) => [...arr].sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, n);

    const top10Doty = rank(norm, 'dotyTotal')
        .map((d, i) => `  ${i + 1}. ${d.name} — ${d.dotyTotal}pts`).join('\n');

    const top10Sales = rank(norm, 'salesActual')
        .map((d, i) => `  ${i + 1}. ${d.name} — ${d.salesActual} units (target ${d.salesTarget})`).join('\n');

    const top10SalesAch = [...norm]
        .filter(d => d.salesTarget > 0)
        .sort((a, b) => b.salesActual / b.salesTarget - a.salesActual / a.salesTarget)
        .slice(0, 10)
        .map((d, i) => `  ${i + 1}. ${d.name} — ${Math.round(d.salesActual / d.salesTarget * 100)}% (${d.salesActual}/${d.salesTarget})`).join('\n');

    const top10Parts = rank(norm, 'partsActual')
        .map((d, i) => `  ${i + 1}. ${d.name} — $${Math.round(d.partsActual / 1000)}k`).join('\n');

    const top10Google = [...norm].filter(d => d.googleScore > 0)
        .sort((a, b) => b.googleScore - a.googleScore).slice(0, 10)
        .map((d, i) => `  ${i + 1}. ${d.name} — ${d.googleScore} ★`).join('\n');

    return `DATA MONTH: ${dataMonth}
TOTAL DEALERS: ${total}

TAB RANKING RULES — always use the matching ranking when user asks "top performers" or "rankings":
- DOTY Leaderboard tab → rank by dotyTotal
- Sales & Market tab → rank by salesActual or salesAch %
- Aftersales & CX tab → rank by partsActual
- Network & Google tab → rank by googleScore
- Executive Overview → rank by salesActual

REGIONAL AGGREGATES:
${regionSummary}

TOP 10 DOTY LEADERBOARD (matches DOTY Leaderboard tab exactly):
${top10Doty}

TOP 10 BY SALES ACTUAL (matches Sales tab):
${top10Sales}

TOP 10 BY SALES ACHIEVEMENT % (matches Sales tab):
${top10SalesAch}

TOP 10 BY PARTS REVENUE (matches Aftersales tab):
${top10Parts}

TOP 10 BY GOOGLE RATING (matches Network & Google tab):
${top10Google}

ALL DEALERS (name | region | pma | sales actual/target | mkt mg/total | parts $actual/$target | google score(reviews) | doty pts | ci status | cx R/S/L/T):
${rows.join('\n')}`;
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

app.post('/pinned-viz', requireCatalystAdmin, async (req, res) => {
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

app.delete('/pinned-viz', requireCatalystAdmin, async (req, res) => {
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

// ──────────────────────────────────────────────
// GET  /config  — return dashboard label config (public read)
// POST /config  — save label config (admin only)
// ──────────────────────────────────────────────
app.get('/config', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const rows = await zcql.executeZCQLQuery(
            "SELECT data FROM dashboard_data WHERE record_id = 'LABEL_CONFIG' LIMIT 1"
        );
        const row = (rows || [])[0];
        const raw = row?.dashboard_data?.data || row?.DASHBOARD_DATA?.data;
        return res.json(raw ? JSON.parse(raw) : {});
    } catch (_) {
        return res.json({});
    }
});

app.post('/config', requireCatalystAdmin, async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const esc = JSON.stringify(req.body).replace(/'/g, "''");
        // ZCQL doesn't support UPDATE with WHERE on string fields — use DELETE + INSERT
        try { await zcql.executeZCQLQuery("DELETE FROM dashboard_data WHERE record_id = 'LABEL_CONFIG'"); } catch (_) {}
        await zcql.executeZCQLQuery(`INSERT INTO dashboard_data (record_id, data) VALUES ('LABEL_CONFIG', '${esc}')`);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = app;