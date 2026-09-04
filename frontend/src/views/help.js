import { isStaff } from "../auth.js";
import { bindShell, renderShell } from "../layout.js";

function section(id, title, body) {
  return `
    <section class="help-section card prose" id="${id}">
      <h2>${title}</h2>
      ${body}
    </section>
  `;
}

export function renderHelp({ user, path }) {
  const staff = isStaff(user);

  const toc = `
    <nav class="help-toc card" aria-label="Help contents">
      <p class="help-toc-title">On this page</p>
      <ol>
        <li><button type="button" class="help-jump" data-help-jump="help-overview">What this app is</button></li>
        <li><button type="button" class="help-jump" data-help-jump="help-flow">How a generation works</button></li>
        <li><button type="button" class="help-jump" data-help-jump="help-safety">Safety layers</button></li>
        <li><button type="button" class="help-jump" data-help-jump="help-studio">Studio pages</button></li>
        <li><button type="button" class="help-jump" data-help-jump="help-providers">Image providers</button></li>
        <li><button type="button" class="help-jump" data-help-jump="help-feedback">Feedback &amp; gallery</button></li>
        ${staff ? `<li><button type="button" class="help-jump" data-help-jump="help-admin">Admin console</button></li>` : ""}
        <li><button type="button" class="help-jump" data-help-jump="help-api">API &amp; stack</button></li>
        <li><button type="button" class="help-jump" data-help-jump="help-troubleshoot">Troubleshooting</button></li>
      </ol>
    </nav>
  `;

  const content = `
    <div class="help-layout">
      ${toc}
      <div class="help-main stack">
        ${section(
          "help-overview",
          "What this app is",
          `
          <p>
            <strong>AI Image Gen</strong> turns a text prompt into an image. A Vite frontend talks to a FastAPI backend,
            which checks your account and policies, screens the prompt, calls the provider you pick, and stores the result
            in PostgreSQL (via Prisma) for your gallery and staff review.
          </p>
          <p>
            It is built as a small <em>safety platform</em> demo: consent, attestations, and filtering are enforced on the
            server. Browser-only checks are helpers, not security boundaries.
          </p>
          `
        )}

        ${section(
          "help-flow",
          "How a generation works",
          `
          <ol class="help-steps">
            <li>Sign in as a user (<a href="#/login">#/login</a>) or admin (<a href="#/admin/login">#/admin/login</a>).</li>
            <li>Accept Age gate, Acceptable use, Privacy, and Terms on <a href="#/app/guidelines">Guidelines</a>.</li>
            <li>On <a href="#/app/generate">Generate</a>, write a prompt, choose a provider, and tick both ethical attestations.</li>
            <li>The API re-checks auth, account status, consents, and attestations, then runs the prompt safety filter.</li>
            <li>If allowed, the selected provider returns a ~1024×1024 image as base64. A <code>PromptLog</code> row is saved.</li>
            <li>The image appears in the studio and in <a href="#/app/gallery">My gallery</a>. You can leave optional feedback.</li>
          </ol>
          `
        )}

        ${section(
          "help-safety",
          "Safety layers (defense in depth)",
          `
          <div class="help-table-wrap">
            <table class="help-table">
              <thead>
                <tr><th>Layer</th><th>If it fails</th></tr>
              </thead>
              <tbody>
                <tr><td>Sign-in (bearer session)</td><td><code>401 UNAUTHORIZED</code></td></tr>
                <tr><td>Active adult account</td><td><code>403 ACCOUNT_RESTRICTED</code></td></tr>
                <tr><td>Latest required policies accepted</td><td><code>403 CONSENT_REQUIRED</code> — Generate stays disabled until Guidelines are done</td></tr>
                <tr><td>Per-prompt attestations</td><td><code>400 ATTESTATION_REQUIRED</code></td></tr>
                <tr><td>Prompt safety filter</td><td><code>400 PROMPT_BLOCKED</code> — blocked text never reaches a provider</td></tr>
                <tr><td>Provider / vendor policies</td><td>Upstream <code>4xx</code> / <code>502</code> (quota, billing, content)</td></tr>
                <tr><td>Human review (staff)</td><td>Warn / suspend / ban; remove abusive images</td></tr>
              </tbody>
            </table>
          </div>
          <p class="muted">
            These controls reduce risk; they do not catch every unsafe request. Provider filters are an extra layer, not the primary control.
          </p>
          `
        )}

        ${section(
          "help-studio",
          "Studio pages",
          `
          <ul>
            <li><a href="#/app/guidelines"><strong>Guidelines</strong></a> — accept each required policy one-by-one (no bulk accept). Required before Generate.</li>
            <li><a href="#/app/generate"><strong>Generate</strong></a> — prompt, provider, attestations. Form is disabled until consents are complete.</li>
            <li><a href="#/app/gallery"><strong>Gallery</strong></a> — your saved generations; click an image for a full-size lightbox with prev/next.</li>
            <li><a href="#/app/account"><strong>Account</strong></a> — profile summary for the signed-in user.</li>
            <li><a href="#/app/help"><strong>Help</strong></a> — this documentation page.</li>
          </ul>
          `
        )}

        ${section(
          "help-providers",
          "Image providers",
          `
          <p>
            Pick a provider per request in the Generate form. You need a working API key for that provider in the backend
            <code>.env</code>. Follow the links below to read vendor docs or create keys.
          </p>
          <ul class="help-provider-list">
            <li>
              <strong>OpenAI</strong>
              <p>
                Generates images via OpenAI’s Images API (default model from <code>OPENAI_IMAGE_MODEL</code>, e.g.
                <code>gpt-image-2</code>). Strong prompt following; requires a billed OpenAI account with image access.
              </p>
              <p class="help-provider-meta"><code>OPENAI_API_KEY</code></p>
              <p class="help-provider-links">
                <a href="https://platform.openai.com/docs/guides/images" target="_blank" rel="noopener noreferrer">Image generation docs</a>
                ·
                <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer">API keys</a>
              </p>
            </li>
            <li>
              <strong>Stability AI</strong>
              <p>
                Calls Stable Image Core over Stability’s REST API (multipart form). Good for Stable Diffusion–style
                outputs; no separate model ID is required in this app beyond the Core endpoint.
              </p>
              <p class="help-provider-meta"><code>STABILITY_API_KEY</code></p>
              <p class="help-provider-links">
                <a href="https://platform.stability.ai/" target="_blank" rel="noopener noreferrer">Stability platform</a>
                ·
                <a href="https://platform.stability.ai/docs/api-reference" target="_blank" rel="noopener noreferrer">API reference</a>
                ·
                <a href="https://platform.stability.ai/account/keys" target="_blank" rel="noopener noreferrer">API keys</a>
              </p>
            </li>
            <li>
              <strong>Hugging Face</strong>
              <p>
                Routes through Hugging Face <em>Inference Providers</em> (not the old serverless
                <code>hf-inference</code> host, which no longer serves FLUX/SDXL). Default model
                <code>black-forest-labs/FLUX.1-schnell</code> typically runs via <code>fal-ai</code>.
                Your token needs Inference Providers permission; enable partners under
                HF settings if needed.
              </p>
              <p class="help-provider-meta">
                <code>HUGGINGFACE_API_KEY</code> · optional <code>HUGGINGFACE_INFERENCE_PROVIDER</code> (<code>auto</code> / <code>fal-ai</code> / …)
              </p>
              <p class="help-provider-links">
                <a href="https://huggingface.co/docs/inference-providers/index" target="_blank" rel="noopener noreferrer">Inference Providers docs</a>
                ·
                <a href="https://huggingface.co/docs/inference-providers/tasks/text-to-image" target="_blank" rel="noopener noreferrer">Text-to-image task</a>
                ·
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer">Access tokens</a>
                ·
                <a href="https://huggingface.co/settings/inference-providers" target="_blank" rel="noopener noreferrer">Provider settings</a>
              </p>
            </li>
          </ul>
          <p class="muted">
            Default provider is <code>IMAGE_PROVIDER</code> when the request omits <code>provider</code>. Never commit real keys.
          </p>
          `
        )}

        ${section(
          "help-feedback",
          "Feedback &amp; gallery",
          `
          <p>After a successful generate (and again in Gallery), you can rate a result:</p>
          <ul>
            <li><strong>Verdict</strong> — thumbs up / down</li>
            <li><strong>Tags</strong> — e.g. accurate, creative, low quality, felt unsafe, slow, provider issue</li>
            <li><strong>Remark</strong> — optional short note</li>
          </ul>
          <p>
            Feedback is for evaluation, not abuse reporting. For policy violations use staff tools
            ${staff ? `(<a href="#/admin/reports">Reports</a>)` : "(ask an admin)"}.
          </p>
          `
        )}

        ${
          staff
            ? section(
                "help-admin",
                "Admin console",
                `
                <ul>
                  <li><a href="#/admin"><strong>Overview</strong></a> — counts plus analytics charts (provider usage, satisfaction, latency, safety, daily volume).</li>
                  <li><a href="#/admin/users"><strong>Users</strong></a> — search accounts; warn / suspend / ban.</li>
                  <li><a href="#/admin/generations"><strong>Generations</strong></a> — inspect prompts, safety status, user feedback; <em>Details</em> shows the full record; remove abusive images when needed.</li>
                  <li><a href="#/admin/reports"><strong>Reports</strong></a> — triage user reports.</li>
                  <li><a href="#/admin/events"><strong>Auth events</strong></a> — login / session audit trail.</li>
                </ul>
                `
              )
            : ""
        }

        ${section(
          "help-api",
          "API &amp; stack",
          `
          <p>Useful endpoints (OpenAPI at <a href="http://localhost:8000/docs" target="_blank" rel="noopener">/docs</a> when running locally):</p>
          <ul>
            <li><code>GET /health</code> — liveness</li>
            <li><code>POST /auth/login</code> · <code>GET /auth/me</code> · <code>POST /auth/logout</code></li>
            <li><code>GET /me/consents</code> · <code>POST /me/consents</code></li>
            <li><code>POST /generate</code> — auth + consents + attestations + safety filter</li>
            <li><code>GET /me/generations</code> · <code>PUT /me/generations/{id}/feedback</code></li>
            ${staff ? `<li><code>GET /admin/stats</code> · <code>GET /admin/analytics</code></li>` : ""}
          </ul>
          <p>
            Stack: <strong>FastAPI</strong> + <strong>Prisma</strong> / <strong>PostgreSQL</strong> backend,
            <strong>Vite</strong> vanilla JS frontend, optional <strong>Docker Compose</strong> for local orchestration.
          </p>
          `
        )}

        ${section(
          "help-troubleshoot",
          "Troubleshooting",
          `
          <div class="help-table-wrap">
            <table class="help-table">
              <thead>
                <tr><th>Symptom</th><th>What to check</th></tr>
              </thead>
              <tbody>
                <tr><td>Generate form disabled / <code>CONSENT_REQUIRED</code></td><td>Accept each policy on Guidelines, then return here.</td></tr>
                <tr><td><code>PROMPT_BLOCKED</code></td><td>Safety filter rejected the prompt before any provider call.</td></tr>
                <tr><td>Provider <code>4xx</code> / <code>502</code></td><td>API key, billing, quota, and model access for that vendor.</td></tr>
                <tr><td><code>*_API_KEY is not configured</code></td><td><code>backend/.env</code> has the matching key; restart / rebuild the API.</td></tr>
                <tr><td>UI changes missing in Docker</td><td>Compose has no bind mounts — rebuild: <code>docker compose up --build</code>.</td></tr>
                <tr><td>CORS / failed fetch</td><td><code>CORS_ORIGINS</code> includes your frontend origin (or <code>*</code> for local).</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            Seed accounts (local/dev): after <code>python prisma/seed.py</code>, use
            <code>ada@ai-image-gen.local</code> / <code>User123!</code> (user) or
            <code>admin@ai-image-gen.local</code> / <code>Admin123!</code> (admin). Seed users still must accept Guidelines.
          </p>
          `
        )}
      </div>
    </div>
  `;

  return {
    html: renderShell({
      user,
      path,
      title: "Help",
      subtitle: "How the studio, safety gates, providers, and admin tools fit together.",
      content,
    }),
    bind(root) {
      bindShell(root);
      root.querySelectorAll("[data-help-jump]").forEach((button) => {
        button.addEventListener("click", () => {
          const target = root.querySelector(`#${button.dataset.helpJump}`);
          target?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    },
  };
}
