import { api, badgeClass, formatDate, imageSrc, isConsentComplete } from "../api.js";
import { bindFeedbackPanels, feedbackPanelHtml } from "../feedback.js";
import { bindShell, emptyState, pager, renderShell } from "../layout.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function renderGenerate({ user, path }) {
  let consentReady = false;
  let missingCount = 0;
  try {
    const consents = await api("/me/consents");
    consentReady = isConsentComplete(consents);
    if (Array.isArray(consents.missing)) {
      missingCount = consents.missing.length;
    } else if (!consentReady) {
      const acceptedKinds = new Set(
        (consents.items || []).map((item) => item.policy?.kind).filter(Boolean)
      );
      missingCount = ["AGE_GATE", "ACCEPTABLE_USE", "PRIVACY", "TERMS_OF_SERVICE"].filter(
        (kind) => !acceptedKinds.has(kind)
      ).length;
    }
  } catch {
    consentReady = false;
  }

  const gateNotice = consentReady
    ? ""
    : `
      <aside class="consent-gate" role="status">
        <div class="consent-gate-body">
          <h2>Policies required before generating</h2>
          <p>
            Read and accept ${missingCount > 0 ? `the ${missingCount} remaining` : "all required"}
            policies on Guidelines. Generation stays disabled here until that is done — the API will also reject requests without those consents.
          </p>
        </div>
        <div class="consent-gate-actions">
          <a class="btn-secondary" href="#/app/guidelines?required=1">Go to Guidelines</a>
        </div>
      </aside>
    `;

  const content = `
    <section class="card generate-studio ${consentReady ? "" : "is-consent-locked"}">
      ${gateNotice}
      <form class="form generate-form" data-form="generate">
        <fieldset ${consentReady ? "" : "disabled"}>
          <div class="field-block">
            <label class="label" for="provider">Provider</label>
            <p class="field-hint">Choose which model service will create the image.</p>
            <select id="provider" name="provider">
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="stability">Stability AI</option>
              <option value="huggingface">HuggingFace</option>
              <option value="replicate">Replicate</option>
              <option value="bedrock">AWS Bedrock (Titan)</option>
              <option value="azure">Azure OpenAI</option>
            </select>
          </div>

          <div class="field-block">
            <label class="label" for="prompt">Prompt</label>
            <p class="field-hint">Be specific about subject, lighting, style, and mood.</p>
            <textarea id="prompt" name="prompt" placeholder="A cinematic view of mountains at dawn, soft golden light, wide angle" required minlength="3"></textarea>
          </div>

          <div class="attest-block">
            <p class="label">Before you generate</p>
            <label class="check">
              <input type="checkbox" name="attested_ethical_use" required />
              <span>This prompt complies with the acceptable-use policy.</span>
            </label>
            <label class="check">
              <input type="checkbox" name="attested_no_real_person_misuse" required />
              <span>This is not a non-consensual depiction of a real person.</span>
            </label>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-generate">Generate image</button>
          </div>
        </fieldset>
      </form>
      <div id="loading" class="loading hidden"><span class="spinner"></span> Generating your image...</div>
      <p id="error" class="error hidden" role="alert"></p>
      <div id="image-container" class="image-container hidden">
        <img id="generated-image" alt="Generated AI artwork" />
        <p id="provider-used" class="provider-used"></p>
        <div id="feedback-slot"></div>
      </div>
    </section>
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Generate",
      subtitle: consentReady
        ? "Describe a scene. Prompts are screened before any provider is called."
        : "Accept required policies on Guidelines before you can generate.",
      content,
    }),
    bind(root) {
      bindShell(root);
      const form = root.querySelector("[data-form='generate']");
      if (!consentReady || !form) return;

      const loadingEl = root.querySelector("#loading");
      const errorEl = root.querySelector("#error");
      const imageContainer = root.querySelector("#image-container");
      const generatedImage = root.querySelector("#generated-image");
      const providerUsedEl = root.querySelector("#provider-used");
      const feedbackSlot = root.querySelector("#feedback-slot");
      const button = form.querySelector("button[type='submit']");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorEl.classList.add("hidden");
        imageContainer.classList.add("hidden");
        if (feedbackSlot) feedbackSlot.innerHTML = "";
        button.disabled = true;
        loadingEl.classList.remove("hidden");
        try {
          const data = await api("/generate", {
            method: "POST",
            body: {
              prompt: form.prompt.value.trim(),
              provider: form.provider.value,
              attested_ethical_use: form.attested_ethical_use.checked,
              attested_no_real_person_misuse: form.attested_no_real_person_misuse.checked,
            },
          });
          generatedImage.src = imageSrc(data.image_base64);
          providerUsedEl.textContent = [
            `Provider used: ${data.provider}`,
            data.model ? `Model: ${data.model}` : null,
            data.duration_ms != null ? `Latency: ${(data.duration_ms / 1000).toFixed(1)}s` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          imageContainer.classList.remove("hidden");
          if (feedbackSlot && data.generation_id) {
            feedbackSlot.innerHTML = feedbackPanelHtml(data.generation_id);
            bindFeedbackPanels(feedbackSlot, api);
          }
        } catch (error) {
          if (error.code === "CONSENT_REQUIRED") {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
            return;
          }
          errorEl.textContent = error.message;
          errorEl.classList.remove("hidden");
        } finally {
          button.disabled = false;
          loadingEl.classList.add("hidden");
        }
      });
    },
  };
}

export async function renderGallery({ user, path, query }) {
  const page = Number(query.get("page") || 1);
  let data = { items: [], total: 0, limit: 8, page };
  let error = "";
  try {
    data = await api(`/me/generations?page=${page}&limit=8`);
  } catch (err) {
    error = err.message;
  }

  const cards = (data.items || [])
    .map((item) => {
      const src = item.hasImage ? imageSrc(item.image_base64) : "";
      return `
        <article class="gallery-card">
          ${src ? `<img src="${src}" alt="" />` : `<div class="gallery-missing">No image stored</div>`}
          <div class="gallery-meta">
            <p>${escapeHtml(item.promptText)}</p>
            <div class="row-gap">
              <span class="${badgeClass(item.safetyStatus)}">${escapeHtml(item.safetyStatus)}</span>
              <span class="muted">${escapeHtml(item.provider)} · ${formatDate(item.createdAt)}</span>
            </div>
            ${feedbackPanelHtml(item.id, item.feedback, { compact: true })}
          </div>
        </article>
      `;
    })
    .join("");

  const content = `
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
    ${
      data.items?.length
        ? `<div class="gallery-grid">${cards}</div>${pager(data.page, data.total, data.limit, "#/app/gallery?page=")}`
        : emptyState("No generations yet", "Your images will appear here after you create one.")
    }
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "My gallery",
      subtitle: `${data.total || 0} saved generation${data.total === 1 ? "" : "s"}`,
      content,
    }),
    bind(root) {
      bindShell(root);
      bindFeedbackPanels(root, api);
    },
  };
}

export async function renderGuidelines({ user, path, query }) {
  const requiredGate = query?.get("required") === "1";
  let consentStatus = {
    complete: false,
    required: [],
    missing: [],
    items: [],
  };
  try {
    consentStatus = await api("/me/consents");
  } catch {
    // keep defaults
  }

  const policies = consentStatus.required?.length
    ? consentStatus.required
    : (await api("/policies").catch(() => ({ items: [] }))).items || [];
  const missingIds = new Set((consentStatus.missing || []).map((item) => item.id));
  const acceptedIds = new Set(
    (consentStatus.items || []).map((item) => item.policy?.id).filter(Boolean)
  );
  const complete = isConsentComplete(consentStatus);

  const cards = policies
    .map((policy) => {
      const accepted =
        acceptedIds.has(policy.id) &&
        (missingIds.size === 0 || !missingIds.has(policy.id));
      return `
        <article class="policy-card">
          <div class="row-between">
            <h3>${escapeHtml(policy.kind.replaceAll("_", " "))}</h3>
            <span class="${badgeClass(accepted ? "active" : "open")}">${
              accepted ? "Accepted" : "Required"
            }</span>
          </div>
          <p>${escapeHtml(policy.summary)}</p>
          <p class="muted">Version ${escapeHtml(policy.version)} · ${formatDate(policy.effectiveAt)}</p>
          ${
            accepted
              ? ""
              : `<button class="btn-secondary" type="button" data-accept="${policy.id}">Accept this policy</button>`
          }
        </article>
      `;
    })
    .join("");

  const gateBanner = complete
    ? `<section class="card prose">
        <h2>You are cleared to generate</h2>
        <p>All required policies are accepted. Generation still requires per-prompt attestations and passes the safety filter.</p>
        <p><a class="btn-secondary" href="#/app/generate">Continue to Generate</a></p>
      </section>`
    : `<section class="card prose">
        <h2>${requiredGate ? "Policy acceptance required" : "Accept policies to unlock Generate"}</h2>
        <p>Before any image can be created, read and accept each policy below (Age gate, Acceptable use, Privacy, and Terms). Accept them one at a time. The API rejects generation until every record exists.</p>
      </section>`;

  const content = `
    ${gateBanner}
    <section class="card prose">
      <h2>What you can generate</h2>
      <p>Use this studio for original, fictional, or licensed-subject artwork. Prompts are screened before they reach a provider.</p>
      <ul>
        <li>No sexual content involving minors, even fictional.</li>
        <li>No non-consensual intimate imagery or real-person deepfakes.</li>
        <li>No hate, harassment, or violent extremist content.</li>
        <li>You are responsible for how you share generated images.</li>
      </ul>
    </section>
    <div class="stack">${cards || emptyState("Policies unavailable", "Policy documents will appear here after seeding.")}</div>
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Guidelines",
      subtitle: complete
        ? "All required policies accepted."
        : "Acceptable use, age gate, privacy, and terms — required before Generate.",
      content,
    }),
    bind(root) {
      bindShell(root);

      async function acceptPolicy(policyId, button) {
        if (button) button.disabled = true;
        try {
          await api("/me/consents", {
            method: "POST",
            body: { policy_document_id: policyId },
          });
          return true;
        } catch (error) {
          if (button) {
            button.disabled = false;
            button.textContent = error.message;
          }
          return false;
        }
      }

      root.querySelectorAll("[data-accept]").forEach((button) => {
        button.addEventListener("click", async () => {
          const ok = await acceptPolicy(button.dataset.accept, button);
          if (ok) window.dispatchEvent(new HashChangeEvent("hashchange"));
        });
      });
    },
  };
}

export async function renderAccount({ user, path }) {
  const content = `
    <section class="card">
      <div class="row-gap">
        <span class="${badgeClass(user.role)}">${escapeHtml(user.role)}</span>
        <span class="${badgeClass(user.status)}">${escapeHtml(user.status)}</span>
      </div>
      <form class="form" data-form="profile">
        <label class="label" for="display_name">Display name</label>
        <input id="display_name" name="display_name" value="${escapeHtml(user.displayName || "")}" required />
        <label class="label">Email</label>
        <input value="${escapeHtml(user.email)}" disabled />
        <p class="muted">Member since ${formatDate(user.createdAt)} · Last sign-in ${formatDate(user.lastLoginAt)}</p>
        <button type="submit">Save profile</button>
      </form>
      <p id="profile-status" class="hint hidden"></p>
    </section>
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Account",
      subtitle: "Your profile and account status.",
      content,
    }),
    bind(root) {
      bindShell(root);
      const form = root.querySelector("[data-form='profile']");
      const status = root.querySelector("#profile-status");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        form.querySelector("button").disabled = true;
        try {
          const data = await api("/me", {
            method: "PATCH",
            body: { display_name: form.display_name.value },
          });
          status.textContent = "Profile saved.";
          status.classList.remove("hidden");
          if (data.user) {
            localStorage.setItem("aigen.user", JSON.stringify(data.user));
          }
        } catch (error) {
          status.textContent = error.message;
          status.classList.remove("hidden");
        } finally {
          form.querySelector("button").disabled = false;
        }
      });
    },
  };
}
