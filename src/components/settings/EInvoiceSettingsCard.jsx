import { useEffect, useState } from "react";
import { FileCheck2, Info, Loader2, Pencil, PlugZap, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmModal from "../ConfirmModal";
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

/**
 * The Mock explainer tooltip — attached to the provider LABEL while editing
 * and to the provider VALUE in the read-only view, so the hint is reachable
 * in both modes. Focusable, so a tap works on touch.
 */
const MockTip = () => (
  <span className="relative inline-flex group ml-1 align-middle" tabIndex={0} aria-describedby="mock-provider-tip">
    <Info className="w-3.5 h-3.5 text-slate-400 cursor-help transition-colors group-hover:text-slate-600 group-focus:text-slate-600" />
    <span
      id="mock-provider-tip"
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
      Mock is fully self-simulating — credentials and endpoints are built in. Nothing to type; flip the enable toggle and test.
    </span>
  </span>
);

/** Read-only field, styled like Profile's bizField (Company Bank Details). */
const viewField = (label, value) => (
  <div>
    <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">{label}</div>
    <div className="text-sm text-slate-800 [overflow-wrap:anywhere]">{value}</div>
  </div>
);

const NIC_SANDBOX_URL = "https://einv-apisandbox.nic.in";
const NIC_PRODUCTION_URL = "https://einvoice1.gst.gov.in";

/**
 * Axios errors without a response body (backend restarting, proxy refused,
 * timeout) used to collapse into a bare "Failed to save…" toast. Always say
 * WHICH of the two happened so the user never has to guess.
 */
const apiError = (err, fallback) => {
  const serverMessage = err?.response?.data?.message;
  if (serverMessage) return serverMessage;
  if (!err?.response) return `${fallback} — the backend did not respond. Is it running on port 8080?`;
  return `${fallback} (HTTP ${err.response.status}${err.response.statusText ? ` ${err.response.statusText}` : ""})`;
};

export default function EInvoiceSettingsCard({ business }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  // In-app confirmation for turning the feature OFF — replaces the browser's
  // window.confirm popup with the app's own modal (same copy, same verdict).
  const [confirmDisable, setConfirmDisable] = useState(false);
  // Company Bank Details pattern: inputs are read-only until the pencil in the
  // card header is clicked; Save/Cancel only exist inside edit mode.
  const [editing, setEditing] = useState(false);

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
            // A Mock config never needs typing: keep the placeholders visible
            // whenever no real credentials are stored.
            clientId: c.provider === "MOCK" && !c.hasCredentials ? MOCK_CREDENTIALS.clientId : d.clientId,
            clientSecret: c.provider === "MOCK" && !c.hasCredentials ? MOCK_CREDENTIALS.clientSecret : d.clientSecret,
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
  const providerLabel = draft.provider === "MOCK" ? "Mock (sandbox testing)" : draft.provider === "IRIS_IRP" ? "IRIS IRP" : draft.provider;
  const status = STATUS_META[config?.connectionStatus] || STATUS_META.NOT_TESTED;

  const save = async (overrides = {}) => {
    const next = { ...draft, ...overrides };
    setSaving(true);
    // Optimistic toggle: the switch moves the instant it is tapped so it
    // always feels responsive; a failed save reverts it with the error.
    if (overrides.enabled !== undefined) {
      setDraft((d) => ({ ...d, enabled: overrides.enabled }));
    }
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
        enabled: !!res.data.data.enabled, // trust the server's stored value
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
          ? "E-invoicing enabled — eligible invoices can be registered for an IRN now"
          : "E-invoicing settings saved"
      );
      return true;
    } catch (err) {
      if (overrides.enabled !== undefined) {
        setDraft((d) => ({ ...d, enabled: !overrides.enabled }));
      }
      toast.error(apiError(err, "Failed to save e-invoicing settings"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cancel editing: throw away everything typed and rebuild the draft from the
   * SAVED config — the card returns to exactly the state it loaded with (Mock
   * placeholder credentials when Mock is active with nothing stored, blank
   * credential fields otherwise).
   */
  const cancelEdit = () => {
    const provider = config?.provider || "MOCK";
    const environment = config?.environment || (provider === "MOCK" ? "SANDBOX" : "PRODUCTION");
    const mockPlaceholders = provider === "MOCK" && !config?.hasCredentials;
    setDraft((d) => ({
      ...d,
      provider,
      environment,
      enabled: !!config?.enabled,
      autoRegister: !!config?.autoRegister,
      clientId: mockPlaceholders ? MOCK_CREDENTIALS.clientId : "",
      clientSecret: mockPlaceholders ? MOCK_CREDENTIALS.clientSecret : "",
      apiUsername: "",
      apiPassword: "",
      appKey: "",
      baseUrl: "",
    }));
    setTestResult(null);
    setEditing(false);
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
      toast.error(apiError(err, "Connection test failed"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <FileCheck2 className="w-5 h-5 text-slate-600 shrink-0" />
          <h2 className="text-base font-semibold text-slate-900">GST E-Invoicing (IRN)</h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Pencil → edit, same affordance as Company Bank Details. Hidden
              while editing: Cancel inside the form is the way out. */}
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={loading || saving}
              title="Edit e-invoicing settings"
              aria-label="Edit e-invoicing settings"
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable GST E-Invoicing"
          disabled={loading || saving}
          onClick={() => {
            if (enabled) {
              // Disable is a local flag only — nothing is cancelled or
              // deleted. The confirmation is an in-app modal, not a popup.
              setConfirmDisable(true);
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

          {!editing ? (
            /* Read-only view — saved values only (Company Bank Details
               pattern); the pencil in the card header reveals the inputs. */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {viewField(
                "Authorised provider",
                <span className="inline-flex items-center flex-wrap">
                  {providerLabel}
                  {draft.provider === "MOCK" && <MockTip />}
                </span>
              )}
              {viewField("Environment", draft.environment === "SANDBOX" ? "Sandbox" : "Production")}
              {viewField(
                "Credentials",
                draft.provider === "MOCK" ? (
                  "Built into Mock — nothing to type"
                ) : hasCredentials ? (
                  "Stored — encrypted at rest, never shown again"
                ) : (
                  <span className="text-amber-600">None saved yet</span>
                )
              )}
              {viewField(
                "IRP endpoint",
                config?.baseUrl ||
                  draft.baseUrl ||
                  (draft.environment === "PRODUCTION" ? NIC_PRODUCTION_URL : NIC_SANDBOX_URL)
              )}
              {viewField(
                "Auto-registration",
                draft.autoRegister
                  ? "On — eligible invoices register on generation"
                  : "Off — register manually"
              )}
            </div>
          ) : (
          <>
          {/* Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Authorised provider
                {/* Mock explainer ⓘ — focusable, so tap works on touch. */}
                {draft.provider === "MOCK" && <MockTip />}
              </label>
              <select
                value={draft.provider}
                onChange={(e) => {
                  const provider = e.target.value;
                  setDraft((d) => ({
                    ...d,
                    provider,
                    // Mock IS the sandbox — it can never be anything else.
                    // The authorised provider connects straight to
                    // PRODUCTION: that is what "live" means, and Sandbox
                    // stays selectable for anyone who wants to rehearse.
                    environment: provider === "MOCK" ? "SANDBOX" : "PRODUCTION",
                    // Mock is fully self-simulating: every related config is
                    // filled automatically — the user ONLY flips enable.
                    clientId: provider === "MOCK" ? MOCK_CREDENTIALS.clientId : "",
                    clientSecret: provider === "MOCK" ? MOCK_CREDENTIALS.clientSecret : "",
                    apiUsername: "",
                    apiPassword: "",
                    appKey: "",
                    baseUrl: "",
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
            {/* The Mock explainer moved to a ⓘ tooltip on the "Authorised
                provider" label above — same copy, one line saved. */}
            {/* The authorised provider asks for exactly what the IRP needs:
                credentials + the endpoint. Nothing here is optional-by-mystery
                — blank endpoint means "use the documented NIC URL for this
                environment", blank secrets mean "keep what is stored". */}
            {draft.provider !== "MOCK" && (<>
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
            <div>
              <label className={labelCls}>
                API username {hasCredentials && <span className="text-slate-400 font-normal">(stored — leave blank to keep)</span>}
              </label>
              <input
                type="text"
                value={draft.apiUsername}
                onChange={(e) => setDraft((d) => ({ ...d, apiUsername: e.target.value }))}
                placeholder={hasCredentials ? "••••••••" : "IRP portal username"}
                className={`${inputCls} font-mono`}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls}>
                API password {hasCredentials && <span className="text-slate-400 font-normal">(stored — leave blank to keep)</span>}
              </label>
              <input
                type="password"
                value={draft.apiPassword}
                onChange={(e) => setDraft((d) => ({ ...d, apiPassword: e.target.value }))}
                placeholder={hasCredentials ? "••••••••" : "IRP portal password"}
                className={`${inputCls} font-mono`}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelCls}>
                App key {hasCredentials && <span className="text-slate-400 font-normal">(stored — leave blank to keep)</span>}
              </label>
              <input
                type="text"
                value={draft.appKey}
                onChange={(e) => setDraft((d) => ({ ...d, appKey: e.target.value }))}
                placeholder={hasCredentials ? "••••••••" : "32-character app key issued at IRP registration"}
                className={`${inputCls} font-mono`}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls}>IRP endpoint</label>
              <input
                type="text"
                value={draft.baseUrl}
                onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                placeholder={
                  (draft.baseUrl ? "" : draft.environment === "PRODUCTION" ? NIC_PRODUCTION_URL : NIC_SANDBOX_URL) +
                  " (blank = this default)"
                }
                className={`${inputCls} font-mono`}
                autoComplete="off"
              />
            </div>
            </>)}
          </div>

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

          {/* Actions — Save is the only action for the authorised provider:
              there is deliberately NO test step there, because a "test" would
              be a real government authentication with no purpose. Testing is
              a local, Mock-only rehearsal. */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={async () => { if (await save()) setEditing(false); }}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[40px]"
            >
              {saving ? "Saving…" : "Save configuration"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[40px]"
            >
              Cancel
            </button>
            {draft.provider === "MOCK" ? (
              <button
                type="button"
                onClick={runTest}
                disabled={testing || saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[40px]"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
                Test connection
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <PlugZap className="w-3.5 h-3.5" />
                No test step — Save connects directly to the{" "}
                {draft.environment === "PRODUCTION" ? "production" : "sandbox"} IRP when an invoice is registered.
              </span>
            )}
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Credentials are encrypted at rest and never shown again
            </span>
          </div>

          {enabled && draft.provider !== "MOCK" && (!hasCredentials || (!draft.clientId && !draft.clientSecret)) && (
            <div className="text-xs rounded-lg border px-3 py-2 leading-relaxed bg-amber-50 border-amber-200 text-amber-700">
              <span className="font-semibold">IRIS credentials missing.</span> Client ID, Client Secret, API
              username, API password and the 32-character App key are the values the IRP asks for — the endpoints
              and the government-standard payload are built into the app (the endpoint field above only overrides
              them). Registration refuses with a clear message until they are saved.
            </div>
          )}
          </>
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
            {draft.provider !== "MOCK"
              ? " The official NIC e-invoice endpoints, authentication and INV payload are built into the app — your credentials and endpoint are all that is required, and registration connects directly (no test step)."
              : " The Mock provider never contacts any government portal — testing happens here, locally."}
          </p>
        </div>
      )}

      <ConfirmModal
        open={confirmDisable}
        title="Disable e-invoicing?"
        message="Existing invoices and any government registration records are kept untouched."
        confirmLabel="Disable"
        confirmVariant="danger"
        busy={saving}
        onCancel={() => setConfirmDisable(false)}
        onConfirm={() => {
          setConfirmDisable(false);
          save({ enabled: false });
        }}
      />
    </div>
  );
}
