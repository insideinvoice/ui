import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, memo } from "react";
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
    // While the app shell is mounted its navbar is white, so the painted
    // status-bar strip must be white too (kept just below the status bar via
    // top: env(...) — see body::before in index.css).
    root.style.setProperty("--status-bar-bg", "#ffffff");
    const measure = () => {
      const el = document.querySelector("nav.app-nav-fixed");
      if (!el) return;
      // Report the distance from the viewport top to the navbar's bottom
      // edge: consumers offset content from the bar's bottom, which now
      // starts at the safe-area inset instead of y=0.
      const h = Math.round(el.getBoundingClientRect().bottom);
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
      root.style.removeProperty("--status-bar-bg");
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
  // Whole section follows the Labels pattern: industries whose profile
  // disables delivery challans (professional services, telecom/IT,
  // healthcare, education) see neither the header nor the list link.
  ...(docs.deliveryChallan ? [{
    header: "Delivery Challan",
    items: [
      { label: "New Delivery Challan", icon: ClipboardList, path: "/delivery-challans/new" },
      { label: "Delivery Challans", icon: List, path: "/delivery-challans" },
    ],
  }] : []),
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

// MODULE-SCOPED: AppNavbar is rendered inside each page component, so every
// route change remounts it and a component-level state (or the new <nav>'s
// default scrollTop: 0) would snap the sidebar back to the top. Keeping the
// value here lets the fresh mount restore the exact scroll offset the user
// navigated from, so the clicked item stays in view instead of the sidebar
// "jumping to the top" on every navigation.
let sidebarNavScrollTop = 0;

export default memo(function AppNavbar() {
  const { logout, isAdmin, documentAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Tablet up to ~15" (768–1535px) starts with the sidebar collapsed to an icon
  // rail so page content (e.g. wide tables) keeps the full width. The toggle is
  // revealed only while hovering/focusing the collapsed logo; clicking it
  // opens the sidebar until it is toggled closed again.
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [railLogoHovered, setRailLogoHovered] = useState(false);
  // Hover tooltip shown next to an icon while the rail is collapsed.
  const [railTip, setRailTip] = useState(null); // { label, top, left }
  const [railMode, setRailMode] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(RAIL_MEDIA).matches
  );
  const railExpanded = railMode && !railCollapsed;
  const sidebarNavRef = useRef(null);
  // Restore the sidebar's scroll position immediately on mount (before paint via
  // useLayoutEffect-like timing is not required — the inner nav inherits 0 and
  // this corrects it in the same commit, so there is no visible jump).
  useEffect(() => {
    if (sidebarNavRef.current) sidebarNavRef.current.scrollTop = sidebarNavScrollTop;
  }, []);
  useNavbarHeightVar();

  const prevRailCollapsedRef = useRef(railCollapsed);

  // MUST be a layout effect: the class flip (margin jumps to its target) and
  // the inverse transform compensation have to land in the SAME paint. As a
  // passive effect the browser could paint the jumped margin for a frame or
  // two before the transform snaps the content back — a visible
  // teleport/glitch that reads as "stuck" right before the slide begins.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("rail-collapsed", railMode && railCollapsed);
    root.classList.toggle("rail-expanded", railExpanded);

    // ---- ChatGPT-style content slide (desktop rail widths only) ----
    // The class flip above moved .app-shell's margin-left to its TARGET in a
    // SINGLE reflow — no per-frame layout of the page content (animating
    // margin-left re-laid-out charts/tables/forms every frame = jank). The
    // slide is pure compositor work instead: compensate the visual jump with
    // an inverse transform in this same frame, then release the transform so
    // it glides on the same curve/duration as the panel's width transition
    // (both defined in index.css — keep the JS strip timeout above the CSS
    // duration). Read the current tx so a re-toggle mid-slide continues from
    // wherever it is instead of snapping.
    const toggled = prevRailCollapsedRef.current !== railCollapsed;
    prevRailCollapsedRef.current = railCollapsed;
    const clearRootClasses = () => {
      root.classList.remove("rail-collapsed");
      root.classList.remove("rail-expanded");
    };
    if (!railMode || !toggled) return clearRootClasses;

    const shell = document.querySelector(".app-shell");
    if (!shell) return clearRootClasses;
    const currentTx = new DOMMatrixReadOnly(
      getComputedStyle(shell).transform || "none"
    ).m41;
    // rem-based, same as the CSS rail widths (4rem collapsed / 15rem expanded).
    const rem = parseFloat(getComputedStyle(root).fontSize) || 16;
    const delta = (15 - 4) * rem;
    // Clean toggle: the layout has just jumped from the OTHER state's static
    // position — start the visual THERE (∓delta) and glide to 0. A re-toggle
    // mid-slide keeps the current visual (currentTx) so motion reverses
    // smoothly instead of snapping.
    const startTx = currentTx !== 0 ? currentTx : railCollapsed ? delta : -delta;
    // Synchronous FLIP: invert, flush, release - all before this commit's
    // paint, so the content glide and the panel's width transition start on
    // the SAME frame (a rAF-delayed release lagged 2 frames, up to ~35px
    // behind the panel edge mid-flight). The flush is a one-time reflow.
    // Promote the shell to its own compositor layer BEFORE the glide starts -
    // without this, the first glide frames rasterize lazily and heavy pages
    // (items tables, charts) stutter mid-slide.
    shell.style.willChange = "transform";
    shell.style.transition = "none";
    shell.style.transform = `translateX(${startTx}px)`;
    void shell.offsetWidth; // flush the inverted position as the start value
    shell.style.transition = "";
    shell.style.transform = "";

    // Opening: the content's right edge sits `delta` short of the viewport
    // while translated back to its old position — fill that strip with the
    // page background (z-index:-1 paints over the canvas but under the app).
    // Closing needs no strip: the fixed sidebar itself covers the gap.
    let strip = null;
    if (!railCollapsed) {
      strip = document.createElement("div");
      strip.className = "rail-slide-strip";
      document.body.appendChild(strip);
    }

    // Both the strip and the will-change promotion outlive the slide
    // (--rail-dur in index.css) by a small buffer: the covered gap can never
    // flash early, and the compositor layer is dropped once gliding ends.
    const stripTimer = setTimeout(() => {
      strip?.remove();
      shell.style.willChange = "";
    }, 340);
    return () => {
      clearTimeout(stripTimer);
      strip?.remove();
      shell.style.willChange = "";
      clearRootClasses();
    };
  }, [railMode, railCollapsed, railExpanded]);

  useEffect(() => {
    const mq = window.matchMedia(RAIL_MEDIA);
    const onChange = () => {
      setRailMode(mq.matches);
      setRailLogoHovered(false);
      setRailTip(null);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const showRailTip = useCallback((e, label, force = false) => {
    if (!railMode) return;
    if (!force && railExpanded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const aside = document.querySelector("aside.app-side-nav");
    const left = aside ? aside.getBoundingClientRect().right + 8 : 72;
    setRailTip({ label, top: rect.top + rect.height / 2, left });
  }, [railMode, railExpanded]);

  const hideRailTip = useCallback(() => setRailTip(null), []);

  const handleRailLogoMouseEnter = useCallback(() => {
    if (!railMode) return;
    setRailLogoHovered(true);
    setRailTip(null);
  }, [railMode]);

  const handleRailLogoMouseLeave = useCallback(() => {
    setRailLogoHovered(false);
    setRailTip(null);
  }, []);

  const handleRailLogoFocus = useCallback(() => {
    if (!railMode) return;
    setRailLogoHovered(true);
    setRailTip(null);
  }, [railMode]);

  const handleRailLogoBlur = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setRailLogoHovered(false);
      setRailTip(null);
    }
  }, []);

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
        <div className="rail-head-row flex items-center justify-between gap-2">
          <div
            className="rail-logo-wrap relative min-w-0"
            onMouseEnter={handleRailLogoMouseEnter}
            onMouseLeave={handleRailLogoMouseLeave}
            onFocus={handleRailLogoFocus}
            onBlur={handleRailLogoBlur}
          >
            {/* Logo button stays mounted in BOTH rail states — the old
                swap (menu button <-> logo) popped the head contents in a
                single frame mid-animation. The collapsed-rail hamburger is
                an overlay that crossfades above it instead. */}
            <button
              type="button"
              onClick={() => handleNav("/dashboard")}
              /* Crossfade with the overlay plate: while the hamburger is up,
                 the logo drops to opacity-0 (the hover:opacity-80 utility is
                 NOT rendered in that state — two opacity utilities of equal
                 specificity otherwise race, and the fade must always win).
                 80ms clears the mark before the plate reaches half opacity,
                 so its shape never ghosts through on the way in. */
              className={`rail-logo flex items-center gap-2.5 transition-opacity min-w-0 ${
                railCollapsed && railLogoHovered ? "opacity-0" : "hover:opacity-80"
              }`}
              style={railCollapsed && railLogoHovered ? { transitionDuration: "80ms" } : undefined}
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
                  BY GRITX
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setRailCollapsed(false);
                setRailLogoHovered(false);
                setRailTip(null);
              }}
              aria-label="Expand sidebar"
              aria-hidden={!(railCollapsed && railLogoHovered)}
              tabIndex={railCollapsed ? 0 : -1}
              className={`rail-logo-toggle rail-toggle absolute left-0 top-1/2 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-opacity duration-150 ease-out ${
                railCollapsed && railLogoHovered
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setRailCollapsed((v) => !v);
              setRailLogoHovered(false);
              setRailTip(null);
            }}
            aria-label={railExpanded ? "Collapse sidebar" : "Expand sidebar"}
            onMouseEnter={(e) => showRailTip(e, railExpanded ? "Collapse sidebar" : "Expand sidebar", true)}
            onMouseLeave={hideRailTip}
            className="rail-toggle rail-expanded-toggle items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
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
      <nav
        ref={sidebarNavRef}
        onScroll={(e) => { sidebarNavScrollTop = e.currentTarget.scrollTop; }}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
      >
        {dropdownSections.map((section) => (
          <div key={section.header} className="rail-section mb-2">
            <div className="rail-section-header text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5 rail-hide">
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
      <aside
        className="app-side-nav hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-50 md:w-60 md:bg-white md:border-r md:border-slate-200 transition-[width] duration-300 ease-out"
      >
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
        className="app-nav-fixed md:hidden bg-white border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-3 sticky z-[99]"
        style={{
          // Pin just BELOW the painted status-bar strip (#root reserves the
          // offset at the top of the page; body::before in index.css paints
          // it, including the iOS 27 home-screen blur feather). The navbar
          // must never overlap that zone: iOS standalone PWAs rasterize
          // layers extending under the status bar at the wrong scale, and
          // iOS 27's system blur fogs anything inside it — the browser and
          // the bottom tab bar (which never touches the status bar) render
          // sharp.
          top: "var(--status-bar-offset, 0px)",
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
        <div className={`absolute left-0 h-full w-5/6 max-w-sm bg-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{
            // Sit below the status-bar strip for the same reason as the top
            // navbar: a layer spanning the under-status-bar region renders
            // blurry in iOS standalone PWAs (and inside iOS 27's blur feather).
            top: "var(--status-bar-offset, 0px)",
            height: "calc(100% - var(--status-bar-offset, 0px))",
          }}>
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
