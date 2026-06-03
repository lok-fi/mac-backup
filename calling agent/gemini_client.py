"""
Gemini Live session — AUDIO modality (the only mode supported by native audio models).
Gemini handles both STT (via VAD) and TTS (24 kHz PCM output).
Transcriptions of both sides are returned for call-log storage.
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from google import genai
from google.genai import types

from config import settings

log = logging.getLogger(__name__)

MODEL = "gemini-3.1-flash-live-preview"

_BASE_SYSTEM_PROMPT = """You are Arjun, a voice agent for TeamLease Services calling {name} (phone: {phone}, email: {email}).

RULES: Max 2 sentences per reply. No lists or markdown. One question at a time. Natural Indian English. Use query_knowledge_base for TeamLease service questions.

SCRIPT:
1. INTRO: "Hi! Is this {name}? This is Arjun from TeamLease — calling about your callback request. Is this a good time?"
   - Not a good time → ask when to call back and close politely.
   - Yes → "Are you looking for contract staffing — where people work under your supervision but on TeamLease's payroll?"
     - Yes → PHASE 2 | No → PHASE 3

2. CONTRACT STAFFING:
   a) "Would you like to transfer existing staff to TeamLease's payroll, or should we hire and deploy new people for you?"
   b) Ask: roles, headcount, locations.
   c) Ask: salary range and onboarding timeline.
   d) Ask: their role and who signs off on this.
   Close: "I'm passing this to our staffing expert now — you'll hear from us very shortly."

3. NON-CONTRACT: "TeamLease also covers apprenticeships, permanent hiring, payroll & compliance, HRMS, and learning solutions. What specifically are you looking for?"
   After answer: "I've noted this and will have the right expert reach out. Thank you!"

OBJECTIONS:
- TeamLease employee/associate → "Please write to info@teamlease.com or use the chatbot on the TeamLease app."
- Job seeker → "Please visit teamlease.com for all our openings."
- Hostile/not interested → Thank politely and close.
"""

_TOOLS = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="query_knowledge_base",
                description="Search TeamLease knowledge base for services, FAQs, pricing, compliance info.",
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "query": types.Schema(
                            type="STRING",
                            description="The question or topic to look up",
                        )
                    },
                    required=["query"],
                ),
            )
        ]
    )
]


class GeminiLiveSession:
    def __init__(self, session):
        self._s = session

    async def send_audio(self, pcm_16k: bytes):
        """Send caller audio (16-bit PCM 16 kHz) to Gemini's VAD."""
        await self._s.send_realtime_input(
            audio=types.Blob(data=pcm_16k, mime_type="audio/pcm;rate=16000")
        )

    async def send_text(self, text: str):
        """Inject a text turn (used only for the greeting trigger)."""
        await self._s.send_client_content(
            turns=[types.Content(role="user", parts=[types.Part(text=text)])],
            turn_complete=True,
        )

    async def send_tool_result(self, call_id: str, name: str, result: str):
        await self._s.send_tool_response(
            function_responses=[
                types.FunctionResponse(
                    id=call_id,
                    name=name,
                    response={"result": result},
                )
            ]
        )

    async def receive(self) -> AsyncIterator[dict]:
        """
        Yields normalised event dicts:
          {"type": "audio",          "data": bytes}    ← 24 kHz PCM from Gemini TTS
          {"type": "text",           "text": str}      ← output transcription (AI speech as text)
          {"type": "user_transcript","text": str}      ← input transcription (user speech as text)
          {"type": "interrupted"}                      ← user barged in; stop sending audio
          {"type": "turn_complete"}                    ← AI finished its turn
          {"type": "function_call",  "call_id", "name", "args"}
        """
        turn = 0
        while True:
            turn += 1
            try:
                async for response in self._s.receive():

                    if response.tool_call:
                        for fn in response.tool_call.function_calls:
                            log.info("tool_call: %s", fn.name)
                            yield {"type": "function_call", "call_id": fn.id, "name": fn.name, "args": dict(fn.args)}

                    raw_audio = getattr(response, "data", None)
                    if raw_audio:
                        yield {"type": "audio", "data": raw_audio}

                    sc = getattr(response, "server_content", None)
                    if sc:
                        if not raw_audio:
                            mt = getattr(sc, "model_turn", None)
                            if mt:
                                for part in (getattr(mt, "parts", None) or []):
                                    inline = getattr(part, "inline_data", None)
                                    if inline and getattr(inline, "data", None):
                                        yield {"type": "audio", "data": inline.data}
                                    blob = getattr(part, "blob", None)
                                    if blob and getattr(blob, "data", None):
                                        yield {"type": "audio", "data": blob.data}

                        ot = getattr(sc, "output_transcription", None)
                        if ot and getattr(ot, "text", None):
                            log.info("AI: %r", ot.text)
                            yield {"type": "text", "text": ot.text}

                        it = getattr(sc, "input_transcription", None)
                        if it and getattr(it, "text", None):
                            log.info("User: %r", it.text)
                            yield {"type": "user_transcript", "text": it.text}

                        if getattr(sc, "interrupted", False):
                            log.info("barge-in")
                            yield {"type": "interrupted"}

                        if getattr(sc, "turn_complete", False):
                            yield {"type": "turn_complete"}

                    oat = getattr(response, "output_audio_transcription", None)
                    if oat and getattr(oat, "text", None):
                        log.info("AI: %r", oat.text)
                        yield {"type": "text", "text": oat.text}

                    rit = getattr(response, "realtime_input_transcription", None)
                    if rit and getattr(rit, "text", None):
                        log.info("User: %r", rit.text)
                        yield {"type": "user_transcript", "text": rit.text}

            except Exception as exc:
                log.error("receive() turn %d crashed: %s", turn, exc, exc_info=True)
                return


@asynccontextmanager
async def gemini_live_session(lead: dict) -> AsyncIterator[GeminiLiveSession]:
    client = genai.Client(api_key=settings.gemini_api_key)

    system_prompt = _BASE_SYSTEM_PROMPT.format(
        name=lead.get("name", "there"),
        phone=lead.get("phone", ""),
        email=lead.get("email", ""),
    )

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Aoede"
                )
            )
        ),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                # Cut silence detection from ~800ms default down to 400ms
                silence_duration_ms=400,
                # Detect speech start faster so we don't miss the first word
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                # End speech detection more aggressively — less waiting after user stops
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
            )
        ),
        system_instruction=types.Content(
            role="system",
            parts=[types.Part(text=system_prompt)],
        ),
        tools=_TOOLS,
    )

    async with client.aio.live.connect(model=MODEL, config=config) as session:
        yield GeminiLiveSession(session)
