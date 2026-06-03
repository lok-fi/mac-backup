# ODD Agent Service (Google ADK)

The AI brain for **ODD (On Demand Dashboards)** by FI Digitals. Real
[Google ADK](https://adk.dev/) agents on Gemini, wrapped in FastAPI. Runs as a
separate service (Python 3.11) because Zoho Catalyst functions are capped at
Python 3.9 while ADK requires ≥3.10. The Catalyst `api` function calls this over HTTP.

## Agents
- **`analyst_agent`** — receives a dataset profile + sample rows and returns a full
  dashboard spec (structured output via a Pydantic schema). It decides the pages,
  panels and chart types — nothing is fixed.
- **`assistant_agent`** — embedded dashboard assistant: answers questions and edits the
  dashboard by emitting JSON `actions`.
- **`mcp_ingest_agent`** — wired to a live MCP source via ADK's `MCPToolset`; pulls
  tabular data from a connected Zoho MCP server.

## Endpoints
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ok, model}` |
| POST | `/analyze` | `{profile, sampleRows, rawText?}` | `{spec}` |
| POST | `/ask` | `{profile, summary, spec, question, history?}` | `{reply, actions}` |
| POST | `/mcp/connect` | `{mcpUrl, token}` | `{tools}` |
| POST | `/mcp/ingest` | `{mcpUrl, token, request?}` | `{tables}` |

All non-health routes require header `X-ODD-Secret` == `ODD_SECRET` (skip if `ODD_SECRET` empty).

## Run locally
```bash
cd agent-service
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # fill in GOOGLE_API_KEY
export $(grep -v '^#' .env | xargs)
uvicorn main:app --host 0.0.0.0 --port 8080
curl localhost:8080/health
```

## Deploy to Cloud Run
```bash
gcloud run deploy odd-agent-service \
  --source . \
  --region <your-region> \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_API_KEY=<gemini-key>,ODD_SECRET=<shared-secret>,GEMINI_MODEL=gemini-flash-latest
```
Then set the returned URL as `AGENT_SERVICE_URL` and the same secret as `AGENT_SECRET`
in the Catalyst `api` function environment.

## Notes
- The MCP client targets the standard MCP **Streamable HTTP** transport (SSE fallback),
  authenticating with `Authorization: Bearer <token>`. Once tested against the real Zoho
  MCP endpoint, the connection-params / tool-selection logic in `odd_agents/mcp_client.py`
  may need a small adjustment to match that server's tool names.
