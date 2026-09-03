import { api, badgeClass, formatDate, imageSrc } from "../api.js";
import { bindShell, emptyState, pager, renderShell } from "../layout.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function renderGenerate({ user, path }) {
  const content = `
    <section class="card">
      <form class="form" data-form="generate">
        <label class="label" for="provider">Provider</label>
        <select id="provider" name="provider">
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
          <option value="stability">Stability AI</option>
          <option value="huggingface">HuggingFace</option>
          <option value="replicate">Replicate</option>
        </select>
        <label class="label" for="prompt">Prompt</label>
        <textarea id="prompt" name="prompt" placeholder="A futuristic city at sunset with flying cars" required minlength="3"></textarea>
        <label class="check">
          <input type="checkbox" name="attested_ethical_use" required />
          This prompt complies with the acceptable-use policy.
        </label>
        <label class="check">
          <input type="checkbox" name="attested_no_real_person_misuse" required />
          This is not a non-consensual depiction of a real person.
        </label>
        <button type="submit">Generate image</button>
      </form>
      <div id="loading" class="loading hidden"><span class="spinner"></span> Generating your image...</div>
      <p id="error" class="error hidden" role="alert"></p>
      <div id="image-container" class="image-container hidden">
        <img id="generated-image" alt="Generated AI artwork" />
        <p id="provider-used" class="provider-used"></p>
      </div>
    </section>
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Generate",
      subtitle: "Describe a scene. Prompts are screened before any provider is called.",
      content,
    }),
    bind(root) {
      bindShell(root);
      const form = root.querySelector("[data-form='generate']");
      const loadingEl = root.querySelector("#loading");
      const errorEl = root.querySelector("#error");
      const imageContainer = root.querySelector("#image-container");
      const generatedImage = root.querySelector("#generated-image");
      const providerUsedEl = root.querySelector("#provider-used");
      const button = form.querySelector("button");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorEl.classList.add("hidden");
        imageContainer.classList.add("hidden");
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
          providerUsedEl.textContent = `Provider used: ${data.provider}`;
          imageContainer.classList.remove("hidden");
        } catch (error) {
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
    bind: bindShell,
  };
}

export async function renderGuidelines({ user, path }) {
  let policies = [];
  try {
    const data = await api("/policies");
    policies = data.items || [];
  } catch {
    policies = [];
  }

  let consents = [];
  try {
    const data = await api("/me/consents");
    consents = data.items || [];
  } catch {
    consents = [];
  }

  const acceptedIds = new Set(consents.map((item) => item.policy?.id).filter(Boolean));
  const cards = policies
    .map(
      (policy) => `
        <article class="policy-card">
          <div class="row-between">
            <h3>${escapeHtml(policy.kind.replaceAll("_", " "))}</h3>
            <span class="${badgeClass(acceptedIds.has(policy.id) ? "active" : "open")}">${
              acceptedIds.has(policy.id) ? "Accepted" : "Pending"
            }</span>
          </div>
          <p>${escapeHtml(policy.summary)}</p>
          <p class="muted">Version ${escapeHtml(policy.version)} · ${formatDate(policy.effectiveAt)}</p>
          ${
            acceptedIds.has(policy.id)
              ? ""
              : `<button class="btn-secondary" type="button" data-accept="${policy.id}">Accept this policy</button>`
          }
        </article>
      `
    )
    .join("");

  const content = `
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
      subtitle: "Acceptable use, age gate, privacy, and terms.",
      content,
    }),
    bind(root) {
      bindShell(root);
      root.querySelectorAll("[data-accept]").forEach((button) => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await api("/me/consents", {
              method: "POST",
              body: { policy_document_id: button.dataset.accept },
            });
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          } catch (error) {
            button.disabled = false;
            button.textContent = error.message;
          }
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
