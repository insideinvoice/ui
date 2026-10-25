import { useEffect, useState } from "react";
import { FileCheck2, Loader2, PlugZap, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { eInvoiceAPI } from "../../api/einvoice";

/**
 * Settings → GST & Compliance → E-Invoicing (IRN).
 *
 * The feature is strictly OPT-IN: with the toggle off, nothing in the invoice
 * workflow changes. Enabling requires stored provider credentials; the
 * connection test reports the provider's honest verdict (the mock provider is
 * sandbox-only and clearly labelled, the IRIS IRP transport reports
 * "not activated" until the IRP integration phase is switched on — nothing is
 * ever fabricated). Disabling flips the local flag only: it never cancels
 * government registrations and keeps all history.
 */
// Sandbox Mock credentials pre-filled for EVERY business: the Mock provider
// never contacts an IRP, so these placeholders make enable + test work out of
// the box. Selecting IRIS IRP is the real path — it demands real credentials.
const MOCK_CREDENTIALS = { clientId: "mock-sandbox", clientSecret: "mock-sandbox" };

const STATUS_META = {
  CONNECTED: { label: "Connected", cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  AUTH_FAILED: { label: "Authentication failed", cls: "text-red-600 bg-red-50 border-red-200" },
  PROVIDER_UNAVAILABLE: { label: "Provider not available", cls: "text-amber-600 bg-amber-50 border-amber-200" },
  NOT_TESTED: { label: "Not tested", cls: "text-slate-500 bg-slate-50 border-slate-200" },
};

const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5";
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400";

export default function EInvoiceSettingsCard({ business }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Draft form — provider/environment/credentials mirror the saved config
  // until the user saves. Credential fields stay blank after loading: the
  // backend never echoes them back, and blank means "keep stored values".
  const [draft, setDraft] = useState({
    provider: "MOCK",
    environment: "SANDBOX",
    enabled: false,
    autoRegister: false,
    clientId: MOCK_CREDENTIALS.clientId,
    clientSecret: MOCK_CREDENTIALS.clientSecret,
    apiUsername: "",
    apiPassword: "",
    appKey: "",
    baseUrl: "",
  });

  useEffect(() => {
    let alive = true;
    eInvoiceAPI.getConfig()
      .then((res) => {
        if (!alive) return;
        const c = res.data.data;
        setConfig(c);
        if (c) {
          setDraft((d) => ({
            ...d,
            provider: c.provider || d.provider,
            environment: c.environment || d.environment,
            enabled: !!c.enabled,
            autoRegister: !!c.autoRegister,
          }));
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const gstin = config?.gstin || business?.gstIn || "";
  const enabled = draft.enabled;
  const hasCredentials = !!config?.hasCredentials;
  const hasPortalCredentials = !!config?.hasPortalCredentials;
  const hasAppKey = !!config?.hasAppKey;
  const providerLabel = draft.provider === "MOCK" ? "Mock (sandbox testing)" : draft.provider === "IRIS_IRP" ? "IRIS IRP" : draft.provider;
  const status = STATUS_META[config?.connectionStatus] || STATUS_META.NOT_TESTED;

  const save = async (overrides = {}) => {
    const next = { ...draft, ...overrides };
    setSaving(true);
    try {
      const res = await eInvoiceAPI.saveConfig({
        gstin: "", // defaults to the business GSTIN on the backend
        provider: next.provider,
        environment: next.environment,
        enabled: next.enabled,
        autoRegister: next.autoRegister,
        clientId: next.clientId || undefined,
        clientSecret: next.clientSecret || undefined,
        apiUsername: next.apiUsername || undefined,
        apiPassword: next.apiPassword || undefined,
        appKey: next.appKey || undefined,
        baseUrl: next.baseUrl || undefined,
      });
      setConfig(res.data.data);
      setDraft((d) => ({
        ...d,
        enabled: !!res.data.data.enabled,
        clientId: "",
        clientSecret: "",
        apiUsername: "",
        apiPassword: "",
        appKey: "",
        baseUrl: "",
      }));
      setTestResult(null);
      toast.success(
        res.data.data.enabled
          ? "E-invoicing enabled — eligible invoices can be registered once the provider connection is live"
          : "E-invoicing settings saved"
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save e-invoicing settings");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      // Always persist what is on screen BEFORE testing — otherwise the test
      // reports a stale saved configuration (e.g. the user switched the
      // provider but did not press Save first) and the verdict makes no sense.
      const saved = await eInvoiceAPI.saveConfig({
        gstin: "",
        provider: draft.provider,
        environment: draft.environment,
        enabled: draft.enabled,
        autoRegister: draft.autoRegister,
        clientId: draft.clientId || undefined,
        clientSecret: draft.clientSecret || undefined,
        apiUsername: draft.apiUsername || undefined,
        apiPassword: draft.apiPassword || undefined,
        appKey: draft.appKey || undefined,
        baseUrl: draft.baseUrl || undefined,
      });
      setConfig(saved.data.data);
      setDraft((d) => ({
        ...d,
        clientId: "",
        clientSecret: "",
        apiUsername: "",
        apiPassword: "",
        appKey: "",
        baseUrl: "",
      }));
      const res = await eInvoiceAPI.testConnection();
      setTestResult(res.data.data);
      setConfig((c) => (c ? { ...c, connectionStatus: res.data.data.connectionStatus } : c));
      if (res.data.data.connectionStatus === "CONNECTED") toast.success("Connection test passed");
      else toast.error(res.data.data.message || "Connection test failed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900">GST E-Invoicing (IRN)</h2>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable GST E-Invoicing"
          disabled={loading || saving}
          onClick={() => {
            if (enabled) {
              // Disable is a local flag only — nothing is cancelled or deleted.
              if (!window.confirm("Disable e-invoicing? Existing invoices and any government registration records are kept untouched.")) return;
              save({ enabled: false });
            } else {
              // Enabling is always free — the feature is opt-in and nothing
              // is sent to an IRP by the toggle itself. Missing credentials
              // surface as an honest warning below and registration refuses
              // with a clear message until they are added.
              save({ enabled: true });
            }
          }}
          className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${
            enabled ? "bg-indigo-600" : "bg-slate-300"
          } ${loading || saving ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
              enabled ? "translate-x-6" : ""
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed mb-5">
        Register eligible invoices with an authorised Invoice Registration Portal to obtain an IRN,
        acknowledgement details and a digitally signed QR code. Optional — leaving this off keeps the
        existing invoice workflow exactly as it is.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading e-invoicing settings…
        </div>
      ) : (
        <div className="space-y-4">
          {/* Read-only summary line */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">GSTIN</span>
            <span className={`font-mono ${gstin ? "text-slate-700" : "text-amber-600"}`}>
              {gstin || "add the business GSTIN above and save — the IRP requires it"}
            </span>
            {config && (
              <span className={`ml-auto px-2 py-0.5 rounded-full border text-[11px] font-medium ${status.cls}`}>
                {status.label}
              </span>
            )}
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Authorised provider</label>
              <select
                value={draft.provider}
                onChange={(e) => {
                  const provider = e.target.value;
                  setDraft((d) => ({
                    ...d,
                    provider,
                    // Back to the no-IRP Mock default; real providers start
                    // blank so real secrets must be typed.
                    clientId: provider === "MOCK" && !hasCredentials ? MOCK_CREDENTIALS.clientId : "",
                    clientSecret: provider === "MOCK" && !hasCredentials ? MOCK_CREDENTIALS.clientSecret : "",
                  }));
                  setTestResult(null);
                }}
                className={inputCls}
              >
                <option value="IRIS_IRP">IRIS IRP</option>
                <option value="MOCK">Mock (sandbox testing only)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Environment</label>
              <select
                value={draft.environment}
                onChange={(e) => setDraft((d) => ({ ...d, environment: e.target.value }))}
                className={inputCls}
              >
                <option value="SANDBOX">Sandbox</option>
                <option value="PRODUCTION" disabled={draft.provider === "MOCK"}>
                  Production {draft.provider === "MOCK" ? "(not available for Mock)" : ""}
                </option>
              </select>
            </div>
            <div>
              <label className={labelCls}>
                API client ID {hasCredentials && <span className="text-slate-400 font-normal">(stored — leave blank to keep)</span>}
              </label>
              <input
                type="text"
                value={draft.clientId}
                onChange={(e) => setDraft((d) => ({ ...d, clientId: e.target.value }))}
                placeholder={hasCredentials ? "••••••••" : "Provider client identifier"}
                className={`${inputCls} font-mono`}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls}>
                API client secret {hasCredentials && <span className="text-slate-400 font-normal">(stored — leave blank to keep)</span>}
              </label>
              <input
                type="password"
                value={draft.clientSecret}
                onChange={(e) => setDraft((d) => ({ ...d, clientSecret: e.target.value }))}
                placeholder={hasCredentials ? "••••••••" : "Provider secret"}
                className={`${inputCls} font-mono`}
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Everything the government API auth flow needs, configured here —
              the Mock provider needs none of it. */}
          {draft.provider !== "MOCK" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-semibold text-slate-600 uppercase tracking-wide">Government API credentials</span>
              <span className={`px-1.5 py-0.5 rounded-full border ${hasCredentials ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-white border-slate-200"}`}>
                Client ID/Secret {hasCredentials ? "✓" : "—"}
              </span>
              <span className={`px-1.5 py-0.5 rounded-full border ${hasPortalCredentials ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-white border-slate-200"}`}>
                Portal user/pass {hasPortalCredentials ? "✓" : "—"}
              </span>
              <span className={`px-1.5 py-0.5 rounded-full border ${hasAppKey ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-white border-slate-200"}`}>
                App key {hasAppKey ? "✓" : "—"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  API username {hasPortalCredentials && <span className="text-slate-400 font-normal">(stored — leave blank to keep)</span>}
                </label>
                <input
                  type="text"
                  value={draft.apiUsername}
                  onChange={(e) => setDraft((d) => ({ ...d, apiUsername: e.target.value }))}
                  placeholder="e-invoice portal API username"
                  className={`${inputCls} font-mono`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={labelCls}>
                  API password {hasPortalCredentials && <span className="text-slate-400 font-normal">(stored — leave blank to keep)</span>}
                </label>
                <input
                  type="password"
                  value={draft.apiPassword}
                  onChange={(e) => setDraft((d) => ({ ...d, apiPassword: e.target.value }))}
                  placeholder="e-invoice portal API password"
                  className={`${inputCls} font-mono`}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className={labelCls}>
                  App key (32-char) {hasAppKey && <span className="text-slate-400 font-normal">(stored — leave blank to keep)</span>}
                </label>
                <input
                  type="password"
                  value={draft.appKey}
                  onChange={(e) => setDraft((d) => ({ ...d, appKey: e.target.value }))}
                  placeholder="Issued at IRP registration — encrypts the session key"
                  className={`${inputCls} font-mono`}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={labelCls}>Endpoint URL <span className="text-slate-400 font-normal">(optional — documented default used when blank)</span></label>
                <input
                  type="text"
                  value={draft.baseUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                  placeholder="https://… (provider sandbox/production URL)"
                  className={`${inputCls} font-mono`}
                  autoComplete="off"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Issued during your IRP/GSP onboarding (NIC sandbox or IRIS). Stored encrypted at rest,
              never shown again, never logged — this is the complete set the authentication and
              IRN calls need.
            </p>
          </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700 select-none w-fit cursor-pointer">
            <input
              type="checkbox"
              checked={draft.autoRegister}
              onChange={(e) => setDraft((d) => ({ ...d, autoRegister: e.target.checked }))}
              className="accent-indigo-600"
              disabled={!enabled}
            />
            Register eligible invoices automatically on generation
          </label>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[40px]"
            >
              {saving ? "Saving…" : "Save configuration"}
            </button>
            <button
              type="button"
              onClick={runTest}
              disabled={testing || saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[40px]"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
              Test connection
            </button>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Credentials are encrypted at rest and never shown again
            </span>
          </div>

          {enabled && draft.provider !== "MOCK" && !hasCredentials && !draft.clientId && !draft.clientSecret && (
            <div className="text-xs rounded-lg border px-3 py-2 leading-relaxed bg-amber-50 border-amber-200 text-amber-700">
              <span className="font-semibold">No credentials stored yet.</span> Enabling is fine — but the connection
              test will fail and registering an invoice will refuse with a clear message until you add the provider
              credentials and save.
            </div>
          )}

          {testResult && (
            <div
              className={`text-xs rounded-lg border px-3 py-2 leading-relaxed ${
                testResult.connectionStatus === "CONNECTED"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              <span className="font-semibold">
                {testResult.connectionStatus === "CONNECTED" ? "Connection test passed" : "Connection test failed"}
                {testResult.mock ? " (mock provider — no IRNs are generated)" : ""}:
              </span>{" "}
              {testResult.message}
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Provider: {providerLabel} · {draft.environment === "SANDBOX" ? "Sandbox" : "Production"} environment.
            IRN submission itself arrives with the IRP integration phase — until then nothing is sent to the
            government portal, and this toggle alone never marks an invoice as registered.
          </p>
        </div>
      )}
    </div>
  );
}
