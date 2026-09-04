import { isStaff } from "./auth.js";
import { logout } from "./api.js";

const ICONS = {
  generate: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM18.5 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6zM5.5 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/></svg>`,
  gallery: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13zm2.5 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM6 17l3.5-4.5 2.5 3 3.5-4.5L18 17H6z"/></svg>`,
  guidelines: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10a2 2 0 0 1 2 2v13.2a.8.8 0 0 1-1.3.6L12 16.5l-5.7 3.3A.8.8 0 0 1 5 19.2V6a2 2 0 0 1 2-2zm0 2v11.1l4.2-2.4a1.5 1.5 0 0 1 1.6 0L17 17.1V6H7z"/></svg>`,
  account: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 10c4.2 0 8 2.1 8 4.5V20H4v-1.5C4 16.1 7.8 14 12 14z"/></svg>`,
  overview: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4V4zm9 0h7v4h-7V4zM4 13h7v7H4v-7zm9 6v-9h7v9h-7z"/></svg>`,
  users: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm7.5-1a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM3 19.2C3 16.5 6.1 15 9 15s6 1.5 6 4.2V20H3v-.8zm12.5-.2c0-1.4.6-2.5 1.6-3.3 1 .4 2.1.6 3.4.6 1.7 0 3.2-.5 4-.9v3.8h-9z"/></svg>`,
  generations: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm4 4v6h8v-2.2l-2.1-2.1a1 1 0 0 0-1.4 0L11 15.2l-.8-.8a1 1 0 0 0-1.4 0L8 15.2V10z"/></svg>`,
  reports: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 4a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1zm0 9.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z"/></svg>`,
  events: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h2v2h6V3h2v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V3zm12 8H5v8h14v-8zM7 9h10V7H7v2z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4v-2H6V6h4V4zm3.6 4.4 4.2 3.6-4.2 3.6V13H9v-2h4.6V8.4z"/></svg>`,
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initials(user) {
  const source = (user.displayName || user.email || "U").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function navLink(href, label, icon, activePath) {
  const hrefPath = href.replace(/^#/, "");
  const active =
    activePath === hrefPath ||
    (hrefPath !== "/admin" && activePath.startsWith(`${hrefPath}/`));
  return `
    <a class="nav-link ${active ? "is-active" : ""}" href="${href}" ${active ? 'aria-current="page"' : ""}>
      <span class="nav-icon">${ICONS[icon] || ""}</span>
      <span class="nav-text">${label}</span>
    </a>
  `;
}

function navSection(label, links) {
  return `
    <div class="nav-section">
      <p class="nav-label">${label}</p>
      <div class="nav-group">${links}</div>
    </div>
  `;
}

export function renderShell({ user, path, title, subtitle = "", content }) {
  const staff = isStaff(user);
  const studio = navSection(
    "Studio",
    [
      navLink("#/app/generate", "Generate", "generate", path),
      navLink("#/app/gallery", "Gallery", "gallery", path),
      navLink("#/app/guidelines", "Guidelines", "guidelines", path),
      navLink("#/app/account", "Account", "account", path),
    ].join("")
  );
  const admin = staff
    ? navSection(
        "Administration",
        [
          navLink("#/admin", "Overview", "overview", path),
          navLink("#/admin/users", "Users", "users", path),
          navLink("#/admin/generations", "Generations", "generations", path),
          navLink("#/admin/reports", "Reports", "reports", path),
          navLink("#/admin/events", "Auth events", "events", path),
        ].join("")
      )
    : "";

  return `
    <div class="shell">
      <div class="sidebar-backdrop" data-action="close-nav" hidden></div>
      <aside class="sidebar">
        <div class="sidebar-top">
          <a class="brand" href="${staff ? "#/admin" : "#/app/generate"}">
            <span class="brand-mark" aria-hidden="true">AI</span>
            <span class="brand-copy">
              <strong>Image Gen</strong>
              <em>${staff ? "Staff console" : "Creative studio"}</em>
            </span>
          </a>
          <button class="sidebar-close" type="button" data-action="close-nav" aria-label="Close menu">×</button>
        </div>

        <nav class="nav" aria-label="Primary">
          ${studio}
          ${admin}
        </nav>

        <div class="sidebar-footer">
          <div class="user-card">
            <div class="user-avatar" aria-hidden="true">${escapeHtml(initials(user))}</div>
            <div class="user-meta">
              <strong title="${escapeHtml(user.displayName || user.email)}">${escapeHtml(user.displayName || user.email)}</strong>
              <span class="user-role">${escapeHtml(user.role)}</span>
            </div>
          </div>
          <button class="btn-logout" type="button" data-action="logout">
            <span class="nav-icon">${ICONS.logout}</span>
            Sign out
          </button>
        </div>
      </aside>

      <div class="workspace">
        <header class="topbar">
          <button class="menu-btn" type="button" data-action="toggle-nav" aria-label="Open menu">
            <span></span><span></span><span></span>
          </button>
          <div class="topbar-copy">
            <p class="topbar-kicker">${staff ? "Administration" : "Studio"}</p>
            <h1>${title}</h1>
            ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
          </div>
        </header>
        <div class="page">${content}</div>
      </div>
    </div>
  `;
}

function setNavOpen(root, open) {
  const shell = root.querySelector(".shell");
  const backdrop = root.querySelector(".sidebar-backdrop");
  shell?.classList.toggle("nav-open", open);
  if (backdrop) backdrop.hidden = !open;
}

export function bindShell(root) {
  root.querySelector("[data-action='logout']")?.addEventListener("click", async () => {
    await logout();
    window.location.hash = "#/login";
  });
  root.querySelector("[data-action='toggle-nav']")?.addEventListener("click", () => {
    setNavOpen(root, true);
  });
  root.querySelectorAll("[data-action='close-nav']").forEach((el) => {
    el.addEventListener("click", () => setNavOpen(root, false));
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
