import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import PrintSettings from "./PrintSettings";
import JurisdictionRegionSelect from "../components/JurisdictionRegionSelect";
import SealMark from "../components/SealMark";
import { authAPI, businessAPI } from "../api/auth";
import { invalidateBusinessProfile } from "../utils/businessProfile";
import { normalizeSealConfig, sealBoxMm, sealEdgeRange, SEAL_LIMITS } from "../utils/sealConfig";
import { formatInvoiceNumber } from "../utils/invoiceConvention";
import { formatJurisdiction } from "../utils/jurisdiction";
import { JURISDICTION_CENTRES } from "../constants/indianRegions";
import { INDUSTRY_LIST, DEFAULT_INDUSTRY, INDUSTRY_PROFILES } from "../constants/industryConfig";
import toast from "react-hot-toast";
import { User, Lock, Upload, Trash2, Pen, Eye, EyeOff, Landmark, Building, Image as ImageIcon, MapPin, Globe, Phone, Mail, Hash, Stamp } from "lucide-react";

export default function Profile() {
  const { user, setUser, refreshBusiness } = useAuth();

  const [displayName, setDisplayName] = useState(user?.username || user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [signature, setSignature] = useState(null);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [logo, setLogo] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [ghostMode, setGhostMode] = useState(localStorage.getItem("ghost_mode") === "true");
  const [sealEnabled, setSealEnabled] = useState(localStorage.getItem("show_seal") === "true");
  const [sealType, setSealType] = useState(localStorage.getItem("seal_type") === "stamp" ? "stamp" : "round");
  const [sealConfig, setSealConfig] = useState(() => normalizeSealConfig(localStorage.getItem("seal_config")));
  // How far the CURRENT seal can travel before it leaves the page. Recomputed
  // on every size change so the inputs can never push the mark off-sheet.
  const sealTravel = sealEdgeRange(sealType, sealConfig);
  // The A4 preview is opt-in: the controls themselves are the primary surface,
  // and the preview costs a real SealMark render on every keystroke.
  const [showSealPreview, setShowSealPreview] = useState(false);
  const [savingSeal, setSavingSeal] = useState(false);
  const [businessData, setBusinessData] = useState(null);
  const [bankForm, setBankForm] = useState({ bankName: "", accountNo: "", branch: "", ifsc: "", bankAddress: "", upiId: "" });
  const [savingBank, setSavingBank] = useState(false);
  const [bizForm, setBizForm] = useState({ businessName: "", industry: DEFAULT_INDUSTRY, gstIn: "", phone: "", email: "", website: "", addressLine1: "", addressLine2: "", city: "", state: "", country: "", pincode: "", invoicePrefix: "", specialistIn: "", specialistInEnabled: false, showHnSac: true, jurisdictionEnabled: true, jurisdictionRegion: "", jurisdictionCity: "" });
  const [savingBiz, setSavingBiz] = useState(false);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);

  useEffect(() => {
    businessAPI.getProfile()
      .then((res) => {
        const b = res.data.data;
        setSignature(b?.signature || null);
        setLogo(b?.logo || null);
        setBusinessData(b);
        // The seal preference is stored on the business so the emailed PDF and
        // the public share page (customer's device) match the owner's choice.
        if (typeof b?.sealEnabled === "boolean") {
          setSealEnabled(b.sealEnabled);
          localStorage.setItem("show_seal", String(b.sealEnabled));
        }
        if (b?.sealType) {
          const savedType = b.sealType === "stamp" ? "stamp" : "round";
          setSealType(savedType);
          localStorage.setItem("seal_type", savedType);
        }
        setSealConfig(normalizeSealConfig(b?.sealConfig ?? localStorage.getItem("seal_config")));
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
          industry: b?.industry || DEFAULT_INDUSTRY,
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
          specialistIn: b?.specialistIn || "",
          specialistInEnabled: !!b?.specialistInEnabled,
          showHnSac: b?.showHnSac !== false,
          jurisdictionEnabled: b?.jurisdictionEnabled !== false,
          jurisdictionRegion: b?.jurisdictionRegion || "",
          jurisdictionCity: b?.jurisdictionCity || "",
        });
      })
      .catch(() => {});
  }, []);

  const setSealField = (field, value) => {
    setSealConfig((current) => ({
      ...current,
      [sealType]: { ...current[sealType], [field]: value },
    }));
  };

  const chooseSealType = (type) => {
    setSealType(type);
    localStorage.setItem("seal_type", type);
    setBusinessData((d) => (d ? { ...d, sealType: type } : d));
    // Switching the active variant should take effect on the next download
    // even before the placement values are saved.
    businessAPI
      .update({ sealType: type })
      .then(() => invalidateBusinessProfile())
      .catch(() => {});
  };

  const handleSaveSeal = async () => {
    setSavingSeal(true);
    try {
      // Normalise/clamp before saving: empty or out-of-range inputs become the
      // page-safe values every renderer expects (same rules as the backend).
      const normalized = normalizeSealConfig(sealConfig);
      const res = await businessAPI.update({
        sealEnabled: true,
        sealType,
        sealConfig: normalized,
      });
      setSealConfig(normalized);
      setSealEnabled(true);
      localStorage.setItem("seal_config", JSON.stringify(normalized));
      localStorage.setItem("seal_type", sealType);
      localStorage.setItem("show_seal", "true");
      setBusinessData(res.data.data);
      invalidateBusinessProfile();
      await refreshBusiness?.();
      toast.success(res.data.message || "Seal settings saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save seal settings");
    } finally {
      setSavingSeal(false);
    }
  };

  const resetSealConfig = () => {
    setSealConfig(normalizeSealConfig(null));
  };

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
      setSignature(null);
      toast.success("Signature removed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove signature");
    } finally {
      setUploadingSig(false);
    }
  };

  // Business logo (Enterprise template): same contract as the signature flow —
  // magic-byte validation happens server-side, the Base64 payload is echoed
  // back and persisted, and the template reads it as a data URI.
  const handleLogoUpload = async (e) => {
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
    setUploadingLogo(true);
    try {
      const res = await businessAPI.uploadLogo(file);
      setLogo(res.data.data);
      toast.success("Logo uploaded successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      await businessAPI.removeLogo();
      setLogo(null);
      toast.success("Logo removed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBankSave = async (e) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      await businessAPI.update(bankForm);
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

  const handleSpecialistToggle = () => {
    setBizForm({ ...bizForm, specialistInEnabled: !bizForm.specialistInEnabled });
  };

  const handleShowHnSacToggle = () => {
    setBizForm({ ...bizForm, showHnSac: !bizForm.showHnSac });
  };

  const handleJurisdictionToggle = () => {
    setBizForm((f) => ({ ...f, jurisdictionEnabled: !f.jurisdictionEnabled }));
  };

  const handleJurisdictionCityChange = (e) => {
    setBizForm((f) => ({ ...f, jurisdictionCity: e.target.value }));
  };

  // Convenience only: fills the city with the region's common capital /
  // administrative centre. Never automatic — the owner edits whatever suits.
  const suggestJurisdictionCentre = () => {
    const centre = JURISDICTION_CENTRES[bizForm.jurisdictionRegion];
    if (centre) setBizForm((f) => ({ ...f, jurisdictionCity: centre }));
  };

  const handleBizSave = async (e) => {
    e.preventDefault();
    if (bizForm.jurisdictionEnabled && !bizForm.jurisdictionCity.trim()) {
      toast.error("Enter the jurisdiction city / location, or turn off the jurisdiction line");
      return;
    }
    setSavingBiz(true);
    try {
      const res = await businessAPI.update(bizForm);
      const updated = res?.data?.data;
      if (updated) setBusinessData(updated);
      invalidateBusinessProfile();
      refreshBusiness?.();
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

        <div className="grid grid-cols-1 gap-6">
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
                <Stamp className="w-5 h-5 text-slate-600" />
                <h2 className="text-base font-semibold text-slate-900">Company Seal</h2>
              </div>
              <button onClick={() => {
                const next = !sealEnabled;
                setSealEnabled(next);
                localStorage.setItem("show_seal", String(next));
                setBusinessData((d) => (d ? { ...d, sealEnabled: next } : d));
                // Persist server-side: this is what the emailed PDF and the
                // public share page read, so the toggle must not stay local.
                businessAPI
                  .update({ sealEnabled: next })
                  .then(() => invalidateBusinessProfile())
                  .catch(() => {});
              }}
                className={`relative w-11 h-6 rounded-full transition-colors ${sealEnabled ? "bg-blue-500" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${sealEnabled ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {sealEnabled
                ? "Set where the seal sits on the page, how big it is and how far it is tilted. The same mark is stamped on every page."
                : "Turn on to stamp your company seal on invoices, delivery challans and shared links."}
            </p>

            {sealEnabled && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Seal type</p>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {[
                      { id: "round", label: "Round Seal" },
                      { id: "stamp", label: "Rubber Stamp" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => chooseSealType(option.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          sealType === option.id
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Multi-page</p>
                    <p className="text-[11px] text-slate-500">
                      Stamp the seal on every page. Turn off to stamp only the final page, next to the grand total.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sealConfig.allPages}
                    onClick={() => setSealConfig((c) => ({ ...c, allPages: !c.allPages }))}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      sealConfig.allPages ? "bg-blue-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        sealConfig.allPages ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SealNumberField
                    label={sealType === "stamp" ? "Width (mm)" : "Size (mm)"}
                    value={sealConfig[sealType].sizeMm}
                    min={sealType === "stamp" ? SEAL_LIMITS.stamp.minSize : SEAL_LIMITS.round.minSize}
                    max={sealType === "stamp" ? SEAL_LIMITS.stamp.maxSize : SEAL_LIMITS.round.maxSize}
                    step={0.5}
                    onChange={(value) => setSealField("sizeMm", value)}
                  />
                  <SealNumberField
                    label="Tilt (°)"
                    value={sealConfig[sealType].tilt}
                    min={SEAL_LIMITS.minTilt}
                    max={SEAL_LIMITS.maxTilt}
                    step={1}
                    onChange={(value) => setSealField("tilt", value)}
                  />
                  <SealNumberField
                    label="From right (mm)"
                    value={sealConfig[sealType].rightMm}
                    min={SEAL_LIMITS.minEdge}
                    max={sealTravel.rightMm}
                    step={1}
                    onChange={(value) => setSealField("rightMm", value)}
                  />
                  <SealNumberField
                    label="From bottom (mm)"
                    value={sealConfig[sealType].bottomMm}
                    min={SEAL_LIMITS.minEdge}
                    max={sealTravel.bottomMm}
                    step={1}
                    onChange={(value) => setSealField("bottomMm", value)}
                  />
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Page preview
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSealPreview((visible) => !visible)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-700"
                  >
                    {showSealPreview ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Hide preview
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Show preview
                      </>
                    )}
                  </button>
                </div>

                {showSealPreview && (
                  <div className="mt-2 flex items-center justify-center rounded-lg bg-slate-50 py-4">
                    <SealPreview
                      business={{ ...businessData, businessName: bizForm.businessName || businessData?.businessName }}
                      type={sealType}
                      config={sealConfig}
                    />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSeal}
                    disabled={savingSeal}
                    className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {savingSeal ? "Saving..." : "Save seal settings"}
                  </button>
                  <button
                    type="button"
                    onClick={resetSealConfig}
                    disabled={savingSeal}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all"
                  >
                    Reset to default
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                  Applied to every page of invoices, delivery challans, emailed PDFs and shared links.
                </p>
              </div>
            )}
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
            <ImageIcon className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Business Logo</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">Prints in a fixed top-left box on the Enterprise template. PNG/JPG/WebP, max 1MB.</p>

          <div className="mb-4 flex justify-center sm:block">
            <div className="h-24 w-48 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
              {logo ? (
                <img src={`data:image/png;base64,${logo}`} alt="Business logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">No logo uploaded</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              id="logo-upload"
            />
            <label htmlFor="logo-upload"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 cursor-pointer transition-all shadow-sm">
              <Upload className="w-4 h-4" />
              {uploadingLogo ? "Uploading..." : logo ? "Change" : "Upload Logo"}
            </label>
            {logo && (
              <button onClick={handleRemoveLogo} disabled={uploadingLogo}
                className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 transition-all">
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            )}
          </div>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Industry</label>
                <select name="industry" value={bizForm.industry} onChange={handleBizChange}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all">
                  {INDUSTRY_LIST.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {INDUSTRY_PROFILES[bizForm.industry]?.description}
                </p>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Invoice Convention</label>
                <input type="text" name="invoicePrefix" value={bizForm.invoicePrefix} onChange={handleBizChange}
                  placeholder="INV-RSHWE / INV-2026 / INV-00001"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
                <p className="text-[10px] text-slate-400 mt-1">Blank → 1, 2, 3... · INV-RSHWE → INV-RSHWE-1 · INV-2026 → INV-2026-1 · INV-00001 → INV-00001, INV-00002 · Next: {formatInvoiceNumber(bizForm.invoicePrefix, businessData?.nextInvoiceSequence ?? 1)}</p>
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
              <div className="md:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase">Specialist In</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Show on invoice</span>
                    <button type="button" onClick={handleSpecialistToggle} aria-label="Show Specialist In on invoice"
                      className={`relative w-11 h-6 rounded-full transition-colors ${bizForm.specialistInEnabled ? "bg-blue-500" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${bizForm.specialistInEnabled ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                </div>
                <input type="text" name="specialistIn" value={bizForm.specialistIn} onChange={handleBizChange}
                  disabled={!bizForm.specialistInEnabled}
                  placeholder="ALL KINDS OF ELECTRICAL & HARDWARE MATERIALS"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all disabled:bg-slate-50 disabled:text-slate-400" />
                <p className="text-[10px] text-slate-400 mt-1">Printed under the address on the invoice when enabled.</p>
              </div>
              {bizForm.industry === "CONSTRUCTION" && (
              <div className="md:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">Show HSN/SAC on Invoices</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Display only — stored codes and GST calculations are never affected.</span>
                  </div>
                  <button type="button" onClick={handleShowHnSacToggle} aria-label="Show HSN/SAC on invoices"
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${bizForm.showHnSac ? "bg-blue-500" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${bizForm.showHnSac ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              </div>
              )}
              <div className="md:col-span-2 lg:col-span-3">
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/60">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Invoice Jurisdiction</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Show jurisdiction on invoice</span>
                      <button type="button" onClick={handleJurisdictionToggle} aria-label="Show jurisdiction on invoice"
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${bizForm.jurisdictionEnabled ? "bg-blue-500" : "bg-slate-300"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${bizForm.jurisdictionEnabled ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Jurisdiction Region</label>
                      <JurisdictionRegionSelect
                        value={bizForm.jurisdictionRegion}
                        onChange={(region) => setBizForm((f) => ({ ...f, jurisdictionRegion: region }))}
                        disabled={!bizForm.jurisdictionEnabled}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Pick the Indian state or Union Territory your invoices should reference.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Jurisdiction City / Location</label>
                      <input
                        type="text"
                        name="jurisdictionCity"
                        value={bizForm.jurisdictionCity}
                        onChange={handleJurisdictionCityChange}
                        disabled={!bizForm.jurisdictionEnabled}
                        placeholder="e.g., Bengaluru"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all disabled:bg-slate-50 disabled:text-slate-400"
                      />
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-[10px] text-slate-400">Enter the city or location whose jurisdiction should appear on your invoices.</p>
                        {bizForm.jurisdictionEnabled
                          && bizForm.jurisdictionRegion
                          && JURISDICTION_CENTRES[bizForm.jurisdictionRegion]
                          && JURISDICTION_CENTRES[bizForm.jurisdictionRegion].toLowerCase() !== bizForm.jurisdictionCity.trim().toLowerCase() && (
                          <button
                            type="button"
                            onClick={suggestJurisdictionCentre}
                            title="Suggestion only — edit as needed; the capital is not automatically the correct jurisdiction."
                            className="shrink-0 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-md px-2 py-1 transition-colors"
                          >
                            Use {JURISDICTION_CENTRES[bizForm.jurisdictionRegion]}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Preview on invoice</p>
                    {bizForm.jurisdictionEnabled ? (
                      <div style={{ fontWeight: "bold", textTransform: "none" }}>
                        {formatJurisdiction(bizForm.jurisdictionCity) || (
                          <span className="italic font-normal" style={{ textTransform: "none" }}>
                            Enter a city above to preview the jurisdiction line
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">Jurisdiction display is off — the line will not appear on your invoices. The Computer Generated notice is unaffected.</p>
                    )}
                  </div>
                </div>
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

function SealNumberField({ label, value, onChange, min, max, step = 1 }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
      />
    </label>
  );
}

// Mini A4 sheet (168 px ≈ 210 mm) with the seal placed at the configured
// right/bottom edge and size, so the four numbers have an immediate visual.
function SealPreview({ business, type, config }) {
  const pageWidth = 168;
  const scale = pageWidth / 210;
  const pageHeight = 297 * scale;
  const cfg = normalizeSealConfig(config);
  const variant = type === "stamp" ? "stamp" : "round";
  const variantCfg = cfg[variant];
  const box = sealBoxMm(variant, cfg);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          position: "relative",
          width: pageWidth,
          height: pageHeight,
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: 4,
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: "#cbd5e1",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          A4 preview
        </span>
        <div
          style={{
            position: "absolute",
            right: variantCfg.rightMm * scale,
            bottom: variantCfg.bottomMm * scale,
            width: box.w * scale,
            height: box.h * scale,
          }}
        >
          <SealMark business={business} type={variant} config={cfg} pxWidth={box.w * scale} />
        </div>
      </div>
      <p className="text-[10px] text-slate-400">
        {box.w.toFixed(0)}×{box.h.toFixed(0)} mm · {variantCfg.tilt}° · {variantCfg.rightMm}/{variantCfg.bottomMm} mm from edges
      </p>
    </div>
  );
}
