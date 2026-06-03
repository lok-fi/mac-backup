'use strict';

/**
 * conversation-sessions.js
 *
 * Per-user Gemini conversation history stored in Catalyst DataStore.
 *
 * Requires DataStore table "ConversationSessions" with columns:
 *   phone      Text  — WhatsApp phone number (primary key equiv)
 *   history    Text  — JSON-serialised Content[] array
 *   updatedAt  Text  — ISO timestamp
 *
 * Usage inside a request handler:
 *   const sessions = createSessionStore(catalyst.initialize(req, { type: 'admin' }));
 *   const history  = await sessions.getHistory(phone);
 */

const TABLE = 'ConversationSessions';
const MAX_HISTORY_ITEMS = 40; // keep last 40 Content items to avoid DataStore size limits

function createSessionStore(catalystApp) {
  const zcql  = catalystApp.zcql();
  const table = catalystApp.datastore().table(TABLE);

  async function getHistory(phone) {
    try {
      const rows = await zcql.executeZCQLQuery(
        `SELECT history FROM ${TABLE} WHERE phone = '${phone}'`
      );
      if (!Array.isArray(rows) || rows.length === 0) return [];
      const raw = rows[0][TABLE].history;
      return JSON.parse(raw || '[]');
    } catch (err) {
      console.error('[Sessions] getHistory error:', err.message);
      // Corrupted history (e.g. truncated JSON) — clear it so next message starts fresh
      if (err.message.includes('JSON') || err.message.includes('Unterminated')) {
        await clearHistory(phone).catch(() => {});
      }
      return [];
    }
  }

  async function saveHistory(phone, history) {
    const trimmed    = history.slice(-MAX_HISTORY_ITEMS);
    const now        = new Date().toISOString();
    const serialised = JSON.stringify(trimmed);

    try {
      const rows = await zcql.executeZCQLQuery(
        `SELECT ROWID FROM ${TABLE} WHERE phone = '${phone}'`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const rowId = rows[0][TABLE].ROWID;
        await table.updateRow({ ROWID: rowId, phone, history: serialised, updatedAt: now });
      } else {
        await table.insertRow({ phone, history: serialised, updatedAt: now });
      }
    } catch (err) {
      console.error('[Sessions] saveHistory error:', err.message);
    }
  }

  async function clearHistory(phone) {
    try {
      const rows = await zcql.executeZCQLQuery(
        `SELECT ROWID FROM ${TABLE} WHERE phone = '${phone}'`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const rowId = rows[0][TABLE].ROWID;
        await table.updateRow({
          ROWID:     rowId,
          phone,
          history:   '[]',
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[Sessions] clearHistory error:', err.message);
    }
  }

  return { getHistory, saveHistory, clearHistory };
}

module.exports = { createSessionStore };
