// Production URL comes from VITE_API_BASE_URL (committed in .env.production);
// local development falls back to a locally running backend.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

export const getApiBaseURL = () => API_BASE_URL;
