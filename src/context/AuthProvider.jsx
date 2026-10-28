import { useState, useEffect, useMemo, useCallback } from "react";
import { authAPI, businessAPI } from "../api/auth";
import { invalidateBusinessProfile } from "../utils/businessProfile";
import { setAuthToken } from "../api/axios";
import { sanitizeTemplate, clearTemplateOverrides } from "../constants/paperSizes";
import { getIndustryConfig } from "../constants/industryConfig";
import { AuthContext } from "./AuthContext";

const TOKEN_KEY = "ii_token";
const USER_KEY = "user";
const REMEMBER_KEY = "ii_remember";

function isTokenExpired(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function readSession() {
  // Auth must survive a browser restart: the tab-scoped sessionStorage copy is
  // wiped the moment Chrome closes, so localStorage is the source of truth and
  // sessionStorage is only a fallback for sessions written by older builds.
  const finalToken =
    sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  const finalUser =
    sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (finalToken && finalUser && !isTokenExpired(finalToken)) {
    try {
      return { token: finalToken, user: JSON.parse(finalUser) };
    } catch {
      return null;
    }
  }
  return null;
}

function writeStorage(key, value) {
  localStorage.setItem(key, value);
  sessionStorage.removeItem(key);
}

function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  localStorage.removeItem("token");
}

// Hydrates account-held invoice settings into this browser so a new device
// renders the same printable documents the owner configured.
function applyAccountSettings(profile) {
  const b = profile?.data?.data;
  if (!b) return { b: null, tpl: null };
  let tpl = null;
  if (b.invoiceTemplate) {
    tpl = sanitizeTemplate(b.invoiceTemplate);
    localStorage.setItem("invoice_template", tpl);
  }
  if (b.printSettings) localStorage.setItem("print_settings", b.printSettings);
  return { b, tpl };
}

export function AuthProvider({ children }) {
  const [session] = useState(readSession);
  const [user, setUser] = useState(() => session?.user ?? null);
  const [token, setToken] = useState(() => session?.token ?? null);
  const [selectedTemplate, setSelectedTemplate] = useState(() =>
    sanitizeTemplate(
      session?.user?.selectedTemplate ||
      localStorage.getItem("invoice_template") ||
      "template-1"
    )
  );
  const [business, setBusiness] = useState(null);

  useEffect(() => {
    if (!session) {
      clearAuthStorage();
      localStorage.removeItem("mustChangePassword");
      return;
    }
    const parsed = session.user;
    setAuthToken(session.token);
    if (parsed.selectedTemplate) {
      localStorage.setItem("invoice_template", sanitizeTemplate(parsed.selectedTemplate));
    }
    if (parsed.mustChangePassword) {
      localStorage.setItem("mustChangePassword", "true");
    } else {
      localStorage.removeItem("mustChangePassword");
    }
    businessAPI.getProfile().then((r) => {
      const { b, tpl } = applyAccountSettings(r);
      if (b) setBusiness(b);
      if (tpl) setSelectedTemplate(tpl);
      // First time after the V20 migration: push the browser-held settings
      // back to the account so the shared links inherit them.
      if (b && !b.invoiceTemplate && !b.printSettings &&
          (localStorage.getItem("invoice_template") || localStorage.getItem("print_settings"))) {
        businessAPI.updateInvoiceSettings({
          invoiceTemplate: localStorage.getItem("invoice_template") || "template-1",
          printSettings: localStorage.getItem("print_settings") || "",
        }).catch(() => {});
      }
    }).catch(() => {});

    // The stored user snapshot is only written at login — re-read it on boot
    // so profile edits (email / name / username) show without a re-login.
    authAPI.me().then((r) => {
      const fresh = r.data?.data;
      if (!fresh) return;
      setUser((prev) => ({ ...(prev || session.user || {}), ...fresh }));
      writeStorage(USER_KEY, JSON.stringify({ ...(session.user || {}), ...fresh }));
    }).catch(() => {});
  }, [session]);

  /**
   * Stores a freshly issued session the same way everywhere one can arrive —
   * login, and the email-verification step that mints a token too — so the two
   * entry points can never drift apart.
   */
  const adoptSession = useCallback((data, rememberMe = false) => {
    setAuthToken(data.accessToken);
    writeStorage(TOKEN_KEY, data.accessToken);
    writeStorage(USER_KEY, JSON.stringify(data));
    localStorage.setItem(REMEMBER_KEY, String(rememberMe));
    setToken(data.accessToken);
    setUser(data);
    if (data.selectedTemplate) {
      const tpl = sanitizeTemplate(data.selectedTemplate);
      localStorage.setItem("invoice_template", tpl);
      setSelectedTemplate(tpl);
    }
    if (data.mustChangePassword) {
      localStorage.setItem("mustChangePassword", "true");
    } else {
      localStorage.removeItem("mustChangePassword");
    }
    return data;
  }, []);

  const login = useCallback(async (email, password, rememberMe = false) => {
    const res = await authAPI.login({ email, password, rememberMe });
    const data = res.data.data;
    adoptSession(data, rememberMe);
    // JwtResponse carries no template field — fetch the account copy now,
    // before navigation, so downloads match what share links serve from
    // the server.
    try {
      const profile = await businessAPI.getProfile();
      const { b, tpl } = applyAccountSettings(profile);
      if (b) setBusiness(b);
      if (tpl) setSelectedTemplate(tpl);
    } catch {
      // Best effort: local/template fallbacks still apply.
    }
    return data;
  }, [adoptSession]);

  const register = useCallback(async ({ name, email, password }) => {
    // NO session is issued at sign-up: the server returns an email-verification
    // pending payload and the visitor is parked on the OTP screen. The session
    // is created by verifyEmail below, once the inbox is proven.
    const res = await authAPI.register({
      name,
      email,
      password,
      confirmPassword: password,
    });
    return res.data.data;
  }, []);

  /**
   * Confirms the mailed 6-digit code and adopts the session the server hands
   * back — identical bookkeeping to login, so a verified user continues into
   * the ordinary journey (business setup if it is still outstanding).
   */
  const verifyEmail = useCallback(async ({ email, otp }) => {
    const res = await authAPI.verifyEmail({ email, otp });
    const data = res.data.data;
    adoptSession(data);
    // Same eager profile hydration as login: the template/print settings must
    // be right before the first invoice renders.
    try {
      const profile = await businessAPI.getProfile();
      const { b, tpl } = applyAccountSettings(profile);
      if (b) setBusiness(b);
      if (tpl) setSelectedTemplate(tpl);
    } catch {
      // Best effort: local/template fallbacks still apply.
    }
    return data;
  }, [adoptSession]);

  const refreshBusiness = useCallback(async () => {
    try {
      const profile = await businessAPI.getProfile();
      const { b } = applyAccountSettings(profile);
      if (b) setBusiness(b);
      return b;
    } catch {
      return null;
    }
  }, []);

  const updateTemplate = useCallback(async (templateId) => {
    const tpl = sanitizeTemplate(templateId);
    // Drop stale per-type overrides locally BEFORE reading print_settings so
    // the payload pushed to the server is clean too — otherwise share links
    // keep resolving the old template from business.print_settings.
    clearTemplateOverrides();
    const prevLocal = localStorage.getItem("invoice_template");
    localStorage.setItem("invoice_template", tpl);
    setSelectedTemplate(tpl);
    const updated = { ...user, selectedTemplate: tpl };
    writeStorage(USER_KEY, JSON.stringify(updated));
    setUser(updated);

    try {
      await businessAPI.updateInvoiceSettings({
        invoiceTemplate: tpl,
        printSettings: localStorage.getItem("print_settings") || "",
      });
      invalidateBusinessProfile();
    } catch (err) {
      console.warn("Could not sync invoice template settings to server:", err?.response?.data || err?.message);
      // Roll back the optimistic local update so local always mirrors the
      // server — and rethrow so the caller can surface the failure.
      if (prevLocal) localStorage.setItem("invoice_template", prevLocal);
      else localStorage.removeItem("invoice_template");
      setSelectedTemplate(sanitizeTemplate(prevLocal || "template-1"));
      writeStorage(USER_KEY, JSON.stringify(user));
      setUser(user);
      throw err;
    }
  }, [user]);

  const setupBusiness = useCallback(async (businessData) => {
    const res = await businessAPI.setup(businessData);
    invalidateBusinessProfile();
    const updatedUser = { ...user, businessSetupCompleted: true };
    writeStorage(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
    if (res.data.data) setBusiness(res.data.data);
    return res.data.data;
  }, [user]);

  const logout = useCallback(() => {
    // Revoke server-side first (fire-and-forget): the token is still in storage
    // for this tick, and local cleanup must not wait on the network.
    const currentToken = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    if (currentToken) {
      authAPI.logout(currentToken).catch(() => {});
    }
    setAuthToken(null);
    clearAuthStorage();
    invalidateBusinessProfile();
    localStorage.removeItem("invoice_template");
    localStorage.removeItem("mustChangePassword");
    setToken(null);
    setUser(null);
    setBusiness(null);
    setSelectedTemplate("template-1");
  }, []);

  const isAuthenticated = !!token;
  const isBusinessSetupComplete = user?.businessSetupCompleted;
  const isAdmin = user?.role === "ADMIN";
  const mustChangePassword = user?.mustChangePassword === true || localStorage.getItem("mustChangePassword") === "true";
  const industryConfig = useMemo(() => getIndustryConfig(business?.industry), [business?.industry]);
  const documentAccess = industryConfig.documents;

  const value = useMemo(() => ({
    user,
    token,
    login,
    register,
    verifyEmail,
    setupBusiness,
    logout,
    setUser,
    setToken,
    isAuthenticated,
    isBusinessSetupComplete,
    isAdmin,
    mustChangePassword,
    selectedTemplate,
    updateTemplate,
    business,
    refreshBusiness,
    industry: industryConfig.id,
    industryConfig,
    documentAccess,
  }), [
    user, token, login, register, verifyEmail, setupBusiness, logout, setUser, setToken,
    isAuthenticated, isBusinessSetupComplete, isAdmin, mustChangePassword,
    selectedTemplate, updateTemplate, business, refreshBusiness,
    industryConfig, documentAccess,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
