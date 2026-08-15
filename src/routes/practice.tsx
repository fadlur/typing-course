/** Halaman latihan publik (join tanpa login) + submit skor + WebSocket leaderboard. */
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { getCookie, setCookie } from "hono/cookie";
import type { ServerWebSocket } from "bun";
import { type AppVariables } from "../middleware/session";
import { one, insert } from "../db/client";
import { renderPage } from "../views/helpers";
import { computeScore } from "../lib/score";
import { getLeaderboard, countUniqueNicknames } from "../lib/leaderboard";
import { joinRoom, leaveRoom, broadcast } from "../lib/realtime";
import { config } from "../config";

export const practiceRoutes = new Hono<{ Variables: AppVariables }>();
export const practiceApi = new Hono<{ Variables: AppVariables }>();
export const practiceWs = new Hono<{ Variables: AppVariables }>();

type SessionRow = {
  id: number;
  title: string;
  slug: string;
  text_content: string;
  duration_seconds: number;
  is_active: number;
};

const NICKNAME_COOKIE = "typing_nickname";

async function loadSession(slug: string): Promise<SessionRow | null> {
  return one<SessionRow>(
    `SELECT id, title, slug, text_content, duration_seconds, is_active
     FROM practice_sessions WHERE slug = $1`,
    [slug]
  );
}

// ---- Halaman latihan publik ----
practiceRoutes.get("/s/:slug", async (c) => {
  const s = await loadSession(c.req.param("slug"));
  if (!s) {
    return c.html(`<h1>404 — Sesi tidak ditemukan.</h1>`, 404);
  }
  if (s.is_active !== 1) {
    return renderPage(
      c,
      { title: "Sesi Ditutup" },
      <div class="text-center py-20">
        <p class="text-5xl mb-4">🔒</p>
        <h1 class="text-2xl font-bold">Sesi ini sudah ditutup</h1>
        <p class="mt-2 text-ink-soft">Hubungi pembuat sesi untuk membukanya kembali.</p>
      </div>
    );
  }

  const remembered = getCookie(c, NICKNAME_COOKIE) ?? "";
  const user = c.get("user");
  const defaultNickname = user?.name ?? remembered;

  const leaderboard = await getLeaderboard(s.id, {
    limit: 50,
    myNickname: defaultNickname,
  });
  const participantCount = await countUniqueNicknames(s.id);

  const shareUrl = `${config.appUrl}/s/${s.slug}`;

  return renderPage(
    c,
    {
      title: s.title,
      description: `Latihan mengetik "${s.title}". Isi nama lalu mulai — skormu langsung masuk leaderboard real-time.`,
    },
    <>
      <div x-data="typingApp()" class="max-w-4xl mx-auto">
        {/* Header sesi */}
        <div class="text-center mb-6">
          <p class="text-xs font-mono uppercase tracking-widest text-accent mb-2">Sesi latihan</p>
          <h1 class="text-2xl sm:text-3xl font-bold" x-text="sessionTitle"></h1>
          <p class="mt-1 text-sm text-ink-soft">
            {s.duration_seconds} detik · <span x-text="participantCount"></span> peserta
          </p>
        </div>

        <div class="grid lg:grid-cols-3 gap-6">
          {/* Kolom utama: latihan */}
          <div class="lg:col-span-2 space-y-5">
            {/* Card nickname / countdown / mengetik */}
            <div class="bg-surface rounded-2xl border border-line shadow-card p-6 sm:p-8">
              <template x-if="!nickname">
                <div>
                  <label class="block text-sm font-medium mb-2">Siapa namamu?</label>
                  <form {...{ "@submit.prevent": "join()" }} class="flex gap-2">
                    <input
                      type="text"
                      x-model="nicknameInput"
                      placeholder="Isi nama (bebas, tanpa daftar)"
                      required
                      maxlength={20}
                      class="flex-1 rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm focus:border-accent"
                    />
                    <button
                      type="submit"
                      class="rounded-lg bg-ink text-white font-semibold px-5 py-3 hover:bg-ink/90 transition-colors"
                    >
                      Mulai
                    </button>
                  </form>
                  <p class="mt-3 text-xs text-ink-soft">
                    Kamu boleh mencoba ulang berapa saja — papan skor menampilkan skor terbaik per nama.
                  </p>
                </div>
              </template>

              <template x-if="nickname && !started">
                <div class="text-center py-8">
                  <p class="text-lg font-semibold mb-1">
                    Siap, <span x-text="nickname"></span>?
                  </p>
                  <p class="text-sm text-ink-soft mb-6">
                    Teks akan muncul dan timer {s.duration_seconds} detik langsung berjalan saat kamu mulai mengetik.
                  </p>
                  <button
                    {...{ "@click": "begin()" }}
                    class="rounded-xl bg-accent text-white font-semibold px-8 py-4 text-lg hover:bg-accent/90 transition-colors"
                  >
                    Mulai Mengetik
                  </button>
                </div>
              </template>

              <template x-if="started && !finished">
                <div>
                  {/* Timer */}
                  <div class="flex items-center justify-between mb-5">
                    <span
                      class="inline-flex items-center gap-2 text-sm font-mono"
                      {...{ ":class": "remaining <= 5 ? 'text-red-600' : 'text-ink-soft'" }}
                    >
                      <span class="w-2 h-2 rounded-full animate-pulse" {...{ ":class": "remaining <= 5 ? 'bg-red-500' : 'bg-accent'" }}></span>
                      <span x-text="remaining + 's'"></span>
                    </span>
                    <span class="text-sm font-mono text-ink-soft">
                      <span x-text="liveWpm"></span> WPM · <span x-text="liveAccuracy + '%'"></span>
                    </span>
                  </div>

                  {/* Teks latihan */}
                  <div
                    class="type-text text-ink-soft cursor-text"
                    {...{ "@click": "$refs.typeInput.focus()" }}
                    x-ref="textDisplay"
                  ></div>

                  {/* Input tersembunyi */}
                  <input
                    type="text"
                    class="hidden-input"
                    x-ref="typeInput"
                    {...{ "@input": "onInput()", "@keydown": "onKeydown($event)" }}
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck={false}
                  />
                </div>
              </template>

              {/* Hasil */}
              <template x-if="finished">
                <div class="text-center py-6">
                  <p class="text-sm font-mono uppercase tracking-widest text-accent mb-3">Hasil kamu</p>
                  <div class="grid grid-cols-3 gap-4 mb-6">
                    <div class="rounded-xl bg-base p-4">
                      <p class="text-3xl font-bold text-accent" x-text="result.wpm"></p>
                      <p class="text-xs text-ink-soft mt-1">WPM</p>
                    </div>
                    <div class="rounded-xl bg-base p-4">
                      <p class="text-3xl font-bold text-accent" x-text="result.accuracy + '%'"></p>
                      <p class="text-xs text-ink-soft mt-1">Akurasi</p>
                    </div>
                    <div class="rounded-xl bg-base p-4">
                      <p class="text-3xl font-bold text-accent" x-text="result.score"></p>
                      <p class="text-xs text-ink-soft mt-1">Skor</p>
                    </div>
                  </div>
                  <div class="flex items-center justify-center gap-3">
                    <button
                      {...{ "@click": "reset()" }}
                      class="rounded-xl bg-ink text-white font-semibold px-6 py-3 hover:bg-ink/90 transition-colors"
                    >
                      Coba Lagi
                    </button>
                  </div>
                </div>
              </template>
            </div>

            {/* Petunjuk singkat */}
            <div class="text-sm text-ink-soft leading-relaxed bg-surface rounded-2xl border border-line p-5">
              <p class="font-semibold text-ink mb-1">Cara skor dihitung</p>
              <p>Skor = WPM × (akurasi/100)². Kecepatan saja tidak cukup — mengetik cepat tapi banyak salah justru menurunkan skor.</p>
            </div>
          </div>

          {/* Leaderboard real-time */}
          <div class="bg-surface rounded-2xl border border-line shadow-card h-fit sticky top-20">
            <div class="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 class="font-bold">Papan Peringkat</h2>
              <span class="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> LIVE
              </span>
            </div>
            <div x-ref="board" class="max-h-[420px] overflow-y-auto p-4 space-y-1">
              <template x-for="(row, i) in leaderboard" {...{ ":key": "row.nickname" }}>
                <div
                  class="flex items-center gap-3 px-3 py-2 rounded-lg"
                  {...{ ":class": "row.isYou ? 'bg-accent-soft border border-accent/30' : i % 2 === 0 ? 'bg-base/60' : ''" }}
                >
                  <span class="w-6 text-center font-mono text-sm" {...{ ":class": "i === 0 ? 'text-amber-500 font-bold' : i === 1 ? 'text-zinc-400 font-bold' : i === 2 ? 'text-orange-400 font-bold' : 'text-ink-soft'" }}>
                    <template x-if="i < 3">
                      <span x-text="medal(i)"></span>
                    </template>
                    <template x-if="i >= 3" x-text="i + 1"></template>
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate" x-text="row.nickname"></p>
                    <p class="text-[11px] text-ink-soft" x-text="row.wpm + ' WPM · ' + row.accuracy + '%'" x-show="row.attempts > 0"></p>
                  </div>
                  <span class="font-mono text-sm font-bold text-accent" x-text="row.score"></span>
                </div>
              </template>
              <p x-show="leaderboard.length === 0" class="text-center text-sm text-ink-soft py-8">
                Belum ada skor. Jadilah yang pertama! 🚀
              </p>
            </div>
          </div>
        </div>

        {/* Data sesi untuk JS */}
        <div style="display:none"
          id="session-data"
          data-slug={s.slug}
          data-title={s.title}
          data-text={s.text_content}
          data-duration={s.duration_seconds}
          data-nickname={defaultNickname}
          data-ws-url={`/ws/s/${s.slug}`}
        ></div>
      </div>
    </>
  );
});

// ---- API submit skor ----
practiceApi.post("/api/s/:slug/result", async (c) => {
  const s = await loadSession(c.req.param("slug"));
  if (!s) {
    return c.json({ error: "Sesi tidak ditemukan." }, 404);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Body JSON tidak valid." }, 400);
  }

  const nickname = String(body.nickname ?? "").trim().slice(0, 20);
  const errors = Number(body.errors ?? 0);
  const durationMs = Number(body.durationMs ?? 0);
  const totalTyped = Number(body.totalTyped ?? 0);

  if (!nickname) {
    return c.json({ error: "Nama wajib diisi." }, 400);
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return c.json({ error: "Durasi tidak valid." }, 400);
  }
  if (
    !Number.isFinite(totalTyped) || totalTyped < 0 || totalTyped > s.text_content.length ||
    !Number.isFinite(errors) || errors < 0 || errors > totalTyped
  ) {
    return c.json({ error: "Data ketikan tidak valid." }, 400);
  }

  const score = computeScore({
    totalTyped,
    errors,
    durationMs,
  });

  const user = c.get("user");
  const id = await insert(
    `INSERT INTO typing_results (session_id, user_id, nickname, wpm, accuracy, score, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [s.id, user?.id ?? null, nickname, score.wpm, score.accuracy, score.score, Math.round(durationMs)]
  );

  // ingat nickname di cookie agar peserta tidak perlu ketik ulang
  setCookie(c, NICKNAME_COOKIE, nickname, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Broadcast leaderboard terbaru ke semua penonton sesi
  const [leaderboard, participantCount] = await Promise.all([
    getLeaderboard(s.id, { limit: 50 }),
    countUniqueNicknames(s.id),
  ]);
  broadcast(s.slug, { type: "leaderboard", leaderboard, participantCount, lastResult: { id, nickname } });

  return c.json({
    id,
    wpm: score.wpm,
    accuracy: score.accuracy,
    score: score.score,
    leaderboard,
    participantCount,
  });
});

// ---- WebSocket leaderboard real-time ----
practiceWs.get(
  "/ws/s/:slug",
  upgradeWebSocket((c) => {
    const slug = c.req.param("slug");
    return {
      async onOpen(evt, ws) {
        if (!slug) return;
        joinRoom(slug, ws as unknown as ServerWebSocket<unknown>);
        const s = await loadSession(slug);
        if (s) {
          const [leaderboard, participantCount] = await Promise.all([
            getLeaderboard(s.id, { limit: 50 }),
            countUniqueNicknames(s.id),
          ]);
          const msg = JSON.stringify({ type: "leaderboard", leaderboard, participantCount });
          (ws as unknown as ServerWebSocket<unknown>).send(msg);
        }
      },
      onClose(evt, ws) {
        if (slug) leaveRoom(slug, ws as unknown as ServerWebSocket<unknown>);
      },
    };
  })
);
