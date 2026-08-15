/** Route autentikasi: register, login, logout. */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { type AppVariables } from "../middleware/session";
import {
  createSession,
  destroySession,
  setFlash,
} from "../middleware/session";
import { one } from "../db/client";
import { hashPassword, verifyPassword } from "../lib/password";
import { renderPage, csrfInput } from "../views/helpers";

export const authRoutes = new Hono<{ Variables: AppVariables }>();

function formInput(props: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const { label, name, type = "text", placeholder, value, required = true, autoComplete } = props;
  return (
    <div>
      <label for={name} class="block text-sm font-medium mb-1.5">
        {label}
      </label>
      <input
        type={type}
        name={name}
        id={name}
        value={value}
        placeholder={placeholder}
        required={required}
        autocomplete={autoComplete}
        class="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm focus:border-accent"
      />
    </div>
  );
}

function AuthCard(props: {
  title: string;
  subtitle: string;
  action: string;
  submitLabel: string;
  children: any;
  flash: Record<string, string>;
}) {
  const { title, subtitle, action, submitLabel, children, flash } = props;
  return (
    <section class="max-w-md mx-auto py-10">
      <div class="bg-surface rounded-2xl border border-line shadow-card p-8">
        <h1 class="text-2xl font-bold text-center">{title}</h1>
        <p class="text-sm text-ink-soft text-center mt-2 mb-8">{subtitle}</p>
        {flash.error && (
          <div class="mb-5 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
            {flash.error}
          </div>
        )}
        {flash.success && (
          <div class="mb-5 px-4 py-3 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            {flash.success}
          </div>
        )}
        <form method="post" action={action} class="space-y-5">
          {children}
          <button
            type="submit"
            class="w-full rounded-xl bg-ink text-white font-semibold py-3 hover:bg-ink/90 transition-colors"
          >
            {submitLabel}
          </button>
        </form>
      </div>
    </section>
  );
}

authRoutes.get("/register", (c) => {
  return renderPage(
    c,
    { title: "Daftar Akun" },
    <AuthCard
      title="Buat Akun"
      subtitle="Buat dan kelola sesi latihan mengetikmu."
      action="/register"
      submitLabel="Daftar"
      flash={c.get("flash") ?? {}}
    >
      {formInput({ label: "Nama", name: "name", placeholder: "Nama kamu", autoComplete: "name" })}
      {formInput({
        label: "Email",
        name: "email",
        type: "email",
        placeholder: "kamu@email.com",
        autoComplete: "email",
      })}
      {formInput({
        label: "Password",
        name: "password",
        type: "password",
        placeholder: "Minimal 6 karakter",
        autoComplete: "new-password",
      })}
      <p class="text-center text-sm text-ink-soft">
        Sudah punya akun?{" "}
        <a href="/login" class="text-accent font-medium hover:underline">
          Masuk di sini
        </a>
      </p>
    </AuthCard>
  );
});

authRoutes.post("/register", async (c) => {
  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!name || !email || password.length < 6) {
    setFlash(c, { error: "Lengkapi semua data. Password minimal 6 karakter." });
    return c.redirect("/register");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFlash(c, { error: "Format email tidak valid." });
    return c.redirect("/register");
  }

  const existing = await one(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing) {
    setFlash(c, { error: "Email sudah terdaftar. Silakan login." });
    return c.redirect("/register");
  }

  const hash = await hashPassword(password);
  const user = await one<{ id: number }>(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    [name, email, hash]
  );
  await createSession(c, user!.id);
  setFlash(c, { success: `Selamat datang, ${name}!` });
  return c.redirect("/sesi");
});

authRoutes.get("/login", (c) => {
  return renderPage(
    c,
    { title: "Masuk" },
    <AuthCard
      title="Masuk"
      subtitle="Masuk untuk mengelola sesi latihanmu."
      action="/login"
      submitLabel="Masuk"
      flash={c.get("flash") ?? {}}
    >
      {formInput({
        label: "Email",
        name: "email",
        type: "email",
        placeholder: "kamu@email.com",
        autoComplete: "email",
      })}
      {formInput({
        label: "Password",
        name: "password",
        type: "password",
        placeholder: "Password kamu",
        autoComplete: "current-password",
      })}
      <input type="hidden" name="next" value="" />
      <p class="text-center text-sm text-ink-soft">
        Belum punya akun?{" "}
        <a href="/register" class="text-accent font-medium hover:underline">
          Daftar gratis
        </a>
      </p>
    </AuthCard>
  );
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const next = String(body.next ?? "").trim();

  const row = await one<{ id: number; name: string; password_hash: string }>(
    `SELECT id, name, password_hash FROM users WHERE email = ?`,
    [email]
  );
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    setFlash(c, { error: "Email atau password salah." });
    return c.redirect("/login");
  }

  await createSession(c, row.id);
  setFlash(c, { success: `Halo lagi, ${row.name}!` });
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/sesi";
  return c.redirect(dest);
});

authRoutes.get("/logout", async (c) => {
  await destroySession(c, c.get("sessionId"));
  setFlash(c, { success: "Kamu sudah keluar." });
  return c.redirect("/");
});
