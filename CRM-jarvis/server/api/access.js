/**
 * access.js
 *
 * Internal REST API called by the Zoho CRM widget (FIVA) to manage
 * which WhatsApp phone numbers are allowed to use the AI assistant.
 *
 * All endpoints are protected by the INTERNAL_API_KEY header.
 * The CRM widget sends this key when making requests to this server.
 *
 * Endpoints:
 *   POST   /api/whatsapp/access          — grant access to a number
 *   DELETE /api/whatsapp/access          — revoke access from a number
 *   GET    /api/whatsapp/access          — list all authorized numbers
 *
 * Expected body for POST/DELETE:
 *   {
 *     "phoneNumber": "+91 79733 20995",   // any format — will be normalized
 *     "grantedBy":  "John Doe"            // CRM user name or email
 *   }
 */

'use strict';

const authorizedNumbers = require('../data/authorized-numbers');

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];

  if (!process.env.INTERNAL_API_KEY) {
    console.warn('[Access API] WARNING: INTERNAL_API_KEY is not set in .env!');
    return res.status(500).json({ error: 'Server misconfiguration: INTERNAL_API_KEY not set' });
  }

  if (key !== process.env.INTERNAL_API_KEY) {
    console.warn(`[Access API] Unauthorized request — invalid or missing x-api-key`);
    return res.status(401).json({ error: 'Unauthorized — provide a valid x-api-key header' });
  }

  next();
}

// ─── Grant access ─────────────────────────────────────────────────────────────

function grantAccess(req, res) {
  const { phoneNumber, grantedBy } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'phoneNumber is required' });
  }

  if (!grantedBy) {
    return res.status(400).json({ error: 'grantedBy is required (CRM user name or email)' });
  }

  try {
    const result = authorizedNumbers.grant(phoneNumber, grantedBy);
    const display = `+${result.phone}`;

    console.log(`[Access API] ✅ Access GRANTED — ${display} by ${grantedBy}`);

    return res.status(200).json({
      success: true,
      message: `WhatsApp AI access granted to ${display}`,
      data: result
    });
  } catch (err) {
    console.error('[Access API] Grant error:', err);
    return res.status(500).json({ error: 'Failed to grant access', detail: err.message });
  }
}

// ─── Revoke access ────────────────────────────────────────────────────────────

function revokeAccess(req, res) {
  // Accept from body or query param
  const phoneNumber = req.body?.phoneNumber || req.query?.phoneNumber;
  const revokedBy   = req.body?.revokedBy   || req.query?.revokedBy || 'unknown';

  if (!phoneNumber) {
    return res.status(400).json({ error: 'phoneNumber is required' });
  }

  try {
    const ok      = authorizedNumbers.revoke(phoneNumber, revokedBy);
    const display = `+${authorizedNumbers.normalize(phoneNumber)}`;

    if (!ok) {
      return res.status(404).json({
        success: false,
        message: `No active access found for ${display}`
      });
    }

    console.log(`[Access API] 🚫 Access REVOKED — ${display} by ${revokedBy}`);

    return res.status(200).json({
      success: true,
      message: `WhatsApp AI access revoked for ${display}`
    });
  } catch (err) {
    console.error('[Access API] Revoke error:', err);
    return res.status(500).json({ error: 'Failed to revoke access', detail: err.message });
  }
}

// ─── List authorized numbers ──────────────────────────────────────────────────

function listAccess(req, res) {
  try {
    const numbers = authorizedNumbers.list();

    return res.status(200).json({
      success: true,
      count:   numbers.length,
      numbers: numbers.map(n => ({
        phone:        `+${n.phone}`,
        originalInput: n.originalInput,
        grantedBy:    n.grantedBy,
        grantedAt:    n.grantedAt
      }))
    });
  } catch (err) {
    console.error('[Access API] List error:', err);
    return res.status(500).json({ error: 'Failed to list numbers', detail: err.message });
  }
}

module.exports = { requireApiKey, grantAccess, revokeAccess, listAccess };
