'use strict';

const express    = require('express');
const bodyParser = require('body-parser');

const { verifyWebhook, receiveMessage } = require('./whatsapp/webhook');
const { requireApiKey, grantAccess, revokeAccess, listAccess } = require('./api/access');
const { getAuthUrl, exchangeCode } = require('./auth/zoho-oauth');
const { createTokenStore }         = require('./auth/token-store');
const catalyst                     = require('zcatalyst-sdk-node');

const app = express();

// ─── CORS — must be the very first middleware ────────────────────────────────
// Catalyst's gateway may intercept OPTIONS before reaching Express, so we also
// register an explicit app.options('*') handler as a belt-and-suspenders backup.

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  res.setHeader('Access-Control-Max-Age',       '86400');
}

app.use((req, res, next) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  next();
});

// Explicit preflight handler — catches OPTIONS before any route or auth middleware
app.options('*', (req, res) => {
  setCorsHeaders(res);
  res.statusCode = 204;
  res.end();
});

// ─── Body parsers (after CORS) ────────────────────────────────────────────────

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'FIVA WhatsApp — Catalyst',
    project:   'CRM-whatsapp',
    timestamp: new Date().toISOString()
  });
});

// ─── WhatsApp access — simple GET endpoint (no preflight) ────────────────────
// Uses query params so no custom headers are needed.
// GET /api/whatsapp/cmd?key=X&action=grant|revoke|list&phoneNumber=X&grantedBy=X
// A plain GET with no custom headers is a "simple request" — no CORS preflight,
// works from any browser origin without CORS config on the server.

function buildWelcomeMessage(name) {
  const greeting = name ? `Hi *${name}*! 👋` : 'Hello! 👋';
  return (
    `${greeting} Welcome to *FIVA* — your AI assistant for Zoho CRM on WhatsApp.\n\n` +
    `Here's what I can do for you:\n\n` +
    `📋 *Read data*\n` +
    `• "Show me my open leads"\n` +
    `• "Find contact John Smith"\n` +
    `• "What deals are closing this month?"\n\n` +
    `✏️ *Create & update*\n` +
    `• "Create a new lead: Jane Doe, jane@email.com"\n` +
    `• "Update lead status to Contacted"\n` +
    `• "Add a note to this contact"\n\n` +
    `🔄 *Advanced*\n` +
    `• "Convert lead John to a deal"\n` +
    `• "Search contacts by email"\n\n` +
    `🔧 *Commands*\n` +
    `• /help — show this message\n` +
    `• /reset — start a fresh conversation\n\n` +
    `_Just type naturally — I understand plain English!_`
  );
}

app.get('/api/whatsapp/cmd', async (req, res) => {
  const { key, action, phoneNumber, grantedBy, revokedBy, name, email } = req.query;

  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { createStore } = require('./data/authorized-numbers');
    const sender = require('./whatsapp/sender');
    const store  = createStore(catalyst.initialize(req, { type: 'admin' }));

    if (action === 'grant') {
      if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
      const result = await store.grant(phoneNumber, grantedBy || 'CRM Widget', name || '', email || '');
      console.log(`[Access API] ✅ GRANTED ${result.phone} by ${grantedBy}`);

      // Await the welcome message so Catalyst doesn't terminate the function early
      console.log(`[Access API] Sending welcome message to ${result.phone}...`);
      try {
        await sender.sendText(result.phone, buildWelcomeMessage(name));
        console.log(`[Access API] ✅ Welcome message sent to ${result.phone}`);
      } catch (err) {
        console.error(`[Access API] Welcome message failed for ${result.phone}:`, err.message);
      }

      return res.json({ success: true, phone: result.phone });
    }

    if (action === 'revoke') {
      if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
      const ok = await store.revoke(phoneNumber, revokedBy || 'CRM Widget');
      if (!ok) return res.status(404).json({ success: false, error: 'No active access found for that number' });
      console.log(`[Access API] 🚫 REVOKED ${phoneNumber}`);
      return res.json({ success: true });
    }

    if (action === 'list') {
      const numbers = await store.list();
      return res.json({
        success: true,
        numbers: numbers.map(n => ({
          phone:     `+${n.phone}`,
          grantedBy: n.grantedBy,
          grantedAt: n.grantedAt
        }))
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[Access API] cmd error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── WhatsApp webhook ─────────────────────────────────────────────────────────

app.get('/webhook',  verifyWebhook);   // Meta verification handshake
app.post('/webhook', receiveMessage);  // Incoming WhatsApp messages

// ─── Access management API ────────────────────────────────────────────────────

app.post('/api/whatsapp/access',   requireApiKey, grantAccess);
app.delete('/api/whatsapp/access', requireApiKey, revokeAccess);
app.get('/api/whatsapp/access',    requireApiKey, listAccess);

// ─── Zoho OAuth ───────────────────────────────────────────────────────────────

// Step 1: Admin opens this URL in browser → redirected to Zoho consent screen
app.get('/auth/zoho', (req, res) => {
  const url = getAuthUrl();
  console.log('[Auth] Redirecting to Zoho consent page');
  res.redirect(url);
});

// Step 2: Zoho redirects back here with ?code=xxx after admin approves
app.get('/auth/callback', async (req, res) => {
  const { code, error, location } = req.query;

  console.log('[Auth] Callback hit. Query params:', JSON.stringify(req.query));

  if (error || !code) {
    console.error('[Auth] Callback error:', error);
    return res.status(400).send(`
      <h2>❌ Authorization failed</h2>
      <p><b>Error:</b> ${error || 'No code received'}</p>
      <p><a href="/auth/zoho">Try again</a></p>
    `);
  }

  try {
    const catalystApp = catalyst.initialize(req, { type: 'admin' });
    const tokens      = await exchangeCode(code);
    const store       = createTokenStore(catalystApp);
    await store.save(tokens);

    console.log('[Auth] ✅ Zoho CRM connected');
    res.send(`
      <h2>✅ FIVA connected to Zoho CRM!</h2>
      <p>Tokens saved. Your WhatsApp AI can now access CRM data.</p>
      <p>You can close this tab.</p>
    `);
  } catch (err) {
    console.error('[Auth] Exchange error:', err.message);
    res.status(500).send(`
      <h2>❌ Token exchange failed</h2>
      <pre style="background:#fee;padding:12px;border-radius:4px">${err.message}</pre>
      <p><a href="/auth/zoho">Try again</a></p>
    `);
  }
});

// Manual connect — paste a Self Client code directly
// Usage: GET /auth/connect?code=1000.xxxxx
app.get('/auth/connect', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send(`
      <h2>⚠️ No code provided</h2>
      <p>Usage: <code>/auth/connect?code=YOUR_SELF_CLIENT_CODE</code></p>
      <p>Generate a code at <a href="https://api-console.zoho.in" target="_blank">api-console.zoho.in</a>
      → Self Client → scopes: ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.users.READ,ZohoCRM.coql.READ</p>
    `);
  }

  try {
    const catalystApp = catalyst.initialize(req, { type: 'admin' });
    const tokens      = await exchangeCode(code);
    const store       = createTokenStore(catalystApp);
    await store.save(tokens);

    console.log('[Auth] ✅ Connected via Self Client code');
    res.send(`
      <h2>✅ FIVA connected to Zoho CRM!</h2>
      <p>Tokens saved. Your WhatsApp AI can now access CRM data.</p>
      <p>You can close this tab.</p>
    `);
  } catch (err) {
    console.error('[Auth] Self Client exchange error:', err.message);
    res.status(500).send(`
      <h2>❌ Exchange failed</h2>
      <pre>${err.message}</pre>
      <p>Make sure the code was generated with the correct scopes and is less than 5 minutes old.</p>
    `);
  }
});

// Step 3: Check connection status (useful for debugging)
app.get('/auth/status', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req, { type: 'admin' });
    const store       = createTokenStore(catalystApp);
    const connected   = await store.isConnected();
    const row         = connected ? await store.get() : null;

    res.json({
      connected,
      connectedSince: row?.updatedAt || null,
      tokenExpiresAt: row?.expiresAt || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[FIVA] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Catalyst Advanced I/O: export the app — DO NOT call app.listen() ─────────

module.exports = app;
