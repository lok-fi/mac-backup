# ODD — Setup & Deploy Guide (FI Digitals)

Three pieces:

1. **`odd-app/`** — the Zoho Catalyst app (React frontend + Node `api` function). Deploy to your **new** Catalyst project.
2. **`agent-service/`** — the Google ADK agent service (Python). Deploy to **Cloud Run**.
3. **landing page** (repo root) — the marketing site (already built).

The browser talks only to the Catalyst `api` function; that function calls the ADK service.

---

## 1. Create the Data Store tables (in the new Catalyst project)
Catalyst auto-adds `ROWID, CREATORID, CREATEDTIME, MODIFIEDTIME` to every table — only add the columns below.

**Catalyst `Text` columns max out at 10,000 chars.** Set the big columns (`source_meta`,
`schema_json`, `data`, `spec_json`) to type **Text** with **Max length 10000**. The app
automatically splits anything larger into <9,000-char chunks and reassembles on read, so
10,000 is all you need.

### Table: `datasets`
| Column | Type | Max length |
|---|---|---|
| `dataset_id` | Text | 255 |
| `name` | Text | 255 |
| `source_type` | Text | 50 |
| `source_meta` | Text | 10000 |
| `schema_json` | Text | 10000 |
| `row_count` | Int | — |

### Table: `dataset_rows`
| Column | Type | Max length |
|---|---|---|
| `dataset_id` | Text | 255 |
| `table_name` | Text | 255 |
| `batch_index` | Int | — |
| `data` | Text | 10000 |

### Table: `dashboards`
| Column | Type | Max length |
|---|---|---|
| `dashboard_id` | Text | 255 |
| `dataset_id` | Text | 255 |
| `title` | Text | 255 |
| `spec_json` | Text | 10000 |

> No `users` table — there is no login.
> Column names must match exactly (lowercase, as above).

---

## 2. Deploy the ADK agent service (Cloud Run)
```bash
cd agent-service
gcloud run deploy odd-agent-service \
  --source . \
  --region <your-region> \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_API_KEY=<your-gemini-key>,ODD_SECRET=<a-shared-secret>,GEMINI_MODEL=gemini-flash-latest
```
Note the service URL it prints (e.g. `https://odd-agent-service-xxxx.run.app`).

Run it locally instead (Python 3.11):
```bash
cd agent-service && python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
GOOGLE_API_KEY=<key> ODD_SECRET=dev uvicorn main:app --port 8080
```

## 3. Configure + deploy the Catalyst app
Set the `api` function env (in `odd-app/functions/api/catalyst-config.json` or the Catalyst console):
- `AGENT_SERVICE_URL` = the Cloud Run URL (or `http://localhost:8080` locally)
- `AGENT_SECRET` = the **same** value as `ODD_SECRET` above

Then:
```bash
cd odd-app
catalyst project:use <your-new-project>   # link to the new project
catalyst deploy
```
The app serves at `https://<project>.<zone>.catalystserverless.in/app/`.

## 4. Point the landing page at the app (optional)
Edit the repo-root landing page `src/config.js` → `ODD_APP_URL` to the deployed `/app/` URL.

---

## How it works (flow)
- **Upload**: file → `api /ingest` parses (Excel/CSV/JSON via SheetJS; PDF text via pdf-parse → agent `/extract`) → profiles columns → stores `datasets` + `dataset_rows` → calls agent `/analyze` → stores the AI-built spec in `dashboards` → opens `/app/d/<id>`.
- **MCP**: URL + token → `api /mcp/connect` (agent lists the source's tools) → `api /mcp/ingest` (ADK `MCPToolset` pulls rows) → same dashboard-build flow.
- **Dashboard**: loads the spec + rows, renders AI-decided pages/panels with Recharts (aggregation client-side). The assistant (`/ask`) returns `actions` that add/update/remove panels or pages; changes persist via `POST /dashboard`.

## What you still need to provide
- **Gemini API key** → `GOOGLE_API_KEY` on the agent service.
- **Test Zoho MCP URL + token** to validate `/mcp/connect` against the live endpoint — the MCP client follows the standard MCP Streamable-HTTP spec; `agent-service/odd_agents/mcp_client.py` may need a small tweak once tested against the real Zoho server's tool names.
