import asyncio
import base64
import io
import wave

import httpx

from config import settings

SARVAM_BASE_URL = "https://api.sarvam.ai"
SAMPLE_RATE = 8000          # Request 8 kHz to match Vobiz G.711 directly
CHUNK_MS = 20               # Stream audio in 20 ms slices
CHUNK_BYTES = int(SAMPLE_RATE * 2 * CHUNK_MS / 1000)   # 320 bytes / chunk


class SarvamTTSClient:
    """Calls Sarvam Bulbul v3 TTS and yields raw PCM chunks for streaming."""

    sample_rate = SAMPLE_RATE

    def __init__(self):
        self._headers = {
            "api-subscription-key": settings.sarvam_api_key,
            "Content-Type": "application/json",
        }

    async def stream(self, text: str, speaker: str = "amit"):
        """
        Async generator — yields 16-bit mono PCM chunks at 8 kHz.
        First chunk arrives in ~150-300 ms (one HTTP round-trip).
        """
        payload = {
            "inputs": [text],
            "target_language_code": "en-IN",
            "speaker": speaker,
            "model": "bulbul:v3",
            "pace": 1.0,
            "speech_sample_rate": SAMPLE_RATE,
            "enable_preprocessing": True,
            "wav_file_format": "wav",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{SARVAM_BASE_URL}/text-to-speech",
                headers=self._headers,
                json=payload,
            )
            resp.raise_for_status()

            data = resp.json()
            audios = data.get("audios", [])
            if not audios:
                return

            wav_bytes = base64.b64decode(audios[0])
            pcm = _wav_to_pcm(wav_bytes)

        # Yield in small chunks to keep the audio pipeline streaming
        for i in range(0, len(pcm), CHUNK_BYTES):
            yield pcm[i : i + CHUNK_BYTES]
            await asyncio.sleep(0)   # yield control so other tasks can run

    async def synthesize(self, text: str, speaker: str = "meera") -> bytes:
        """Return all PCM at once (used for short utterances / greetings)."""
        chunks = []
        async for chunk in self.stream(text, speaker=speaker):
            chunks.append(chunk)
        return b"".join(chunks)


def _wav_to_pcm(wav_bytes: bytes) -> bytes:
    with io.BytesIO(wav_bytes) as buf:
        with wave.open(buf, "rb") as w:
            return w.readframes(w.getnframes())
