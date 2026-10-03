import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import LoadingDots from "../components/LoadingDots";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { productAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, Package, Hash, IndianRupee, Percent, Save } from "lucide-react";

export default function AddProduct() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const hsnRef = useRef(null);
  const [form, setForm] = useState({ name: "", hsn: "", rate: "", gstPercentage: "18" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hsnRef.current?.focus();
  }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleHsnKeyDown = (e) => {
    if (e.key === "Enter" && form.hsn) {
      e.preventDefault();
      document.querySelector("[name='rate']")?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (!parseFloat(form.rate) || parseFloat(form.rate) <= 0) { toast.error("Rate must be greater than 0"); return; }
    setSaving(true);
    try {
      await productAPI.create({
        name: form.name.trim(), hsn: form.hsn || undefined,
        rate: parseFloat(form.rate), gstPercentage: parseFloat(form.gstPercentage) || 0,
      });
      toast.success("Product created successfully");
      setForm({ name: "", hsn: "", rate: "", gstPercentage: "18" });
      hsnRef.current?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create product");
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
        <PageHeader title="Add New Product" />
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>HSN/SAC <span className="text-xs text-slate-400 font-normal">(scan barcode)</span></label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input ref={hsnRef} name="hsn" value={form.hsn} onChange={handleChange} onKeyDown={handleHsnKeyDown} className={"pl-10 font-mono uppercase tracking-wider " + inputClass} placeholder="e.g. 9983" autoComplete="off" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Product Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input name="name" value={form.name} onChange={handleChange} className={"pl-10 " + inputClass} placeholder="e.g. Service Fee" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Rate (Rs.) <span className="text-red-500">*</span></label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input type="number" step="0.01" min="0" name="rate" value={form.rate} onChange={handleChange} inputMode="decimal" className={"pl-10 " + inputClass} placeholder="e.g. 1000" />
              </div>
            </div>
            <div>
              <label className={labelClass}>GST %</label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input type="number" step="0.01" min="0" max="100" name="gstPercentage" value={form.gstPercentage} onChange={handleChange} inputMode="decimal" className={"pl-10 " + inputClass} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={saving || !form.name.trim() || !form.rate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm mt-6 mb-4">
            {saving ? <LoadingDots className="text-white" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Product"}
          </button>
        </form>
      </div>
    </div>
  );
}
