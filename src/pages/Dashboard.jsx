import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { adminAPI, invoiceAPI, customerAPI } from "../api/auth";
import { FileText, Users, Package, Building2, PlusCircle, List, BarChart3, DollarSign, TrendingUp, Calendar, UserPlus, UserCheck, IndianRupee, TriangleAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

import { getCache, setCache } from "../utils/cache";
import { formatAxisMoney } from "../utils/chartFormat";

const PAYMENT_COLORS = { UPI: "#6366f1", CASH: "#10b981", CARD: "#f59e0b", CHEQUE: "#8b5cf6", NEFT: "#3b82f6", IMPS: "#ec4899", OTHER: "#94a3b8" };
const STATUS_COLORS = { PAID: "#10b981", PENDING: "#f59e0b", SENT: "#3b82f6", OVERDUE: "#ef4444", DRAFT: "#94a3b8", CANCELLED: "#64748b" };

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (v) => `₹ ${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// "1 invoice generated" / "3 invoices generated" — counts must not pluralize at 1.
const plural = (n, word) => `${Number(n) || 0} ${word}${Number(n) === 1 ? "" : "s"}`;

// Placeholder chart shaped like a bar chart so the layout doesn't jump when data lands
function ChartSkeleton({ small = false }) {
  return (
    <div className={`w-full ${small ? "h-40 sm:h-48" : "h-44 sm:h-56"} animate-pulse`} aria-hidden="true">
      <div className="h-full flex items-end gap-2 sm:gap-3 px-2 pb-5">
        {[38, 62, 45, 78, 55, 90, 68].map((h, i) => (
          <div key={i} className="flex-1 bg-slate-200 rounded-t-md" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

// Placeholder stat card matching the real card's layout
function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg bg-slate-200 animate-pulse" />
        <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="h-5 w-24 bg-slate-200 rounded animate-pulse" />
    </div>
  );
}

export default function Dashboard() {
  const { user, isBusinessSetupComplete, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Storage-backed cache: renders instantly from localStorage, revalidates in background
  // "v4": platform charts switched from a full invoice download to the
  // sales-analytics endpoint — invalidate v3 (and older) caches once.
  const cacheKey = `dashboard-v4:${user?.userId ?? user?.id ?? "anon"}:${isAdmin ? "admin" : "user"}`;
  const [cached] = useState(() => getCache(cacheKey, CACHE_TTL));

  const [stats, setStats] = useState(cached?.data?.stats ?? null);
  const [invoices, setInvoices] = useState(cached?.data?.invoices ?? []);
  // Admin platform aggregates (GET /admin/sales-analytics) — SQL-side now;
  // merchants never receive platform data (isolation preserved).
  const [salesAnalytics, setSalesAnalytics] = useState(cached?.data?.salesAnalytics ?? null);
  const [customerCount, setCustomerCount] = useState(cached?.data?.customerCount ?? 0);
  const [loadingStats, setLoadingStats] = useState(!cached);
  const [loadingInvoices, setLoadingInvoices] = useState(!cached);
  const [loadingAll, setLoadingAll] = useState(!cached);
  const [loadingCustomers, setLoadingCustomers] = useState(!cached && !isAdmin);
  // True when any dashboard loader failed. Failures used to be silent and
  // even got cached — a confident dashboard full of zeros. Now it surfaces
  // a slim retry banner above the cards instead.
  const [dataError, setDataError] = useState(false);

  // Redirect if business setup not complete
  useEffect(() => {
    if (!isBusinessSetupComplete && !isAdmin) {
      navigate("/business-setup");
    }
  }, [isBusinessSetupComplete, navigate, isAdmin]);

  // Fetch admin data: KPI stats + the platform-wide sales aggregates that power
  // the admin-only "All ..." charts. (Merchants never get either — isolation.)
  const fetchAdminData = useCallback(async () => {
    setLoadingStats(true);
    setLoadingAll(true);
    setDataError(false);
    const [statsRes, anRes] = await Promise.allSettled([adminAPI.getStats(), adminAPI.getSalesAnalytics()]);
    if (statsRes.status === "fulfilled") {
      setStats(statsRes.value.data.data);
    } else {
      console.error("Admin stats fetch failed:", statsRes.reason?.response?.status, statsRes.reason?.message);
      setDataError(true);
    }
    setLoadingStats(false);
    if (anRes.status === "fulfilled") {
      setSalesAnalytics(anRes.value.data?.data ?? null);
    } else {
      console.error("Admin sales analytics fetch failed:", anRes.reason?.response?.status, anRes.reason?.message);
      setDataError(true);
    }
    setLoadingAll(false);
  }, []);

  // Fetch customer count for non-admin
  const fetchCustomerCount = useCallback(async () => {
    setLoadingCustomers(true);
    setDataError(false);
    try {
      const res = await customerAPI.getAll({ size: 1000 });
      const raw = res.data?.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.content) ? raw.content : [];
      setCustomerCount(list.length);
    } catch {
      setDataError(true);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  // Fetch invoices — ALWAYS the authenticated user's own business (JWT-scoped).
  // For the admin this means THEIR OWN store's sales/earnings, not the platform
  // total: platform-wide views live in /admin and the admin-only KPI/graphs.
  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    setDataError(false);
    try {
      const res = await invoiceAPI.getAll({ size: 1000 });
      const raw = res.data?.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.content) ? raw.content : [];
      setInvoices(list);
    } catch {
      setDataError(true);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  // Re-run every loader for the current role — the mount effect's cold path
  // and the failure banner's Retry button share this one entry point.
  const retryData = useCallback(() => {
    setDataError(false);
    if (isAdmin) fetchAdminData();
    else fetchCustomerCount();
    fetchInvoices();
  }, [isAdmin, fetchAdminData, fetchCustomerCount, fetchInvoices]);

  // Main data loading effect — skip network only when storage cache is fresh
  useEffect(() => {
    if (cached?.fresh && cached?.data) {
      // Fresh cache hit: charts already rendered from storage, no fetch needed
      setLoadingStats(false);
      setLoadingInvoices(false);
      setLoadingCustomers(false);
      return;
    }

    // Cache miss or stale: fetch fresh data (stale data stays visible meanwhile)
    retryData();
  }, [isAdmin, cached, retryData]);
  // Persist to storage whenever data changes — debounced so a burst of state
  // updates doesn't JSON.stringify up to 1000 invoices on the main thread while
  // the charts are painting, and skipped on a fresh-cache mount where the load
  // effect fetches nothing (nothing has actually changed to persist).
  const hadFreshCache = Boolean(cached?.fresh);
  useEffect(() => {
    if (hadFreshCache || loadingStats || loadingInvoices) return undefined;
    // Never persist a failed load: the next visit would "look fresh" while
    // showing half-zeros for the whole TTL.
    if (dataError) return undefined;
    if (!stats && invoices.length === 0) return undefined;
    const timer = setTimeout(() => {
      setCache(cacheKey, { stats, invoices, customerCount, salesAnalytics });
    }, 400);
    return () => clearTimeout(timer);
  }, [stats, invoices, customerCount, salesAnalytics, loadingStats, loadingInvoices, cacheKey, hadFreshCache, dataError]);

  const buildInvoiceAnalytics = (valid) => {
    const totalGrand = round2(valid.reduce((s, inv) => s + (parseFloat(inv.grandTotal) || 0), 0));

    const salesByMonth = {};
    const salesByPayment = {};
    const last7 = {};
    const countByMonth = {};
    const today = new Date();
    // Midnight-normalized window: invoiceDates carry a time-of-day, so a
    // time-window from "now minus 6 days" silently dropped every early-morning
    // invoice from the oldest day once "now" passed that time. Calendar days,
    // not clock hours.
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    valid.forEach((inv) => {
      const d = new Date(inv.invoiceDate);
      const monthKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const amt = parseFloat(inv.grandTotal) || 0;

      salesByMonth[monthKey] = round2((salesByMonth[monthKey] || 0) + amt);
      countByMonth[monthKey] = (countByMonth[monthKey] || 0) + 1;

      const pm = inv.paymentMode || "OTHER";
      salesByPayment[pm] = round2((salesByPayment[pm] || 0) + amt);

      if (d.getTime() >= sevenDaysAgo.getTime() && d.getTime() <= today.getTime()) {
        const dayKey = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        // Year-safe sort stamp (YYYYMMDD): the label alone ("5 Jan") sorts
        // wrong when the 7-day window straddles New Year.
        const stamp = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        last7[dayKey] = { sales: round2(((last7[dayKey]?.sales) || 0) + amt), stamp };
      }
    });

    const months = Object.keys(salesByMonth).sort((a, b) => {
      const [mA, yA] = a.split(" ");
      const [mB, yB] = b.split(" ");
      return yA !== yB ? yA - yB : monthNames.indexOf(mA) - monthNames.indexOf(mB);
    });

    // The current calendar month is ALWAYS present (even at ₹0 / 0 invoices)
    // so the "This Month" KPI can never fall back to last month's number.
    const currentMonthKey = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    if (!salesByMonth[currentMonthKey]) {
      salesByMonth[currentMonthKey] = 0;
      countByMonth[currentMonthKey] = 0;
      months.push(currentMonthKey);
    }

    return {
      totalSales: totalGrand,
      salesByMonth: months.map((m) => ({ month: m, sales: salesByMonth[m], count: countByMonth[m] || 0 })),
      last7Days: Object.entries(last7)
        .sort(([, a], [, b]) => a.stamp - b.stamp)
        .map(([day, v]) => ({ day, sales: v.sales })),
      salesByPayment: Object.entries(salesByPayment).map(([mode, amount]) => ({ mode, amount })),
      invoiceCount: valid.length,
    };
  };

  // Own-business analytics → Sales / This Month KPIs (and merchant charts).
  const invoiceAnalytics = useMemo(() => buildInvoiceAnalytics(invoices), [invoices]);
  // Platform-wide analytics (admin only) → the "All ..." charts below the KPIs.
  // Built from the SQL aggregates but shaped EXACTLY like buildInvoiceAnalytics
  // (month labels "Jul 2026", day labels "5 Jul", same totals semantics) so the
  // shared render paths below don't care where the numbers came from.
  const allInvoiceAnalytics = useMemo(() => {
    const empty = { totalSales: 0, salesByMonth: [], last7Days: [], salesByPayment: [], invoiceCount: 0 };
    if (!salesAnalytics) return empty;
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    // Parse "YYYY-MM-DD" in the LOCAL calendar (avoid UTC date shift).
    const fmtDay = (iso) => {
      const [y, m, d] = String(iso).split("T")[0].split("-").map(Number);
      return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    };
    return {
      totalSales: round2(salesAnalytics.totalSales ?? 0),
      salesByMonth: (salesAnalytics.salesByMonth || []).map((m) => ({
        // Full 4-digit year ("Jul 2026") — MUST match the merchant build:
        // handleMonthClick parses everything after the space as the year, and
        // the old `slice(2, 4)` ("26") sent admins to an empty year-0026 list.
        month: `${MONTHS[Number(m.period.slice(5, 7)) - 1]} ${m.period.slice(0, 4)}`,
        sales: round2(m.sales),
        count: m.count,
      })),
      // Mirror the old client build: only days that actually had sales, within
      // the last 7 CALENDAR days (slice first — dailySales30 is a 30-day
      // zero-filled window ending today — then drop empty days so the
      // "No sales in last 7 days" empty state still appears).
      last7Days: (salesAnalytics.dailySales30 || [])
        .slice(-7)
        .filter((d) => (parseFloat(d.sales) || 0) > 0)
        .map((d) => ({ day: fmtDay(d.date), sales: round2(d.sales) })),
      salesByPayment: (salesAnalytics.salesByPayment || []).map((p) => ({ mode: p.mode, amount: round2(p.sales) })),
      invoiceCount: salesAnalytics.invoiceCount ?? 0,
    };
  }, [salesAnalytics]);
  const chartAnalytics = isAdmin ? allInvoiceAnalytics : invoiceAnalytics;
  const chartsLoading = isAdmin
    ? (loadingAll && !salesAnalytics)
    : (loadingInvoices && invoices.length === 0);

  // Current calendar-month figures for the "This Month" KPI (₹ + invoice count).
  const thisMonth = invoiceAnalytics.salesByMonth.length > 0
    ? invoiceAnalytics.salesByMonth[invoiceAnalytics.salesByMonth.length - 1]
    : null;
  const thisMonthSales = thisMonth?.sales || 0;
  const thisMonthCount = thisMonth?.count || 0;

  const statsLoading =
    (loadingInvoices && invoices.length === 0) ||
    (!isAdmin && loadingCustomers && !customerCount) ||
    (isAdmin && loadingStats && !stats);

  const monthLabel = (ym) => {
    const dt = new Date(`${ym}-01T00:00:00`);
    return `${dt.toLocaleString("en", { month: "short" })} '${ym.slice(2, 4)}`;
  };

  // Admin chart series — ALWAYS full-length (flat zero when the backend has no
  // data yet) so the axes, day/month labels and Y tick values render even when
  // there is literally nothing to plot, instead of an empty gray box.
  const activitySeries = useMemo(() => {
    if (stats?.dailyActivity?.length) {
      return stats.dailyActivity.map((d) => ({ ...d, day: d.date.slice(5) }));
    }
    const out = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - i);
      // Local-calendar ISO (toISOString() is UTC — near midnight IST the
      // "today" bucket shifted to yesterday).
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      out.push({ date: iso, day: iso.slice(5), invoices: 0, activeUsers: 0 });
    }
    return out;
  }, [stats?.dailyActivity]);

  const newUsersSeries = useMemo(() => {
    if (stats?.newUsersByMonth?.length) {
      return stats.newUsersByMonth.map((m) => ({ ...m, label: monthLabel(m.month) }));
    }
    const out = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      out.push({ month: ym, label: monthLabel(ym), count: 0 });
    }
    return out;
  }, [stats?.newUsersByMonth]);

  const ownInvoicesSeries = useMemo(() => {
    if (stats?.ownInvoicesByMonth?.length) {
      return stats.ownInvoicesByMonth.map((m) => ({ ...m, label: monthLabel(m.month) }));
    }
    const out = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      out.push({ month: ym, label: monthLabel(ym), count: 0 });
    }
    return out;
  }, [stats?.ownInvoicesByMonth]);

  const handleMonthClick = (monthKey) => {
    // monthKey format: "Jul 2026" -> navigate to invoices with filter
    const parts = monthKey.split(" ");
    const monthName = parts[0];
    const year = parts[1];
    const monthIndex = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(monthName) + 1;
    if (monthIndex > 0 && year) {
      navigate("/invoices", { state: { month: monthIndex, year: parseInt(year, 10) } });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50">

      <div className="px-3 sm:px-4 lg:px-6 max-w-[1900px] mx-auto">
        <main className="py-2 sm:py-3">
          {/* Welcome — safe against a missing/empty user.name (the old
              optional-chained `charAt().toUpperCase() +` chain rendered
              "Welcome, NaN" when both halves were undefined). */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {user?.name ? `Welcome, ${user.name.charAt(0).toUpperCase()}${user.name.slice(1)}` : "Welcome"}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              {isAdmin ? "Platform overview" : "Manage your invoices & customers"}
            </p>
          </div>

          {/* Failed-load notice with retry — shown only once loading settles */}
          {dataError && !loadingStats && !loadingInvoices && !loadingCustomers && !loadingAll && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
              <TriangleAlert className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="flex-1">Some dashboard data failed to load, so the numbers below may be incomplete.</span>
              <button type="button" onClick={retryData}
                className="shrink-0 rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 font-semibold text-rose-700 transition-colors hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed">
                Retry
              </button>
            </div>
          )}

          {/* Quick Actions - 2x2 grid on mobile, 4-col on desktop for both roles */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6 lg:grid-cols-4">
            {(isAdmin ? [
              { label: "Add User", icon: UserPlus, path: "/admin/users", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", border: "border-emerald-100 hover:border-emerald-200" },
              { label: "All Users", icon: Users, path: "/admin/users-list", iconBg: "bg-indigo-50", iconColor: "text-indigo-600", border: "border-indigo-100 hover:border-indigo-200", count: Number(stats?.totalUsers) || 0 },
              { label: "All Invoices", icon: FileText, path: "/admin/invoices", iconBg: "bg-blue-50", iconColor: "text-blue-600", border: "border-blue-100 hover:border-blue-200", count: allInvoiceAnalytics.invoiceCount },
              { label: "All Businesses", icon: Building2, path: "/admin/businesses", iconBg: "bg-violet-50", iconColor: "text-violet-600", border: "border-violet-100 hover:border-violet-200", count: Number(stats?.totalBusinesses) || 0 },
            ] : [
              { label: "New Invoice", icon: PlusCircle, path: "/invoice", iconBg: "bg-blue-50", iconColor: "text-blue-600", border: "border-blue-100 hover:border-blue-200" },
              { label: "View Invoices", icon: List, path: "/invoices", iconBg: "bg-indigo-50", iconColor: "text-indigo-600", border: "border-indigo-100 hover:border-indigo-200" },
              { label: "Add Customer", icon: Users, path: "/customers/new", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", border: "border-emerald-100 hover:border-emerald-200" },
              { label: "Add Product", icon: Package, path: "/products/new", iconBg: "bg-violet-50", iconColor: "text-violet-600", border: "border-violet-100 hover:border-violet-200" },
            ]).map((card) => (
              <button key={card.label} type="button" onClick={() => navigate(card.path)}
                className={`relative bg-white rounded-xl p-3 sm:p-4 text-left w-full cursor-pointer active:scale-[0.97] transition-all shadow-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-300 ${card.border} hover:shadow-md`}>
                {card.count != null && (
                  <span className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {card.count > 999 ? "999+" : card.count}
                  </span>
                )}
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${card.iconBg} flex items-center justify-center mb-2.5`}>
                  <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.iconColor}`} />
                </div>
                <div className="text-xs sm:text-sm font-semibold text-slate-800">{card.label}</div>
              </button>
            ))}
          </div>

          {/* Stats Row - 2-col on mobile, 4-col on desktop for both roles */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6 lg:grid-cols-4">
            {statsLoading ? (
              Array.from({ length: 4 }, (_, i) => <StatSkeleton key={i} />)
            ) : (
            [
              // Sales = the signed-in user's OWN net sales (₹) + how many
              // invoices they generated in total.
              { label: "Sales", value: `₹ ${invoiceAnalytics.totalSales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: DollarSign, gradient: "from-emerald-500 to-emerald-600", path: "/invoices", sub: `${plural(invoiceAnalytics.invoiceCount, "invoice")} generated` },
              ...(isAdmin
                ? [
                    { label: "This Month", value: `₹ ${thisMonthSales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: Calendar, gradient: "from-amber-500 to-amber-600", path: "/invoices", sub: `${plural(thisMonthCount, "invoice")} this month` },
                    // Total Sales: the ₹ SUM of ALL invoices generated by ALL
                    // users app-wide (the ~230-invoice grand total).
                    { label: "Total Sales", value: `₹ ${allInvoiceAnalytics.totalSales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: IndianRupee, gradient: "from-violet-500 to-violet-600", path: "/admin/invoices", sub: "net sales, all users" },
                    // Platform-wide invoices generated: every invoice from ALL
                    // users/businesses across the app (admin-only view).
                    { label: "Total Invoices Generated", value: allInvoiceAnalytics.invoiceCount, icon: FileText, gradient: "from-blue-500 to-blue-600", path: "/admin/invoices", sub: "by all users" },
                  ]
                : [
                    { label: "Invoices", value: invoiceAnalytics.invoiceCount, icon: FileText, gradient: "from-blue-500 to-blue-600", path: "/invoices" },
                    { label: "Customers", value: customerCount, icon: Users, gradient: "from-indigo-500 to-indigo-600", path: "/customers" },
                    { label: "This Month", value: `₹ ${thisMonthSales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: Calendar, gradient: "from-amber-500 to-amber-600", path: "/invoices", sub: `${plural(thisMonthCount, "invoice")} this month` },
                  ]),
            ].map((stat) => (
              <button key={stat.label} type="button" onClick={() => navigate(stat.path)} className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm cursor-pointer text-left w-full active:scale-[0.97] transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-300">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                    <stat.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 truncate">{stat.value}</div>
                {stat.sub && <div className="text-[10px] text-slate-400 mt-0.5 truncate">{stat.sub}</div>}
              </button>
            ))
            )}
          </div>

          {/* Charts */}
          <div className="space-y-4 sm:space-y-6">
            {/* Last-30-days activity (Admin only): Active Users + Invoices Generated */}
            {isAdmin && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 items-start">
                {/* Active Users: generated at least one invoice that day */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <UserCheck className="w-4 h-4 text-teal-600" />
                    <h2 className="text-sm font-semibold text-slate-900">Active Users</h2>
                    <span className="text-[10px] text-slate-400 ml-auto">who generated an invoice, last 30 days</span>
                  </div>
                  {loadingStats && !stats ? (
                    <ChartSkeleton />
                  ) : (
                    <div className="h-40 sm:h-48">
                      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
                        <BarChart data={activitySeries} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={4} />
                          <YAxis width={30} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} domain={[0, (dataMax) => Math.max(dataMax, 4)]} />
                          <Tooltip formatter={(v, n) => [v, n === "activeUsers" ? "Users" : ""]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} cursor={{ fill: '#f0fdfa' }} />
                          <Bar dataKey="activeUsers" fill="#14b8a6" radius={[3, 3, 0, 0]} maxBarSize={8} name="Users" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Invoices Generated across ALL users, per day, last 30 days */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-semibold text-slate-900">Invoices Generated</h2>
                    <span className="text-[10px] text-slate-400 ml-auto">{Number(stats?.invoicesLast30Days) || 0} in last 30 days</span>
                  </div>
                  {loadingStats && !stats ? (
                    <ChartSkeleton />
                  ) : (
                    <div className="h-40 sm:h-48">
                      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
                        <BarChart data={activitySeries} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={4} />
                          <YAxis width={30} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} domain={[0, (dataMax) => Math.max(dataMax, 4)]} />
                          <Tooltip formatter={(v, n) => [v, n === "invoices" ? "Invoices" : ""]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} cursor={{ fill: '#eef2ff' }} />
                          <Bar dataKey="invoices" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={8} name="Invoices" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Growth (Admin only): New users last 6 months + My invoices last 12 months */}
            {isAdmin && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 items-start">
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <UserPlus className="w-4 h-4 text-violet-600" />
                    <h2 className="text-sm font-semibold text-slate-900">New Users</h2>
                    <span className="text-[10px] text-slate-400 ml-auto">signups, last 6 months</span>
                  </div>
                  {loadingStats && !stats ? (
                    <ChartSkeleton />
                  ) : (
                    <div className="h-40 sm:h-48">
                      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
                        <BarChart data={newUsersSeries} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                          <YAxis width={30} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} domain={[0, (dataMax) => Math.max(dataMax, 4)]} />
                          <Tooltip formatter={(v) => [v, "New users"]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} cursor={{ fill: '#f5f3ff' }} />
                          <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} name="New users" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-semibold text-slate-900">My Invoices</h2>
                    <span className="text-[10px] text-slate-400 ml-auto">your business, last 12 months</span>
                  </div>
                  {loadingStats && !stats ? (
                    <ChartSkeleton />
                  ) : (
                    <div className="h-40 sm:h-48">
                      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
                        <BarChart data={ownInvoicesSeries} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={1} />
                          <YAxis width={30} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} domain={[0, (dataMax) => Math.max(dataMax, 4)]} />
                          <Tooltip formatter={(v) => [v, "Invoices"]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} cursor={{ fill: '#ecfdf5' }} />
                          <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} name="Invoices" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sales trend + last 7 days: side by side on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 items-start">
            {/* Sales vs Months */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900">{isAdmin ? "All Sales Trend" : "Sales Trend"}</h2>
              </div>
              {chartsLoading ? (
                <ChartSkeleton />
              ) : chartAnalytics.salesByMonth.length > 0 ? (
                <div className="h-44 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
                    <LineChart data={chartAnalytics.salesByMonth} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis width={70} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatAxisMoney} />
                      <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                      <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} name="Sales (₹)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-10">No sales data yet</p>
              )}
            </div>

            {/* Last 7 Days */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-semibold text-slate-900">{isAdmin ? "All Last 7 Days" : "Last 7 Days"}</h2>
              </div>
              {chartsLoading ? (
                <ChartSkeleton />
              ) : chartAnalytics.last7Days.length > 0 ? (
                <div className="h-44 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
                    <BarChart data={chartAnalytics.last7Days} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis width={70} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatAxisMoney} />
                      <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} name="Sales (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-10">No sales in last 7 days</p>
              )}
            </div>
            </div>

            {/* Monthly Sales */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900">{isAdmin ? "All Monthly Sales" : "Monthly Sales"}</h2>
                <span className="text-[10px] text-slate-400 ml-auto">Click month to view invoices</span>
              </div>
              {chartsLoading ? (
                <ChartSkeleton />
              ) : chartAnalytics.salesByMonth.length > 0 ? (
                <div className="h-44 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
                    <BarChart data={chartAnalytics.salesByMonth} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis width={70} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatAxisMoney} />
                      <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} name="Sales (₹)" cursor="pointer" onClick={(data) => { const m = data?.month ?? data?.payload?.month ?? data?.activePayload?.[0]?.payload?.month; if (m) handleMonthClick(m); }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-10">No sales data yet</p>
              )}
              {chartAnalytics.salesByMonth.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-1.5 text-[10px] font-semibold text-slate-500 uppercase">Month</th>
                        <th className="text-right py-1.5 text-[10px] font-semibold text-slate-500 uppercase">Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartAnalytics.salesByMonth.slice().reverse().map((row, i) => (
                        <tr key={row.month} onClick={() => handleMonthClick(row.month)}
                          className={`border-b border-slate-50 cursor-pointer transition-colors hover:bg-indigo-50/50 ${i % 2 === 1 ? "bg-slate-50/50" : ""}`}>
                          <td className="py-1.5 font-medium text-slate-700">{row.month}</td>
                          <td className="py-1.5 text-right text-slate-600 font-mono">₹ {row.sales.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
