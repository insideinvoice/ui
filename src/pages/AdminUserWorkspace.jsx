import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminAPI } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  ArrowLeft, Users, Building2, FileText, UserCheck, IndianRupee,
  Calendar, Trash2, ExternalLink, Shield,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

import { getCache, setCache } from "../utils/cache";
import { formatAxisMoney } from "../utils/chartFormat";

const CACHE_TTL = 5 * 60 * 1000;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (v) => `₹ ${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_CLASS = {
  PAID: "bg-emerald-100 text-emerald-700",
  SENT: "bg-blue-100 text-blue-700",
  PENDING: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  DRAFT: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const fmtDate = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg bg-slate-200 animate-pulse" />
        <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="h-5 w-20 bg-slate-200 rounded animate-pulse" />
    </div>
  );
}

/**
 * Per-user admin workspace (/admin/users/:id): everything about one user's
 * business — identity, business profile, invoices, customers, products,
 * sales trend and last-30-days revenue — plus the admin's operating powers
 * (open/edit/download any invoice, delete invoices & customers). All data
 * goes through the tenant-scoped admin endpoints, so nothing shown can be
 * modified that could not be by the merchant themselves (except the delete
 * overrides, which reuse the same business rules).
 */
export default function AdminUserWorkspace() {
  const { user: me, isAdmin } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();

  const [targetUser, setTargetUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("invoices");

  useEffect(() => {
    if (!isAdmin) navigate("/dashboard", { replace: true });
  }, [isAdmin, navigate]);

  const cacheKey = `admin-user-ws:${me?.userId ?? me?.id}:${userId}`;
  const [cached] = useState(() => getCache(cacheKey, CACHE_TTL));
  const hydrate = useCallback((data) => {
    setTargetUser(data.targetUser ?? null);
    setBusiness(data.business ?? null);
    setInvoices(data.invoices ?? []);
    setCustomers(data.customers ?? []);
    setProducts(data.products ?? []);
  }, []);

  useEffect(() => {
    if (cached?.fresh && cached?.data) {
      hydrate(cached.data);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersRes, bizRes] = await Promise.all([
          adminAPI.getAllUsers(),
          adminAPI.getAllBusinesses(),
        ]);
        const unwrap = (d) => (Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : []);
        const foundUser = unwrap(usersRes.data.data).find((u) => String(u.id) === String(userId));
        if (!foundUser) {
          if (!cancelled) setError("User not found — the account may have been deleted.");
          return;
        }
        const foundBusiness = unwrap(bizRes.data.data).find((b) => String(b.id) === String(foundUser.businessId)) ?? null;
        if (!foundBusiness) {
          if (!cancelled) {
            setError("This user has no business workspace yet (setup incomplete).");
            setTargetUser(foundUser);
          }
          return;
        }
        const [invRes, custRes, prodRes] = await Promise.all([
          adminAPI.getBusinessInvoices(foundBusiness.id),
          adminAPI.getBusinessCustomers(foundBusiness.id),
          adminAPI.getBusinessProducts(foundBusiness.id),
        ]);
        const data = {
          targetUser: foundUser,
          business: foundBusiness,
          invoices: unwrap(invRes.data.data),
          customers: unwrap(custRes.data.data),
          products: unwrap(prodRes.data.data),
        };
        if (!cancelled) {
          hydrate(data);
          setCache(cacheKey, data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Workspace load failed:", err.response?.status, err.message);
          setError(err.response?.data?.message || "Failed to load the workspace. Try Refresh.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [userId, cacheKey, cached, hydrate]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!targetUser) {
        navigate(0);
        return;
      }
      const [invRes, custRes, prodRes] = await Promise.all([
        adminAPI.getBusinessInvoices(business.id),
        adminAPI.getBusinessCustomers(business.id),
        adminAPI.getBusinessProducts(business.id),
      ]);
      const unwrap = (d) => (Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : []);
      const data = {
        targetUser,
        business,
        invoices: unwrap(invRes.data.data),
        customers: unwrap(custRes.data.data),
        products: unwrap(prodRes.data.data),
      };
      hydrate(data);
      setCache(cacheKey, data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, [targetUser, business, cacheKey, hydrate, navigate]);

  // ---------------- sales analytics for this user's business ----------------

  const sales = useMemo(() => {
    const billable = (invoices ?? []).filter((inv) => inv.status !== "DRAFT" && inv.status !== "CANCELLED");
    const total = round2(billable.reduce((s, inv) => s + (parseFloat(inv.grandTotal) || 0), 0));

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 29);
    cutoff.setHours(0, 0, 0, 0);
    let last30 = 0;
    const daily = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(cutoff);
      d.setDate(cutoff.getDate() + i);
      daily[d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })] = 0;
    }
    billable.forEach((inv) => {
      const d = new Date(inv.invoiceDate);
      if (Number.isNaN(d.getTime())) return;
      if (d >= cutoff) {
        last30 += parseFloat(inv.grandTotal) || 0;
        const key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        if (key in daily) daily[key] = round2(daily[key] + (parseFloat(inv.grandTotal) || 0));
      }
    });

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const byMonth = {};
    billable.forEach((inv) => {
      const d = new Date(inv.invoiceDate);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = round2((byMonth[key] || 0) + (parseFloat(inv.grandTotal) || 0));
    });
    const trend = Object.keys(byMonth).sort().map((k) => ({
      month: `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`,
      sales: byMonth[k],
    }));

    return { total, last30: round2(last30), dailyTrend: Object.entries(daily).map(([day, value]) => ({ day, value })), monthlyTrend: trend };
  }, [invoices]);

  const counts = useMemo(() => ({
    invoices: (invoices ?? []).length,
    customers: (customers ?? []).length,
    products: (products ?? []).length,
  }), [invoices, customers, products]);

  // ---------------- admin actions ----------------

  const handleDeleteInvoice = useCallback(async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoiceNumber}? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteInvoiceAsAdmin(inv.id);
      toast.success(`Invoice ${inv.invoiceNumber} deleted`);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  }, [refresh]);

  const handleDeleteCustomer = useCallback(async (c) => {
    if (!window.confirm(`Delete customer "${c.name}"? Their invoices must be deleted first.`)) return;
    try {
      await adminAPI.deleteCustomerAsAdmin(c.id);
      toast.success(`Customer ${c.name} deleted`);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  }, [refresh]);

  // ---------------- render ----------------

  if (loading && !targetUser) {
    return (
      <div className="min-h-[100dvh] bg-slate-50">
        <div className="px-3 sm:px-4 lg:px-6 max-w-[1900px] mx-auto">
          <div className="py-4 sm:py-6">
            <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              {[0, 1, 2, 3, 4].map((i) => <StatSkeleton key={i} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50">

      <div className="px-3 sm:px-4 lg:px-6 max-w-[1900px] mx-auto">
        <main className="py-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <button onClick={() => navigate("/admin/users-list")}
              className="w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{targetUser?.name || "User workspace"}</h1>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${targetUser?.role === "ADMIN" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                  {targetUser?.role}
                </span>
              </div>
              <p className="text-slate-500 text-xs truncate">{targetUser?.email || targetUser?.username} · joined {fmtDate(targetUser?.createdAt)}</p>
            </div>
            <button onClick={refresh} disabled={loading}
              className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-white border border-slate-200 rounded-lg px-3 py-2 disabled:opacity-50 shadow-sm">
              Refresh
            </button>
          </div>

          {error ? (
            <div className="bg-white rounded-xl border border-amber-200 p-6 text-center shadow-sm">
              <Shield className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">{error}</p>
              {targetUser && <p className="text-xs text-slate-500 mt-1">{targetUser.email} · {targetUser.role}</p>}
              <button onClick={() => navigate("/admin/users-list")} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Back to users</button>
            </div>
          ) : (
            <>
              {/* Business identity card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-slate-600" />
                  <h2 className="text-sm font-semibold text-slate-900">{business?.businessName}</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  {[
                    ["Owner", business?.ownerName],
                    ["Phone", business?.phone],
                    ["GSTIN", business?.gstIn],
                    ["Invoice prefix", business?.invoicePrefix],
                    ["Since", fmtDate(business?.createdAt)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
                      <div className="text-slate-700 font-medium truncate">{value || "-"}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-4">
                {[
                  { label: "Invoices", value: counts.invoices, icon: FileText, gradient: "from-blue-500 to-blue-600" },
                  { label: "Customers", value: counts.customers, icon: UserCheck, gradient: "from-indigo-500 to-indigo-600" },
                  { label: "Products", value: counts.products, icon: Building2, gradient: "from-violet-500 to-violet-600" },
                  { label: "Last 30 days", value: `₹ ${sales.last30.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: Calendar, gradient: "from-amber-500 to-amber-600" },
                  { label: "All-time billed", value: `₹ ${sales.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: IndianRupee, gradient: "from-emerald-500 to-emerald-600" },
                ].map((card) => (
                  <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                        <card.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
                    </div>
                    <div className="text-base sm:text-lg font-bold text-slate-900 truncate">{card.value}</div>
                  </div>
                ))}
              </div>

              {/* Sales trend + last 30 days */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 mb-4">
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <IndianRupee className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-semibold text-slate-900">Sales Trend</h2>
                    <span className="ml-auto text-[10px] text-slate-400">Billed per month · excl. drafts</span>
                  </div>
                  {sales.monthlyTrend.length > 0 ? (
                    <div className="h-44 sm:h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sales.monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
                          <YAxis width={70} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={formatAxisMoney} />
                          <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "11px" }} />
                          <Line type="monotone" dataKey="sales" name="Billed (₹)" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-12">No billed invoices yet</p>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-semibold text-slate-900">Last 30 Days</h2>
                    <span className="ml-auto text-[10px] text-slate-400">{money(sales.last30).replace(".00", "")} total</span>
                  </div>
                  {sales.last30 > 0 ? (
                    <div className="h-44 sm:h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sales.dailyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#64748b" }} interval={4} />
                          <YAxis width={70} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={formatAxisMoney} />
                          <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "11px" }} cursor={{ fill: "#f8fafc" }} />
                          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={24} name="Billed (₹)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-12">No sales in the last 30 days</p>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 mb-3 overflow-x-auto">
                {[
                  { key: "invoices", label: `Invoices (${counts.invoices})`, icon: FileText },
                  { key: "customers", label: `Customers (${counts.customers})`, icon: Users },
                  { key: "products", label: `Products (${counts.products})`, icon: Building2 },
                ].map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${tab === t.key ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "invoices" && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {loading && !invoices ? (
                    <p className="text-xs text-slate-400 text-center py-10">Loading…</p>
                  ) : (invoices ?? []).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-10">No invoices for this business</p>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-slate-500 uppercase">Invoice #</th>
                              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-slate-500 uppercase">Date</th>
                              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-slate-500 uppercase">Customer</th>
                              <th className="text-left py-2.5 px-4 text-[10px] font-medium text-slate-500 uppercase">Status</th>
                              <th className="text-right py-2.5 px-4 text-[10px] font-medium text-slate-500 uppercase">Amount</th>
                              <th className="text-right py-2.5 px-4 text-[10px] font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.map((inv) => (
                              <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-4 font-semibold text-slate-800">{inv.invoiceNumber}</td>
                                <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                                <td className="py-2.5 px-4 text-slate-600 max-w-[180px] truncate">{inv.customerName || "-"}</td>
                                <td className="py-2.5 px-4">
                                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_CLASS[inv.status] || "bg-slate-100 text-slate-500"}`}>{inv.status}</span>
                                </td>
                                <td className="py-2.5 px-4 text-right text-slate-800 font-mono whitespace-nowrap">₹{Number(inv.grandTotal).toLocaleString("en-IN")}</td>
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button onClick={() => navigate(`/admin/invoices/${inv.id}`)}
                                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors" title="Open (view / edit / download)">
                                      <ExternalLink className="w-3.5 h-3.5" /> Open
                                    </button>
                                    <button onClick={() => handleDeleteInvoice(inv)}
                                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title="Delete invoice">
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile cards */}
                      <div className="md:hidden divide-y divide-slate-100">
                        {invoices.map((inv) => (
                          <div key={inv.id} className="p-3.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-800">{inv.invoiceNumber}</span>
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_CLASS[inv.status] || "bg-slate-100 text-slate-500"}`}>{inv.status}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mb-2">{inv.customerName || "-"} · {fmtDate(inv.invoiceDate)} · ₹{Number(inv.grandTotal).toLocaleString("en-IN")}</div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => navigate(`/admin/invoices/${inv.id}`)}
                                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-semibold">
                                <ExternalLink className="w-3 h-3" /> Open
                              </button>
                              <button onClick={() => handleDeleteInvoice(inv)}
                                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-semibold">
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === "customers" && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {(customers ?? []).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-10">No customers for this business</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {customers.map((c) => (
                        <div key={c.id} className="p-3.5 md:flex md:items-center md:gap-3 md:border-b md:border-slate-100">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-800">{c.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{c.phone || "-"} · {c.email || "-"} · {c.city || "-"}</div>
                          </div>
                          <button onClick={() => handleDeleteCustomer(c)}
                            className="mt-2 md:mt-0 flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 font-semibold">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "products" && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {(products ?? []).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-10">No products for this business</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {products.map((p) => (
                        <div key={p.id} className="p-3.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-400">HSN {p.hsn || "-"} · GST {Number(p.gstPercentage || 0)}%</div>
                          </div>
                          <div className="text-xs text-slate-700 font-mono shrink-0">₹{Number(p.rate || 0).toLocaleString("en-IN")}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
