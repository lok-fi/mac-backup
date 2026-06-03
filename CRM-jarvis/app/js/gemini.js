/**
 * Thin Gemini client with function-calling loop.
 * Uses the Generative Language REST API (v1beta) which works directly from the browser.
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}
 *
 * The conversation array `contents` follows Gemini's schema:
 *   { role: 'user'|'model'|'function', parts: [{ text }, { functionCall }, { functionResponse }] }
 */
(function (global) {
  "use strict";

  const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

  class GeminiClient {
    constructor({ apiKey, model, systemPrompt, tools }) {
      this.apiKey = apiKey;
      this.model = model || "	gemini-3.5-flash";
      this.systemPrompt = systemPrompt || "";
      this.tools = tools || [];
    }

    setApiKey(key) { this.apiKey = key; }
    setModel(model) { this.model = model; }
    setSystemPrompt(p) { this.systemPrompt = p; }

    _body(contents) {
      return {
        contents,
        tools: this.tools.length ? [{ functionDeclarations: this.tools }] : undefined,
        toolConfig: this.tools.length ? { functionCallingConfig: { mode: "AUTO" } } : undefined,
        systemInstruction: this.systemPrompt
          ? { role: "system", parts: [{ text: this.systemPrompt }] }
          : undefined,
        generationConfig: {
          temperature: 0.6,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      };
    }

    async generate(contents, { signal } = {}) {
      if (!this.apiKey) throw new Error("Gemini API key is not set. Open Settings to add one.");

      const url = `${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const body = this._body(contents);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const text = await res.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch (_) { parsed = { raw: text }; }
        const msg = parsed?.error?.message || `Gemini API error ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.response = parsed;
        throw err;
      }

      return await res.json();
    }

    /**
     * Streaming generate — uses Server-Sent Events.
     * onChunk({ deltaText, parts, raw }) is called for every parsed event.
     * Returns the final assembled response (same shape as generate()).
     */
    async generateStream(contents, { signal, onChunk } = {}) {
      if (!this.apiKey) throw new Error("Gemini API key is not set. Open Settings to add one.");
      const url = `${ENDPOINT}/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
      const body = this._body(contents);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let parsed; try { parsed = JSON.parse(text); } catch (_) { parsed = { raw: text }; }
        const msg = parsed?.error?.message || `Gemini stream error ${res.status}`;
        const err = new Error(msg);
        err.status = res.status; err.response = parsed;
        throw err;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      const collectedParts = []; // merged text + functionCall parts
      let lastRaw = null;

      const findBoundary = (s) => {
        const a = s.indexOf("\n\n");
        const b = s.indexOf("\r\n\r\n");
        if (a < 0) return b < 0 ? -1 : [b, 4];
        if (b < 0) return [a, 2];
        return a < b ? [a, 2] : [b, 4];
      };

      const processEventBlock = (block) => {
        // Concat all consecutive `data:` lines per SSE spec.
        const lines = block.split(/\r?\n/);
        let payload = "";
        for (const line of lines) {
          if (line.startsWith("data:")) payload += line.slice(5).trimStart();
        }
        if (!payload || payload === "[DONE]") return;
        let json;
        try { json = JSON.parse(payload); } catch (e) {
          console.debug("[Gemini SSE] non-JSON payload skipped:", payload.slice(0, 200));
          return;
        }
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          lastRaw = item;
          const parts = item?.candidates?.[0]?.content?.parts || [];
          let deltaText = "";
          for (const p of parts) {
            // Preserve the WHOLE part — including thoughtSignature and other
            // fields the reasoning models attach. Stripping these breaks tool
            // use and causes the "missing thought_signature" warning.
            if (typeof p.text === "string") deltaText += p.text;
            collectedParts.push({ ...p });
          }
          if (onChunk) onChunk({ deltaText, parts, raw: item });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process all complete events in the buffer.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const bnd = findBoundary(buffer);
          if (bnd === -1) break;
          const [idx, len] = bnd;
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + len);
          processEventBlock(block);
        }
      }
      // Flush any trailing content (last event without terminating blank line).
      const tail = buffer.trim();
      if (tail) processEventBlock(tail);

      // If we collected nothing and the server returned a plain JSON array
      // (not SSE), parse that as a fallback. We can't re-read the body here,
      // but the earlier loop appended any plain JSON text to `tail` already.
      // Defensive: if the very first chunk of the stream was a `[`, the SSE
      // parser would have failed to recognize events; the trim+processEventBlock
      // above handles single-event-no-trailing-newline cases.

      // Merge consecutive text parts into one for cleaner history.
      const mergedParts = [];
      for (const p of collectedParts) {
        const last = mergedParts[mergedParts.length - 1];
        if (last && typeof last.text === "string" && typeof p.text === "string") {
          last.text += p.text;
        } else {
          mergedParts.push({ ...p });
        }
      }

      return {
        candidates: [{ content: { role: "model", parts: mergedParts } }],
        _raw: lastRaw,
      };
    }

    /** Extract the parts of the first candidate. */
    static partsOf(response) {
      return response?.candidates?.[0]?.content?.parts || [];
    }

    /** Pull out functionCall parts from a response. */
    static functionCalls(response) {
      return GeminiClient.partsOf(response)
        .filter((p) => p.functionCall)
        .map((p) => p.functionCall);
    }

    /** Pull out plain text from a response, concatenated. */
    static text(response) {
      return GeminiClient.partsOf(response)
        .filter((p) => typeof p.text === "string")
        .map((p) => p.text)
        .join("");
    }
  }

  global.GeminiClient = GeminiClient;
})(window);
