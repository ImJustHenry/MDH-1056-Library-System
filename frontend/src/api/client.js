import axios from "axios";

// In dev: VITE_API_URL is undefined → baseURL is "/api" → Vite proxy handles it.
// In production (Docker/Render): VITE_API_URL is baked in at build time.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api",
});

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the server returns 401, clear stored token and redirect to login
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const config = err.config || {};
    const requestUrl = String(config.url || "");
    const serverError = String(err.response?.data?.error || "");
    const token = localStorage.getItem("token");

    if (status === 401 && token && !config._authRetry && !requestUrl.includes("/auth/login")) {
      config._authRetry = true;
      return api(config);
    }

    if (status === 401) {
      const shouldForceLogout = /token|authorization header|expired|invalid/i.test(serverError);
      if (shouldForceLogout) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }

    return Promise.reject(err);
  }
);

export default api;
