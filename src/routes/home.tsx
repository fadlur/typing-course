/** Route beranda. */
import { Hono } from "hono";
import { type AppVariables } from "../middleware/session";
import { renderPage } from "../views/helpers";
import { all } from "../db/client";

export const homeRoutes = new Hono<{ Variables: AppVariables }>();

homeRoutes.get("/", async (c) => {
  // Statistik ringkas untuk hero
  const [sessionsCount, resultsCount, topResult] = await Promise.all([
    all<{ c: number }>(`SELECT COUNT(*) AS c FROM practice_sessions`),
    all<{ c: number }>(`SELECT COUNT(*) AS c FROM typing_results`),
    all<{ wpm: number; nickname: string }>(
      `SELECT wpm, nickname FROM typing_results ORDER BY wpm DESC LIMIT 1`
    ),
  ]);

  return renderPage(
    c,
    {
      title: "Latihan Mengetik & Leaderboard",
      description:
        "Latihan mengetik bersama, buat sesi, bagikan link atau QR code, dan naikkan skormu di leaderboard real-time. Tanpa perlu daftar untuk ikut.",
    },
    <>
      {/* Hero */}
      <section class="py-16 sm:py-24 text-center">
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-soft text-accent text-sm font-medium mb-6">
          <span class="w-2 h-2 rounded-full bg-accent animate-pulse" />
          Leaderboard real-time · Tanpa login
        </div>
        <h1 class="text-4xl sm:text-6xl font-bold tracking-tight leading-tight max-w-3xl mx-auto text-balance">
          Asah kecepatan mengetik, <span class="text-accent">adu skor</span> bareng teman.
        </h1>
        <p class="mt-6 text-lg text-ink-soft max-w-2xl mx-auto leading-relaxed">
          Buat sesi latihan, bagikan tautan atau QR code. Peserta cukup isi nama lalu langsung mengetik —
          skornya langsung meluncur ke papan peringkat.
        </p>
        <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/sesi"
            class="inline-flex items-center gap-2 rounded-xl bg-ink text-white font-semibold px-6 py-3.5 hover:bg-ink/90 transition-colors"
          >
            Buat Sesi Latihan
          </a>
          <a
            href="/latihan"
            class="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface font-semibold px-6 py-3.5 hover:border-ink transition-colors"
          >
            Coba Latihan Cepat
          </a>
        </div>
      </section>

      {/* Statistik */}
      <section class="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-16">
        {[
          { value: sessionsCount?.[0]?.c ?? 0, label: "Sesi Dibuat" },
          { value: resultsCount?.[0]?.c ?? 0, label: "Skor Tercatat" },
          {
            value: topResult?.[0]?.wpm ?? 0,
            label: `WPM Tertinggi${topResult?.[0]?.nickname ? ` · ${topResult[0].nickname}` : ""}`,
          },
        ].map((s) => (
          <div key={s.label} class="bg-surface rounded-xl border border-line p-5 text-center shadow-card">
            <p class="text-3xl font-bold text-accent">{s.value}</p>
            <p class="mt-1 text-sm text-ink-soft">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Fitur */}
      <section class="py-12">
        <h2 class="text-2xl sm:text-3xl font-bold text-center mb-10">Cara kerjanya</h2>
        <div class="grid sm:grid-cols-3 gap-5">
          {[
            {
              icon: "📋",
              title: "1. Buat sesi",
              desc: "Pilih teks latihan dan durasi, lalu dapatkan link unik beserta QR code.",
            },
            {
              icon: "🔗",
              title: "2. Bagikan",
              desc: "Kirim link atau QR ke peserta. Mereka tidak perlu daftar — cukup isi nama.",
            },
            {
              icon: "🏆",
              title: "3. Adu skor",
              desc: "Skor WPM dan akurasi muncul langsung di leaderboard real-time sesi itu.",
            },
          ].map((f) => (
            <div key={f.title} class="bg-surface rounded-xl border border-line p-6 shadow-card">
              <div class="text-3xl mb-4">{f.icon}</div>
              <h3 class="font-bold text-lg">{f.title}</h3>
              <p class="mt-2 text-ink-soft leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
});
