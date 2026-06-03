'use strict';

const axios = require('axios');

// ─── Base URL helper ──────────────────────────────────────────────────────────

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

// ─── Core POST helper ─────────────────────────────────────────────────────────

async function _post(payload) {
  try {
    const res = await axios.post(apiUrl('/messages'), payload, { headers: headers() });
    return res.data;
  } catch (err) {
    console.error('[Sender] Error:', JSON.stringify(err.response?.data || err.message));
    throw err;
  }
}

// ─── Send plain text ──────────────────────────────────────────────────────────

async function sendText(to, text) {
  const chunks = splitMessage(text, 4000);
  for (const chunk of chunks) {
    await _post({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: chunk }
    });
  }
}

// ─── Send YES / NO confirmation buttons ───────────────────────────────────────

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
          { type: 'reply', reply: { id: `confirm_yes_${sessionId}`, title: '✅ Yes, do it' } },
          { type: 'reply', reply: { id: `confirm_no_${sessionId}`,  title: '❌ Cancel'     } }
        ]
      }
    }
  });
}

// ─── Send list message (multiple CRM records) ─────────────────────────────────

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
      action: { button: buttonLabel, sections }
    }
  });
}

// ─── Mark message as read ─────────────────────────────────────────────────────

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

// ─── Split long messages ──────────────────────────────────────────────────────

function splitMessage(text, maxLen = 4000) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

module.exports = { sendText, sendConfirmation, sendList, markAsRead };
