'use strict';

/**
 * authorized-numbers.js — Catalyst DataStore version
 *
 * Usage inside a request handler:
 *   const catalystApp = catalyst.initialize(req, { type: 'admin' });
 *   const store = createStore(catalystApp);
 *   await store.isAuthorized(phone);
 *
 * Requires DataStore table "AuthorizedNumbers" with columns:
 *   phone, originalInput, grantedBy, grantedAt, active, revokedBy, revokedAt
 *   (all Text type)
 */

const TABLE = 'AuthorizedNumbers';

// Normalize to plain digits with country code.
// "+91 79733 20995" → "917973320995"
// "8600437554"      → "918600437554"  (10-digit Indian mobile, auto-prepend 91)
function normalize(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

function createStore(catalystApp) {
  const zcql      = catalystApp.zcql();
  const datastore = catalystApp.datastore();
  const table     = datastore.table(TABLE);

  // ── isAuthorized ────────────────────────────────────────────────────────────
  async function isAuthorized(phoneNumber) {
    const phone = normalize(phoneNumber);
    try {
      const rows = await zcql.executeZCQLQuery(
        `SELECT ROWID FROM ${TABLE} WHERE phone = '${phone}' AND active = 'true'`
      );
      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      console.error('[AuthNumbers] isAuthorized error:', err.message);
      return false;
    }
  }

  // ── grant ───────────────────────────────────────────────────────────────────
  async function grant(phoneNumber, grantedBy, name = '', email = '') {
    const phone = normalize(phoneNumber);
    const now   = new Date().toISOString();

    let existingRowId = null;
    try {
      const rows = await zcql.executeZCQLQuery(
        `SELECT ROWID FROM ${TABLE} WHERE phone = '${phone}'`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        existingRowId = rows[0][TABLE].ROWID;
      }
    } catch (err) {
      console.error('[AuthNumbers] grant lookup error:', err.message);
    }

    const data = {
      phone,
      originalInput: phoneNumber,
      grantedBy,
      grantedAt: now,
      active:    'true',
      revokedBy: '',
      revokedAt: ''
    };
    // Only include name/email if values exist — avoids "Invalid column name" error
    // when the optional columns haven't been added to the DataStore table yet.
    if (name)  data.name  = name;
    if (email) data.email = email;

    async function tryInsertOrUpdate(rowData) {
      try {
        if (existingRowId) {
          await table.updateRow({ ROWID: existingRowId, ...rowData });
        } else {
          await table.insertRow(rowData);
        }
      } catch (err) {
        // If optional name/email columns don't exist in the DataStore table yet,
        // retry without them so the grant still succeeds.
        if (rowData.name !== undefined || rowData.email !== undefined) {
          console.warn('[AuthNumbers] Optional column missing — retrying without name/email:', err.message);
          const { name: _n, email: _e, ...base } = rowData;
          if (existingRowId) {
            await table.updateRow({ ROWID: existingRowId, ...base });
          } else {
            await table.insertRow(base);
          }
        } else {
          throw err;
        }
      }
    }

    await tryInsertOrUpdate(data);

    return { phone, grantedBy, grantedAt: now };
  }

  // ── revoke ──────────────────────────────────────────────────────────────────
  async function revoke(phoneNumber, revokedBy) {
    const phone = normalize(phoneNumber);
    let rowId   = null;

    try {
      const rows = await zcql.executeZCQLQuery(
        `SELECT ROWID FROM ${TABLE} WHERE phone = '${phone}' AND active = 'true'`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        rowId = rows[0][TABLE].ROWID;
      }
    } catch (err) {
      console.error('[AuthNumbers] revoke lookup error:', err.message);
      return false;
    }

    if (!rowId) return false;

    await table.updateRow({
      ROWID:     rowId,
      active:    'false',
      revokedBy: revokedBy || 'unknown',
      revokedAt: new Date().toISOString()
    });
    return true;
  }

  // ── list ────────────────────────────────────────────────────────────────────
  async function list() {
    try {
      const rows = await zcql.executeZCQLQuery(
        `SELECT * FROM ${TABLE} WHERE active = 'true'`
      );
      if (!Array.isArray(rows)) return [];
      return rows.map(r => r[TABLE]);
    } catch (err) {
      console.error('[AuthNumbers] list error:', err.message);
      return [];
    }
  }

  return { isAuthorized, grant, revoke, list };
}

module.exports = { createStore, normalize };
