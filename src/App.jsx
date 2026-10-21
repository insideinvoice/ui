import { Toaster } from "react-hot-toast";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { AuthProvider } from "./context/AuthProvider";
import AppNavbar from "./components/AppNavbar";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import GSTBillingLanding from "./Landing/gst-landing-final";
import PrivacyPolicy from "./Landing/PrivacyPolicy";
import TermsandConditions from "./Landing/TermsandConditions";
import RefundPolicy from "./Landing/RefundPolicy";
import Updates from "./Landing/Updates";
import ContactNow from "./Landing/ContactNow";
import Documentation from "./Landing/Documentation";
import InsideInvoiceHelpCenter from "./Landing/InsideInvoiceHelpCenter";
import InsideInvoiceVideoTutorials from "./Landing/InsideInvoiceVideoTutorials";
import GSTCalculator from "./Landing/Services/GSTCalculator";
import QRCodeGenerator from "./Landing/Services/QRCodeGenerator";
import Login from "./Authentication/Login";
import ForgotPassword from "./Authentication/ForgotPassword";
import ChangePassword from "./Authentication/ChangePassword";
import BarcodeGenerator from "./Landing/Services/BarcodeGenerator";
import BusinessCardMaker from "./Landing/Services/BusinessCardMaker";
import BusinessSetup from "./pages/BusinessSetup";
import ShippingLabelsList from "./pages/ShippingLabelsList";
import HazmatLabelsList from "./pages/HazmatLabelsList";
import ShippingLabelForm from "./pages/ShippingLabelForm";
import HazmatLabelForm from "./pages/HazmatLabelForm";
import Dashboard from "./pages/Dashboard";
import InvoiceForm from "./pages/InvoiceForm";
import InvoiceView from "./pages/InvoiceView";
import InvoicesList from "./pages/InvoicesList";
import AddCustomer from "./pages/AddCustomer";
import AddProduct from "./pages/AddProduct";
import ProductsList from "./pages/ProductsList";
import AdminProductsList from "./pages/AdminProductsList";
import InvoiceTemplates from "./pages/InvoiceTemplates";
import PaymentsList from "./pages/PaymentsList";
import Profile from "./pages/Profile";
import AdminAddUsers from "./pages/AdminAddUsers";
import AdminUsersList from "./pages/AdminUsersList";
import BusinessInvoices from "./pages/BusinessInvoices";
import AdminInvoiceView from "./pages/AdminInvoiceView";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUserWorkspace from "./pages/AdminUserWorkspace";
import AdminBusinessesList from "./pages/AdminBusinessesList";
import AdminCustomersList from "./pages/AdminCustomersList";
import AdminInvoicesList from "./pages/AdminInvoicesList";
import CustomersList from "./pages/CustomersList";
import DeliveryChallanForm from "./pages/DeliveryChallanForm";
import DeliveryChallansList from "./pages/DeliveryChallansList";
import DeliveryChallanView from "./pages/DeliveryChallanView";
import MorePage from "./pages/MorePage";
import PublicInvoicePage from "./pages/PublicInvoicePage";
import ZoomLab from "./pages/ZoomLab";
import RailLab from "./pages/__RailLab"; // TEMP rail bench — remove
import SeoHead from "./components/SeoHead";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  // Bottom padding clears the fixed mobile tab bar + home indicator — scoped to app pages
  // only, so landing/legal pages don't get a white strip below their footer
  return isAuthenticated ? (
    <div className="app-shell md:ml-60 pb-[calc(env(safe-area-inset-bottom,0px)_+_64px)] md:pb-0">
      {children}
    </div>
  ) : <Navigate to="/login" />;
}

/** Routes that never rendered app chrome (public share, landing, docs, auth). */
const PUBLIC_PATHS = [
  // "/i" — NOT "/i/": the matcher below tests startsWith(path + "/"), so a
  // trailing-slash entry would demand "/i//<token>" and never match, which is
  // how the logged-in owner's own share link ended up wearing the app sidebar.
  "/", "/i", "/login", "/forgot-password", "/change-password",
  "/privacy-policy", "/terms-and-condition", "/refund-policy", "/updates",
  "/contact", "/documentation", "/help", "/video", "/gst-calculator",
  "/qr-generator", "/barcode-generator", "/business-card",
  // Dev-only zoom gesture bench (route only exists when import.meta.env.DEV).
  "/__zoomlab",
  // TEMP rail sidebar bench — remove.
  "/__raillab",
];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`));
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  return (
    <>
      <ScrollToTop />
      <SeoHead />
      {/* Persistent app chrome, mounted ONCE per authenticated session and
          NOT per routed page: every page used to render its own <AppNavbar/>,
          so navigating unmounted + remounted the whole desktop sidebar and
          mobile top-nav (CSS transitions replayed → the sidebar "blinked"
          on every click). Mounted here it survives route changes; public
          and landing routes are gated off exactly like before. */}
      {isAuthenticated && !isPublicPath(location.pathname) && <AppNavbar />}
      <Routes>
      <Route path="/" element={<GSTBillingLanding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-and-condition" element={<TermsandConditions />} />
      <Route path="/refund-policy" element={<RefundPolicy />} />
      <Route path="/updates" element={<Updates />} />
      <Route path="/contact" element={<ContactNow />} />
      <Route path="/documentation" element={<Documentation />} />
      <Route path="/help" element={<InsideInvoiceHelpCenter />} />
      <Route path="/video" element={<InsideInvoiceVideoTutorials />} />
      <Route path="/gst-calculator" element={<GSTCalculator />} />
      <Route path="/qr-generator" element={<QRCodeGenerator />} />
      <Route path="/barcode-generator" element={<BarcodeGenerator />} />
      <Route path="/business-card" element={<BusinessCardMaker />} />
      {/* Token-gated public share - must stay outside PrivateRoute (no login) */}
      <Route path="/i/:shareToken" element={<PublicInvoicePage />} />
      {/* Dev-only DocZoomSurface gesture bench for scripts/zoomGesture.test.mjs */}
      {import.meta.env.DEV && <Route path="/__zoomlab" element={<ZoomLab />} />}
      {import.meta.env.DEV && <Route path="/__raillab" element={<RailLab />} />}
      <Route path="/business-setup" element={<PrivateRoute><BusinessSetup /></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/invoice" element={<PrivateRoute><InvoiceForm /></PrivateRoute>} />
      <Route path="/invoice/:id" element={<PrivateRoute><InvoiceView /></PrivateRoute>} />
      <Route path="/invoices" element={<PrivateRoute><InvoicesList /></PrivateRoute>} />
      <Route path="/delivery-challans/new" element={<PrivateRoute><DeliveryChallanForm /></PrivateRoute>} />
      <Route path="/delivery-challans" element={<PrivateRoute><DeliveryChallansList /></PrivateRoute>} />
      <Route path="/delivery-challans/:id" element={<PrivateRoute><DeliveryChallanView /></PrivateRoute>} />
      <Route path="/customers/new" element={<PrivateRoute><AddCustomer /></PrivateRoute>} />
      <Route path="/customers" element={<PrivateRoute><CustomersList /></PrivateRoute>} />
      <Route path="/products/new" element={<PrivateRoute><AddProduct /></PrivateRoute>} />
      <Route path="/products/:id/edit" element={<PrivateRoute><AddProduct /></PrivateRoute>} />
      <Route path="/products" element={<PrivateRoute><ProductsList /></PrivateRoute>} />
      <Route path="/invoice-templates" element={<PrivateRoute><InvoiceTemplates /></PrivateRoute>} />
      <Route path="/payments" element={<PrivateRoute><PaymentsList /></PrivateRoute>} />
      <Route path="/labels/shipping" element={<PrivateRoute><ShippingLabelsList /></PrivateRoute>} />
      <Route path="/labels/shipping/new" element={<PrivateRoute><ShippingLabelForm /></PrivateRoute>} />
      <Route path="/labels/shipping/:id/edit" element={<PrivateRoute><ShippingLabelForm /></PrivateRoute>} />
      <Route path="/labels/hazmat" element={<PrivateRoute><HazmatLabelsList /></PrivateRoute>} />
      <Route path="/labels/hazmat/new" element={<PrivateRoute><HazmatLabelForm /></PrivateRoute>} />
      <Route path="/labels/hazmat/:id/edit" element={<PrivateRoute><HazmatLabelForm /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/more" element={<PrivateRoute><MorePage /></PrivateRoute>} />
      <Route path="/profile" element={<Navigate to="/settings" replace />} />
      <Route path="/admin/users" element={<PrivateRoute><AdminAddUsers /></PrivateRoute>} />
      <Route path="/admin/users-list" element={<PrivateRoute><AdminUsersList /></PrivateRoute>} />
      <Route path="/admin/users/:userId" element={<PrivateRoute><AdminUserWorkspace /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
      <Route path="/admin/businesses" element={<PrivateRoute><AdminBusinessesList /></PrivateRoute>} />
      <Route path="/admin/customers" element={<PrivateRoute><AdminCustomersList /></PrivateRoute>} />
      <Route path="/admin/products" element={<PrivateRoute><AdminProductsList /></PrivateRoute>} />
      <Route path="/admin/invoices" element={<PrivateRoute><AdminInvoicesList /></PrivateRoute>} />
      <Route path="/admin/businesses/:businessId/invoices" element={<PrivateRoute><BusinessInvoices /></PrivateRoute>} />
      <Route path="/admin/invoices/:id" element={<PrivateRoute><AdminInvoiceView /></PrivateRoute>} />
    </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <PWAInstallPrompt />
      <Toaster position="top-center" toastOptions={{ duration: 4000, style: { fontSize: '14px' } }} />
    </AuthProvider>
  );
}

export default App;
