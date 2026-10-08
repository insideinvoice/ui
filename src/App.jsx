import { Toaster } from "react-hot-toast";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import LoadingDots from "./components/LoadingDots";
import { AuthProvider, useAuth } from "./context/AuthContext";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

// Route-level code splitting: only the chunks needed for the matched route are
// fetched, so the initial bundle stays small (landing/login no longer drags in
// the whole admin/app surface, PDF libs, label renderers, etc).
const GSTBillingLanding = lazy(() => import("./Landing/gst-landing-final"));
const PrivacyPolicy = lazy(() => import("./Landing/PrivacyPolicy"));
const TermsandConditions = lazy(() => import("./Landing/TermsandConditions"));
const RefundPolicy = lazy(() => import("./Landing/RefundPolicy"));
const Updates = lazy(() => import("./Landing/Updates"));
const ContactNow = lazy(() => import("./Landing/ContactNow"));
const Documentation = lazy(() => import("./Landing/Documentation"));
const InsideInvoiceHelpCenter = lazy(() => import("./Landing/InsideInvoiceHelpCenter"));
const InsideInvoiceVideoTutorials = lazy(() => import("./Landing/InsideInvoiceVideoTutorials"));
const GSTCalculator = lazy(() => import("./Landing/Services/GSTCalculator"));
const QRCodeGenerator = lazy(() => import("./Landing/Services/QRCodeGenerator"));
const BarcodeGenerator = lazy(() => import("./Landing/Services/BarcodeGenerator"));
const BusinessCardMaker = lazy(() => import("./Landing/Services/BusinessCardMaker"));
const Login = lazy(() => import("./Authentication/Login"));
const ForgotPassword = lazy(() => import("./Authentication/ForgotPassword"));
const ChangePassword = lazy(() => import("./Authentication/ChangePassword"));
const BusinessSetup = lazy(() => import("./pages/BusinessSetup"));
const ShippingLabelsList = lazy(() => import("./pages/ShippingLabelsList"));
const HazmatLabelsList = lazy(() => import("./pages/HazmatLabelsList"));
const ShippingLabelForm = lazy(() => import("./pages/ShippingLabelForm"));
const HazmatLabelForm = lazy(() => import("./pages/HazmatLabelForm"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const InvoiceForm = lazy(() => import("./pages/InvoiceForm"));
const InvoiceView = lazy(() => import("./pages/InvoiceView"));
const InvoicesList = lazy(() => import("./pages/InvoicesList"));
const AddCustomer = lazy(() => import("./pages/AddCustomer"));
const AddProduct = lazy(() => import("./pages/AddProduct"));
const ProductsList = lazy(() => import("./pages/ProductsList"));
const AdminProductsList = lazy(() => import("./pages/AdminProductsList"));
const InvoiceTemplates = lazy(() => import("./pages/InvoiceTemplates"));
const PaymentsList = lazy(() => import("./pages/PaymentsList"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminAddUsers = lazy(() => import("./pages/AdminAddUsers"));
const AdminUsersList = lazy(() => import("./pages/AdminUsersList"));
const BusinessInvoices = lazy(() => import("./pages/BusinessInvoices"));
const AdminInvoiceView = lazy(() => import("./pages/AdminInvoiceView"));
const AdminBusinessesList = lazy(() => import("./pages/AdminBusinessesList"));
const AdminCustomersList = lazy(() => import("./pages/AdminCustomersList"));
const AdminInvoicesList = lazy(() => import("./pages/AdminInvoicesList"));
const CustomersList = lazy(() => import("./pages/CustomersList"));
const DeliveryChallanForm = lazy(() => import("./pages/DeliveryChallanForm"));
const DeliveryChallansList = lazy(() => import("./pages/DeliveryChallansList"));
const DeliveryChallanView = lazy(() => import("./pages/DeliveryChallanView"));
const MorePage = lazy(() => import("./pages/MorePage"));
const PublicInvoicePage = lazy(() => import("./pages/PublicInvoicePage"));

const TOASTER_OPTIONS = { duration: 4000, style: { fontSize: "14px" } };

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingDots className="text-slate-400" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <RouteFallback />;
  // Bottom padding clears the fixed mobile tab bar + home indicator — scoped to app pages
  // only, so landing/legal pages don't get a white strip below their footer
  return isAuthenticated ? (
    <div className="lg:ml-60 pb-[calc(env(safe-area-inset-bottom,0px)_+_64px)] lg:pb-0">
      {children}
    </div>
  ) : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
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
          <Route path="/admin/businesses" element={<PrivateRoute><AdminBusinessesList /></PrivateRoute>} />
          <Route path="/admin/customers" element={<PrivateRoute><AdminCustomersList /></PrivateRoute>} />
          <Route path="/admin/products" element={<PrivateRoute><AdminProductsList /></PrivateRoute>} />
          <Route path="/admin/invoices" element={<PrivateRoute><AdminInvoicesList /></PrivateRoute>} />
          <Route path="/admin/businesses/:businessId/invoices" element={<PrivateRoute><BusinessInvoices /></PrivateRoute>} />
          <Route path="/admin/invoices/:id" element={<PrivateRoute><AdminInvoiceView /></PrivateRoute>} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <PWAInstallPrompt />
      <Toaster position="top-center" toastOptions={TOASTER_OPTIONS} />
    </AuthProvider>
  );
}

export default App;
