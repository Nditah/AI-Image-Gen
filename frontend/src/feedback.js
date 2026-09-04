/** Structured reason tags for per-generation feedback (option A). */
export const FEEDBACK_TAGS = [
  { id: "accurate", label: "Accurate" },
  { id: "creative", label: "Creative" },
  { id: "not_what_i_asked", label: "Not what I asked" },
  { id: "low_quality", label: "Low quality" },
  { id: "felt_unsafe", label: "Felt unsafe" },
  { id: "overblocked", label: "Over-blocked" },
  { id: "slow", label: "Slow" },
  { id: "provider_issue", label: "Provider issue" },
];

const THUMB_UP_ICON = `<svg class="feedback-thumb-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 21h4V9H2v12zm20.83-9.17c-.18-.41-.53-.7-.95-.8L14.5 9.5V5c0-1.66-1.34-3-3-3-.55 0-1 .45-1 1v.5c0 .83-.34 1.58-.88 2.12L6.5 9.5V21h11.19c.81 0 1.52-.5 1.8-1.25l2.34-6.56c.18-.5.1-1.05-.2-1.46z"/></svg>`;
const THUMB_DOWN_ICON = `<svg class="feedback-thumb-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 3h-4v12h4V3zM2.17 12.17c.18.41.53.7.95.8L9.5 14.5V19c0 1.66 1.34 3 3 3 .55 0 1-.45 1-1v-.5c0-.83.34-1.58.88-2.12l3.12-3.12V3H6.31c-.81 0-1.52.5-1.8 1.25L2.17 10.81c-.18.5-.1 1.05.2 1.36z"/></svg>`;

export function feedbackPanelHtml(generationId, feedback = null, { compact = false } = {}) {
  const id = Number(generationId);
  if (!Number.isFinite(id) || id < 1) return "";

  const verdict = feedback?.verdict || "";
  const selected = new Set(feedback?.tags || []);
  const remark = feedback?.remark || "";
  const tags = FEEDBACK_TAGS.map(
    (tag) => `
      <label class="feedback-tag">
        <input type="checkbox" name="tag" value="${tag.id}" ${selected.has(tag.id) ? "checked" : ""} />
        <span>${tag.label}</span>
      </label>
    `
  ).join("");

  return `
    <form class="feedback-panel ${compact ? "is-compact" : ""}" data-feedback="${id}" novalidate>
      <p class="feedback-heading">${feedback ? "Your feedback" : "How was this result?"}</p>
      <div class="feedback-thumbs" role="group" aria-label="Satisfaction">
        <button type="button" class="feedback-thumb ${verdict === "UP" ? "is-active" : ""}" data-verdict="UP" aria-pressed="${verdict === "UP"}" aria-label="Thumbs up" title="Thumbs up">${THUMB_UP_ICON}</button>
        <button type="button" class="feedback-thumb ${verdict === "DOWN" ? "is-active" : ""}" data-verdict="DOWN" aria-pressed="${verdict === "DOWN"}" aria-label="Thumbs down" title="Thumbs down">${THUMB_DOWN_ICON}</button>
      </div>
      <div class="feedback-tags">${tags}</div>
      <label class="feedback-remark-label" for="feedback-remark-${id}">Remark <span class="muted">(optional)</span></label>
      <textarea id="feedback-remark-${id}" name="remark" maxlength="500" rows="${compact ? 2 : 3}" placeholder="What worked or what went wrong?">${escapeAttr(remark)}</textarea>
      <div class="feedback-actions">
        <p class="feedback-status muted" data-feedback-status hidden></p>
        <button type="submit" class="btn-secondary" ${verdict ? "" : "disabled"}>Save feedback</button>
      </div>
    </form>
  `;
}

function escapeAttr(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function bindFeedbackPanels(root, api) {
  root.querySelectorAll("[data-feedback]").forEach((form) => {
    const generationId = Number(form.dataset.feedback);
    const statusEl = form.querySelector("[data-feedback-status]");
    const submitBtn = form.querySelector('button[type="submit"]');
    let verdict = form.querySelector(".feedback-thumb.is-active")?.dataset.verdict || "";

    form.querySelectorAll("[data-verdict]").forEach((button) => {
      button.addEventListener("click", () => {
        verdict = button.dataset.verdict;
        form.querySelectorAll("[data-verdict]").forEach((other) => {
          const active = other === button;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", active ? "true" : "false");
        });
        if (submitBtn) submitBtn.disabled = !verdict;
        if (statusEl) {
          statusEl.hidden = true;
          statusEl.textContent = "";
        }
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!verdict) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = "Choose thumbs up or thumbs down.";
        }
        return;
      }
      const tags = [...form.querySelectorAll('input[name="tag"]:checked')].map((input) => input.value);
      const remark = form.remark.value.trim() || null;
      if (submitBtn) submitBtn.disabled = true;
      try {
        await api(`/me/generations/${generationId}/feedback`, {
          method: "PUT",
          body: { verdict, tags, remark },
        });
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = "Saved.";
        }
      } catch (error) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = error.message || "Could not save feedback.";
        }
      } finally {
        if (submitBtn) submitBtn.disabled = !verdict;
      }
    });
  });
}
