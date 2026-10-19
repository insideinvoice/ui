import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import LoadingDots from "../components/LoadingDots";
import SelectMenu from "../components/SelectMenu";
import { deliveryChallanAPI, customerAPI, businessAPI } from "../api/auth";
import { renderDeliveryChallanPdf } from "../components/DeliveryChallanDownload";
import { goBack } from "../utils/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Trash2, Download, ClipboardList, X, UserPlus } from "lucide-react";

const inputClass =
  "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white transition-all min-h-[44px]";
const labelClass =
  "block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase";

const todayIso = () => new Date().toISOString().split("T")[0];

const emptyItem = { description: "", quantity: "", remarks: "" };

export default function DeliveryChallanForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // On-the-fly customer creation: the customer select carries a "+ New
  // Customer" option that opens this modal; the created customer is
  // appended to the list and auto-selected so the form is never interrupted.
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    gstIn: "",
    billingAddress: "",
  });

  const [template, setTemplate] = useState(
    () => searchParams.get("template") || localStorage.getItem("ii_dc_template") || "classic"
  );
  const [sealOn, setSealOn] = useState(
    () => localStorage.getItem("ii_dc_seal") !== "off"
  );
  // Round seal vs rectangular rubber stamp — same global preference the
  // invoice flow uses (localStorage.seal_type), defaulting to the round seal.
  const [sealType, setSealType] = useState(
    () => localStorage.getItem("seal_type") || "round"
  );
  const [form, setForm] = useState({
    challanNumber: "",
    challanDate: todayIso(),
    customerId: "",
    poNumber: "",
    poDate: "",
  });
  const [items, setItems] = useState([{ ...emptyItem }]);

  useEffect(() => {
    Promise.all([
      customerAPI.getAll({ size: 200, sortBy: "name", sortDir: "asc" }),
      businessAPI.getProfile(),
    ])
      .then(([cRes, bRes]) => {
        setCustomers(cRes.data.data?.content || cRes.data.data || []);
        setBusiness(bRes.data.data);
      })
      .catch(() => toast.error("Failed to load form data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem("ii_dc_template", template);
  }, [template]);

  useEffect(() => {
    localStorage.setItem("ii_dc_seal", sealOn ? "on" : "off");
  }, [sealOn]);

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const handleCustomerSelect = (value) => {
    if (value === "__new_customer__") {
      setShowCustomerModal(true);
      return;
    }
    setField("customerId", value);
  };

  const setNewCustomerField = (name, value) =>
    setNewCustomer((c) => ({ ...c, [name]: value }));

  const createCustomerOnTheFly = async () => {
    const name = newCustomer.name.trim();
    if (!name) {
      toast.error("Customer name is required");
      return;
    }
    setCreatingCustomer(true);
    try {
      const res = await customerAPI.create({
        name,
        email: newCustomer.email || undefined,
        phone: newCustomer.phone || undefined,
        billingAddress: newCustomer.billingAddress || undefined,
        gstIn: newCustomer.gstIn || undefined,
      });
      const created = res.data.data;
      setCustomers((list) => [...list, created]);
      setField("customerId", String(created.id));
      setShowCustomerModal(false);
      setNewCustomer({
        name: "",
        phone: "",
        email: "",
        gstIn: "",
        billingAddress: "",
      });
      toast.success("Customer created & selected");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  };

  const setItem = (idx, name, value) =>
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, [name]: value } : it)));

  const addItem = () => setItems((list) => [...list, { ...emptyItem }]);
  const removeItem = (idx) =>
    setItems((list) => (list.length === 1 ? list : list.filter((_, i) => i !== idx)));

  const validItems = items.filter(
    (it) => it.description.trim() && parseFloat(it.quantity) > 0
  );

  const handleCreate = async () => {
    if (!form.customerId) {
      toast.error("Select a customer");
      return;
    }
    if (!validItems.length) {
      toast.error("Add at least one item with description and quantity");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        challanNumber: form.challanNumber.trim() || undefined,
        customerId: Number(form.customerId),
        challanDate: form.challanDate,
        poNumber: form.poNumber.trim() || undefined,
        poDate: form.poDate || undefined,
        items: validItems.map((it) => ({
          description: it.description.trim(),
          quantity: parseFloat(it.quantity),
          // Printed only by the Royal template's Remarks column; Classic
          // ignores it (no column there). Optional — null when blank.
          remarks: it.remarks?.trim() || null,
        })),
      };
      const res = await deliveryChallanAPI.create(payload);
      const dc = res.data.data;
      const pdf = await renderDeliveryChallanPdf(dc, business, {
        variant: template,
        sealOn,
        sealType,
      });
      pdf.save(`Delivery_Challan_${dc.challanNumber}.pdf`);
      toast.success("Delivery challan created & downloaded");
      navigate("/delivery-challans");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to create delivery challan"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100dvh - 80px)" }}
        >
          <LoadingDots className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1400px] mx-auto">
        <PageHeader title="New Delivery Challan" />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
              <ClipboardList className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Challan Details
              </h2>
              <p className="text-xs text-slate-500">
                Creates the record and instantly downloads the PDF
              </p>
            </div>
          </div>

          {/* Template + seal */}
          <div className="flex flex-wrap items-end gap-6 mb-5">
            <div>
              <span className={labelClass}>Template</span>
              <div className="flex gap-2">
                {[
                  { id: "classic", label: "Classic" },
                  { id: "royal", label: "Royal" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all min-h-[40px] ${
                      template === t.id
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none pb-2.5">
              <input
                type="checkbox"
                checked={sealOn}
                onChange={(e) => setSealOn(e.target.checked)}
                className="w-4.5 h-4.5 accent-teal-600"
              />
              Seal / Rubber stamp on PDF
            </label>
            {sealOn && (
              <div className="pb-1.5">
                <span className={labelClass}>Stamp type</span>
                <div className="flex gap-2">
                  {[
                    { id: "round", label: "Round Seal" },
                    { id: "stamp", label: "Rubber Stamp" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSealType(s.id);
                        localStorage.setItem("seal_type", s.id);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all min-h-[40px] ${
                        sealType === s.id
                          ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <div>
              <label className={labelClass}>Challan No.</label>
              <input
                type="text"
                value={form.challanNumber}
                onChange={(e) => setField("challanNumber", e.target.value)}
                className={inputClass}
                placeholder="Leave blank for auto (DC-YYYYMMDD-HHMMSS)"
              />
            </div>
            <div>
              <label className={labelClass}>Challan Date</label>
              <input
                type="date"
                value={form.challanDate}
                onChange={(e) => setField("challanDate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Customer *</label>
              {/* SelectMenu instead of native <select>: options can carry a
                  real lucide icon, so "New Customer…" shows the same
                  UserPlus icon the rest of the app uses (native <option>
                  elements can only render plain text). */}
              <SelectMenu
                value={String(form.customerId || "")}
                onChange={handleCustomerSelect}
                options={[
                  { value: "", label: "Select customer *" },
                  {
                    value: "__new_customer__",
                    label: "New Customer…",
                    icon: UserPlus,
                  },
                  ...customers.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  })),
                ]}
                ariaLabel="Customer"
                className="w-full"
              />
            </div>
            <div>
              <label className={labelClass}>Your P.O No (optional)</label>
              <input
                type="text"
                value={form.poNumber}
                onChange={(e) => setField("poNumber", e.target.value)}
                className={inputClass}
                placeholder="PO-2026-001"
              />
            </div>
            <div>
              <label className={labelClass}>P.O Date (optional)</label>
              <input
                type="date"
                value={form.poDate}
                onChange={(e) => setField("poDate", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Items */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className={labelClass + " mb-0"}>Items *</span>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 sm:p-0 rounded-lg border border-slate-200 sm:border-0 sm:rounded-none bg-slate-50/60 sm:bg-transparent"
                >
                  <div className="flex items-center gap-2 min-w-0 sm:flex-1">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={it.description}
                      onChange={(e) =>
                        setItem(idx, "description", e.target.value)
                      }
                      placeholder="Description of material"
                      className={inputClass + " min-w-0 sm:flex-1"}
                    />
                  </div>
                  {/* Per-item remarks — the Royal template's items table has a
                      dedicated Remarks column; Classic has no such column, so
                      no field is offered there (per product decision). */}
                  {template === "royal" && (
                    <input
                      type="text"
                      value={it.remarks ?? ""}
                      onChange={(e) => setItem(idx, "remarks", e.target.value)}
                      placeholder="Remarks"
                      maxLength={300}
                      className={inputClass + " sm:flex-none sm:w-44"}
                    />
                  )}
                  <div className="flex items-center gap-2 pl-9 sm:pl-0">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={it.quantity}
                      onChange={(e) => setItem(idx, "quantity", e.target.value)}
                      placeholder="Qty"
                      className={inputClass + " w-28"}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-all shadow-sm min-h-[44px]"
            >
              {saving ? (
                <LoadingDots className="text-white" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {saving ? "Creating…" : "Create & Download PDF"}
            </button>
            <button
              onClick={() => goBack(navigate, "/delivery-challans")}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-700 text-sm font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 transition-all min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" /> Back to list
            </button>
          </div>
        </div>

        {/* Quick-create customer modal — opened from the "+ New Customer"
            option in the customer select; the new customer is saved and
            auto-selected without leaving this form. */}
        {showCustomerModal && (
          <div
            className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
            onClick={() => !creatingCustomer && setShowCustomerModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                  <UserPlus className="w-4.5 h-4.5 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">
                    New Customer
                  </h3>
                  <p className="text-xs text-slate-500">
                    Created instantly & selected below
                  </p>
                </div>
                <button
                  onClick={() =>
                    !creatingCustomer && setShowCustomerModal(false)
                  }
                  aria-label="Close"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
                <div>
                  <label className={labelClass}>Name *</label>
                  <input
                    autoFocus
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomerField("name", e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        createCustomerOnTheFly();
                      }
                    }}
                    className={inputClass}
                    placeholder="Customer name"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomerField(
                          "phone",
                          e.target.value
                            .replace(/\D/g, "")
                            .replace(/^0+/, "")
                            .slice(0, 10),
                        )
                      }
                      className={inputClass}
                      placeholder="10-digit mobile"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) =>
                        setNewCustomerField("email", e.target.value)
                      }
                      className={inputClass}
                      placeholder="name@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>GSTIN</label>
                  <input
                    type="text"
                    value={newCustomer.gstIn}
                    onChange={(e) =>
                      setNewCustomerField("gstIn", e.target.value.toUpperCase())
                    }
                    className={inputClass}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div>
                  <label className={labelClass}>Billing address</label>
                  <textarea
                    rows={2}
                    value={newCustomer.billingAddress}
                    onChange={(e) =>
                      setNewCustomerField("billingAddress", e.target.value)
                    }
                    className={inputClass + " resize-none"}
                    placeholder="Street, city, state, PIN"
                  />
                </div>
              </div>

              <div className="flex gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
                <button
                  onClick={createCustomerOnTheFly}
                  disabled={creatingCustomer || !newCustomer.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-all shadow-sm min-h-[44px]"
                >
                  {creatingCustomer ? (
                    <LoadingDots className="text-white" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {creatingCustomer ? "Creating…" : "Create & Select"}
                </button>
                <button
                  onClick={() => setShowCustomerModal(false)}
                  disabled={creatingCustomer}
                  className="px-4 py-2.5 bg-white text-slate-700 text-sm font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 transition-all min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
