import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { customerAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, Phone, MapPin, Hash, Save, User, Mail, X } from "lucide-react";

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

  const inputClass = "w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-2";

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-2xl mx-auto">
        <PageHeader title="Add New Customer" />

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Form Header */}
          <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Customer Information</h2>
                <p className="text-sm text-slate-500">Enter the customer details below</p>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <div className="px-6 sm:px-8 py-6 space-y-6">
            {/* Customer Name */}
            <div>
              <label className={labelClass}>
                Customer Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass + " pl-11"}
                  placeholder="e.g. Good Luck Enterprises"
                />
              </div>
            </div>

            {/* Email & Phone Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    type="email"
                    className={inputClass + " pl-11"}
                    placeholder="customer@email.com"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    maxLength={10}
                    inputMode="numeric"
                    className={inputClass + " pl-11"}
                    placeholder="e.g. 9036843735"
                  />
                </div>
              </div>
            </div>

            {/* GSTIN */}
            <div>
              <label className={labelClass}>GSTIN</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  name="gstIn"
                  value={form.gstIn}
                  onChange={handleChange}
                  className={inputClass + " pl-11 font-mono uppercase tracking-wider"}
                  placeholder="e.g. 29AEQPJ1655J1Z0"
                />
              </div>
            </div>

            {/* Billing Address */}
            <div>
              <label className={labelClass}>Billing Address</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 text-slate-400 w-4 h-4" />
                <textarea
                  name="billingAddress"
                  value={form.billingAddress}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass + " pl-11 resize-none"}
                  placeholder="Enter complete billing address"
                />
              </div>
            </div>
          </div>

          {/* Form Footer */}
          <div className="px-6 sm:px-8 py-5 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate("/customers")}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all duration-150 shadow-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-150 shadow-sm shadow-indigo-600/25 hover:shadow-indigo-600/40 active:scale-[0.98]"
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
