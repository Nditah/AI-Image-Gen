import { getStoredUser, isStaff } from "./auth.js";
import { fetchMe } from "./api.js";
import { renderAdminLogin, renderLogin, renderRegister } from "./views/auth.js";
import { renderHelp } from "./views/help.js";
import {
  renderAccount,
  renderGallery,
  renderGenerate,
  renderGuidelines,
} from "./views/studio.js";
import {
  renderAdminEvents,
  renderAdminGenerations,
  renderAdminOverview,
  renderAdminReports,
  renderAdminUsers,
} from "./views/admin.js";

const app = document.querySelector("#app");

function parseLocation() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const url = new URL(raw, "http://local.invalid");
  return { path: url.pathname, query: url.searchParams };
}

function redirect(hash) {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
    return true;
  }
  return false;
}

async function resolveUser() {
  const stored = getStoredUser();
  if (!stored) return null;
  try {
    return await fetchMe();
  } catch {
    return null;
  }
}

export async function renderApp() {
  const { path, query } = parseLocation();
  const user = await resolveUser();

  const guestRoutes = {
    "/login": renderLogin,
    "/register": renderRegister,
    "/admin/login": renderAdminLogin,
  };

  const userRoutes = {
    "/app/generate": renderGenerate,
    "/app/gallery": renderGallery,
    "/app/guidelines": renderGuidelines,
    "/app/help": renderHelp,
    "/app/account": renderAccount,
  };

  const staffRoutes = {
    "/admin": renderAdminOverview,
    "/admin/users": renderAdminUsers,
    "/admin/generations": renderAdminGenerations,
    "/admin/reports": renderAdminReports,
    "/admin/events": renderAdminEvents,
  };

  if (!user) {
    const view = guestRoutes[path] || renderLogin;
    if (!guestRoutes[path] && path !== "/login") {
      redirect("#/login");
      return;
    }
    const rendered = view();
    app.innerHTML = rendered.html;
    rendered.bind?.(app);
    return;
  }

  if (guestRoutes[path]) {
    redirect(isStaff(user) ? "#/admin" : "#/app/generate");
    return;
  }

  if (path === "/" || path === "/app") {
    redirect(isStaff(user) ? "#/admin" : "#/app/generate");
    return;
  }

  if (staffRoutes[path] && !isStaff(user)) {
    redirect("#/app/generate");
    return;
  }

  const renderer = userRoutes[path] || staffRoutes[path];
  if (!renderer) {
    redirect(isStaff(user) ? "#/admin" : "#/app/generate");
    return;
  }

  const rendered = await renderer({ user, path, query });
  app.innerHTML = rendered.html;
  rendered.bind?.(app);
}

window.addEventListener("hashchange", () => {
  renderApp();
});
