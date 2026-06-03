/**
 * sender.js
 *
 * All outbound WhatsApp Cloud API calls go through here.
 * Handles: plain text, interactive buttons (YES/NO confirmations),
 *          list messages (multiple CRM records), and read receipts.
 */

'use strict';

const axios = require('axios');

// ─── Base URL helper ─────────────────────────────────────────────────────────

function apiUrl(path) {
  const version = process.env.WHATSAPP_API_VERSION || 'v25.0';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${version}/${phoneId}${path}`;
}

function headers() {
  return {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type':  'application/json'
  };
}

// ─── Core send helper ─────────────────────────────────────────────────────────

async function _post(payload) {
  try {
    const res = await axios.post(apiUrl('/messages'), payload, { headers: headers() });
    return res.data;
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('[WhatsApp sender] Error:', JSON.stringify(detail, null, 2));
    throw err;
  }
}

// ─── Public methods ───────────────────────────────────────────────────────────

/**
 * Send a plain text message.
 * WhatsApp markdown: *bold*  _italic_  ~strikethrough~  ```code```
 *
 * @param {string} to    Phone number (digits only, with country code)
 * @param {string} text  Message body (max 4096 chars)
 */
async function sendText(to, text) {
  // WhatsApp has a 4096 char limit — split if needed
  const chunks = splitMessage(text, 4000);

  for (const chunk of chunks) {
    await _post({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body:        chunk
      }
    });
  }
}

/**
 * Send interactive YES / NO buttons.
 * Used for write-operation confirmations (create, update, delete).
 *
 * @param {string} to
 * @param {string} bodyText   The question / action description
 * @param {string} sessionId  Passed back in button reply payload so we can match it
 */
async function sendConfirmation(to, bodyText, sessionId) {
  return _post({
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: [
          {
            type:  'reply',
            reply: { id: `confirm_yes_${sessionId}`, title: '✅ Yes, do it' }
          },
          {
            type:  'reply',
            reply: { id: `confirm_no_${sessionId}`,  title: '❌ Cancel' }
          }
        ]
      }
    }
  });
}

/**
 * Send a list message — useful for showing multiple CRM records.
 *
 * @param {string} to
 * @param {string} headerText    e.g. "Search results"
 * @param {string} bodyText      e.g. "Found 3 leads matching your query"
 * @param {string} buttonLabel   e.g. "View records"
 * @param {Array}  sections      [{ title, rows: [{ id, title, description }] }]
 */
async function sendList(to, headerText, bodyText, buttonLabel, sections) {
  return _post({
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: headerText },
      body:   { text: bodyText },
      action: {
        button:   buttonLabel,
        sections: sections
      }
    }
  });
}

/**
 * Mark an incoming message as read (shows blue ticks to the user).
 * @param {string} messageId  The wamid from the incoming webhook payload
 */
async function markAsRead(messageId) {
  try {
    await _post({
      messaging_product: 'whatsapp',
      status:     'read',
      message_id: messageId
    });
  } catch {
    // Non-critical — don't crash on read-receipt failures
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Split a long message into chunks that respect WhatsApp's character limit.
 * Tries to break on newlines rather than mid-word.
 */
function splitMessage(text, maxLen = 4000) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen; // no good newline, hard split
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

module.exports = { sendText, sendConfirmation, sendList, markAsRead };
