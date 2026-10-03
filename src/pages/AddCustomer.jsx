import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import LoadingDots from "../components/LoadingDots";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { customerAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, Phone, MapPin, Hash, Save } from "lucide-react";

export default function AddCustomer() {
  const { logout } = useAuth();
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

  const inputClass = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all";
  const labelClass = "block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase";

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="Add New Customer" />
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 lg:p-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Customer Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input name="name" value={form.name} onChange={handleChange} className={"pl-10 " + inputClass} placeholder="e.g. Good Luck Enterprises" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input name="email" value={form.email} onChange={handleChange} className={inputClass} placeholder="customer@email.com" />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input name="phone" value={form.phone} onChange={handleChange} maxLength={10} inputMode="numeric" className={"pl-10 " + inputClass} placeholder="e.g. 9036843735" />
              </div>
            </div>
            <div>
              <label className={labelClass}>GSTIN</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input name="gstIn" value={form.gstIn} onChange={handleChange} className={"pl-10 font-mono uppercase tracking-wider " + inputClass} placeholder="e.g. 29AEQPJ1655J1Z0" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Billing Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <textarea name="billingAddress" value={form.billingAddress} onChange={handleChange} rows={2} className={"pl-10 " + inputClass + " resize-none"} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={saving || !form.name.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm">
            {saving ? <LoadingDots className="text-white" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Customer"}
          </button>
        </form>
      </div>
    </div>
  );
}
