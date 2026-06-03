# AI Calling Agent

Real-time inbound + outbound calling with **Gemini Live** (STT + LLM) and **Sarvam Bulbul v3** (Indian TTS).

## Architecture

```
Caller ─── Vobiz (G.711 µ-law 8kHz WebSocket)
               │
          FastAPI Server
          ┌────┴─────────────────────────────┐
          │  audio_utils.py                  │
          │  µ-law 8k → PCM 16k (for Gemini) │
          │  PCM 8k  → µ-law 8k (from Sarvam)│
          └────┬────────────────┬────────────┘
               │                │
         Gemini Live        Sarvam TTS
         (STT + LLM)      Bulbul v3 / meera
         TEXT output        Indian voice
               │                │
          knowledge_base.py (ChromaDB RAG)
```

**Latency budget:** ~600 ms – 1.2 s end-to-end (well under 2 s target)

---

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Edit .env — fill in VOBIZ_CALLER_ID and SERVER_HOST
cp .env .env.local   # optional

# 3. Populate the knowledge base
python ingest_kb.py

# 4. Expose your server publicly (dev)
ngrok http 8000
# Copy the https://xxxx.ngrok.io URL into SERVER_HOST in .env (without https://)

# 5. Start the server
python main.py
```

---

## Vobiz Console Setup

1. Log in to **console.vobiz.ai**
2. Buy a DID (phone number) → copy it into `VOBIZ_CALLER_ID` in `.env`
3. Configure the DID's **Answer URL** → `https://YOUR_SERVER/webhook/inbound`
4. Set the **Hangup URL** → `https://YOUR_SERVER/webhook/hangup`

---

## Trigger an Outbound Call

```bash
curl -X POST https://YOUR_SERVER/api/call/outbound \
  -H "Content-Type: application/json" \
  -d '{"to": "+919XXXXXXXXX", "caller_name": "Rahul", "reason": "subscription renewal"}'
```

---

## Add Knowledge Base Documents

Edit `ingest_kb.py` and add your company's docs, then re-run:

```bash
python ingest_kb.py
```

---

## File Overview

| File | Purpose |
|---|---|
| `main.py` | FastAPI app — webhooks + WebSocket handler + outbound API |
| `pipeline.py` | Core call pipeline — wires Vobiz ↔ Gemini ↔ Sarvam |
| `gemini_client.py` | Gemini Live async client (STT + LLM, function calling) |
| `sarvam_client.py` | Sarvam Bulbul v3 TTS — streams PCM audio chunks |
| `audio_utils.py` | µ-law ↔ PCM conversion + silence detection |
| `knowledge_base.py` | ChromaDB + MiniLM vector store |
| `ingest_kb.py` | One-time script to load docs into the KB |
| `config.py` | Pydantic settings — reads from `.env` |

---

## Sarvam Speaker Options

| Speaker | Voice |
|---|---|
| `meera` | Indian female (default) |
| `pavithra` | Indian female |
| `maitreyi` | Indian female |
| `arvind` | Indian male |
| `amol` | Indian male |
| `amartya` | Indian male |

Change the speaker in `pipeline.py` → `self.sarvam.stream(text, speaker="meera")`.

---

## Notes

- **Model:** Gemini Live uses `gemini-2.0-flash-live-001`. Update `MODEL` in `gemini_client.py` if/when `gemini-3.1-flash-live-preview` becomes available via your API key.
- **Barge-in:** Supported — user speech during AI response cancels the TTS immediately.
- **Sentence streaming:** AI text is piped to Sarvam sentence-by-sentence. First audio plays in ~400 ms after Gemini starts generating.
