import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LogOut, Users, Plus, List, UserPlus, UserCheck,
  LayoutDashboard, Shield, Package, FileText, Settings,
  ChevronDown, Menu, X, Home, Truck, Flame, ClipboardList
} from "lucide-react";
import insideInvoiceLogo from "../assets/inside-invoice-logo.svg";

// Same range as the icon-rail rules in index.css: tablet (~768px) up to a
// ~15" display (1536px = Tailwind 2xl).
const RAIL_MEDIA = "(min-width: 768px) and (max-width: 1535.98px)";

// Publishes the mobile top-nav's real height (incl. safe-area inset + border) as
// a CSS var so sibling headers can pin themselves directly beneath it with
// position: fixed. Without this, fixed headers slide under the navbar because
// the safe-area inset isn't knowable at build time.
function useNavbarHeightVar() {
  useEffect(() => {
    const root = document.documentElement;
    const measure = () => {
      const el = document.querySelector("nav.app-nav-fixed");
      if (!el) return;
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) root.style.setProperty("--app-nav-height", `${h}px`);
    };
    measure();
    const t1 = setTimeout(measure, 0);
    const t2 = setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    // Keep the var in sync when the navbar resizes for any other reason
    // (safe-area inset changing after load, font settle, zoom) — a stale var
    // pins fixed headers under the navbar in standalone PWA mode.
    const navEl = document.querySelector("nav.app-nav-fixed");
    const ro = navEl && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && navEl) ro.observe(navEl);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      ro?.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      root.style.removeProperty("--app-nav-height");
    };
  }, []);
}

const ALL_DOCUMENTS = { deliveryChallan: true, shippingLabel: true, hazmatLabel: true };

const sections = (isAdmin, documentAccess) => {
  const docs = { ...ALL_DOCUMENTS, ...(documentAccess || {}) };
  return [
  {
    header: "Dashboard",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    ],
  },
  {
    header: "Invoices",
    items: [
      { label: "New Invoice", icon: Plus, path: "/invoice" },
      { label: "View Invoices", icon: List, path: "/invoices" },
      { label: "Templates", icon: FileText, path: "/invoice-templates" },
      { label: "Add Product", icon: Package, path: "/products/new" },
      { label: "Product Items", icon: Package, path: "/products" },
    ],
  },
  {
    header: "Delivery Challan",
    items: [
      ...(docs.deliveryChallan ? [{ label: "New Delivery Challan", icon: ClipboardList, path: "/delivery-challans/new" }] : []),
      { label: "Delivery Challans", icon: List, path: "/delivery-challans" },
    ],
  },
  {
    header: "Customers",
    items: [
      { label: "New Customer", icon: UserPlus, path: "/customers/new" },
      { label: "View Customers", icon: UserCheck, path: "/customers" },
    ],
  },
  ...(docs.shippingLabel || docs.hazmatLabel ? [{
    header: "Labels",
    items: [
      ...(docs.shippingLabel ? [
        { label: "New Shipping Label", icon: Truck, path: "/labels/shipping/new" },
        { label: "Shipping Labels", icon: List, path: "/labels/shipping" },
      ] : []),
      ...(docs.hazmatLabel ? [
        { label: "New Hazmat Label", icon: Flame, path: "/labels/hazmat/new" },
        { label: "Hazmat Labels", icon: List, path: "/labels/hazmat" },
      ] : []),
    ],
  }] : []),
  ...(isAdmin ? [
    {
      header: "Admin",
      items: [
        { label: "Add User", icon: UserPlus, path: "/admin/users" },
        { label: "All Users", icon: UserCheck, path: "/admin/users-list" },
        { label: "Registered Products", icon: Package, path: "/admin/products" },
      ],
    },
  ] : []),
  ];
};

const bottomTabs = [
  { label: "Dashboard", icon: Home, path: "/dashboard" },
  { label: "Invoices", icon: FileText, path: "/invoices" },
  { label: "Customers", icon: Users, path: "/customers" },
  { label: "More", icon: Menu, path: "/more" },
];

export default memo(function AppNavbar() {
  const { logout, isAdmin, documentAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Tablet up to ~15" (768–1535px) starts with the sidebar collapsed to an icon
  // rail so page content (e.g. wide tables) keeps the full width. The CSS in
  // index.css scopes this state to that breakpoint only.
  const [railCollapsed, setRailCollapsed] = useState(true);
  // Hover tooltip shown next to an icon while the rail is collapsed.
  const [railTip, setRailTip] = useState(null); // { label, top, left }
  const [railMode, setRailMode] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(RAIL_MEDIA).matches
  );
  useNavbarHeightVar();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("rail-collapsed", railCollapsed);
    return () => root.classList.remove("rail-collapsed");
  }, [railCollapsed]);

  useEffect(() => {
    const mq = window.matchMedia(RAIL_MEDIA);
    const onChange = () => {
      setRailMode(mq.matches);
      setRailTip(null);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const showRailTip = useCallback((e, label, force = false) => {
    if (!railMode) return;
    if (!force && !railCollapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const aside = document.querySelector("aside.app-side-nav");
    const left = aside ? aside.getBoundingClientRect().right + 8 : 72;
    setRailTip({ label, top: rect.top + rect.height / 2, left });
  }, [railMode, railCollapsed]);

  const hideRailTip = useCallback(() => setRailTip(null), []);

  const handleLogout = useCallback(() => {
    logout();
    setMobileMenuOpen(false);
    navigate("/");
  }, [logout, navigate]);

  const dropdownSections = useMemo(
    () => sections(isAdmin, documentAccess).filter((s) => s.header && s.items.length > 0),
    [isAdmin, documentAccess]
  );

  const closeMobile = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleNav = useCallback((path) => {
    navigate(path);
    setMobileMenuOpen(false);
    setRailTip(null);
  }, [navigate]);

  const isActive = useCallback((path) => location.pathname === path, [location.pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onEscape = (e) => { if (e.key === "Escape") closeMobile(); };
    const onPopState = () => closeMobile();
    window.addEventListener("keydown", onEscape);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("popstate", onPopState);
    };
  }, [mobileMenuOpen, closeMobile]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + rail toggle */}
      <div className="rail-head px-4 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => handleNav("/dashboard")}
            className="rail-logo flex items-center gap-2.5 hover:opacity-80 transition-opacity min-w-0"
          >
            <img
              src={insideInvoiceLogo}
              alt="Inside Invoice"
              className="w-8 h-8 shrink-0"
            />
            <div className="flex flex-col rail-hide">
              <span
                className="font-bold text-slate-800 text-sm leading-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Inside Invoice
              </span>
              <span className="text-[8px] text-slate-500 font-medium tracking-widest text-left">
                BY 2X+1
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setRailCollapsed((v) => !v); setRailTip(null); }}
            aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onMouseEnter={(e) => showRailTip(e, railCollapsed ? "Expand sidebar" : "Collapse sidebar", true)}
            onMouseLeave={hideRailTip}
            className="rail-toggle items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          >
            {railCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>
        {isAdmin && (
          <div className="mt-2 rail-hide">
            <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium w-fit">
              <Shield className="w-2.5 h-2.5" /> Admin
            </span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {dropdownSections.map((section) => (
          <div key={section.header} className="mb-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5 rail-hide">
              {section.header}
            </div>
            {section.items.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNav(item.path)}
                onMouseEnter={(e) => showRailTip(e, item.label)}
                onMouseLeave={hideRailTip}
                className={`rail-item flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left min-h-[40px] ${
                  isActive(item.path)
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <item.icon
                  className={`w-4 h-4 shrink-0 ${isActive(item.path) ? "text-indigo-600" : "text-slate-400"}`}
                />
                <span className="rail-hide">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t border-slate-100 space-y-1">
        <button
          onClick={() => handleNav("/settings")}
          onMouseEnter={(e) => showRailTip(e, "Settings")}
          onMouseLeave={hideRailTip}
          className={`rail-item flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left min-h-[40px] ${
            isActive("/settings")
              ? "bg-indigo-50 text-indigo-700 font-medium"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Settings
            className={`w-4 h-4 shrink-0 ${isActive("/settings") ? "text-indigo-600" : "text-slate-400"}`}
          />
          <span className="rail-hide">Settings</span>
        </button>
        <button
          onClick={handleLogout}
          onMouseEnter={(e) => showRailTip(e, "Logout")}
          onMouseLeave={hideRailTip}
          className="rail-item flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left min-h-[40px]"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="rail-hide">Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ===== DESKTOP SIDEBAR (md+) ===== */}
      <aside className="app-side-nav hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-50 md:w-60 md:bg-white md:border-r md:border-slate-200">
        {sidebarContent}
        {railTip && (
          <div
            className="pointer-events-none fixed z-[60] rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg whitespace-nowrap"
            style={{ left: railTip.left, top: railTip.top, transform: "translateY(-50%)" }}
          >
            {railTip.label}
          </div>
        )}
      </aside>

      {/* ===== MOBILE TOP NAV ===== */}
      <nav
        className="app-nav-fixed md:hidden bg-white border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-3 sticky top-0 z-[99]"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          // #root already pads the whole app down by the safe-area inset
          // (protection for navbar-less pages like Login). Cancel it here so
          // the inset is counted ONCE for navbar pages — otherwise the nav and
          // every fixed header below it are pushed down by 2x the status-bar
          // height in standalone PWA mode.
          marginTop: "calc(-1 * env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="flex items-center justify-between max-w-full">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button onClick={() => handleNav("/dashboard")} className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
              <img src={insideInvoiceLogo} alt="Inside Invoice" className="w-7 h-7 sm:w-8 sm:h-8" />
              <span className="font-semibold text-slate-800 text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">Inside Invoice</span>
            </button>
          </div>
          <button onClick={() => setMobileMenuOpen(true)}
            className="flex items-center justify-center p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] shrink-0">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* ===== MOBILE HAMBURGER DRAWER ===== */}
      <div
        className={`fixed inset-0 z-[999] transition-all duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? "pointer-events-auto visible opacity-100" : "pointer-events-none invisible opacity-0"
        }`}
      >
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-in-out ${mobileMenuOpen ? "opacity-100" : "opacity-0"}`} onClick={closeMobile} />
        <div className={`absolute top-0 left-0 h-full w-5/6 max-w-sm bg-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="bg-white border-b border-slate-100 shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <img src={insideInvoiceLogo} alt="Inside Invoice" className="w-7 h-7" />
                <span className="font-semibold text-slate-800 text-sm">Inside Invoice</span>
              </div>
              <button onClick={closeMobile} className="flex items-center justify-center p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px] min-w-[44px]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {isAdmin && (
              <div className="px-4 pb-2">
                <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium w-fit">
                  <Shield className="w-3 h-3" /> Admin
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
            <div className="p-3">
              {dropdownSections.map((section) => (
                <div key={section.header} className="mb-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">{section.header}</div>
                  {section.items.map((item) => (
                    <button key={item.label} onClick={() => handleNav(item.path)}
                      className={`flex items-center gap-3 w-full px-3 py-3 text-sm rounded-xl transition-colors text-left min-h-[48px] ${
                        isActive(item.path) ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                      }`}>
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive(item.path) ? "text-indigo-600" : "text-slate-400"}`} />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
              <hr className="my-3 border-slate-100" />
              <button onClick={() => { handleNav("/settings"); }}
                className={`flex items-center gap-3 w-full px-3 py-3 text-sm rounded-xl transition-colors text-left min-h-[48px] ${
                  isActive("/settings") ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                }`}>
                <Settings className={`w-4 h-4 shrink-0 ${isActive("/settings") ? "text-indigo-600" : "text-slate-400"}`} /> Settings
              </button>
              <button onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left min-h-[48px]">
                <LogOut className="w-4 h-4 shrink-0" /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== MOBILE BOTTOM TAB BAR ===== */}
      <div className="app-nav-bottom fixed bottom-0 left-0 right-0 z-[1000] md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", backgroundColor: "#ffffff" }}>
        <div className="bg-white border-t border-slate-200">
          <div className="flex items-center justify-around px-2">
            {bottomTabs.map((tab) => (
              <button key={tab.label} onClick={() => handleNav(tab.path)}
                className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  tab.path && isActive(tab.path) ? "text-indigo-600" : "text-slate-500"
                }`}>
                <tab.icon className={`w-5 h-5 ${tab.path && isActive(tab.path) ? "text-indigo-600" : "text-slate-400"}`} />
                <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
});
