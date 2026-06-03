'use strict';

const catalyst                  = require('zcatalyst-sdk-node');
const { createStore }           = require('../data/authorized-numbers');
const { createSessionStore }    = require('../data/conversation-sessions');
const { createTokenStore }      = require('../auth/token-store');
const { createCRMClient }       = require('../crm/zoho-client');
const { createGeminiBridge }    = require('../ai/gemini-bridge');
const sender                    = require('./sender');

// ─── In-memory state (survives between requests in same process) ─────────────

const _lastMsgTime    = new Map(); // phone → timestamp  (rate limiting)
const _pendingActions = new Map(); // phone → actionSummary  (confirmation flow)

function isRateLimited(phone) {
  const now  = Date.now();
  const last = _lastMsgTime.get(phone) || 0;
  if (now - last < 3000) return true; // 3-second cooldown per user
  _lastMsgTime.set(phone, now);
  return false;
}

// ─── GET /webhook — Meta verification handshake ───────────────────────────────

function verifyWebhook(req, res) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verified');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] ❌ Verification failed');
  return res.sendStatus(403);
}

// ─── POST /webhook — incoming WhatsApp messages ───────────────────────────────

async function receiveMessage(req, res) {
  res.sendStatus(200); // ACK immediately — Meta retries if no 200 within 20s

  try {
    const catalystApp = catalyst.initialize(req, { type: 'admin' });
    const numStore    = createStore(catalystApp);

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const value = body.entry?.[0]?.changes?.[0]?.value;
    if (!value) return;
    if (value.statuses) return; // delivery/read receipts — ignore

    const messages = value.messages;
    if (!messages?.length) return;

    const message = messages[0];
    const from    = message.from;
    const msgId   = message.id;
    const type    = message.type;

    console.log(`[Webhook] 📩 From: ${from} | Type: ${type}`);

    if (isRateLimited(from)) {
      console.log(`[Webhook] Rate limited: ${from}`);
      return;
    }

    sender.markAsRead(msgId).catch(() => {}); // best-effort blue ticks

    // ── Auth check ────────────────────────────────────────────────────────────
    if (!(await numStore.isAuthorized(from))) {
      await sender.sendText(
        from,
        '⛔ You don\'t have access to FIVA AI.\n\n' +
        'Ask your Zoho CRM manager to grant access by saying:\n' +
        '*"Grant WhatsApp access to [your number]"* in the CRM AI widget.'
      );
      return;
    }

    // ── Route by message type ─────────────────────────────────────────────────
    switch (type) {
      case 'text': {
        const text = message.text?.body?.trim();
        if (text) await handleText(from, text, catalystApp);
        break;
      }
      case 'interactive':
        await handleInteractive(from, message.interactive, catalystApp);
        break;
      case 'image':
      case 'audio':
      case 'video':
      case 'document':
        await sender.sendText(from,
          `📎 *${type.charAt(0).toUpperCase() + type.slice(1)}* messages aren't supported yet.\n` +
          'Please describe what you need in text 💬'
        );
        break;
      default:
        await sender.sendText(from, '🤔 I received something I don\'t understand. Please send a text message!');
    }

  } catch (err) {
    console.error('[Webhook] Error:', err);
  }
}

// ─── Text handler ─────────────────────────────────────────────────────────────

async function handleText(from, text, catalystApp) {
  const lower = text.toLowerCase().trim();

  if (lower === '/reset' || lower === 'reset') {
    const sessions = createSessionStore(catalystApp);
    await sessions.clearHistory(from);
    await sender.sendText(from, '🔄 Conversation reset! How can I help you?');
    return;
  }

  if (lower === '/help' || lower === 'help') {
    await sender.sendText(from, helpMessage());
    return;
  }

  // ── Gemini AI orchestrator ─────────────────────────────────────────────────
  try {
    const tokenStore = createTokenStore(catalystApp);
    const crmClient  = createCRMClient(tokenStore);
    const sessions   = createSessionStore(catalystApp);
    const gemini     = createGeminiBridge();

    const result = await gemini.chat(from, text, crmClient, sessions);
    if (result.type === 'confirmation') {
      _pendingActions.set(from, {
        summary: result.actionSummary || '',
        tool:    result.pendingTool   || null   // exact call to run on YES
      });
      await sender.sendConfirmation(from, result.reply, from);
    } else {
      await sender.sendText(from, result.reply);
    }
  } catch (err) {
    console.error('[handleText] Gemini error:', err.message, err.stack);
    await sender.sendText(
      from,
      '❌ Something went wrong while processing your request. Please try again.\n\n' +
      '_If the problem persists, type /reset to start a fresh conversation._'
    );
  }
}

// ─── Interactive (button / list) handler ──────────────────────────────────────

async function handleInteractive(from, interactive, catalystApp) {
  if (!interactive) return;

  if (interactive.type === 'button_reply') {
    const id = interactive.button_reply?.id || '';

    if (id.startsWith('confirm_yes_')) {
      const pending = _pendingActions.get(from) || {};
      _pendingActions.delete(from);
      console.log(`[Webhook] ✅ YES confirmed: ${pending.summary || '(no summary)'}`);

      if (pending.tool) {
        // Execute the exact captured tool call directly — zero hallucination risk
        try {
          const tokenStore = createTokenStore(catalystApp);
          const crmClient  = createCRMClient(tokenStore);
          const toolResult = await crmClient.executeTool(pending.tool.name, pending.tool.args);
          console.log(`[Webhook] ✅ Direct execution: ${pending.tool.name}`, JSON.stringify(toolResult));
          await sender.sendText(from, `✅ Done! ${pending.summary}`);
        } catch (err) {
          console.error(`[Webhook] Direct execution failed: ${pending.tool.name}`, err.message);
          await sender.sendText(from, `❌ Failed: ${err.message}`);
        }
      } else {
        // No captured tool call (confirm_action was proactive) — fall back to Gemini
        const msg = `Yes confirmed. Please proceed with: ${pending.summary || 'the requested action'}`;
        await handleText(from, msg, catalystApp);
      }
    } else if (id.startsWith('confirm_no_')) {
      _pendingActions.delete(from);
      await handleText(from, 'No, please cancel that action.', catalystApp);
    }

  } else if (interactive.type === 'list_reply') {
    const title = interactive.list_reply?.title || '';
    await handleText(from, title, catalystApp);
  }
}

// ─── Help message ─────────────────────────────────────────────────────────────

function helpMessage() {
  return (
    '*🤖 FIVA — CRM AI on WhatsApp*\n\n' +
    '📋 *Read data*\n' +
    '• "Show me my open leads"\n' +
    '• "Find contact John Smith"\n' +
    '• "What deals are closing this month?"\n\n' +
    '✏️ *Update data*\n' +
    '• "Create a new lead: Jane Doe, jane@example.com"\n' +
    '• "Update deal stage to Proposal"\n' +
    '• "Add a note to this contact"\n\n' +
    '🔧 *Commands*\n' +
    '• /reset — clear conversation history\n' +
    '• /help  — show this message\n\n' +
    '_Powered by Gemini + Zoho CRM_'
  );
}

module.exports = { verifyWebhook, receiveMessage };
