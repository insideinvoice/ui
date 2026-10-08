import axios from "axios";
import { getApiBaseURL } from "../config/api";

const TOKEN_KEY = "ii_token";
const USER_KEY = "ii_user";
const REMEMBER_KEY = "ii_remember";

const api = axios.create({
  baseURL: getApiBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token =
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function forceLogout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  localStorage.removeItem("mustChangePassword");
  api.defaults.headers.common["Authorization"] = "";
  delete api.defaults.headers.common["Authorization"];
  if (window.location.pathname !== "/login" && window.location.pathname !== "/forgot-password") {
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const transient =
      !error.response ||
      error.response.status === 429 ||
      error.response.status >= 500;
    // GET requests are idempotent — retry once on cold-start/network
    // failures (Railway free tier wakes up slowly and intermittently
    // returns 502). Keeps "Failed to load ..." toasts from flashing
    // while the retry succeeds moments later.
    if (config && config.method === "get" && transient && !config._retried) {
      config._retried = true;
      await new Promise((r) => setTimeout(r, 800));
      return api(config);
    }
    if (error.response?.status === 401) {
      forceLogout();
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

export default api;
