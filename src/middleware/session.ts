/** Session untuk user (host) + cookie device_id untuk tamu anonim. */
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createHmac, createHash, randomBytes } from "node:crypto";
import { config } from "../config";
import { one, run } from "../db/client";
import type { Context } from "hono";

export type AppUser = {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
};

export type AppVariables = {
  user: AppUser | null;
  sessionId: string | null;
  csrfToken: string;
  flash: Record<string, string>;
  isGuest: boolean;
};

export const SESSION_COOKIE = "typing_session";
const FLASH_COOKIE = "typing_flash";
const CSRF_COOKIE = "typing_csrf";

export type AppContext = Context<{ Variables: AppVariables }>;

function sign(value: string): string {
  return createHmac("sha256", config.secret).update(value).digest("base64url");
}

function serializeSession(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

function constantTimeEq(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i]! ^ bufB[i]!;
  }
  return diff === 0;
}

function parseSession(raw: string | undefined): string | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return null;
  const id = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(id);
  return constantTimeEq(sig, expected) ? id : null;
}

async function loadUser(sessionId: string): Promise<AppUser | null> {
  const row = await one<{
    id: number;
    name: string;
    email: string;
    is_admin: number;
    expires_at: string;
  }>(
    `SELECT u.id, u.name, u.email, u.is_admin, s.expires_at
     FROM auth_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [sessionId]
  );
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: row.is_admin === 1,
  };
}

/** Middleware utama: resolve session user, device_id tamu, csrf, flash. */
export const sessionMiddleware = createMiddleware<{ Variables: AppVariables }>(
  async (c, next) => {
    const rawSession = getCookie(c, SESSION_COOKIE);
    const sessionId = parseSession(rawSession);

    let user: AppUser | null = null;
    if (sessionId) {
      user = await loadUser(sessionId);
    }

    // device_id dulu dipakai utk anti-spam, kini tamu bebas ikut tanpa batasan perangkat.
    // Tetap beri cookie ringan untuk mengingat nickname terakhir (optional).
    let deviceId = getCookie(c, "typing_device");
    if (!deviceId) {
      deviceId = `dev_${randomBytes(16).toString("hex")}`;
      setCookie(c, "typing_device", deviceId, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    let csrfToken = getCookie(c, CSRF_COOKIE);
    if (!csrfToken) {
      csrfToken = createHash("sha256")
        .update(String(sessionId ?? "anon"))
        .update(String(Math.random()))
        .update(String(Date.now()))
        .digest("hex")
        .slice(0, 32);
      setCookie(c, CSRF_COOKIE, csrfToken, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: "Lax",
        path: "/",
      });
    }

    let flash: Record<string, string> = {};
    const rawFlash = getCookie(c, FLASH_COOKIE);
    if (rawFlash) {
      try {
        flash = JSON.parse(decodeURIComponent(rawFlash));
      } catch {
        flash = {};
      }
      deleteCookie(c, FLASH_COOKIE, { path: "/" });
    }

    c.set("user", user);
    c.set("sessionId", sessionId);
    c.set("csrfToken", csrfToken);
    c.set("flash", flash);
    c.set("isGuest", !user);

    await next();
  }
);

/** Proteksi route: wajib login. */
export const requireAuth = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    setFlash(c, { error: "Silakan login terlebih dahulu." });
    return c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`);
  }
  await next();
});

/** Simpan flash message. */
export function setFlash(c: AppContext, data: Record<string, string>) {
  setCookie(c, FLASH_COOKIE, encodeURIComponent(JSON.stringify(data)), {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "Lax",
    path: "/",
    maxAge: 60,
  });
}

/** Buat session baru untuk user. */
export async function createSession(c: AppContext, userId: number): Promise<string> {
  const sessionId = createHash("sha256")
    .update(String(userId))
    .update(String(Math.random()))
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 32);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await run("INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [
    sessionId,
    userId,
    expiresAt,
  ]);
  setCookie(c, SESSION_COOKIE, serializeSession(sessionId), {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "Lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return sessionId;
}

/** Hapus session (logout). */
export async function destroySession(c: AppContext, sessionId: string | null) {
  if (sessionId) {
    await run("DELETE FROM auth_sessions WHERE id = $1", [sessionId]);
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
