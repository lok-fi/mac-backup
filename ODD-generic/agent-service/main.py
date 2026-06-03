"""FastAPI wrapper around the ODD ADK agents — deployed to Cloud Run, called
by the Catalyst `api` function. Endpoints:

  GET  /health
  POST /analyze       {profile, sampleRows, rawText?}      -> {spec}
  POST /ask           {profile, summary, spec, question, history?} -> {reply, actions}
  POST /mcp/connect   {mcpUrl, token}                       -> {tools}
  POST /mcp/ingest    {mcpUrl, token, request?}             -> {tables}

All non-health routes require the shared secret in the `X-ODD-Secret` header
(matched against the ODD_SECRET env var). Set ODD_SECRET empty to disable.
"""

import json
import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ADK reads GOOGLE_API_KEY; accept GEMINI_API_KEY as a friendly alias.
if not os.environ.get("GOOGLE_API_KEY") and os.environ.get("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "FALSE")

import asyncio

import httpx

from odd_agents.agents import (
    analyst_agent,
    analysis_agent,
    design_agent,
    assistant_agent,
    extract_agent,
    build_mcp_agent,
)
from odd_agents.runner import run_agent_text
from odd_agents import mcp_client

ODD_SECRET = os.environ.get("ODD_SECRET", "")

app = FastAPI(title="ODD Agent Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _check_secret(provided: str) -> None:
    if ODD_SECRET and provided != ODD_SECRET:
        raise HTTPException(status_code=401, detail="Bad or missing X-ODD-Secret")


def _loads_loose(text: str):
    """Parse JSON that may be wrapped in markdown fences or have stray prose."""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned[:4].lower() == "json":
            cleaned = cleaned[4:]
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    # Fall back to the first {...} block.
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except Exception:
            return None
    return None


# ── Request models ──────────────────────────────────────────────────────────
class AnalyzeReq(BaseModel):
    profile: dict
    sampleRows: list = []
    rawText: str = ""


class ArchitectReq(BaseModel):
    profile: dict
    sampleRows: list = []
    description: str = ""


class ArchitectAsyncReq(ArchitectReq):
    callbackUrl: str
    datasetId: str


class AskReq(BaseModel):
    profile: dict = {}
    plan: dict = {}
    summary: str = ""
    spec: dict = {}
    question: str
    history: list = []


class McpReq(BaseModel):
    mcpUrl: str
    token: str = ""
    request: str = ""


class ExtractReq(BaseModel):
    rawText: str
    name: str = "data"


# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"ok": True, "model": os.environ.get("GEMINI_MODEL", "gemini-flash-latest")}


@app.post("/analyze")
async def analyze(body: AnalyzeReq, x_odd_secret: str = Header("")):
    _check_secret(x_odd_secret)
    prompt = (
        "DATASET PROFILE (columns, types, statistics):\n"
        + json.dumps(body.profile, default=str)[:24000]
        + "\n\nSAMPLE ROWS:\n"
        + json.dumps(body.sampleRows, default=str)[:16000]
    )
    if body.rawText:
        prompt += (
            "\n\nThis data came from an unstructured document. Raw extracted text "
            "(use it to understand and structure the data):\n" + body.rawText[:16000]
        )
    prompt += "\n\nDesign the dashboard now. Output ONLY the spec object."

    text = await run_agent_text(analyst_agent, prompt)
    spec = _loads_loose(text)
    if not spec or "pages" not in spec:
        raise HTTPException(status_code=502, detail="Agent did not return a valid spec")
    return {"spec": spec}


def _profile_subset(profile, table_names):
    """Return the profile restricted to the given table names (for the design stage)."""
    if not table_names:
        return profile
    wanted = set(table_names)
    tables = [t for t in (profile.get("tables") or []) if t.get("name") in wanted]
    return {"tables": tables or (profile.get("tables") or [])}


async def run_architect(profile, sample_rows, description):
    """Two-stage build: analyse → design each dashboard. Returns {plan, dashboards}."""
    # Stage 1 — analysis → Data Plan.
    plan_prompt = (
        "COLUMN PROFILES (one or more uploaded files/tables):\n"
        + json.dumps(profile, default=str)[:24000]
        + "\n\nSAMPLE ROWS:\n" + json.dumps(sample_rows, default=str)[:14000]
        + "\n\nUSER DESCRIPTION (what this data is / what they want — may be empty):\n"
        + (description or "(none provided)")
        + "\n\nProduce the Data Plan now. Output ONLY the plan object."
    )
    plan = _loads_loose(await run_agent_text(analysis_agent, plan_prompt)) or {}
    dash_plans = plan.get("dashboards") or [
        {"id": "main", "title": "Dashboard", "tables": [t.get("name") for t in (profile.get("tables") or [])]}
    ]
    dash_plans = dash_plans[:5]  # bound cost

    # Stage 2 — design each planned dashboard (in parallel).
    async def design_one(dp):
        prompt = (
            "DASHBOARD PLAN:\n" + json.dumps(dp, default=str)[:8000]
            + "\n\nRELEVANT COLUMN PROFILES:\n"
            + json.dumps(_profile_subset(profile, dp.get("tables")), default=str)[:16000]
            + "\n\nOVERALL DATA CONTEXT:\n" + (plan.get("overview") or "")[:2000]
            + "\n\nDesign this dashboard now. Output ONLY the spec object."
        )
        spec = _loads_loose(await run_agent_text(design_agent, prompt))
        if not spec or "pages" not in spec:
            return None
        if not spec.get("title"):
            spec["title"] = dp.get("title") or "Dashboard"
        return {"title": spec["title"], "spec": spec, "tables": dp.get("tables") or []}

    results = await asyncio.gather(*[design_one(dp) for dp in dash_plans])
    dashboards = [r for r in results if r]
    if not dashboards:
        raise RuntimeError("Could not design a dashboard from this data")
    return {"plan": plan, "dashboards": dashboards}


@app.post("/architect")
async def architect(body: ArchitectReq, x_odd_secret: str = Header("")):
    _check_secret(x_odd_secret)
    try:
        return await run_architect(body.profile, body.sampleRows, body.description)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


# Background-task registry so created tasks aren't garbage-collected mid-run.
_bg_tasks = set()


@app.post("/architect-async")
async def architect_async(body: ArchitectAsyncReq, x_odd_secret: str = Header("")):
    """Accept the build, return immediately, run it in the background, and POST the
    result to `callbackUrl` when done. Requires Cloud Run CPU-always-allocated."""
    _check_secret(x_odd_secret)

    async def _job():
        payload = {"datasetId": body.datasetId}
        try:
            payload.update(await run_architect(body.profile, body.sampleRows, body.description))
        except Exception as exc:  # noqa: BLE001
            payload["error"] = str(exc)
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                await client.post(body.callbackUrl, json=payload, headers={"X-ODD-Secret": ODD_SECRET})
        except Exception:  # noqa: BLE001
            pass

    task = asyncio.create_task(_job())
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)
    return {"status": "building"}


@app.post("/ask")
async def ask(body: AskReq, x_odd_secret: str = Header("")):
    _check_secret(x_odd_secret)
    history_text = ""
    for msg in (body.history or [])[-8:]:
        role = msg.get("role", "user")
        history_text += "\n%s: %s" % (role.upper(), msg.get("text", ""))

    prompt = (
        "CURRENT DASHBOARD SPEC:\n" + json.dumps(body.spec, default=str)[:16000]
        + ("\n\nDATA PLAN (analysed understanding of the data):\n" + json.dumps(body.plan, default=str)[:8000] if body.plan else "")
        + "\n\nDATA SUMMARY (your source of truth):\n" + (body.summary or "")[:16000]
        + ("\n\nDATASET PROFILE:\n" + json.dumps(body.profile, default=str)[:8000] if body.profile else "")
        + ("\n\nCONVERSATION SO FAR:" + history_text if history_text else "")
        + "\n\nUSER MESSAGE: " + body.question
        + "\n\nRespond with ONLY the JSON object {\"reply\":..., \"actions\":[...]}."
    )
    text = await run_agent_text(assistant_agent, prompt)
    parsed = _loads_loose(text) or {}
    return {
        "reply": parsed.get("reply") or (text if not parsed else "Done."),
        "actions": parsed.get("actions") or [],
    }


@app.post("/extract")
async def extract(body: ExtractReq, x_odd_secret: str = Header("")):
    _check_secret(x_odd_secret)
    prompt = (
        "Document name: " + body.name + "\n\nRaw extracted text:\n" + body.rawText[:40000]
        + "\n\nExtract the structured tables now. Output ONLY the JSON object."
    )
    text = await run_agent_text(extract_agent, prompt)
    parsed = _loads_loose(text) or {}
    tables = parsed.get("tables") or []
    if not tables:
        raise HTTPException(
            status_code=502,
            detail=parsed.get("error") or "Could not extract structured data from the document.",
        )
    return {"tables": tables}


@app.post("/mcp/connect")
async def mcp_connect(body: McpReq, x_odd_secret: str = Header("")):
    _check_secret(x_odd_secret)
    try:
        tools = await mcp_client.list_tools(body.mcpUrl, body.token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="MCP connect failed: %s" % exc)
    return {"tools": tools}


@app.post("/mcp/ingest")
async def mcp_ingest(body: McpReq, x_odd_secret: str = Header("")):
    _check_secret(x_odd_secret)
    try:
        toolset = mcp_client.build_toolset(body.mcpUrl, body.token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="MCP setup failed: %s" % exc)

    agent = build_mcp_agent(toolset)
    instruction = body.request or "Retrieve the most central business dataset and return its rows."
    try:
        text = await run_agent_text(agent, instruction)
    finally:
        await mcp_client._safe_close(toolset)

    parsed = _loads_loose(text) or {}
    tables = parsed.get("tables") or []
    if not tables:
        raise HTTPException(
            status_code=502,
            detail=parsed.get("error") or "No tabular data could be retrieved from the source.",
        )
    return {"tables": tables}
