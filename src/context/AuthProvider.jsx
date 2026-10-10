import { useState, useEffect, useMemo, useCallback } from "react";
import { authAPI, businessAPI } from "../api/auth";
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
  const storedToken = sessionStorage.getItem(TOKEN_KEY);
  const storedUser = sessionStorage.getItem(USER_KEY);
  const rememberMe = localStorage.getItem(REMEMBER_KEY) === "true";
  const finalToken = storedToken || (rememberMe ? localStorage.getItem(TOKEN_KEY) : null);
  const finalUser = storedUser || (rememberMe ? localStorage.getItem(USER_KEY) : null);
  if (finalToken && finalUser && !isTokenExpired(finalToken)) {
    try {
      return { token: finalToken, user: JSON.parse(finalUser) };
    } catch {
      return null;
    }
  }
  return null;
}

function writeStorage(key, value, rememberMe) {
  if (rememberMe) {
    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  }
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
  }, [session]);

  const login = useCallback(async (email, password, rememberMe = false) => {
    const res = await authAPI.login({ email, password, rememberMe });
    const data = res.data.data;
    setAuthToken(data.accessToken);
    writeStorage(TOKEN_KEY, data.accessToken, rememberMe);
    writeStorage(USER_KEY, JSON.stringify(data), rememberMe);
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
  }, []);

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
    const rememberMe = localStorage.getItem(REMEMBER_KEY) === "true";
    writeStorage(USER_KEY, JSON.stringify(updated), rememberMe);
    setUser(updated);

    try {
      await businessAPI.updateInvoiceSettings({
        invoiceTemplate: tpl,
        printSettings: localStorage.getItem("print_settings") || "",
      });
    } catch (err) {
      console.warn("Could not sync invoice template settings to server:", err?.response?.data || err?.message);
      // Roll back the optimistic local update so local always mirrors the
      // server — and rethrow so the caller can surface the failure.
      if (prevLocal) localStorage.setItem("invoice_template", prevLocal);
      else localStorage.removeItem("invoice_template");
      setSelectedTemplate(sanitizeTemplate(prevLocal || "template-1"));
      writeStorage(USER_KEY, JSON.stringify(user), rememberMe);
      setUser(user);
      throw err;
    }
  }, [user]);

  const setupBusiness = useCallback(async (businessData) => {
    const res = await businessAPI.setup(businessData);
    const updatedUser = { ...user, businessSetupCompleted: true };
    const rememberMe = localStorage.getItem(REMEMBER_KEY) === "true";
    writeStorage(USER_KEY, JSON.stringify(updatedUser), rememberMe);
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
    user, token, login, setupBusiness, logout, setUser, setToken,
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
