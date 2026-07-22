// ============================================================
// InCred Wealth COO Dashboard — get-json function
// Full replacement of MG Motor Express backend.
// ============================================================

const express    = require('express');
const catalyst   = require('zcatalyst-sdk-node');
const cors       = require('cors');
const XLSX       = require('xlsx');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCso5BkK-NOVapxKczSfyOm_IHsk7LbH3U';
// Switched to 2.5-flash — stronger long-context recall than 3-flash-preview.
const GEMINI_MODEL   = 'gemini-2.5-flash';

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
const num = (v) => {
    if (v == null || v === '' || v === '#N/A') return 0;
    const n = Number(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
};

const clean = (v) => v == null ? '' : String(v).trim();

const getSheet = (wb, ...names) => {
    for (const n of names) {
        const ws = wb.Sheets[n];
        if (ws) return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    }
    return [];
};

// Detect month abbreviation from a string like "Apr 2025" → "APR"
const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_NAMES_LONG = ['january','february','march','april','may','june','july','august','september','october','november','december'];

const parseMonthYear = (str) => {
    if (!str) return null;
    const s = String(str).trim();
    // Try "Apr 2025", "April 2025", "Apr-25", "Apr-2025"
    const m = s.match(/([A-Za-z]+)[- ](\d{2,4})/);
    if (m) {
        const monStr = m[1].toLowerCase();
        const yearRaw = m[2];
        const year = yearRaw.length === 2 ? 2000 + parseInt(yearRaw, 10) : parseInt(yearRaw, 10);
        let monthIdx = MONTH_NAMES_LONG.findIndex(mn => mn.startsWith(monStr.slice(0, 3)));
        if (monthIdx < 0) monthIdx = MONTH_ABBR.findIndex(a => a === monStr.toUpperCase().slice(0, 3));
        if (monthIdx >= 0) return { monthIdx, year, label: `${MONTH_ABBR[monthIdx].charAt(0) + MONTH_ABBR[monthIdx].slice(1).toLowerCase()} ${year}` };
    }
    // Try JS Date
    try {
        const d = new Date(s);
        if (!isNaN(d)) {
            return { monthIdx: d.getMonth(), year: d.getFullYear(), label: d.toLocaleString('en-IN', { month: 'short', year: 'numeric' }) };
        }
    } catch (_) {}
    return null;
};

const monthToReportId = (label) => {
    // "Apr 2025" → "WEALTH_APR_2025"
    const p = parseMonthYear(label);
    if (!p) return `WEALTH_LATEST`;
    return `WEALTH_${MONTH_ABBR[p.monthIdx]}_${p.year}`;
};

// ──────────────────────────────────────────────
// EXCEL PARSER
// ──────────────────────────────────────────────
// Strip % and commas from percentage strings like "62.2%" → 62.2
const pct = (v) => {
    if (v == null || v === '') return 0;
    const n = Number(String(v).replace('%', '').replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
};

// Find the last column whose header matches a month pattern like "Mar-26"
const findLastMonthCol = (headers, startCol) => {
    let last = startCol;
    for (let c = startCol; c < headers.length; c++) {
        if (/^[A-Za-z]{3}-\d{2}$/.test(String(headers[c] || '').trim())) last = c;
    }
    return last;
};

const parseWealthExcel = (base64Data) => {
    const buf = Buffer.from(base64Data, 'base64');
    const wb  = XLSX.read(buf, { type: 'buffer', cellDates: true });

    // ── 1. AUM MONTHLY TREND ─────────────────────────
    // Exact sheet: "AUM MONTHLY TREND"
    // Row 0 = headers: Month | Total AUM (₹ Cr) | InCred AUM (₹ Cr) | Held Away AUM (₹ Cr) |
    //                  Active Clients | Inflow (₹ Cr) | Outflow (₹ Cr) | Net Sales (₹ Cr) |
    //                  Trail Income (₹ Cr) | Upfront Income (₹ Cr) | Redemption (₹ Cr)
    const parseMonthlyAUM = () => {
        const rows = getSheet(wb, 'AUM MONTHLY TREND');
        if (!rows.length) return [];
        // Row 0 = headers, data starts row 1
        // Cols: Month(0) | Total AUM(1) | InCred AUM(2) | Held Away AUM(3) | Active Clients(4)
        //       Inflow(5) | Outflow(6) | Net Sales(7) | Trail Income(8) | Upfront Income(9) | Redemption(10)
        // Real month rows match "Mmm-YY" (e.g. "Apr-25"). Anything else (footnotes,
        // FY26 TOTAL aggregate row, etc.) is dropped.
        const isMonthLabel = (s) => /^[A-Za-z]{3}-\d{2}$/.test(String(s).trim());
        const monthly = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[0]) continue;
            const month = clean(r[0]);
            if (!month || !isMonthLabel(month)) continue;
            monthly.push({
                month,
                totalAUM:      num(r[1]),
                incredAUM:     num(r[2]),
                heldAwayAUM:   num(r[3]),
                activeClients: num(r[4]),
                inflow:        num(r[5]),
                outflow:       num(r[6]),
                netSales:      num(r[7]),
                trailIncome:   num(r[8]),
                upfrontIncome: num(r[9]),
                redemption:    num(r[10]),
            });
        }
        return monthly;
    };

    // ── 2. BRANCH AUM (FY26) — wide format ──────────────
    // Row 0: Rank(0) | BRANCHNAME(1) | Apr-25(2) … Mar-26(13) | YoY%(14) | % Total(15)
    // Supplemented by NET SALES (FY26) and INCOME ANALYSIS
    const parseBranches = () => {
        const aumRows = getSheet(wb, 'BRANCH AUM (FY26)');
        if (!aumRows.length) return [];

        const headers     = aumRows[0] || [];
        const lastAUMCol  = findLastMonthCol(headers, 2);   // last "Mmm-YY" col from col 2 onward

        // Reject aggregate rows ("GRAND TOTAL") and citation/footnote rows.
        const looksLikeBranch = (name) => {
            const s = String(name).trim();
            if (!s) return false;
            if (s.length > 60) return false;                          // footnotes are long
            if (/[.:]/.test(s) && s.split(' ').length > 5) return false; // long sentences with punctuation
            if (/^(grand\s+total|total|subtotal|all\s+branches)$/i.test(s)) return false;
            if (/source[:.]|all figures|note[:.]|footnote/i.test(s)) return false;
            return true;
        };
        const branchMap = {};
        for (let i = 1; i < aumRows.length; i++) {
            const r = aumRows[i];
            if (!r || !r[1]) continue;
            const name = clean(r[1]);
            if (!looksLikeBranch(name)) continue;
            branchMap[name] = {
                name,
                aum:          num(r[lastAUMCol]),
                inflow:       0, outflow: 0, netSales: 0,
                trailIncome:  0, upfrontIncome: 0,
                walletShare:  0, activeClients: 0,
                redemption:   0, riskStatus: '',
            };
        }

        // NET SALES (FY26): Rank(0) | BRANCHNAME(1) | Inflow(2) | Outflow(3) | Net Position(4) | Net Sales Final(5) | Retention%(6)
        const nsRows = getSheet(wb, 'NET SALES (FY26)');
        for (let i = 1; i < nsRows.length; i++) {
            const r = nsRows[i];
            if (!r || !r[1]) continue;
            const name = clean(r[1]);
            if (!branchMap[name]) continue;
            branchMap[name].inflow   = num(r[2]);
            branchMap[name].outflow  = num(r[3]);
            branchMap[name].netSales = num(r[4]);   // Net Position (Inflow - Outflow)
        }

        // INCOME ANALYSIS: Branch(0) | Total Income(1) | Trail Income(2) | Upfront Income(3) | Trail%(4) | months…
        const incRows = getSheet(wb, 'INCOME ANALYSIS');
        for (let i = 1; i < incRows.length; i++) {
            const r = incRows[i];
            if (!r || !r[0]) continue;
            const name = clean(r[0]);
            if (!branchMap[name]) continue;
            branchMap[name].trailIncome   = num(r[2]);
            branchMap[name].upfrontIncome = num(r[3]);
        }

        // REDEMPTION vs AUM: Rank(0) | BRANCHNAME(1) | Current AUM(2) | Total Redemption(3) | Leakage%(4) | Risk Status(5)
        const redRows = getSheet(wb, 'REDEMPTION vs AUM');
        for (let i = 1; i < redRows.length; i++) {
            const r = redRows[i];
            if (!r || !r[1]) continue;
            const name = clean(r[1]);
            if (!branchMap[name]) continue;
            branchMap[name].redemption  = num(r[3]);
            branchMap[name].riskStatus  = clean(r[5]);
        }

        // Compute wallet share per branch by aggregating CLIENT WALLET SHARE
        // CLIENT WALLET SHARE: Rank(0) | WS CLIENT ID(1) | CLIENT NAME(2) | BRANCHNAME(3) | RMNAME(4)
        //   Total Wallet(5) | InCred AUM(6) | Held Away AUM(7) | Wallet Share%(8) | Cross-Sell Opp(9)
        const wsRows = getSheet(wb, 'CLIENT WALLET SHARE');
        const branchWallet = {};  // branchName → { totalWealth, incredAUM }
        for (let i = 1; i < wsRows.length; i++) {
            const r = wsRows[i];
            if (!r || !r[3]) continue;
            const bName = clean(r[3]);
            if (!branchWallet[bName]) branchWallet[bName] = { totalWealth: 0, incredAUM: 0 };
            branchWallet[bName].totalWealth += num(r[5]);
            branchWallet[bName].incredAUM   += num(r[6]);
        }
        Object.entries(branchWallet).forEach(([bName, v]) => {
            if (branchMap[bName] && v.totalWealth > 0) {
                branchMap[bName].walletShare = Math.round((v.incredAUM / v.totalWealth) * 1000) / 10;
            }
        });

        return Object.values(branchMap);
    };

    // ── 3. RM AUM (FY26) — wide format ──────────────────
    // Row 0: Rank(0) | RMNAME(1) | BRANCHNAME(2) | Clients(3) | Apr-25(4) … Mar-26(15) | YoY%(16)
    const parseRMs = () => {
        const rows = getSheet(wb, 'RM AUM (FY26)');
        if (!rows.length) return [];

        const headers    = rows[0] || [];
        const lastAUMCol = findLastMonthCol(headers, 4);   // month cols start at 4

        const looksLikeRM = (name) => {
            const s = String(name).trim();
            if (!s) return false;
            if (s.length > 60) return false;
            if (/^(grand\s+total|total|subtotal|all\s+rms?)$/i.test(s)) return false;
            if (/source[:.]|all figures|note[:.]|footnote/i.test(s)) return false;
            return true;
        };
        const rms = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[1]) continue;
            const name = clean(r[1]);
            if (!looksLikeRM(name)) continue;
            rms.push({
                name,
                branch:        clean(r[2]),
                activeClients: num(r[3]),
                aum:           num(r[lastAUMCol]),
                inflow:        0, outflow: 0, trailIncome: 0,
            });
        }

        // Supplement trail income from INCOME ANALYSIS (branch level only — no per-RM in the sheet)
        return rms;
    };

    // ── 4. TOP 50 CLIENTS ────────────────────────────────
    // Row 0: Rank(0) | WS CLIENT ID(1) | CLIENT NAME(2) | BRANCHNAME(3) | RMNAME(4)
    //        Products Held(5) | Total AUM(6) | InCred AUM(7) | Held Away AUM(8) | Wallet Share%(9) | YoY%(10) | % of Total(11)
    const parseClients = () => {
        const rows = getSheet(wb, 'TOP 50 CLIENTS');
        if (!rows.length) return [];

        const clients = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[2]) continue;
            const name = clean(r[2]);
            if (!name) continue;
            clients.push({
                name,
                rm:         clean(r[4]),
                branch:     clean(r[3]),
                totalAUM:   num(r[6]),
                incredAUM:  num(r[7]),
                heldAway:   num(r[8]),
                walletShare:pct(r[9]),
            });
        }
        return clients;
    };

    // ── 5. AUM BY ASSET CLASS — wide format ─────────────
    // Row 0: ASTCLSNAME(0) | Apr-25(1) … Mar-26(12) | YoY%(13) | % of Total(14)
    const parseAssetClasses = () => {
        const rows = getSheet(wb, 'AUM BY ASSET CLASS');
        if (!rows.length) return [];

        const headers    = rows[0] || [];
        const lastAUMCol = findLastMonthCol(headers, 1);   // month cols start at 1
        // "% of Total" is the last column
        const pctCol     = headers.length - 1;

        const items = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[0]) continue;
            const name = clean(r[0]);
            if (!name) continue;
            const aum = num(r[lastAUMCol]);
            if (aum === 0) continue;
            items.push({ name, aum, pct: pct(r[pctCol]) });
        }
        // Back-fill pct if missing
        const total = items.reduce((s, it) => s + it.aum, 0);
        if (total > 0) items.forEach(it => { if (!it.pct) it.pct = Math.round(it.aum / total * 1000) / 10; });
        return items;
    };

    // ── 6. Redemption — REDEMPTION BY CLIENT ────────────
    // Row 0: Rank(0) | Client Name(1) | BRANCHNAME(2) | RMNAME(3) | Top Product(4)
    //        Transactions(5) | Total Redemption(6) | Share%(7)
    const parseRedemptions = () => {
        const rows = getSheet(wb, 'REDEMPTION BY CLIENT');
        if (!rows.length) return [];

        const redemptions = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[1]) continue;
            redemptions.push({
                client:  clean(r[1]),
                branch:  clean(r[2]),
                rm:      clean(r[3]),
                product: clean(r[4]),
                amount:  num(r[6]),
                type:    'Full',
            });
        }
        return redemptions;
    };

    // ── 7. Redemption Drilldown — REDEMPTION DRILLDOWN ──
    const parseRedemptionDrilldown = () => {
        const rows = getSheet(wb, 'REDEMPTION DRILLDOWN');
        if (!rows.length) return [];

        const headerRow = rows[0] || [];
        const headers = headerRow.map((h, index) => {
            const key = clean(h) || `col${index}`;
            return key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        });

        const drilldown = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || r.every(cell => cell == null || String(cell).trim() === '')) continue;
            const item = {};
            headers.forEach((key, colIndex) => {
                const value = r[colIndex];
                if (value == null || value === '') {
                    item[key] = null;
                } else {
                    const parsed = Number(String(value).replace(/,/g, ''));
                    item[key] = Number.isFinite(parsed) ? parsed : clean(value);
                }
            });
            drilldown.push(item);
        }
        return drilldown;
    };

    // ── 8. Wallet Share — CLIENT WALLET SHARE ───────────
    // Row 0: Rank(0) | WS CLIENT ID(1) | CLIENT NAME(2) | BRANCHNAME(3) | RMNAME(4)
    //        Total Wallet(5) | InCred AUM(6) | Held Away AUM(7) | Wallet Share%(8) | Cross-Sell Opp(9)
    const parseWalletShare = () => {
        const rows = getSheet(wb, 'CLIENT WALLET SHARE');
        if (!rows.length) return [];

        const ws = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[2]) continue;
            ws.push({
                entity:      clean(r[2]),
                type:        'client',
                branch:      clean(r[3]),
                rm:          clean(r[4]),
                totalWealth: num(r[5]),
                incredAUM:   num(r[6]),
                heldAway:    num(r[7]),
                walletShare: pct(r[8]),
                crossSell:   num(r[9]),
            });
        }
        return ws;
    };

    const parseCrossSell = () => {
        const rows = getSheet(wb, 'CLIENT CROSS-SELL');
        if (!rows.length) return [];

        const cross = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[0]) continue;
            cross.push({
                segment:    clean(r[0]),
                clients:    num(r[1]),
                clientsPct: pct(r[2]),
                totalAUM:   num(r[3]),
                avgAUM:     num(r[4]),
            });
        }
        return cross;
    };

    // ── Raw sheet dump (every sheet → header row + data rows as objects) ──
    // Lets the AI answer questions about records the typed parsers don't cover.
    const parseRawSheets = () => {
        const MAX_ROWS_PER_SHEET = 1000;
        const out = {};
        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            if (!ws) continue;
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
            if (!rows.length) continue;

            const rawHeaders = (rows[0] || []).map((h, i) => clean(h) || `col${i}`);
            const items = [];
            for (let i = 1; i < rows.length && items.length < MAX_ROWS_PER_SHEET; i++) {
                const r = rows[i];
                if (!r || r.every(c => c == null || String(c).trim() === '')) continue;
                const obj = {};
                rawHeaders.forEach((h, idx) => {
                    const v = r[idx];
                    if (v == null || v === '') return;
                    const n = Number(String(v).replace(/,/g, '').replace('%', ''));
                    obj[h] = Number.isFinite(n) && /^[\d.,%\- ]+$/.test(String(v)) ? n : clean(v);
                });
                if (Object.keys(obj).length) items.push(obj);
            }
            out[sheetName] = { headers: rawHeaders, rows: items };
        }
        return out;
    };

    // ── Run all parsers ───────────────────────────────
    const monthly             = parseMonthlyAUM();
    const branches            = parseBranches();
    const rms                 = parseRMs();
    const topClients          = parseClients();
    const assetClasses        = parseAssetClasses();
    const redemption          = parseRedemptions();
    const redemptionDrilldown = parseRedemptionDrilldown();
    const walletShare         = parseWalletShare();
    const crossSell           = parseCrossSell();
    const rawSheets           = parseRawSheets();

    // Aggregate branch.activeClients from the RM list (the branch sheet doesn't carry it).
    const branchByName = Object.fromEntries(branches.map(b => [b.name, b]));
    for (const r of rms) {
        const b = branchByName[r.branch];
        if (b) b.activeClients = (b.activeClients || 0) + (r.activeClients || 0);
    }

    // ── Latest month ──────────────────────────────────
    // Only true month rows ("Mmm-YY") qualify — never the FY26 TOTAL aggregate.
    const isRealMonth = (m) => /^[A-Za-z]{3}-\d{2}$/.test(String(m.month || '').trim());
    const latestM     = [...monthly].reverse().find(m => isRealMonth(m) && m.totalAUM > 0)
                       || monthly.filter(isRealMonth).pop()
                       || monthly[monthly.length - 1]
                       || {};
    const reportMonth = latestM.month || 'Latest';

    // ── Summary ────────────────────────────────────────
    const branchInflow   = branches.reduce((s, b) => s + b.inflow, 0);
    const branchOutflow  = branches.reduce((s, b) => s + b.outflow, 0);
    const branchNetSales = branches.reduce((s, b) => s + b.netSales, 0);
    const branchTrail    = branches.reduce((s, b) => s + b.trailIncome, 0);
    const branchUpfront  = branches.reduce((s, b) => s + b.upfrontIncome, 0);
    const totalRed       = redemption.reduce((s, r) => s + r.amount, 0);

    // Use monthly sums as fallback if branch aggregation is empty
    const monthlyInflow  = monthly.reduce((s, m) => s + m.inflow, 0);
    const monthlyOutflow = monthly.reduce((s, m) => s + m.outflow, 0);
    const monthlyNet     = monthly.reduce((s, m) => s + m.netSales, 0);
    const monthlyTrail   = monthly.reduce((s, m) => s + m.trailIncome, 0);
    const monthlyUpfront = monthly.reduce((s, m) => s + m.upfrontIncome, 0);
    const monthlyRed     = monthly.reduce((s, m) => s + m.redemption, 0);

    const finalInflow   = branchInflow   > 0 ? branchInflow   : monthlyInflow;
    const finalOutflow  = branchOutflow  > 0 ? branchOutflow  : monthlyOutflow;
    const finalNetSales = branchNetSales > 0 ? branchNetSales : monthlyNet;
    const finalTrail    = branchTrail    > 0 ? branchTrail    : monthlyTrail;
    const finalUpfront  = branchUpfront  > 0 ? branchUpfront  : monthlyUpfront;
    const finalRed      = totalRed       > 0 ? totalRed       : monthlyRed;

    // Wallet share: compute from latest month (incredAUM / totalAUM)
    const computedWalletShare = latestM.totalAUM > 0
        ? Math.round(latestM.incredAUM / latestM.totalAUM * 1000) / 10
        : 0;

    const summary = {
        totalAUM:        latestM.totalAUM    || 0,
        incredAUM:       latestM.incredAUM   || 0,
        heldAwayAUM:     latestM.heldAwayAUM || 0,
        walletSharePct:  computedWalletShare,
        totalInflow:     finalInflow,
        totalOutflow:    finalOutflow,
        netSales:        finalNetSales,
        trailIncome:     finalTrail,
        upfrontIncome:   finalUpfront,
        totalIncome:     finalTrail + finalUpfront,
        totalRedemption: finalRed,
        activeClients:   latestM.activeClients || 0,
        totalBranches:   branches.length,
        totalRMs:        rms.length,
        reportMonth,
    };

    const meta = {
        id:         monthToReportId(reportMonth),
        month:      reportMonth,
        uploadedAt: new Date().toISOString(),
        sheetNames: wb.SheetNames,
    };

    return { meta, summary, monthly, branches, rms, topClients, assetClasses, redemption, redemptionDrilldown, walletShare, crossSell, rawSheets };
};

// ──────────────────────────────────────────────
// SMTP TRANSPORTER
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
// AI DATA SUMMARY BUILDER
// ──────────────────────────────────────────────
// Best-effort record matcher: finds rows in any parsed dataset or raw sheet whose
// string fields share a multi-word phrase or distinctive token with the question.
// This is intentionally generous: it surfaces candidates the AI can then quote from.
function findMatchingRecords(question, wealthData) {
    if (!question || !wealthData) return null;
    const STOP = new Set([
        'the','a','an','of','in','to','is','are','was','were','be','for','on','at','by','with','about',
        'tell','me','show','give','what','who','find','search','about','any','all','please','can','you',
        'and','or','also','look','up','data','sheet','record','rows','from','this','that','they','them',
        'how','many','total','sum','average','avg','min','max'
    ]);
    const cleanToken = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const tokens = String(question).split(/\s+/).map(cleanToken).filter(t => t.length >= 3 && !STOP.has(t));
    if (!tokens.length) return null;

    // Also pull out 2- and 3-word phrases (common name forms like "Bhupinder Singh")
    const words = String(question).split(/\s+/).map(w => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
    const phrases = [];
    for (let i = 0; i < words.length; i++) {
        if (words[i].length >= 3 && !STOP.has(words[i].toLowerCase())) {
            if (words[i+1] && words[i+1].length >= 2) phrases.push(`${words[i]} ${words[i+1]}`.toLowerCase());
            if (words[i+1] && words[i+2]) phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`.toLowerCase());
        }
    }

    // Distinctive name-like tokens — any 4+ letter token in the question that's not a
    // common English word. A single hit against any string field surfaces the record.
    // (Regardless of case in the question — most users type lowercase.)
    const COMMON_WORDS = new Set([
        'client','clients','branch','branches','sheet','sheets','data','total','amount','share',
        'income','sales','trail','upfront','wallet','asset','class','redemption','redemptions',
        'cross','sell','holdings','aum','growth','month','year','quarter','tab','dashboard',
        'report','please','panel','table','chart','graph','figure','number','value','rate','name',
        'wealth','incred','crore','crores','lakh','from','have','show','give','find','tell',
        'compare','difference','best','worst','highest','lowest','first','last','overall','where',
        'when','what','which','that','this','those','these','some','more','less','than','only',
        'with','without','about','their','there','here','very','much','many','also','just',
    ]);
    const distinctiveTokens = new Set(
        tokens.filter(t => t.length >= 4 && !COMMON_WORDS.has(t))
    );

    const rowMatches = (row) => {
        const stringFields = Object.entries(row).filter(([_, v]) => typeof v === 'string' && v.length >= 2);
        if (!stringFields.length) return false;
        const blob = stringFields.map(([_, v]) => v).join(' | ').toLowerCase();
        // Strongest: multi-word phrase appears verbatim ("Bhupinder Singh").
        for (const p of phrases) if (blob.includes(p)) return true;
        // Strong: any distinctive 4+ letter token from the question appears.
        for (const n of distinctiveTokens) if (blob.includes(n)) return true;
        return false;
    };

    const result = {};
    const scan = (label, arr) => {
        if (!Array.isArray(arr) || !arr.length) return;
        const hits = arr.filter(rowMatches).slice(0, 25);
        if (hits.length) result[label] = hits;
    };

    scan('branches',            wealthData.branches);
    scan('rms',                 wealthData.rms);
    scan('topClients',          wealthData.topClients);
    scan('redemption',          wealthData.redemption);
    scan('redemptionDrilldown', wealthData.redemptionDrilldown);
    scan('walletShare',         wealthData.walletShare);
    scan('crossSell',           wealthData.crossSell);
    scan('monthly',             wealthData.monthly);
    scan('assetClasses',        wealthData.assetClasses);

    // Raw sheets too — these often contain records the typed parsers don't expose.
    const rawHits = {};
    const rawSheets = wealthData.rawSheets || {};
    for (const [sheetName, sheet] of Object.entries(rawSheets)) {
        const matches = (sheet.rows || []).filter(rowMatches).slice(0, 25);
        if (matches.length) rawHits[sheetName] = matches;
    }
    if (Object.keys(rawHits).length) result.rawSheets = rawHits;

    return Object.keys(result).length ? result : null;
}

// Compact, ranking-first AI summary — modeled on the reference dealer summary.
// Goal: keep the system instruction under ~10K tokens so the model can actually use
// it. Specific record lookups go through findMatchingRecords (above) and the
// queryRecords tool the frontend exposes; we no longer dump every raw sheet here.
function buildWealthDataSummary(wealthData, question) {
    if (!wealthData) return 'No data available.';

    const {
        summary, branches = [], rms = [], topClients = [], assetClasses = [],
        monthly = [], redemption = [], redemptionDrilldown = [], walletShare = [],
        crossSell = [], rawSheets = {},
    } = wealthData;
    const s = summary || {};

    const fmt = (n) => {
        const v = Number(n) || 0;
        if (Math.abs(v) >= 1e3) return `₹${v.toFixed(1)} Cr`;
        return `₹${v.toFixed(1)} Cr`;
    };
    const pct = (n) => `${(+n || 0).toFixed(1)}%`;

    const rank = (arr, key, n = 10) =>
        [...arr].filter(d => (d[key] || 0) > 0).sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, n);

    // Branch rankings
    const fmtBranchesAUM = rank(branches, 'aum').map((b, i) =>
        `  ${i+1}. ${b.name} — AUM ${fmt(b.aum)} | NetSales ${fmt(b.netSales)} | Income ${fmt(b.trailIncome + b.upfrontIncome)} | WS ${pct(b.walletShare)}${b.riskStatus ? ' | risk ' + b.riskStatus : ''}`
    ).join('\n');
    const fmtBranchesNet = rank(branches, 'netSales').map((b, i) =>
        `  ${i+1}. ${b.name} — Net ${fmt(b.netSales)} (in ${fmt(b.inflow)} / out ${fmt(b.outflow)})`
    ).join('\n');
    const fmtBranchesIncome = [...branches].sort((a,b) => (b.trailIncome + b.upfrontIncome) - (a.trailIncome + a.upfrontIncome)).slice(0,10).map((b, i) =>
        `  ${i+1}. ${b.name} — Total Income ${fmt(b.trailIncome + b.upfrontIncome)} (trail ${fmt(b.trailIncome)} / upfront ${fmt(b.upfrontIncome)})`
    ).join('\n');
    const fmtBranchesRedemption = rank(branches, 'redemption').map((b, i) =>
        `  ${i+1}. ${b.name} — Redemption ${fmt(b.redemption)}${b.riskStatus ? ' | risk ' + b.riskStatus : ''}`
    ).join('\n');

    // RM rankings
    const fmtRMsAUM = rank(rms, 'aum', 15).map((r, i) =>
        `  ${i+1}. ${r.name} (${r.branch}) — AUM ${fmt(r.aum)} | clients ${r.activeClients || 0}`
    ).join('\n');

    // Asset class
    const fmtAssets = assetClasses.map(a => `  ${a.name}: ${fmt(a.aum)} (${pct(a.pct)})`).join('\n');

    // Monthly trend
    const fmtTrend = monthly.map(m => `  ${m.month}: total ${fmt(m.totalAUM)} | incred ${fmt(m.incredAUM)} | inflow ${fmt(m.inflow)} | outflow ${fmt(m.outflow)} | trail ${fmt(m.trailIncome)} | upfront ${fmt(m.upfrontIncome)} | redemption ${fmt(m.redemption)}`).join('\n');

    // Wallet share — top by total wealth (highest cross-sell opportunity targets)
    const fmtWalletTop = [...walletShare].sort((a,b) => (b.totalWealth || 0) - (a.totalWealth || 0)).slice(0, 15).map((w, i) =>
        `  ${i+1}. ${w.entity} (${w.branch}, RM ${w.rm}) — Total Wealth ${fmt(w.totalWealth)} | InCred ${fmt(w.incredAUM)} | HeldAway ${fmt(w.heldAway)} | WS ${pct(w.walletShare)} | CrossSell ${fmt(w.crossSell)}`
    ).join('\n');

    // Top clients by AUM
    const fmtClients = [...topClients].sort((a,b) => (b.totalAUM || 0) - (a.totalAUM || 0)).slice(0, 10).map((c, i) =>
        `  ${i+1}. ${c.name} (${c.branch}, RM ${c.rm}) — Total ${fmt(c.totalAUM)} | InCred ${fmt(c.incredAUM)} | WS ${pct(c.walletShare)}`
    ).join('\n');

    // Top redemptions
    const fmtRedemption = [...redemption].sort((a,b) => (b.amount || 0) - (a.amount || 0)).slice(0, 10).map((r, i) =>
        `  ${i+1}. ${r.client} (${r.branch}, RM ${r.rm}) — ${fmt(r.amount)} via ${r.product}`
    ).join('\n');

    // Cross-sell segments
    const fmtCross = crossSell.map(c => `  ${c.segment}: ${c.clients} clients (${pct(c.clientsPct)}) | ${fmt(c.totalAUM)} AUM | avg ${fmt(c.avgAUM)}/client`).join('\n');

    // Data availability — exposes counts so the AI (and user) can see what's loaded.
    const rawSheetCount  = Object.keys(rawSheets || {}).length;
    const dataChecklist = `DATA AVAILABILITY: branches=${branches.length} rms=${rms.length} topClients=${topClients.length} redemption=${redemption.length} redemptionDrilldown=${redemptionDrilldown.length} walletShare=${walletShare.length} crossSell=${crossSell.length} monthly=${monthly.length} assetClasses=${assetClasses.length} rawSheets=${rawSheetCount}`;

    // List the sheets the AI can query through the queryRecords tool.
    const sheetCatalog = rawSheetCount
        ? Object.entries(rawSheets).map(([name, sh]) => `  - "${name}" (${(sh.rows||[]).length} rows) columns: ${(sh.headers||[]).join(', ')}`).join('\n')
        : '  (none — user must re-upload Excel)';

    // MATCHING RECORDS — server-side scan that surfaces specific records the user named
    // in the question, so the AI doesn't have to grep through ranking lists.
    const matched = findMatchingRecords(question, wealthData);
    const matchedBlock = matched
        ? `MATCHING RECORDS FOR THIS QUERY (server pre-scanned every dataset and raw sheet — quote these first):
${Object.entries(matched).map(([k, v]) => {
            if (k === 'rawSheets') {
                return Object.entries(v).map(([sh, rows]) =>
                    `  rawSheet "${sh}" (${rows.length} match${rows.length === 1 ? '' : 'es'}):\n    ${JSON.stringify(rows)}`
                ).join('\n');
            }
            return `  ${k} (${v.length} match${v.length === 1 ? '' : 'es'}):\n    ${JSON.stringify(v)}`;
        }).join('\n')}`
        : (question ? `MATCHING RECORDS FOR THIS QUERY: none auto-matched. If the user named a specific record, call the queryRecords tool to look it up.` : '');

    return `REPORT MONTH: ${s.reportMonth || 'Latest'}

${dataChecklist}

${matchedBlock}

OVERALL KPIs:
  Total AUM:      ${fmt(s.totalAUM)}
  InCred AUM:     ${fmt(s.incredAUM)}
  Held Away AUM:  ${fmt(s.heldAwayAUM)}
  Wallet Share:   ${pct(s.walletSharePct)}
  Inflow:         ${fmt(s.totalInflow)}
  Outflow:        ${fmt(s.totalOutflow)}
  Net Sales:      ${fmt(s.netSales)}
  Trail Income:   ${fmt(s.trailIncome)}
  Upfront Income: ${fmt(s.upfrontIncome)}
  Total Income:   ${fmt(s.totalIncome)}
  Redemptions:    ${fmt(s.totalRedemption)}
  Active Clients: ${s.activeClients}
  Branches:       ${s.totalBranches}
  RMs:            ${s.totalRMs}

MONTHLY AUM TREND:
${fmtTrend}

TOP BRANCHES BY AUM (matches AUM tab):
${fmtBranchesAUM}

TOP BRANCHES BY NET SALES:
${fmtBranchesNet}

TOP BRANCHES BY INCOME:
${fmtBranchesIncome}

TOP BRANCHES BY REDEMPTION (risk):
${fmtBranchesRedemption}

TOP RMs BY AUM:
${fmtRMsAUM}

ASSET CLASS BREAKDOWN:
${fmtAssets}

⚠ TWO DIFFERENT CLIENT SHEETS EXIST — do not confuse them:
  • TOP 50 CLIENTS sheet → highest-AUM clients (source='clients' in queryRecords)
  • CLIENT WALLET SHARE sheet → cross-sell targets ranked by Total Wealth (source='walletShare')
  "client wallet share" / "wallet share clients" → walletShare
  "top clients" / "top 50 clients" / "biggest clients" → clients

TOP CLIENTS BY AUM (TOP 50 CLIENTS sheet — source='clients'):
${fmtClients}

CLIENT WALLET SHARE sheet — top 15 by Total Wealth (source='walletShare'):
${fmtWalletTop}

TOP REDEMPTIONS (REDEMPTION BY CLIENT sheet):
${fmtRedemption}

CROSS-SELL SEGMENTS:
${fmtCross}

AVAILABLE SHEETS (for queryRecords tool):
${sheetCatalog}`;
}

// ──────────────────────────────────────────────
// POST /upload-wealth
// ──────────────────────────────────────────────
app.post('/upload-wealth', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();

        const { fileData, fileName } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No fileData provided' });

        console.log('Parsing InCred Wealth Excel:', fileName);
        const parsed = parseWealthExcel(fileData);

        const { meta, summary, monthly, branches, rms, topClients, assetClasses, redemption, redemptionDrilldown, walletShare, crossSell, rawSheets } = parsed;
        const reportId = monthToReportId(summary.reportMonth);
        const base = reportId;
        console.log(`Report ID: ${base}`);

        // Best-effort cleanup: drop any existing rows for this report id AND any orphan
        // WEALTH_LATEST_* rows. ZCQL's LIKE in DELETE doesn't work reliably here, so we
        // SELECT all rows, filter in JS, and DELETE by exact record_id. The upsert in
        // saveChunk below catches anything cleanup misses.
        try {
            const all = await zcql.executeZCQLQuery('SELECT record_id FROM dashboard_data LIMIT 200');
            const toDelete = [];
            for (const r of (all || [])) {
                const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                const rid = row?.record_id || '';
                if (rid.startsWith(base + '_') || rid.startsWith('WEALTH_LATEST_')) {
                    toDelete.push(rid);
                }
            }
            console.log(`Pre-upload cleanup: deleting ${toDelete.length} existing/stale rows`);
            await Promise.all(toDelete.map(async rid => {
                try {
                    await zcql.executeZCQLQuery(`DELETE FROM dashboard_data WHERE record_id = '${rid.replace(/'/g, "''")}'`);
                } catch (e) {
                    console.log(`Delete failed for ${rid}: ${e.message}`);
                }
            }));
        } catch (e) { console.log('Pre-upload cleanup skipped:', e.message); }

        // Store chunks via UPSERT — INSERT first, on duplicate fall back to UPDATE.
        // This makes us robust to leftover rows even if the cleanup queries above failed.
        const saveResults = { ok: [], failed: [] };
        const saveChunk = async (key, payload) => {
            const json = JSON.stringify(payload);
            const esc  = json.replace(/'/g, "''");
            const safeKey = key.replace(/'/g, "''");
            try {
                await zcql.executeZCQLQuery(
                    `INSERT INTO dashboard_data (record_id, data) VALUES ('${safeKey}', '${esc}')`
                );
                saveResults.ok.push({ key, bytes: json.length });
                return;
            } catch (e) {
                const isDup = /duplicate/i.test(e.message || '');
                if (!isDup) {
                    console.error(`[saveChunk] INSERT FAIL ${key} (${json.length} bytes): ${e.message}`);
                    saveResults.failed.push({ key, bytes: json.length, error: e.message });
                    return;
                }
            }
            // INSERT hit duplicate — switch to UPDATE.
            try {
                await zcql.executeZCQLQuery(
                    `UPDATE dashboard_data SET data = '${esc}' WHERE record_id = '${safeKey}'`
                );
                saveResults.ok.push({ key, bytes: json.length, upserted: true });
            } catch (e) {
                console.error(`[saveChunk] UPDATE FAIL ${key} (${json.length} bytes): ${e.message}`);
                saveResults.failed.push({ key, bytes: json.length, error: e.message });
            }
        };

        // Build the full list of chunks first, then save with bounded concurrency so we
        // don't serialize 25+ inserts (which can blow past the function timeout).
        const chunks = [
            [`${base}_meta`,                 { meta, summary, monthly, assetClasses }],
            [`${base}_branches`,             { branches }],
            [`${base}_wallet`,               { walletShare }],
            [`${base}_clients`,              { topClients }],
            [`${base}_redemption`,           { redemption }],
            [`${base}_redemption_drilldown`, { redemptionDrilldown }],
            [`${base}_crosssell`,            { crossSell }],
        ];
        for (let i = 0; i < rms.length; i += 100) {
            chunks.push([`${base}_rms_${Math.floor(i / 100)}`, { rms: rms.slice(i, i + 100) }]);
        }

        const RAW_ROWS_PER_CHUNK = 200;
        const safeSheetKey = (s) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
        const sheetIndex = [];
        for (const [sheetName, sheet] of Object.entries(rawSheets || {})) {
            const key = safeSheetKey(sheetName);
            const rows = sheet.rows || [];
            sheetIndex.push({ name: sheetName, key, rowCount: rows.length, headers: sheet.headers });
            if (rows.length === 0) {
                chunks.push([`${base}_raw_${key}_0`, { sheet: sheetName, headers: sheet.headers, rows: [] }]);
                continue;
            }
            for (let i = 0; i < rows.length; i += RAW_ROWS_PER_CHUNK) {
                const slice = rows.slice(i, i + RAW_ROWS_PER_CHUNK);
                chunks.push([`${base}_raw_${key}_${Math.floor(i / RAW_ROWS_PER_CHUNK)}`, {
                    sheet: sheetName, headers: sheet.headers, rows: slice,
                }]);
            }
        }
        chunks.push([`${base}_raw_index`, { sheetIndex }]);

        // Run inserts with a small concurrency window (Catalyst handles parallel ZCQL fine).
        console.log(`[upload-wealth] saving ${chunks.length} chunks for ${base}`);
        const CONCURRENCY = 6;
        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
            await Promise.all(chunks.slice(i, i + CONCURRENCY).map(([k, p]) => saveChunk(k, p)));
        }
        console.log(`[upload-wealth] saved ok=${saveResults.ok.length} failed=${saveResults.failed.length}`);
        if (saveResults.failed.length) {
            console.error('[upload-wealth] failed chunks:', saveResults.failed.map(f => `${f.key} (${f.bytes}B): ${f.error}`).join(' | '));
        }

        // Per-section counts so the upload UI can show a quick sanity check.
        const extractedCounts = {
            monthly:             monthly.length,
            branches:            branches.length,
            rms:                 rms.length,
            topClients:          topClients.length,
            assetClasses:        assetClasses.length,
            redemption:          redemption.length,
            redemptionDrilldown: redemptionDrilldown.length,
            walletShare:         walletShare.length,
            crossSell:           crossSell.length,
            rawSheets:           Object.fromEntries(
                Object.entries(rawSheets || {}).map(([name, s]) => [name, (s.rows || []).length])
            ),
        };

        return res.status(200).json({
            reportId: base,
            summary,
            month: summary.reportMonth,
            // Full parsed payload — exactly what gets persisted to Catalyst and fed to the AI.
            // Used by the upload page's diagnostic log box so you can verify extraction.
            extracted: {
                meta, summary, monthly, branches, rms, topClients, assetClasses,
                redemption, redemptionDrilldown, walletShare, crossSell, rawSheets,
            },
            extractedCounts,
            // Chunk-save report so the upload UI / logs can confirm every chunk landed.
            saveReport: {
                totalChunks: saveResults.ok.length + saveResults.failed.length,
                okCount:     saveResults.ok.length,
                failedCount: saveResults.failed.length,
                failedKeys:  saveResults.failed.map(f => ({ key: f.key, bytes: f.bytes, error: f.error })),
            },
        });

    } catch (err) {
        console.error('POST /upload-wealth error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// GET /  — fetch wealth data by report ID
// ──────────────────────────────────────────────
app.get('/', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();

        const requestedId = req.query?.id;
        if (!requestedId) return res.status(400).json({ error: 'Missing id query param' });

        // ZCQL's LIKE seems to not match what we expect with our underscore-heavy keys —
        // empirically returns 0 rows even when matches exist. Fall back to fetching
        // everything and filtering in JS. We keep LIMIT 200 (Catalyst's cap) and rely
        // on per-report chunk count being ~30 to stay well under it.
        const result = await zcql.executeZCQLQuery(
            `SELECT * FROM dashboard_data LIMIT 200`
        );
        if (!result || !result.length) {
            console.log(`[GET /] id=${requestedId} — NO ROWS in dashboard_data at all`);
            return res.status(404).json({ error: 'No data found' });
        }
        console.log(`[GET /] fetched ${result.length} total rows; filtering for id=${requestedId}`);
        const sampleIds = result.slice(0, 5).map(r => {
            const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
            return row?.record_id;
        });
        console.log(`[GET /] sample record_ids: ${sampleIds.join(', ')}`);

        let meta = null, summary = null, monthly = [], assetClasses = [];
        let branches = [], walletShare = [], topClients = [], redemption = [], redemptionDrilldown = [], crossSell = [], rms = [];
        const rawSheets = {};
        let sheetIndex = [];

        let firstRowDebugged = false;
        result.forEach(r => {
            try {
                const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                if (!firstRowDebugged) {
                    firstRowDebugged = true;
                    console.log(`[GET /] first-row shape — keys: ${Object.keys(row || {}).join(',')}; data type: ${typeof row?.data}; rid: ${row?.record_id}`);
                }
                if (!row || !row.record_id || !row.record_id.startsWith(requestedId + '_')) return;
                // ZCQL may return `data` as a JSON string or as an already-parsed object
                // (depends on the column type registered in the data store).
                const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                const rid = row.record_id;

                if (rid === `${requestedId}_meta`) {
                    meta               = data.meta;
                    summary            = data.summary;
                    monthly            = data.monthly      || [];
                    assetClasses       = data.assetClasses  || [];
                } else if (rid === `${requestedId}_branches`) {
                    branches = data.branches || [];
                } else if (rid === `${requestedId}_wallet`) {
                    walletShare = data.walletShare || [];
                } else if (rid === `${requestedId}_clients`) {
                    topClients = data.topClients || [];
                } else if (rid === `${requestedId}_redemption`) {
                    redemption = data.redemption || [];
                } else if (rid === `${requestedId}_redemption_drilldown`) {
                    redemptionDrilldown = data.redemptionDrilldown || [];
                } else if (rid === `${requestedId}_crosssell`) {
                    crossSell = data.crossSell || [];
                } else if (rid === `${requestedId}_raw_index`) {
                    sheetIndex = data.sheetIndex || [];
                } else if (rid.startsWith(`${requestedId}_rms_`)) {
                    rms = rms.concat(data.rms || []);
                } else if (rid.startsWith(`${requestedId}_raw_`)) {
                    const name = data.sheet;
                    if (!name) return;
                    if (!rawSheets[name]) rawSheets[name] = { headers: data.headers || [], rows: [] };
                    rawSheets[name].rows = rawSheets[name].rows.concat(data.rows || []);
                }
            } catch (e) { console.log('Skipping row:', e.message); }
        });

        console.log(`[GET /] assembled: summary=${!!summary} branches=${branches.length} rms=${rms.length} topClients=${topClients.length} walletShare=${walletShare.length} redemption=${redemption.length} drilldown=${redemptionDrilldown.length} crossSell=${crossSell.length} monthly=${monthly.length} assets=${assetClasses.length} rawSheets=${Object.keys(rawSheets).length}`);

        if (!summary) {
            console.log(`[GET /] summary missing — meta chunk for ${requestedId} not found in result`);
            return res.status(404).json({ error: `Report ${requestedId} not found` });
        }

        return res.status(200).json({ meta, summary, monthly, branches, rms, topClients, assetClasses, redemption, redemptionDrilldown, walletShare, crossSell, rawSheets, sheetIndex });

    } catch (err) {
        console.error('GET / error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// GET /list-reports
// ──────────────────────────────────────────────
app.get('/list-reports', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();

        const result = await zcql.executeZCQLQuery('SELECT record_id FROM dashboard_data LIMIT 200');
        const seen = new Set();

        if (result && result.length > 0) {
            result.forEach(r => {
                const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
                const rid = row?.record_id || '';
                // Match WEALTH_APR_2025_meta / WEALTH_APR_2025_branches etc.
                const m = rid.match(/^(WEALTH_[A-Z]{3}_\d{4})(?:_.+)?$/);
                if (m) seen.add(m[1]);
            });
        }

        return res.status(200).json({ ids: [...seen].sort() });

    } catch (err) {
        console.error('GET /list-reports error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// POST /ask  — non-streaming AI
// ──────────────────────────────────────────────
app.post('/ask', async (req, res) => {
    try {
        const { question, wealthData, currentState, history } = req.body;
        if (!question)    return res.status(400).json({ error: 'No question provided' });
        if (!wealthData)  return res.status(400).json({ error: 'No wealthData provided' });

        const dataSummary = buildWealthDataSummary(wealthData, question);
        const cs = currentState || {};

        const systemInstruction = `You are an AI assistant embedded inside the InCred Wealth COO Dashboard.
You have full access to every parsed wealth dataset (branches, RMs, clients, redemption, wallet
share, cross-sell, monthly trend, asset classes) AND every raw sheet from the uploaded Excel.
The system prompt below contains compact rankings; for record-level lookups use either the
MATCHING RECORDS section (server pre-scanned for names in the user's question) or the
queryRecords tool action to fetch specific rows on demand.

DASHBOARD STATE:
- Current tab: ${cs.tab || 'overview'}
- Current branch filter: ${cs.branch || 'All Branches'}
- Current RM filter: ${cs.rm || 'All RMs'}

AVAILABLE TABS: overview | aum | income | redemption | crosssell | ai

AVAILABLE ACTIONS:
{ "type": "setTab",   "value": "<tab>" }
{ "type": "setBranch","value": "<branch name>" }
{ "type": "setRM",    "value": "<rm name>" }
{ "type": "createVisualization",
  "title": "Overall visualization title",
  "append": true,          // default true — adds to existing AI Insights canvas; false replaces
  "panels": [              // up to 6 panels in one call; each becomes one KPI/chart/table
    {
      "id": "p1",
      "chartType": "kpi|bar|pie|table",
      "title": "Panel title",

      // ── DATA SOURCE — pick ONE of these three ways ──
      // (A) Pull from a named parsed dataset
      "source": "branches|rms|clients|redemption|redemptionDrilldown|walletShare|crossSell|monthly|assetClasses",
      // (B) Pull from a specific raw sheet (any sheet from the uploaded Excel)
      "source": "rawSheet", "sheetName": "<exact sheet name from RAW SHEET DATA>",
      // (C) Inline data — copy exact rows from the data above
      "data": [ { "col1": "...", "col2": 123 }, ... ],

      // ── COLUMNS / METRICS ──
      // For bar/pie use "metrics": ["aum"]. For table use "columns": ["name","aum","netSales"].
      // For raw-sheet panels, list the EXACT header names from that sheet.
      "metrics": ["aum"], "columns": ["name","aum"],
      "nameKey": "name",                 // column to use as row label / x-axis
      "where": { "name": "ABC Pvt Ltd" }, // optional row filter (substring match per field)
      "sortBy": "aum", "sortDir": "desc", "limit": 10,
      // legacy (still supported):
      "groupBy": "branch|rm|client",
      "filterBranches": ["..."], "filterRMs": ["..."]
    }
  ]
}
{ "type": "queryRecords",
  // Look up rows from any parsed dataset or raw sheet on demand. Frontend executes this
  // against the already-loaded wealthData and the result becomes a viz panel.
  // Use this whenever the MATCHING RECORDS section is empty but the user named a specific
  // record, OR when you need rows the rankings don't show.
  "source": "branches|rms|clients|redemption|redemptionDrilldown|walletShare|crossSell|monthly|assetClasses|rawSheet",
  "sheetName": "<exact sheet name>",   // only when source = rawSheet
  "where": { "CLIENT NAME": "Bhupinder" }, // substring match per field; case-insensitive
  "columns": ["CLIENT NAME","BRANCHNAME","RMNAME","Total Wallet (₹ Cr)","Wallet Share %"],
  "render": "table",                   // "table" pins a panel; omit to just return rows in the reply
  "title": "Bhupinder Singh — wallet share",
  "limit": 25
}
{ "type": "sendEmail","to": "...", "toName": "...", "format": "link|pdf" }

METRIC NAMES: totalAUM, incredAUM, heldAwayAUM, walletShare, inflow, outflow, netSales,
              trailIncome, upfrontIncome, totalIncome, redemption, activeClients

${dataSummary}

RESPONSE FORMAT — always respond with ONLY valid JSON, no markdown fences:
{
  "reply": "Your answer with specific numbers and insights",
  "actions": []
}

RULES:
- "reply" is always required. Be specific — use real numbers from the data.
- "actions" is optional array.
- Tab routing: AUM/trends → "aum", income/trail/upfront → "income", redemptions → "redemption", wallet share/cross-sell → "crosssell", general → "overview".
- Always use INR formatting (₹ Cr / ₹ L).
- When the user asks for multiple KPIs or charts in one go, emit ONE createVisualization action
  whose "panels" array contains every panel; do NOT split into multiple actions.
- Default to append:true so successive AI replies build up the canvas; set append:false only when
  the user explicitly asks to reset or start over.
- LOOKUPS: when asked about a specific record (client, RM, branch, sheet row, etc.):
  1. FIRST check the "MATCHING RECORDS FOR THIS QUERY" section — server-side pre-scan hits are
     there with full row JSON. Quote those values directly.
  2. If MATCHING RECORDS is empty, fire a queryRecords action with the right source/sheetName
     and a "where" filter. The frontend runs it against the full loaded data — including every
     raw sheet — and the result becomes a panel or feeds your next reply.
  3. Only after queryRecords also returns nothing, say "not found" and name the sheets you tried.
- VISUALIZING SHEET ROWS: use queryRecords with render:"table" + columns:[...]. For sheets,
  use the EXACT header names listed under AVAILABLE SHEETS. createVisualization is for chart/
  KPI panels driven by the parsed datasets.
- If DATA AVAILABILITY shows rawSheets=0, tell the user to re-upload the Excel.
- Never say "I don't have access" — call queryRecords if you need more than the rankings show.`;

        const rsCount = Object.keys(wealthData.rawSheets || {}).length;
        console.log(`[/ask] q="${question.slice(0, 80)}" branches=${wealthData.branches?.length || 0} rms=${wealthData.rms?.length || 0} walletShare=${wealthData.walletShare?.length || 0} rawSheets=${rsCount}`);

        // Inject matched records JSON adjacent to the question — same approach as /ask-stream.
        const matchedForLLM = findMatchingRecords(question, wealthData);
        const contextBlocks = [];
        if (matchedForLLM) {
            const parts = [];
            for (const [src, val] of Object.entries(matchedForLLM)) {
                if (src === 'rawSheets') {
                    for (const [sh, rows] of Object.entries(val)) {
                        parts.push(`# Raw sheet "${sh}" — ${rows.length} matching row(s):\n${JSON.stringify(rows, null, 2)}`);
                    }
                } else {
                    parts.push(`# Dataset "${src}" — ${val.length} matching row(s):\n${JSON.stringify(val, null, 2)}`);
                }
            }
            contextBlocks.push(
                `Below is the EXACT JSON for records that match the user's question, pulled directly from the loaded dataset. Use these values verbatim — do NOT say you can't find them.\n\n${parts.join('\n\n')}`
            );
        }

        const contents = [];
        if (history && history.length) {
            history.forEach(msg => {
                contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
            });
        }
        if (contextBlocks.length) {
            contents.push({ role: 'user', parts: [{ text: contextBlocks.join('\n\n') }] });
            contents.push({ role: 'model', parts: [{ text: 'Got it — I will use those records as the source of truth.' }] });
        }
        contents.push({ role: 'user', parts: [{ text: question }] });

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    contents,
                    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
                })
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`);
        }

        const geminiData = await geminiRes.json();
        const candidate  = geminiData.candidates?.[0];
        const rawText    = candidate?.content?.parts?.[0]?.text || '{}';

        if ((candidate?.finishReason || candidate?.finish_reason) === 'MAX_TOKENS') {
            return res.status(200).json({ reply: 'Response too long. Try a more specific question.', actions: [] });
        }

        let parsed;
        try {
            parsed = JSON.parse(rawText.replace(/```json/gi, '').replace(/```/g, '').trim());
        } catch (_) {
            parsed = { reply: rawText, actions: [] };
        }

        return res.status(200).json({ reply: parsed.reply || 'Could not generate a response.', actions: parsed.actions || [] });

    } catch (err) {
        console.error('POST /ask error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// POST /ask-stream  — SSE streaming AI
// ──────────────────────────────────────────────
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
        const { question, wealthData, currentState, history } = req.body;
        if (!question)   { send({ error: 'No question provided' }); return res.end(); }
        if (!wealthData) { send({ error: 'No wealthData provided' }); return res.end(); }

        const dataSummary = buildWealthDataSummary(wealthData, question);
        const cs = currentState || {};

        const systemInstruction = `You are an AI assistant embedded inside the InCred Wealth COO Dashboard.
You have full access to every parsed wealth dataset AND every raw sheet from the uploaded Excel.
The prompt below contains compact rankings; for record-level lookups use the MATCHING RECORDS
section (server pre-scanned the names in the user's question) or the queryRecords tool action.

DASHBOARD STATE:
- Current tab: ${cs.tab || 'overview'}
- Current branch filter: ${cs.branch || 'All Branches'}
- Current RM filter: ${cs.rm || 'All RMs'}

AVAILABLE TABS: overview | aum | income | redemption | crosssell | ai

AVAILABLE ACTIONS:
{ "type": "setTab",   "value": "<tab>" }
{ "type": "setBranch","value": "<branch name>" }
{ "type": "setRM",    "value": "<rm name>" }
{ "type": "createVisualization",
  "title": "Overall title",
  "append": true,        // default true; append panels to existing canvas. false = replace
  "panels": [            // up to 6 panels per call; each becomes a KPI/chart/table card
    { "id": "p1", "chartType": "kpi|bar|pie|table", "title": "...",

      // DATA SOURCE — pick ONE:
      // (A) Named parsed dataset:
      "source": "branches|rms|clients|redemption|redemptionDrilldown|walletShare|crossSell|monthly|assetClasses",
      // (B) Raw sheet from the uploaded Excel:
      "source": "rawSheet", "sheetName": "<exact sheet name>",
      // (C) Inline rows you copied from the data above:
      "data": [ {"col":"val"} ],

      "metrics": ["aum"], "columns": ["name","aum"], "nameKey": "name",
      "where": { "name": "ABC" },          // optional row filter (substring per field)
      "sortBy": "...", "sortDir": "desc", "limit": 10,
      // legacy:
      "groupBy": "branch|rm|client", "filterBranches": ["..."], "filterRMs": ["..."]
    }
  ]
}
{ "type": "queryRecords",
  // On-demand lookup against the loaded wealthData. Use when MATCHING RECORDS is empty
  // but the user named a specific record, or when you need rows beyond the rankings.
  "source": "branches|rms|clients|redemption|redemptionDrilldown|walletShare|crossSell|monthly|assetClasses|rawSheet",
  "sheetName": "<exact sheet name>",      // only when source = rawSheet
  "where": { "CLIENT NAME": "Bhupinder" }, // substring match per field, case-insensitive
  "columns": ["CLIENT NAME","BRANCHNAME","Total Wallet (₹ Cr)","Wallet Share %"],
  "render": "table",                       // pins a viz panel; omit to just narrate
  "title": "Bhupinder Singh — wallet share",
  "limit": 25
}
{ "type": "sendEmail","to": "...", "toName": "...", "format": "link|pdf" }

METRIC NAMES: totalAUM, incredAUM, heldAwayAUM, walletShare, inflow, outflow, netSales,
              trailIncome, upfrontIncome, totalIncome, redemption, activeClients

${dataSummary}

RESPONSE FORMAT — output EXACTLY in this two-part format, nothing else:
<your plain-text answer here, multiple lines allowed>
<<<ACTIONS>>>
{"actions":[...]}

CRITICAL RULES:
- Your text answer must come FIRST, before <<<ACTIONS>>>.
- Always end with <<<ACTIONS>>> followed by the JSON on the next line.
- actions array may be empty [] but must always be present.
- When the user asks for multiple KPIs/charts in one go, emit ONE createVisualization with
  every panel inside its "panels" array — do NOT split into multiple actions.
- Default to append:true so successive AI replies build up the canvas; set append:false only when
  the user explicitly asks to reset or start over.
- LOOKUPS: when asked about a specific record (client, RM, branch, sheet row, etc.):
  1. FIRST check the "MATCHING RECORDS FOR THIS QUERY" section — server-side pre-scan hits are
     there with full row JSON. Quote those values directly.
  2. If MATCHING RECORDS is empty, fire a queryRecords action with source/sheetName + where:{}.
     The frontend runs it against the full loaded data (including raw sheets) and the result
     becomes a panel or informs your next reply.
  3. Only after queryRecords also returns nothing, say "not found" and name the sheets you tried.
- VISUALIZING SHEET ROWS: use queryRecords with render:"table" + columns:[...]. Use exact
  header names from AVAILABLE SHEETS. createVisualization is for chart/KPI panels.
- If DATA AVAILABILITY shows rawSheets=0, tell the user to re-upload the Excel.
- Tab routing: AUM/trends → "aum", income → "income", redemptions → "redemption", cross-sell → "crosssell".
- Always use INR formatting. Never say "I don't have access" — the full dataset is above.`;

        // Debug log — confirms what the AI actually receives.
        const rsCount = Object.keys(wealthData.rawSheets || {}).length;
        console.log(`[/ask-stream] q="${question.slice(0, 80)}" branches=${wealthData.branches?.length || 0} rms=${wealthData.rms?.length || 0} walletShare=${wealthData.walletShare?.length || 0} rawSheets=${rsCount}`);

        // Inject the matching-records JSON as its own message right next to the question.
        // This is the key change: instead of burying record JSON inside a giant system
        // instruction, put it adjacent to the user's question so the model can't miss it.
        const matchedForLLM = findMatchingRecords(question, wealthData);
        const contextBlocks = [];
        if (matchedForLLM) {
            const parts = [];
            for (const [src, val] of Object.entries(matchedForLLM)) {
                if (src === 'rawSheets') {
                    for (const [sh, rows] of Object.entries(val)) {
                        parts.push(`# Raw sheet "${sh}" — ${rows.length} matching row(s):\n${JSON.stringify(rows, null, 2)}`);
                    }
                } else {
                    parts.push(`# Dataset "${src}" — ${val.length} matching row(s):\n${JSON.stringify(val, null, 2)}`);
                }
            }
            contextBlocks.push(
                `Below is the EXACT JSON for records that match the user's question, pulled directly from the loaded dataset. Use these values verbatim — do NOT say you can't find them.\n\n${parts.join('\n\n')}`
            );
        }

        const contents = [];
        if (history && history.length) {
            history.forEach(msg => {
                contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
            });
        }
        // Context first (if any), then the question.
        if (contextBlocks.length) {
            contents.push({ role: 'user', parts: [{ text: contextBlocks.join('\n\n') }] });
            contents.push({ role: 'model', parts: [{ text: 'Got it — I will use those records as the source of truth.' }] });
        }
        contents.push({ role: 'user', parts: [{ text: question }] });

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    contents,
                    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
                })
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            send({ error: `Gemini error ${geminiRes.status}: ${errText}` });
            return res.end();
        }

        const reader    = geminiRes.body.getReader();
        const decoder   = new TextDecoder();
        let sseBuffer   = '';
        let fullText    = '';
        let replyDone   = false;

        while (true) {
            if (closed) break;
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const dataStr = line.slice(6).trim();
                if (!dataStr || dataStr === '[DONE]') continue;

                let chunk = '';
                try {
                    const p = JSON.parse(dataStr);
                    chunk = p.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } catch (_) { continue; }

                if (!chunk) continue;
                fullText += chunk;

                if (!replyDone) {
                    if (fullText.includes('<<<ACTIONS>>>')) {
                        replyDone = true;
                        const chunkReplyPart = chunk.includes('<<<ACTIONS>>>') ? chunk.split('<<<ACTIONS>>>')[0] : '';
                        if (chunkReplyPart.trim()) send({ chunk: chunkReplyPart });
                    } else {
                        send({ chunk });
                    }
                }
            }
        }

        const sepIdx    = fullText.indexOf('<<<ACTIONS>>>');
        let replyText   = (sepIdx >= 0 ? fullText.slice(0, sepIdx) : fullText).trim();
        let actions     = [];

        if (sepIdx >= 0) {
            try {
                const actParsed = JSON.parse(fullText.slice(sepIdx + 13).trim());
                actions = actParsed.actions || [];
            } catch (_) {}
        }

        // Deterministic safety net: if records were matched but the model failed to
        // surface them (replied "not found" or similar), prepend the matched data so
        // the user ALWAYS sees what was in the dataset.
        if (matchedForLLM) {
            const looksLikeMiss = /\b(don['']?t|do not|cannot|can['']?t|no\b.*\b(record|data|info|results?)|not (?:found|available|present|in the data)|unable to find)\b/i.test(replyText)
                || replyText.length < 40;
            if (looksLikeMiss) {
                const lines = [];
                for (const [src, val] of Object.entries(matchedForLLM)) {
                    if (src === 'rawSheets') {
                        for (const [sh, rows] of Object.entries(val)) {
                            lines.push(`Found ${rows.length} matching row(s) in sheet **${sh}**:`);
                            rows.slice(0, 5).forEach(r => lines.push(`  • ${JSON.stringify(r)}`));
                        }
                    } else {
                        lines.push(`Found ${val.length} matching row(s) in **${src}**:`);
                        val.slice(0, 5).forEach(r => lines.push(`  • ${JSON.stringify(r)}`));
                    }
                }
                const fallback = `Here are the records I found:\n${lines.join('\n')}`;
                // If the model totally whiffed, replace; otherwise append.
                replyText = looksLikeMiss && replyText.length < 40
                    ? fallback
                    : `${replyText}\n\n${fallback}`;
                send({ chunk: '\n\n' + fallback });
            }
        }

        send({ done: true, reply: replyText, actions });
        res.end();

    } catch (err) {
        console.error('POST /ask-stream error:', err);
        send({ error: err.message });
        res.end();
    }
});

// ──────────────────────────────────────────────
// POST /send-email
// ──────────────────────────────────────────────
app.post('/send-email', async (req, res) => {
    try {
        const { to, toName, subject, format, pdfBase64, wealthData, currentState } = req.body;
        if (!to)         return res.status(400).json({ error: 'Recipient email is required' });
        if (!wealthData) return res.status(400).json({ error: 'No wealthData provided' });

        const sendFormat   = format === 'pdf' ? 'pdf' : 'link';
        const dashboardUrl = 'https://incred-wealth-60060703876.development.catalystserverless.in/app/index.html';
        const s            = wealthData.summary || {};
        const month        = s.reportMonth || 'Latest';
        const tab          = currentState?.tab || 'overview';

        const fmt = (n) => {
            if (!n) return '₹0';
            if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
            if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
            return `₹${n.toFixed(0)}`;
        };
        const pct = (n) => `${(+n || 0).toFixed(2)}%`;

        const kpiCards = [
            { label: 'Total AUM',   value: fmt(s.totalAUM),      sub: `InCred ${fmt(s.incredAUM)}` },
            { label: 'InCred AUM',  value: fmt(s.incredAUM),     sub: `Held Away ${fmt(s.heldAwayAUM)}` },
            { label: 'Wallet Share',value: pct(s.walletSharePct),sub: `Target 100%` },
            { label: 'Net Sales',   value: fmt(s.netSales),      sub: `In ${fmt(s.totalInflow)} · Out ${fmt(s.totalOutflow)}` },
            { label: 'Income',      value: fmt(s.totalIncome),   sub: `Trail ${fmt(s.trailIncome)} · Upfront ${fmt(s.upfrontIncome)}` },
        ];

        const kpiCardsHTML = kpiCards.map(k => `
            <td style="background:#112055;border:1px solid #C9993F44;border-radius:10px;padding:16px 18px;vertical-align:top">
              <div style="font-size:10px;color:#C9993F;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${k.label}</div>
              <div style="font-size:22px;font-weight:800;color:#ffffff;margin:4px 0">${k.value}</div>
              <div style="font-size:11px;color:#8899cc">${k.sub}</div>
            </td>`).join('');

        // Top branches table
        const topBranches = (wealthData.branches || []).sort((a, b) => b.aum - a.aum).slice(0, 5);
        const branchRows  = topBranches.map(b => `
            <tr>
              <td style="padding:7px 12px;border-bottom:1px solid #1e2d5a;color:#dde">${b.name}</td>
              <td style="padding:7px 12px;border-bottom:1px solid #1e2d5a;text-align:right;color:#fff">${fmt(b.aum)}</td>
              <td style="padding:7px 12px;border-bottom:1px solid #1e2d5a;text-align:right;color:#C9993F">${pct(b.walletShare)}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#060f2a;font-family:'Segoe UI',Arial,sans-serif;color:#e0e6f0">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:32px auto">

    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#0A2463,#1B3A7A);padding:28px 32px;border-radius:12px 12px 0 0;border-bottom:2px solid #C9993F">
        <table width="100%"><tr>
          <td>
            <div style="font-size:11px;letter-spacing:3px;color:#C9993F;text-transform:uppercase;margin-bottom:6px">InCred Wealth</div>
            <div style="font-size:22px;font-weight:800;color:#ffffff">COO Dashboard Report</div>
            <div style="font-size:13px;color:#8aabdd;margin-top:4px">${month} — ${tab.charAt(0).toUpperCase() + tab.slice(1)} View</div>
          </td>
          <td style="text-align:right;font-size:38px;color:#C9993F55">◈</td>
        </tr></table>
      </td>
    </tr>

    <!-- KPI Cards -->
    <tr>
      <td style="background:#0a1840;padding:24px 32px">
        <table width="100%" cellspacing="8"><tr>${kpiCardsHTML}</tr></table>
      </td>
    </tr>

    <!-- Top Branches -->
    <tr>
      <td style="background:#0a1840;padding:0 32px 24px">
        <div style="font-size:11px;font-weight:700;color:#C9993F;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Top Branches by AUM</div>
        <table width="100%" style="border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#112055">
              <th style="padding:8px 12px;text-align:left;color:#8aabdd;font-weight:600;border-bottom:1px solid #1e2d5a">Branch</th>
              <th style="padding:8px 12px;text-align:right;color:#8aabdd;font-weight:600;border-bottom:1px solid #1e2d5a">AUM</th>
              <th style="padding:8px 12px;text-align:right;color:#8aabdd;font-weight:600;border-bottom:1px solid #1e2d5a">Wallet Share</th>
            </tr>
          </thead>
          <tbody>${branchRows}</tbody>
        </table>
      </td>
    </tr>

    <!-- CTA -->
    <tr>
      <td style="background:#0a1840;padding:20px 32px 28px;text-align:center">
        ${sendFormat === 'pdf' ? `<div style="font-size:13px;color:#8aabdd">The full dashboard is attached as a PDF to this email.</div>`
        : `<a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#C9993F,#a07828);color:#fff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.5px">Open Live Dashboard →</a>
           <div style="margin-top:10px;font-size:11px;color:#445588">${dashboardUrl}</div>`}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#060f2a;padding:16px 32px;border-radius:0 0 12px 12px;border-top:1px solid #1e2d5a">
        <span style="font-size:11px;color:#334466">Sent from InCred Wealth COO Dashboard &nbsp;·&nbsp; ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
      </td>
    </tr>

  </table>
</body></html>`;

        const greeting  = toName ? `Hi ${toName},` : 'Hi,';
        const plainText = `${greeting}\n\nInCred Wealth COO Dashboard — ${month}\n\nTotal AUM: ${fmt(s.totalAUM)}\nInCred AUM: ${fmt(s.incredAUM)}\nWallet Share: ${pct(s.walletSharePct)}\nNet Sales: ${fmt(s.netSales)}\nTotal Income: ${fmt(s.totalIncome)}\n\n${sendFormat === 'pdf' ? 'See attached PDF.' : `Open dashboard: ${dashboardUrl}`}\n\n— InCred Wealth COO Dashboard`;

        const attachments = (sendFormat === 'pdf' && pdfBase64)
            ? [{ filename: `incred-wealth-${month.replace(/\s/g, '-')}.pdf`, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }]
            : [];

        await mailer.sendMail({
            from:    '"InCred Wealth" <sherlockloke@gmail.com>',
            to,
            subject: subject || `InCred Wealth Dashboard — ${month}`,
            html,
            text:    plainText,
            attachments,
        });

        return res.status(200).json({ success: true, message: `Report sent to ${to}` });

    } catch (err) {
        console.error('POST /send-email error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// POST /sarvam-tts
// ──────────────────────────────────────────────
app.post('/sarvam-tts', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    try {
        const response = await fetch('https://api.sarvam.ai/text-to-speech', {
            method:  'POST',
            headers: {
                'api-subscription-key': 'sk_8921n9v1_99j8aAfdt5dyr62Wc2lvS0Qv',
                'Content-Type':         'application/json',
            },
            body: JSON.stringify({
                target_language_code: 'en-IN',
                speaker:              'anushka',
                model:                'bulbul:v2',
                text,
                speech_sample_rate:   24000,
                output_audio_codec:   'linear16',
                enable_preprocessing: false,
                pitch:                0,
                pace:                 1.0,
                loudness:             1.5,
            }),
        });

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data });

        const audio = data.audios?.[0] ?? data.audio_content ?? data.audio ?? null;
        if (!audio) return res.status(500).json({ error: 'No audio in Sarvam response', raw: data });

        return res.json({ audio });

    } catch (err) {
        console.error('POST /sarvam-tts error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// GET/POST/DELETE /pinned-viz
// Key format: ${id}_pinned_viz
// ──────────────────────────────────────────────
app.get('/pinned-viz', async (req, res) => {
    try {
        const id = req.query?.id;
        if (!id) return res.status(400).json({ error: 'Missing id' });

        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const key  = `${id}_pinned_viz`;

        const safeKey = key.replace(/'/g, "''");
        const result = await zcql.executeZCQLQuery(
            `SELECT record_id, data FROM dashboard_data WHERE record_id = '${safeKey}' LIMIT 1`
        );
        if (!result?.length) return res.json({ spec: null });

        const match = result.find(r => {
            const row = r.dashboard_data || r.DASHBOARD_DATA || Object.values(r)[0];
            return row?.record_id === key;
        });
        if (!match) return res.json({ spec: null });

        const row = match.dashboard_data || match.DASHBOARD_DATA || Object.values(match)[0];
        return res.json({ spec: JSON.parse(row.data) });

    } catch (err) {
        console.error('GET /pinned-viz error:', err);
        return res.status(500).json({ error: err.message });
    }
});

app.post('/pinned-viz', async (req, res) => {
    try {
        const { id, spec } = req.body;
        if (!id || !spec) return res.status(400).json({ error: 'Missing id or spec' });

        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const key  = `${id}_pinned_viz`;
        const safeKey = key.replace(/'/g, "''");
        const esc  = JSON.stringify(spec).replace(/'/g, "''");

        // Upsert — INSERT first, on duplicate fall back to UPDATE.
        try {
            await zcql.executeZCQLQuery(`INSERT INTO dashboard_data (record_id, data) VALUES ('${safeKey}', '${esc}')`);
        } catch (e) {
            if (/duplicate/i.test(e.message || '')) {
                await zcql.executeZCQLQuery(`UPDATE dashboard_data SET data = '${esc}' WHERE record_id = '${safeKey}'`);
            } else {
                throw e;
            }
        }

        return res.json({ success: true });

    } catch (err) {
        console.error('POST /pinned-viz error:', err);
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/pinned-viz', async (req, res) => {
    try {
        const id = req.query?.id;
        if (!id) return res.status(400).json({ error: 'Missing id' });

        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const key  = `${id}_pinned_viz`;

        await zcql.executeZCQLQuery(`DELETE FROM dashboard_data WHERE record_id = '${key}'`);
        return res.json({ success: true });

    } catch (err) {
        console.error('DELETE /pinned-viz error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// POST /debug-excel  — inspect sheet names + headers (dev diagnostic)
// ──────────────────────────────────────────────
app.post('/debug-excel', (req, res) => {
    try {
        const { fileData } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No fileData' });

        const buf = Buffer.from(fileData, 'base64');
        const wb  = XLSX.read(buf, { type: 'buffer', cellDates: true });

        const sheetNames = wb.SheetNames;
        const preview = {};

        sheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
            // Return first 5 non-empty rows
            const nonEmpty = rows.filter(r => r && r.some(c => c != null && c !== '')).slice(0, 5);
            preview[name] = nonEmpty;
        });

        return res.json({ sheetNames, preview });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = app;
