import { api, badgeClass, formatDate, imageSrc } from "../api.js";
import { isAdmin } from "../auth.js";
import {
  CHART_COLORS,
  SAFETY_COLORS,
  VERDICT_COLORS,
  destroyCharts,
  loadChartJs,
  makeBar,
  makeDoughnut,
  makeGroupedBar,
  makeLine,
} from "../charts.js";
import { bindShell, emptyState, pager, renderShell } from "../layout.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statCard(label, value, hint = "") {
  return `<article class="stat-card"><span>${label}</span><strong>${value}</strong>${
    hint ? `<em class="stat-hint">${hint}</em>` : ""
  }</article>`;
}

function providerLabel(name) {
  const map = {
    openai: "OpenAI",
    gemini: "Gemini",
    stability: "Stability",
    huggingface: "HuggingFace",
    replicate: "Replicate",
    bedrock: "Bedrock",
    azure: "Azure",
  };
  return map[String(name || "").toLowerCase()] || String(name || "Unknown");
}

function formatPct(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function formatMs(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const ms = Number(value);
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function analyticsQuery(query) {
  const preset = query.get("range") || "30";
  const from = query.get("from") || "";
  const to = query.get("to") || "";
  const params = new URLSearchParams();
  if (from || to) {
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  } else if (preset === "all") {
    params.set("days", "3650");
  } else {
    params.set("days", preset);
  }
  return { preset, from, to, params };
}

export async function renderAdminOverview({ user, path, query }) {
  const { preset, from, to, params } = analyticsQuery(query || new URLSearchParams());
  let stats = {};
  let analytics = null;
  let error = "";
  try {
    [stats, analytics] = await Promise.all([
      api("/admin/stats"),
      api(`/admin/analytics?${params.toString()}`),
    ]);
  } catch (err) {
    error = err.message;
  }

  const summary = analytics?.summary || {};
  const rangeLabel = analytics?.range?.label || "Selected range";

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
      ${statCard("Feedback", stats.feedbackTotal ?? "—")}
      ${statCard("Thumbs up", stats.feedbackUp ?? "—")}
      ${statCard("Thumbs down", stats.feedbackDown ?? "—")}
    </div>

    <section class="card analytics-panel">
      <div class="analytics-header">
        <div>
          <h2>Usage &amp; satisfaction analytics</h2>
          <p class="muted">Charts for academic reporting · ${escapeHtml(rangeLabel)}</p>
        </div>
        <form class="analytics-filters" data-form="analytics-range">
          <div class="range-presets" role="group" aria-label="Date range">
            ${[
              ["7", "7 days"],
              ["14", "14 days"],
              ["30", "30 days"],
              ["all", "All time"],
            ]
              .map(
                ([value, label]) => `
                <button type="button" class="range-chip ${!from && !to && preset === value ? "is-active" : ""}" data-range="${value}">${label}</button>
              `
              )
              .join("")}
          </div>
          <label class="analytics-date">
            <span>From</span>
            <input type="date" name="from" value="${escapeHtml(from)}" />
          </label>
          <label class="analytics-date">
            <span>To</span>
            <input type="date" name="to" value="${escapeHtml(to)}" />
          </label>
          <button type="submit" class="btn-secondary">Apply</button>
        </form>
      </div>

      <div class="stats-grid analytics-summary">
        ${statCard("In range", summary.generations ?? 0, "generations")}
        ${statCard("Rated", summary.rated ?? 0, "with feedback")}
        ${statCard("Satisfaction", formatPct(summary.satisfactionRate), "thumbs up / rated")}
        ${statCard("Unrated", summary.unrated ?? 0, "no feedback yet")}
        ${statCard("Avg latency", formatMs(summary.avgDurationMs), "provider call")}
        ${statCard("P95 latency", formatMs(summary.p95DurationMs), "95th percentile")}
      </div>

      <div class="chart-grid">
        <article class="chart-card chart-card-wide">
          <canvas id="chart-daily" aria-label="Daily generations"></canvas>
          <p class="chart-empty muted" data-empty="daily" hidden>No generations in this range.</p>
        </article>
        <article class="chart-card">
          <canvas id="chart-provider-pie" aria-label="Provider usage pie"></canvas>
          <p class="chart-empty muted" data-empty="provider-pie" hidden>No provider usage data.</p>
        </article>
        <article class="chart-card">
          <canvas id="chart-satisfaction-pie" aria-label="Satisfaction pie"></canvas>
          <p class="chart-empty muted" data-empty="satisfaction-pie" hidden>No ratings in this range.</p>
        </article>
        <article class="chart-card chart-card-wide">
          <canvas id="chart-provider-bar" aria-label="Provider usage bar"></canvas>
          <p class="chart-empty muted" data-empty="provider-bar" hidden>No provider usage data.</p>
        </article>
        <article class="chart-card chart-card-wide">
          <canvas id="chart-provider-latency" aria-label="Average latency by provider"></canvas>
          <p class="chart-empty muted" data-empty="provider-latency" hidden>No timed generations yet. New generates store durationMs.</p>
        </article>
        <article class="chart-card chart-card-wide">
          <canvas id="chart-provider-satisfaction" aria-label="Satisfaction by provider"></canvas>
          <p class="chart-empty muted" data-empty="provider-satisfaction" hidden>No provider ratings yet.</p>
        </article>
        <article class="chart-card">
          <canvas id="chart-tags" aria-label="Feedback reason tags"></canvas>
          <p class="chart-empty muted" data-empty="tags" hidden>No feedback tags yet.</p>
        </article>
        <article class="chart-card">
          <canvas id="chart-safety" aria-label="Safety status breakdown"></canvas>
          <p class="chart-empty muted" data-empty="safety" hidden>No safety status data.</p>
        </article>
      </div>

      <div class="table-wrap analytics-table">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Generations</th>
              <th>Rated</th>
              <th>Up</th>
              <th>Down</th>
              <th>Satisfaction</th>
              <th>Avg latency</th>
              <th>P50</th>
              <th>P95</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const sat = analytics?.satisfactionByProvider || [];
              const latencyMap = Object.fromEntries(
                (analytics?.latencyByProvider || []).map((row) => [row.provider, row])
              );
              const providers = new Set([
                ...sat.map((row) => row.provider),
                ...Object.keys(latencyMap),
              ]);
              const rows = [...providers].map((name) => {
                const s = sat.find((row) => row.provider === name) || {
                  provider: name,
                  generations: 0,
                  rated: 0,
                  up: 0,
                  down: 0,
                  satisfactionRate: null,
                };
                const l = latencyMap[name];
                return { ...s, latency: l };
              });
              rows.sort((a, b) => (b.generations || 0) - (a.generations || 0));
              if (!rows.length) {
                return `<tr><td colspan="9" class="muted">No rows for this range.</td></tr>`;
              }
              return rows
                .map(
                  (row) => `
                <tr>
                  <td><strong>${escapeHtml(providerLabel(row.provider))}</strong></td>
                  <td>${row.generations}</td>
                  <td>${row.rated}</td>
                  <td><span class="badge badge-ok">${row.up}</span></td>
                  <td><span class="badge badge-danger">${row.down}</span></td>
                  <td>${formatPct(row.satisfactionRate)}</td>
                  <td>${formatMs(row.latency?.avgMs)}</td>
                  <td>${formatMs(row.latency?.p50Ms)}</td>
                  <td>${formatMs(row.latency?.p95Ms)}</td>
                </tr>
              `
                )
                .join("");
            })()}
          </tbody>
        </table>
      </div>
    </section>

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
      subtitle: "Accounts, generation volume, provider usage, and satisfaction.",
      content,
    }),
    bind(root) {
      bindShell(root);
      const form = root.querySelector("[data-form='analytics-range']");
      form?.querySelectorAll("[data-range]").forEach((button) => {
        button.addEventListener("click", () => {
          window.location.hash = `#/admin?range=${button.dataset.range}`;
        });
      });
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const fd = new FormData(form);
        const nextFrom = String(fd.get("from") || "").trim();
        const nextTo = String(fd.get("to") || "").trim();
        const q = new URLSearchParams();
        if (nextFrom) q.set("from", nextFrom);
        if (nextTo) q.set("to", nextTo);
        if (!nextFrom && !nextTo) q.set("range", "30");
        window.location.hash = `#/admin?${q.toString()}`;
      });

      if (!analytics) return;
      const charts = [];
      loadChartJs()
        .then((Chart) => {
          const usage = analytics.providerUsage || [];
          const satisfaction = analytics.satisfactionByProvider || [];
          const latency = analytics.latencyByProvider || [];
          const tags = analytics.feedbackTags || [];
          const daily = analytics.dailyGenerations || [];
          const safety = analytics.safetyBreakdown || [];
          const pie = analytics.satisfactionPie || [];

          const setEmpty = (canvasId, emptyKey, empty) => {
            const canvas = root.querySelector(`#${canvasId}`);
            const el = root.querySelector(`[data-empty="${emptyKey}"]`);
            if (el) el.hidden = !empty;
            if (canvas) canvas.hidden = empty;
          };

          // Daily line
          const dailyCanvas = root.querySelector("#chart-daily");
          if (dailyCanvas) {
            const hasDaily = daily.some((d) => d.count > 0);
            setEmpty("chart-daily", "daily", !hasDaily);
            if (hasDaily) {
              charts.push(
                makeLine(
                  Chart,
                  dailyCanvas,
                  daily.map((d) => d.date.slice(5)),
                  daily.map((d) => d.count),
                  "Daily generation volume"
                )
              );
            }
          }

          // Provider pie
          const providerPie = root.querySelector("#chart-provider-pie");
          if (providerPie) {
            const empty = !usage.length;
            setEmpty("chart-provider-pie", "provider-pie", empty);
            if (!empty) {
              charts.push(
                makeDoughnut(
                  Chart,
                  providerPie,
                  usage.map((u) => providerLabel(u.provider)),
                  usage.map((u) => u.count),
                  usage.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
                  "Provider usage share"
                )
              );
            }
          }

          // Satisfaction pie
          const satPie = root.querySelector("#chart-satisfaction-pie");
          if (satPie) {
            const total = pie.reduce((sum, item) => sum + (item.count || 0), 0);
            setEmpty("chart-satisfaction-pie", "satisfaction-pie", total === 0);
            if (total > 0) {
              charts.push(
                makeDoughnut(
                  Chart,
                  satPie,
                  pie.map((item) => item.label),
                  pie.map((item) => item.count),
                  pie.map((item) => VERDICT_COLORS[item.key] || CHART_COLORS[0]),
                  "Overall thumbs up vs down"
                )
              );
            }
          }

          // Provider bar
          const providerBar = root.querySelector("#chart-provider-bar");
          if (providerBar) {
            const empty = !usage.length;
            setEmpty("chart-provider-bar", "provider-bar", empty);
            if (!empty) {
              charts.push(
                makeBar(
                  Chart,
                  providerBar,
                  usage.map((u) => providerLabel(u.provider)),
                  usage.map((u) => u.count),
                  usage.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
                  "Generations by provider"
                )
              );
            }
          }

          // Latency by provider
          const latencyBar = root.querySelector("#chart-provider-latency");
          if (latencyBar) {
            const empty = !latency.length;
            setEmpty("chart-provider-latency", "provider-latency", empty);
            if (!empty) {
              charts.push(
                makeGroupedBar(
                  Chart,
                  latencyBar,
                  latency.map((row) => providerLabel(row.provider)),
                  [
                    {
                      label: "Avg ms",
                      data: latency.map((row) => row.avgMs),
                      backgroundColor: "#0ea5e9",
                      borderRadius: 6,
                      maxBarThickness: 28,
                    },
                    {
                      label: "P50 ms",
                      data: latency.map((row) => row.p50Ms),
                      backgroundColor: "#14b8a6",
                      borderRadius: 6,
                      maxBarThickness: 28,
                    },
                    {
                      label: "P95 ms",
                      data: latency.map((row) => row.p95Ms),
                      backgroundColor: "#f59e0b",
                      borderRadius: 6,
                      maxBarThickness: 28,
                    },
                  ],
                  "Provider latency (ms)"
                )
              );
            }
          }

          // Satisfaction by provider grouped bar
          const satBar = root.querySelector("#chart-provider-satisfaction");
          if (satBar) {
            const ratedRows = satisfaction.filter((row) => row.rated > 0);
            setEmpty("chart-provider-satisfaction", "provider-satisfaction", !ratedRows.length);
            if (ratedRows.length) {
              charts.push(
                makeGroupedBar(
                  Chart,
                  satBar,
                  ratedRows.map((row) => providerLabel(row.provider)),
                  [
                    {
                      label: "Thumbs up",
                      data: ratedRows.map((row) => row.up),
                      backgroundColor: VERDICT_COLORS.UP,
                      borderRadius: 6,
                      maxBarThickness: 28,
                    },
                    {
                      label: "Thumbs down",
                      data: ratedRows.map((row) => row.down),
                      backgroundColor: VERDICT_COLORS.DOWN,
                      borderRadius: 6,
                      maxBarThickness: 28,
                    },
                  ],
                  "Satisfaction by provider"
                )
              );
            }
          }

          // Tags horizontal bar
          const tagsCanvas = root.querySelector("#chart-tags");
          if (tagsCanvas) {
            setEmpty("chart-tags", "tags", !tags.length);
            if (tags.length) {
              charts.push(
                makeBar(
                  Chart,
                  tagsCanvas,
                  tags.map((t) => t.label),
                  tags.map((t) => t.count),
                  tags.map((_, i) => CHART_COLORS[(i + 2) % CHART_COLORS.length]),
                  "Feedback reason tags",
                  { horizontal: true }
                )
              );
            }
          }

          // Safety doughnut
          const safetyCanvas = root.querySelector("#chart-safety");
          if (safetyCanvas) {
            setEmpty("chart-safety", "safety", !safety.length);
            if (safety.length) {
              charts.push(
                makeDoughnut(
                  Chart,
                  safetyCanvas,
                  safety.map((s) => s.status),
                  safety.map((s) => s.count),
                  safety.map((s) => SAFETY_COLORS[s.status] || CHART_COLORS[8]),
                  "Safety status mix"
                )
              );
            }
          }
        })
        .catch((err) => {
          const panel = root.querySelector(".analytics-panel");
          if (panel) {
            const note = document.createElement("p");
            note.className = "error";
            note.textContent = err.message || "Charts could not be loaded.";
            panel.appendChild(note);
          }
        });

      // Clean up when navigating away (hashchange will re-render).
      const onLeave = () => {
        destroyCharts(charts);
        window.removeEventListener("hashchange", onLeave);
      };
      window.addEventListener("hashchange", onLeave, { once: true });
    },
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
    .map((item) => {
      const fb = item.feedback;
      const feedbackLabel = fb
        ? `${fb.verdict === "UP" ? "Up" : "Down"}${fb.tags?.length ? ` · ${fb.tags.join(", ")}` : ""}`
        : "—";
      return `
        <tr>
          <td>
            <div class="clip">${escapeHtml(item.promptText)}</div>
            <div class="muted">${escapeHtml(item.user?.email || "Anonymous")} · ${escapeHtml(item.provider)}</div>
          </td>
          <td><span class="${badgeClass(item.safetyStatus)}">${escapeHtml(item.safetyStatus)}</span></td>
          <td><span class="${fb ? badgeClass(fb.verdict === "UP" ? "allowed" : "flagged") : "muted"}">${escapeHtml(feedbackLabel)}</span></td>
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
      `;
    })
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
            <thead><tr><th>Prompt</th><th>Safety</th><th>Feedback</th><th>Created</th><th></th></tr></thead>
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
