/** Route sesi latihan: daftar, buat, detail + QR, kelola. */
import { Hono } from "hono";
import { type AppVariables } from "../middleware/session";
import { requireAuth, setFlash } from "../middleware/session";
import { all, one, run, insert } from "../db/client";
import { renderPage, csrfInput } from "../views/helpers";
import { randomSlug } from "../lib/score";
import QRCode from "qrcode";
import { config } from "../config";

export const sessionsRoutes = new Hono<{ Variables: AppVariables }>();

type SessionRow = {
  id: number;
  title: string;
  slug: string;
  text_title: string | null;
  duration_seconds: number;
  created_at: string;
  participant_count: number;
  best_score: number | null;
};

type TextRow = {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  content: string;
};

sessionsRoutes.get("/sesi", requireAuth, async (c) => {
  const user = c.get("user")!;
  const rows = await all<SessionRow>(
    `SELECT ps.id, ps.title, ps.slug, t.title AS text_title, ps.duration_seconds, ps.created_at,
            (SELECT COUNT(DISTINCT LOWER(r.nickname)) FROM typing_results r WHERE r.session_id = ps.id) AS participant_count,
            (SELECT MAX(r.score) FROM typing_results r WHERE r.session_id = ps.id) AS best_score
     FROM practice_sessions ps
     LEFT JOIN texts t ON t.id = ps.text_id
     WHERE ps.owner_id = $1
     ORDER BY ps.created_at DESC`,
    [user.id]
  );

  return renderPage(
    c,
    { title: "Sesi Saya" },
    <>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold">Sesi Saya</h1>
          <p class="mt-1 text-ink-soft">
            Buat sesi latihan, bagikan link/QR, dan pantau skor peserta.
          </p>
        </div>
        <a
          href="/sesi/baru"
          class="inline-flex items-center gap-2 rounded-xl bg-ink text-white font-semibold px-5 py-3 hover:bg-ink/90 transition-colors shrink-0"
        >
          + Buat Sesi Baru
        </a>
      </div>

      {rows.length === 0 ? (
        <div class="text-center py-20 bg-surface rounded-2xl border border-dashed border-line-strong">
          <p class="text-4xl mb-4">⌨️</p>
          <h2 class="font-semibold text-lg">Belum ada sesi</h2>
          <p class="mt-1 text-ink-soft text-sm">
            Buat sesi pertamamu dan ajak orang lain ikut tanpa perlu daftar.
          </p>
        </div>
      ) : (
        <div class="grid sm:grid-cols-2 gap-5">
          {rows.map((s) => (
            <div key={s.id} class="bg-surface rounded-2xl border border-line shadow-card p-6 flex flex-col gap-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="font-bold text-lg">{s.title}</h2>
                  <p class="mt-0.5 text-sm text-ink-soft">
                    {s.text_title ?? "Teks kustom"} · {s.duration_seconds} detik
                  </p>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-accent-soft text-accent text-xs font-semibold shrink-0">
                  {s.participant_count} peserta
                </span>
              </div>
              <p class="text-xs font-mono text-ink-soft">
                Dibuat {new Date(s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
              </p>
              <div class="flex items-center gap-2 mt-auto">
                <a
                  href={`/s/${s.slug}`}
                  class="flex-1 inline-flex justify-center items-center rounded-lg bg-ink text-white text-sm font-semibold py-2.5 hover:bg-ink/90 transition-colors"
                >
                  Buka Sesi
                </a>
                <a
                  href={`/sesi/${s.id}`}
                  class="inline-flex items-center justify-center rounded-lg border border-line-strong text-sm font-semibold px-4 py-2.5 hover:border-ink transition-colors"
                >
                  Kelola
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
});

// ---- Buat sesi baru ----
sessionsRoutes.get("/sesi/baru", requireAuth, async (c) => {
  const texts = await all<TextRow>(
    `SELECT id, title, category, difficulty, content FROM texts ORDER BY category, title`
  );
  return renderPage(
    c,
    { title: "Buat Sesi Baru" },
    <>
      <div class="max-w-2xl mx-auto">
        <h1 class="text-3xl font-bold mb-2">Buat Sesi Latihan</h1>
        <p class="text-ink-soft mb-8">
          Pilih teks latihan, tentukan durasi, lalu bagikan link/QR-nya.
        </p>

        <form method="post" action="/sesi/baru" class="bg-surface rounded-2xl border border-line shadow-card p-8 space-y-6">
          {csrfInput(c.get("csrfToken"))}
          <div>
            <label for="title" class="block text-sm font-medium mb-1.5">Judul Sesi</label>
            <input
              type="text"
              name="title"
              id="title"
              required
              placeholder="Misal: Lomba mengetik Jumat sore"
              class="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm focus:border-accent"
            />
          </div>
          <div>
            <label for="text_id" class="block text-sm font-medium mb-1.5">Teks Latihan</label>
            <select
              name="text_id"
              id="text_id"
              required
              class="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm focus:border-accent"
            >
              {texts.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {t.category} · {t.difficulty}
                </option>
              ))}
            </select>
            <p class="mt-1.5 text-xs text-ink-soft">
              Tekan salah satu teks untuk melihat isinya.
            </p>
          </div>
          <div>
            <label for="duration_seconds" class="block text-sm font-medium mb-1.5">Durasi (detik)</label>
            <select
              name="duration_seconds"
              id="duration_seconds"
              class="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm focus:border-accent"
            >
              {[15, 30, 60, 120].map((d) => (
                <option value={d} selected={d === 60}>
                  {d} detik
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            class="w-full rounded-xl bg-ink text-white font-semibold py-3 hover:bg-ink/90 transition-colors"
          >
            Buat Sesi
          </button>
        </form>
      </div>
    </>
  );
});

sessionsRoutes.post("/sesi/baru", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const title = String(body.title ?? "").trim();
  const textId = Number(body.text_id ?? 0);
  const durationSeconds = Math.max(5, Number(body.duration_seconds ?? 60));

  if (!title || !textId) {
    setFlash(c, { error: "Judul dan teks wajib diisi." });
    return c.redirect("/sesi/baru");
  }

  const text = await one<TextRow>(`SELECT id, title, content FROM texts WHERE id = ?`, [textId]);
  if (!text) {
    setFlash(c, { error: "Teks tidak ditemukan." });
    return c.redirect("/sesi/baru");
  }

  // cegah slug bentrok
  let slug = randomSlug();
  while (await one(`SELECT id FROM practice_sessions WHERE slug = ?`, [slug])) {
    slug = randomSlug();
  }

  const id = await insert(
    `INSERT INTO practice_sessions (owner_id, title, slug, text_id, text_content, duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user.id, title, slug, text.id, text.content, durationSeconds]
  );
  setFlash(c, { success: "Sesi berhasil dibuat. Bagikan link/QR-nya!" });
  return c.redirect(`/sesi/${id}`);
});

// ---- Detail & kelola sesi (dengan QR) ----
sessionsRoutes.get("/sesi/:id", requireAuth, async (c) => {
  const user = c.get("user")!;
  const id = Number(c.req.param("id"));
  const s = await one<{
    id: number;
    title: string;
    slug: string;
    text_title: string | null;
    text_content: string;
    duration_seconds: number;
    created_at: string;
    owner_id: number;
  }>(
    `SELECT ps.id, ps.title, ps.slug, t.title AS text_title, ps.text_content, ps.duration_seconds, ps.created_at, ps.owner_id
     FROM practice_sessions ps
     LEFT JOIN texts t ON t.id = ps.text_id
     WHERE ps.id = $1`,
    [id]
  );
  if (!s || s.owner_id !== user.id) {
    setFlash(c, { error: "Sesi tidak ditemukan." });
    return c.redirect("/sesi");
  }

  const shareUrl = `${config.appUrl}/s/${s.slug}`;
  const qrDataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, width: 220, color: { dark: "#1c1917", light: "#ffffff" } });

  const results = await all<{ nickname: string; wpm: number; accuracy: number; score: number; attempts: number }>(
    `SELECT
        nickname, wpm, accuracy, score, attempts
     FROM (
       SELECT nickname, wpm, accuracy, score,
              COUNT(*) OVER (PARTITION BY LOWER(nickname)) AS attempts,
              ROW_NUMBER() OVER (PARTITION BY LOWER(nickname) ORDER BY score DESC, created_at ASC) AS rn
       FROM typing_results
       WHERE session_id = $1
     ) t WHERE rn = 1
     ORDER BY score DESC
     LIMIT 20`,
    [id]
  );

  return renderPage(
    c,
    { title: s.title, noindex: true },
    <>
      <div class="max-w-3xl mx-auto">
        <div class="flex items-start justify-between gap-4 mb-6">
          <div>
            <a href="/sesi" class="text-sm text-accent hover:underline">← Kembali ke Sesi Saya</a>
            <h1 class="text-3xl font-bold mt-2">{s.title}</h1>
            <p class="mt-1 text-ink-soft text-sm">
              {s.text_title ?? "Teks kustom"} · {s.duration_seconds} detik · dibuat{" "}
              {new Date(s.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <a
            href={`/s/${s.slug}`}
            class="inline-flex items-center gap-2 rounded-xl bg-ink text-white font-semibold px-5 py-3 hover:bg-ink/90 transition-colors shrink-0"
          >
            Buka Halaman Latihan
          </a>
        </div>

        {/* Bagikan */}
        <div class="bg-surface rounded-2xl border border-line shadow-card p-6 mb-8">
          <h2 class="font-semibold mb-4">Bagikan ke peserta</h2>
          <div class="flex flex-col sm:flex-row items-center gap-6">
            <div class="bg-white border border-line rounded-xl p-3 shrink-0">
              <img src={qrDataUrl} alt="QR code sesi" class="w-[140px] h-[140px]" />
            </div>
            <div class="flex-1 w-full space-y-3">
              <p class="text-sm text-ink-soft">Peserta cukup buka link ini — tanpa daftar, langsung isi nama.</p>
              <div class="flex gap-2">
                <input
                  type="text"
                  readonly
                  value={shareUrl}
                  class="flex-1 rounded-lg border border-line-strong bg-base px-4 py-2.5 text-sm font-mono"
                  x-data
                  x-ref="link"
                />
                <button
                  type="button"
                  {...{ "@click": "navigator.clipboard.writeText($refs.link.value); $el.textContent='Tersalin ✓'; setTimeout(()=>$el.textContent='Salin',2000)" }}
                  class="rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold hover:border-ink transition-colors"
                >
                  Salin
                </button>
              </div>
              <p class="text-xs text-ink-soft">
                Tamu boleh mencoba ulang berapa kali — leaderboard menampilkan skor terbaik per nama.
              </p>
            </div>
          </div>
        </div>

        {/* Teks */}
        <div class="bg-surface rounded-2xl border border-line shadow-card p-6 mb-8">
          <h2 class="font-semibold mb-3">Teks Latihan</h2>
          <p class="type-text type-plain text-sm sm:text-base">{s.text_content}</p>
        </div>

        {/* Hasil */}
        <div class="bg-surface rounded-2xl border border-line shadow-card overflow-hidden">
          <div class="px-6 py-4 border-b border-line">
            <h2 class="font-semibold">Papan Peringkat</h2>
          </div>
          {results.length === 0 ? (
            <p class="px-6 py-10 text-center text-ink-soft text-sm">
              Belum ada skor. Bagikan linknya dan tunggu peserta mulai mengetik!
            </p>
          ) : (
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-ink-soft border-b border-line">
                  <th class="px-6 py-3">#</th>
                  <th class="px-6 py-3">Nama</th>
                  <th class="px-6 py-3 text-right">WPM</th>
                  <th class="px-6 py-3 text-right">Akurasi</th>
                  <th class="px-6 py-3 text-right">Skor</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.nickname} class={i === 0 ? "bg-accent-soft/50" : "border-b border-line/60"}>
                    <td class="px-6 py-3 font-mono text-ink-soft">{i + 1}</td>
                    <td class="px-6 py-3 font-medium">
                      {r.nickname}
                      {r.attempts > 1 && <span class="ml-2 text-xs text-ink-soft">({r.attempts}×)</span>}
                    </td>
                    <td class="px-6 py-3 text-right font-mono">{r.wpm}</td>
                    <td class="px-6 py-3 text-right font-mono">{r.accuracy}%</td>
                    <td class="px-6 py-3 text-right font-bold text-accent">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
});

// ---- Hapus sesi ----
sessionsRoutes.post("/sesi/:id/hapus", requireAuth, async (c) => {
  const user = c.get("user")!;
  const id = Number(c.req.param("id"));
  await run(`DELETE FROM practice_sessions WHERE id = $1 AND owner_id = $2`, [id, user.id]);
  setFlash(c, { success: "Sesi dihapus." });
  return c.redirect("/sesi");
});
