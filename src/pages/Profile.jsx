import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import JurisdictionRegionSelect from "../components/JurisdictionRegionSelect";
import SealMark from "../components/SealMark";
import { authAPI, businessAPI } from "../api/auth";
import { invalidateBusinessProfile } from "../utils/businessProfile";
import { normalizeSealConfig, sealBoxMm, sealEdgeRange, SEAL_LIMITS, SEAL_PAGE, SEAL_DEFAULT_COLOR } from "../utils/sealConfig";
import { formatInvoiceNumber } from "../utils/invoiceConvention";
import { formatJurisdiction } from "../utils/jurisdiction";
import { JURISDICTION_CENTRES } from "../constants/indianRegions";
import { INDUSTRY_LIST, DEFAULT_INDUSTRY, INDUSTRY_PROFILES } from "../constants/industryConfig";
import toast from "react-hot-toast";
import { User, Lock, Upload, Trash2, Pen, Eye, EyeOff, Landmark, Building, Image as ImageIcon, MapPin, Stamp, Check, X, Info, ScrollText, Plus, Settings, ChevronDown, FileSignature, Images } from "lucide-react";
import PageHeader from "../components/PageHeader";

export default function Profile() {
  const { user, setUser, refreshBusiness } = useAuth();

  // The field edits the Instagram-style handle: the same value feeds both
  // name and username. originalName tracks the SAVED value (setUser below
  // re-derives it), which is what "only enable Save on a real change" means.
  const originalName = user?.username || user?.name || "";
  const [displayName, setDisplayName] = useState(originalName);
  const [usernameFree, setUsernameFree] = useState(null); // null = unchanged / not checked / check failed
  const trimmedName = displayName.trim();
  const nameChanged = trimmedName !== originalName && trimmedName.length > 0;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  // Username edit is opt-in: the field renders like the read-only email row
  // (value with a pencil at the right corner); clicking the pencil swaps it
  // for an input with the Save button on the same line.
  const [editingName, setEditingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  // Password edit is opt-in like the username: the section shows a masked
  // value with the pencil at the right corner until the pencil is clicked.
  const [editingPw, setEditingPw] = useState(false);
  // New-password show/hide (bootstrap the field hidden like every editor).
  const [showNewPw, setShowNewPw] = useState(false);
  // Seal size/position values follow the same pattern: read-only cards with
  // an edit pencil — the four number inputs (and their Save) only appear
  // after the pencil is clicked.
  const [editingSeal, setEditingSeal] = useState(false);
  const sealSnapshotRef = useRef(null);
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
  const [bizForm, setBizForm] = useState({ businessName: "", industry: DEFAULT_INDUSTRY, gstIn: "", phone: "", additionalPhone: "", email: "", website: "", addressLine1: "", addressLine2: "", city: "", state: "", country: "", pincode: "", invoicePrefix: "", specialistIn: "", specialistInEnabled: false, showHnSac: true, jurisdictionEnabled: true, jurisdictionRegion: "", jurisdictionCity: "" });
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
          additionalPhone: b?.additionalPhone || "",
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

  // Instagram-style availability check, debounced so keystrokes don't hammer
  // the API. Skipped while the value equals the saved handle (nothing to
  // save there anyway) and below the server's 3-character minimum.
  useEffect(() => {
    if (!nameChanged || trimmedName.length < 3) {
      setUsernameFree(null);
      return undefined;
    }
    let cancelled = false;
    setUsernameFree(null); // a stale result must not linger while the new check runs
    const t = setTimeout(() => {
      authAPI.checkUsername(trimmedName)
        .then((res) => { if (!cancelled) setUsernameFree(!!res.data.data); })
        .catch(() => { if (!cancelled) setUsernameFree(null); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [trimmedName, nameChanged]);

  const setSealField = (field, value) => {
    setSealConfig((current) => ({
      ...current,
      [sealType]: { ...current[sealType], [field]: value },
    }));
  };

  // Click-to-place on the A4 preview: the click point becomes the seal's new
  // home, so both edge gaps are written together in one update.
  const placeSealAt = (rightMm, bottomMm) => {
    setSealConfig((current) => ({
      ...current,
      [sealType]: { ...current[sealType], rightMm, bottomMm },
    }));
  };

  const chooseSealType = (type) => {
    const previous = sealType;
    setSealType(type);
    localStorage.setItem("seal_type", type);
    setBusinessData((d) => (d ? { ...d, sealType: type } : d));
    // Switching the active variant should take effect on the next download
    // even before the placement values are saved.
    businessAPI
      .update({ sealType: type })
      .then(() => invalidateBusinessProfile())
      .catch((err) => {
        // A silent revert would leave the card showing a variant the server
        // never accepted; snap back locally and say so.
        setSealType(previous);
        localStorage.setItem("seal_type", previous);
        setBusinessData((d) => (d ? { ...d, sealType: previous } : d));
        toast.error(err.response?.data?.message || "Failed to update seal type");
      });
  };

  // The enable switch must not lie either: it drives what downloads,
  // shared links and emailed PDFs render, so a failed swap snaps the
  // toggle (and its localStorage mirror) back and surfaces the error.
  const toggleSealEnabled = () => {
    const next = !sealEnabled;
    setSealEnabled(next);
    localStorage.setItem("show_seal", String(next));
    setBusinessData((d) => (d ? { ...d, sealEnabled: next } : d));
    if (!next) {
      // Turning the seal off while its editor is open would strand an
      // invisible editing session; close it cleanly instead.
      sealSnapshotRef.current = null;
      setEditingSeal(false);
      setShowSealPreview(false);
    }
    // Persist server-side: this is what the emailed PDF and the public
    // share page read, so the toggle must not stay local.
    businessAPI
      .update({ sealEnabled: next })
      .then(() => invalidateBusinessProfile())
      .catch((err) => {
        setSealEnabled(!next);
        localStorage.setItem("show_seal", String(!next));
        toast.error(err.response?.data?.message || "Failed to update seal setting");
      });
  };

  // Multi-page is a behaviour switch, not a placement draft: it persists the
  // moment it's flipped — the same contract as the seal enable and seal type
  // switches. It used to wait for Save, which is a trap: the owner flips it
  // off, walks away, and every downloaded PDF still stamps page 1 because
  // downloads read the SERVER value while the card showed local state.
  const toggleSealAllPages = () => {
    const next = !sealConfig.allPages;
    const draft = { ...sealConfig, allPages: next };
    setSealConfig(draft);
    // A still-open editor's Cancel snapshot follows the switch: Cancel
    // restores the unsaved drafts (size, tilt, ink, placement) — not a value
    // the server has already accepted.
    if (sealSnapshotRef.current) {
      sealSnapshotRef.current = { ...sealSnapshotRef.current, allPages: next };
    }
    // Partial update — the backend keeps the stored variants and takes only
    // allPages, so placement/ink drafts are not published by this flip.
    businessAPI
      .update({ sealConfig: { allPages: next } })
      .then(() => {
        localStorage.setItem("seal_config", JSON.stringify(draft));
        invalidateBusinessProfile();
      })
      .catch((err) => {
        // Unlike its siblings this one reports failure: a silent revert is
        // exactly what left the UI claiming a state the downloads ignored.
        setSealConfig((c) => (c.allPages === next ? { ...c, allPages: !next } : c));
        if (sealSnapshotRef.current?.allPages === next) {
          sealSnapshotRef.current = { ...sealSnapshotRef.current, allPages: !next };
        }
        toast.error(err.response?.data?.message || "Failed to update multi-page");
      });
  };

  // source: "inline" = the Position & size editor's own short Save (own
  // wording, toast "Saved"); "settings" = the bottom Save seal settings row
  // (keeps the backend message). Both persist server-side and push the new
  // seal into the business context, so shareable links, downloads and
  // emailed PDFs pick it up immediately for this user.
  const handleSaveSeal = async (source = "settings") => {
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
      toast.success("Settings updated successfully");
      // Saving from the inline editor closes it back to the read-only cards.
      sealSnapshotRef.current = null;
      setEditingSeal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || (source === "inline" ? "Failed to save" : "Failed to save seal settings"));
    } finally {
      setSavingSeal(false);
    }
  };

  const resetSealConfig = () => {
    setSealConfig(normalizeSealConfig(null));
  };

  // Pencil → editable: snapshot the current values (immutable — updates
  // replace the object) so Cancel restores them exactly. Nothing is
  // persisted until Save — except the Multi-page switch, which saves
  // itself on flip (toggleSealAllPages) like the type/enable switches.
  const startSealEdit = () => {
    sealSnapshotRef.current = sealConfig;
    setEditingSeal(true);
    // The A4 preview is the working tool of this editor (click-to-place) —
    // open it automatically so the preview column is populated on entry.
    setShowSealPreview(true);
  };

  const cancelSealEdit = () => {
    if (sealSnapshotRef.current) setSealConfig(sealSnapshotRef.current);
    sealSnapshotRef.current = null;
    setEditingSeal(false);
  };

  const handleUpdateName = async (e) => {
    e.preventDefault();
    const val = displayName.trim();
    // Save is a no-op without a real, legal change (the button is disabled
    // anyway; this guards against Enter-on-an-unfocused-form edge cases).
    if (!val || val === originalName || val.length < 3) return;
    setSavingName(true);
    try {
      await authAPI.updateProfile({ name: val, username: val });
      const updated = { ...user, name: val, username: val };
      localStorage.setItem("user", JSON.stringify(updated));
      setUser(updated);
      setUsernameFree(null);
      setDisplayName(val);
      setEditingName(false);
      toast.success("Settings updated successfully");
    } catch (err) {
      // 409 = someone else claimed the handle since our last check.
      if (err.response?.status === 409) setUsernameFree(false);
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingName(false);
    }
  };

  // Discard any in-progress edit and return to the read-only display.
  const cancelNameEdit = () => {
    setDisplayName(originalName);
    setUsernameFree(null);
    setEditingName(false);
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
      await authAPI.changePassword({ currentPassword, newPassword });
      toast.success("Settings updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setShowNewPw(false);
      setEditingPw(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setSavingPw(false);
    }
  };

  // Close the editor without changing anything (clears typed passwords so a
  // later open always starts empty).
  const cancelPwEdit = () => {
    setCurrentPassword("");
    setNewPassword("");
    setShowNewPw(false);
    setEditingPw(false);
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
    // Removal deletes the stored image straight away; guard against a stray
    // click with one confirmation, phrased to reassure it is recoverable.
    if (!window.confirm("Remove the signature? You can upload a new one anytime.")) return;
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
    // Same one-tap-does-not-destroy guard as the signature removal above.
    if (!window.confirm("Remove the business logo? You can upload a new one anytime.")) return;
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
      const res = await businessAPI.update(bankForm);
      // Keep the local business record and the cached profile in step —
      // other pages read bank details (QR on invoices, share page), so a
      // stale cache must not survive a save.
      const updated = res?.data?.data;
      if (updated) setBusinessData(updated);
      invalidateBusinessProfile();
      refreshBusiness?.();
      setEditingBank(false);
      toast.success("Settings updated successfully");
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
    // A blank business name must never be saved: the name prints on every
    // invoice header and the backend accepts strings without complaining.
    if (!bizForm.businessName.trim()) {
      toast.error("Business name is required");
      return;
    }
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
      setEditingBiz(false);
      toast.success("Settings updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update business information");
    } finally {
      setSavingBiz(false);
    }
  };

  const handleBankChange = (e) => {
    setBankForm({ ...bankForm, [e.target.name]: e.target.value });
  };

  // Save only when the handle actually changed, is legal length and — when we
  // know — is not already taken by someone else. While a check is still in
  // flight the button stays usable: the server re-validates on save anyway.
  // Business Information follows the same pattern as the Profile card:
  // saved values stay read-only with an edit pencil in the card's top-right
  // corner. The pencil reveals the form (Cancel discards changes, Save
  // persists and collapses back to the read-only view).
  const [editingBiz, setEditingBiz] = useState(false);
  const bizEditSnapshotRef = useRef(null);
  const startBizEdit = () => {
    bizEditSnapshotRef.current = bizForm;
    setEditingBiz(true);
  };
  const cancelBizEdit = () => {
    if (bizEditSnapshotRef.current) setBizForm(bizEditSnapshotRef.current);
    setEditingBiz(false);
  };

  // Read-only summary helpers for the collapsed Business Information card.
  const dv = (v) => (typeof v === "string" && v.trim() ? v.trim() : "—");
  const bizField = (label, value, span = "") => (
    <div className={`min-w-0 ${span}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-slate-800 break-words mt-0.5">{value}</p>
    </div>
  );
  const industryName = INDUSTRY_LIST.find((o) => o.id === bizForm.industry)?.name || bizForm.industry;
  const bizInvoicePrefix = (bizForm.invoicePrefix || "").trim() || "Default (1, 2, 3…)";
  const bizAddress = [bizForm.addressLine1, bizForm.addressLine2, bizForm.city, bizForm.state, bizForm.country, bizForm.pincode]
    .map((part) => (typeof part === "string" ? part.trim() : "")).filter(Boolean).join(", ") || "—";
  const bizSpecialist = !bizForm.specialistInEnabled
    ? "Hidden"
    : (bizForm.specialistIn || "").trim() || "Set a value to print";
  const bizJurisdiction = !bizForm.jurisdictionEnabled
    ? "Off"
    : [dv(bizForm.jurisdictionRegion), dv(bizForm.jurisdictionCity)].filter((part) => part !== "—").join(" · ") || "Enabled";

  // Company Bank Details uses the identical read-only + pencil pattern:
  // saved values collapsed by default, pencil reveals the form, Cancel
  // restores the pre-edit snapshot, Save persists and collapses back.
  const [editingBank, setEditingBank] = useState(false);
  const bankEditSnapshotRef = useRef(null);
  const startBankEdit = () => {
    bankEditSnapshotRef.current = bankForm;
    setEditingBank(true);
  };
  const cancelBankEdit = () => {
    if (bankEditSnapshotRef.current) setBankForm(bankEditSnapshotRef.current);
    setEditingBank(false);
  };

  // Terms & Conditions: up to five lines the owner writes once; every invoice
  // footer will print them (template rendering lands with the redesign — data
  // is stored now). Same read-only + pencil pattern as the other cards.
  const [termsList, setTermsList] = useState([]);
  const [editingTerms, setEditingTerms] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const termsSnapshotRef = useRef(null);
  // Set after a failed save attempt so blank/oversized rows get flagged red;
  // cleared as soon as the user edits any line again.
  const [termsIssues, setTermsIssues] = useState(false);

  // Global-standard per-line budget: at most 20 words (≈ the reference clause
  // "For home services, specify whether follow-up visits for the same issue
  // within a defined period are included or billed separately.") with the
  // backend's 200-character guard as a hard backstop. Both are enforced on
  // every keystroke, so oversized lines can never be typed in the first place.
  const TERMS_MAX_WORDS = 20;
  const TERMS_LINE_MAX_CHARS = 200;
  const countTermsWords = (text) => (text || "").trim().split(/\s+/).filter(Boolean).length;
  const clampTermsLine = (value) => {
    const words = (value || "").trim().split(/\s+/).filter(Boolean);
    const line = words.length > TERMS_MAX_WORDS
      ? words.slice(0, TERMS_MAX_WORDS).join(" ")
      : (value || "");
    return line.length > TERMS_LINE_MAX_CHARS ? line.slice(0, TERMS_LINE_MAX_CHARS) : line;
  };

  // Parse the stored JSON array into a plain list whenever business data lands.
  useEffect(() => {
    try {
      const parsed = businessData?.termsConditions ? JSON.parse(businessData.termsConditions) : [];
      setTermsList(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTermsList([]);
    }
  }, [businessData?.termsConditions]);

  const startTermsEdit = () => {
    termsSnapshotRef.current = termsList;
    setTermsList(termsList.length ? termsList : [""]);
    setTermsIssues(false);
    setEditingTerms(true);
  };
  const cancelTermsEdit = () => {
    if (termsSnapshotRef.current) setTermsList(termsSnapshotRef.current);
    termsSnapshotRef.current = null;
    setEditingTerms(false);
  };
  const updateTermAt = (index, value) => {
    setTermsIssues(false);
    // Clamp on every keystroke: the 12th..nth word past the budget is
    // dropped immediately — a wall of text can never be entered on one line.
    setTermsList((list) => list.map((t, at) => (at === index ? clampTermsLine(value) : t)));
  };
  const addTermRow = () =>
    setTermsList((list) => (list.length < 5 ? [...list, ""] : list));
  // The first line is permanent — it can be emptied but never removed, so
  // the editor always keeps one row to type into.
  const removeTermRow = (index) =>
    setTermsList((list) => (index === 0 ? list : list.filter((_, at) => at !== index)));

  const handleTermsSave = async () => {
    // The first line may be empty (it can't be removed — it's the row you
    // always keep); every line after it must be filled in or removed with
    // its X. The 200-character cap mirrors the backend guard (V40
    // hardening) so the user sees it before the request is even sent.
    const cleaned = termsList.map((t) => (t || "").trim()).filter(Boolean);
    if (termsList.slice(1).some((t) => !(t || "").trim())) {
      setTermsIssues(true);
      toast.error("Fill in every line after the first, or remove empty ones with X");
      return;
    }
    if (!cleaned.length) {
      setTermsIssues(true);
      toast.error("Add at least one term before saving");
      return;
    }
    if (cleaned.some((t) => t.length > TERMS_LINE_MAX_CHARS)) {
      setTermsIssues(true);
      toast.error("Each line must be 200 characters or fewer");
      return;
    }
    setSavingTerms(true);
    try {
      const res = await businessAPI.update({ termsConditions: cleaned });
      const updated = res?.data?.data;
      if (updated) setBusinessData(updated);
      invalidateBusinessProfile();
      refreshBusiness?.();
      termsSnapshotRef.current = null;
      setEditingTerms(false);
      toast.success("Settings updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update terms & conditions");
    } finally {
      setSavingTerms(false);
    }
  };

  const canSaveName = nameChanged && trimmedName.length >= 3 && usernameFree !== false && !savingName;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        {/* Orientation banner — tells the user where they are ("Settings",
            with the app's standard back arrow) before the card wall starts.
            Especially important on phones where there is no sidebar. */}
        <PageHeader
          title="Settings"
          icon={Settings}
          subtitle="Profile · Business details · Branding · Terms · Preferences"
          showBack={false}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* One pencil for the whole card: it opens the username AND the
              password editors together (the old per-row pencils are gone).
              While either editor is open the corner button becomes ✕ and
              discards both. */}
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Profile</h2>
            </div>
            {!(editingName || editingPw) ? (
              <button
                type="button"
                onClick={() => { setEditingName(true); setEditingPw(true); }}
                title="Edit username & password"
                aria-label="Edit username and password"
                className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-colors">
                <Pen className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { cancelNameEdit(); cancelPwEdit(); }}
                title="Cancel"
                aria-label="Cancel editing username and password"
                className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/20 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Email is PERMANENT — no edit path exists anywhere: the frontend
              only ever sends { name, username } and the backend's
              UpdateProfileRequest has no email field at all, so a registered
              address can never change. The lock is deliberate, not missing
              UI — username/password share the card's single pencil; email
              gets a padlock. */}
          <div className="mb-5 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Email</label>
                <p className="text-sm text-slate-800 font-medium break-words">{user?.email || "—"}</p>
              </div>
              <span
                title="Email can't be changed once registered"
                aria-label="Email is permanent and cannot be changed"
                className="shrink-0 p-2 text-slate-300">
                <Lock className="w-4 h-4" />
              </span>
            </div>
          </div>

          {/* Username — read-only value; the card's corner pencil (above)
              swaps it for the input with Save on the same line. */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">User Name</label>
                {!editingName && (
                  <p className="text-sm text-slate-800 font-medium break-words">{originalName || "—"}</p>
                )}
              </div>
            </div>

            {editingName && (
              <form onSubmit={handleUpdateName} className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    aria-label="User Name"
                    placeholder="Enter username"
                    className="flex-1 min-w-0 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all"
                  />
                  <button type="submit" disabled={!canSaveName}
                    className="shrink-0 px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm">
                    {savingName ? "Saving..." : "Save"}
                  </button>
                  <button type="button" onClick={cancelNameEdit}
                    title="Cancel" aria-label="Cancel editing username"
                    className="shrink-0 p-2.5 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {nameChanged && trimmedName.length < 3 && (
                  <p className="text-[11px] text-amber-600">
                    Username must be at least 3 characters
                  </p>
                )}
                {nameChanged && trimmedName.length >= 3 && usernameFree === true && (
                  <p className="flex items-center gap-1 text-[11px] text-emerald-600">
                    <Check className="w-3 h-3" /> This username is available
                  </p>
                )}
                {nameChanged && trimmedName.length >= 3 && usernameFree === false && (
                  <p className="flex items-center gap-1 text-[11px] text-red-500">
                    <X className="w-3 h-3" /> This username is already taken
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Password — masked read-only value; the card's corner pencil
              (above) opens the change-password form along with the username
              input. */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Password</h3>
                </div>
                {!editingPw && (
                  <p className="text-sm text-slate-800 font-medium tracking-[0.3em]" aria-label="Password">••••••••</p>
                )}
              </div>
            </div>

            {editingPw && (
            <form onSubmit={handleChangePassword} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Current Password</label>
                {/* No autoFocus here: the card pencil opens BOTH editors and
                    the username input (mounted first) holds the focus. */}
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pr-11 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all"
                  />
                  <button type="button" onClick={() => setShowNewPw((v) => !v)}
                    title={showNewPw ? "Hide password" : "Show password"}
                    aria-label={showNewPw ? "Hide new password" : "Show new password"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-colors">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={savingPw || !currentPassword || !newPassword}
                  className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm">
                  {savingPw ? "Changing..." : "Change Password"}
                </button>
                <button type="button" onClick={cancelPwEdit}
                  title="Cancel" aria-label="Cancel password change"
                  className="p-2.5 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Stamp className="w-5 h-5 text-slate-600" />
                <h2 className="text-base font-semibold text-slate-900">Company Seal</h2>
                {/* Scope note — moved here from the old bottom paragraph so it
                    no longer eats a full line. Hover the ⓘ (or focus/tap it —
                    it's focusable) to read where the seal is applied. */}
                <span className="relative inline-flex group" tabIndex={0} aria-describedby="seal-scope-tip">
                  <Info className="w-3.5 h-3.5 text-slate-400 cursor-help transition-colors group-hover:text-slate-600 group-focus:text-slate-600" />
                  <span
                    id="seal-scope-tip"
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-full z-40 mt-1.5 w-56 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
                    Applied to every page of invoices, delivery challans, emailed PDFs and shared links.
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={toggleSealEnabled}
                  role="switch" aria-checked={sealEnabled}
                  aria-label={sealEnabled ? "Turn company seal off" : "Turn company seal on"}
                  className={`relative w-11 h-6 rounded-full transition-colors disabled:cursor-not-allowed ${sealEnabled ? "bg-blue-500" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${sealEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </div>
            {/* Pencil sits at the corner of the description line (not the
                title row): the header keeps only the on/off switch, and the
                edit affordance lives exactly where the editable summary
                begins underneath. */}
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-slate-500">
                {sealEnabled
                  ? "Set where the seal sits on the page, how big it is and how far it is tilted. The same mark is stamped on every page."
                  : "Turn on to stamp your company seal on invoices, delivery challans and shared links."}
              </p>
              {sealEnabled && !editingSeal && (
                <button type="button" onClick={startSealEdit}
                  title="Edit seal settings" aria-label="Edit seal settings"
                  className="shrink-0 -mt-1.5 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-colors">
                  <Pen className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* From sm up the editable panel stops stretching with the
                card — a bounded column keeps every control compact on
                desktop; mobile keeps the full width. */}
            {/* Collapsed: saved seal values only — same pattern as the
                Business Information card (summary + pencil in the corner).
                The editing panel appears only after the pencil is clicked. */}
            {sealEnabled && !editingSeal && (
              <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
                {bizField("Seal type", sealType === "stamp" ? "Rubber Stamp" : "Round Seal")}
                {bizField("Ink colour", (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full ring-1 ring-slate-900/10 shrink-0" style={{ background: sealConfig[sealType].color }} />
                    {sealConfig[sealType].color}
                  </span>
                ))}
                {bizField("Multi-page", sealConfig.allPages ? "Every page" : "Final page only")}
                {bizField(sealType === "stamp" ? "Stamp width" : "Seal size", `${sealConfig[sealType].sizeMm} mm`)}
                {bizField("Tilt", `${sealConfig[sealType].tilt}°`)}
                {bizField("From right / bottom", `${sealConfig[sealType].rightMm} mm · ${sealConfig[sealType].bottomMm} mm`)}
              </div>
            )}

            {/* Editor: reachable only from the pencil. From md up the whole
                control row shares one line (type · multi-page · ink); below
                md the controls stack with a full-width ink bar. */}
            {sealEnabled && editingSeal && (
              <div className="mt-5 pt-5 border-t border-slate-100 sm:max-w-md xl:max-w-none">
                {/* One line: type switcher left, Multi-page right (its caption
                    moved into a hover/focus tooltip so nothing wraps). */}
                {/* Wrap-safe control row: Seal type and Multi-page/Ink share
                    one line only when the card is truly wide (xl+); otherwise
                    they flow onto the next line instead of overlapping. */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 shrink-0 xl:hidden">Seal type</span>
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

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Multi-page</span>
                      <span className="relative inline-flex group" tabIndex={0} aria-describedby="seal-multipage-tip">
                        <Info className="w-3.5 h-3.5 text-slate-400 cursor-help transition-colors group-hover:text-slate-600 group-focus:text-slate-600" />
                        <span
                          id="seal-multipage-tip"
                          role="tooltip"
                          className="pointer-events-none absolute right-0 top-full z-40 mt-1.5 w-64 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
                          Stamp the seal on every page. Turn off to stamp only the final page, next to the grand total.
                        </span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={sealConfig.allPages}
                        onClick={toggleSealAllPages}
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

                    <div
                      title="Pick ink colour — tap the swatch or type the hex"
                      className="relative flex h-12 min-w-[160px] flex-1 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md sm:h-10 sm:w-40 sm:min-w-[150px] sm:flex-none xl:w-32 xl:min-w-0"
                    >
                      {/* Left tile opens the native colour picker; hex typed
                          beside it. Everything is in normal flow, so nothing
                          can overlap whatever the width. */}
                      <div
                        className="relative w-10 shrink-0 cursor-pointer"
                        style={{ background: sealConfig[sealType].color }}
                      >
                        <input
                          type="color"
                          aria-label="Seal ink colour"
                          value={sealConfig[sealType].color}
                          onChange={(e) => setSealField("color", e.target.value.toUpperCase())}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </div>
                      <input
                        type="text"
                        aria-label="Seal ink colour hex"
                        value={sealConfig[sealType].color}
                        spellCheck={false}
                        autoComplete="off"
                        onChange={(e) => {
                          const hex = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();
                          setSealField("color", hex ? `#${hex}` : SEAL_DEFAULT_COLOR[sealType]);
                        }}
                        className="relative min-w-0 flex-1 bg-transparent px-3 text-right font-mono text-[13px] font-semibold uppercase tracking-wide text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* xl+: Position & size (left) beside the A4 page preview
                    (right). Below xl they stack — the half-width card next to
                    Profile can't fit both columns without squeezing. */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:items-start">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">Position &amp; size</p>
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
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Page preview</p>
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
                    {showSealPreview ? (
                      <div className="flex flex-1 items-center justify-center rounded-lg bg-white border border-slate-100 py-4">
                        <SealPreview
                          business={{ ...businessData, businessName: bizForm.businessName || businessData?.businessName }}
                          type={sealType}
                          config={sealConfig}
                          onPlace={placeSealAt}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-center rounded-lg bg-white border border-dashed border-slate-300 py-4 text-[11px] text-slate-400 text-center px-3">
                        Preview hidden — tap “Show preview”
                      </div>
                    )}
                  </div>
                </div>

                {/* Save persists the edited drafts (type, ink, placement —
                    multi-page saves itself on flip); Reset loads the default
                    values locally (Save then applies them); Cancel restores
                    the pre-pencil state. */}
                <div className="mt-4 flex flex-nowrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveSeal("settings")}
                    disabled={savingSeal}
                    className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {savingSeal ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={resetSealConfig}
                    disabled={savingSeal}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all"
                  >
                    Reset to default
                  </button>
                  <button
                    type="button"
                    onClick={cancelSealEdit}
                    disabled={savingSeal}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Building className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Business Information</h2>
            {!editingBiz && (
              <button type="button" onClick={startBizEdit}
                title="Edit business information" aria-label="Edit business information"
                className="ml-auto shrink-0 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-colors">
                <Pen className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Collapsed view: saved values only — the same pattern as the
              Profile card (read-only value + pencil in the top-right corner).
              Input boxes appear only after the pencil is clicked. */}
          {!editingBiz && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {bizField("Business Name", dv(bizForm.businessName))}
              {bizField("Industry", industryName)}
              {bizField("GSTIN", dv(bizForm.gstIn))}
              {bizField("Phone", dv(bizForm.phone))}
              {bizField("Alternate Phone", dv(bizForm.additionalPhone))}
              {bizField("Email", dv(bizForm.email))}
              {bizField("Website", dv(bizForm.website))}
              {bizField("Invoice Convention", bizInvoicePrefix)}
              {bizField("Specialist In", bizSpecialist)}
              {bizForm.industry === "CONSTRUCTION" && bizField("HSN/SAC Display", bizForm.showHnSac ? "Shown on invoices" : "Hidden")}
              {bizField("Jurisdiction", bizJurisdiction, "md:col-span-2")}
              {bizField("Address", bizAddress, "md:col-span-2 lg:col-span-3")}
            </div>
          )}

          {editingBiz && (
          <form onSubmit={handleBizSave} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Business Name</label>
                <input type="text" name="businessName" value={bizForm.businessName} onChange={handleBizChange} autoFocus
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Industry</label>
                {/* Native appearance stripped: the OS caret hugs the border;
                    a custom chevron with a fixed inset matches every other
                    control and every browser. */}
                <div className="relative">
                  <select name="industry" value={bizForm.industry} onChange={handleBizChange}
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all">
                    {INDUSTRY_LIST.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Alternate Phone</label>
                <input type="text" name="additionalPhone" value={bizForm.additionalPhone} onChange={handleBizChange} inputMode="numeric"
                  placeholder="Optional"
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
                    <button type="button" role="switch" aria-checked={bizForm.specialistInEnabled} onClick={handleSpecialistToggle} aria-label="Show Specialist In on invoice"
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
                  <button type="button" role="switch" aria-checked={bizForm.showHnSac} onClick={handleShowHnSacToggle} aria-label="Show HSN/SAC on invoices"
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${bizForm.showHnSac ? "bg-blue-500" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${bizForm.showHnSac ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              </div>
              )}
              <div className="md:col-span-2 lg:col-span-3">
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/60">
                  {/* Mobile-safe header (same pattern as the HSN/SAC toggle
                      above): caption sits UNDER the title and only the switch
                      is pinned right — the old caption-beside-toggle layout
                      overflowed horizontally on phones. */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">Invoice Jurisdiction</span>
                        <span className="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Show jurisdiction on invoice</span>
                      </div>
                    </div>
                    <button type="button" role="switch" aria-checked={bizForm.jurisdictionEnabled} onClick={handleJurisdictionToggle} aria-label="Show jurisdiction on invoice"
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${bizForm.jurisdictionEnabled ? "bg-blue-500" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${bizForm.jurisdictionEnabled ? "translate-x-5" : ""}`} />
                    </button>
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
            <div className="flex items-center gap-2">
              <button type="submit" disabled={savingBiz}
                className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                {savingBiz ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={cancelBizEdit} disabled={savingBiz}
                title="Discard changes" aria-label="Discard changes"
                className="px-3 py-2.5 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Cancel
              </button>
            </div>
          </form>
          )}
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Landmark className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Company Bank Details</h2>
            {!editingBank && (
              <button type="button" onClick={startBankEdit}
                title="Edit bank details" aria-label="Edit bank details"
                className="ml-auto shrink-0 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-colors">
                <Pen className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Collapsed view: saved bank values only — inputs appear after the
              pencil is clicked (same pattern as Business Information). */}
          {!editingBank && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {bizField("Bank Name", dv(bankForm.bankName))}
              {bizField("Account No.", dv(bankForm.accountNo))}
              {bizField("Branch", dv(bankForm.branch))}
              {bizField("IFSC Code", dv(bankForm.ifsc))}
              {bizField("UPI ID", dv(bankForm.upiId), "md:col-span-2")}
              {bizField("Bank Address", dv(bankForm.bankAddress), "md:col-span-2 lg:col-span-3")}
            </div>
          )}

          {editingBank && (
          <form onSubmit={handleBankSave} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Bank Name</label>
                <input type="text" name="bankName" value={bankForm.bankName} onChange={handleBankChange} autoFocus
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
            <div className="flex items-center gap-2">
              <button type="submit" disabled={savingBank}
                className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                {savingBank ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={cancelBankEdit} disabled={savingBank}
                title="Discard changes" aria-label="Discard changes"
                className="px-3 py-2.5 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Cancel
              </button>
            </div>
          </form>
          )}
        </div>

        {/* Branding — moved out of the profile card; its own card right
            below Company Bank Details, logo and signature kept as two
            separate blocks. */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            {/* Images (two stacked frames) = the card's two visual assets,
                logo and signature; the Pen stays reserved for edit pencils. */}
            <Images className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Business Logo &amp; Signature</h2>
            <span className="ml-auto text-[11px] text-slate-400 hidden sm:block">PNG/JPG/WebP · max 1MB each</span>
          </div>

          {/* Mobile stacks the two blocks; md and up place logo and
              signature side by side on one line. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Business Logo block */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business Logo</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <div className="h-12 w-16 flex-shrink-0 bg-white rounded-md border border-slate-200 flex items-center justify-center overflow-hidden p-1.5">
                  {logo
                    ? <img src={`data:image/png;base64,${logo}`} alt="Business logo" className="max-h-full max-w-full object-contain" />
                    : <ImageIcon className="w-4 h-4 text-slate-300" />}
                </div>
                <p className="min-w-0 flex-1 text-[11px] text-slate-500 leading-snug">Prints top-left on the Enterprise template</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <label htmlFor="logo-upload"
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 cursor-pointer transition-all shadow-sm whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingLogo ? "Uploading..." : logo ? "Change" : "Upload"}
                  </label>
                  {logo && (
                    <button onClick={handleRemoveLogo} disabled={uploadingLogo} title="Remove logo"
                      className="flex items-center justify-center w-9 h-9 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Signature block — FileSignature: reads as "signed document",
                distinct from the plain Pen that marks edit affordances. */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileSignature className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signature</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="hidden"
                  id="signature-upload"
                />
                <div className="h-12 w-16 flex-shrink-0 bg-white rounded-md border border-slate-200 flex items-center justify-center overflow-hidden p-1.5">
                  {signature
                    ? <img src={`data:image/png;base64,${signature}`} alt="Signature" className="max-h-full max-w-full object-contain" />
                    : <FileSignature className="w-4 h-4 text-slate-300" />}
                </div>
                <p className="min-w-0 flex-1 text-[11px] text-slate-500 leading-snug">Appears on invoices</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <label htmlFor="signature-upload"
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 cursor-pointer transition-all shadow-sm whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingSig ? "Uploading..." : signature ? "Change" : "Upload"}
                  </label>
                  {signature && (
                    <button onClick={handleRemoveSignature} disabled={uploadingSig} title="Remove signature"
                      className="flex items-center justify-center w-9 h-9 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Conditions — up to five lines the owner writes once; the
            invoice footer prints them on every invoice (template rendering
            lands with the redesign — this stores the data). Same read-only +
            pencil pattern as the other cards. */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <ScrollText className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Terms &amp; Conditions</h2>
            <span className="ml-auto text-[11px] text-slate-400 hidden sm:block">Up to 5 lines · max 20 words each · printed on every invoice</span>
            {!editingTerms && (
              <button type="button" onClick={startTermsEdit}
                title="Edit terms & conditions" aria-label="Edit terms and conditions"
                className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-colors">
                <Pen className="w-4 h-4" />
              </button>
            )}
          </div>

          {!editingTerms ? (
            termsList.length ? (
              <ol className="space-y-2.5">
                {termsList.map((term, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-slate-800">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold flex items-center justify-center mt-0.5">{index + 1}</span>
                    <span className="min-w-0 break-words">{term}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-400">No terms added yet.</p>
            )
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleTermsSave(); }} className="space-y-3">
              <p className="text-xs text-slate-500">Up to 5 lines, max 20 words each — keep every line one crisp clause. Line 1 can't be removed (leave it empty if unused); every other line must be filled in or removed with its X.</p>
              {termsList.map((term, index) => {
                const words = countTermsWords(term);
                return (
                  <div key={index} className="flex items-center gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold flex items-center justify-center">{index + 1}</span>
                    <input
                      type="text"
                      value={term}
                      autoFocus={index === 0}
                      onChange={(e) => updateTermAt(index, e.target.value)}
                      placeholder="e.g., Goods once sold will not be taken back."
                      className={`flex-1 min-w-0 px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white transition-all ${
                        termsIssues && ((index > 0 && !(term || "").trim()) || (term || "").trim().length > TERMS_LINE_MAX_CHARS)
                          ? "border-red-400 ring-2 ring-red-400/20"
                          : "border-slate-300 focus:ring-2 focus:ring-indigo-400/30"
                      }`}
                    />
                    {/* Live word budget for this line — turns amber at the cap. */}
                    <span className={`shrink-0 w-9 text-right text-[10px] tabular-nums ${words >= TERMS_MAX_WORDS ? "text-amber-500 font-semibold" : "text-slate-400"}`}>
                      {words}/{TERMS_MAX_WORDS}
                    </span>
                    {/* Line 1 is permanent: no X (aligned spacer keeps the
                        counter column even across rows). */}
                    {index > 0 ? (
                      <button type="button" onClick={() => removeTermRow(index)} disabled={savingTerms}
                        title="Remove this line" aria-label="Remove this terms line"
                        className="shrink-0 p-2.5 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <span aria-hidden className="shrink-0 w-9" />
                    )}
                  </div>
                );
              })}
              {/* One action line: Add line sits right next to Save/Cancel. */}
              <div className="flex items-center gap-2">
                <button type="button" onClick={addTermRow} disabled={termsList.length >= 5 || savingTerms}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add line ({termsList.length}/5)
                </button>
                <button type="submit" disabled={savingTerms}
                  className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                  {savingTerms ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={cancelTermsEdit} disabled={savingTerms}
                  title="Discard changes" aria-label="Discard changes"
                  className="px-3 py-2.5 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Ghost Mode — moved out of the profile card to its own card at the
            very end of the settings page, below Business Logo & Signature. */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-5 h-5 text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Ghost Mode</h2>
              <span className="relative inline-flex group" tabIndex={0} aria-describedby="ghost-mode-tip">
                <Info className={`w-3.5 h-3.5 cursor-help transition-colors ${ghostMode ? "text-amber-500" : "text-slate-400"} group-hover:opacity-80 group-focus:opacity-80`} />
                <span
                  id="ghost-mode-tip"
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-40 mt-1.5 w-64 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
                  While on, you type the invoice number yourself — only for corrections, e.g. fixing a mistakenly generated invoice. Auto-numbering resumes the moment it's off.
                </span>
              </span>
            </div>
            <button type="button" role="switch" aria-checked={ghostMode} onClick={() => {
              const next = !ghostMode;
              setGhostMode(next);
              localStorage.setItem("ghost_mode", String(next));
            }}
              aria-label="Toggle ghost mode"
              className={`relative w-11 h-6 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${ghostMode ? "bg-amber-500" : "bg-slate-300"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${ghostMode ? "translate-x-5" : ""}`} />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            {ghostMode
              ? "On — enter invoice numbers manually on the invoice form. Auto-numbering resumes the moment it is off."
              : "Off — invoice numbers are generated automatically. Turn it on to enter numbers yourself."}
          </p>
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
function SealPreview({ business, type, config, onPlace }) {
  const pageWidth = 168;
  const scale = pageWidth / 210;
  const pageHeight = 297 * scale;
  const cfg = normalizeSealConfig(config);
  const variant = type === "stamp" ? "stamp" : "round";
  const variantCfg = cfg[variant];
  const box = sealBoxMm(variant, cfg);

  // Click-to-place: turn the clicked pixel into millimetres and centre the
  // seal on that point. clientLeft/clientTop strip the 1px border so the
  // maths lines up with the content box the seal is positioned inside.
  const handlePageClick = (event) => {
    if (!onPlace) return;
    const node = event.currentTarget;
    const rect = node.getBoundingClientRect();
    const xPx = event.clientX - rect.left - node.clientLeft;
    const yPx = event.clientY - rect.top - node.clientTop;
    const xMm = xPx / scale;
    const yMm = yPx / scale;

    // The stored gaps run from the page edge to the seal's box edge, so
    // centring means backing off by half the seal in each direction.
    const maxRight = Math.max(0, SEAL_PAGE.widthMm - box.w);
    const maxBottom = Math.max(0, SEAL_PAGE.heightMm - box.h);
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    onPlace(
      clamp(Math.round(SEAL_PAGE.widthMm - (xMm + box.w / 2)), 0, maxRight),
      clamp(Math.round(SEAL_PAGE.heightMm - (yMm + box.h / 2)), 0, maxBottom)
    );
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onPointerDown={handlePageClick}
        title={onPlace ? "Click or tap anywhere to place the seal" : undefined}
        style={{
          position: "relative",
          width: pageWidth,
          height: pageHeight,
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: 4,
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
          overflow: "hidden",
          cursor: onPlace ? "crosshair" : undefined,
          // Keep a touch from scrolling the page instead of placing the seal.
          touchAction: onPlace ? "none" : undefined,
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
      {onPlace && (
        <p className="text-[10px] text-slate-400 italic">Click or tap anywhere on the page to place the seal</p>
      )}
    </div>
  );
}
