import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UploadCloud, Plug, FileSpreadsheet, ArrowRight, Loader2, Sparkles,
  LayoutDashboard, Link2, AlertCircle, CheckCircle2, X, FileText, Trash2, Lock,
} from 'lucide-react';
import Brand from './components/Brand';
import { api } from './api';

const ACCEPT = '.xlsx,.xls,.csv,.tsv,.json,.pdf';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DataUploader() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('upload');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const [files, setFiles] = useState([]);       // File[]
  const [description, setDescription] = useState('');

  const [deleting, setDeleting] = useState(null);

  // MCP state
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpToken, setMcpToken] = useState('');
  const [mcpTools, setMcpTools] = useState(null);
  const [mcpRequest, setMcpRequest] = useState('');

  useEffect(() => {
    api.listDashboards().then((d) => setRecent(d.dashboards || [])).catch(() => {});
  }, []);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setError('');
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...incoming.filter((f) => !seen.has(f.name + f.size))];
    });
  };

  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const deleteDashboard = async (e, d) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${d.title || 'this dashboard'}" and all its data? This can't be undone.`)) return;
    setDeleting(d.dashboardId);
    try {
      await api.deleteDashboard(d.dashboardId);
      setRecent((prev) => prev.filter((x) => x.dashboardId !== d.dashboardId));
    } catch (err) {
      setError(`Could not delete: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const build = useCallback(async () => {
    if (!files.length || busy) return;
    setError(''); setBusy(true);
    try {
      setStatus(`Reading ${files.length} file${files.length > 1 ? 's' : ''}…`);
      const payload = await Promise.all(
        files.map(async (f) => ({ fileName: f.name, mime: f.type, fileData: await fileToBase64(f) }))
      );
      setStatus('The data agent is analysing your data and designing the dashboard…');
      const res = await api.ingest({ files: payload, description });
      const count = res.dashboards?.length || 1;
      setStatus(count > 1 ? `Built ${count} dashboards! Opening…` : 'Dashboard ready! Opening…');
      navigate(`/d/${res.dashboardId}`);
    } catch (err) {
      setError(err.message); setStatus('');
    } finally {
      setBusy(false);
    }
  }, [files, description, busy, navigate]);

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    if (busy) return;
    addFiles(e.dataTransfer.files);
  };

  const connectMcp = async () => {
    setError(''); setBusy(true); setMcpTools(null);
    try {
      setStatus('Connecting to MCP source…');
      const res = await api.mcpConnect({ mcpUrl, token: mcpToken });
      setMcpTools(res.tools || []);
      setStatus(`Connected — ${res.tools?.length || 0} tools available.`);
    } catch (err) {
      setError(err.message); setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const ingestMcp = async () => {
    setError(''); setBusy(true);
    try {
      setStatus('Pulling data and designing your dashboard…');
      const res = await api.mcpIngest({ mcpUrl, token: mcpToken, request: mcpRequest, description: mcpRequest });
      setStatus('Dashboard ready! Opening…');
      navigate(`/d/${res.dashboardId}`);
    } catch (err) {
      setError(err.message); setStatus('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-5xl px-5 pb-24">
      {/* Header */}
      <header className="flex items-center justify-between py-5">
        <Brand />
        <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur sm:flex">
          <Sparkles size={13} className="text-brand-violet" /> AI-built dashboards
        </span>
      </header>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="mx-auto mt-8 max-w-2xl text-center"
      >
        <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
          Turn data into a <span className="text-gradient animate-gradient-x">dashboard</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-600">
          Add one or more files and tell the agent about them. It analyses everything, decides
          how to use it, and designs your dashboard.
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="mx-auto mt-10 flex max-w-md gap-1 rounded-2xl border border-slate-200 bg-white/70 p-1 backdrop-blur">
        {[
          { id: 'upload', label: 'Upload files', icon: UploadCloud },
          { id: 'mcp', label: 'Connect (MCP)', icon: Plug },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(''); setStatus(''); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-brand-blue text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="mx-auto mt-6 max-w-2xl">
        {tab === 'upload' ? (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !busy && inputRef.current?.click()}
              className={`cursor-pointer rounded-3xl border-2 border-dashed bg-white/70 p-10 text-center backdrop-blur transition-colors ${
                dragOver ? 'border-brand-blue bg-brand-blue/5' : 'border-slate-300 hover:border-brand-blue/60'
              }`}
            >
              <input
                ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" disabled={busy}
                onChange={(e) => addFiles(e.target.files)}
              />
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-cyan via-brand-blue to-brand-violet text-white shadow-lg">
                <UploadCloud size={26} />
              </div>
              <p className="mt-4 text-base font-bold text-slate-900">Drop files here, or click to choose</p>
              <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1"><FileSpreadsheet size={13} /> Excel</span>
                <span>· CSV</span><span>· JSON</span><span>· PDF</span><span>· multiple allowed</span>
              </p>
            </div>

            {/* Selected files */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={f.name + i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/70 px-3.5 py-2.5 backdrop-blur">
                    <span className="flex items-center gap-2 truncate text-sm font-medium text-slate-700">
                      <FileText size={15} className="shrink-0 text-brand-blue" /> {f.name}
                    </span>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500"><X size={15} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Description prompt */}
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Describe your data <span className="font-normal text-slate-400">(optional, but improves the result)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g. Monthly sales export + this year's targets. I want to see performance vs target by region and product, and the trend over time."
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>

            <button
              onClick={build}
              disabled={busy || !files.length}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-blue/30 transition-colors hover:bg-brand-blueDark disabled:opacity-50"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {busy ? 'Building…' : 'Build my dashboard'}
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white/70 p-7 backdrop-blur">
            <label className="block text-sm font-semibold text-slate-700">MCP server URL</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
              <Link2 size={16} className="text-slate-400" />
              <input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} placeholder="https://…mcp.zoho.com/…?apikey=…" type="password" className="w-full bg-transparent py-2.5 text-sm outline-none" />
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
              <Lock size={13} className="mt-0.5 shrink-0 text-slate-400" />
              Paste the single link Zoho gave you. <span className="font-medium text-slate-600">The secure key is already inside this URL</span> — treat it like a password, no separate token needed.
            </p>

            <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">Self-hosted server? Add a bearer token (optional)</summary>
              <input value={mcpToken} onChange={(e) => setMcpToken(e.target.value)} type="password" placeholder="Bearer token (leave blank for Zoho hosted MCP)" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none" />
            </details>

            {!mcpTools ? (
              <button onClick={connectMcp} disabled={busy || !mcpUrl} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-brand-blueDark disabled:opacity-50">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />} Connect
              </button>
            ) : (
              <div className="mt-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{mcpTools.length} tools available</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {mcpTools.slice(0, 12).map((t) => (
                      <span key={t.name} className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">{t.name}</span>
                    ))}
                  </div>
                </div>
                <textarea value={mcpRequest} onChange={(e) => setMcpRequest(e.target.value)} rows={2} placeholder="Describe what data you want / what the dashboard should focus on" className="mt-3 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none" />
                <button onClick={ingestMcp} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-brand-blueDark disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Build dashboard from this source
                </button>
              </div>
            )}
          </div>
        )}

        {status && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 text-sm font-medium text-brand-blueDark">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {status}
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Recent dashboards */}
      {recent.length > 0 && (
        <div className="mx-auto mt-14 max-w-3xl">
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Your dashboards</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {recent.map((d) => (
              <div
                key={d.dashboardId}
                onClick={() => navigate(`/d/${d.dashboardId}`)}
                className="group flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-brand-blue"><LayoutDashboard size={18} /></span>
                  <span className="truncate font-semibold text-slate-800">{d.title || 'Dashboard'}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={(e) => deleteDashboard(e, d)}
                    disabled={deleting === d.dashboardId}
                    title="Delete dashboard and its data"
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    {deleting === d.dashboardId ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                  <ArrowRight size={16} className="text-slate-400 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
