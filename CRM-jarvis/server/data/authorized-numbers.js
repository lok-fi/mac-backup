/**
 * authorized-numbers.js
 *
 * Stores and manages which WhatsApp phone numbers are authorized
 * to use the FIVA AI assistant.
 *
 * Access is granted from within the Zoho CRM widget by any CRM user
 * saying "grant WhatsApp access to <number>".
 *
 * Data is persisted to authorized-numbers.json (a flat file — no DB needed).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'authorized-numbers.json');

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Normalize a phone number to digits-only with country code, no leading +
 *  Examples:
 *    "+91 79733 20995"  →  "917973320995"
 *    "917973320995"     →  "917973320995"
 *    "+1 555-657-5317"  →  "15556575317"
 */
function normalize(phone) {
  return String(phone).replace(/[\s\-\(\)\+]/g, '');
}

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { numbers: [] };
  }
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether a phone number is authorized.
 * @param {string} phoneNumber  Raw number as received from WhatsApp webhook
 * @returns {boolean}
 */
function isAuthorized(phoneNumber) {
  const data   = load();
  const phone  = normalize(phoneNumber);
  return data.numbers.some(n => normalize(n.phone) === phone && n.active === true);
}

/**
 * Grant WhatsApp AI access to a phone number.
 * If the number already exists (even if revoked) it is replaced.
 *
 * @param {string} phoneNumber  Any format — will be normalized
 * @param {string} grantedBy    CRM user name / email who issued the grant
 * @returns {{ phone, grantedBy, grantedAt }}
 */
function grant(phoneNumber, grantedBy) {
  const data   = load();
  const phone  = normalize(phoneNumber);
  const now    = new Date().toISOString();

  // Remove any existing entry for this number (idempotent)
  data.numbers = data.numbers.filter(n => normalize(n.phone) !== phone);

  const entry = {
    phone,
    originalInput: phoneNumber,   // keep original for display
    grantedBy,
    grantedAt: now,
    active: true
  };

  data.numbers.push(entry);
  save(data);

  return { phone, grantedBy, grantedAt: now };
}

/**
 * Revoke WhatsApp AI access from a phone number.
 * @param {string} phoneNumber
 * @param {string} revokedBy    CRM user who issued the revoke
 * @returns {boolean}  true if the number was found and deactivated
 */
function revoke(phoneNumber, revokedBy) {
  const data  = load();
  const phone = normalize(phoneNumber);
  const entry = data.numbers.find(n => normalize(n.phone) === phone);

  if (!entry) return false;

  entry.active    = false;
  entry.revokedBy = revokedBy;
  entry.revokedAt = new Date().toISOString();

  save(data);
  return true;
}

/**
 * List all currently active authorized numbers.
 * @returns {Array<{ phone, originalInput, grantedBy, grantedAt }>}
 */
function list() {
  return load().numbers.filter(n => n.active === true);
}

module.exports = { isAuthorized, grant, revoke, list, normalize };
