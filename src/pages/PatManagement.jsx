import { useState, useEffect, useCallback } from "react";
import { patAPI } from "../api/auth";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import LoadingDots from "../components/LoadingDots";
import toast from "react-hot-toast";
import { KeyRound, Plus, Trash2, Copy, Check, BookOpen, ChevronDown, ChevronUp, Code2, X } from "lucide-react";

const inputClass = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white transition-all min-h-[44px]";

// Lifecycle pill for the detail modal: revoked beats expiry, an expired-but-
// unrevoked token is its own state, everything else is Active.
const tokenStatus = (p) => {
  if (p.revoked) return { label: "Revoked", cls: "bg-red-50 text-red-600 border-red-200" };
  if (p.expiresAt && new Date(p.expiresAt) < new Date()) {
    return { label: "Expired", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
};

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : "—");

export default function PatManagement() {
  const [pats, setPats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", scopes: "invoices:read,invoices:write", expiresAt: "" });
  const [createdToken, setCreatedToken] = useState(null); // raw token shown once
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  // The token opened for its detail view — usage (hits) + calling client.
  const [detail, setDetail] = useState(null);
  const [docsOpen, setDocsOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await patAPI.list();
      setPats(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Token name is required"); return; }
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        scopes: form.scopes.trim() || "invoices:read,invoices:write",
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };
      const res = await patAPI.create(payload);
      const data = res.data?.data || {};
      setCreatedToken(data.token);
      setForm({ name: "", scopes: "invoices:read,invoices:write", expiresAt: "" });
      setShowCreate(false);
      load();
      toast.success("Token created — copy it now, it won't be shown again");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await patAPI.revoke(revokeTarget.id);
      toast.success("Token revoked");
      setRevokeTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to revoke token");
    } finally {
      setRevoking(false);
    }
  };

  const copyToken = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1400px] mx-auto">
        <PageHeader title="Personal Access Tokens" icon={KeyRound}
          subtitle="Create tokens for third-party integrations to call the Inside Invoice APIs" showBack={false} />

        {/* Created-token reveal (shown once) */}
        {createdToken && (
          <div className="mb-5 bg-amber-50 border border-amber-300 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">Your new token — copy it now</p>
                <p className="text-xs text-amber-700 mt-0.5">For security it is shown only once. Store it in your secret manager.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 min-w-0 px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs font-mono text-slate-800 break-all">
                    {createdToken}
                  </code>
                  <button type="button" onClick={copyToken}
                    className="shrink-0 px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1.5">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <button type="button" onClick={() => setCreatedToken(null)}
                  className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline">Dismiss</button>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-slate-800">Your tokens</h2>
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Create token
          </button>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          {loading ? (
            <div className="py-12 flex justify-center"><LoadingDots className="text-slate-400" /></div>
          ) : pats.length === 0 ? (
            <div className="py-12 text-center">
              <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No tokens yet. Create one to start integrating.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Token</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Scopes</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Created</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Last used</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Expires</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Hits</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pats.map((p) => (
                    <tr key={p.id} onClick={() => setDetail(p)} title="View token details"
                      className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer">
                      <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.tokenPrefix}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{p.scopes}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDateTime(p.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{p.lastUsedAt ? fmtDateTime(p.lastUsedAt) : "Never"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {p.revoked ? <span className="text-red-600 font-semibold">Revoked</span>
                          : p.expiresAt ? fmtDateTime(p.expiresAt) : "Never"}
                      </td>
                      {/* API-call count for THIS token — see V52 hit_count. */}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center justify-center min-w-[30px] px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                            (p.hitCount || 0) > 0 ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-slate-100 text-slate-500"
                          }`}
                          title={`${p.hitCount || 0} API calls`}>
                          {p.hitCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!p.revoked && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setRevokeTarget(p); }}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Revoke">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Documentation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => setDocsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-600" />
              <h3 className="text-base font-semibold text-slate-800">API Documentation</h3>
              <span className="text-xs text-slate-400">How to integrate with PATs</span>
            </div>
            {docsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {docsOpen && <ApiDocs />}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Create a new token</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. ERP integration" className={inputClass} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Scopes</label>
                <input type="text" value={form.scopes} onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                  placeholder="invoices:read,invoices:write" className={inputClass} />
                <p className="text-[10px] text-slate-400 mt-1">Comma-separated. Currently: invoices:read, invoices:write</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Expires (optional)</label>
                <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className={inputClass} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowCreate(false)} disabled={creating}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={creating}
                  className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50">
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Token detail — usage (hits) and the calling client's details */}
      {detail && (() => {
        const status = tokenStatus(detail);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-slate-900 truncate">{detail.name}</h3>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{detail.tokenPrefix}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setDetail(null)} aria-label="Close"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Headline usage: total calls with the last-used time */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-5 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{detail.hitCount || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">Hits</div>
                </div>
                <div className="h-10 w-px bg-slate-200" />
                <div className="min-w-0 text-xs text-slate-600">
                  <div className="font-semibold text-slate-700">Last used</div>
                  <div className="mt-0.5">{detail.lastUsedAt ? fmtDateTime(detail.lastUsedAt) : "Never — no API calls yet"}</div>
                </div>
              </div>

              {/* Client details of the most recent call + token facts */}
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                  <span className="text-slate-500 shrink-0">Client IP</span>
                  <span className="font-mono text-xs text-slate-800 text-right [overflow-wrap:anywhere]">{detail.lastUsedIp || "—"}</span>
                </div>
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                  <span className="text-slate-500 shrink-0">Client (User-Agent)</span>
                  <span className="font-mono text-xs text-slate-800 text-right [overflow-wrap:anywhere]">{detail.lastUsedAgent || "—"}</span>
                </div>
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                  <span className="text-slate-500 shrink-0">Scopes</span>
                  <span className="text-xs text-slate-800 text-right [overflow-wrap:anywhere]">{detail.scopes}</span>
                </div>
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                  <span className="text-slate-500 shrink-0">Created</span>
                  <span className="text-xs text-slate-700 text-right">{fmtDateTime(detail.createdAt)}</span>
                </div>
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                  <span className="text-slate-500 shrink-0">Expires</span>
                  <span className="text-xs text-slate-700 text-right">
                    {detail.revoked ? "Revoked" : detail.expiresAt ? fmtDateTime(detail.expiresAt) : "Never"}
                  </span>
                </div>
              </div>

              <div className="flex justify-end mt-5">
                <button type="button" onClick={() => setDetail(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Props match ConfirmModal's signature: open / onCancel / confirmLabel /
          busy (the old isOpen/onClose/confirmText/loading never opened it). */}
      <ConfirmModal
        open={!!revokeTarget}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke token"
        message={`Revoke "${revokeTarget?.name}"? It will stop working immediately.`}
        confirmLabel="Revoke"
        confirmVariant="danger"
        busy={revoking}
      />
    </div>
  );
}

function ApiDocs() {
  const code = (s) => <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words">{s}</pre>;

  return (
    <div className="px-5 py-4 space-y-6 text-sm text-slate-700">
      <div>
        <h4 className="font-semibold text-slate-800 mb-1">Base URL</h4>
        <p className="text-xs text-slate-500 mb-1">Your API base URL is the origin this app is configured to talk to — every path below is relative to it (e.g. <code className="bg-slate-100 px-1.5 py-0.5 rounded">POST /api/invoices</code>). No host is listed here on purpose: deployment URLs change, so read the base URL from your app's own configuration.</p>
        <p className="text-xs text-slate-500">All requests are authenticated with the PAT in the <code className="bg-slate-100 px-1.5 py-0.5 rounded">Authorization: Bearer pat_…</code> header. The token acts as the owning user/business.</p>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><Code2 className="w-4 h-4" /> 1. Create an invoice (Tax Invoice)</h4>
        <p className="text-xs mb-1"><code className="bg-slate-100 px-1.5 py-0.5 rounded">POST /api/invoices?sendEmail=true&amp;frontendOrigin=https://yourapp.com</code></p>
        <p className="text-xs text-slate-500 mb-2">Creates the invoice. Pass <code className="bg-slate-100 px-1 rounded">sendEmail=true</code> to email the customer (with share link) in the same call. <code className="bg-slate-100 px-1 rounded">frontendOrigin</code> is used for the share link; defaults to the server's configured origin. Use either <code className="bg-slate-100 px-1 rounded">customerId</code> (existing) or a <code className="bg-slate-100 px-1 rounded">customer</code> object (new, created on the fly).</p>
        {code(`{
  "customer": {
    "name": "Acme Corp",
    "email": "billing@acme.com",
    "phone": "9876543210",
    "billingAddress": "123 Main St",
    "gstIn": "29ABCDE1234F1Z5"
  },
  "invoiceType": "TAX_INVOICE",
  "invoiceDate": "2026-10-26",
  "dueDate": "2026-11-26",
  "placeOfSupply": "Karnataka",
  "paymentTerms": "Net 30",
  "discountPercent": 5,
  "discountType": "FULL",
  "sealType": "STAMP",
  "notes": "Thank you for your business",
  "items": [
    {
      "itemName": "Office Chair",
      "hsn": "940130",
      "unit": "Unit",
      "qty": 2,
      "rate": 8500,
      "gstPercentage": 18,
      "discountPercent": 10
    }
  ]
}`)}
        <p className="text-xs text-slate-500">Response: the created invoice object (with <code className="bg-slate-100 px-1 rounded">id</code>, <code className="bg-slate-100 px-1 rounded">invoiceNumber</code>). <code className="bg-slate-100 px-1 rounded">invoiceType</code> can be <code className="bg-slate-100 px-1 rounded">TAX_INVOICE</code>, <code className="bg-slate-100 px-1 rounded">PROFORMA</code>, etc. Rendering/printing uses the business's default template; the API returns the invoice data so consumers can render with any template client-side.</p>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 mb-2">2. Get / list / update / delete</h4>
        <ul className="space-y-1 text-xs font-mono">
          <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">GET /api/invoices?page=0&amp;size=20</code> — paginated list</li>
          <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">GET /api/invoices/{"{id}"}</code> — fetch one</li>
          <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">PUT /api/invoices/{"{id}"}</code> — update (same body shape)</li>
          <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">DELETE /api/invoices/{"{id}"}</code> — delete</li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 mb-2">3. Email an invoice separately</h4>
        <p className="text-xs mb-1"><code className="bg-slate-100 px-1.5 py-0.5 rounded">POST /api/invoices/{"{id}"}/email</code> (multipart, optional <code className="bg-slate-100 px-1 rounded">pdf</code> file + <code className="bg-slate-100 px-1 rounded">frontendOrigin</code>)</p>
        <p className="text-xs text-slate-500">Sends the invoice + share link to the customer's email. Attaching a client-rendered PDF is optional; without it the email carries the share link only.</p>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 mb-2">4. Share link</h4>
        <ul className="space-y-1 text-xs font-mono">
          <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">POST /api/invoices/{"{id}"}/share</code> — create/retrieve public share link</li>
          <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">DELETE /api/invoices/{"{id}"}/share</code> — revoke</li>
          <li><code className="bg-slate-100 px-1.5 py-0.5 rounded">POST /api/invoices/{"{id}"}/share/regenerate</code> — new token</li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 mb-2">cURL example</h4>
        {code(`curl -X POST "http://localhost:8080/api/invoices?sendEmail=true" \\
  -H "Authorization: Bearer pat_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"customerId":12,"invoiceType":"TAX_INVOICE","invoiceDate":"2026-10-26","items":[{"itemName":"Chair","qty":1,"rate":1000,"gstPercentage":18}]}'`)}
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 mb-2">Notes</h4>
        <ul className="list-disc pl-5 text-xs space-y-1">
          <li>Tokens authenticate as the owning user/business — all invoice data is scoped to that business.</li>
          <li>Revoking a token takes effect immediately.</li>
          <li>Customers and products must exist first (use <code className="bg-slate-100 px-1 rounded">/api/customers</code> and <code className="bg-slate-100 px-1 rounded">/api/products</code>), OR pass a <code className="bg-slate-100 px-1 rounded">customer</code> object in the create body to create one on the fly (matched by phone/email if it already exists).</li>
          <li>Discounts: set <code className="bg-slate-100 px-1 rounded">discountPercent</code> + <code className="bg-slate-100 px-1 rounded">discountType</code> ("FULL" or "INDIVIDUAL") at invoice level, and per-line <code className="bg-slate-100 px-1 rounded">discountPercent</code> on items when using INDIVIDUAL mode.</li>
          <li>Seal: pass <code className="bg-slate-100 px-1 rounded">sealType</code> ("ROUND", "STAMP" or "NONE") on create/update to pin the company seal, the rubber stamp, or no mark on that individual invoice. Omit it to follow the business's Settings default.</li>
          <li>Emails: <code className="bg-slate-100 px-1 rounded">sendEmail=true</code> always carries the invoice PDF as an attachment (server-rendered for API calls) plus the public share link.</li>
          <li>The company seal (if enabled in Settings) is applied to generated PDFs and shared links automatically, just like in the app.</li>
          <li>PATs may have an expiry (set at creation); leave it empty for a non-expiring token. Expired tokens return 401.</li>
          <li>On 401, check the token is not expired/revoked and the <code className="bg-slate-100 px-1 rounded">Authorization: Bearer pat_…</code> header is present.</li>
        </ul>
      </div>
    </div>
  );
}
