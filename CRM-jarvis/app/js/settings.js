/**
 * Settings panel + persistence in localStorage.
 * Everything is per-browser/per-user — no key ever leaves the device except in calls to Gemini.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "crm-jarvis.settings.v1";

  const DEFAULTS = {
    apiKey: "AIzaSyDlr6ZVS5xJS9uw1168R4_6jRsbCWfIduM",
    model: "gemini-3.5-flash",
    liveModel: "gemini-3.1-flash-live-preview", // pinned in live-chat.js; kept here for visibility
    systemPrompt: "",
    confirmWrites: true,
    speakResponses: false,
    greetOnOpen: true,
    preferredName: "",
    knowledge: [],            // [{ id, text, addedAt }]
    catalystUrl: "",          // FIVA WhatsApp Catalyst function base URL
    whatsappApiKey: "",       // INTERNAL_API_KEY for the /api/whatsapp/access endpoints
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function save(values) {
    const merged = { ...load(), ...values };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // --- Memory helpers ---
  function setPreferredName(name) {
    const trimmed = String(name || "").trim();
    return save({ preferredName: trimmed });
  }

  function addKnowledge(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return load();
    const s = load();
    const id = "k_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const next = (s.knowledge || []).concat([{ id, text: trimmed, addedAt: Date.now() }]);
    return save({ knowledge: next });
  }

  function removeKnowledge(id) {
    const s = load();
    const next = (s.knowledge || []).filter((k) => k.id !== id);
    return save({ knowledge: next });
  }

  function clearKnowledge() {
    return save({ knowledge: [], preferredName: "" });
  }

  function bindUI({ onSaved }) {
    const overlay = document.getElementById("settingsOverlay");
    const openBtn = document.getElementById("settingsBtn");
    const closeBtn = document.getElementById("settingsClose");
    const saveBtn = document.getElementById("settingsSave");
    const clearBtn = document.getElementById("settingsClear");

    const apiKeyEl = document.getElementById("apiKey");
    const modelEl = document.getElementById("model");
    const liveModelEl = document.getElementById("liveModel");
    const confirmEl = document.getElementById("confirmWrites");
    const sysEl = document.getElementById("systemPrompt");
    const speakEl = document.getElementById("speakResponses");
    const greetEl = document.getElementById("greetOnOpen");
    const preferredNameEl = document.getElementById("preferredName");
    const knowledgeListEl = document.getElementById("knowledgeList");
    const knowledgeAddInput = document.getElementById("knowledgeAddInput");
    const knowledgeAddBtn = document.getElementById("knowledgeAddBtn");
    const catalystUrlEl = document.getElementById("catalystUrl");
    const whatsappApiKeyEl = document.getElementById("whatsappApiKey");

    function paint() {
      const s = load();
      apiKeyEl.value = s.apiKey || "";
      modelEl.value = s.model || DEFAULTS.model;
      if (liveModelEl) liveModelEl.value = s.liveModel || DEFAULTS.liveModel;
      confirmEl.value = String(!!s.confirmWrites);
      sysEl.value = s.systemPrompt || "";
      if (speakEl) speakEl.value = String(!!s.speakResponses);
      if (greetEl) greetEl.value = String(!!s.greetOnOpen);
      if (preferredNameEl) preferredNameEl.value = s.preferredName || "";
      if (catalystUrlEl) catalystUrlEl.value = s.catalystUrl || "";
      if (whatsappApiKeyEl) whatsappApiKeyEl.value = s.whatsappApiKey || "";
      paintKnowledge();
    }

    function paintKnowledge() {
      if (!knowledgeListEl) return;
      const s = load();
      const items = s.knowledge || [];
      knowledgeListEl.innerHTML = "";
      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "kb-empty";
        empty.textContent = "Nothing remembered yet. Say something like \"remember I prefer concise updates\" in chat, or add an entry below.";
        knowledgeListEl.appendChild(empty);
        return;
      }
      items.forEach((k) => {
        const row = document.createElement("div");
        row.className = "kb-item";
        const txt = document.createElement("div");
        txt.className = "kb-text";
        txt.textContent = k.text;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "kb-remove";
        remove.setAttribute("aria-label", "Forget this");
        remove.innerHTML = "×";
        remove.addEventListener("click", () => {
          removeKnowledge(k.id);
          paintKnowledge();
        });
        row.appendChild(txt);
        row.appendChild(remove);
        knowledgeListEl.appendChild(row);
      });
    }

    function open() { paint(); overlay.classList.remove("hidden"); apiKeyEl.focus(); }
    function close() { overlay.classList.add("hidden"); }

    openBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.classList.contains("hidden")) close();
    });

    saveBtn.addEventListener("click", () => {
      const merged = save({
        apiKey: apiKeyEl.value.trim(),
        model: modelEl.value.trim() || DEFAULTS.model,
        liveModel: (liveModelEl?.value || DEFAULTS.liveModel).trim() || DEFAULTS.liveModel,
        confirmWrites: confirmEl.value === "true",
        systemPrompt: sysEl.value,
        speakResponses: speakEl ? speakEl.value === "true" : false,
        greetOnOpen: greetEl ? greetEl.value === "true" : true,
        preferredName:   preferredNameEl ? preferredNameEl.value.trim() : "",
        catalystUrl:     catalystUrlEl ? catalystUrlEl.value.trim() : "",
        whatsappApiKey:  whatsappApiKeyEl ? whatsappApiKeyEl.value.trim() : "",
      });
      close();
      if (typeof onSaved === "function") onSaved(merged);
    });

    if (knowledgeAddBtn && knowledgeAddInput) {
      const doAdd = () => {
        const v = knowledgeAddInput.value.trim();
        if (!v) return;
        addKnowledge(v);
        knowledgeAddInput.value = "";
        paintKnowledge();
      };
      knowledgeAddBtn.addEventListener("click", doAdd);
      knowledgeAddInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); doAdd(); }
      });
    }

    clearBtn.addEventListener("click", () => {
      if (!confirm("Clear all settings including the API key?")) return;
      clear();
      paint();
      if (typeof onSaved === "function") onSaved(load());
    });

    // API key is hard-coded; no first-run prompt needed.
  }

  global.Settings = {
    load, save, clear, bindUI, DEFAULTS,
    setPreferredName, addKnowledge, removeKnowledge, clearKnowledge,
  };
})(window);
