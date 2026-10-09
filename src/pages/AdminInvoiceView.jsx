import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { adminAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, FileText, Save, Edit2, Download } from "lucide-react";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import InvoiceTemplateRenderer from "../components/InvoiceTemplateRenderer";
import { processPrint } from "../utils/printInvoice";
import { getPrintSettings } from "../constants/paperSizes";
import { computeInvoiceTotals, round2 } from "../utils/invoiceTotals";

const emptyItem = { itemName: "", hsn: "", qty: "", rate: "", gstPercentage: "18", taxableValue: 0, taxAmount: 0, total: 0 };

export default function AdminInvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [items, setItems] = useState([]);
  const [business, setBusiness] = useState(null);
  const invoiceRef = useRef(null);
  // The hidden document is only mounted while a PDF is being generated, so
  // editing keystrokes don't re-render a full A4 invoice.
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    adminAPI.getInvoice(id)
      .then((res) => {
        const inv = res.data.data;
        setInvoice(inv);
        setForm({
          invoiceNumber: inv.invoiceNumber || "",
          invoiceType: inv.invoiceType,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          placeOfSupply: inv.placeOfSupply || "",
          paymentTerms: inv.paymentTerms || "",
          notes: inv.notes || "",
          deliveryNote: inv.deliveryNote || "",
          deliveryNoteDate: inv.deliveryNoteDate || "",
          referenceNumber: inv.referenceNumber || "",
          buyerOrderNumber: inv.buyerOrderNumber || "",
          dispatchDocNumber: inv.dispatchDocNumber || "",
          dispatchedThrough: inv.dispatchedThrough || "",
          termsOfDelivery: inv.termsOfDelivery || "",
          otherReferences: inv.otherReferences || "",
          destination: inv.destination || "",
          status: inv.status,
          discountPercent: inv.discountPercent != null ? String(inv.discountPercent) : "",
        });
        setItems(inv.items?.map((item) => ({
          itemName: item.itemName,
          hsn: item.hsn || "",
          qty: String(item.qty),
          rate: String(item.rate),
          gstPercentage: String(item.gstPercentage),
          taxableValue: item.taxableValue,
          taxAmount: item.taxAmount,
          total: item.total,
        })) || []);
        if (inv.businessId) {
          return adminAPI.getBusiness(inv.businessId).then((bRes) => {
            setBusiness(bRes.data.data);
          });
        }
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load invoice"))
      .finally(() => setLoading(false));
  }, [id]);

  const recalcItem = (item) => {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    const gst = parseFloat(item.gstPercentage) || 0;
    const taxableValue = qty * rate;
    const taxAmount = (taxableValue * gst) / 100;
    item.taxableValue = round2(taxableValue);
    item.taxAmount = round2(taxAmount);
    item.total = round2(taxableValue + taxAmount);
  };

  const handleItemChange = (idx, field, value) => {
    const newItems = items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (["qty", "rate", "gstPercentage"].includes(field)) recalcItem(updated);
      return updated;
    });
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = (idx) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };

  const activeDiscount = editing
    ? (form.discountPercent || "0")
    : (invoice?.discountPercent != null ? String(invoice.discountPercent) : "0");
  const totals = useMemo(
    () => computeInvoiceTotals(items, activeDiscount),
    [items, activeDiscount]
  );

  // Stable object identity keeps React.memo'd templates from re-rendering on
  // unrelated state changes (saving/editing spinners etc).
  const previewCustomer = useMemo(() => ({
    name: invoice?.customerName,
    billingAddress: undefined,
    gstIn: undefined,
    phone: undefined,
    email: undefined,
    state: form.placeOfSupply,
  }), [invoice?.customerName, form.placeOfSupply]);

  const downloadPDF = async () => {
    try {
      const filename = `Invoice_${form.invoiceNumber || invoice?.invoiceNumber || "DRAFT"}.pdf`;
      const docType = form.invoiceType || invoice?.invoiceType || "TAX_INVOICE";
      const ps = (getPrintSettings()[docType] || {}).paperSize || "A4_PORTRAIT";
      setCapturing(true);
      // Wait for React to commit + paint so invoiceRef points at real DOM
      for (let i = 0; i < 5 && !invoiceRef.current; i++) {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      await processPrint(invoiceRef, docType, filename, ps);
    } catch {
      toast.error("Failed to generate");
    } finally {
      setCapturing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        customerId: invoice.customerId,
        invoiceType: form.invoiceType,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        placeOfSupply: form.placeOfSupply || undefined,
        paymentTerms: form.paymentTerms || undefined,
        notes: form.notes || undefined,
        deliveryNote: form.deliveryNote || undefined,
        deliveryNoteDate: form.deliveryNoteDate || undefined,
        referenceNumber: form.referenceNumber || undefined,
        buyerOrderNumber: form.buyerOrderNumber || undefined,
        dispatchDocNumber: form.dispatchDocNumber || undefined,
        dispatchedThrough: form.dispatchedThrough || undefined,
        termsOfDelivery: form.termsOfDelivery || undefined,
        otherReferences: form.otherReferences || undefined,
        destination: form.destination || undefined,
        status: form.status,
        discountPercent: parseFloat(form.discountPercent) || 0,
        items: items.filter((i) => i.itemName.trim() && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0).map((i, idx) => ({
          sno: idx + 1, itemName: i.itemName, hsn: i.hsn || undefined,
          qty: parseFloat(i.qty), rate: parseFloat(i.rate), gstPercentage: parseFloat(i.gstPercentage) || 0,
        })),
      };
      const res = await adminAPI.updateInvoice(id, payload);
      setInvoice(res.data.data);
      setEditing(false);
      toast.success("Invoice updated successfully");
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error || "Failed to update";
      toast.error(serverMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 flex items-center justify-center">
        <LoadingDots className="text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
        <AppNavbar />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <button onClick={() => navigate("/admin/invoices")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Invoices
          </button>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
            <FileText className="w-12 h-12 text-red-300 mx-auto mb-3" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 bg-white transition-all";
  const labelClass = "block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase";

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <AppNavbar />
      <div className="max-w-[1900px] mx-auto px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5">
        <PageHeader title="Invoice Details" backTo={-1} />

        {/* Hidden Invoice PDF for capture — mounted only while generating */}
        {capturing && (
          <div style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}>
            <InvoiceTemplateRenderer
              ref={invoiceRef}
              business={business}
              customer={previewCustomer}
              form={form}
              items={items}
              totals={totals}
              discountPercent={activeDiscount}
              type={form.invoiceType}
              invoiceNumber={form.invoiceNumber}
            />
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900">{invoice.invoiceNumber}</h1>
              <p className="text-xs text-slate-500">
                {invoice.invoiceType === "PROFORMA_INVOICE" ? "Proforma Invoice" : "Tax Invoice"} — {invoice.customerName}
              </p>
            </div>
            {!editing ? (
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={downloadPDF}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button onClick={() => setEditing(true)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            ) : (
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => { setEditing(false); }}
                  className="flex-1 sm:flex-initial justify-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>

          {editing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={inputClass}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PENDING">PENDING</option>
                  <option value="PAID">PAID</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Discount %</label>
                <input type="number" step="0.01" min="0" max="100" value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                  inputMode="decimal" className={inputClass} placeholder="0" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Customer</p>
              <p className="text-sm font-medium text-slate-800">{invoice.customerName}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Invoice Date</p>
              {editing ? (
                <input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className={inputClass} />
              ) : (
                <p className="text-sm text-slate-600">{invoice.invoiceDate}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Due Date</p>
              {editing ? (
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className={inputClass} />
              ) : (
                <p className="text-sm text-slate-600">{invoice.dueDate}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Place of Supply</p>
              {editing ? (
                <input type="text" value={form.placeOfSupply} onChange={(e) => setForm({ ...form, placeOfSupply: e.target.value })}
                  className={inputClass} placeholder="e.g. Karnataka" />
              ) : (
                <p className="text-sm text-slate-600">{invoice.placeOfSupply || "-"}</p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-[10px] font-medium text-slate-500 uppercase">#</th>
                  <th className="text-left py-2 px-2 text-[10px] font-medium text-slate-500 uppercase">Description</th>
                  <th className="text-left py-2 px-2 text-[10px] font-medium text-slate-500 uppercase">HSN/SAC</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium text-slate-500 uppercase">Qty</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium text-slate-500 uppercase">Rate</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium text-slate-500 uppercase">GST%</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium text-slate-500 uppercase">Taxable</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium text-slate-500 uppercase">Tax</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium text-slate-500 uppercase">Total</th>
                  {editing && <th className="py-2 px-2 w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {(editing ? items : invoice.items)?.map((item, idx) => (
                  <tr key={item.id ?? idx} className="border-b border-slate-100">
                    <td className="py-2 px-2 text-xs text-slate-600">{idx + 1}</td>
                    {editing ? (
                      <>
                        <td className="py-2 px-2">
                          <input type="text" value={item.itemName} onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-slate-400" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="text" value={item.hsn} onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                            className="w-24 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-slate-400" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" step="any" value={item.qty} onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                            inputMode="decimal" className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-right focus:outline-none focus:border-slate-400" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" step="any" value={item.rate} onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                            inputMode="decimal" className="w-24 px-2 py-1 border border-slate-200 rounded text-xs text-right focus:outline-none focus:border-slate-400" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" step="any" value={item.gstPercentage} onChange={(e) => handleItemChange(idx, "gstPercentage", e.target.value)}
                            inputMode="decimal" className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-right focus:outline-none focus:border-slate-400" />
                        </td>
                        <td className="py-2 px-2 text-xs text-slate-600 text-right">₹{(totals.perItem[idx]?.taxable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2 text-xs text-slate-600 text-right">₹{(totals.perItem[idx]?.tax ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2 text-xs text-slate-800 font-medium text-right">₹{(totals.perItem[idx]?.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2">
                          <button onClick={() => removeItem(idx)}
                            className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-2 text-xs text-slate-800">{item.itemName}</td>
                        <td className="py-2 px-2 text-xs text-slate-600">{item.hsn || "-"}</td>
                        <td className="py-2 px-2 text-xs text-slate-600 text-right">{item.qty}</td>
                        <td className="py-2 px-2 text-xs text-slate-600 text-right">₹{Number(item.rate).toLocaleString()}</td>
                        <td className="py-2 px-2 text-xs text-slate-600 text-right">{item.gstPercentage}%</td>
                        <td className="py-2 px-2 text-xs text-slate-600 text-right">₹{(totals.perItem[idx]?.taxable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2 text-xs text-slate-600 text-right">₹{(totals.perItem[idx]?.tax ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-2 text-xs text-slate-800 font-medium text-right">₹{(totals.perItem[idx]?.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editing && (
            <button onClick={addItem}
              className="mb-4 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              + Add Item
            </button>
          )}

          <div className="border-t border-slate-100 pt-4 flex flex-col items-end">
            <div className="text-sm text-slate-600 flex justify-between w-full sm:w-64 mb-1">
              <span>Subtotal:</span>
              <span>₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="text-sm text-slate-600 flex justify-between w-full sm:w-64 mb-1">
                <span>Discount ({totals.discountPercent}%):</span>
                <span>-₹{totals.discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="text-sm text-slate-600 flex justify-between w-full sm:w-64 mb-1">
              <span>Taxable Amount:</span>
              <span>₹{totals.taxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="text-sm text-slate-600 flex justify-between w-full sm:w-64 mb-1">
              <span>Tax Amount:</span>
              <span>₹{totals.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="text-base font-semibold text-slate-900 flex justify-between w-full sm:w-64 pt-2 border-t border-slate-200">
              <span>Grand Total:</span>
              <span>₹{totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h1 { font-family: 'Space Grotesk', sans-serif; }
      `}</style>
    </div>
  );
}
