'use strict';

const catalyst        = require('zcatalyst-sdk-node');
const { createStore } = require('../data/authorized-numbers');

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireApiKey(req, res, next) {
  if (!process.env.INTERNAL_API_KEY) {
    return res.status(500).json({ error: 'INTERNAL_API_KEY not set in Catalyst env vars' });
  }
  if (req.headers['x-api-key'] !== process.env.INTERNAL_API_KEY) {
    console.warn('[Access API] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized — invalid or missing x-api-key header' });
  }
  next();
}

// ─── POST /api/whatsapp/access — grant ────────────────────────────────────────

async function grantAccess(req, res) {
  const { phoneNumber, grantedBy } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
  if (!grantedBy)   return res.status(400).json({ error: 'grantedBy is required' });

  try {
    const store  = createStore(catalyst.initialize(req, { type: 'admin' }));
    const result = await store.grant(phoneNumber, grantedBy);

    console.log(`[Access API] ✅ GRANTED +${result.phone} by ${grantedBy}`);
    return res.json({
      success: true,
      message: `WhatsApp AI access granted to +${result.phone}`,
      data:    result
    });
  } catch (err) {
    console.error('[Access API] grantAccess error:', err);
    return res.status(500).json({ error: 'Failed to grant access', detail: err.message });
  }
}

// ─── DELETE /api/whatsapp/access — revoke ─────────────────────────────────────

async function revokeAccess(req, res) {
  const phoneNumber = req.body?.phoneNumber || req.query?.phoneNumber;
  const revokedBy   = req.body?.revokedBy   || req.query?.revokedBy || 'unknown';
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

  try {
    const store = createStore(catalyst.initialize(req, { type: 'admin' }));
    const ok    = await store.revoke(phoneNumber, revokedBy);

    if (!ok) return res.status(404).json({ success: false, message: `No active access for ${phoneNumber}` });

    console.log(`[Access API] 🚫 REVOKED ${phoneNumber} by ${revokedBy}`);
    return res.json({ success: true, message: `Access revoked for ${phoneNumber}` });
  } catch (err) {
    console.error('[Access API] revokeAccess error:', err);
    return res.status(500).json({ error: 'Failed to revoke access', detail: err.message });
  }
}

// ─── GET /api/whatsapp/access — list ─────────────────────────────────────────

async function listAccess(req, res) {
  try {
    const store   = createStore(catalyst.initialize(req, { type: 'admin' }));
    const numbers = await store.list();

    return res.json({
      success: true,
      count:   numbers.length,
      numbers: numbers.map(n => ({
        phone:         `+${n.phone}`,
        originalInput: n.originalInput,
        grantedBy:     n.grantedBy,
        grantedAt:     n.grantedAt
      }))
    });
  } catch (err) {
    console.error('[Access API] listAccess error:', err);
    return res.status(500).json({ error: 'Failed to list numbers', detail: err.message });
  }
}

module.exports = { requireApiKey, grantAccess, revokeAccess, listAccess };
