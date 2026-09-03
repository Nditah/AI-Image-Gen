import { clearSession, getToken, setSession } from "./auth.js";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(message, { status, code, payload } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function readError(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  return data.error || data.detail?.error || fallback;
}

export async function api(path, { method = "GET", body, headers } = {}) {
  const token = getToken();
  const nextHeaders = { ...(headers || {}) };
  if (body !== undefined && !nextHeaders["Content-Type"]) {
    nextHeaders["Content-Type"] = "application/json";
  }
  if (token) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: nextHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = {};
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (response.status === 401) {
    clearSession();
    if (!path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
      throw new ApiError(readError(data, "Please sign in again."), {
        status: 401,
        code: data.code || "UNAUTHORIZED",
        payload: data,
      });
    }
  }

  if (!response.ok) {
    throw new ApiError(readError(data, "Request failed."), {
      status: response.status,
      code: data.code,
      payload: data,
    });
  }

  return data;
}

export async function login(email, password) {
  const data = await api("/auth/login", { method: "POST", body: { email, password } });
  setSession(data.token, data.user);
  return data.user;
}

export async function register(payload) {
  const data = await api("/auth/register", { method: "POST", body: payload });
  setSession(data.token, data.user);
  return data.user;
}

export async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // still clear local session
  }
  clearSession();
}

export async function fetchMe() {
  const data = await api("/auth/me");
  if (data.user) {
    const token = getToken();
    if (token) setSession(token, data.user);
  }
  return data.user;
}

export function imageSrc(base64) {
  if (!base64) return "";
  return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function badgeClass(value) {
  const key = String(value || "").toLowerCase();
  if (["active", "allowed", "dismissed", "reinstate"].includes(key)) return "badge badge-ok";
  if (["admin", "moderator"].includes(key)) return "badge badge-accent";
  if (["blocked", "banned", "csam"].includes(key)) return "badge badge-danger";
  if (["suspended", "flagged", "open", "pending_verification"].includes(key)) return "badge badge-warn";
  return "badge";
}
