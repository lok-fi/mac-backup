'use strict';

/**
 * zoho-oauth.js
 * Zoho OAuth 2.0 Authorization Code flow — India region.
 * TODO: move credentials to env vars before production.
 */

const axios = require('axios');

const ACCOUNTS_BASE = 'https://accounts.zoho.in/oauth/v2';

const CLIENT_ID     = '1000.3853HV1MHF3GDZ4VYWSWUMILNBKJXD';
const CLIENT_SECRET = '8624cd6fae1e61c67684aa4738fe205cdaafe86ea1';
const REDIRECT_URI  = 'https://crm-whatsapp-60040289923.development.catalystserverless.in/server/fivawebhook/auth/callback';

const SCOPES = [
  'ZohoCRM.modules.ALL',
  'ZohoCRM.settings.ALL',
  'ZohoCRM.users.READ',
  'ZohoCRM.coql.READ'
].join(',');

// ─── Auth URL ─────────────────────────────────────────────────────────────────

function getAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    scope:         SCOPES,
    redirect_uri:  REDIRECT_URI,
    access_type:   'offline',
    prompt:        'consent'
  });
  return `${ACCOUNTS_BASE}/auth?${params.toString()}`;
}

// ─── Exchange code for tokens ─────────────────────────────────────────────────

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri:  REDIRECT_URI,
    code:          code.trim()
  });

  console.log('[OAuth] Exchanging code, redirect_uri:', REDIRECT_URI);
  console.log('[OAuth] Code (first 20 chars):', code.substring(0, 20));

  let res;
  try {
    res = await axios.post(`${ACCOUNTS_BASE}/token`, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  } catch (err) {
    // Log full Zoho error response for debugging
    console.error('[OAuth] HTTP error:', err.response?.status, JSON.stringify(err.response?.data));
    throw new Error(`Zoho HTTP error ${err.response?.status}: ${JSON.stringify(err.response?.data)}`);
  }

  console.log('[OAuth] Zoho response:', JSON.stringify(res.data));

  if (res.data.error) {
    throw new Error(`Zoho error: ${res.data.error}`);
  }

  if (!res.data.access_token) {
    throw new Error(`No access_token in response: ${JSON.stringify(res.data)}`);
  }

  return res.data;
}

// ─── Refresh access token ─────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken
  });

  const res = await axios.post(`${ACCOUNTS_BASE}/token`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (res.data.error) throw new Error(`Zoho refresh error: ${res.data.error}`);
  return res.data;
}

module.exports = { getAuthUrl, exchangeCode, refreshAccessToken, REDIRECT_URI };
