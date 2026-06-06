import axios from "axios";

const BASE_URL = "/api";

const OAUTH_CREDENTIALS = {
  grant_type: "password",
  client_id: "dd4c96b414f68d3e26e90e8b6a7f8c834370a2943c06655a81b95d061f0757d6",
  client_secret: "3dea3703d5a568e3324cde707eedea38104111a7743d4343b48828880fa20598",
  username: "",
  password: "",
  scope: "api user inventory status graphql",
};

// Utiliser sessionStorage pour persister la session
const getStoredCreds = () => {
  const creds = sessionStorage.getItem("glpi_creds");
  return creds ? JSON.parse(creds) : { username: "", password: "" };
};

const setStoredCreds = (creds) => {
  sessionStorage.setItem("glpi_creds", JSON.stringify(creds));
};

let accessToken = sessionStorage.getItem("glpi_token");

async function fetchToken(username, password) {
  const creds = {
    ...OAUTH_CREDENTIALS,
    ...(username ? { username, password } : getStoredCreds()),
  };

  // Si pas de credentials du tout, on ne tente même pas
  if (!creds.username || !creds.password) {
    console.warn("No credentials found for fetchToken");
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  // Sauvegarder pour le renouvellement automatique
  if (username) {
    setStoredCreds({ username, password });
  }

  const params = new URLSearchParams(creds);
  const { data } = await axios.post(`${BASE_URL}/token`, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  accessToken = data.access_token;
  sessionStorage.setItem("glpi_token", accessToken);
  console.log("Fetched token:", accessToken);
  return accessToken;
}

async function getToken() {
  if (!accessToken) await fetchToken();
  return accessToken;
}

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  config.headers.Authorization = `Bearer ${token}`;
  config.headers["App-Token"] = "nzJu5tfBe4JbVW9tkwAB4jSKgXUCCD3WOVEBuz4H";
  return config;
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/token")
    ) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }
    originalRequest._retry = true;
    isRefreshing = true;
    try {
      accessToken = null;
      const newToken = await fetchToken();
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      accessToken = null;
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export function get(url, params = {}) { return api.get(url, { params }); }
export function post(url, data = {}) { return api.post(url, data); }
export function put(url, data = {}) { return api.put(url, data); }
export function patch(url, data = {}) { return api.patch(url, data); }
export function del(url, data = {}) { return api.delete(url, { data }); }

// ── UNE SEULE refreshSession ────────────────────────────────────────
export async function refreshSession(username, password) {
  accessToken = null;
  return fetchToken(username, password);
}

export function clearSession() {
  accessToken = null;
  sessionStorage.removeItem("glpi_token");
  sessionStorage.removeItem("glpi_creds");
}

// ═══════════════════════════════════════════════════════════════════
// ── API Legacy (apirest.php) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

const LEGACY_BASE_URL = "/apirest";
const LEGACY_CREDENTIALS = { login: "glpi", password: "glpi" };

let sessionToken = null;

async function initSession() {
  const { data } = await axios.get(`${LEGACY_BASE_URL}/initSession`, {
    headers: {
      "Content-Type": "application/json",
      "App-Token": "nzJu5tfBe4JbVW9tkwAB4jSKgXUCCD3WOVEBuz4H",
    },
    auth: {
      username: LEGACY_CREDENTIALS.login,
      password: LEGACY_CREDENTIALS.password,
    },
  });
  sessionToken = data.session_token;
  return sessionToken;
}

async function getSessionToken() {
  if (!sessionToken) await initSession();
  return sessionToken;
}

const legacy = axios.create({ baseURL: LEGACY_BASE_URL });

legacy.interceptors.request.use(async (config) => {
  const token = await getSessionToken();
  config.headers["Session-Token"] = token;
  config.headers["App-Token"] = "nzJu5tfBe4JbVW9tkwAB4jSKgXUCCD3WOVEBuz4H";
  return config;
});

let isRefreshingLegacy = false;
let failedQueueLegacy = [];

function processQueueLegacy(error, token = null) {
  failedQueueLegacy.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueueLegacy = [];
}

legacy.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/initSession")
    ) {
      return Promise.reject(error);
    }
    if (isRefreshingLegacy) {
      return new Promise((resolve, reject) => {
        failedQueueLegacy.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers["Session-Token"] = token;
        return legacy(originalRequest);
      });
    }
    originalRequest._retry = true;
    isRefreshingLegacy = true;
    try {
      sessionToken = null;
      const newToken = await initSession();
      processQueueLegacy(null, newToken);
      originalRequest.headers["Session-Token"] = newToken;
      return legacy(originalRequest);
    } catch (refreshError) {
      processQueueLegacy(refreshError, null);
      sessionToken = null;
      return Promise.reject(refreshError);
    } finally {
      isRefreshingLegacy = false;
    }
  }
);

export const Legacy = {
  get(url, params = {}) { return legacy.get(url, { params }); },
  post(url, data = {}) { return legacy.post(url, { input: data }); },
  put(url, data = {}) { return legacy.put(url, { input: data }); },
  del(url) { return legacy.delete(url); },
  delPurge(url) { 
    const separator = url.includes('?') ? '&' : '?';
    return legacy.delete(`${url}${separator}force_purge=1`); 
  },
  async refreshSession() {
    sessionToken = null;
    return initSession();
  },
  async killSession() {
    try { await legacy.get("/killSession"); }
    finally { sessionToken = null; }
  },
};

export { legacy };
export default api;