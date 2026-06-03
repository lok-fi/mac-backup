// Central config — update the ODD app URL here once and it flows everywhere.
// Base of the deployed Catalyst ODD app (includes /app). Live View links go to ODD_APP_URL/d/demo_<industry>.
export const ODD_APP_URL = 'https://odd-teama-60040289923.development.catalystserverless.in/app'
// Catalyst `api` function base (same host, /server/api). The Book-a-Demo form POSTs
// /request-demo here, which emails the team via Catalyst Mail (verified sender).
export const ODD_API_URL = 'https://odd-teama-60040289923.development.catalystserverless.in/server/api'
export const COMPANY = 'FI Digitals'
export const PRODUCT = 'ODD'
export const PRODUCT_FULL = 'On Demand Dashboards'

// ADK agent service (Cloud Run) — called directly by the in-landing demo assistant.
// Cloud Run allows CORS from any origin; the Catalyst gateway does not, so the
// landing talks to the agent directly. Secret is low-value (gates the agent only).
export const AGENT_URL = 'https://odd-agent-service-904122474688.us-central1.run.app'
export const AGENT_SECRET = 'odd-prod-secret-7f3a'
