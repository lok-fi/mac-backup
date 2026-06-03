/**
 * webhook-server.js
 *
 * Standalone HTTP server for the WhatsApp integration.
 * Runs SEPARATELY from server/index.js (the CRM widget HTTPS server).
 *
 * Why separate?
 *   - The CRM widget server uses self-signed HTTPS + Zoho-specific routing
 *   - This server is plain HTTP, designed to sit behind ngrok (dev) or a
 *     reverse proxy like nginx (production) which provides real HTTPS
 *
 * Start:  npm run webhook
 * Both:   npm run dev
 *
 * Routes:
 *   GET  /webhook                  — Meta webhook verification
 *   POST /webhook                  — Incoming WhatsApp messages
 *   POST /api/whatsapp/access      — Grant access (called from CRM widget)
 *   DELETE /api/whatsapp/access    — Revoke access (called from CRM widget)
 *   GET  /api/whatsapp/access      — List authorized numbers
 *   GET  /health                   — Health check (for monitoring / ngrok test)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express    = require('express');
const bodyParser = require('body-parser');
const morgan     = require('morgan');
const chalk      = require('chalk');

const { verifyWebhook, receiveMessage } = require('./whatsapp/webhook');
const { requireApiKey, grantAccess, revokeAccess, listAccess } = require('./api/access');

// ─── Startup validation ───────────────────────────────────────────────────────

const REQUIRED_ENV = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  'INTERNAL_API_KEY'
];

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(chalk.bold.red('\n[webhook-server] ❌ Missing required environment variables:'));
  missing.forEach(k => console.error(chalk.red(`   • ${k}`)));
  console.error(chalk.yellow('\n   → Open .env and fill in the values, then restart.\n'));
  process.exit(1);
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

app.use(morgan('dev'));

// Raw body needed for WhatsApp signature verification (if you add it later)
// For now just parse JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// CORS — allow the Zoho CRM widget (different origin) to call our API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check — hit this URL in the browser to confirm the server is running
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'FIVA WhatsApp Webhook Server',
    timestamp: new Date().toISOString(),
    publicUrl: process.env.WEBHOOK_PUBLIC_URL || 'not set'
  });
});

// ── WhatsApp webhook ─────────────────────────────────────────────────────────
app.get('/webhook',  verifyWebhook);   // Meta verification handshake
app.post('/webhook', receiveMessage);  // Incoming messages

// ── Access management API ────────────────────────────────────────────────────
// All /api routes require x-api-key header matching INTERNAL_API_KEY in .env

app.post('/api/whatsapp/access',   requireApiKey, grantAccess);
app.delete('/api/whatsapp/access', requireApiKey, revokeAccess);
app.get('/api/whatsapp/access',    requireApiKey, listAccess);

// ─── 404 handler ──────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[webhook-server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

// Railway injects PORT automatically. Fallback to WEBHOOK_PORT for local dev.
const PORT = parseInt(process.env.PORT || process.env.WEBHOOK_PORT || '3000', 10);

app.listen(PORT, () => {
  const isRailway  = !!process.env.RAILWAY_PUBLIC_DOMAIN;
  const publicUrl  = isRailway
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : (process.env.WEBHOOK_PUBLIC_URL || chalk.yellow('(not set — run ngrok)'));

  console.log('');
  console.log(chalk.bold.green('  ✅ FIVA WhatsApp Webhook Server running'));
  console.log('');
  if (isRailway) {
    console.log(chalk.cyan('  Environment: ') + chalk.bold.magenta('Railway (production)'));
  } else {
    console.log(chalk.cyan('  Environment: ') + chalk.bold.yellow('Local dev'));
  }
  console.log(chalk.cyan('  Port:    ') + chalk.white(PORT));
  console.log(chalk.cyan('  Public:  ') + chalk.white(publicUrl));
  console.log('');
  console.log(chalk.bold('  ► Paste this in Meta Developer Console → Webhook URL:'));
  console.log(chalk.white(`    ${publicUrl}/webhook`));
  console.log('');
  console.log(chalk.bold('  ► Paste this as Verify Token in Meta Dashboard:'));
  console.log(chalk.white(`    ${process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN}`));
  console.log('');
  console.log(chalk.dim('  Health check: GET /health'));
  console.log(chalk.dim('  Access API:   POST/DELETE/GET /api/whatsapp/access'));
  console.log('');
});
