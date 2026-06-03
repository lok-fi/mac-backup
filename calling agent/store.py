"""
In-memory call state + JSON file persistence.
"""
import json
from datetime import datetime
from typing import Optional
from pathlib import Path

LOGS_FILE = Path("call_logs.json")

# call_sid → call record (active / recently completed calls)
_calls: dict[str, dict] = {}

# When we initiate outbound call we know the UUID before the webhook fires
_pending_leads: dict[str, dict] = {}   # call_sid → lead info


# ─────────────────────────────────────────────────────────────
# Lead / call lifecycle
# ─────────────────────────────────────────────────────────────

def register_lead(call_sid: str, lead: dict):
    """Called when we trigger an outbound call — stores lead before webhook fires."""
    _pending_leads[call_sid] = lead
    _calls[call_sid] = {
        "call_sid": call_sid,
        "timestamp": datetime.now().isoformat(),
        "lead": lead,
        "transcript": [],
        "status": "calling",
        "output": None,
        "call_type": None,
        "summary": None,
    }


def get_lead_for_call(call_sid: str) -> dict:
    return _pending_leads.get(call_sid, {})


def mark_connected(call_sid: str):
    if call_sid in _calls:
        _calls[call_sid]["status"] = "connected"


def add_turn(call_sid: str, role: str, text: str):
    """role = 'assistant' | 'user'"""
    if call_sid in _calls and text.strip():
        _calls[call_sid]["transcript"].append({"role": role, "text": text.strip()})


def mark_extracting(call_sid: str):
    if call_sid in _calls:
        _calls[call_sid]["status"] = "extracting"


def save_result(call_sid: str, output: dict, call_type: str, summary: Optional[str]):
    if call_sid not in _calls:
        return
    call = _calls[call_sid]
    call["output"] = output
    call["call_type"] = call_type
    call["summary"] = summary
    call["status"] = "completed"

    logs = _load_logs()
    # Replace existing record if already saved (idempotent)
    logs = [l for l in logs if l["call_sid"] != call_sid]
    logs.insert(0, call)
    LOGS_FILE.write_text(json.dumps(logs, indent=2, ensure_ascii=False))

    _pending_leads.pop(call_sid, None)


def get_call(call_sid: str) -> Optional[dict]:
    # Check in-memory first (active/recent), then file
    if call_sid in _calls:
        return _calls[call_sid]
    for log in _load_logs():
        if log["call_sid"] == call_sid:
            return log
    return None


def get_all_logs() -> list[dict]:
    return _load_logs()


def _load_logs() -> list[dict]:
    if not LOGS_FILE.exists():
        return []
    try:
        return json.loads(LOGS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []
