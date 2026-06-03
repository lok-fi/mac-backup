/* global ZOHO, GeminiClient, CRMTools, Settings, Multimodal */
/**
 * Main controller:
 *   - Boot the ZOHO Embedded SDK so ZOHO.CRM.* JS APIs are usable.
 *   - Wire chat UI <-> Gemini <-> CRMTools.
 *   - Multimodal input: text + image attachments + voice.
 *   - Maintain `contents` (Gemini conversation) and the on-screen message log.
 *   - Gate destructive tool calls behind a confirmation card when settings.confirmWrites is on.
 */
(function () {
  "use strict";

  // --------- State ---------
  const state = {
    settings: Settings.load(),
    contents: [],          // Gemini-format conversation
    attachments: [],       // pending image parts for the next user turn: [{ mimeType, data, _previewUrl, ... }]
    busy: false,
    abortController: null,
    user: null,
    voice: null,           // VoiceInput instance
    voiceBuffer: "",       // text accumulated during current voice session
    toolGroup: null,       // currently-open tool group for this user turn
    live: null,            // active LiveChat session
    turnApproved: false,         // user has approved writes for the CURRENT user message
    conversationApproved: false, // user has approved writes for the WHOLE chat
  };

  // --------- DOM refs ---------
  const chatEl = document.getElementById("chat");
  const inputEl = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const composer = document.getElementById("composer");
  const ctxLine = document.getElementById("ctxLine");
  const emptyState = document.getElementById("emptyState");
  const newChatBtn = document.getElementById("newChatBtn");
  const attachBtn = document.getElementById("attachBtn");
  const fileInput = document.getElementById("fileInput");
  const micBtn = document.getElementById("micBtn");
  const attachmentsEl = document.getElementById("attachments");
  const dropOverlay = document.getElementById("dropOverlay");

  // --------- Boot ZOHO SDK ---------
  function bootZohoSdk() {
    return new Promise((resolve, reject) => {
      if (typeof ZOHO === "undefined") return reject(new Error("ZOHO SDK script failed to load."));
      let resolved = false;
      ZOHO.embeddedApp.on("PageLoad", async (data) => {
        try {
          const userRes = await ZOHO.CRM.CONFIG.getCurrentUser().catch(() => null);
          state.user = userRes?.users?.[0] || null;
        } finally {
          resolved = true;
          resolve(data);
        }
      });
      ZOHO.embeddedApp.init().catch((e) => {
        if (!resolved) reject(e);
      });
      setTimeout(() => { if (!resolved) resolve(null); }, 5000);
    });
  }

  // --------- Rendering ---------
  function setCtxLine(text) {
    // brand-sub is now the static "INFOTECH" label of the Fristine logo —
    // it no longer has id="ctxLine", so ctxLine is null. Make this a no-op
    // so init() doesn't crash before the ZOHO SDK boots.
    if (ctxLine) ctxLine.textContent = text;
  }
  function clearEmptyState() {
    // Fetch by id each time — the New Chat button rebuilds this element, so a
    // cached reference would point at a detached node.
    const el = document.getElementById("emptyState");
    if (el && el.parentNode) el.remove();
  }
  function scrollToBottom() { chatEl.scrollTop = chatEl.scrollHeight; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /** Convert markdown text to a clean spoken version (drop syntax, expand code, keep cadence). */
  function stripMarkdownForSpeech(s) {
    return String(s)
      .replace(/```[\s\S]*?```/g, " ")          // drop code blocks
      .replace(/`([^`]+)`/g, "$1")                // unwrap inline code
      .replace(/^#+\s+/gm, "")                    // remove heading hashes
      .replace(/\*\*([^*]+)\*\*/g, "$1")          // bold
      .replace(/__([^_]+)__/g, "$1")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2") // italic
      .replace(/(^|[^_])_([^_\n]+)_/g, "$1$2")
      .replace(/^\s*[-*]\s+/gm, "")               // strip bullet markers
      .replace(/^\s*\d+\.\s+/gm, "")              // numbered list markers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")    // link text only
      .replace(/^\s*---+\s*$/gm, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // --------- Tiny markdown renderer (escape-first, safe-by-default) ---------
  function renderMarkdown(src) {
    if (!src) return "";
    let s = escapeHtml(src);

    // Code fences ```...```
    s = s.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.replace(/^\n/, "").replace(/\n$/, "")}</code></pre>`);

    // Inline code `...`
    s = s.replace(/`([^`\n]+)`/g, (_, c) => `<code>${c}</code>`);

    // Headings (must be at start of line)
    s = s.replace(/^####\s+(.+)$/gm, "<h3>$1</h3>");
    s = s.replace(/^###\s+(.+)$/gm,  "<h3>$1</h3>");
    s = s.replace(/^##\s+(.+)$/gm,   "<h2>$1</h2>");
    s = s.replace(/^#\s+(.+)$/gm,    "<h1>$1</h1>");

    // Horizontal rule
    s = s.replace(/^\s*---+\s*$/gm, "<hr>");

    // Bold **...**
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    // Bold __...__
    s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");

    // Italic *...* (avoid matching list bullets " *item" by requiring a non-space char after *)
    s = s.replace(/(^|[^*\w])\*([^\s*][^*\n]*?)\*(?!\*)/g, "$1<em>$2</em>");
    // Italic _..._  (avoid mid-word matches)
    s = s.replace(/(^|[^_\w])_([^\s_][^_\n]*?)_(?!_)/g, "$1<em>$2</em>");

    // Links [text](url)  — only allow http(s)/mailto
    s = s.replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Group list items + paragraphs line-by-line
    const lines = s.split("\n");
    const out = [];
    let inUl = false, inOl = false, paraBuf = [];
    const flushPara = () => {
      if (paraBuf.length) {
        out.push(`<p>${paraBuf.join("<br>")}</p>`);
        paraBuf = [];
      }
    };
    const closeLists = () => {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
    };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      if (line === "") { flushPara(); closeLists(); continue; }
      const ul = line.match(/^\s*[\*\-]\s+(.+)$/);
      const ol = line.match(/^\s*(\d+)\.\s+(.+)$/);
      // Lines that are already block elements
      const isBlock = /^<(h[1-3]|pre|hr|p|ul|ol|li|blockquote|table)\b/.test(line);
      if (ul) {
        flushPara();
        if (inOl) { out.push("</ol>"); inOl = false; }
        if (!inUl) { out.push("<ul>"); inUl = true; }
        out.push(`<li>${ul[1]}</li>`);
      } else if (ol) {
        flushPara();
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (!inOl) { out.push("<ol>"); inOl = true; }
        out.push(`<li>${ol[2]}</li>`);
      } else if (isBlock) {
        flushPara(); closeLists();
        out.push(line);
      } else {
        closeLists();
        paraBuf.push(line);
      }
    }
    flushPara();
    closeLists();
    return out.join("\n");
  }

  function renderUser(text, attachments) {
    clearEmptyState();
    const wrap = document.createElement("div");
    wrap.className = "msg user";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (attachments && attachments.length) {
      const grid = document.createElement("div");
      grid.className = "msg-attachments";
      attachments.forEach((a) => {
        const img = document.createElement("img");
        img.src = a._previewUrl || (`data:${a.mimeType};base64,${a.data}`);
        img.alt = a._filename || "attachment";
        img.title = a._filename || "";
        img.addEventListener("click", () => window.open(img.src, "_blank"));
        grid.appendChild(img);
      });
      bubble.appendChild(grid);
    }
    if (text) {
      const t = document.createElement("div");
      t.textContent = text;
      bubble.appendChild(t);
    }
    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    scrollToBottom();
  }

  function renderAssistant(text) {
    clearEmptyState();
    // Closing any open tool group — assistant text marks a "thought" boundary.
    if (state.toolGroup) {
      state.toolGroup.finalize();
      state.toolGroup = null;
    }
    const wrap = document.createElement("div");
    wrap.className = "msg assistant";
    const bubble = document.createElement("div");
    bubble.className = "bubble md";
    bubble.innerHTML = renderMarkdown(text);
    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    scrollToBottom();
    return bubble;
  }

  /** Live, growing assistant bubble used while streaming. */
  function openStreamingBubble() {
    clearEmptyState();
    if (state.toolGroup) {
      state.toolGroup.finalize();
      state.toolGroup = null;
    }
    const wrap = document.createElement("div");
    wrap.className = "msg assistant";
    const bubble = document.createElement("div");
    bubble.className = "bubble md streaming";
    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    scrollToBottom();
    let accumulated = "";
    return {
      bubble, wrap,
      append(delta) {
        if (!delta) return;
        accumulated += delta;
        bubble.innerHTML = renderMarkdown(accumulated) + '<span class="stream-cursor"></span>';
        scrollToBottom();
      },
      finalize() {
        bubble.classList.remove("streaming");
        bubble.innerHTML = renderMarkdown(accumulated);
        if (!accumulated.trim()) wrap.remove();
        return accumulated;
      },
      get text() { return accumulated; },
    };
  }

  function renderError(text) {
    clearEmptyState();
    const wrap = document.createElement("div");
    wrap.className = "msg error";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    scrollToBottom();
  }

  function renderTyping() {
    clearEmptyState();
    const wrap = document.createElement("div");
    wrap.className = "msg assistant";
    wrap.innerHTML = '<div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
    chatEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  // --------- Consolidated tool group (one per user turn) ---------
  function ensureToolGroup() {
    if (state.toolGroup && state.toolGroup.wrap.isConnected) return state.toolGroup;
    clearEmptyState();

    const wrap = document.createElement("div");
    wrap.className = "msg tool";
    const group = document.createElement("div");
    group.className = "tool-group";
    group.innerHTML = `
      <div class="tool-group-head">
        <span class="tg-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        </span>
        <div class="tg-summary">
          <span class="tg-count">Working…</span>
        </div>
        <svg class="tg-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="tg-shimmer" aria-hidden="true"></div>
      <div class="tg-body"></div>
    `;
    wrap.appendChild(group);
    chatEl.appendChild(wrap);

    const head = group.querySelector(".tool-group-head");
    head.addEventListener("click", () => group.classList.toggle("open"));

    group.classList.add("running");
    state.toolGroup = {
      wrap, group,
      headEl: head,
      countEl: group.querySelector(".tg-count"),
      bodyEl: group.querySelector(".tg-body"),
      rows: [],
      okCount: 0,
      errCount: 0,
      finalize() {
        group.classList.remove("running");
        this.updateSummary(true);
      },
      updateSummary(final) {
        const total = this.rows.length;
        const word = total === 1 ? "query" : "queries";
        if (final) {
          this.countEl.textContent = total === 0 ? "No queries run" : `Ran ${total} ${word}`;
        } else {
          this.countEl.textContent = total === 0 ? "Working…" : `Running ${total} ${word}…`;
        }
      },
    };
    scrollToBottom();
    return state.toolGroup;
  }

  // --------- Inline form prompt (request_user_input) ---------
  function renderInputForm(args) {
    // args: { module, operation, record_id, title, reason, submit_label, required_fields, optional_fields }
    if (state.toolGroup) { state.toolGroup.finalize(); state.toolGroup = null; }
    clearEmptyState();

    const wrap = document.createElement("div");
    wrap.className = "msg assistant";
    const card = document.createElement("div");
    card.className = "form-card";

    const required = Array.isArray(args.required_fields) ? args.required_fields.slice() : [];
    const optional = Array.isArray(args.optional_fields) ? args.optional_fields.slice() : [];
    const operation = args.operation || "create";
    const moduleName = args.module || "Record";
    const submitLabel = args.submit_label || (operation === "update" ? `Update ${moduleName}` : `Create ${moduleName}`);

    card.innerHTML = `
      <div class="fc-head">
        <div class="fc-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
        </div>
        <div class="fc-title-block">
          <div class="fc-title">${escapeHtml(args.title || (operation === "update" ? `Update ${moduleName}` : `New ${moduleName}`))}</div>
          ${args.reason ? `<div class="fc-reason">${escapeHtml(args.reason)}</div>` : ""}
        </div>
        <div class="fc-module-pill">${escapeHtml(moduleName)}${args.record_id ? ` · #${escapeHtml(args.record_id)}` : ""}</div>
      </div>
      <div class="fc-fields"></div>
      <div class="fc-picker hidden">
        <input type="search" class="fc-picker-search" placeholder="Search fields…" />
        <div class="fc-picker-list"></div>
      </div>
      <div class="fc-actions">
        <button type="button" class="btn ghost fc-add">+ Add field</button>
        <div class="fc-spacer"></div>
        <button type="button" class="btn ghost fc-cancel">Cancel</button>
        <button type="button" class="btn primary fc-submit">${escapeHtml(submitLabel)}</button>
      </div>
    `;
    wrap.appendChild(card);
    chatEl.appendChild(wrap);

    const fieldsEl  = card.querySelector(".fc-fields");
    const pickerEl  = card.querySelector(".fc-picker");
    const pickerSearch = card.querySelector(".fc-picker-search");
    const pickerList = card.querySelector(".fc-picker-list");
    const addBtn    = card.querySelector(".fc-add");
    const cancelBtn = card.querySelector(".fc-cancel");
    const submitBtn = card.querySelector(".fc-submit");

    /** Live registry of fields currently in the form. */
    const liveFields = []; // { api_name, label, data_type, picklist_values, required, getValue, rowEl }
    const optionalPool = optional.slice();

    function makeRow(field, isRequired) {
      const row = document.createElement("div");
      row.className = "fc-field";
      row.dataset.api = field.api_name;
      const label = document.createElement("label");
      label.innerHTML = `${escapeHtml(field.label || field.api_name)}${isRequired ? ` <span class="req">*</span>` : ""}`;
      row.appendChild(label);

      const control = buildControl(field);
      row.appendChild(control.el);

      if (!isRequired) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "fc-field-remove";
        remove.setAttribute("aria-label", "Remove field");
        remove.innerHTML = "×";
        remove.addEventListener("click", () => {
          const idx = liveFields.findIndex((f) => f.rowEl === row);
          if (idx >= 0) {
            optionalPool.push({
              api_name: liveFields[idx].api_name,
              label: liveFields[idx].label,
              data_type: liveFields[idx].data_type,
              picklist_values: liveFields[idx].picklist_values,
            });
            liveFields.splice(idx, 1);
            row.remove();
            rebuildPickerList();
          }
        });
        row.appendChild(remove);
      }

      fieldsEl.appendChild(row);
      liveFields.push({
        api_name: field.api_name,
        label: field.label || field.api_name,
        data_type: field.data_type,
        picklist_values: field.picklist_values,
        required: isRequired,
        getValue: control.getValue,
        rowEl: row,
      });
    }

    function buildControl(field) {
      const dt = (field.data_type || "text").toLowerCase();
      const v = field.value ?? "";
      let el, getValue;
      switch (dt) {
        case "boolean": {
          el = document.createElement("select");
          el.innerHTML = `<option value="false">No</option><option value="true">Yes</option>`;
          el.value = v === true || v === "true" ? "true" : "false";
          getValue = () => el.value === "true";
          break;
        }
        case "picklist": {
          el = document.createElement("select");
          const opts = ['<option value="">— select —</option>'].concat(
            (field.picklist_values || []).map((p) => `<option ${p === v ? "selected" : ""}>${escapeHtml(p)}</option>`)
          );
          el.innerHTML = opts.join("");
          getValue = () => el.value;
          break;
        }
        case "multiselectpicklist": {
          el = document.createElement("input");
          el.type = "text";
          el.value = Array.isArray(v) ? v.join(", ") : v;
          el.placeholder = "Comma-separated values";
          getValue = () => el.value.split(",").map((s) => s.trim()).filter(Boolean);
          break;
        }
        case "textarea": {
          el = document.createElement("textarea");
          el.rows = 3;
          el.value = v;
          getValue = () => el.value;
          break;
        }
        case "date": {
          el = document.createElement("input"); el.type = "date";
          el.value = v;
          getValue = () => el.value;
          break;
        }
        case "datetime": {
          el = document.createElement("input"); el.type = "datetime-local";
          el.value = v;
          getValue = () => el.value;
          break;
        }
        case "email": {
          el = document.createElement("input"); el.type = "email";
          el.value = v;
          getValue = () => el.value.trim();
          break;
        }
        case "phone": {
          el = document.createElement("input"); el.type = "tel";
          el.value = v;
          getValue = () => el.value.trim();
          break;
        }
        case "integer":
        case "bigint":
        case "double":
        case "currency":
        case "decimal":
        case "percent": {
          el = document.createElement("input"); el.type = "number"; el.step = "any";
          el.value = v;
          getValue = () => {
            const n = el.value === "" ? null : Number(el.value);
            return Number.isFinite(n) ? n : null;
          };
          break;
        }
        case "lookup": {
          el = document.createElement("input"); el.type = "text";
          el.value = typeof v === "object" ? (v?.name || v?.id || "") : v;
          el.placeholder = "Name or id";
          getValue = () => el.value.trim();
          break;
        }
        default: {
          el = document.createElement("input"); el.type = "text";
          el.value = v;
          getValue = () => el.value;
        }
      }
      el.className = "fc-input";
      return { el, getValue };
    }

    function rebuildPickerList() {
      const q = pickerSearch.value.trim().toLowerCase();
      pickerList.innerHTML = "";
      const matches = optionalPool
        .filter((f) => !q || f.label.toLowerCase().includes(q) || f.api_name.toLowerCase().includes(q))
        .slice(0, 50);
      if (matches.length === 0) {
        const empty = document.createElement("div");
        empty.className = "fc-picker-empty";
        empty.textContent = optionalPool.length ? "No matches" : "No more fields available";
        pickerList.appendChild(empty);
        return;
      }
      matches.forEach((f) => {
        const opt = document.createElement("button");
        opt.type = "button";
        opt.className = "fc-picker-option";
        opt.innerHTML = `<span class="fc-opt-label">${escapeHtml(f.label || f.api_name)}</span><span class="fc-opt-type">${escapeHtml(f.data_type || "text")}</span>`;
        opt.addEventListener("click", () => {
          const idx = optionalPool.findIndex((o) => o.api_name === f.api_name);
          if (idx >= 0) optionalPool.splice(idx, 1);
          makeRow(f, false);
          rebuildPickerList();
          pickerSearch.value = "";
          // keep picker open if there are more, close if empty
          if (optionalPool.length === 0) {
            pickerEl.classList.add("hidden");
          } else {
            rebuildPickerList();
          }
        });
        pickerList.appendChild(opt);
      });
    }

    // Build initial required rows
    required.forEach((f) => makeRow(f, true));
    rebuildPickerList();

    addBtn.addEventListener("click", () => {
      const opening = pickerEl.classList.contains("hidden");
      pickerEl.classList.toggle("hidden");
      if (opening) {
        pickerSearch.value = "";
        rebuildPickerList();
        setTimeout(() => pickerSearch.focus(), 50);
      }
    });
    pickerSearch.addEventListener("input", rebuildPickerList);
    pickerSearch.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { pickerEl.classList.add("hidden"); }
    });

    scrollToBottom();

    return new Promise((resolve) => {
      let settled = false;
      function settle(result) {
        if (settled) return;
        settled = true;
        addBtn.disabled = true;
        cancelBtn.disabled = true;
        submitBtn.disabled = true;
        card.classList.add("locked");
        resolve(result);
      }
      cancelBtn.addEventListener("click", () => settle({ ok: false, cancelled: true }));
      submitBtn.addEventListener("click", () => {
        // Validate required
        const missing = [];
        const values = {};
        for (const f of liveFields) {
          const val = f.getValue();
          const empty = val === "" || val === null || val === undefined || (Array.isArray(val) && val.length === 0);
          if (f.required && empty) {
            missing.push(f.label || f.api_name);
            f.rowEl.classList.add("invalid");
          } else {
            f.rowEl.classList.remove("invalid");
          }
          if (!empty) values[f.api_name] = val;
        }
        if (missing.length) {
          submitBtn.textContent = `Missing: ${missing.slice(0, 2).join(", ")}${missing.length > 2 ? "…" : ""}`;
          setTimeout(() => { submitBtn.textContent = submitLabel; }, 1800);
          return;
        }
        settle({ ok: true, values });
      });
    });
  }

  // --------- UI tool dispatcher (forms, memory, visualizations) ---------
  async function handleUITool(call) {
    const name = call.name;
    const args = call.args || {};
    if (name === "request_user_input") {
      return await renderInputForm(args);
    }
    if (name === "set_preferred_name") {
      const merged = Settings.setPreferredName(args.name);
      state.settings = merged;
      renderMemoryConfirm(`Will call you ${args.name} from now on.`);
      return { ok: true, preferredName: merged.preferredName };
    }
    if (name === "remember_fact") {
      const merged = Settings.addKnowledge(args.fact);
      state.settings = merged;
      const last = merged.knowledge[merged.knowledge.length - 1];
      renderMemoryConfirm(`Noted: "${args.fact}"`);
      return { ok: true, id: last?.id, fact: args.fact };
    }
    if (name === "forget_fact") {
      const before = (state.settings.knowledge || []).find((k) => k.id === args.id);
      const merged = Settings.removeKnowledge(args.id);
      state.settings = merged;
      renderMemoryConfirm(before ? `Forgot: "${before.text}"` : "Forgot that.");
      return { ok: true, id: args.id };
    }
    if (name === "show_table") {
      try {
        renderTable(args);
        return { ok: true, rendered: "table", rows: (args.rows || []).length };
      } catch (e) {
        console.error("[FIVA] show_table render failed", e, args);
        return {
          ok: false,
          error: `Table render failed: ${e.message || e}`,
          hint: "rows must be an array of {cells:[...]} objects, where cells is an array of strings aligned with columns.",
        };
      }
    }
    if (name === "show_chart") {
      try {
        renderChart(args);
        return { ok: true, rendered: "chart", chart_type: args.chart_type };
      } catch (e) {
        console.error("[FIVA] show_chart render failed", e, args);
        return {
          ok: false,
          error: `Chart render failed: ${e.message || e}`,
          hint: "Required: title, chart_type ('bar'|'pie'|'donut'|'line'), labels (string array). Either pass values (number array) for single-series, or series (array of {label, values}).",
        };
      }
    }
    if (name === "show_kpis") {
      try {
        renderKpis(args);
        return { ok: true, rendered: "kpis", count: (args.items || []).length };
      } catch (e) {
        console.error("[FIVA] show_kpis render failed", e, args);
        return {
          ok: false,
          error: `KPI render failed: ${e.message || e}`,
          hint: "items must be an array of {label, value} (both strings); delta and caption are optional.",
        };
      }
    }
    if (name === "suggest_next_steps") {
      const items = Array.isArray(args.items) ? args.items.slice(0, 3) : [];
      if (items.length) renderSuggestionChips(items);
      return { ok: true, rendered: "chips", count: items.length };
    }
    return { ok: false, error: `Unknown UI tool: ${name}` };
  }

  // --------- Visualization renderers ---------
  const CHART_COLORS = ["#6366f1", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b"];

  function formatVizValue(v, format, currency) {
    if (v === null || v === undefined || v === "") return "—";
    const sym = currency || "₹";
    if (format === "currency") {
      const n = Number(v);
      if (!Number.isFinite(n)) return String(v);
      if (Math.abs(n) >= 1e7) return `${sym}${(n / 1e7).toFixed(2)}Cr`;
      if (Math.abs(n) >= 1e5) return `${sym}${(n / 1e5).toFixed(2)}L`;
      if (Math.abs(n) >= 1e3) return `${sym}${(n / 1e3).toFixed(1)}K`;
      return `${sym}${n.toLocaleString()}`;
    }
    if (format === "number") {
      const n = Number(v);
      return Number.isFinite(n) ? n.toLocaleString() : String(v);
    }
    if (format === "percent") {
      const n = Number(v);
      return Number.isFinite(n) ? `${n.toFixed(1)}%` : String(v);
    }
    if (format === "date") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return String(v);
      return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    }
    return String(v);
  }

  function vizBubble(extraClass = "") {
    clearEmptyState();
    if (state.toolGroup) { state.toolGroup.finalize(); state.toolGroup = null; }
    const wrap = document.createElement("div");
    wrap.className = "msg assistant viz-msg";
    const card = document.createElement("div");
    card.className = `viz-card ${extraClass}`;
    wrap.appendChild(card);
    chatEl.appendChild(wrap);
    scrollToBottom();
    return card;
  }

  function renderTable(args) {
    const card = vizBubble("viz-table");
    const title = document.createElement("div");
    title.className = "viz-title";
    title.textContent = args.title || "";
    card.appendChild(title);

    const wrapTable = document.createElement("div");
    wrapTable.className = "viz-table-scroll";
    const table = document.createElement("table");
    const cols = Array.isArray(args.columns) ? args.columns : [];
    const rows = Array.isArray(args.rows) ? args.rows : [];

    const thead = document.createElement("thead");
    const trH = document.createElement("tr");
    cols.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = c.label || c.key;
      const align = c.align || (c.format === "currency" || c.format === "number" || c.format === "percent" ? "right" : "left");
      th.style.textAlign = align;
      trH.appendChild(th);
    });
    thead.appendChild(trH);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      // Resolve the per-row value array, supporting three shapes:
      //   1. Current: { cells: ["a", "b", "c"] }
      //   2. Positional: ["a", "b", "c"]
      //   3. Legacy keyed: { Name: "a", Email: "b" } (look up by column.key)
      let cells = null;
      if (row && Array.isArray(row.cells)) cells = row.cells;
      else if (Array.isArray(row)) cells = row;
      cols.forEach((c, j) => {
        const td = document.createElement("td");
        let v;
        if (cells) v = cells[j];
        else if (row && typeof row === "object") v = row[c.key];
        else v = "";
        td.textContent = formatVizValue(v, c.format, args.currency_symbol);
        const align = c.align || (c.format === "currency" || c.format === "number" || c.format === "percent" ? "right" : "left");
        td.style.textAlign = align;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapTable.appendChild(table);
    card.appendChild(wrapTable);

    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "viz-empty";
      empty.textContent = "No rows.";
      card.appendChild(empty);
    }
  }

  function renderKpis(args) {
    const card = vizBubble("viz-kpis");
    if (args.title) {
      const t = document.createElement("div");
      t.className = "viz-title";
      t.textContent = args.title;
      card.appendChild(t);
    }
    const row = document.createElement("div");
    row.className = "kpi-row";
    (args.items || []).slice(0, 6).forEach((it, idx) => {
      const cell = document.createElement("div");
      cell.className = "kpi-cell";
      cell.style.setProperty("--accent", CHART_COLORS[idx % CHART_COLORS.length]);
      const label = document.createElement("div");
      label.className = "kpi-label";
      label.textContent = it.label || "";
      const value = document.createElement("div");
      value.className = "kpi-value";
      value.textContent = it.value ?? "—";
      cell.appendChild(label);
      cell.appendChild(value);
      if (it.delta) {
        const delta = document.createElement("div");
        const positive = /^[+]/.test(it.delta) || (Number.isFinite(Number(it.delta)) && Number(it.delta) > 0);
        const negative = /^-/.test(it.delta) || (Number.isFinite(Number(it.delta)) && Number(it.delta) < 0);
        delta.className = "kpi-delta " + (positive ? "up" : negative ? "down" : "flat");
        delta.textContent = (positive && !/^[+]/.test(it.delta) ? "+" : "") + it.delta;
        cell.appendChild(delta);
      }
      if (it.caption) {
        const cap = document.createElement("div");
        cap.className = "kpi-caption";
        cap.textContent = it.caption;
        cell.appendChild(cap);
      }
      row.appendChild(cell);
    });
    card.appendChild(row);
  }

  function renderChart(args) {
    const type = (args.chart_type || "bar").toLowerCase();
    const card = vizBubble("viz-chart");
    if (args.title) {
      const t = document.createElement("div");
      t.className = "viz-title";
      t.textContent = args.title;
      card.appendChild(t);
    }
    if (type === "pie" || type === "donut") {
      card.appendChild(buildPie(args, type === "donut"));
    } else if (type === "line") {
      card.appendChild(buildLine(args));
    } else {
      card.appendChild(buildBar(args));
    }
  }

  function fmt(v, args) {
    if (args.format === "currency") return formatVizValue(v, "currency", args.currency_symbol);
    if (args.format === "percent") return formatVizValue(v, "percent");
    if (args.format === "number") return formatVizValue(v, "number");
    return formatVizValue(v, "number");
  }

  function buildBar(args) {
    const labels = args.labels || [];
    const series = Array.isArray(args.series) && args.series.length
      ? args.series
      : [{ label: args.y_label || "Value", values: args.values || [] }];
    const flatMax = Math.max(1, ...series.flatMap((s) => s.values || []));

    const root = document.createElement("div");
    root.className = "chart-bar";
    // Legend (only if multi-series)
    if (series.length > 1) {
      const legend = document.createElement("div");
      legend.className = "chart-legend";
      series.forEach((s, i) => {
        const item = document.createElement("span");
        item.className = "chart-legend-item";
        item.innerHTML = `<i style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></i>${escapeHtml(s.label)}`;
        legend.appendChild(item);
      });
      root.appendChild(legend);
    }
    labels.forEach((label, idx) => {
      const row = document.createElement("div");
      row.className = "chart-bar-row";
      const lab = document.createElement("div");
      lab.className = "chart-bar-label";
      lab.textContent = label;
      lab.title = label;
      const track = document.createElement("div");
      track.className = "chart-bar-track";
      series.forEach((s, i) => {
        const v = Number(s.values?.[idx]) || 0;
        const pct = (v / flatMax) * 100;
        const seg = document.createElement("div");
        seg.className = "chart-bar-seg";
        seg.style.width = `${pct}%`;
        seg.style.background = CHART_COLORS[i % CHART_COLORS.length];
        seg.style.animationDelay = `${idx * 30 + i * 10}ms`;
        seg.title = `${s.label}: ${fmt(v, args)}`;
        track.appendChild(seg);
      });
      const valLabel = document.createElement("div");
      valLabel.className = "chart-bar-value";
      if (series.length === 1) valLabel.textContent = fmt(series[0].values?.[idx], args);
      else valLabel.textContent = series.map((s) => fmt(s.values?.[idx], args)).join(" · ");
      row.appendChild(lab);
      row.appendChild(track);
      row.appendChild(valLabel);
      root.appendChild(row);
    });
    return root;
  }

  function buildPie(args, donut) {
    const labels = args.labels || [];
    const values = args.values || [];
    const total = values.reduce((s, v) => s + (Number(v) || 0), 0) || 1;
    const W = 220, H = 220, R = 100, CX = W / 2, CY = H / 2;
    const innerR = donut ? 56 : 0;

    const root = document.createElement("div");
    root.className = "chart-pie";

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);

    let angle = -Math.PI / 2;
    values.forEach((v, i) => {
      const slice = (Number(v) || 0) / total;
      const a1 = angle;
      const a2 = angle + slice * 2 * Math.PI;
      angle = a2;
      const large = slice > 0.5 ? 1 : 0;
      const path = document.createElementNS(svgNs, "path");
      const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
      const x2 = CX + R * Math.cos(a2), y2 = CY + R * Math.sin(a2);
      let d;
      if (donut) {
        const ix1 = CX + innerR * Math.cos(a1), iy1 = CY + innerR * Math.sin(a1);
        const ix2 = CX + innerR * Math.cos(a2), iy2 = CY + innerR * Math.sin(a2);
        d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`;
      } else {
        d = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
      }
      path.setAttribute("d", d);
      path.setAttribute("fill", CHART_COLORS[i % CHART_COLORS.length]);
      path.setAttribute("class", "chart-pie-slice");
      path.style.animationDelay = `${i * 60}ms`;
      const titleEl = document.createElementNS(svgNs, "title");
      titleEl.textContent = `${labels[i] || ""}: ${fmt(v, args)} (${((Number(v) / total) * 100).toFixed(1)}%)`;
      path.appendChild(titleEl);
      svg.appendChild(path);
    });
    if (donut) {
      const t = document.createElementNS(svgNs, "text");
      t.setAttribute("x", CX); t.setAttribute("y", CY - 4);
      t.setAttribute("text-anchor", "middle"); t.setAttribute("class", "chart-donut-total-num");
      t.textContent = fmt(total, args);
      const c = document.createElementNS(svgNs, "text");
      c.setAttribute("x", CX); c.setAttribute("y", CY + 14);
      c.setAttribute("text-anchor", "middle"); c.setAttribute("class", "chart-donut-total-lbl");
      c.textContent = "total";
      svg.appendChild(t);
      svg.appendChild(c);
    }
    root.appendChild(svg);

    const legend = document.createElement("div");
    legend.className = "chart-legend";
    labels.forEach((lab, i) => {
      const item = document.createElement("span");
      item.className = "chart-legend-item";
      item.innerHTML = `<i style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></i>${escapeHtml(lab)} · <b>${escapeHtml(fmt(values[i], args))}</b>`;
      legend.appendChild(item);
    });
    root.appendChild(legend);
    return root;
  }

  function buildLine(args) {
    const labels = args.labels || [];
    const series = Array.isArray(args.series) && args.series.length
      ? args.series
      : [{ label: args.y_label || "Value", values: args.values || [] }];
    const W = 600, H = 220, PAD_L = 44, PAD_R = 12, PAD_T = 12, PAD_B = 32;
    const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
    const maxV = Math.max(1, ...series.flatMap((s) => s.values || []));
    const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;

    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "chart-line");

    // Grid lines (4 horizontal)
    for (let i = 0; i <= 4; i++) {
      const y = PAD_T + (i * innerH) / 4;
      const line = document.createElementNS(svgNs, "line");
      line.setAttribute("x1", PAD_L); line.setAttribute("x2", PAD_L + innerW);
      line.setAttribute("y1", y); line.setAttribute("y2", y);
      line.setAttribute("class", "chart-line-grid");
      svg.appendChild(line);
      const lbl = document.createElementNS(svgNs, "text");
      lbl.setAttribute("x", PAD_L - 6); lbl.setAttribute("y", y + 4);
      lbl.setAttribute("text-anchor", "end");
      lbl.setAttribute("class", "chart-line-axis");
      lbl.textContent = fmt(maxV * (1 - i / 4), args);
      svg.appendChild(lbl);
    }
    // X labels
    labels.forEach((lab, i) => {
      const x = PAD_L + i * stepX;
      const t = document.createElementNS(svgNs, "text");
      t.setAttribute("x", x); t.setAttribute("y", H - 10);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "chart-line-axis");
      t.textContent = lab;
      svg.appendChild(t);
    });
    // Series
    series.forEach((s, si) => {
      const color = CHART_COLORS[si % CHART_COLORS.length];
      const pts = (s.values || []).map((v, i) => {
        const x = PAD_L + i * stepX;
        const y = PAD_T + innerH - (Number(v) / maxV) * innerH;
        return [x, y];
      });
      // Area fill (subtle)
      if (pts.length >= 2) {
        const area = document.createElementNS(svgNs, "path");
        const d = `M ${PAD_L} ${PAD_T + innerH} ` + pts.map(([x, y]) => `L ${x} ${y}`).join(" ") + ` L ${PAD_L + (pts.length - 1) * stepX} ${PAD_T + innerH} Z`;
        area.setAttribute("d", d);
        area.setAttribute("fill", color);
        area.setAttribute("opacity", "0.10");
        svg.appendChild(area);
      }
      // Line
      const poly = document.createElementNS(svgNs, "polyline");
      poly.setAttribute("points", pts.map(([x, y]) => `${x},${y}`).join(" "));
      poly.setAttribute("fill", "none");
      poly.setAttribute("stroke", color);
      poly.setAttribute("stroke-width", "2.2");
      poly.setAttribute("stroke-linejoin", "round");
      poly.setAttribute("stroke-linecap", "round");
      poly.setAttribute("class", "chart-line-path");
      svg.appendChild(poly);
      // Dots
      pts.forEach(([x, y], i) => {
        const c = document.createElementNS(svgNs, "circle");
        c.setAttribute("cx", x); c.setAttribute("cy", y);
        c.setAttribute("r", "3.5");
        c.setAttribute("fill", "#fff");
        c.setAttribute("stroke", color);
        c.setAttribute("stroke-width", "2");
        const title = document.createElementNS(svgNs, "title");
        title.textContent = `${labels[i] || ""}: ${fmt(s.values?.[i], args)}`;
        c.appendChild(title);
        svg.appendChild(c);
      });
    });

    const root = document.createElement("div");
    root.className = "chart-line-wrap";
    root.appendChild(svg);
    if (series.length > 1) {
      const legend = document.createElement("div");
      legend.className = "chart-legend";
      series.forEach((s, i) => {
        const item = document.createElement("span");
        item.className = "chart-legend-item";
        item.innerHTML = `<i style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></i>${escapeHtml(s.label)}`;
        legend.appendChild(item);
      });
      root.appendChild(legend);
    }
    return root;
  }

  /** Small inline confirmation card for memory operations. */
  function renderMemoryConfirm(text) {
    clearEmptyState();
    const wrap = document.createElement("div");
    wrap.className = "msg tool";
    const card = document.createElement("div");
    card.className = "memory-toast";
    card.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      <span>${escapeHtml(text)}</span>
    `;
    wrap.appendChild(card);
    chatEl.appendChild(wrap);
    scrollToBottom();
  }

  // --------- AI-driven suggestion chips ---------
  // The AI calls `suggest_next_steps` with the items it wants to surface.
  // No hardcoded mapping — FIVA decides if/when to offer follow-ups.

  function renderSuggestionChips(suggestions) {
    if (!suggestions.length) return;
    const wrap = document.createElement("div");
    wrap.className = "msg assistant";
    const card = document.createElement("div");
    card.className = "chip-strip";
    card.innerHTML = `<div class="chip-strip-hint">Useful next?</div>`;
    const row = document.createElement("div");
    row.className = "chip-row";
    suggestions.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = s.label;
      btn.addEventListener("click", () => {
        if (state.busy) return;
        // disable siblings to avoid double-fires
        row.querySelectorAll(".chip").forEach((b) => (b.disabled = true));
        btn.classList.add("chosen");
        sendUserMessage(s.prompt);
      });
      row.appendChild(btn);
    });
    card.appendChild(row);
    wrap.appendChild(card);
    chatEl.appendChild(wrap);
    scrollToBottom();
  }

  function compactArgsLabel(args) {
    if (!args || typeof args !== "object") return "";
    const bits = [];
    if (args.module) bits.push(args.module);
    if (args.id) bits.push(`#${args.id}`);
    if (args.criteria) bits.push(args.criteria.length > 40 ? args.criteria.slice(0, 38) + "…" : args.criteria);
    if (args.query) bits.push(args.query.length > 40 ? args.query.slice(0, 38) + "…" : args.query);
    return bits.join(" · ");
  }

  function appendToolRow(name, args) {
    const group = ensureToolGroup();
    const row = document.createElement("div");
    row.className = "tg-row";
    const head = document.createElement("div");
    head.className = "tg-row-head";
    head.innerHTML = `
      <span class="tg-status-dot running" aria-hidden="true"></span>
      <span class="tg-tool-name">${escapeHtml(name)}</span>
      <span class="tg-tool-args">${escapeHtml(compactArgsLabel(args))}</span>
      <svg class="tg-row-chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    `;
    const detail = document.createElement("div");
    detail.className = "tg-row-detail";
    detail.textContent = `// args\n${JSON.stringify(args, null, 2)}`;
    row.appendChild(head);
    row.appendChild(detail);
    group.bodyEl.appendChild(row);
    group.rows.push(row);
    group.updateSummary(false);
    head.addEventListener("click", () => row.classList.toggle("open"));
    scrollToBottom();

    const dot = head.querySelector(".tg-status-dot");
    return {
      row, detail, dot,
      setResult(result) {
        dot.classList.remove("running");
        if (result && result.ok) { dot.classList.add("ok"); group.okCount++; }
        else                     { dot.classList.add("err"); group.errCount++; }
        detail.textContent =
          `// args\n${JSON.stringify(args, null, 2)}\n\n// result\n${JSON.stringify(result, null, 2)}`;
        group.updateSummary(false);
      },
    };
  }

  function humanizeAction(name) {
    return ({
      create_record: "create a record",
      update_record: "update a record",
      delete_record: "delete a record",
      convert_lead: "convert a lead",
    })[name] || name;
  }

  function renderConfirm(calls, onDecision) {
    clearEmptyState();
    const wrap = document.createElement("div");
    wrap.className = "msg assistant";
    const card = document.createElement("div");
    card.className = "confirm-card";

    const writes = calls.filter((c) => CRMTools.isWrite(c.name));
    const title = document.createElement("div");
    title.className = "confirm-title";
    title.textContent = writes.length === 1
      ? `Approve this change?`
      : `Approve ${writes.length} changes?`;
    card.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "confirm-sub";
    sub.textContent = "Approving lets FIVA continue with any follow-up steps for this request automatically.";
    card.appendChild(sub);

    writes.forEach((c) => {
      const a = c.args || {};
      const preview = document.createElement("div");
      preview.className = "record-card";
      const moduleLabel = a.module || (c.name === "convert_lead" ? "Leads" : "Record");
      const data = a.data || a.deal || {};
      preview.innerHTML = `
        <div class="rc-head">
          <span class="rc-module">${escapeHtml(c.name)}${a.id ? ` · #${escapeHtml(a.id)}` : ""}</span>
          <span class="rc-title">${escapeHtml(moduleLabel)}</span>
        </div>
      `;
      const fields = document.createElement("div");
      fields.className = "rc-fields";
      const entries = Object.entries(data);
      if (entries.length === 0 && c.name === "delete_record") {
        const label = document.createElement("div"); label.className = "rc-label"; label.textContent = "Action";
        const value = document.createElement("div"); value.className = "rc-value changed"; value.textContent = `Delete ${moduleLabel} #${a.id}`;
        fields.appendChild(label); fields.appendChild(value);
      } else {
        entries.forEach(([k, v]) => {
          const label = document.createElement("div");
          label.className = "rc-label";
          label.textContent = k;
          const value = document.createElement("div");
          value.className = "rc-value changed";
          value.textContent = formatValue(v);
          fields.appendChild(label);
          fields.appendChild(value);
        });
      }
      preview.appendChild(fields);
      card.appendChild(preview);
    });

    const trustRow = document.createElement("label");
    trustRow.className = "confirm-trust";
    const trustCheckbox = document.createElement("input");
    trustCheckbox.type = "checkbox";
    trustRow.appendChild(trustCheckbox);
    const trustText = document.createElement("span");
    trustText.textContent = "Don't ask again in this chat";
    trustRow.appendChild(trustText);
    card.appendChild(trustRow);

    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const approve = document.createElement("button");
    approve.className = "btn primary";
    approve.textContent = writes.length === 1 ? "Run it" : `Run all ${writes.length}`;
    const deny = document.createElement("button");
    deny.className = "btn danger";
    deny.textContent = "Cancel";
    actions.appendChild(approve);
    actions.appendChild(deny);
    card.appendChild(actions);

    wrap.appendChild(card);
    chatEl.appendChild(wrap);
    scrollToBottom();

    approve.addEventListener("click", () => {
      approve.disabled = true; deny.disabled = true;
      trustCheckbox.disabled = true;
      approve.textContent = "Running…";
      onDecision({ approved: true, trustChat: trustCheckbox.checked });
    });
    deny.addEventListener("click", () => {
      approve.disabled = true; deny.disabled = true;
      trustCheckbox.disabled = true;
      deny.textContent = "Cancelled";
      onDecision({ approved: false });
    });
  }

  function formatValue(v) {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") {
      if (v.id) return `→ ${v.name || v.full_name || v.id}`;
      try { return JSON.stringify(v); } catch (_) { return String(v); }
    }
    return String(v);
  }

  // --------- Gemini client wiring ---------
  function buildClient() {
    return new GeminiClient({
      apiKey: state.settings.apiKey,
      model: state.settings.model,
      systemPrompt: composeSystemPrompt(),
      tools: CRMTools.declarations,
    });
  }

  function composeSystemPrompt() {
    const first = (state.user?.first_name || state.user?.full_name || state.user?.name || "").split(" ")[0] || "";
    const base = [
      "You are FIVA — a senior CRM colleague helping inside Zoho CRM. You are not a chatbot. Talk like a real, smart human teammate who's been here forever.",
      "",
      "LANGUAGE",
      "• Reply in the SAME language the user is using. If they speak Spanish, reply in Spanish. Hindi → Hindi. Hinglish/Spanglish → match the mix. Tamil → Tamil. Marathi → Marathi. Etc.",
      "• Mirror their language even mid-conversation — if they switch, you switch on the next reply.",
      "• Default to English only when the user's input is itself English.",
      "• In voice mode the same applies: your spoken voice should match their spoken language. Don't translate it to English unless they ask.",
      "",
      "VOICE — this is the most important thing",
      "• Short. One or two sentences for most replies. Long responses ONLY when explicitly asked.",
      "• Conversational, never corporate. No 'Certainly!', 'I'd be happy to', 'As an AI assistant', 'I will now', 'Please find below'.",
      "• Have an opinion. If something looks off, say so. \"That Kapoor deal's been stuck in Qualification for 3 weeks — want me to nudge them?\"",
      "• React like a person. \"hmm, no matches.\" \"got it.\" \"oh, that one's already closed.\" \"on it.\"",
      "• Don't preamble. Don't announce what you're about to do. Just do it and report the outcome.",
      "• Don't apologize when something fails. State what failed and offer the fix.",
      "• Don't repeat the user's question back. Don't summarize your own steps. Don't explain what a tool does.",
      "• Refer to things colloquially: 'that Acme deal', 'the lead you just added', 'the usual pipeline'.",
      "• Use the user's first name ONCE per conversation max — sprinkling it sounds fake.",
      "• Avoid filler: 'in order to', 'please note', 'kindly', 'feel free to'. Cut them.",
      "",
      "EXAMPLES",
      "  Bad: \"I will now retrieve the field information for the Leads module and then proceed to create the record.\"",
      "  Good: (no text — just do it)",
      "",
      "  Bad: \"I have successfully created the lead with record ID 1086951000002127003.\"",
      "  Good: \"Done — lead #1086951000002127003 created.\"",
      "",
      "  Bad: \"I apologize, but I was unable to update the record due to an error.\"",
      "  Good: \"Update failed — CRM says the email is invalid. Want me to try again with a fix?\"",
      "",
      "  Bad: \"To create a lead, the following fields are required: Last Name, Company, Email…\"",
      "  Good: (call request_user_input — don't explain in text)",
      "",
      "WORK STYLE",
      "• Take initiative. After finishing, often a useful next step exists — suggest it in ONE short sentence.",
      "• Translate results into plain English with the key numbers. Don't dump JSON.",
      "• If you need data, use request_user_input — never ask in text.",
      "• Use markdown sparingly: bold for record names/ids, bullets only when listing 3+ items, headings only on long briefings.",
      "",
      "MECHANICS (still important, but invisible to the user)",
      "• Before writing to a module you haven't seen this session, call `get_module_fields`.",
      "• Use `run_coql_query` for analytical lookups; `search_records` for exact lookups.",
      "• When the user is vague ('update the Acme deal'), search first and confirm WHICH record before mutating.",
      "• Never invent record ids, emails, amounts, fields, or picklist values.",
      "• Image attached? Read it as raw material — business card → Lead, PDF quote → Deal, screenshot → Lead/Task, note → Task. Use request_user_input to confirm the form before calling create_record.",
      "• When you call request_user_input: call it ALONE. Never combine with create_record/update_record in the same round.",
      "",
      "ADDING NOTES — always use `add_note`",
      "When the user asks to add/attach a note/comment/memo to a record (lead, deal, contact, account, custom module), ALWAYS call `add_note` — never create_record on Notes manually. Notes has a tricky schema (Parent_Id as a lookup object, se_module to name the parent module, Note_Content for the body) that's easy to get wrong, especially in voice mode. The `add_note` tool wraps all that and even does the lookup for you.",
      "  • If you know the record id, pass parent_id directly.",
      "  • If you only have a name/last name/email (e.g. user says 'add a note to lok8'), pass parent_search='lok8' and let the tool find the record.",
      "  • Always pass parent_module (e.g. 'Leads', 'Deals').",
      "  • Example: add_note({parent_module: 'Leads', parent_search: 'lok8', content: 'in final stage 3'}).",
      "",
      "SHOWING DATA — use the visualization tools, always",
      "When the user asks to 'show', 'list', 'compare', 'graph', 'chart', 'how many', 'breakdown', or anything analytical:",
      "  • For lists of records → call `show_table`. Pick 4–6 useful columns; don't dump every field. Use format='currency' for money, 'date' for dates, 'percent' for percentages.",
      "  • For category breakdowns / share of whole → `show_chart` with chart_type='donut' or 'pie'.",
      "  • For comparing counts / amounts across groups → `show_chart` with chart_type='bar'. Use `series` for multi-series comparisons.",
      "  • For trends over time → `show_chart` with chart_type='line'.",
      "  • For executive summary numbers → `show_kpis` with 2–6 cards.",
      "After calling a viz tool, ADD ONE SHORT sentence in text describing the headline takeaway (\"Most deals are stuck at Qualification — 17 of 32.\"). Don't repeat the raw numbers; the viz shows them.",
      "Visualizations work in BOTH text and voice mode — call them in voice too so the user can SEE what you're describing.",
      "",
      "show_table FORMAT (important — each row is an OBJECT with a `cells` array)",
      "  columns: [{label, format?, align?}, ...]   ← order defines column order",
      "  rows: [{cells: ['v0','v1','v2',...]}, {cells: ['v0','v1','v2',...]}, ...]",
      "  cells[N] in each row aligns to columns[N]. Use empty string '' for blanks. All cell values are STRINGS (the renderer formats currency/dates/percents based on column.format).",
      "  Example: show_table({",
      "    title: 'Top 5 leads',",
      "    columns: [{label:'Name'},{label:'Company'},{label:'Email'},{label:'Created', format:'date'}],",
      "    rows: [",
      "      {cells: ['Lok','ABC','lok@abc.com','2026-05-20']},",
      "      {cells: ['Prathamesh','XYZ','p@xyz.com','2026-05-19']}",
      "    ]",
      "  })",
      "",
      "CRITICAL — NEVER bluff a tool call",
      "Do NOT say \"here's the table\" or \"I created a chart\" or \"as you can see above\" UNLESS you have actually emitted the function call for show_table / show_chart / show_kpis in the same turn. Saying it without calling the tool means the user sees nothing. If for any reason you cannot call the visualization tool, do not claim it exists — just speak the data verbally.",
      "In voice mode this matters double: emit the function call FIRST, then speak ONE short sentence describing the headline. If the call fails (you get ok:false), apologize briefly and speak the data instead.",
      "",
      "BATCHING WRITES — important for UX",
      "When a single user request leads to multiple create_record/update_record/delete_record calls (e.g. 'update these 5 leads', 'create one lead per business card', 'delete these 3 tasks'), emit ALL of those calls IN THE SAME RESPONSE — not one per round. The user will see them in a single approval card with every change listed; one click runs them all. Splitting batched writes across rounds forces redundant approvals and feels broken. Only split when you genuinely need data from one call to decide the next.",
      "",
      "SUGGESTING NEXT STEPS — be human about it",
      "After completing a task, you MAY call `suggest_next_steps` to surface 1-3 clickable chips with useful follow-ups. Treat this like a thoughtful colleague would — not a checklist.",
      "When to suggest:",
      "  • A clear, genuinely valuable next action exists (\"You just created a lead from this business card — want me to schedule a follow-up call?\").",
      "  • The user might forget something time-sensitive (\"That deal's been in Qualification 3 weeks — flag it for review?\").",
      "  • A natural pair-action makes sense (\"Lead created — add them to your healthcare campaign?\").",
      "When NOT to suggest:",
      "  • After every single action — most actions don't need a follow-up.",
      "  • Generic prompts like \"Need anything else?\" or \"Want more info?\".",
      "  • Steps that are obvious or low-value.",
      "  • If the user just said \"thanks\" or seems done.",
      "  • If you've suggested something similar earlier in the same conversation.",
      "Phrasing:",
      "  • Use the user's language.",
      "  • Chip label = 2-5 words, action-oriented (\"Schedule follow-up\", \"Notify owner\").",
      "  • Chip prompt = the full sentence you'd act on if they tapped it.",
      "  • Quality over quantity. Often 1 chip is better than 3.",
      "Default behavior: stay silent. Only suggest when a real human would.",
    ];
    const preferred = state.settings.preferredName?.trim();
    const displayName = preferred || first;
    if (displayName) base.push("", `Call the user: ${displayName}. (Use sparingly.)`);
    if (state.user?.time_zone) base.push(`Timezone: ${state.user.time_zone}.`);

    // Knowledge base — durable facts about the user across sessions.
    const kb = Array.isArray(state.settings.knowledge) ? state.settings.knowledge : [];
    if (kb.length) {
      base.push("", "WHAT YOU REMEMBER ABOUT THE USER (durable across sessions; always honor these):");
      kb.forEach((k) => base.push(`  • [${k.id}] ${k.text}`));
    }
    base.push("", "MEMORY TOOLS",
      "When the user tells you their preferred name (\"call me X\", \"my name is X\"), call `set_preferred_name`.",
      "When the user shares a durable preference or fact about themselves or their work that future-you should know, call `remember_fact` with the fact in third person.",
      "If they ask you to forget something, call `forget_fact` with the id shown in brackets above.",
      "After saving, confirm briefly in one sentence — no announcement, just acknowledge.",
    );

    if (state.settings.systemPrompt && state.settings.systemPrompt.trim()) {
      base.push("", "Custom instructions from the admin:", state.settings.systemPrompt.trim());
    }
    return base.join("\n");
  }

  // --------- Attachments ---------
  function renderAttachmentsStrip() {
    if (!state.attachments.length) {
      attachmentsEl.hidden = true;
      attachmentsEl.innerHTML = "";
      return;
    }
    attachmentsEl.hidden = false;
    attachmentsEl.innerHTML = "";
    state.attachments.forEach((a, idx) => {
      const tile = document.createElement("div");
      tile.className = "attachment";
      const img = document.createElement("img");
      img.src = a._previewUrl || `data:${a.mimeType};base64,${a.data}`;
      img.alt = a._filename || "attachment";
      const x = document.createElement("button");
      x.className = "remove";
      x.type = "button";
      x.textContent = "×";
      x.setAttribute("aria-label", "Remove attachment");
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        if (a._previewUrl) URL.revokeObjectURL(a._previewUrl);
        state.attachments.splice(idx, 1);
        renderAttachmentsStrip();
      });
      tile.appendChild(img);
      tile.appendChild(x);
      attachmentsEl.appendChild(tile);
    });
  }

  async function addFiles(files) {
    const list = Array.from(files || []).filter((f) => Multimodal.ALLOWED_TYPES.test(f.type));
    if (!list.length && files && files.length) {
      renderError("Only image files (JPG / PNG / WEBP / HEIC) are supported.");
      return;
    }
    for (const file of list) {
      try {
        const part = await Multimodal.fileToInlinePart(file);
        state.attachments.push(part);
      } catch (e) {
        renderError(e.message || "Failed to attach file.");
      }
    }
    renderAttachmentsStrip();
    inputEl.focus();
  }

  // --------- Chat loop ---------
  // ── WhatsApp access command parser ───────────────────────────────────────────
  // Extracts a phone number (digits, +, spaces, dashes, parens) from a string
  function extractPhone(str) {
    const m = str.match(/([\+\d][\d\s\-\(\)]{5,})/);
    return m ? m[1].replace(/\s+/g, '').trim() : null;
  }

  function parseWhatsAppCommand(text) {
    const t = text.toLowerCase();

    // Grant patterns:
    // "grant whatsapp access to 86004…"
    // "add this number to whatsapp 86004…" / "add 86004… to whatsapp"
    // "give whatsapp access to 86004…"
    // "enable whatsapp for 86004…"
    // "add whatsapp 86004…"
    if (/grant\s+(?:whats\s*app\s+)?access|add\s+(?:this\s+number|[\+\d].*)\s+to\s+whats\s*app|add\s+whats\s*app|give\s+whats\s*app\s+access|enable\s+whats\s*app\s+(?:for|to)/i.test(text)) {
      const phone = extractPhone(text);
      if (phone) return { action: 'grant', phone };
    }

    // Revoke patterns:
    // "revoke whatsapp access from 86004…"
    // "remove whatsapp access for 86004…"
    // "disable whatsapp for 86004…"
    if (/revoke\s+(?:whats\s*app\s+)?access|remove\s+(?:whats\s*app\s+)?access|disable\s+whats\s*app/i.test(text)) {
      const phone = extractPhone(text);
      if (phone) return { action: 'revoke', phone };
    }

    // List patterns
    if (/list\s+(?:whats\s*app\s+)?(?:users|access|numbers|authorized|authorised)/i.test(text) ||
        /who\s+has\s+whats\s*app\s+access/i.test(text))
      return { action: 'list' };

    return null;
  }

  // ── Name / email form shown before granting access ───────────────────────────
  function promptContactDetails() {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'msg assistant';
      const card = document.createElement('div');
      card.className = 'bubble';
      card.innerHTML = `
        <p style="margin:0 0 4px;font-weight:600">Contact details</p>
        <p style="margin:0 0 14px;font-size:12px;opacity:.6">Optional — personalises the welcome message</p>
        <div class="field" style="margin-bottom:10px">
          <span class="field-label">Full name</span>
          <input id="_wa_name" type="text" placeholder="e.g. John Doe"
            style="display:block;width:100%;margin-top:4px;padding:8px 10px;border:1px solid rgba(0,0,0,.15);border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit">
        </div>
        <div class="field" style="margin-bottom:16px">
          <span class="field-label">Email</span>
          <input id="_wa_email" type="email" placeholder="e.g. john@company.com"
            style="display:block;width:100%;margin-top:4px;padding:8px 10px;border:1px solid rgba(0,0,0,.15);border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit">
        </div>
        <div style="display:flex;gap:8px">
          <button id="_wa_grant" class="btn primary" style="flex:1">Grant Access</button>
          <button id="_wa_skip" class="btn ghost">Skip</button>
        </div>`;
      wrap.appendChild(card);
      chatEl.appendChild(wrap);
      scrollToBottom();
      card.querySelector('#_wa_name').focus();

      function finish(name, email) {
        wrap.remove();
        resolve({ name: name.trim(), email: email.trim() });
      }
      card.querySelector('#_wa_grant').addEventListener('click', () =>
        finish(card.querySelector('#_wa_name').value, card.querySelector('#_wa_email').value)
      );
      card.querySelector('#_wa_skip').addEventListener('click', () => finish('', ''));
      card.querySelector('#_wa_email').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(card.querySelector('#_wa_name').value, card.querySelector('#_wa_email').value);
      });
    });
  }

  async function executeWhatsAppCommand(cmd, originalText) {
    const { catalystUrl, whatsappApiKey } = state.settings;
    if (!catalystUrl || !whatsappApiKey) {
      renderError('Set the WhatsApp Bot Catalyst URL and Internal API Key in Settings first.');
      return;
    }

    clearEmptyState();
    renderUser(originalText, []);

    // For grant, collect name + email before proceeding
    let contactName = '', contactEmail = '';
    if (cmd.action === 'grant') {
      ({ name: contactName, email: contactEmail } = await promptContactDetails());
    }

    const stream = openStreamingBubble();

    try {
      const base    = catalystUrl.replace(/\/$/, '');
      const cmdBase = `${base}/api/whatsapp/cmd?key=${encodeURIComponent(whatsappApiKey)}`;
      let url, data, res;

      if (cmd.action === 'grant') {
        const grantedBy = encodeURIComponent(state.user?.email || state.user?.full_name || 'CRM Widget');
        url  = `${cmdBase}&action=grant&phoneNumber=${encodeURIComponent(cmd.phone)}&grantedBy=${grantedBy}` +
               `&name=${encodeURIComponent(contactName)}&email=${encodeURIComponent(contactEmail)}`;
        res  = await fetch(url);
        data = await res.json();
        stream.append(data.success
          ? `✅ WhatsApp access granted to *${cmd.phone}*. They can now message the FIVA bot.`
          : `❌ Failed: ${data.error || JSON.stringify(data)}`
        );

      } else if (cmd.action === 'revoke') {
        const revokedBy = encodeURIComponent(state.user?.email || state.user?.full_name || 'CRM Widget');
        url  = `${cmdBase}&action=revoke&phoneNumber=${encodeURIComponent(cmd.phone)}&revokedBy=${revokedBy}`;
        res  = await fetch(url);
        data = await res.json();
        stream.append(data.success
          ? `✅ WhatsApp access revoked for *${cmd.phone}*.`
          : `❌ Failed: ${data.error || JSON.stringify(data)}`
        );

      } else if (cmd.action === 'list') {
        url  = `${cmdBase}&action=list`;
        res  = await fetch(url);
        data = await res.json();
        if (data.numbers?.length) {
          const lines = data.numbers.map(n =>
            `• *${n.phone}* — granted by ${n.grantedBy} on ${new Date(n.grantedAt).toLocaleDateString()}`
          );
          stream.append(`📱 *Authorised numbers (${data.numbers.length}):*\n\n${lines.join('\n')}`);
        } else if (data.success) {
          stream.append('No numbers have been granted WhatsApp access yet.');
        } else {
          stream.append(`❌ Error: ${data.error}`);
        }
      }
    } catch (err) {
      stream.append(`❌ Error: ${err.message || String(err)}`);
    } finally {
      stream.finalize();
    }
  }

  async function sendUserMessage(text) {
    if (state.busy) return;
    const trimmed = (text || "").trim();
    const hasAttachments = state.attachments.length > 0;
    if (!trimmed && !hasAttachments) return;

    // WhatsApp access commands are handled directly — no Gemini needed
    const waCmd = parseWhatsAppCommand(trimmed);
    if (waCmd) {
      await executeWhatsAppCommand(waCmd, trimmed);
      return;
    }

    if (!state.settings.apiKey) {
      renderError("Add your Gemini API key in Settings first.");
      return;
    }

    state.busy = true;
    sendBtn.disabled = true;
    inputEl.disabled = true;
    attachBtn.disabled = true;
    state.toolGroup = null; // start a fresh activity strip for this turn
    state.turnApproved = false; // re-ask for approval on this new user message
    // (conversationApproved stays — it survives across turns until New Chat)

    // Take a snapshot of attachments and clear them from the composer state.
    const attached = state.attachments.slice();
    state.attachments = [];
    renderAttachmentsStrip();

    // Default prompt for image-only turns
    const effectiveText = trimmed
      || (attached.length === 1
        ? "Extract whatever CRM-relevant information is in this image and create the appropriate record(s). Show me what you propose to create before doing it."
        : "Extract CRM-relevant information from each of these images and create the appropriate records. Show me what you propose before doing it.");

    renderUser(trimmed || `(${attached.length} image${attached.length > 1 ? "s" : ""})`, attached);

    const parts = [{ text: effectiveText }];
    attached.forEach((a) => parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } }));
    state.contents.push({ role: "user", parts });

    try {
      await runUntilDone();
    } catch (e) {
      renderError(e.message || String(e));
    } finally {
      finalizeToolGroup();
      state.busy = false;
      sendBtn.disabled = false;
      inputEl.disabled = false;
      attachBtn.disabled = false;
      inputEl.focus();
      saveChat();
    }
  }

  async function runUntilDone() {
    const client = buildClient();
    let safety = 0;

    while (safety++ < 16) {
      const typing = renderTyping();
      let response;
      let stream = null;
      try {
        state.abortController = new AbortController();
        response = await client.generateStream(state.contents, {
          signal: state.abortController.signal,
          onChunk({ deltaText }) {
            if (deltaText) {
              if (typing.isConnected) typing.remove();
              if (!stream) stream = openStreamingBubble();
              stream.append(deltaText);
            }
          },
        });
      } finally {
        if (typing.isConnected) typing.remove();
      }

      let parts = GeminiClient.partsOf(response);
      if (!parts.length) {
        // Streaming gave us nothing — fall back to the non-streaming endpoint.
        // This recovers cleanly when the SSE plumbing is flaky.
        console.warn("[FIVA] streaming returned no parts; falling back to non-streaming");
        if (stream) { stream.finalize(); stream = null; }
        const typing2 = renderTyping();
        try {
          response = await client.generate(state.contents, { signal: state.abortController.signal });
        } finally {
          if (typing2.isConnected) typing2.remove();
        }
        parts = GeminiClient.partsOf(response);
      }
      if (!parts.length) {
        // Still empty — bail with a clean rollback so the conversation history
        // doesn't carry a hanging user turn that confuses the next round.
        const last = state.contents[state.contents.length - 1];
        if (last && last.role === "user") {
          // Only pop if it was an actual user prompt (not a tool-response turn).
          const looksLikeUserPrompt = last.parts.some((p) => typeof p.text === "string" || p.inlineData);
          if (looksLikeUserPrompt) state.contents.pop();
        }
        renderError("Gemini returned an empty response. Try again, or check your model name in Settings.");
        return;
      }
      state.contents.push({ role: "model", parts });

      const text = GeminiClient.text(response);
      const calls = GeminiClient.functionCalls(response);

      if (stream) {
        const finalText = stream.finalize();
        // If model produced no calls AND we're done, speak it if voice output is on.
        if (!calls.length && state.settings.speakResponses && finalText.trim()) {
          Multimodal.speak(stripMarkdownForSpeech(finalText));
        }
      } else if (text && text.trim()) {
        // Fallback if no streaming chunks arrived but final response has text.
        renderAssistant(text.trim());
        if (!calls.length && state.settings.speakResponses) {
          Multimodal.speak(stripMarkdownForSpeech(text.trim()));
        }
      }

      if (!calls.length) return;

      // Separate UI-only tools (request_user_input) — they bypass the writes-confirm flow,
      // bypass CRMTools.call, and have their own user-driven UI flow.
      const uiCalls    = calls.filter((c) => CRMTools.isUI(c.name));
      const crmCalls   = calls.filter((c) => !CRMTools.isUI(c.name));
      const writes     = crmCalls.filter((c) => CRMTools.isWrite(c.name));
      const responseParts = [];

      const alreadyApproved = state.turnApproved || state.conversationApproved;
      if (writes.length && state.settings.confirmWrites && !alreadyApproved) {
        const decision = await new Promise((resolve) => renderConfirm(crmCalls, resolve));
        if (!decision.approved) {
          calls.forEach((c) => responseParts.push({
            functionResponse: { name: c.name, response: { ok: false, error: "User cancelled this action." } },
          }));
          state.contents.push({ role: "user", parts: responseParts });
          continue;
        }
        state.turnApproved = true;
        if (decision.trustChat) state.conversationApproved = true;
      }

      // UI tools first — they're interactive and produce data the next round will use.
      for (const call of uiCalls) {
        const result = await handleUITool(call);
        responseParts.push({ functionResponse: { name: call.name, response: result } });
      }

      // Then CRM tools.
      for (const call of crmCalls) {
        const row = appendToolRow(call.name, call.args || {});
        const result = await CRMTools.call(call.name, call.args || {});
        row.setResult(result);
        responseParts.push({ functionResponse: { name: call.name, response: result } });
      }
      state.contents.push({ role: "user", parts: responseParts });
    }

    renderError("Stopped after 16 tool-call rounds to avoid an infinite loop.");
  }

  // Finalize tool group at the end of every turn (success or error).
  function finalizeToolGroup() {
    if (state.toolGroup) {
      state.toolGroup.finalize();
      state.toolGroup = null;
    }
  }

  // --------- Composer behaviour ---------
  function autoGrow() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
  }
  inputEl.addEventListener("input", autoGrow);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });
  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = inputEl.value;
    inputEl.value = "";
    autoGrow();
    sendUserMessage(text);
  });

  // Attach button + file input
  attachBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = ""; // allow re-selecting the same file
  });

  // Drag & drop
  let dragDepth = 0;
  function isFileDrag(e) {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    for (const t of types) if (t === "Files" || t === "application/x-moz-file") return true;
    return false;
  }
  window.addEventListener("dragenter", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth++;
    dropOverlay.classList.remove("hidden");
  });
  window.addEventListener("dragover", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  window.addEventListener("dragleave", (e) => {
    if (!isFileDrag(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropOverlay.classList.add("hidden");
  });
  window.addEventListener("drop", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dropOverlay.classList.add("hidden");
    const files = Multimodal.filesFromDrop(e);
    if (files.length) addFiles(files);
  });

  // Paste image from clipboard
  window.addEventListener("paste", (e) => {
    const files = Multimodal.filesFromClipboard(e);
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  });

  // Voice input
  state.voice = new Multimodal.VoiceInput({
    onPartial(text) {
      inputEl.value = state.voiceBuffer + text;
      autoGrow();
    },
    onFinal(text) {
      state.voiceBuffer += text;
      inputEl.value = state.voiceBuffer;
      autoGrow();
    },
    onError(err) {
      micBtn.classList.remove("recording");
      if (err !== "no-speech" && err !== "aborted") renderError(`Voice error: ${err}`);
    },
    onEnd() {
      micBtn.classList.remove("recording");
      state.voiceBuffer = "";
    },
  });
  if (!state.voice.supported) {
    micBtn.disabled = true;
    micBtn.title = "Voice input not supported in this browser";
  } else {
    micBtn.addEventListener("click", () => {
      if (state.voice.active) {
        state.voice.stop();
      } else {
        state.voiceBuffer = inputEl.value ? inputEl.value + " " : "";
        micBtn.classList.add("recording");
        state.voice.start();
      }
    });
  }

  // Suggestion buttons.
  document.querySelectorAll(".suggest").forEach((b) => {
    b.addEventListener("click", () => {
      const p = b.getAttribute("data-prompt");
      if (p === "__SNAP__") {
        fileInput.click();
        return;
      }
      sendUserMessage(p || b.textContent);
    });
  });

  // The "+" new-chat button was removed from the topbar; the handler stays
  // null-guarded in case the markup ever returns. Refresh + the saved-chat
  // refresh-flag still gives the user a clean restart path.
  newChatBtn?.addEventListener("click", () => {
    if (state.busy) return;
    state.contents = [];
    state.attachments.forEach((a) => a._previewUrl && URL.revokeObjectURL(a._previewUrl));
    state.attachments = [];
    state.turnApproved = false;
    state.conversationApproved = false;
    clearSavedChat();
    renderAttachmentsStrip();
    // Rebuild the original empty-state markup so the welcome paints fresh.
    chatEl.innerHTML = `
      <div class="empty-state" id="emptyState">
        <div class="hero">
          <div class="hero-title" id="welcomeTitle">Hi.</div>
          <div class="hero-sub"   id="welcomeSub">Fresh start — what now?</div>
        </div>
      </div>
    `;
    paintWelcome();
  });

  // Settings save callback.
  Settings.bindUI({
    onSaved(values) { state.settings = values; },
  });

  /**
   * Shared write-confirmation flow used by live mode. Returns
   *   { approved: true } if already trusted this turn/chat, or
   *   { approved, trustChat } from the user clicking the confirm card.
   * Also updates state.turnApproved / state.conversationApproved so subsequent
   * writes in the same turn don't re-prompt.
   */
  async function handleLiveWriteConfirm(writeCalls) {
    if (!state.settings.confirmWrites) return { approved: true };
    if (state.turnApproved || state.conversationApproved) return { approved: true };
    const decision = await new Promise((resolve) => renderConfirm(writeCalls, resolve));
    if (decision?.approved) {
      state.turnApproved = true;
      if (decision.trustChat) state.conversationApproved = true;
    }
    return decision || { approved: false };
  }

  // ---------- Live voice mode (inline) ----------
  const liveBtn     = document.getElementById("liveBtn");
  const liveBar     = document.getElementById("liveBar");
  const liveStatus  = document.getElementById("liveStatus");
  const liveLevel   = document.getElementById("liveLevel");
  const liveEndBtn  = document.getElementById("liveEnd");
  const liveMuteBtn = document.getElementById("liveMute");

  // Per-turn live-bubbles (we reuse openStreamingBubble for the model side).
  const liveTurn = {
    userBubble: null,   // { textNode, wrap }
    modelStream: null,  // streamingBubble returned by openStreamingBubble()
  };

  function setLiveStatus(text) { if (liveStatus) liveStatus.textContent = text; }
  function showLiveBar() { liveBar.classList.remove("hidden"); liveBtn.classList.add("active"); }
  function hideLiveBar() { liveBar.classList.add("hidden");    liveBtn.classList.remove("active"); }

  function startUserLiveBubble() {
    clearEmptyState();
    if (liveTurn.userBubble) return liveTurn.userBubble;
    const wrap = document.createElement("div");
    wrap.className = "msg user live-msg";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const text = document.createElement("span");
    bubble.appendChild(text);
    bubble.appendChild(Object.assign(document.createElement("span"), { className: "stream-cursor" }));
    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    scrollToBottom();
    liveTurn.userBubble = { wrap, bubble, textNode: text };
    return liveTurn.userBubble;
  }

  function appendUserLiveText(text, finished) {
    const ub = startUserLiveBubble();
    ub.textNode.textContent += text;
    if (finished) {
      ub.bubble.querySelector(".stream-cursor")?.remove();
      ub.wrap.classList.remove("live-msg");
      liveTurn.userBubble = null;
    }
    scrollToBottom();
  }

  function appendModelLiveText(text, finished) {
    if (!liveTurn.modelStream) liveTurn.modelStream = openStreamingBubble();
    liveTurn.modelStream.append(text);
    if (finished) {
      liveTurn.modelStream.finalize();
      liveTurn.modelStream = null;
    }
  }

  function paintLevel(rms) {
    if (!liveLevel) return;
    const bars = liveLevel.children;
    const energy = Math.min(1, rms * 8);
    for (let i = 0; i < bars.length; i++) {
      const threshold = (i + 1) / bars.length;
      bars[i].classList.toggle("on", energy >= threshold - 0.18);
    }
  }

  async function startLive() {
    if (state.live) return;
    if (!state.settings.apiKey) {
      renderError("Add your Gemini API key in Settings first.");
      return;
    }
    showLiveBar();
    setLiveStatus("Connecting…");
    liveMuteBtn.textContent = "Mute";
    liveMuteBtn.classList.remove("danger");
    liveBar.classList.remove("error");

    state.live = new LiveChat({
      apiKey: state.settings.apiKey,
      systemPrompt: composeSystemPrompt() + "\n\nVOICE MODE: speak in short natural sentences (1–2 lines). React naturally (\"got it\", \"sure\"). When the user asks for data, lists, comparisons or any analytics — ALWAYS call show_table / show_chart / show_kpis after fetching, so they see it visually while you describe it in one short sentence.\n\nCREATE / UPDATE in voice — use the SAME flow as text mode:\n  1. Call get_module_fields first.\n  2. Call request_user_input with ALL mandatory fields (and any optional ones the user might want) — this opens a proper form in the chat. Tell the user briefly \"opening the form\" before you call it.\n  3. Wait for the form result. If the user cancels, acknowledge and stop.\n  4. Then call create_record / update_record with the merged data.\n  5. A confirmation card may pop up — user clicks Approve, then the record is created.\nNever attempt create_record without first using the form — verbal collection of 6+ fields is unreliable.",
      // Expose every tool in live mode — including request_user_input. The form
      // renders inline in the chat; voice stays active while the user fills it.
      tools: CRMTools.declarations,
      voice: "Zephyr",
      onClientTool: handleUITool,
      onConfirmWrites: handleLiveWriteConfirm,
      onState(s) {
        if (s === "connecting") setLiveStatus("Connecting…");
        else if (s === "live")  setLiveStatus("Listening — go ahead");
        else if (s === "ended") setLiveStatus("Ended");
        else if (s === "error") setLiveStatus("Error");
      },
      onUserText(text, finished)  { appendUserLiveText(text, finished); },
      onModelText(text, finished) { appendModelLiveText(text, finished); },
      onInterrupted() {
        // Cut off the model's in-progress bubble so the transcript stays truthful
        // (don't keep the streaming caret on a sentence FIVA was just told to abandon).
        if (liveTurn.modelStream) {
          liveTurn.modelStream.finalize();
          liveTurn.modelStream = null;
        }
        setLiveStatus("Listening — go ahead");
        liveBar.classList.add("interrupted");
        setTimeout(() => liveBar.classList.remove("interrupted"), 600);
      },
      onError(msg) {
        setLiveStatus(msg);
        liveBar.classList.add("error");
        renderError(`Live: ${msg}`);
      },
      onLevel: paintLevel,
    });
    try {
      await state.live.start();
    } catch (e) {
      setLiveStatus(e.message || String(e));
      liveBar.classList.add("error");
      renderError(`Live: ${e.message || e}`);
      // Auto-cleanup so the next click can retry from scratch.
      try { await state.live.stop(); } catch (_) {}
      state.live = null;
    }
  }

  async function endLive() {
    if (state.live) {
      try { await state.live.stop(); } catch (_) {}
      state.live = null;
    }
    // Finalize any half-streamed bubbles
    if (liveTurn.userBubble) {
      liveTurn.userBubble.bubble.querySelector(".stream-cursor")?.remove();
      liveTurn.userBubble.wrap.classList.remove("live-msg");
      liveTurn.userBubble = null;
    }
    if (liveTurn.modelStream) {
      liveTurn.modelStream.finalize();
      liveTurn.modelStream = null;
    }
    paintLevel(0);
    hideLiveBar();
  }

  liveBtn.addEventListener("click", () => {
    if (state.live) endLive();
    else startLive();
  });
  liveEndBtn.addEventListener("click", endLive);
  liveMuteBtn.addEventListener("click", () => {
    if (!state.live) return;
    const muted = !state.live.muted;
    state.live.setMuted(muted);
    liveMuteBtn.textContent = muted ? "Unmute" : "Mute";
    liveMuteBtn.classList.toggle("danger", muted);
  });

  function timeOfDay() {
    const h = new Date().getHours();
    if (h < 5)  return "late";
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    if (h < 21) return "evening";
    return "late";
  }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  // --------- Persistence (sessionStorage) ---------
  // Persist state.contents so navigating between CRM tabs (which destroys/recreates
  // this iframe) keeps the conversation. We also wipe the chat when the user
  // refreshes the CRM page (F5) — detected by the `beforeunload` event firing
  // on the iframe. SPA tab switches inside CRM use `pagehide` only, so they
  // don't trigger the wipe.
  const STORAGE_KEY = "jarvis.chat.v1";
  const REFRESH_FLAG_KEY = "jarvis.chat.refreshFlag";

  // Install once per widget instance. `beforeunload` fires when the browser
  // is navigating the page away (refresh, close, top-level nav). It does NOT
  // fire when the parent SPA simply removes the iframe via DOM manipulation.
  // So when a fresh widget instance sees this flag set, it knows the previous
  // life ended in a refresh — and clears the saved chat.
  window.addEventListener("beforeunload", () => {
    try { sessionStorage.setItem(REFRESH_FLAG_KEY, "1"); } catch (_) {}
  });

  function saveChat() {
    try {
      // Strip the legacy `request_user_input` form-result responses if huge —
      // they're already reflected in subsequent model turns. Keep everything else.
      const payload = JSON.stringify({ contents: state.contents, savedAt: Date.now() });
      // sessionStorage typically caps around 5 MB; warn if we're heading that way.
      if (payload.length > 4_500_000) {
        console.warn("[FIVA] chat history near sessionStorage limit; older messages may be dropped on next save.");
      }
      sessionStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      // Quota exceeded — drop oldest half and retry once.
      console.warn("[FIVA] saveChat failed:", e?.message || e);
      try {
        const half = Math.floor(state.contents.length / 2);
        const trimmed = state.contents.slice(half);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ contents: trimmed, savedAt: Date.now() }));
        state.contents = trimmed;
      } catch (_) {}
    }
  }

  function clearSavedChat() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  /** Restore prior chat. Returns true if anything was restored. */
  function restoreChat() {
    // If the previous instance ended via a real page refresh (beforeunload),
    // wipe the saved chat. SPA tab switches don't fire beforeunload, so
    // they fall through to the restore path.
    try {
      if (sessionStorage.getItem(REFRESH_FLAG_KEY) === "1") {
        sessionStorage.removeItem(REFRESH_FLAG_KEY);
        clearSavedChat();
        console.info("[FIVA] page refresh detected — starting a fresh chat.");
        return false;
      }
    } catch (_) {}

    let saved;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      saved = JSON.parse(raw);
    } catch (_) { return false; }

    const contents = Array.isArray(saved?.contents) ? saved.contents : [];
    if (!contents.length) return false;
    state.contents = contents;
    replayChat(contents);
    return true;
  }

  /** Walk Gemini-format contents and re-render visible bubbles. Tool calls and
   *  function responses are intentionally skipped — they're transient activity. */
  function replayChat(contents) {
    for (const turn of contents) {
      if (!turn || !Array.isArray(turn.parts)) continue;
      if (turn.role === "user") {
        const text = turn.parts.filter((p) => typeof p.text === "string").map((p) => p.text).join("");
        const attachments = turn.parts.filter((p) => p.inlineData).map((p) => p.inlineData);
        const isToolResponseTurn = turn.parts.some((p) => p.functionResponse);
        // Skip tool-response synthetic user turns and turns that have nothing user-visible.
        if (isToolResponseTurn) continue;
        if (!text && attachments.length === 0) continue;
        renderUser(text, attachments);
      } else if (turn.role === "model") {
        const text = turn.parts.filter((p) => typeof p.text === "string").map((p) => p.text).join("");
        if (text && text.trim()) renderAssistant(text.trim());
        // functionCall parts are not visually rendered on replay
      }
    }
  }

  function preferredOrCrmName() {
    const pref = state.settings.preferredName?.trim();
    if (pref) return pref;
    const first = (state.user?.first_name || state.user?.full_name || state.user?.name || "").split(" ")[0];
    return first || "";
  }

  function paintWelcome() {
    const titleEl = document.getElementById("welcomeTitle");
    const subEl   = document.getElementById("welcomeSub");
    if (!titleEl || !subEl) return;
    const name = preferredOrCrmName();
    const tod = timeOfDay();
    const hello = tod === "morning" ? `Morning${name ? `, ${name}` : ""}.`
                : tod === "afternoon" ? `Afternoon${name ? `, ${name}` : ""}.`
                : tod === "evening" ? `Evening${name ? `, ${name}` : ""}.`
                : `Hey${name ? `, ${name}` : ""}.`;
    const offer = pick([
      "What's on the list?",
      "What are we tackling?",
      "What do you need?",
      "Where do you want to start?",
      "What's the plan?",
    ]);
    titleEl.textContent = hello;
    subEl.textContent = offer;
  }

  // --------- Init ---------
  (async function init() {
    setCtxLine("Connecting to Zoho CRM…");
    try {
      await bootZohoSdk();
      const name = state.user?.full_name || state.user?.name || "user";
      setCtxLine(`Signed in as ${name}`);
    } catch (e) {
      setCtxLine("Running outside CRM (preview mode)");
    }

    // Try to restore a prior chat from sessionStorage so navigating between
    // CRM tabs (which reloads the iframe) doesn't wipe the conversation.
    const restored = restoreChat();
    if (!restored && state.settings.greetOnOpen) {
      paintWelcome();
    }
  })();
})();
