/** Konfigurasi aplikasi dari environment variables. */
export const config = {
  appName: process.env.APP_NAME ?? "Typing Course",
  appUrl: process.env.APP_URL ?? "http://localhost:3200",
  port: Number(process.env.APP_PORT ?? 3200),
  env: process.env.APP_ENV ?? "development",
  secret: process.env.SECRET_KEY ?? "dev-secret",
  cookieSecure: process.env.COOKIE_SECURE === "true",

  database: {
    url:
      process.env.DATABASE_URL ??
      "postgres://olshop:olshop_pass_2024@127.0.0.1:5432/typing_course",
    maxConnections: Number(process.env.DATABASE_MAX_CONNECTIONS ?? 10),
  },

  admin: {
    email: process.env.ADMIN_EMAIL ?? "admin@typing.test",
    password: process.env.ADMIN_PASSWORD ?? "Admin12345!",
  },
};
