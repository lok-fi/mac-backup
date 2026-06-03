"""
FastAPI server — Twilio webhooks, WebSocket pipeline, outbound trigger, results API.
"""
import asyncio
import logging

import httpx
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

import store
from config import settings
from knowledge_base import get_kb
from pipeline import CallPipeline

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logging.getLogger("httpx").setLevel(logging.INFO)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.INFO)
logging.getLogger("fastapi").setLevel(logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="TeamLease AI Calling Agent")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.on_event("startup")
async def _preload_kb():
    """Pre-load SentenceTransformer at startup so the first call has no delay."""
    await asyncio.to_thread(get_kb)
    log.info("Knowledge base ready.")

TWILIO_API = "https://api.twilio.com/2010-04-01"

# call_sid → CallPipeline (kept alive so extract_and_save can be called on disconnect)
_active_pipelines: dict[str, CallPipeline] = {}


# ─────────────────────────────────────────────────────────────
# Frontend
# ─────────────────────────────────────────────────────────────

@app.get("/")
async def index():
    return FileResponse("static/index.html")


# ─────────────────────────────────────────────────────────────
# TwiML helper — tells Twilio to open a WebSocket media stream
# ─────────────────────────────────────────────────────────────

def _stream_twiml(call_sid: str) -> str:
    ws_url = f"wss://{settings.server_host}/ws/call/{call_sid}"
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response><Connect>"
        f'<Stream url="{ws_url}" />'
        "</Connect></Response>"
    )


# ─────────────────────────────────────────────────────────────
# Twilio webhooks
# ─────────────────────────────────────────────────────────────

@app.post("/webhook/inbound")
async def inbound_webhook(request: Request):
    """Twilio calls this when someone dials your number."""
    form = await request.form()
    call_sid = form.get("CallSid", "unknown")
    caller  = form.get("From", "")
    log.info("Inbound call %s from %s", call_sid, caller)
    store.register_lead(call_sid, {"name": "Caller", "phone": caller, "email": ""})
    return Response(content=_stream_twiml(call_sid), media_type="application/xml")


@app.post("/webhook/outbound")
async def outbound_webhook(request: Request):
    """Answer URL for outbound calls — Twilio calls this when the callee picks up."""
    form = await request.form()
    call_sid = form.get("CallSid", "unknown")
    log.info("Outbound call connected: %s", call_sid)
    return Response(content=_stream_twiml(call_sid), media_type="application/xml")


@app.post("/webhook/status")
async def status_webhook(request: Request):
    """Twilio status callback — fires on every call status change."""
    form = await request.form()
    log.info(
        "Call status — SID:%s  Status:%s  Duration:%ss",
        form.get("CallSid"),
        form.get("CallStatus"),
        form.get("CallDuration", "—"),
    )
    return {"ok": True}


# ─────────────────────────────────────────────────────────────
# WebSocket — Twilio media stream (bidirectional audio)
# ─────────────────────────────────────────────────────────────

@app.websocket("/ws/call/{call_sid}")
async def call_ws(websocket: WebSocket, call_sid: str):
    await websocket.accept()
    log.info("WS opened: %s", call_sid)

    lead = store.get_lead_for_call(call_sid)
    pipeline = CallPipeline(call_sid=call_sid, lead=lead)
    _active_pipelines[call_sid] = pipeline

    try:
        await pipeline.run(websocket)
    except WebSocketDisconnect:
        log.info("WS disconnected: %s", call_sid)
    except Exception as exc:
        log.error("Pipeline error %s: %s", call_sid, exc, exc_info=True)
    finally:
        _active_pipelines.pop(call_sid, None)
        asyncio.create_task(pipeline.extract_and_save())


# ─────────────────────────────────────────────────────────────
# Outbound call trigger (called by the web form)
# ─────────────────────────────────────────────────────────────

@app.post("/api/call/outbound")
async def make_outbound_call(request: Request):
    """
    POST /api/call/outbound
    Body: { "to": "+919XXXXXXXXX", "name": "Rahul Sharma", "email": "rahul@acme.com" }
    """
    body = await request.json()
    to_number = body.get("to", "")
    lead = {
        "name": body.get("name", ""),
        "phone": to_number,
        "email": body.get("email", ""),
    }

    answer_url = f"https://{settings.server_host}/webhook/outbound"
    status_url = f"https://{settings.server_host}/webhook/status"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{TWILIO_API}/Accounts/{settings.twilio_account_sid}/Calls.json",
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            data={
                "From": settings.twilio_phone_number,
                "To": to_number,
                "Url": answer_url,                       # TwiML when call connects
                "StatusCallback": status_url,
                "StatusCallbackMethod": "POST",
                "TimeLimit": 600,
            },
        )

    data = resp.json()
    call_sid = data.get("sid", "")

    if resp.status_code != 201:
        log.error("Twilio error %s: %s", resp.status_code, data)
        return {"call_uuid": "", "status": "failed", "twilio_error": data}

    store.register_lead(call_sid, lead)
    log.info("Outbound call initiated — SID:%s to:%s", call_sid, to_number)
    return {"call_uuid": call_sid, "status": "initiated", "twilio": data}


# ─────────────────────────────────────────────────────────────
# Status & results API (polled by the web form)
# ─────────────────────────────────────────────────────────────

@app.get("/api/call/status/{call_sid}")
async def call_status(call_sid: str):
    call = store.get_call(call_sid)
    if not call:
        return {"status": "not_found"}
    return {
        "status":    call.get("status"),
        "call_type": call.get("call_type"),
        "output":    call.get("output"),
        "summary":   call.get("summary"),
    }


@app.get("/api/calls")
async def list_calls():
    return store.get_all_logs()


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
