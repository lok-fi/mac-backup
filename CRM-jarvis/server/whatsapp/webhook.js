/**
 * webhook.js
 *
 * Handles all inbound traffic from Meta's WhatsApp Cloud API.
 *
 * GET  /webhook  →  verifyWebhook   (one-time Meta verification handshake)
 * POST /webhook  →  receiveMessage  (every incoming message from users)
 *
 * Message routing:
 *   1. Always ACK with 200 immediately (Meta retries if it doesn't get 200 fast)
 *   2. Check if sender is an authorized number
 *   3. Route message type (text / button reply / unsupported)
 *   4. Phase 1: echo bot — later phases plug in the Gemini orchestrator here
 */

'use strict';

const authorizedNumbers = require('../data/authorized-numbers');
const sender            = require('./sender');

// ─── Verification handshake (GET /webhook) ────────────────────────────────────
//
// Meta sends:
//   GET /webhook?hub.mode=subscribe&hub.verify_token=<your_token>&hub.challenge=<number>
//
// We must reply with hub.challenge if the token matches.

function verifyWebhook(req, res) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verification successful');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] ❌ Verification failed — token mismatch or wrong mode');
  return res.sendStatus(403);
}

// ─── Incoming message handler (POST /webhook) ────────────────────────────────

async function receiveMessage(req, res) {
  // Step 1: ACK immediately — Meta expects 200 within 20 seconds or it retries
  res.sendStatus(200);

  try {
    const body = req.body;

    // Safety check: only process whatsapp_business_account events
    if (body.object !== 'whatsapp_business_account') return;

    const entry   = body.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;

    if (!value) return;

    // ── Status updates (delivered, read) — ignore ─────────────────────────
    if (value.statuses) return;

    // ── Extract message ───────────────────────────────────────────────────
    const messages = value.messages;
    if (!messages || messages.length === 0) return;

    const message = messages[0];
    const from    = message.from;      // sender's phone number (digits only)
    const msgId   = message.id;        // wamid — used to mark as read
    const type    = message.type;      // 'text' | 'interactive' | 'image' | 'audio' ...

    console.log(`[Webhook] 📩 Message from ${from} | type: ${type}`);

    // Mark as read (shows blue ticks) — non-blocking, best effort
    sender.markAsRead(msgId).catch(() => {});

    // ── Authorization check ───────────────────────────────────────────────
    if (!authorizedNumbers.isAuthorized(from)) {
      await sender.sendText(
        from,
        '⛔ You don\'t have access to FIVA AI assistant.\n\n' +
        'Ask your Zoho CRM manager to grant you access by saying:\n' +
        '*"Grant WhatsApp access to [your number]"* in the CRM AI widget.'
      );
      console.log(`[Webhook] ⛔ Unauthorized number: ${from}`);
      return;
    }

    // ── Route by message type ─────────────────────────────────────────────
    switch (type) {

      case 'text': {
        const text = message.text?.body?.trim();
        if (!text) return;
        await handleTextMessage(from, text, msgId);
        break;
      }

      case 'interactive': {
        // Button replies (YES/NO confirmations) and list selections
        await handleInteractiveMessage(from, message.interactive, msgId);
        break;
      }

      case 'image':
      case 'audio':
      case 'video':
      case 'document': {
        // Phase 1: unsupported — politely inform user
        await sender.sendText(
          from,
          `📎 *${type.charAt(0).toUpperCase() + type.slice(1)} messages* aren't supported yet.\n\n` +
          'Please describe what you need in text and I\'ll help you! 💬'
        );
        break;
      }

      default: {
        // Stickers, reactions, location, etc.
        await sender.sendText(
          from,
          '🤔 I received something I don\'t understand yet. Please send a text message!'
        );
      }
    }

  } catch (err) {
    // Never let an unhandled error stop 200 from being sent (already sent above)
    console.error('[Webhook] Unhandled error in receiveMessage:', err);
  }
}

// ─── Text message handler ─────────────────────────────────────────────────────

async function handleTextMessage(from, text, msgId) {
  // ── Special commands ──────────────────────────────────────────────────────
  const lower = text.toLowerCase();

  if (lower === '/reset' || lower === 'reset') {
    // TODO Phase 4: clear conversation history for this user
    await sender.sendText(from, '🔄 Conversation reset! How can I help you?');
    return;
  }

  if (lower === '/help' || lower === 'help') {
    await sender.sendText(from, getHelpMessage());
    return;
  }

  // ── Phase 1 echo bot ──────────────────────────────────────────────────────
  // TODO Phase 4: replace this block with the Gemini orchestrator call
  //   const response = await geminiOrchestrator.process(from, text);
  //   await sender.sendText(from, response);

  await sender.sendText(
    from,
    `✅ *FIVA is connected!*\n\n` +
    `I received your message:\n_"${text}"_\n\n` +
    `🔧 *AI processing is coming in Phase 4.*\n` +
    `Right now this is the echo test — everything is wired correctly!`
  );

  console.log(`[Webhook] ✅ Echo reply sent to ${from}`);
}

// ─── Interactive message handler ──────────────────────────────────────────────

async function handleInteractiveMessage(from, interactive, msgId) {
  if (!interactive) return;

  if (interactive.type === 'button_reply') {
    const buttonId    = interactive.button_reply?.id   || '';
    const buttonTitle = interactive.button_reply?.title || '';

    console.log(`[Webhook] 🔘 Button reply from ${from}: ${buttonId}`);

    if (buttonId.startsWith('confirm_yes_')) {
      // TODO Phase 4: retrieve pending action from session and execute it
      await sender.sendText(from, '✅ Got it! Action confirmed.\n_(AI execution coming in Phase 4)_');
    } else if (buttonId.startsWith('confirm_no_')) {
      await sender.sendText(from, '❌ Action cancelled. What else can I help you with?');
    } else {
      await sender.sendText(from, `You tapped: *${buttonTitle}*`);
    }

  } else if (interactive.type === 'list_reply') {
    const rowId    = interactive.list_reply?.id    || '';
    const rowTitle = interactive.list_reply?.title || '';
    // TODO Phase 4: handle list selections (e.g. select a record from results)
    await sender.sendText(from, `📋 You selected: *${rowTitle}*\n_(list handling coming in Phase 4)_`);
  }
}

// ─── Help message ─────────────────────────────────────────────────────────────

function getHelpMessage() {
  return (
    '*🤖 FIVA — CRM AI on WhatsApp*\n\n' +
    'You can ask me anything about your Zoho CRM:\n\n' +
    '📋 *Read data*\n' +
    '• "Show me my open leads"\n' +
    '• "Find contact John Smith"\n' +
    '• "What deals are closing this month?"\n\n' +
    '✏️ *Update data*\n' +
    '• "Create a new lead: Jane Doe, jane@example.com"\n' +
    '• "Update deal #123 stage to Proposal"\n' +
    '• "Add a note to John Smith\'s contact"\n\n' +
    '🔧 *Commands*\n' +
    '• /reset — clear conversation history\n' +
    '• /help  — show this message\n\n' +
    '_Powered by Gemini + Zoho CRM_'
  );
}

module.exports = { verifyWebhook, receiveMessage };
