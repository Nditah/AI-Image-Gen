import { api, badgeClass, formatDate, imageSrc } from "../api.js";
import { isAdmin } from "../auth.js";
import { bindShell, emptyState, pager, renderShell } from "../layout.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statCard(label, value) {
  return `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`;
}

export async function renderAdminOverview({ user, path }) {
  let stats = {};
  let error = "";
  try {
    stats = await api("/admin/stats");
  } catch (err) {
    error = err.message;
  }

  const content = `
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
    <div class="stats-grid">
      ${statCard("Users", stats.users ?? "—")}
      ${statCard("Generations", stats.generations ?? "—")}
      ${statCard("Blocked", stats.blocked ?? "—")}
      ${statCard("Open reports", stats.openReports ?? "—")}
      ${statCard("Last 24h", stats.generationsLast24h ?? "—")}
      ${statCard("Suspended", stats.suspended ?? "—")}
      ${statCard("Banned", stats.banned ?? "—")}
    </div>
    <section class="card">
      <h2>Staff shortcuts</h2>
      <div class="chip-row">
        <a class="btn-secondary" href="#/admin/users">Manage users</a>
        <a class="btn-secondary" href="#/admin/generations">Review generations</a>
        <a class="btn-secondary" href="#/admin/reports">Open reports</a>
        <a class="btn-secondary" href="#/app/generate">Open studio</a>
      </div>
    </section>
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Admin overview",
      subtitle: "Accounts, generation volume, and moderation load.",
      content,
    }),
    bind: bindShell,
  };
}

export async function renderAdminUsers({ user, path, query }) {
  const page = Number(query.get("page") || 1);
  const q = query.get("q") || "";
  let data = { items: [], total: 0, limit: 20, page };
  let error = "";
  try {
    const search = q ? `&q=${encodeURIComponent(q)}` : "";
    data = await api(`/admin/users?page=${page}&limit=20${search}`);
  } catch (err) {
    error = err.message;
  }

  const rows = (data.items || [])
    .map((item) => {
      const canAct = isAdmin(user) && item.id !== user.id;
      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.displayName || "—")}</strong>
            <div class="muted">${escapeHtml(item.email)}</div>
          </td>
          <td><span class="${badgeClass(item.role)}">${escapeHtml(item.role)}</span></td>
          <td><span class="${badgeClass(item.status)}">${escapeHtml(item.status)}</span></td>
          <td>${formatDate(item.lastLoginAt)}</td>
          <td>
            ${
              canAct
                ? `
                  <div class="table-actions">
                    <button type="button" class="btn-secondary" data-moderation="SUSPEND" data-user="${item.id}">Suspend</button>
                    <button type="button" class="btn-danger" data-moderation="BAN" data-user="${item.id}">Ban</button>
                    <button type="button" class="btn-secondary" data-moderation="REINSTATE" data-user="${item.id}">Reinstate</button>
                  </div>
                `
                : `<span class="muted">${item.id === user.id ? "You" : "View only"}</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  const content = `
    <form class="toolbar" data-form="user-search">
      <input name="q" placeholder="Search email or name" value="${escapeHtml(q)}" />
      <button class="btn-secondary" type="submit">Search</button>
    </form>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
    ${
      data.items?.length
        ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${pager(data.page, data.total, data.limit, `#/admin/users?q=${encodeURIComponent(q)}&page=`)}
        `
        : emptyState("No users found", "Try another search or seed the database.")
    }
    <p id="admin-status" class="hint hidden"></p>
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Users",
      subtitle: "Suspend, ban, or reinstate accounts.",
      content,
    }),
    bind(root) {
      bindShell(root);
      root.querySelector("[data-form='user-search']")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = event.currentTarget.q.value.trim();
        window.location.hash = `#/admin/users?q=${encodeURIComponent(value)}`;
      });
      const status = root.querySelector("#admin-status");
      root.querySelectorAll("[data-moderation]").forEach((button) => {
        button.addEventListener("click", async () => {
          const reason = window.prompt(`Reason for ${button.dataset.moderation.toLowerCase()}?`, "Policy violation");
          if (!reason) return;
          button.disabled = true;
          try {
            await api("/admin/moderation", {
              method: "POST",
              body: {
                target_user_id: button.dataset.user,
                action: button.dataset.moderation,
                reason,
              },
            });
            window.location.hash = `#/admin/users?q=${encodeURIComponent(q)}&page=${page}&t=${Date.now()}`;
          } catch (err) {
            status.textContent = err.message;
            status.classList.remove("hidden");
            button.disabled = false;
          }
        });
      });
    },
  };
}

export async function renderAdminGenerations({ user, path, query }) {
  const page = Number(query.get("page") || 1);
  const safety = query.get("safety") || "";
  const q = query.get("q") || "";
  let data = { items: [], total: 0, limit: 20, page };
  let error = "";
  try {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (safety) params.set("safety_status", safety);
    if (q) params.set("q", q);
    data = await api(`/admin/generations?${params.toString()}`);
  } catch (err) {
    error = err.message;
  }

  const rows = (data.items || [])
    .map(
      (item) => `
        <tr>
          <td>
            <div class="clip">${escapeHtml(item.promptText)}</div>
            <div class="muted">${escapeHtml(item.user?.email || "Anonymous")} · ${escapeHtml(item.provider)}</div>
          </td>
          <td><span class="${badgeClass(item.safetyStatus)}">${escapeHtml(item.safetyStatus)}</span></td>
          <td>${formatDate(item.createdAt)}</td>
          <td>
            <div class="table-actions">
              ${item.hasImage ? `<button type="button" class="btn-secondary" data-preview="${item.id}">View</button>` : ""}
              ${
                item.hasImage
                  ? `<button type="button" class="btn-danger" data-remove="${item.id}" data-user="${item.user?.id || ""}">Remove</button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  const content = `
    <form class="toolbar" data-form="log-search">
      <input name="q" placeholder="Search prompts" value="${escapeHtml(q)}" />
      <select name="safety">
        <option value="">All statuses</option>
        ${["ALLOWED", "BLOCKED", "FLAGGED", "REMOVED", "PENDING"]
          .map((value) => `<option value="${value}" ${safety === value ? "selected" : ""}>${value}</option>`)
          .join("")}
      </select>
      <button class="btn-secondary" type="submit">Filter</button>
    </form>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
    ${
      data.items?.length
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Prompt</th><th>Safety</th><th>Created</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
          ${pager(
            data.page,
            data.total,
            data.limit,
            `#/admin/generations?q=${encodeURIComponent(q)}&safety=${encodeURIComponent(safety)}&page=`
          )}`
        : emptyState("No generations", "Logs appear after users create or attempt images.")
    }
    <dialog id="preview-dialog" class="preview-dialog">
      <form method="dialog"><button class="btn-ghost" type="submit">Close</button></form>
      <img id="preview-image" alt="Generation preview" />
      <p id="preview-caption" class="muted"></p>
    </dialog>
    <p id="admin-status" class="hint hidden"></p>
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Generations",
      subtitle: "Review stored prompts and remove abusive images.",
      content,
    }),
    bind(root) {
      bindShell(root);
      root.querySelector("[data-form='log-search']")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        window.location.hash = `#/admin/generations?q=${encodeURIComponent(form.q.value.trim())}&safety=${encodeURIComponent(form.safety.value)}`;
      });
      const dialog = root.querySelector("#preview-dialog");
      const previewImage = root.querySelector("#preview-image");
      const caption = root.querySelector("#preview-caption");
      const status = root.querySelector("#admin-status");

      root.querySelectorAll("[data-preview]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            const item = await api(`/admin/generations/${button.dataset.preview}`);
            previewImage.src = imageSrc(item.image_base64);
            caption.textContent = item.promptText;
            dialog.showModal();
          } catch (err) {
            status.textContent = err.message;
            status.classList.remove("hidden");
          }
        });
      });

      root.querySelectorAll("[data-remove]").forEach((button) => {
        button.addEventListener("click", async () => {
          const reason = window.prompt("Reason for removing this image?", "Policy violation");
          if (!reason || !button.dataset.user) return;
          button.disabled = true;
          try {
            await api("/admin/moderation", {
              method: "POST",
              body: {
                target_user_id: button.dataset.user,
                action: "REMOVE_CONTENT",
                reason,
                prompt_log_id: Number(button.dataset.remove),
              },
            });
            window.location.hash = `#/admin/generations?q=${encodeURIComponent(q)}&safety=${encodeURIComponent(safety)}&page=${page}&t=${Date.now()}`;
          } catch (err) {
            status.textContent = err.message;
            status.classList.remove("hidden");
            button.disabled = false;
          }
        });
      });
    },
  };
}

export async function renderAdminReports({ user, path, query }) {
  const page = Number(query.get("page") || 1);
  const statusFilter = query.get("status") || "";
  let data = { items: [], total: 0, limit: 20, page };
  let error = "";
  try {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    data = await api(`/admin/reports?${params.toString()}`);
  } catch (err) {
    error = err.message;
  }

  const rows = (data.items || [])
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.violationCategory)}</strong>
            <div class="muted">${escapeHtml(item.details || "No details")} · ${escapeHtml(item.reporter?.email || "")}</div>
          </td>
          <td><span class="${badgeClass(item.status)}">${escapeHtml(item.status)}</span></td>
          <td>${formatDate(item.createdAt)}</td>
          <td>
            <select data-report="${item.id}">
              ${["OPEN", "UNDER_REVIEW", "ACTIONED", "DISMISSED"]
                .map((value) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${value}</option>`)
                .join("")}
            </select>
          </td>
        </tr>
      `
    )
    .join("");

  const content = `
    <form class="toolbar" data-form="report-filter">
      <select name="status">
        <option value="">All reports</option>
        ${["OPEN", "UNDER_REVIEW", "ACTIONED", "DISMISSED"]
          .map((value) => `<option value="${value}" ${statusFilter === value ? "selected" : ""}>${value}</option>`)
          .join("")}
      </select>
      <button class="btn-secondary" type="submit">Filter</button>
    </form>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
    ${
      data.items?.length
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Report</th><th>Status</th><th>Created</th><th>Update</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
          ${pager(data.page, data.total, data.limit, `#/admin/reports?status=${encodeURIComponent(statusFilter)}&page=`)}`
        : emptyState("No reports", "User-submitted reports will land here.")
    }
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Reports",
      subtitle: "Review and action user-submitted reports.",
      content,
    }),
    bind(root) {
      bindShell(root);
      root.querySelector("[data-form='report-filter']")?.addEventListener("submit", (event) => {
        event.preventDefault();
        window.location.hash = `#/admin/reports?status=${encodeURIComponent(event.currentTarget.status.value)}`;
      });
      root.querySelectorAll("[data-report]").forEach((select) => {
        select.addEventListener("change", async () => {
          try {
            await api(`/admin/reports/${select.dataset.report}`, {
              method: "PATCH",
              body: { status: select.value },
            });
          } catch (err) {
            select.closest("td").insertAdjacentHTML("beforeend", `<div class="error">${escapeHtml(err.message)}</div>`);
          }
        });
      });
    },
  };
}

export async function renderAdminEvents({ user, path, query }) {
  const page = Number(query.get("page") || 1);
  let data = { items: [], total: 0, limit: 20, page };
  let error = "";
  try {
    data = await api(`/admin/events?page=${page}&limit=20`);
  } catch (err) {
    error = err.message;
  }

  const rows = (data.items || [])
    .map(
      (item) => `
        <tr>
          <td><span class="${badgeClass(item.type)}">${escapeHtml(item.type)}</span></td>
          <td>${escapeHtml(item.user?.email || "—")}</td>
          <td>${escapeHtml(item.ipAddress || "—")}</td>
          <td>${formatDate(item.createdAt)}</td>
        </tr>
      `
    )
    .join("");

  const content = `
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
    ${
      data.items?.length
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Event</th><th>User</th><th>IP</th><th>When</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
          ${pager(data.page, data.total, data.limit, "#/admin/events?page=")}`
        : emptyState("No auth events", "Login and logout activity will show here.")
    }
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Auth events",
      subtitle: "Sign-in, sign-out, and failed login attempts.",
      content,
    }),
    bind: bindShell,
  };
}
