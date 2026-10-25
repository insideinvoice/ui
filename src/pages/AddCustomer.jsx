import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import PageHeader from "../components/PageHeader";
import { customerAPI } from "../api/auth";
import toast from "react-hot-toast";
import { Building2, Phone, MapPin, Hash, Save, User, Mail, X, AlertCircle, Pencil } from "lucide-react";

// Shared form tokens — same medium scale (40px controls) and violet focus
// language as AddProduct, so every "add" page feels identical.
const inputClass =
  "w-full h-10 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200";
const textareaClass =
  "w-full min-h-[76px] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200 resize-none";
const labelClass = "block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5";

export default function AddCustomer() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", billingAddress: "", gstIn: "" });
  const [saving, setSaving] = useState(false);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  // Duplicate phone/email found in THIS business (other businesses may hold the
  // same contact details — that is never a conflict).
  const [dupError, setDupError] = useState(null); // { message, customerId }
  // Avoids firing the same lookup twice (blur → submit both run the check).
  const lastCheck = useRef({ key: "", ok: true });

  const handleChange = (e) => {
    let value = e.target.value;
    if (e.target.name === "phone") {
      value = value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10);
    }
    setForm((p) => ({ ...p, [e.target.name]: value }));
    setDupError(null);
  };

  // Pre-flight duplicate lookup (POST /customers/check). Returns false when the
  // value already belongs to a customer of this business; failures fall through
  // so the server-side check still decides on save.
  const checkDuplicate = async (field, value) => {
    const v = (value || "").trim();
    setDupError(null);
    if (!v) {
      lastCheck.current = { key: "", ok: true };
      return true;
    }
    const key = `${field}:${v.toLowerCase()}`;
    if (lastCheck.current.key === key) return lastCheck.current.ok;
    try {
      const res = await customerAPI.check({ [field]: v });
      const existing = res.data?.data;
      if (existing) {
        setDupError({
          field,
          message: field === "phone"
            ? `Phone ${v} already belongs to "${existing.name}"`
            : `Email ${v} already belongs to "${existing.name}"`,
          customerId: existing.id,
        });
        lastCheck.current = { key, ok: false };
        return false;
      }
      lastCheck.current = { key, ok: true };
      return true;
    } catch {
      lastCheck.current = { key, ok: true };
      return true;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Customer name is required"); return; }
    const phoneOk = await checkDuplicate("phone", form.phone);
    if (!phoneOk) { phoneRef.current?.focus(); return; }
    const emailOk = await checkDuplicate("email", form.email);
    if (!emailOk) { emailRef.current?.focus(); return; }
    setSaving(true);
    try {
      await customerAPI.create({
        name: form.name.trim(), email: form.email || undefined, phone: form.phone || undefined,
        billingAddress: form.billingAddress || undefined, gstIn: form.gstIn || undefined,
      });
      toast.success("Customer created successfully");
      setForm({ name: "", email: "", phone: "", billingAddress: "", gstIn: "" });
      lastCheck.current = { key: "", ok: true };
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create customer";
      // 409 = the server-side duplicate guard (race or lookup failure). Point the
      // red border at the offending field and resolve the existing record so the
      // banner can link straight to it.
      if (err.response?.status === 409) {
        const lower = msg.toLowerCase();
        const field = lower.startsWith("phone") ? "phone" : lower.startsWith("email") ? "email" : null;
        let customerId = null;
        try {
          const probe = field === "phone" ? { phone: form.phone }
            : field === "email" ? { email: form.email }
            : { phone: form.phone || undefined, email: form.email || undefined };
          customerId = (await customerAPI.check(probe)).data?.data?.id ?? null;
        } catch {
          /* no match / lookup unavailable — banner still shows the message */
        }
        setDupError({ field, message: msg, customerId });
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const goToExisting = () => {
    if (dupError?.customerId) navigate(`/customers?edit=${dupError.customerId}`);
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-slate-50 to-violet-50/40">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-2xl mx-auto">
        <PageHeader title="Add New Customer" />

        {/* One card, one border — same layout rhythm as AddProduct. */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Form Header */}
          <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5">
            <User className="w-4 h-4 text-violet-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">Customer Information</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Buyer record — appears on your invoices
              </p>
            </div>
          </div>

          {/* Form Body */}
          <div className="px-5 sm:px-6 pb-5 space-y-4">
            {/* Customer Name */}
            <div>
              <label htmlFor="customer-name" className={labelClass}>
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  id="customer-name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="e.g. Good Luck Enterprises"
                />
              </div>
            </div>

            {/* Email & Phone Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customer-email" className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <input
                    id="customer-email"
                    ref={emailRef}
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    onBlur={() => checkDuplicate("email", form.email)}
                    className={inputClass + (dupError?.field === "email" ? " border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-500/10" : "")}
                    placeholder="customer@email.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="customer-phone" className={labelClass}>Phone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <input
                    id="customer-phone"
                    ref={phoneRef}
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.phone}
                    onChange={handleChange}
                    onBlur={() => checkDuplicate("phone", form.phone)}
                    className={inputClass + " tabular-nums" + (dupError?.field === "phone" ? " border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-500/10" : "")}
                    placeholder="e.g. 9036843735"
                  />
                </div>
              </div>
            </div>

            {/* Duplicate phone/email — blocked, with a shortcut to the existing record */}
            {dupError && (
              <div className="flex flex-col gap-2 p-3 rounded-lg border border-rose-200 bg-rose-50/60">
                <p className="flex items-start gap-1.5 text-xs font-medium text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{dupError.message}. Update that customer instead of creating a duplicate.</span>
                </p>
                {dupError.customerId ? (
                  <button
                    type="button"
                    onClick={goToExisting}
                    className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit existing customer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate("/customers")}
                    className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Go to customers
                  </button>
                )}
              </div>
            )}

            {/* GSTIN */}
            <div>
              <label htmlFor="customer-gstin" className={labelClass}>GSTIN</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  id="customer-gstin"
                  name="gstIn"
                  value={form.gstIn}
                  onChange={handleChange}
                  className={inputClass + " font-mono uppercase tracking-widest placeholder:tracking-normal"}
                  placeholder="e.g. 29AEQPJ1655J1Z0"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Billing Address */}
            <div>
              <label htmlFor="customer-address" className={labelClass}>Billing Address</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-3 text-slate-400 w-4 h-4 pointer-events-none" />
                <textarea
                  id="customer-address"
                  name="billingAddress"
                  rows={3}
                  value={form.billingAddress}
                  onChange={handleChange}
                  className={textareaClass}
                  placeholder="Enter complete billing address"
                />
              </div>
            </div>
          </div>

          {/* Form Footer — flat, no band or divider line */}
          <div className="px-5 sm:px-6 pb-5 flex flex-col sm:flex-row gap-2.5 justify-end">
            <button
              type="button"
              onClick={() => navigate("/customers")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-700 rounded-lg transition-all duration-150"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[40px] text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-150"
            >
              {saving ? <LoadingDots className="text-white" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
