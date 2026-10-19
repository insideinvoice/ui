import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import {
  Shield, Users, Building2, FileText, UserCheck, Package, IndianRupee,
  RefreshCw, Search, ArrowRight,
} from "lucide-react";

import AppNavbar from "../components/AppNavbar";
import { getCache, setCache } from "../utils/cache";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Status pills — same language as AdminInvoicesList (PAID green, SENT blue…).
const STATUS_CLASS = {
  PAID: "bg-emerald-100 text-emerald-700",
  SENT: "bg-blue-100 text-blue-700",
  PENDING: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  DRAFT: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-slate-100 text-slate-500",
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

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const cacheKey = `admin-console:${user?.userId ?? user?.id ?? "anon"}`;
  const [cached] = useState(() => getCache(cacheKey, CACHE_TTL));

  const [stats, setStats] = useState(cached?.data?.stats ?? null);
  const [users, setUsers] = useState(cached?.data?.users ?? []);
  const [businesses, setBusinesses] = useState(cached?.data?.businesses ?? []);
  const [invoices, setInvoices] = useState(cached?.data?.invoices ?? []);
  const [loading, setLoading] = useState(!cached);

  // Superuser console: business-role users never land here.
  useEffect(() => {
    if (!isAdmin) navigate("/dashboard", { replace: true });
  }, [isAdmin, navigate]);

  const load = useCallback(async (force = false) => {
    if (!force && getCache(cacheKey, CACHE_TTL)?.fresh) return;
    setLoading(true);
    try {
      const [statsRes, usersRes, bizRes, invRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getAllUsers(),
        adminAPI.getAllBusinesses(),
        adminAPI.getAllInvoices(),
      ]);
      const unwrap = (d) => (Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : []);
      setStats(statsRes.data.data);
      setUsers(unwrap(usersRes.data.data));
      setBusinesses(unwrap(bizRes.data.data));
      setInvoices(unwrap(invRes.data.data));
    } catch (err) {
      console.error("Admin console fetch failed:", err.response?.status, err.message);
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (cached?.fresh && cached?.data) {
      setLoading(false);
      return;
    }
    load();
  }, [cached, load]);

  const hadFreshCache = Boolean(cached?.fresh);
  // Debounced persist — same pattern as Dashboard (burst-safe on big lists).
  useEffect(() => {
    if (hadFreshCache || loading) return undefined;
    if (!stats && invoices.length === 0) return undefined;
    const timer = setTimeout(() => {
      setCache(cacheKey, { stats, users, businesses, invoices });
    }, 400);
    return () => clearTimeout(timer);
  }, [stats, users, businesses, invoices, loading, cacheKey, hadFreshCache]);

  // Billed value across the platform (drafts/cancelled excluded) for the KPI card.
  const platformSales = useMemo(() => round2(
    invoices
      .filter((inv) => inv.status !== "DRAFT" && inv.status !== "CANCELLED")
      .reduce((s, inv) => s + (parseFloat(inv.grandTotal) || 0), 0)
  ), [invoices]);

  const kpiLoading = loading && !stats;

  const kpis = [
    { label: "Users", value: Number(stats?.totalUsers) || 0, icon: Users, gradient: "from-indigo-500 to-indigo-600", path: "/admin/users-list" },
    { label: "Businesses", value: Number(stats?.totalBusinesses) || 0, icon: Building2, gradient: "from-amber-500 to-amber-600", path: "/admin/businesses" },
    { label: "Customers", value: Number(stats?.totalCustomers) || 0, icon: UserCheck, gradient: "from-emerald-500 to-emerald-600", path: "/admin/customers" },
    { label: "Invoices", value: Number(stats?.totalInvoices) || 0, icon: FileText, gradient: "from-blue-500 to-blue-600", path: "/admin/invoices" },
    { label: "Products", value: Number(stats?.totalProducts) || 0, icon: Package, gradient: "from-violet-500 to-violet-600", path: "/admin/products" },
    { label: "Platform Sales", value: `₹ ${platformSales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: IndianRupee, gradient: "from-teal-500 to-teal-600", path: "/admin/invoices" },
  ];

  // ---------------- global search ----------------
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const has = (s) => String(s || "").toLowerCase().includes(q);
    return {
      users: users.filter((u) => has(u.name) || has(u.email) || has(u.username)).slice(0, 5),
      businesses: businesses.filter((b) => has(b.businessName) || has(b.ownerName)).slice(0, 5),
      invoices: invoices.filter((inv) => has(inv.invoiceNumber) || has(inv.customerName) || has(inv.businessName)).slice(0, 5),
    };
  }, [query, users, businesses, invoices]);

  const fmtDate = (s) => {
    if (!s) return "-";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // Recent signups and search results deep-link into each user's workspace;
  // the "Users" KPI card still goes to the full list.

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <AppNavbar />

      <div className="px-3 sm:px-4 lg:px-6 max-w-[1900px] mx-auto">
        <main className="py-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Admin Console</h1>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                Platform-wide overview — {user?.name || "admin"}
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={loading}
              title="Refresh data"
              className="shrink-0 flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-300 active:scale-[0.97] transition-all disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Global search across users / businesses / invoices */}
          <div className="relative mb-4 sm:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users, businesses or invoices…"
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm"
              />
            </div>
            {results && (
              <div className="absolute left-0 right-0 mt-2 z-30 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                {results.users.length === 0 && results.businesses.length === 0 && results.invoices.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No matches for “{query.trim()}”</p>
                ) : (
                  <>
                    {results.users.length > 0 && (
                      <div className="py-1 border-b border-slate-100">
                        <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Users</div>
                        {results.users.map((u) => (
                          <button key={`u-${u.id}`} onClick={() => { setQuery(""); navigate(`/admin/users/${u.id}`); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left">
                            <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                              {String(u.name || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-800 truncate">{u.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{u.email || u.username}</div>
                            </div>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${u.role === "ADMIN" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                              {u.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {results.businesses.length > 0 && (
                      <div className={`py-1 ${results.users.length > 0 ? "border-b border-slate-100" : "border-b border-slate-100"}`}>
                        <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Businesses</div>
                        {results.businesses.map((b) => (
                          <button key={`b-${b.id}`} onClick={() => { setQuery(""); navigate(`/admin/businesses/${b.id}/invoices`); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left">
                            <div className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                              <Building2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-800 truncate">{b.businessName}</div>
                              <div className="text-[10px] text-slate-400 truncate">Owner: {b.ownerName || "-"}</div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                    {results.invoices.length > 0 && (
                      <div className="py-1">
                        <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoices</div>
                        {results.invoices.map((inv) => (
                          <button key={`i-${inv.id}`} onClick={() => { setQuery(""); navigate(`/admin/invoices/${inv.id}`); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left">
                            <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-800 truncate">{inv.invoiceNumber}</div>
                              <div className="text-[10px] text-slate-400 truncate">{inv.businessName} · {inv.customerName}</div>
                            </div>
                            <span className="text-xs text-slate-600 font-mono shrink-0">₹{Number(inv.grandTotal).toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Platform KPIs — every card drills into its list */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {kpiLoading
              ? [0, 1, 2, 3, 4, 5].map((i) => <StatSkeleton key={i} />)
              : kpis.map((card) => (
                <div key={card.label} onClick={() => navigate(card.path)}
                  className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm cursor-pointer active:scale-[0.97] transition-all hover:shadow-md">
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

          {/* Recent activity */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Recent invoices */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">Recent Invoices</h2>
                <button onClick={() => navigate("/admin/invoices")} className="ml-auto text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
              </div>
              {invoices.length > 0 ? invoices.slice(0, 6).map((inv, idx, arr) => (
                <button key={inv.id} onClick={() => navigate(`/admin/invoices/${inv.id}`)}
                  className={`w-full flex items-center gap-3 py-2.5 px-2 -mx-1 rounded-lg hover:bg-slate-50 transition-colors text-left ${idx < arr.length - 1 ? "border-b border-slate-50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 truncate">{inv.invoiceNumber}</div>
                    <div className="text-[10px] text-slate-400 truncate">{inv.businessName} · {inv.customerName} · {fmtDate(inv.invoiceDate)}</div>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_CLASS[inv.status] || "bg-slate-100 text-slate-500"}`}>{inv.status}</span>
                  <span className="text-xs text-slate-700 font-mono shrink-0">₹{Number(inv.grandTotal).toLocaleString("en-IN")}</span>
                </button>
              )) : (
                <p className="text-xs text-slate-400 text-center py-8">No invoices yet</p>
              )}
            </div>

            {/* Recent signups */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-semibold text-slate-900">Recent Signups</h2>
                <button onClick={() => navigate("/admin/users-list")} className="ml-auto text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
              </div>
              {(stats?.recentUsers?.length ? stats.recentUsers : [...users].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 6)).slice(0, 6).map((u, idx, arr) => (
                <button key={`ru-${u.id}-${idx}`} onClick={() => navigate(`/admin/users/${u.id}`)} title="Open user workspace"
                  className={`w-full flex items-center gap-3 py-2.5 px-2 -mx-1 rounded-lg hover:bg-slate-50 transition-colors text-left ${idx < arr.length - 1 ? "border-b border-slate-50" : ""}`}>
                  <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                    {String(u.name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 truncate">{u.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{u.email || u.username} · joined {fmtDate(u.createdAt)}</div>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${u.role === "ADMIN" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Businesses */}
          {businesses.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-slate-600" />
                <h2 className="text-sm font-semibold text-slate-900">Businesses</h2>
                <span className="text-[10px] text-slate-400">({businesses.length})</span>
                <button onClick={() => navigate("/admin/businesses")} className="ml-auto text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {businesses.slice(0, 8).map((b) => (
                  <div key={b.id} onClick={() => navigate(`/admin/businesses/${b.id}/invoices`)}
                    className="bg-slate-50 rounded-lg p-3 active:bg-slate-100 transition-colors">
                    <div className="text-xs font-semibold text-slate-800 mb-0.5">{b.businessName}</div>
                    <div className="text-[10px] text-slate-500">{b.ownerName || "-"} · {b.phone || "-"}</div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-slate-500 uppercase">Business</th>
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-slate-500 uppercase">Owner</th>
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-slate-500 uppercase">Phone</th>
                      <th className="text-left py-2 px-3 text-[10px] font-medium text-slate-500 uppercase">GSTIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map((b, i) => (
                      <tr key={b.id} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 1 ? "bg-slate-50/50" : ""}`}>
                        <td className="py-2 px-3 font-medium">
                          <button onClick={() => navigate(`/admin/businesses/${b.id}/invoices`)}
                            className="text-slate-800 hover:text-indigo-600 hover:underline">{b.businessName}</button>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{b.ownerName || "-"}</td>
                        <td className="py-2 px-3 text-slate-600">{b.phone || "-"}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{b.gstIn || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
