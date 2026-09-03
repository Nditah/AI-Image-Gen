import { login, logout, register } from "../api.js";
import { isStaff } from "../auth.js";

function escapeAttr(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function authFrame({ title, subtitle, form, footer, demo, error = "", staff = false }) {
  return `
    <main class="auth-screen ${staff ? "is-staff" : ""}">
      <section class="card auth-card">
        <p class="eyebrow">${staff ? "Staff access" : "AI Image Generator"}</p>
        <h1>${title}</h1>
        <p class="subtitle">${subtitle}</p>
        ${error ? `<p class="error" role="alert">${error}</p>` : ""}
        ${form}
        ${demo}
        <p class="auth-footer">${footer}</p>
      </section>
    </main>
  `;
}

function loginForm(email = "") {
  return `
    <form class="form" data-form="login">
      <label class="label" for="email">Email</label>
      <input id="email" name="email" type="email" value="${escapeAttr(email)}" autocomplete="username" required />
      <label class="label" for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit">Continue</button>
    </form>
  `;
}

export function renderLogin() {
  const paint = (error = "", email = "") =>
    authFrame({
      title: "Sign in",
      subtitle: "Generate images, review your gallery, and manage your account.",
      form: loginForm(email),
      demo: `<p class="hint">Demo user: <code>ada@ai-image-gen.local</code> / <code>User123!</code></p>`,
      footer: `No account yet? <a href="#/register">Create one</a> · <a href="#/admin/login">Admin console</a>`,
      error,
    });

  return {
    html: paint(),
    bind(root) {
      root.querySelector("[data-form='login']")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        form.querySelector("button").disabled = true;
        try {
          const user = await login(form.email.value, form.password.value);
          window.location.hash = isStaff(user) ? "#/admin" : "#/app/generate";
        } catch (error) {
          root.innerHTML = paint(error.message, form.email.value);
          renderLogin().bind(root);
        }
      });
    },
  };
}

export function renderAdminLogin() {
  const paint = (error = "", email = "") =>
    authFrame({
      staff: true,
      title: "Admin console",
      subtitle: "Sign in with a staff account to manage users, generations, and reports.",
      form: `
        <form class="form" data-form="admin-login">
          <label class="label" for="email">Admin email</label>
          <input id="email" name="email" type="email" value="${escapeAttr(email)}" required />
          <label class="label" for="password">Password</label>
          <input id="password" name="password" type="password" required />
          <button type="submit">Enter console</button>
        </form>
      `,
      demo: `<p class="hint">Demo admin: <code>admin@ai-image-gen.local</code> / <code>Admin123!</code></p>`,
      footer: `<a href="#/login">Back to user sign in</a>`,
      error,
    });

  return {
    html: paint(),
    bind(root) {
      root.querySelector("[data-form='admin-login']")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        form.querySelector("button").disabled = true;
        try {
          const user = await login(form.email.value, form.password.value);
          if (!isStaff(user)) {
            await logout();
            throw new Error("This console is limited to administrators and moderators.");
          }
          window.location.hash = "#/admin";
        } catch (error) {
          root.innerHTML = paint(error.message, form.email.value);
          renderAdminLogin().bind(root);
        }
      });
    },
  };
}

export function renderRegister() {
  const paint = (error = "", values = {}) =>
    authFrame({
      title: "Create an account",
      subtitle: "You must be 18 or older. Seeded demo accounts already exist if you just want to try the app.",
      form: `
        <form class="form" data-form="register">
          <label class="label" for="display_name">Display name</label>
          <input id="display_name" name="display_name" value="${escapeAttr(values.display_name)}" required minlength="2" />
          <label class="label" for="email">Email</label>
          <input id="email" name="email" type="email" value="${escapeAttr(values.email)}" required />
          <label class="label" for="password">Password</label>
          <input id="password" name="password" type="password" minlength="8" required />
          <label class="check">
            <input type="checkbox" name="is_adult" required />
            I confirm I am 18 or older.
          </label>
          <button type="submit">Create account</button>
        </form>
      `,
      demo: `<p class="hint">Demo user: <code>ada@ai-image-gen.local</code> / <code>User123!</code></p>`,
      footer: `Already registered? <a href="#/login">Sign in</a>`,
      error,
    });

  return {
    html: paint(),
    bind(root) {
      root.querySelector("[data-form='register']")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        form.querySelector("button").disabled = true;
        try {
          await register({
            email: form.email.value,
            password: form.password.value,
            display_name: form.display_name.value,
            is_adult: form.is_adult.checked,
          });
          window.location.hash = "#/app/generate";
        } catch (error) {
          root.innerHTML = paint(error.message, {
            display_name: form.display_name.value,
            email: form.email.value,
          });
          renderRegister().bind(root);
        }
      });
    },
  };
}
