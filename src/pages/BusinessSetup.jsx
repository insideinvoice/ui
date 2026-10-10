import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import toast from "react-hot-toast";
import { ArrowLeft, Check, ArrowRight, Building2, MapPin, Phone, Mail, Globe, FileText, Landmark } from "lucide-react";
import { INDUSTRY_LIST, DEFAULT_INDUSTRY } from "../constants/industryConfig";

export default function BusinessSetup() {
  const { setupBusiness, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: "",
    industry: DEFAULT_INDUSTRY,
    gstIn: "",
    phone: "",
    email: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    invoicePrefix: "",
    specialistIn: "",
    specialistInEnabled: false,
    bankName: "",
    accountNo: "",
    branch: "",
    ifsc: "",
    bankAddress: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSpecialistToggle = () => {
    setFormData({ ...formData, specialistInEnabled: !formData.specialistInEnabled });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.businessName) {
      toast.error("Business name is required");
      return;
    }

    setIsLoading(true);
    try {
      await setupBusiness(formData);
      navigate("/dashboard");
    } catch (err) {
      const fieldErrors = err.response?.data?.fieldErrors;
      const msg = fieldErrors ? Object.values(fieldErrors).join(". ") : (err.response?.data?.message || "Setup failed. Please try again.");
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="Business Setup" />
        <div className="max-w-2xl mx-auto glass-effect rounded-xl shadow-lg p-4 sm:p-6 lg:p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Set Up Your Business</h1>
            <p className="text-slate-500 text-sm mt-1">Complete your business profile to start invoicing</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Business Name *</label>
                <input type="text" name="businessName" value={formData.businessName} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="Acme Corp" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Industry *</label>
                <select name="industry" value={formData.industry} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 bg-white">
                  {INDUSTRY_LIST.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Sets which invoice fields and document types fit your line of work. You can change it later in Settings.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">GSTIN</label>
                <input type="text" name="gstIn" value={formData.gstIn} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 uppercase" placeholder="29ABCDE1234F1Z5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Convention</label>
                <input type="text" name="invoicePrefix" value={formData.invoicePrefix} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="INV-RSHWE / INV-2026 / INV-00001" />
                <p className="text-[10px] text-slate-400 mt-0.5">Blank → 1, 2, 3... · INV-RSHWE → INV-RSHWE-1 · INV-2026 → INV-2026-1 · INV-00001 → INV-00001, INV-00002</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                <input type="text" name="phone" value={formData.phone} onChange={handleChange} inputMode="numeric"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="+919876543210" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="contact@acme.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
                <input type="text" name="website" value={formData.website} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="https://acme.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 1</label>
                <input type="text" name="addressLine1" value={formData.addressLine1} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="123 Main Road" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 2</label>
                <input type="text" name="addressLine2" value={formData.addressLine2} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="Koramangala" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="Bangalore" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                <input type="text" name="state" value={formData.state} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="Karnataka" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
                <input type="text" name="country" value={formData.country} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="India" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pincode</label>
                <input type="text" name="pincode" value={formData.pincode} onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="560034" />
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">Specialist In</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Show on invoice</span>
                    <button type="button" onClick={handleSpecialistToggle} aria-label="Show Specialist In on invoice"
                      className={`relative w-11 h-6 rounded-full transition-colors ${formData.specialistInEnabled ? "bg-blue-500" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${formData.specialistInEnabled ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                </div>
                <input type="text" name="specialistIn" value={formData.specialistIn} onChange={handleChange}
                  disabled={!formData.specialistInEnabled}
                  placeholder="ALL KINDS OF ELECTRICAL & HARDWARE MATERIALS"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400" />
                <p className="text-[10px] text-slate-400 mt-1">Printed under the address on the invoice when enabled.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Landmark className="w-5 h-5 text-slate-600" />
                <h2 className="text-sm font-semibold text-slate-800">Company Bank Details</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bank Name</label>
                  <input type="text" name="bankName" value={formData.bankName} onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="State Bank of India" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Account No.</label>
                  <input type="text" name="accountNo" value={formData.accountNo} onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="123456789012" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                  <input type="text" name="branch" value={formData.branch} onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="MG Road" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">IFSC Code</label>
                  <input type="text" name="ifsc" value={formData.ifsc} onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 uppercase" placeholder="SBIN0001234" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bank Address</label>
                  <input type="text" name="bankAddress" value={formData.bankAddress} onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="MG Road, Bangalore" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">UPI ID</label>
                  <input type="text" name="upiId" value={formData.upiId} onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="business@upi" />
                  <p className="text-[10px] text-slate-400 mt-0.5">Automatically generates QR code on invoices for scan-to-pay</p>
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full bg-gradient-to-r from-slate-700 to-slate-800 text-white font-medium py-2.5 rounded-lg hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {isLoading ? (
                <><LoadingDots className="text-white" /> Setting up...</>
              ) : (
                <><Check className="w-4 h-4" /> Complete Setup <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={logout} className="text-xs text-slate-500 hover:text-slate-700 underline">
              Logout
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h1 { font-family: 'Space Grotesk', sans-serif; }
        .glass-effect { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.6); }
      `}</style>
    </div>
  );
}
