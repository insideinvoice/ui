import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { adminAPI, invoiceAPI, customerAPI } from "../api/auth";
import { FileText, Users, Package, Building2, PlusCircle, List, BarChart3, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";

import AppNavbar from "../components/AppNavbar";
import { getCache, setCache } from "../utils/cache";

const PAYMENT_COLORS = { UPI: "#6366f1", CASH: "#10b981", CARD: "#f59e0b", CHEQUE: "#8b5cf6", NEFT: "#3b82f6", IMPS: "#ec4899", OTHER: "#94a3b8" };
const STATUS_COLORS = { PAID: "#10b981", PENDING: "#f59e0b", SENT: "#3b82f6", OVERDUE: "#ef4444", DRAFT: "#94a3b8", CANCELLED: "#64748b" };

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (v) => `₹ ${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const cacheKey = `dashboard:${user?.userId ?? user?.id ?? "anon"}:${isAdmin ? "admin" : "user"}`;
  const [cached] = useState(() => getCache(cacheKey, CACHE_TTL));

  const [stats, setStats] = useState(cached?.data?.stats ?? null);
  const [users, setUsers] = useState(cached?.data?.users ?? []);
  const [businesses, setBusinesses] = useState(cached?.data?.businesses ?? []);
  const [analytics, setAnalytics] = useState(cached?.data?.analytics ?? null);
  const [invoices, setInvoices] = useState(cached?.data?.invoices ?? []);
  const [customerCount, setCustomerCount] = useState(cached?.data?.customerCount ?? 0);
  const [loadingStats, setLoadingStats] = useState(!cached);
  const [loadingInvoices, setLoadingInvoices] = useState(!cached);
  const [loadingCustomers, setLoadingCustomers] = useState(!cached && !isAdmin);

  // Redirect if business setup not complete
  useEffect(() => {
    if (!isBusinessSetupComplete && !isAdmin) {
      navigate("/business-setup");
    }
  }, [isBusinessSetupComplete, navigate, isAdmin]);

  // Fetch admin data
  const fetchAdminData = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [statsRes, usersRes, bizRes, analyticsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getAllUsers(),
        adminAPI.getAllBusinesses(),
        adminAPI.getAnalytics(),
      ]);
      const unwrap = (d) => (Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : []);
      const statsData = statsRes.data.data;
      const usersData = unwrap(usersRes.data.data);
      const bizData = unwrap(bizRes.data.data);
      const analyticsData = analyticsRes.data.data;

      setStats(statsData);
      setUsers(usersData);
      setBusinesses(bizData);
      setAnalytics(analyticsData);
    } catch (err) {
      console.error("Admin data fetch failed:", err.response?.status, err.message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch customer count for non-admin
  const fetchCustomerCount = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const res = await customerAPI.getAll({ size: 1000 });
      const raw = res.data?.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.content) ? raw.content : [];
      setCustomerCount(list.length);
    } catch {
      // silent
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const fetch = isAdmin ? adminAPI.getAllInvoices() : invoiceAPI.getAll({ size: 1000 });
      const res = await fetch;
      const raw = res.data?.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.content) ? raw.content : [];
      setInvoices(list);
    } catch {
      // silent
    } finally {
      setLoadingInvoices(false);
    }
  }, [isAdmin]);

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
    if (isAdmin) {
      fetchAdminData();
    } else {
      fetchCustomerCount();
    }
    fetchInvoices();
  }, [isAdmin, cached, fetchAdminData, fetchCustomerCount, fetchInvoices]);

  // Persist to storage whenever data changes — debounced so a burst of state
  // updates doesn't JSON.stringify up to 1000 invoices on the main thread while
  // the charts are painting, and skipped on a fresh-cache mount where the load
  // effect fetches nothing (nothing has actually changed to persist).
  const hadFreshCache = Boolean(cached?.fresh);
  useEffect(() => {
    if (hadFreshCache || loadingStats || loadingInvoices) return undefined;
    if (!stats && invoices.length === 0) return undefined;
    const timer = setTimeout(() => {
      setCache(cacheKey, { stats, users, businesses, analytics, invoices, customerCount });
    }, 400);
    return () => clearTimeout(timer);
  }, [stats, users, businesses, analytics, invoices, customerCount, loadingStats, loadingInvoices, cacheKey, hadFreshCache]);

  const chartData = useMemo(() => {
    return stats ? [
      { name: "Users", value: stats.totalUsers },
      { name: "Businesses", value: stats.totalBusinesses },
      { name: "Invoices", value: stats.totalInvoices },
      { name: "Customers", value: stats.totalCustomers },
      { name: "Products", value: stats.totalProducts },
    ] : [];
  }, [stats]);

  const invoiceAnalytics = useMemo(() => {
    const valid = invoices;
    const totalGrand = round2(valid.reduce((s, inv) => s + (parseFloat(inv.grandTotal) || 0), 0));

    const salesByMonth = {};
    const salesByPayment = {};
    const last7 = {};
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    valid.forEach((inv) => {
      const d = new Date(inv.invoiceDate);
      const monthKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const amt = parseFloat(inv.grandTotal) || 0;

      salesByMonth[monthKey] = round2((salesByMonth[monthKey] || 0) + amt);

      const pm = inv.paymentMode || "OTHER";
      salesByPayment[pm] = round2((salesByPayment[pm] || 0) + amt);

      if (d >= sevenDaysAgo && d <= today) {
        const dayKey = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        last7[dayKey] = round2((last7[dayKey] || 0) + amt);
      }
    });

    const months = Object.keys(salesByMonth).sort((a, b) => {
      const [mA, yA] = a.split(" ");
      const [mB, yB] = b.split(" ");
      return yA !== yB ? yA - yB : monthNames.indexOf(mA) - monthNames.indexOf(mB);
    });

    return {
      totalSales: totalGrand,
      salesByMonth: months.map((m) => ({ month: m, sales: salesByMonth[m] })),
      last7Days: Object.entries(last7).sort((a, b) => {
        const parseDay = (s) => { const [d, m] = s.split(" "); return new Date(`${m} ${d}, ${today.getFullYear()}`); };
        return parseDay(a[0]) - parseDay(b[0]);
      }).map(([day, sales]) => ({ day, sales })),
      salesByPayment: Object.entries(salesByPayment).map(([mode, amount]) => ({ mode, amount })),
      invoiceCount: valid.length,
    };
  }, [invoices]);

  const statsLoading =
    (loadingInvoices && invoices.length === 0) ||
    (!isAdmin && loadingCustomers && !customerCount) ||
    (isAdmin && loadingStats && !stats);

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
      <AppNavbar />

      <div className="px-3 sm:px-4 lg:px-6 max-w-[1900px] mx-auto">
        <main className="py-2 sm:py-3">
          {/* Welcome */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Welcome, {user?.name?.charAt(0).toUpperCase() + user?.name?.slice(1)}</h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              {isAdmin ? "Platform overview" : "Manage your invoices & customers"}
            </p>
          </div>

          {/* Quick Actions - 2x2 grid on mobile, 4-col on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {[
              { label: "New Invoice", icon: PlusCircle, path: "/invoice", iconBg: "bg-blue-50", iconColor: "text-blue-600", border: "border-blue-100 hover:border-blue-200" },
              { label: "View Invoices", icon: List, path: "/invoices", iconBg: "bg-indigo-50", iconColor: "text-indigo-600", border: "border-indigo-100 hover:border-indigo-200" },
              { label: "Add Customer", icon: Users, path: "/customers/new", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", border: "border-emerald-100 hover:border-emerald-200" },
              { label: "Add Product", icon: Package, path: "/products/new", iconBg: "bg-violet-50", iconColor: "text-violet-600", border: "border-violet-100 hover:border-violet-200" },
            ].map((card) => (
              <div key={card.label} onClick={() => navigate(card.path)}
                className={`bg-white rounded-xl p-3 sm:p-4 cursor-pointer active:scale-[0.97] transition-all shadow-sm border ${card.border} hover:shadow-md`}>
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${card.iconBg} flex items-center justify-center mb-2.5`}>
                  <card.icon className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${card.iconColor}`} />
                </div>
                <div className="text-xs sm:text-sm font-semibold text-slate-800">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Stats Row - 2-col grid on mobile, 4-col on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {statsLoading ? (
              [0, 1, 2, 3].map((i) => <StatSkeleton key={i} />)
            ) : (
            [
              { label: "Sales", value: `₹ ${invoiceAnalytics.totalSales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: DollarSign, gradient: "from-emerald-500 to-emerald-600", path: "/invoices" },
              { label: "Invoices", value: invoiceAnalytics.invoiceCount, icon: FileText, gradient: "from-blue-500 to-blue-600", path: "/invoices" },
              { label: "Customers", value: isAdmin ? (stats?.totalCustomers || 0) : customerCount, icon: Users, gradient: "from-indigo-500 to-indigo-600", path: "/customers" },
              { label: "This Month", value: `₹ ${(invoiceAnalytics.salesByMonth.length > 0 ? invoiceAnalytics.salesByMonth[invoiceAnalytics.salesByMonth.length - 1].sales : 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: Calendar, gradient: "from-amber-500 to-amber-600", path: "/invoices" },
            ].map((stat) => (
              <div key={stat.label} onClick={() => navigate(stat.path)} className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm cursor-pointer active:scale-[0.97] transition-all hover:shadow-md">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                    <stat.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 truncate">{stat.value}</div>
              </div>
            ))
            )}
          </div>

          {/* Charts */}
          <div className="space-y-4 sm:space-y-6">
            {/* Sales vs Months */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900">Sales Trend</h2>
              </div>
              {loadingInvoices && invoices.length === 0 ? (
                <ChartSkeleton />
              ) : invoiceAnalytics.salesByMonth.length > 0 ? (
                <div className="h-44 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={invoiceAnalytics.salesByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
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
                <h2 className="text-sm font-semibold text-slate-900">Last 7 Days</h2>
              </div>
              {loadingInvoices && invoices.length === 0 ? (
                <ChartSkeleton />
              ) : invoiceAnalytics.last7Days.length > 0 ? (
                <div className="h-44 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={invoiceAnalytics.last7Days} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} name="Sales (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-10">No sales in last 7 days</p>
              )}
            </div>

            {/* Monthly Sales */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900">Monthly Sales</h2>
                <span className="text-[10px] text-slate-400 ml-auto">Click month to view invoices</span>
              </div>
              {loadingInvoices && invoices.length === 0 ? (
                <ChartSkeleton />
              ) : invoiceAnalytics.salesByMonth.length > 0 ? (
                <div className="h-44 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={invoiceAnalytics.salesByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} name="Sales (₹)" cursor="pointer" onClick={(data, index, event) => { const m = data?.month || data?.activePayload?.[0]?.payload?.month; if (m) handleMonthClick(m); }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-10">No sales data yet</p>
              )}
              {invoiceAnalytics.salesByMonth.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-1.5 text-[10px] font-semibold text-slate-500 uppercase">Month</th>
                        <th className="text-right py-1.5 text-[10px] font-semibold text-slate-500 uppercase">Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceAnalytics.salesByMonth.slice().reverse().map((row, i) => (
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

            {/* Admin sections */}
            {isAdmin && (
              <>
                {/* Admin Stats Grid */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { label: "Users", count: stats?.totalUsers, color: "from-indigo-500 to-indigo-600", path: "/admin/users-list" },
                    { label: "Businesses", count: stats?.totalBusinesses, color: "from-amber-500 to-amber-600", path: "/admin/businesses" },
                    { label: "Invoices", count: stats?.totalInvoices, color: "from-blue-500 to-blue-600", path: "/admin/invoices" },
                    { label: "Customers", count: stats?.totalCustomers, color: "from-emerald-500 to-emerald-600", path: "/admin/customers" },
                    { label: "Active", count: users.length || 0, color: "from-teal-500 to-teal-600", path: "/admin/users-list" },
                    { label: "Role", count: user?.role === "ADMIN" ? "Admin" : "Client", color: "from-purple-500 to-purple-600", path: "/settings" },
                  ].map((card) => (
                    <div key={card.label}
                      onClick={() => card.path && navigate(card.path)}
                      className="bg-white rounded-xl border border-slate-200 p-3 cursor-pointer active:scale-[0.97] transition-transform shadow-sm">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-2`}>
                        <span className="text-[10px] font-bold text-white">{typeof card.count === "number" ? (card.count > 99 ? "99+" : card.count) : card.count?.[0]}</span>
                      </div>
                      <div className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {loadingStats && !stats ? <span className="inline-block w-8 h-5 bg-slate-200 rounded animate-pulse" /> : (card.count ?? 0)}
                      </div>
                      <div className="text-[10px] text-slate-500">{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* Platform Chart */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-semibold text-slate-900">Platform Overview</h2>
                  </div>
                  {loadingStats && !stats ? (
                    <ChartSkeleton />
                  ) : chartData.length > 0 ? (
                    <div className="h-44 sm:h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                            {chartData.map((entry, idx) => {
                              const colors = ['#6366f1', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];
                              return <Cell key={idx} fill={colors[idx % colors.length]} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-10">No data yet</p>
                  )}
                </div>

                {/* User Signups & Invoices */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <h2 className="text-sm font-semibold text-slate-900">User Signups</h2>
                    </div>
                    {loadingStats && !analytics ? (
                      <ChartSkeleton small />
                    ) : analytics?.usersByMonth?.length > 0 ? (
                      <div className="h-40 sm:h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.usersByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} name="Users" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-8">No data yet</p>
                    )}
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <h2 className="text-sm font-semibold text-slate-900">Invoices</h2>
                    </div>
                    {loadingStats && !analytics ? (
                      <ChartSkeleton small />
                    ) : analytics?.invoicesByMonth?.length > 0 ? (
                      <div className="h-40 sm:h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.invoicesByMonth} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} name="Invoices" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-8">No data yet</p>
                    )}
                  </div>
                </div>

                {/* Businesses - mobile cards */}
                {businesses.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-slate-600" />
                      <h2 className="text-sm font-semibold text-slate-900">Businesses</h2>
                      <span className="text-[10px] text-slate-400">({businesses.length})</span>
                    </div>
                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-3">
                      {businesses.slice(0, 5).map((b) => (
                        <div key={b.id} onClick={() => navigate(`/admin/businesses/${b.id}/invoices`)}
                          className="bg-slate-50 rounded-lg p-3 active:bg-slate-100 transition-colors">
                          <div className="text-xs font-semibold text-slate-800 mb-1">{b.businessName}</div>
                          <div className="text-[10px] text-slate-500">{b.ownerName || "-"}</div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto max-h-72">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-3 text-[10px] font-medium text-slate-500 uppercase">Business</th>
                            <th className="text-left py-2 px-3 text-[10px] font-medium text-slate-500 uppercase">Owner</th>
                            <th className="text-left py-2 px-3 text-[10px] font-medium text-slate-500 uppercase">Phone</th>
                            <th className="text-left py-2 px-3 text-[10px] font-medium text-slate-500 uppercase">GST</th>
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
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
