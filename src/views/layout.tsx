// @ts-nocheck
import { html } from "hono/html";
import type { PropsWithChildren } from "hono/jsx";
import { config } from "../config";

type Meta = {
  title?: string;
  description?: string;
  noindex?: boolean;
};

type LayoutProps = PropsWithChildren<{
  meta?: Meta;
  user: { name: string; email: string; isAdmin: boolean } | null;
  isGuest: boolean;
  flash?: Record<string, string>;
  csrfToken?: string;
  bodyClass?: string;
}>;

/** Tampilkan flash message (jika ada). */
function Flash({ flash }: { flash: Record<string, string> }) {
  const msg = flash.success || flash.error || "";
  if (!msg) return null;
  const isError = !!flash.error;
  return (
    <div
      class={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${
        isError ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
      }`}
      x-data
      x-init="$el.style.display='block'; setTimeout(()=>$el.remove(), 5000)"
    >
      {msg}
    </div>
  );
}

export function Layout({
  meta = {},
  user,
  isGuest,
  flash = {},
  csrfToken = "",
  bodyClass = "",
  children,
}: LayoutProps) {
  const title = meta.title ? `${meta.title} | ${config.appName}` : config.appName;
  const description = meta.description ?? "Latihan mengetik dengan leaderboard real-time.";
  const navLinks = [
    { href: "/", label: "Beranda" },
    { href: "/sesi", label: "Sesi Saya" },
    { href: "/latihan", label: "Coba Latihan" },
  ];
  return (
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content={description} />
        <title>{title}</title>
        {meta.noindex && <meta name="robots" content="noindex" />}
        <link rel="stylesheet" href="/css/app.css" />
        <script src="/js/alpine.min.js" defer></script>
        <script src="/js/app.js" defer></script>
      </head>
      <body class={`${bodyClass}`}>
        <header class="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur">
          <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <a href="/" class="font-bold text-lg tracking-tight flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-accent text-white grid place-items-center font-mono text-sm">⌨</span>
              {config.appName}
            </a>
            <nav class="hidden md:flex items-center gap-1 text-sm">
              {navLinks.map((l) => (
                <a href={l.href} class="px-3 py-2 rounded-lg text-ink-soft hover:text-ink hover:bg-base transition-colors">
                  {l.label}
                </a>
              ))}
            </nav>
            <div class="flex items-center gap-2 text-sm">
              {user ? (
                <>
                  <a href="/sesi" class="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-base text-ink-soft">
                    <span class="w-6 h-6 rounded-full bg-accent text-white grid place-items-center text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    {user.name}
                  </a>
                  <a href="/logout" class="px-3 py-1.5 rounded-lg border border-line hover:border-ink transition-colors">
                    Keluar
                  </a>
                </>
              ) : (
                <>
                  <a href="/login" class="px-3 py-1.5 rounded-lg border border-line hover:border-ink transition-colors">
                    Masuk
                  </a>
                  <a href="/register" class="px-3 py-1.5 rounded-lg bg-ink text-white hover:bg-ink/90 transition-colors">
                    Daftar
                  </a>
                </>
              )}
            </div>
          </div>
        </header>
        <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <Flash flash={flash} />
          {children}
        </main>
        <footer class="border-t border-line mt-16">
          <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-ink-soft">
            <span>© {new Date().getFullYear()} {config.appName}</span>
            <span class="font-mono text-xs">WPM × Akurasi = Skor</span>
          </div>
        </footer>
        {csrfToken && (
          <div id="csrf-token" data-token={csrfToken} style="display:none"></div>
        )}
      </body>
    </html>
  );
}
