import { createContext, useContext, useState, useEffect } from "react";
import { authAPI, businessAPI } from "../api/auth";
import { setAuthToken } from "../api/axios";

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
    localStorage.getItem("invoice_template") || "template-1"
  );

  useEffect(() => {
    clearAuthStorage();
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
        localStorage.setItem("invoice_template", parsed.selectedTemplate);
        setSelectedTemplate(parsed.selectedTemplate);
      }
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

  const login = async (email, password, rememberMe = false) => {
    const res = await authAPI.login({ email, password, rememberMe });
    const data = res.data.data;
    setAuthToken(data.accessToken);
    writeStorage(TOKEN_KEY, data.accessToken, rememberMe);
    writeStorage(USER_KEY, JSON.stringify(data), rememberMe);
    localStorage.setItem(REMEMBER_KEY, String(rememberMe));
    setToken(data.accessToken);
    setUser(data);
    if (data.selectedTemplate) {
      localStorage.setItem("invoice_template", data.selectedTemplate);
      setSelectedTemplate(data.selectedTemplate);
    }
    if (data.mustChangePassword) {
      localStorage.setItem("mustChangePassword", "true");
    } else {
      localStorage.removeItem("mustChangePassword");
    }
    return data;
  };

  const updateTemplate = async (templateId) => {
    await authAPI.updateProfile({ ...user, selectedTemplate: templateId });
    localStorage.setItem("invoice_template", templateId);
    setSelectedTemplate(templateId);
    const updated = { ...user, selectedTemplate: templateId };
    const rememberMe = localStorage.getItem(REMEMBER_KEY) === "true";
    writeStorage(USER_KEY, JSON.stringify(updated), rememberMe);
    setUser(updated);
  };

  const setupBusiness = async (businessData) => {
    const res = await businessAPI.setup(businessData);
    const updatedUser = { ...user, businessSetupCompleted: true };
    const rememberMe = localStorage.getItem(REMEMBER_KEY) === "true";
    writeStorage(USER_KEY, JSON.stringify(updatedUser), rememberMe);
    setUser(updatedUser);
    return res.data.data;
  };

  const logout = () => {
    setAuthToken(null);
    clearAuthStorage();
    localStorage.removeItem("invoice_template");
    localStorage.removeItem("mustChangePassword");
    setToken(null);
    setUser(null);
    setSelectedTemplate("template-1");
  };

  const isAuthenticated = !!token;
  const isBusinessSetupComplete = user?.businessSetupCompleted;
  const isAdmin = user?.role === "ADMIN";
  const mustChangePassword = user?.mustChangePassword === true || localStorage.getItem("mustChangePassword") === "true";

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
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
