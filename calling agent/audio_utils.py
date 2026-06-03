import audioop

# Phone-line PCM after µ-law decode is very quiet (RMS ~5 for silence, ~50-200 for speech).
# Gemini Live VAD needs a much stronger signal, so we apply a fixed gain before sending.
_GAIN = 4    # enough to lift quiet phone audio without clipping normal speech (RMS 2000-6000)


def ulaw8k_to_pcm16k(ulaw_bytes: bytes) -> bytes:
    """G.711 µ-law 8 kHz → Linear PCM 16-bit 16 kHz (Gemini Live input format)."""
    pcm_8k = audioop.ulaw2lin(ulaw_bytes, 2)
    pcm_8k = audioop.mul(pcm_8k, 2, _GAIN)
    pcm_16k, _ = audioop.ratecv(pcm_8k, 2, 1, 8000, 16000, None)
    return pcm_16k


def pcm24k_to_ulaw8k(pcm_bytes: bytes) -> bytes:
    """Linear PCM 24 kHz 16-bit mono → G.711 µ-law 8 kHz (Twilio output format).

    Gemini Live outputs audio at 24 kHz; Twilio expects G.711 µ-law at 8 kHz.
    """
    pcm_8k, _ = audioop.ratecv(pcm_bytes, 2, 1, 24000, 8000, None)
    return audioop.lin2ulaw(pcm_8k, 2)


def is_silence(ulaw_bytes: bytes, threshold: int = 200) -> bool:
    """Return True when the chunk is below the energy threshold."""
    pcm = audioop.ulaw2lin(ulaw_bytes, 2)
    return audioop.rms(pcm, 2) < threshold
