'use strict';

/**
 * gemini-bridge.js
 *
 * Gemini AI orchestrator for FIVA WhatsApp.
 *
 * createGeminiBridge() returns { chat(phone, text, crmClient, sessionStore) }
 *
 * Flow per message:
 *   1. Load conversation history from DataStore
 *   2. Send user message to Gemini (with CRM tool declarations)
 *   3. Loop: execute any tool calls → send results back → repeat
 *   4. Save updated history to DataStore
 *   5. Return final text reply
 *
 * Requires env var: GEMINI_API_KEY
 */

const { GoogleGenAI } = require('@google/genai');

const SYSTEM_PROMPT =
  'You are FIVA, an AI assistant embedded in Zoho CRM. You help authorised users manage ' +
  'CRM data (Leads, Contacts, Deals, Notes, etc.) through WhatsApp.\n\n' +

  'RECORD IDs — CRITICAL:\n' +
  '- NEVER guess or reuse a record ID from memory or history\n' +
  '- ALWAYS call search_records first and use the ID returned in that response\n' +
  '- If a search returns 0 results, tell the user — do not invent an ID\n\n' +

  'CREATING / UPDATING RECORDS — FORM FLOW:\n' +
  '1. Call getModuleFields(module) first to get the field schema including picklist options\n' +
  '2. Present ALL required fields in a single structured message, like a form:\n' +
  '   - List each required field on its own line: "*Field Name:* ___"\n' +
  '   - For picklist/dropdown fields, list the allowed values on the next line so the user can pick one\n' +
  '   - List optional fields at the bottom so the user can add them if needed\n' +
  '   - End with: "Reply with all values filled in"\n' +
  '3. Wait for the user to reply with the filled values — parse them from the reply\n' +
  '4. Call confirm_action with a clear one-line summary of what will happen\n' +
  '   IMPORTANT: NEVER ask for confirmation in plain text — ALWAYS use the confirm_action tool.\n' +
  '   The confirm_action tool sends interactive YES/NO buttons to the user.\n' +
  '5. Only call create_record / update_record / add_note AFTER confirm_action returns\n' +
  '- If a write fails, explain the exact error — do not retry with different formats more than once\n\n' +

  'NOTES:\n' +
  '- To add a note, use the add_note tool (not create_record)\n' +
  '- Notes do not support free-text search — fetch the parent record instead\n\n' +

  'COQL:\n' +
  '- Only use run_coql_query for complex filters not possible with search_records\n' +
  '- Syntax: SELECT Field1, Field2 FROM Module WHERE condition LIMIT n\n' +
  '- Use real field API names (Last_Name, Email) — never "id" as a SELECT field\n\n' +

  'REPLIES:\n' +
  '- Keep replies short — this is WhatsApp, not email\n' +
  '- Use *bold* for names/titles, _italic_ for status/stage\n' +
  '- Show at most 5 records per reply; offer to show more\n' +
  '- After completing an action, confirm briefly what was done\n' +
  '- Stay focused on CRM tasks; politely redirect off-topic questions\n\n' +

  `Today's date: ${new Date().toISOString().split('T')[0]}`;

const TOOL_DECLARATIONS = [
  {
    name: 'list_modules',
    description: 'List all available CRM modules (Leads, Contacts, Deals, etc.)',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'get_module_fields',
    description: 'Get the field schema for a CRM module',
    parameters: {
      type: 'object',
      properties: {
        module_name: {
          type: 'string',
          description: 'CRM module API name e.g. Leads, Contacts, Deals'
        }
      },
      required: ['module_name']
    }
  },
  {
    name: 'search_records',
    description: 'Search for records in a CRM module by keyword',
    parameters: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'CRM module e.g. Leads, Contacts, Deals' },
        search_term: { type: 'string', description: 'Search keyword or phrase' },
        fields:      {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific fields to return (optional)'
        },
        page:     { type: 'number', description: 'Page number, default 1' },
        per_page: { type: 'number', description: 'Records per page, max 200, default 10' }
      },
      required: ['module_name', 'search_term']
    }
  },
  {
    name: 'get_record',
    description: 'Fetch a single CRM record by its ID',
    parameters: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'CRM module name' },
        record_id:   { type: 'string', description: 'Record ID' },
        fields:      {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to return (optional)'
        }
      },
      required: ['module_name', 'record_id']
    }
  },
  {
    name: 'create_record',
    description: 'Create a new record in a CRM module. Do NOT use this for Notes — use add_note instead.',
    parameters: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'CRM module name e.g. Leads, Contacts, Deals' },
        record_data: {
          type: 'object',
          description: 'Record field values as key-value pairs matching the module field API names. For lookup fields pass { id: "record_id" }.'
        }
      },
      required: ['module_name', 'record_data']
    }
  },
  {
    name: 'update_record',
    description: 'Update an existing CRM record',
    parameters: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'CRM module name' },
        record_id:   { type: 'string', description: 'ID of the record to update' },
        record_data: {
          type: 'object',
          description: 'Fields to update as key-value pairs'
        }
      },
      required: ['module_name', 'record_id', 'record_data']
    }
  },
  {
    name: 'delete_record',
    description: 'Delete a CRM record by ID',
    parameters: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'CRM module name' },
        record_id:   { type: 'string', description: 'ID of the record to delete' }
      },
      required: ['module_name', 'record_id']
    }
  },
  {
    name: 'convert_lead',
    description: 'Convert a Lead into an Account, Contact, and optionally a Deal.',
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Lead record ID to convert' },
        deal: {
          type: 'object',
          description: 'Optional Deal to create during conversion e.g. { Deal_Name: "Acme Q3", Amount: 50000, Stage: "Qualification", Closing_Date: "2026-09-30" }',
          properties: {
            Deal_Name:    { type: 'string' },
            Amount:       { type: 'number' },
            Stage:        { type: 'string' },
            Closing_Date: { type: 'string' }
          }
        }
      },
      required: ['lead_id']
    }
  },
  {
    name: 'add_note',
    description: 'Attach a note to any CRM record. Use this instead of create_record for Notes — ' +
      'Notes has a non-obvious schema that is easy to get wrong. ' +
      'If you only know the record name (not the ID), pass parent_search and the tool will find it automatically.',
    parameters: {
      type: 'object',
      properties: {
        parent_module: { type: 'string', description: 'Module of the parent record e.g. Leads, Contacts, Deals' },
        parent_id:     { type: 'string', description: 'Record ID. Provide this if you already have it.' },
        parent_search: { type: 'string', description: 'Search term to find the parent record when you do not have the ID e.g. the lead name.' },
        note_title:    { type: 'string', description: 'Optional short title for the note' },
        note_content:  { type: 'string', description: 'Note body text (required)' }
      },
      required: ['parent_module', 'note_content']
    }
  },
  {
    name: 'run_coql_query',
    description: 'Run a COQL (CRM Object Query Language) query for complex data retrieval',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'COQL query e.g. SELECT Last_Name, Email FROM Leads WHERE Lead_Source = \'Web Site\' LIMIT 5'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_current_user',
    description: 'Get the currently authenticated Zoho CRM user',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'confirm_action',
    description: 'Ask the user to confirm a write operation before executing it. ' +
      'Call this BEFORE any create, update, delete, or convert operation.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Clear confirmation question, e.g. "Update lead John Doe status to Converted?"'
        },
        action_summary: {
          type: 'string',
          description: 'One-line summary of what will happen if the user confirms'
        }
      },
      required: ['question', 'action_summary']
    }
  }
];

const MAX_TOOL_ITERATIONS = 10;
const MAX_HISTORY_TURNS   = 10; // 5 user + 5 model = last 5 full exchanges

// Compact history to stay under DataStore Text column limit (~10 000 chars).
// Strategy: keep function calls (so Gemini remembers what it searched/found) but
// summarise large tool responses down to just IDs and key name fields.
function compactHistory(rawHistory) {
  const out = [];
  for (const turn of rawHistory) {
    if (!turn?.parts) continue;
    const parts = turn.parts.map(p => {
      if (typeof p.text === 'string' && p.text.length > 0) return p;
      if (p.functionCall) return p; // keep — Gemini needs to remember what it called
      if (p.functionResponse) {
        return {
          functionResponse: {
            ...p.functionResponse,
            response: _summariseResponse(p.functionResponse.name, p.functionResponse.response)
          }
        };
      }
      return null;
    }).filter(Boolean);
    if (parts.length > 0) out.push({ role: turn.role, parts });
  }
  return out.slice(-MAX_HISTORY_TURNS);
}

// Reduce a CRM tool response to the minimum needed for Gemini to continue.
// Key goal: preserve record IDs so Gemini can act on confirmed operations.
function _summariseResponse(_toolName, response) {
  if (!response || response.error) return response;

  if (response.records?.length !== undefined) {
    return {
      records: response.records.slice(0, 5).map(r => ({
        id:           r.id,
        Full_Name:    r.Full_Name,
        Last_Name:    r.Last_Name,
        First_Name:   r.First_Name,
        Email:        r.Email,
        Company:      r.Company,
        Account_Name: r.Account_Name,
        Deal_Name:    r.Deal_Name,
        Subject:      r.Subject
      })).filter(r => r.id),
      total: response.records.length
    };
  }

  if (response.items?.length !== undefined) {
    // list_modules / get_module_fields — keep but cap length
    return { items: response.items.slice(0, 15) };
  }

  // Single record or action result — keep as-is if small, otherwise truncate
  const str = JSON.stringify(response);
  return str.length <= 400 ? response : { summary: str.substring(0, 400) };
}

function createGeminiBridge() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  /**
   * Send a message from a WhatsApp user through Gemini and return the AI reply.
   *
   * @returns {Promise<{type:'text'|'confirmation', reply:string}>}
   *   type='text'         — send as plain text
   *   type='confirmation' — send as YES/NO interactive buttons
   */
  async function chat(phone, text, crmClient, sessionStore) {
    const history = await sessionStore.getHistory(phone);

    const chatParams = {
      model: 'gemini-3.5-flash',
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }]
      }
    };
    if (history.length > 0) chatParams.history = history;

    const geminiChat = ai.chats.create(chatParams);
    let response = await geminiChat.sendMessage({ message: text });

    // Write operations always require prior user confirmation.
    // We detect confirmed turns by the message prefix set in webhook.js.
    const isConfirmedTurn = text.startsWith('Yes confirmed. Please proceed');
    const WRITE_TOOLS = new Set(['create_record', 'update_record', 'delete_record', 'convert_lead', 'add_note']);

    // ── Tool call loop ──────────────────────────────────────────────────────────
    let iterations = 0;
    let needsConfirmation   = false;
    let _lastConfirmSummary = '';
    let _pendingWriteCall   = null; // exact tool call to execute on YES — eliminates hallucination
    const toolErrorCount    = {};

    while (response.functionCalls?.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const toolResponses = [];
      for (const fc of response.functionCalls) {
        console.log(`[Gemini] Tool call #${iterations}: ${fc.name}`, JSON.stringify(fc.args));

        // confirm_action is not a CRM call — it's a signal to show YES/NO buttons
        if (fc.name === 'confirm_action') {
          needsConfirmation   = true;
          _lastConfirmSummary = fc.args.action_summary || fc.args.question || '';
          toolResponses.push({
            functionResponse: {
              ...(fc.id ? { id: fc.id } : {}),
              name:     'confirm_action',
              response: { status: 'awaiting_user_confirmation' }
            }
          });
          continue;
        }

        // Server-side enforcement: block write tools unless user has explicitly confirmed.
        // Capture the exact call so webhook.js can execute it directly on YES — no hallucination.
        if (WRITE_TOOLS.has(fc.name) && !isConfirmedTurn) {
          needsConfirmation   = true;
          _pendingWriteCall   = _pendingWriteCall || { name: fc.name, args: fc.args };
          _lastConfirmSummary = _lastConfirmSummary ||
            `${fc.name.replace(/_/g, ' ')} on ${fc.args.module_name || fc.args.lead_id || 'record'}`;
          toolResponses.push({
            functionResponse: {
              ...(fc.id ? { id: fc.id } : {}),
              name:     fc.name,
              response: { status: 'pending_confirmation' }
            }
          });
          continue;
        }

        let result;
        try {
          result = await crmClient.executeTool(fc.name, fc.args);
          toolErrorCount[fc.name] = 0; // reset on success
        } catch (err) {
          console.error(`[Gemini] Tool error: ${fc.name}`, err.message);
          toolErrorCount[fc.name] = (toolErrorCount[fc.name] || 0) + 1;
          // After 2 consecutive failures on the same tool, tell Gemini to stop retrying
          result = toolErrorCount[fc.name] >= 2
            ? { error: err.message, advice: 'Do not retry this operation. Inform the user of the failure.' }
            : { error: err.message };
        }

        // functionResponse.response must be a Struct (object), never an array or null
        let safeResponse;
        if (result === null || result === undefined) {
          safeResponse = { result: 'null' };
        } else if (Array.isArray(result)) {
          safeResponse = { items: result };
        } else {
          safeResponse = result;
        }

        toolResponses.push({
          functionResponse: {
            ...(fc.id ? { id: fc.id } : {}),
            name:     fc.name,
            response: safeResponse
          }
        });
      }

      response = await geminiChat.sendMessage({ message: toolResponses });

      // Stop loop after confirm_action — don't let Gemini execute the write yet
      if (needsConfirmation) break;
    }

    // ── Persist updated history (text-only, compacted) ─────────────────────────
    try {
      await sessionStore.saveHistory(phone, compactHistory(geminiChat.getHistory()));
    } catch (err) {
      console.error('[Gemini] Failed to save history:', err.message);
    }

    const reply = response.text || 'Sorry, I couldn\'t generate a response. Please try again.';

    // Fallback: Gemini sometimes asks for confirmation in plain text instead of
    // calling confirm_action. Detect this and send interactive buttons anyway.
    if (!needsConfirmation) {
      const CONFIRM_RE = /\b(confirm|shall i|should i|want me to|proceed|go ahead|do you want|approve)\b.*\?/i;
      if (CONFIRM_RE.test(reply)) {
        needsConfirmation   = true;
        _lastConfirmSummary = _lastConfirmSummary || reply.substring(0, 120);
        console.log('[Gemini] Detected confirmation in text — converting to buttons');
      }
    }

    if (needsConfirmation) {
      const buttonBody = reply.length > 1024 ? reply.substring(0, 1020) + '…' : reply;
      return {
        type:         'confirmation',
        reply:        buttonBody,
        actionSummary: _lastConfirmSummary,
        pendingTool:  _pendingWriteCall   // exact tool call — executed directly on YES
      };
    }
    return { type: 'text', reply };
  }

  return { chat };
}

module.exports = { createGeminiBridge };
