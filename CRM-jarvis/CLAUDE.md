# FIVA — WhatsApp AI for Zoho CRM

## What this project is

FIVA is a Zoho CRM AI assistant (like a chatbot widget inside CRM). This project extends FIVA to **WhatsApp** — so authorised users can perform any CRM operation (read/write Leads, Contacts, Deals, Notes, etc.) by chatting on WhatsApp. The AI is powered by **Gemini**. Hosted on **Zoho Catalyst** (project: `CRM-whatsapp`).

---

## Catalyst project

- **Project name**: `CRM-whatsapp`
- **Project ID**: `17682000001808370`
- **Function name**: `FivaWebhook` (Advanced I/O, Node 20)
- **Function entry**: `functions/FivaWebhook/index.js` — exports Express `app`, no `app.listen()`
- **Base URL (dev)**: `https://crm-whatsapp-60040289923.development.catalystserverless.in/server/fivawebhook`
- **Deploy command**: `catalyst deploy` from project root

---

## Phase status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | WhatsApp webhook (Meta verification + echo bot) | ✅ Done |
| 2 | Zoho OAuth 2.0 + CRM REST client + DataStore token storage | ✅ Done |
| 3 | Gemini server-side AI orchestrator + per-user session management | ⏳ Next |
| 4 | Wire WhatsApp → Gemini → CRM tools → reply | ⏳ Pending |
| 5 | "Grant WhatsApp access to [number]" command from CRM widget | ⏳ Pending |
| 6 | UX polish — formatted replies, interactive buttons, list messages | ⏳ Pending |

---

## File map

```
functions/FivaWebhook/
├── index.js                    Express app (routes wired here)
├── package.json                Dependencies: express, axios, zcatalyst-sdk-node
├── catalyst-config.json        DO NOT MODIFY — Catalyst deployment config
│
├── whatsapp/
│   ├── webhook.js              Meta webhook: verifyWebhook + receiveMessage
│   └── sender.js               WhatsApp Cloud API: sendText, sendConfirmation, sendList, markAsRead
│
├── auth/
│   ├── zoho-oauth.js           OAuth 2.0 flow (getAuthUrl, exchangeCode, refreshAccessToken)
│   └── token-store.js          Saves/reads tokens in DataStore table "ZohoTokens"
│
├── crm/
│   └── zoho-client.js          Full CRM REST client — all tools Gemini can call
│
├── data/
│   └── authorized-numbers.js   DataStore table "AuthorizedNumbers" — who can use WhatsApp AI
│
└── api/
    └── access.js               Internal API: grant/revoke/list access (requires x-api-key header)
```

---

## DataStore tables (must exist in Catalyst Console)

### `AuthorizedNumbers` ✅ created
| Column | Type |
|--------|------|
| phone | Text |
| originalInput | Text |
| grantedBy | Text |
| grantedAt | Text |
| active | Text |
| revokedBy | Text |
| revokedAt | Text |

### `ZohoTokens` ✅ created
| Column | Type |
|--------|------|
| userId | Text |
| accessToken | Text |
| refreshToken | Text |
| expiresAt | Text |
| updatedAt | Text |

---

## Catalyst environment variables (set in Console → Functions → FivaWebhook → Configurations)

| Variable | Purpose |
|----------|---------|
| `WHATSAPP_ACCESS_TOKEN` | Meta permanent token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta WABA ID |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Custom token for Meta webhook verification |
| `WHATSAPP_API_VERSION` | e.g. `v25.0` |
| `INTERNAL_API_KEY` | Secret key for `/api/whatsapp/access` endpoints |
| `GEMINI_API_KEY` | (needed in Phase 3) Google AI Studio key |

> Zoho OAuth credentials are currently hardcoded in `auth/zoho-oauth.js` — move to env vars before production.

---

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/webhook` | Meta webhook verification handshake |
| POST | `/webhook` | Incoming WhatsApp messages |
| GET | `/auth/zoho` | Redirect to Zoho consent screen |
| GET | `/auth/callback` | Zoho OAuth callback — saves tokens |
| GET | `/auth/connect?code=xxx` | Manual Self Client code exchange |
| GET | `/auth/status` | Check if Zoho CRM is connected |
| POST | `/api/whatsapp/access` | Grant access to a phone number |
| DELETE | `/api/whatsapp/access` | Revoke access |
| GET | `/api/whatsapp/access` | List authorised numbers |

---

## How access control works

1. A phone number must be in `AuthorizedNumbers` table with `active = 'true'` to use the bot.
2. Access is granted via `POST /api/whatsapp/access` with `{ phoneNumber, grantedBy }` and `x-api-key` header.
3. Currently this API is called manually (Phase 5 will wire it from the CRM widget voice command).
4. Unauthorized users get a WhatsApp message telling them to ask their CRM manager.

---

## How Zoho OAuth works

1. Visit `/auth/zoho` in browser → redirects to Zoho India consent screen
2. Approve → Zoho redirects to `/auth/callback?code=xxx`
3. Tokens saved to `ZohoTokens` DataStore table
4. Every CRM API call uses `token-store.getValidAccessToken()` — auto-refreshes if within 5 min of expiry
5. Check connection: GET `/auth/status` → `{ "connected": true }`

---

## CRM tools available (zoho-client.js)

All of these are available for Gemini to call in Phase 3/4:

- `listModules()` — list all CRM modules
- `getModuleFields(moduleName)` — field schema for a module
- `searchRecords(module, searchTerm, fields, page, perPage)` — free-text search
- `getRecord(module, recordId, fields)` — fetch single record
- `createRecord(module, recordData)` — create new record
- `updateRecord(module, recordId, recordData)` — update record
- `deleteRecord(module, recordId)` — delete record
- `convertLead(leadId, options)` — convert lead to contact/account/deal
- `addNote(parentModule, parentId, noteTitle, noteContent)` — add note
- `runCoqlQuery(query)` — raw COQL query
- `getCurrentUser()` — logged-in CRM user
- `executeTool(toolName, args)` — unified dispatcher (used by Gemini bridge)

---

## Phase 3 — what needs to be built next

Build a Gemini AI orchestrator that:

1. **Session store** — `data/conversation-sessions.js`
   - DataStore table `ConversationSessions` (columns: `phone`, `history`, `updatedAt`)
   - Stores per-user Gemini conversation history as JSON string
   - Methods: `getHistory(phone)`, `saveHistory(phone, history)`, `clearHistory(phone)`

2. **Gemini bridge** — `ai/gemini-bridge.js`
   - Uses `@google/genai` SDK (Gemini 3.5 Flash or `	gemini-3.5-flash`)
   - System prompt: "You are FIVA, an AI assistant for Zoho CRM..."
   - Tool declarations matching all methods in `zoho-client.js`
   - Multi-turn: load history → send message → handle tool calls → save history → return final reply
   - Handles multi-step tool chains (e.g. search lead → read → update)

3. **Wire into webhook.js** `handleText()`
   - Replace echo stub with: `const reply = await gemini.chat(from, text, crmClient); await sender.sendText(from, reply);`
   - `/reset` command should call `sessions.clearHistory(from)`

4. **New DataStore table**: `ConversationSessions`
   | Column | Type |
   |--------|------|
   | phone | Text |
   | history | Text (JSON) |
   | updatedAt | Text |

---

## Zoho CRM region

India — all API calls go to:
- OAuth: `https://accounts.zoho.in/oauth/v2`
- CRM: `https://www.zohoapis.in/crm/v7`

---

## Key patterns

- **All DataStore access**: `catalyst.initialize(req, { type: 'admin' })` — required from public webhook endpoints
- **Factory pattern**: `createStore(catalystApp)`, `createTokenStore(catalystApp)`, `createCRMClient(tokenStore)`
- **No app.listen()** — Catalyst Advanced I/O exports the Express app as `module.exports = app`
- **ACK immediately**: `receiveMessage` sends `res.sendStatus(200)` before any async work — Meta requires 200 within 20s
