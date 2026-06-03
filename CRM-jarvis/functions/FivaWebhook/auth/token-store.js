'use strict';

/**
 * token-store.js
 *
 * Stores Zoho OAuth tokens in Catalyst DataStore table "ZohoTokens".
 *
 * Table columns (all Text type):
 *   userId        "default" — single org
 *   accessToken   expires every 1 hour
 *   refreshToken  long-lived, used to renew access token
 *   expiresAt     ISO timestamp of access token expiry
 *   updatedAt     ISO timestamp of last save
 *
 * Usage inside a request handler:
 *   const store = createTokenStore(catalyst.initialize(req, { type: 'admin' }));
 *   const token = await store.getValidAccessToken();
 */

const zohoOAuth = require('./zoho-oauth');

const TABLE   = 'ZohoTokens';
const USER_ID = 'default';

function createTokenStore(catalystApp) {
  const zcql  = catalystApp.zcql();
  const table = catalystApp.datastore().table(TABLE);

  // ── save ─────────────────────────────────────────────────────────────────────
  async function save(tokens) {
    const now       = new Date();
    const expiresAt = new Date(now.getTime() + (tokens.expires_in || 3600) * 1000);

    const data = {
      userId:       USER_ID,
      accessToken:  tokens.access_token,
      // refresh_token only comes on first exchange, not on refresh calls
      refreshToken: tokens.refresh_token || (await _storedRefreshToken()),
      expiresAt:    expiresAt.toISOString(),
      updatedAt:    now.toISOString()
    };

    const existing = await _getRow();
    if (existing) {
      await table.updateRow({ ROWID: existing.ROWID, ...data });
    } else {
      await table.insertRow(data);
    }
    console.log('[TokenStore] Saved. Expires:', data.expiresAt);
  }

  // ── get ───────────────────────────────────────────────────────────────────────
  async function get() {
    return _getRow();
  }

  // ── isConnected ───────────────────────────────────────────────────────────────
  async function isConnected() {
    const row = await _getRow();
    return !!row;
  }

  // ── getValidAccessToken ───────────────────────────────────────────────────────
  // Returns a live access token, auto-refreshing if within 5 min of expiry.
  async function getValidAccessToken() {
    const row = await _getRow();

    if (!row) {
      throw new Error(
        'FIVA is not connected to Zoho CRM.\n' +
        'Visit /auth/zoho in a browser to connect.'
      );
    }

    const expiresAt = new Date(row.expiresAt);
    const isExpired = Date.now() >= (expiresAt.getTime() - 5 * 60 * 1000);

    if (isExpired) {
      console.log('[TokenStore] Refreshing access token…');
      const refreshed = await zohoOAuth.refreshAccessToken(row.refreshToken);
      await save({ ...refreshed, refresh_token: row.refreshToken });
      return refreshed.access_token;
    }

    return row.accessToken;
  }

  // ── private ───────────────────────────────────────────────────────────────────

  async function _getRow() {
    try {
      const rows = await zcql.executeZCQLQuery(
        `SELECT * FROM ${TABLE} WHERE userId = '${USER_ID}'`
      );
      return Array.isArray(rows) && rows.length > 0 ? rows[0][TABLE] : null;
    } catch (err) {
      console.error('[TokenStore] _getRow error:', err.message);
      return null;
    }
  }

  async function _storedRefreshToken() {
    const row = await _getRow();
    return row?.refreshToken || '';
  }

  return { save, get, isConnected, getValidAccessToken };
}

module.exports = { createTokenStore };
