import { Toaster } from "react-hot-toast";
import { Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
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
import BarcodeGenerator from "./Landing/Services/BarcodeGenerator";
import BusinessCardMaker from "./Landing/Services/BusinessCardMaker";
import BusinessSetup from "./pages/BusinessSetup";
import Dashboard from "./pages/Dashboard";
import InvoiceForm from "./pages/InvoiceForm";
import InvoiceUpload from "./pages/InvoiceUpload";
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
import AdminBusinessesList from "./pages/AdminBusinessesList";
import AdminCustomersList from "./pages/AdminCustomersList";
import AdminInvoicesList from "./pages/AdminInvoicesList";
import CustomersList from "./pages/CustomersList";
import MorePage from "./pages/MorePage";

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-700 border-t-transparent rounded-full animate-spin"></div></div>;
  return isAuthenticated ? <div className="lg:ml-60">{children}</div> : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<GSTBillingLanding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<Login />} />
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
      <Route path="/business-setup" element={<PrivateRoute><BusinessSetup /></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/invoice" element={<PrivateRoute><InvoiceForm /></PrivateRoute>} />
      <Route path="/invoice/upload" element={<PrivateRoute><InvoiceUpload /></PrivateRoute>} />
      <Route path="/invoice/:id" element={<PrivateRoute><InvoiceView /></PrivateRoute>} />
      <Route path="/invoices" element={<PrivateRoute><InvoicesList /></PrivateRoute>} />
      <Route path="/customers/new" element={<PrivateRoute><AddCustomer /></PrivateRoute>} />
      <Route path="/customers" element={<PrivateRoute><CustomersList /></PrivateRoute>} />
      <Route path="/products/new" element={<PrivateRoute><AddProduct /></PrivateRoute>} />
      <Route path="/products" element={<PrivateRoute><ProductsList /></PrivateRoute>} />
      <Route path="/invoice-templates" element={<PrivateRoute><InvoiceTemplates /></PrivateRoute>} />
      <Route path="/payments" element={<PrivateRoute><PaymentsList /></PrivateRoute>} />
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
