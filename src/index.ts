/** Typing Course — Latihan mengetik + leaderboard real-time (Bun + Hono + PostgreSQL). */
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { websocket } from "hono/bun";
import { logger } from "hono/logger";
import { config } from "./config";
import { sessionMiddleware, type AppVariables } from "./middleware/session";
import { initDb } from "./db/init";
import { homeRoutes } from "./routes/home";
import { authRoutes } from "./routes/auth";
import { sessionsRoutes } from "./routes/sessions";
import { practiceRoutes, practiceApi, practiceWs } from "./routes/practice";
import { quickRoutes, quickApi } from "./routes/quick";

await initDb();

const app = new Hono<{ Variables: AppVariables }>();

// Security headers (best practice minimal)
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-XSS-Protection": "0",
};
app.use("*", async (c, next) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    c.header(k, v);
  }
  await next();
});

app.use("*", logger());
app.use("*", sessionMiddleware);

// Static assets
app.use("/css/*", serveStatic({ root: "./src/public" }));
app.use("/js/*", serveStatic({ root: "./src/public" }));
app.use("/img/*", serveStatic({ root: "./src/public" }));

// Routes
app.route("/", homeRoutes);
app.route("/", authRoutes);
app.route("/", sessionsRoutes);
app.route("/", quickRoutes);
app.route("/", quickApi);
app.route("/", practiceRoutes);
app.route("/", practiceApi);
app.route("/", practiceWs);

// 404
app.notFound((c) =>
  c.html(
    `<h1 style="text-align:center;padding-top:4rem">404 — Halaman tidak ditemukan.</h1>`,
    404,
  ),
);

// Error handler
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json({ error: "Terjadi kesalahan server." }, 500);
});

console.log(`🚀 ${config.appName} jalan di ${config.appUrl}`);

export default {
  port: config.port,
  fetch: app.fetch,
  websocket,
};
