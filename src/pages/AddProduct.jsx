import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import PageHeader from "../components/PageHeader";
import { productAPI } from "../api/auth";
import toast from "react-hot-toast";
import { Package, Hash, IndianRupee, Percent, Save, X, AlertCircle } from "lucide-react";

export default function AddProduct() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const hsnRef = useRef(null);
  const nameRef = useRef(null);
  const rateRef = useRef(null);
  // Cache of the last HSN lookup so the Enter-key check and the follow-up
  // blur (focus moves to the next field) don't fire the same API call twice.
  const lastHsnCheck = useRef({ value: "", ok: true });
  const [form, setForm] = useState({ name: "", hsn: "", rate: "", gstPercentage: "18" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [hsnError, setHsnError] = useState("");

  useEffect(() => {
    if (!isEdit) hsnRef.current?.focus();
  }, [isEdit]);

  // Edit mode: prefill the form from the existing product
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await productAPI.getById(editId);
        const p = res.data?.data;
        if (!p) throw new Error("not found");
        if (cancelled) return;
        setForm({
          name: p.name || "",
          hsn: p.hsn || "",
          rate: p.rate != null ? String(p.rate) : "",
          gstPercentage: p.gstPercentage != null ? String(p.gstPercentage) : "18",
        });
      } catch {
        if (!cancelled) setLoadError("Could not load this product — it may have been deleted.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, editId]);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (e.target.name === "hsn") setHsnError("");
  };

  const checkHsnUnique = async (value) => {
    const hsn = (value || "").trim();
    setHsnError("");
    if (!hsn) {
      lastHsnCheck.current = { value: "", ok: true };
      return true;
    }
    // Same value already verified this session (Enter → blur double-fire) — reuse it.
    if (lastHsnCheck.current.value === hsn) return lastHsnCheck.current.ok;
    try {
      const res = await productAPI.findByHsn(hsn);
      const existing = res.data?.data;
      // In edit mode the match may be this very product — that's not a conflict.
      if (existing && String(existing.id) !== String(editId)) {
        setHsnError(`HSN/SAC "${hsn}" is already used by "${existing.name}"`);
        lastHsnCheck.current = { value: hsn, ok: false };
        return false;
      }
      lastHsnCheck.current = { value: hsn, ok: true };
      return true;
    } catch {
      /* lookup failed - let the server-side check decide on save */
      lastHsnCheck.current = { value: hsn, ok: true };
      return true;
    }
  };

  const handleHsnKeyDown = async (e) => {
    if (e.key === "Enter" && form.hsn) {
      e.preventDefault();
      const ok = await checkHsnUnique(form.hsn);
      if (ok) nameRef.current?.focus();
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      rateRef.current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    if (!parseFloat(form.rate) || parseFloat(form.rate) <= 0) { toast.error("Rate must be greater than 0"); return; }
    const gst = parseFloat(form.gstPercentage) || 0;
    if (gst < 0 || gst > 100) { toast.error("GST % must be between 0 and 100"); return; }
    const hsnOk = await checkHsnUnique(form.hsn);
    if (!hsnOk) { hsnRef.current?.focus(); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        // Edit mode sends "" instead of undefined so a cleared HSN actually
        // persists (the backend mapper skips null fields).
        hsn: isEdit ? (form.hsn || "") : (form.hsn || undefined),
        rate: parseFloat(form.rate),
        gstPercentage: gst,
      };
      if (isEdit) {
        await productAPI.update(editId, payload);
        toast.success("Product updated successfully");
        navigate("/products");
        return;
      }
      await productAPI.create(payload);
      toast.success("Product created successfully");
      setForm({ name: "", hsn: "", rate: "", gstPercentage: "18" });
      setHsnError("");
      hsnRef.current?.focus();
    } catch (err) {
      const msg = err.response?.data?.message || (isEdit ? "Failed to update product" : "Failed to create product");
      if (msg.toLowerCase().includes("hsn")) setHsnError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-slate-50 to-violet-50/40">
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100dvh - 80px)" }}>
          <LoadingDots className="text-slate-400" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-slate-50 to-violet-50/40">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-3xl mx-auto">
          <PageHeader title="Edit Product" />
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">{loadError}</p>
            <button
              onClick={() => navigate("/products")}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-all"
            >
              <X className="w-4 h-4" /> Back to Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Shared form tokens — one source of truth for every field on the page.
  // Medium scale (40px controls) with exactly ONE border per element: the card
  // owns the outer border, inputs/buttons draw theirs, nothing is doubled.
  const labelClass = "flex items-baseline justify-between mb-1.5";
  const labelText = "block text-xs font-semibold uppercase tracking-wider text-slate-500";
  const inputClass = "w-full h-10 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200";
  const fieldRow = (label, htmlFor, required, helper) => (
    <label htmlFor={htmlFor} className={labelClass}>
      <span className={labelText}>
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {helper && <span className="text-[11px] font-medium text-slate-400">{helper}</span>}
    </label>
  );
  const errorText = "mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600";

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-slate-50 to-violet-50/40">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-2xl mx-auto">
        <PageHeader title={isEdit ? "Edit Product" : "Add New Product"} />

        {/* One card, one border — no accent bar, no nested bordered tiles. */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Form Header */}
          <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5">
            <Package className="w-4 h-4 text-violet-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">Product Information</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEdit ? "Update the product details below" : "Catalogue entry — appears in your invoice item picker"}
              </p>
            </div>
          </div>

          {/* Form Body */}
          <div className="px-5 sm:px-6 pb-5 space-y-4">
            {/* Product Name */}
            <div>
              {fieldRow("Product Name", "product-name", true)}
              <div className="relative">
                <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  id="product-name"
                  ref={nameRef}
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  onKeyDown={handleNameKeyDown}
                  className={inputClass}
                  placeholder="e.g. Service Fee"
                />
              </div>
            </div>

            {/* HSN/SAC */}
            <div>
              {fieldRow("HSN/SAC", "product-hsn", false, "Barcode scan & Enter to verify")}
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  id="product-hsn"
                  ref={hsnRef}
                  name="hsn"
                  value={form.hsn}
                  onChange={handleChange}
                  onKeyDown={handleHsnKeyDown}
                  onBlur={() => checkHsnUnique(form.hsn)}
                  className={inputClass + " font-mono uppercase tracking-widest placeholder:tracking-normal"
                    + (hsnError ? " border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-500/10" : "")}
                  placeholder="e.g. 9983"
                  autoComplete="off"
                />
              </div>
              {hsnError && (
                <p className={errorText}><AlertCircle className="w-3.5 h-3.5 shrink-0" />{hsnError}</p>
              )}
            </div>

            {/* Rate & GST Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                {fieldRow("Rate (Rs.)", "product-rate", true)}
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <input
                    id="product-rate"
                    ref={rateRef}
                    type="number"
                    step="0.01"
                    min="0"
                    name="rate"
                    value={form.rate}
                    onChange={handleChange}
                    inputMode="decimal"
                    className={inputClass + " tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"}
                    placeholder="e.g. 1000"
                  />
                </div>
              </div>
              <div>
                {fieldRow("GST %", "product-gst", false, "Applied per line item")}
                <div className="relative">
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <input
                    id="product-gst"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="gstPercentage"
                    value={form.gstPercentage}
                    onChange={handleChange}
                    inputMode="decimal"
                    className={inputClass + " tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Footer — flat, no band or divider line */}
          <div className="px-5 sm:px-6 pb-5 flex flex-col sm:flex-row gap-2.5 justify-end">
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-700 rounded-lg transition-all duration-150"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim() || !form.rate}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[40px] text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-150"
            >
              {saving ? <LoadingDots className="text-white" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : isEdit ? "Update Product" : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
