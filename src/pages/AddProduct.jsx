import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { productAPI } from "../api/auth";
import toast from "react-hot-toast";
import { Package, Hash, IndianRupee, Percent, Save, X } from "lucide-react";

export default function AddProduct() {
  const navigate = useNavigate();
  const hsnRef = useRef(null);
  const [form, setForm] = useState({ name: "", hsn: "", rate: "", gstPercentage: "18" });
  const [saving, setSaving] = useState(false);
  const [hsnError, setHsnError] = useState("");

  useEffect(() => {
    hsnRef.current?.focus();
  }, []);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (e.target.name === "hsn") setHsnError("");
  };

  const checkHsnUnique = async (value) => {
    const hsn = (value || "").trim();
    setHsnError("");
    if (!hsn) return true;
    try {
      const res = await productAPI.findByHsn(hsn);
      const existing = res.data?.data;
      if (existing) {
        setHsnError(`HSN/SAC "${hsn}" is already used by "${existing.name}"`);
        return false;
      }
    } catch {
      /* lookup failed - let the server-side check decide on save */
    }
    return true;
  };

  const handleHsnKeyDown = async (e) => {
    if (e.key === "Enter" && form.hsn) {
      e.preventDefault();
      const ok = await checkHsnUnique(form.hsn);
      if (ok) document.querySelector("[name='name']")?.focus();
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.querySelector("[name='rate']")?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (!parseFloat(form.rate) || parseFloat(form.rate) <= 0) { toast.error("Rate must be greater than 0"); return; }
    const hsnOk = await checkHsnUnique(form.hsn);
    if (!hsnOk) { hsnRef.current?.focus(); return; }
    setSaving(true);
    try {
      await productAPI.create({
        name: form.name.trim(), hsn: form.hsn || undefined,
        rate: parseFloat(form.rate), gstPercentage: parseFloat(form.gstPercentage) || 0,
      });
      toast.success("Product created successfully");
      setForm({ name: "", hsn: "", rate: "", gstPercentage: "18" });
      setHsnError("");
      hsnRef.current?.focus();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create product";
      if (msg.toLowerCase().includes("hsn")) setHsnError(msg);
      toast.error(msg);
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
        <PageHeader title="Add New Product" />

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Form Header */}
          <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Product Information</h2>
                <p className="text-sm text-slate-500">Enter the product details below</p>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <div className="px-6 sm:px-8 py-6 space-y-6">
            {/* Product Name */}
            <div>
              <label className={labelClass}>
                Product Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  onKeyDown={handleNameKeyDown}
                  className={inputClass + " pl-11"}
                  placeholder="e.g. Service Fee"
                />
              </div>
            </div>

            {/* HSN/SAC */}
            <div>
              <label className={labelClass}>
                HSN/SAC <span className="text-xs text-slate-400 font-normal">(scan barcode)</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  ref={hsnRef}
                  name="hsn"
                  value={form.hsn}
                  onChange={handleChange}
                  onKeyDown={handleHsnKeyDown}
                  onBlur={() => checkHsnUnique(form.hsn)}
                  className={inputClass + " pl-11 font-mono uppercase tracking-wider" + (hsnError ? " border-red-400 focus:border-red-500 focus:ring-red-500/20" : "")}
                  placeholder="e.g. 9983"
                  autoComplete="off"
                />
              </div>
              {hsnError && (
                <p className="mt-2 text-xs font-medium text-red-500">{hsnError}</p>
              )}
            </div>

            {/* Rate & GST Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Rate (Rs.) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="rate"
                    value={form.rate}
                    onChange={handleChange}
                    inputMode="decimal"
                    className={inputClass + " pl-11"}
                    placeholder="e.g. 1000"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>GST %</label>
                <div className="relative">
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="gstPercentage"
                    value={form.gstPercentage}
                    onChange={handleChange}
                    inputMode="decimal"
                    className={inputClass + " pl-11"}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Footer */}
          <div className="px-6 sm:px-8 py-5 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all duration-150 shadow-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim() || !form.rate}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-150 shadow-sm shadow-indigo-600/25 hover:shadow-indigo-600/40 active:scale-[0.98]"
            >
              {saving ? <LoadingDots className="text-white" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
