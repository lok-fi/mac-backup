// Thin client for the Catalyst `api` function (same-origin proxy at /server/api).
const BASE = '/server/api';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  ingest: (body) => req('/ingest', { method: 'POST', body: JSON.stringify(body) }),
  mcpConnect: (body) => req('/mcp/connect', { method: 'POST', body: JSON.stringify(body) }),
  mcpIngest: (body) => req('/mcp/ingest', { method: 'POST', body: JSON.stringify(body) }),
  getDashboard: (id) => req(`/dashboard?id=${encodeURIComponent(id)}`),
  saveDashboard: (id, spec) => req('/dashboard', { method: 'POST', body: JSON.stringify({ id, spec }) }),
  getRows: (id) => req(`/dataset-rows?id=${encodeURIComponent(id)}`),
  getDataset: (id) => req(`/dataset?id=${encodeURIComponent(id)}`),
  listDashboards: () => req('/list-dashboards'),
  deleteDashboard: (id) => req('/delete-dashboard', { method: 'POST', body: JSON.stringify({ id }) }),
  ask: (body) => req('/ask', { method: 'POST', body: JSON.stringify(body) }),
  requestDemo: (body) => req('/request-demo', { method: 'POST', body: JSON.stringify(body) }),
};
