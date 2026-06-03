"""
Core call pipeline: Twilio WebSocket ↔ Gemini Live (AUDIO mode).

Audio flow:
  Inbound:  Twilio µ-law 8 kHz → PCM 16 kHz → Gemini Live (STT + VAD)
  Outbound: Gemini Live PCM 24 kHz → µ-law 8 kHz → Twilio (native TTS)

Barge-in is handled entirely by Gemini's VAD; it sends an `interrupted` event
which causes us to flush Twilio's buffer and discard any remaining audio chunks.
"""
import asyncio
import base64
import json
import logging

from fastapi import WebSocket

import store
from audio_utils import ulaw8k_to_pcm16k, pcm24k_to_ulaw8k
from extract_output import extract_output_variables
from gemini_client import GeminiLiveSession, gemini_live_session
from knowledge_base import get_kb

log = logging.getLogger(__name__)


class CallPipeline:
    def __init__(self, call_sid: str, lead: dict):
        self.call_sid = call_sid
        self.lead = lead
        self.kb = get_kb()

        self._stream_sid = ""
        self._stop_speaking = False   # True between `interrupted` and `turn_complete`
        self._audio_chunk_count = 0
        self._max_rms = 0

    # ─────────────────────────────────────────────
    # Entry point
    # ─────────────────────────────────────────────

    async def run(self, ws: WebSocket):
        store.mark_connected(self.call_sid)
        async with gemini_live_session(self.lead) as session:
            await asyncio.gather(
                self._recv_from_twilio(ws, session),
                self._recv_from_gemini(session, ws),
            )

    # ─────────────────────────────────────────────
    # Direction 1: Twilio → Gemini (caller's voice)
    # ─────────────────────────────────────────────

    async def _recv_from_twilio(self, ws: WebSocket, session: GeminiLiveSession):
        async for raw in ws.iter_text():
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event = msg.get("event")

            if event == "start":
                self._stream_sid = msg["start"]["streamSid"]
                log.info("[%s] Stream started, streamSid=%s", self.call_sid, self._stream_sid)
                asyncio.create_task(self._send_greeting(session))

            elif event == "media":
                # Twilio default stream only sends inbound track; skip outbound if present.
                if msg["media"].get("track") == "outbound":
                    continue

                ulaw = base64.b64decode(msg["media"]["payload"])

                # Periodic audio level logging for diagnostics.
                import audioop as _ao
                rms = _ao.rms(_ao.ulaw2lin(ulaw, 2), 2)
                self._audio_chunk_count += 1
                if rms > self._max_rms:
                    self._max_rms = rms
                if self._audio_chunk_count % 500 == 0:
                    log.info("[%s] Audio stats — chunks=%d max_rms=%d",
                             self.call_sid, self._audio_chunk_count, self._max_rms)
                    self._max_rms = 0

                await session.send_audio(ulaw8k_to_pcm16k(ulaw))

            elif event == "stop":
                break

    # ─────────────────────────────────────────────
    # Direction 2: Gemini → Twilio (AI's voice)
    # ─────────────────────────────────────────────

    async def _recv_from_gemini(self, session: GeminiLiveSession, ws: WebSocket):
        async for event in session.receive():
            etype = event["type"]

            if etype == "function_call":
                result = await self._handle_tool(event)
                await session.send_tool_result(event["call_id"], event["name"], result)

            elif etype == "audio":
                if self._stop_speaking:
                    continue
                ulaw = pcm24k_to_ulaw8k(event["data"])
                try:
                    await ws.send_text(json.dumps({
                        "event": "media",
                        "streamSid": self._stream_sid,
                        "media": {"payload": base64.b64encode(ulaw).decode()},
                    }))
                except Exception as e:
                    log.warning("[%s] audio send failed: %s", self.call_sid, e)
                    continue

            elif etype == "interrupted":
                # User barged in — stop sending audio and flush Twilio's buffer.
                log.info("[%s] Barge-in: flushing Twilio buffer", self.call_sid)
                self._stop_speaking = True
                try:
                    await ws.send_text(json.dumps({
                        "event": "clear",
                        "streamSid": self._stream_sid,
                    }))
                except Exception:
                    pass

            elif etype == "turn_complete":
                self._stop_speaking = False

            elif etype == "text":
                store.add_turn(self.call_sid, "assistant", event["text"])

            elif etype == "user_transcript":
                store.add_turn(self.call_sid, "user", event["text"])

        log.info("[%s] Gemini session ended", self.call_sid)

    # ─────────────────────────────────────────────
    # Post-call extraction
    # ─────────────────────────────────────────────

    async def extract_and_save(self):
        store.mark_extracting(self.call_sid)
        call = store.get_call(self.call_sid)
        if not call:
            return
        transcript = call.get("transcript", [])
        output, call_type, summary = await extract_output_variables(transcript, self.lead)
        store.save_result(self.call_sid, output, call_type, summary)
        log.info("[%s] Results saved — call_type=%s", self.call_sid, call_type)

    # ─────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────

    async def _send_greeting(self, session: GeminiLiveSession):
        await asyncio.sleep(0)
        await session.send_text(
            f"Start the call. Greet the caller and introduce yourself as Arjun from TeamLease. "
            f"Their name is {self.lead.get('name', 'there')}."
        )

    async def _handle_tool(self, event: dict) -> str:
        if event["name"] == "query_knowledge_base":
            return await self.kb.query(event["args"].get("query", ""))
        return "Unknown tool."
