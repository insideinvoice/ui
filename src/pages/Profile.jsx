import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PrintSettings from "./PrintSettings";
import { authAPI, businessAPI } from "../api/auth";
import { invalidateBusinessProfile } from "../utils/businessProfile";
import toast from "react-hot-toast";
import { User, Lock, Upload, Trash2, Pen, Eye, EyeOff, Landmark, Building, MapPin, Globe, Phone, Mail, Hash, FileText } from "lucide-react";

export default function Profile() {
  const { user, token, setUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.username || user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [signature, setSignature] = useState(null);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [ghostMode, setGhostMode] = useState(localStorage.getItem("ghost_mode") === "true");
  const [sealEnabled, setSealEnabled] = useState(localStorage.getItem("show_seal") === "true");
  const [businessData, setBusinessData] = useState(null);
  const [bankForm, setBankForm] = useState({ bankName: "", accountNo: "", branch: "", ifsc: "", bankAddress: "", upiId: "" });
  const [savingBank, setSavingBank] = useState(false);
  const [bizForm, setBizForm] = useState({ businessName: "", gstIn: "", phone: "", email: "", website: "", addressLine1: "", addressLine2: "", city: "", state: "", country: "", pincode: "", invoicePrefix: "" });
  const [savingBiz, setSavingBiz] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    businessAPI.getProfile()
      .then((res) => {
        const b = res.data.data;
        setSignature(b?.signature || null);
        setBusinessData(b);
        setBankForm({
          bankName: b?.bankName || "",
          accountNo: b?.accountNo || "",
          branch: b?.branch || "",
          ifsc: b?.ifsc || "",
          bankAddress: b?.bankAddress || "",
          upiId: b?.upiId || "",
        });
        setBizForm({
          businessName: b?.businessName || "",
          gstIn: b?.gstIn || "",
          phone: b?.phone || "",
          email: b?.email || "",
          website: b?.website || "",
          addressLine1: b?.addressLine1 || "",
          addressLine2: b?.addressLine2 || "",
          city: b?.city || "",
          state: b?.state || "",
          country: b?.country || "",
          pincode: b?.pincode || "",
          invoicePrefix: b?.invoicePrefix || "",
        });
      })
      .catch(() => {});
  }, []);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingName(true);
    try {
      const val = displayName.trim();
      const res = await authAPI.updateProfile({ name: val, username: val });
      const updated = { ...user, name: val, username: val };
      localStorage.setItem("user", JSON.stringify(updated));
      setUser(updated);
      toast.success(res.data.message || "Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    setSavingPw(true);
    try {
      const res = await authAPI.changePassword({ currentPassword, newPassword });
      toast.success(res.data.message || "Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setSavingPw(false);
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_048_576) {
      toast.error("File size must not exceed 1MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    setUploadingSig(true);
    try {
      const res = await businessAPI.uploadSignature(file);
      invalidateBusinessProfile();
      setSignature(res.data.data);
      toast.success("Signature uploaded successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload signature");
    } finally {
      setUploadingSig(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveSignature = async () => {
    setUploadingSig(true);
    try {
      await businessAPI.removeSignature();
      invalidateBusinessProfile();
      setSignature(null);
      toast.success("Signature removed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove signature");
    } finally {
      setUploadingSig(false);
    }
  };

  const handleBankSave = async (e) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      await businessAPI.update(bankForm);
      invalidateBusinessProfile();
      toast.success("Bank details updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update bank details");
    } finally {
      setSavingBank(false);
    }
  };

  const handleBizChange = (e) => {
    setBizForm({ ...bizForm, [e.target.name]: e.target.value });
  };

  const handleBizSave = async (e) => {
    e.preventDefault();
    setSavingBiz(true);
    try {
      await businessAPI.update(bizForm);
      invalidateBusinessProfile();
      toast.success("Business information updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update business information");
    } finally {
      setSavingBiz(false);
    }
  };

  const handleBankChange = (e) => {
    setBankForm({ ...bankForm, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Profile</h2>
          </div>

          <div className="mb-5 pb-4 border-b border-slate-100">
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Email</label>
            <p className="text-sm text-slate-800 font-medium">{user?.email || "—"}</p>
          </div>

          <form onSubmit={handleUpdateName} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all"
              />
            </div>
            <button type="submit" disabled={savingName || !displayName.trim()}
              className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm">
              {savingName ? "Saving..." : "Save"}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-slate-600" />
                <h2 className="text-base font-semibold text-slate-900">Ghost Mode</h2>
              </div>
              <button onClick={() => {
                const next = !ghostMode;
                setGhostMode(next);
                localStorage.setItem("ghost_mode", String(next));
              }}
                className={`relative w-11 h-6 rounded-full transition-colors ${ghostMode ? "bg-amber-500" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${ghostMode ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              When enabled, you can manually set the invoice number when creating invoices.
              Use this only for corrections (e.g., fixing a mistakenly generated invoice).
              Auto-increment resumes when Ghost Mode is off.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                <h2 className="text-base font-semibold text-slate-900">Company Seal</h2>
              </div>
              <button onClick={() => {
                const next = !sealEnabled;
                setSealEnabled(next);
                localStorage.setItem("show_seal", String(next));
              }}
                className={`relative w-11 h-6 rounded-full transition-colors ${sealEnabled ? "bg-blue-500" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${sealEnabled ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              When enabled, select the seal type on the invoice page before downloading.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Password</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all"
              />
            </div>
            <button type="submit" disabled={savingPw || !currentPassword || !newPassword}
              className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm">
              {savingPw ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Pen className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Signature</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">Upload your signature image to appear on invoices. Max 1MB.</p>

          {signature && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 inline-block mx-auto sm:mx-0">
              <img src={`data:image/png;base64,${signature}`} alt="Signature"
                className="h-24 object-contain" />
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleSignatureUpload}
              className="hidden"
              id="signature-upload"
            />
            <label htmlFor="signature-upload"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 cursor-pointer transition-all shadow-sm">
              <Upload className="w-4 h-4" />
              {uploadingSig ? "Uploading..." : signature ? "Change" : "Upload Signature"}
            </label>
            {signature && (
              <button onClick={handleRemoveSignature} disabled={uploadingSig}
                className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 transition-all">
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            )}
          </div>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Building className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Business Information</h2>
          </div>
          <form onSubmit={handleBizSave} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Business Name</label>
                <input type="text" name="businessName" value={bizForm.businessName} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">GSTIN</label>
                <input type="text" name="gstIn" value={bizForm.gstIn} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Phone</label>
                <input type="text" name="phone" value={bizForm.phone} onChange={handleBizChange} inputMode="numeric"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Email</label>
                <input type="email" name="email" value={bizForm.email} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Website</label>
                <input type="text" name="website" value={bizForm.website} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Invoice Prefix</label>
                <input type="text" name="invoicePrefix" value={bizForm.invoicePrefix} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Address Line 1</label>
                <input type="text" name="addressLine1" value={bizForm.addressLine1} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Address Line 2</label>
                <input type="text" name="addressLine2" value={bizForm.addressLine2} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">City</label>
                <input type="text" name="city" value={bizForm.city} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">State</label>
                <input type="text" name="state" value={bizForm.state} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Country</label>
                <input type="text" name="country" value={bizForm.country} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Pincode</label>
                <input type="text" name="pincode" value={bizForm.pincode} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
            </div>
            <button type="submit" disabled={savingBiz}
              className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm">
              {savingBiz ? "Saving..." : "Save Business Info"}
            </button>
          </form>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Landmark className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Company Bank Details</h2>
          </div>
          <form onSubmit={handleBankSave} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Bank Name</label>
                <input type="text" name="bankName" value={bankForm.bankName} onChange={handleBankChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Account No.</label>
                <input type="text" name="accountNo" value={bankForm.accountNo} onChange={handleBankChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Branch</label>
                <input type="text" name="branch" value={bankForm.branch} onChange={handleBankChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">IFSC Code</label>
                <input type="text" name="ifsc" value={bankForm.ifsc} onChange={handleBankChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all uppercase" />
              </div>
              <div className="md:col-span-2 lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Bank Address</label>
                <input type="text" name="bankAddress" value={bankForm.bankAddress} onChange={handleBankChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">UPI ID</label>
                <input type="text" name="upiId" value={bankForm.upiId} onChange={handleBankChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" placeholder="business@upi" />
                <p className="text-[10px] text-slate-400 mt-1">QR code will appear on invoices</p>
              </div>
            </div>
            <button type="submit" disabled={savingBank}
              className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm">
              {savingBank ? "Saving..." : "Save Bank Details"}
            </button>
          </form>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <PrintSettings noWrapper />
        </div>
        </div>
        </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h2, h3 { font-family: 'Space Grotesk', sans-serif; }
        input, select, textarea, button { font-family: inherit; }
      `}</style>
    </div>
  );
}
