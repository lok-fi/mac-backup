# AI "Send Email" Feature — Implementation Guide

> **Purpose of this file:** This is a complete, self-contained guide for rebuilding the
> "tell the AI to send an email" feature in another project. It is written so that an AI
> assistant (e.g. Claude) reading it in a new codebase can understand the architecture and
> implement it step by step. Copy the patterns, adapt the data fields to your own project.

---

## 1. What this feature does (in plain words)

A user talks to an AI assistant (by **typing** or by **voice**). When the user says something
like *"email this report to bob@example.com as a PDF"*, the AI:

1. Understands the intent and extracts the **recipient**, the **format** (link vs PDF), and any
   filters (e.g. "only the sales tab").
2. The browser optionally **screenshots the dashboard into a PDF**.
3. The browser sends the request to a **backend endpoint**.
4. The backend builds a nice **HTML email** and sends it via **SMTP (nodemailer)**.
5. The AI confirms back to the user ("✅ sent to bob@example.com").

---

## 2. Architecture overview

There are **two ways** the user can trigger email, but they both end at the same backend endpoint:

```
  TEXT chat  ─►  POST /ask  (AI returns JSON action)  ─┐
                                                       ├─►  POST /send-email  ─►  nodemailer (SMTP)  ─►  inbox
  VOICE      ─►  Gemini Live "sendEmail" tool call  ───┘
```

- **Text path:** The frontend asks the backend `/ask`. The AI (Gemini) replies with JSON
  containing an `actions` array. If it contains `{type:"sendEmail", ...}`, the frontend acts on it.
- **Voice path:** The Gemini **Live** session is given a `sendEmail` **tool/function declaration**.
  When the model calls it, a callback in the frontend handles it.
- **Both paths** call `POST /send-email`, which does the actual sending.

---

## 3. Dependencies you need

**Backend (Node.js):**
```bash
npm install nodemailer express
```

**Frontend (React), only if you want PDF screenshots:**
```bash
npm install html2canvas jspdf @google/genai
```

---

## 4. Credentials (IMPORTANT — read the security note)

This project currently used a **Gmail SMTP App Password** and a **Gemini API key**.

```
# SMTP (Gmail) — used by the backend to actually send mail
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 465
SMTP_USER = sherlockloke@gmail.com
SMTP_PASS = ryvm bvoa rfnv npxt      # Gmail "App Password" (16 chars, spaces ok)

# Gemini API key — used by both the AI chat and the voice session
GEMINI_API_KEY = AIzaSyD9yr6Wixjx7_0BNSTUPEjIoAX_f-dfcMk
```

> ### ⚠️ SECURITY — DO THIS DIFFERENTLY IN THE NEW PROJECT
> In the original project these were **hardcoded in the source**, which is unsafe. In your new
> project:
> 1. **Put them in environment variables** (a `.env` file that is git-ignored), never in code.
> 2. **Rotate / regenerate** these specific keys before reuse — they have been shared in plaintext.
> 3. The Gemini key, if used in the **browser**, is visible to anyone. Prefer proxying AI calls
>    through your backend so the key never ships to the client.
> 4. Use a **real domain sender** (not a personal Gmail) so mail doesn't land in spam.
>
> **How to make a Gmail App Password:** Google Account → Security → 2-Step Verification (must be ON)
> → App passwords → generate one for "Mail". That 16-character string is your `SMTP_PASS`.

Create a `.env` file:
```
SMTP_USER=your_sender@gmail.com
SMTP_PASS=your_16_char_app_password
GEMINI_API_KEY=your_gemini_key
```
And load it (`require('dotenv').config()` at the top of the backend, or use your platform's secret manager).

---

## 5. STEP-BY-STEP IMPLEMENTATION

### STEP 1 — Backend: the SMTP transporter

Create the mail transporter once, at module level.

```js
const nodemailer = require('nodemailer');

const mailer = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 465,
    secure: true,                      // true for port 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
```

### STEP 2 — Backend: the `/send-email` endpoint

This is the endpoint that actually sends. It receives the recipient + (optional) PDF + data,
builds an HTML email, and sends it.

```js
app.post('/send-email', async (req, res) => {
    try {
        const { to, toName, subject, format, pdfBase64, /* ...your data... */ } = req.body;

        // 1. Validate
        if (!to) return res.status(400).json({ error: 'Recipient email is required' });

        const sendFormat = format === 'pdf' ? 'pdf' : 'link';
        const greeting   = toName ? `Hi ${toName},` : 'Hi,';

        // 2. Build the HTML body (style it however you like).
        //    For a "link" email, embed a button/URL. For "pdf", just describe the attachment.
        const dashboardUrl = 'https://your-app-url.example.com';
        const html = `
          <div style="font-family:Arial,sans-serif;color:#222">
            <h2>${greeting}</h2>
            <p>Here is your report.</p>
            ${sendFormat === 'pdf'
              ? `<p>📄 The PDF report is attached to this email.</p>`
              : `<p><a href="${dashboardUrl}">Open the live dashboard →</a></p>`}
          </div>`;

        // 3. Plain-text fallback (good for spam scores + clients without HTML)
        const plainText = `${greeting}\n\nHere is your report.\n` +
            (sendFormat === 'pdf' ? 'PDF attached.' : `Open: ${dashboardUrl}`);

        // 4. Attach the PDF if one was sent from the browser
        const attachments = (sendFormat === 'pdf' && pdfBase64)
            ? [{ filename: 'report.pdf',
                 content: Buffer.from(pdfBase64, 'base64'),
                 contentType: 'application/pdf' }]
            : [];

        // 5. Send
        await mailer.sendMail({
            from: '"Your App Name" <your_sender@gmail.com>',
            to,
            subject: subject || 'Your Report',
            html,
            text: plainText,
            attachments,
        });

        return res.status(200).json({ success: true, message: `Sent to ${to}` });
    } catch (err) {
        console.error('POST /send-email error:', err);
        return res.status(500).json({ error: err.message });
    }
});
```

> **Key idea:** the backend does NOT decide *whether* to send — it just sends whatever it's
> told. The "should I send, and to whom?" decision is made by the AI (next steps).

### STEP 3 — Backend: the `/ask` endpoint (TEXT path AI brain)

The AI is told (via a system prompt) to always reply with JSON: `{ "reply": "...", "actions": [...] }`.
One of the allowed actions is `sendEmail`. This is how the AI signals "the user wants to send mail."

```js
app.post('/ask', async (req, res) => {
    try {
        const { question, history } = req.body;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        const systemInstruction = `You are an AI assistant embedded in our app.

RESPONSE FORMAT — always respond with ONLY valid JSON, no markdown fences:
{
  "reply": "Your natural-language answer to the user",
  "actions": []
}

ACTION TYPES you may put in "actions":
{ "type": "sendEmail", "to": "email@example.com", "toName": "Name", "format": "link" | "pdf" }

EMAIL RULES:
- If the user wants to send/email/share something, extract the email address AND the format.
- If the format ("link" or "pdf") was NOT stated, ASK the user before emitting sendEmail.
- Only emit sendEmail once you know both the recipient and the format.`;

        // Call Gemini (REST or @google/genai SDK) with systemInstruction + question + history.
        // Parse its JSON response into { reply, actions }.
        const { reply, actions } = await callGemini(GEMINI_API_KEY, systemInstruction, question, history);

        return res.status(200).json({ reply, actions });
    } catch (err) {
        console.error('POST /ask error:', err);
        return res.status(500).json({ error: err.message });
    }
});
```

> **Why JSON?** It lets the AI both *talk* (`reply`) and *act* (`actions`) in one response.
> The frontend reads `actions` and performs UI side-effects (including sending email).

### STEP 4 — Frontend: handle the AI's `sendEmail` action (TEXT path)

After calling `/ask`, loop over `data.actions`. When you see `sendEmail`, optionally make the PDF,
then POST to `/send-email`.

```js
const res  = await fetch("/server/send-email-app/ask", {     // adjust path to your routes
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
});
const data = await res.json();

// Show the AI's text reply in the chat...
showAssistantMessage(data.reply);

// ...then act on any actions it returned
for (const a of (data.actions || [])) {
    if (a.type === "sendEmail") {
        try {
            let pdfBase64 = null;
            if (a.format === "pdf") {
                pdfBase64 = await captureDashboardPDF();   // see STEP 6
            }
            const emailRes = await fetch("/server/send-email-app/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: a.to,
                    toName: a.toName || "",
                    format: a.format || "link",
                    pdfBase64,
                    /* ...any data your email needs... */
                }),
            });
            const emailData = await emailRes.json();
            if (!emailRes.ok) throw new Error(emailData.error);
            showAssistantMessage(`✅ Sent to ${a.to}`);
        } catch (e) {
            showAssistantMessage(`❌ Failed to send: ${e.message}`);
        }
    }
}
```

### STEP 5 — Frontend: VOICE path (Gemini Live tool calling)

If you want voice control, declare `sendEmail` as a **tool** for the Gemini Live session.

**5a. Declare the tool:**
```js
export const TOOLS = [{
  functionDeclarations: [
    {
      name: "sendEmail",
      description: "Send the report by email. Ask the user for link-vs-PDF if not specified.",
      parameters: {
        type: "OBJECT",
        properties: {
          to:     { type: "STRING", description: "Recipient email address" },
          toName: { type: "STRING", description: "Recipient's name (optional)" },
          format: { type: "STRING", description: "'link' or 'pdf'" },
        },
        required: ["to", "format"],
      },
    },
  ],
}];
```

**5b. Pass the tools when connecting the live session** and handle the tool call. When Gemini
fires a tool call, run your handler and **send the result back** so the model can confirm:

```js
// inside the live session's onmessage handler:
const calls = msg.toolCall?.functionCalls;
if (calls?.length) {
    const session   = await this.sessionPromise;
    const responses = await Promise.all(calls.map(async (call) => {
        const result = await onToolCall(call.name, call.args);   // your handler below
        return { name: call.name, response: { result }, id: call.id };
    }));
    session.sendToolResponse({ functionResponses: responses });
}
```

**5c. The `onToolCall` handler** (same email-sending logic as STEP 4, but returns a result
object the voice model can read):
```js
onToolCall: async (name, args) => {
    if (name === "sendEmail") {
        try {
            let pdfBase64 = null;
            if (args.format === "pdf") pdfBase64 = await captureDashboardPDF();

            const emailRes = await fetch("/server/send-email-app/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: args.to, toName: args.toName || "",
                                       format: args.format || "link", pdfBase64 }),
            });
            const emailData = await emailRes.json();
            if (!emailRes.ok) throw new Error(emailData.error);
            return { success: true, message: `Email sent to ${args.to}` };   // ← model reads this
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}
```

### STEP 6 — Frontend: capture the page as a PDF (optional, for `format: "pdf"`)

Uses `html2canvas` to screenshot DOM elements and `jspdf` to assemble a PDF. Returns base64
(no data-URI prefix) so the backend can `Buffer.from(..., 'base64')` it.

```js
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

async function captureDashboardPDF() {
    const pdf  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    // List the DOM elements (one per "page"). Adapt selectors to your app.
    const elements = document.querySelectorAll(".pdf-capture-section");

    let first = true;
    for (const el of elements) {
        const canvas  = await html2canvas(el, { scale: 2, backgroundColor: "#0f0f0f" });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const ratio   = Math.min(pdfW / canvas.width, pdfH / canvas.height);
        const imgW    = canvas.width  * ratio;
        const imgH    = canvas.height * ratio;
        if (!first) pdf.addPage();
        pdf.addImage(imgData, "JPEG", (pdfW - imgW) / 2, 0, imgW, imgH);
        first = false;
    }
    return pdf.output("datauristring").split(",")[1];   // base64 only
}
```

---

## 6. The full request flow, summarized

1. **User** (types or speaks): *"send the report to bob@x.com as a pdf"*
2. **AI** extracts `{ to: "bob@x.com", format: "pdf" }`
   - Text path → returns it inside `actions`
   - Voice path → calls the `sendEmail` tool
3. **Frontend** sees `sendEmail`, calls `captureDashboardPDF()` → base64 PDF
4. **Frontend** → `POST /send-email` with `{ to, toName, format, pdfBase64 }`
5. **Backend** builds HTML + attaches PDF + `mailer.sendMail(...)`
6. **Backend** → `{ success: true }`
7. **Frontend/AI** confirms: *"✅ Sent to bob@x.com"*

---

## 7. Checklist for the new project

- [ ] `npm install nodemailer express` (backend) and `html2canvas jspdf @google/genai` (frontend, if needed)
- [ ] Put `SMTP_USER`, `SMTP_PASS`, `GEMINI_API_KEY` in `.env` (git-ignored) — **rotate the shared keys**
- [ ] Add the `mailer` transporter (STEP 1)
- [ ] Add `POST /send-email` (STEP 2)
- [ ] Add `POST /ask` with the JSON system prompt incl. `sendEmail` action (STEP 3)
- [ ] Frontend: handle `sendEmail` from `/ask` response (STEP 4)
- [ ] (Optional) Voice: declare the tool + handle the tool call (STEP 5)
- [ ] (Optional) PDF capture helper (STEP 6)
- [ ] Use a real sender domain; validate/authorize recipients before sending
```
