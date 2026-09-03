import { isStaff } from "./auth.js";
import { logout } from "./api.js";

function navLink(href, label, activePath) {
  const hrefPath = href.replace(/^#/, "");
  const active = activePath === hrefPath || (hrefPath !== "/admin" && activePath.startsWith(`${hrefPath}/`));
  return `<a class="nav-link ${active ? "is-active" : ""}" href="${href}">${label}</a>`;
}

export function renderShell({ user, path, title, subtitle = "", content }) {
  const staff = isStaff(user);
  const studio = `
    <p class="nav-label">Studio</p>
    ${navLink("#/app/generate", "Generate", path)}
    ${navLink("#/app/gallery", "My gallery", path)}
    ${navLink("#/app/guidelines", "Guidelines", path)}
    ${navLink("#/app/account", "Account", path)}
  `;
  const admin = staff
    ? `
      <p class="nav-label">Admin</p>
      ${navLink("#/admin", "Overview", path)}
      ${navLink("#/admin/users", "Users", path)}
      ${navLink("#/admin/generations", "Generations", path)}
      ${navLink("#/admin/reports", "Reports", path)}
      ${navLink("#/admin/events", "Auth events", path)}
    `
    : "";

  return `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="${staff ? "#/admin" : "#/app/generate"}">
          <span class="brand-mark">AI</span>
          <span>
            <strong>Image Gen</strong>
            <em>${staff ? "Staff console" : "Creative studio"}</em>
          </span>
        </a>
        <nav class="nav">${studio}${admin}</nav>
        <div class="sidebar-user">
          <div>
            <strong>${user.displayName || user.email}</strong>
            <span>${user.role}</span>
          </div>
          <button class="btn-ghost" type="button" data-action="logout">Sign out</button>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <button class="menu-btn" type="button" data-action="toggle-nav" aria-label="Open menu">☰</button>
          <div>
            <h1>${title}</h1>
            ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
          </div>
        </header>
        <div class="page">${content}</div>
      </div>
    </div>
  `;
}

export function bindShell(root) {
  root.querySelector("[data-action='logout']")?.addEventListener("click", async () => {
    await logout();
    window.location.hash = "#/login";
  });
  root.querySelector("[data-action='toggle-nav']")?.addEventListener("click", () => {
    root.querySelector(".shell")?.classList.toggle("nav-open");
  });
}

export function emptyState(title, body) {
  return `<div class="empty"><h3>${title}</h3><p>${body}</p></div>`;
}

export function pager(page, total, limit, hrefBase) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return "";
  const prev = page > 1 ? `${hrefBase}${page - 1}` : "";
  const next = page < pages ? `${hrefBase}${page + 1}` : "";
  return `
    <div class="pager">
      ${prev ? `<a class="btn-secondary" href="${prev}">Previous</a>` : "<span></span>"}
      <span>Page ${page} of ${pages}</span>
      ${next ? `<a class="btn-secondary" href="${next}">Next</a>` : "<span></span>"}
    </div>
  `;
}
