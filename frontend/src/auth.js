const TOKEN_KEY = "aigen.token";
const USER_KEY = "aigen.user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isStaff(user = getStoredUser()) {
  return Boolean(user && (user.role === "ADMIN" || user.role === "MODERATOR"));
}

export function isAdmin(user = getStoredUser()) {
  return Boolean(user && user.role === "ADMIN");
}
