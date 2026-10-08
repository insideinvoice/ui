import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { authAPI, businessAPI } from "../api/auth";
import { setAuthToken } from "../api/axios";
import { sanitizeTemplate } from "../constants/paperSizes";

const AuthContext = createContext(null);

const TOKEN_KEY = "ii_token";
const USER_KEY = "user";
const REMEMBER_KEY = "ii_remember";

function readStorage(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key);
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(() =>
    sanitizeTemplate(localStorage.getItem("invoice_template") || "template-1")
  );

  useEffect(() => {
    const storedToken = sessionStorage.getItem(TOKEN_KEY);
    const storedUser = sessionStorage.getItem(USER_KEY);
    const rememberMe = localStorage.getItem(REMEMBER_KEY) === "true";
    const fallbackToken = rememberMe ? localStorage.getItem(TOKEN_KEY) : null;
    const fallbackUser = rememberMe ? localStorage.getItem(USER_KEY) : null;
    const finalToken = storedToken || fallbackToken;
    const finalUser = storedUser || fallbackUser;
    if (finalToken && finalUser && !isTokenExpired(finalToken)) {
      setAuthToken(finalToken);
      setToken(finalToken);
      const parsed = JSON.parse(finalUser);
      setUser(parsed);
      if (parsed.selectedTemplate) {
        const tpl = sanitizeTemplate(parsed.selectedTemplate);
        localStorage.setItem("invoice_template", tpl);
        setSelectedTemplate(tpl);
      }
      // Hydrate the account-held invoice settings so a new device renders
      // the same printable documents the owner configured.
      businessAPI.getProfile().then((r) => {
        const b = r.data.data;
        if (b) {
          if (b.invoiceTemplate) {
            const tpl = sanitizeTemplate(b.invoiceTemplate);
            localStorage.setItem("invoice_template", tpl);
            setSelectedTemplate(tpl);
          }
          if (b.printSettings) localStorage.setItem("print_settings", b.printSettings);
          // First time after the V20 migration: push the browser-held settings
          // back to the account so the shared links inherit them.
          if (!b.invoiceTemplate && !b.printSettings &&
              (localStorage.getItem("invoice_template") || localStorage.getItem("print_settings"))) {
            businessAPI.updateInvoiceSettings({
              invoiceTemplate: localStorage.getItem("invoice_template") || "template-1",
              printSettings: localStorage.getItem("print_settings") || "",
            }).catch(() => {});
          }
        }
      }).catch(() => {});
      if (parsed.mustChangePassword) {
        localStorage.setItem("mustChangePassword", "true");
      } else {
        localStorage.removeItem("mustChangePassword");
      }
    } else {
      clearAuthStorage();
      localStorage.removeItem("mustChangePassword");
    }
    setLoading(false);
  }, []);

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
    return data;
  }, []);

  const updateTemplate = useCallback(async (templateId) => {
    const tpl = sanitizeTemplate(templateId);
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
    }
  }, [user]);

  const setupBusiness = useCallback(async (businessData) => {
    const res = await businessAPI.setup(businessData);
    const updatedUser = { ...user, businessSetupCompleted: true };
    const rememberMe = localStorage.getItem(REMEMBER_KEY) === "true";
    writeStorage(USER_KEY, JSON.stringify(updatedUser), rememberMe);
    setUser(updatedUser);
    return res.data.data;
  }, [user]);

  const logout = useCallback(() => {
    setAuthToken(null);
    clearAuthStorage();
    localStorage.removeItem("invoice_template");
    localStorage.removeItem("mustChangePassword");
    setToken(null);
    setUser(null);
    setSelectedTemplate("template-1");
  }, []);

  const isAuthenticated = !!token;
  const isBusinessSetupComplete = user?.businessSetupCompleted;
  const isAdmin = user?.role === "ADMIN";
  const mustChangePassword = user?.mustChangePassword === true || localStorage.getItem("mustChangePassword") === "true";

  // Memoized context value: consumers only re-render when auth state actually changes
  const value = useMemo(() => ({
    user,
    token,
    loading,
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
  }), [
    user, token, loading, login, setupBusiness, logout, setUser, setToken,
    isAuthenticated, isBusinessSetupComplete, isAdmin, mustChangePassword,
    selectedTemplate, updateTemplate,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
