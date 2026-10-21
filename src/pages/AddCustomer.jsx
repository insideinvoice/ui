import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import PageHeader from "../components/PageHeader";
import { customerAPI } from "../api/auth";
import toast from "react-hot-toast";
import { Building2, Phone, MapPin, Hash, Save, User, Mail, X } from "lucide-react";

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

  const handleChange = (e) => {
    let value = e.target.value;
    if (e.target.name === "phone") {
      value = value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10);
    }
    setForm((p) => ({ ...p, [e.target.name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Customer name is required"); return; }
    setSaving(true);
    try {
      await customerAPI.create({
        name: form.name.trim(), email: form.email || undefined, phone: form.phone || undefined,
        billingAddress: form.billingAddress || undefined, gstIn: form.gstIn || undefined,
      });
      toast.success("Customer created successfully");
      setForm({ name: "", email: "", phone: "", billingAddress: "", gstIn: "" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create customer");
    } finally {
      setSaving(false);
    }
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
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
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
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.phone}
                    onChange={handleChange}
                    className={inputClass + " tabular-nums"}
                    placeholder="e.g. 9036843735"
                  />
                </div>
              </div>
            </div>

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
