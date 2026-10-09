import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { customerAPI } from "../api/auth";
import LoadingDots from "../components/LoadingDots";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import toast from "react-hot-toast";
import { Search, Users, Trash2, Pencil, Save, X } from "lucide-react";

const emptyEdit = { name: "", email: "", phone: "", gstIn: "", billingAddress: "" };

export default function CustomersList() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [saving, setSaving] = useState(false);
  const ghostMode = useMemo(() => localStorage.getItem("ghost_mode") === "true", []);

  useEffect(() => {
    customerAPI.getAll({ size: 100 })
      .then((res) => setCustomers(res.data.data?.content || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.name || "").toLowerCase().includes(q)
      || (c.email || "").toLowerCase().includes(q)
      || (c.phone || "").includes(q)
      || (c.gstIn || "").toLowerCase().includes(q);
  }), [customers, search]);

  const startEdit = useCallback((c) => {
    setEditingId(c.id);
    setEditForm({
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      gstIn: c.gstIn || "",
      billingAddress: c.billingAddress || "",
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm(emptyEdit);
  }, []);

  const saveEdit = useCallback(async (id) => {
    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await customerAPI.update(id, editForm);
      setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...editForm } : c)));
      toast.success("Customer updated");
      cancelEdit();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update customer");
    } finally {
      setSaving(false);
    }
  }, [editForm, cancelEdit]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!customerToDelete) return;
    try {
      await customerAPI.delete(customerToDelete.id);
      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id));
      toast.success("Customer deleted");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete customer");
    } finally {
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
    }
  }, [customerToDelete]);

  const inputClass = "w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white";

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
        <AppNavbar />
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100dvh - 80px)" }}>
          <LoadingDots className="text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="View Customers" />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h1 className="text-base sm:text-lg font-semibold text-slate-900">Customers</h1>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search"
                className="w-full md:w-56 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white" />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">{search ? "No customers match your search" : "No customers yet"}</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">{search ? "Try a different name, email or phone" : "Add your first customer to get started"}</p>
              <button onClick={() => navigate("/customers/new")}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-sm">
                <Users className="w-4 h-4" /> Add Customer
              </button>
            </div>
          ) : (
          <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">GSTIN</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Billing Address</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className={`border-b border-slate-100 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : ""} ${editingId === c.id ? "bg-indigo-50/40" : "hover:bg-slate-100"}`}>
                    {editingId === c.id ? (
                      <>
                        <td className="py-2 px-3"><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} /></td>
                        <td className="py-2 px-3"><input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} /></td>
                        <td className="py-2 px-3"><input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputClass} /></td>
                        <td className="py-2 px-3"><input value={editForm.gstIn} onChange={(e) => setEditForm({ ...editForm, gstIn: e.target.value })} className={inputClass + " font-mono uppercase"} /></td>
                        <td className="py-2 px-3"><input value={editForm.billingAddress} onChange={(e) => setEditForm({ ...editForm, billingAddress: e.target.value })} className={inputClass} /></td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => saveEdit(c.id)} disabled={saving}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-slate-800">{c.name}</span>
                        </td>
                        <td className="py-3 px-4 text-xs sm:text-sm text-slate-600">{c.email || "-"}</td>
                        <td className="py-3 px-4 text-xs sm:text-sm text-slate-600">{c.phone || "-"}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-slate-600">{c.gstIn || "-"}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{c.billingAddress || "-"}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEdit(c)}
                              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                            {ghostMode && (
                              <button onClick={() => { setCustomerToDelete(c); setDeleteModalOpen(true); }}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3 p-3">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                {editingId === c.id ? (
                  <div className="space-y-2">
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" className={inputClass} />
                    <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" className={inputClass} />
                    <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone" className={inputClass} />
                    <input value={editForm.gstIn} onChange={(e) => setEditForm({ ...editForm, gstIn: e.target.value })} placeholder="GSTIN" className={inputClass + " font-mono uppercase"} />
                    <input value={editForm.billingAddress} onChange={(e) => setEditForm({ ...editForm, billingAddress: e.target.value })} placeholder="Billing Address" className={inputClass} />
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => saveEdit(c.id)} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                      <button onClick={cancelEdit}
                        className="flex-1 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="text-sm font-semibold text-slate-800 mb-1">{c.name}</div>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {ghostMode && (
                          <button onClick={() => { setCustomerToDelete(c); setDeleteModalOpen(true); }} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-0.5 text-xs text-slate-500">
                      {c.email && <div>Email: {c.email}</div>}
                      {c.phone && <div>Phone: {c.phone}</div>}
                      {c.gstIn && <div className="font-mono">GSTIN: {c.gstIn}</div>}
                      {c.billingAddress && <div>Address: {c.billingAddress}</div>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Customer"
        message={`Are you sure you want to delete "${customerToDelete?.name}"? This cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setDeleteModalOpen(false); setCustomerToDelete(null); }}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h1 { font-family: 'Space Grotesk', sans-serif; }
      `}</style>
    </div>
  );
}
