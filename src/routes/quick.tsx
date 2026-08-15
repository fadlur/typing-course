/** Route latihan cepat (tanpa sesi, tanpa leaderboard). */
import { Hono } from "hono";
import { type AppVariables } from "../middleware/session";
import { renderPage } from "../views/helpers";
import { one } from "../db/client";

export const quickRoutes = new Hono<{ Variables: AppVariables }>();

quickRoutes.get("/latihan", async (c) => {
  const text = await one<{ id: number; title: string; content: string }>(
    `SELECT id, title, content FROM texts ORDER BY RANDOM() LIMIT 1`
  );
  if (!text) {
    return renderPage(
      c,
      { title: "Coba Latihan" },
      <p class="text-center py-20 text-ink-soft">Belum ada teks latihan.</p>
    );
  }

  return renderPage(
    c,
    { title: "Coba Latihan", description: "Latihan mengetik cepat tanpa sesi." },
    <>
      <div x-data="quickApp()" class="max-w-3xl mx-auto">
        <div class="text-center mb-8">
          <p class="text-xs font-mono uppercase tracking-widest text-accent mb-2">Latihan cepat</p>
          <h1 class="text-2xl sm:text-3xl font-bold" x-text="title"></h1>
          <p class="mt-1 text-sm text-ink-soft">
            Tidak ada timer di mode ini — selesaikan teks secepat dan seakurat mungkin.
          </p>
        </div>

        <div class="bg-surface rounded-2xl border border-line shadow-card p-6 sm:p-8">
          <template x-if="!started && !finished">
            <div class="text-center py-8">
              <button
                {...{ "@click": "begin()" }}
                class="rounded-xl bg-accent text-white font-semibold px-8 py-4 text-lg hover:bg-accent/90 transition-colors"
              >
                Mulai
              </button>
            </div>
          </template>

          <template x-if="started && !finished">
            <div>
              <div class="flex items-center justify-between mb-5">
                <span class="text-sm font-mono text-ink-soft">
                  <span x-text="liveWpm"></span> WPM · <span x-text="liveAccuracy + '%'"></span>
                </span>
                <span class="text-sm text-ink-soft" x-text="'Sisa: ' + (text.length - totalTyped) + ' karakter'"></span>
              </div>
              <div class="type-text text-ink-soft" {...{ "@click": "$refs.typeInput.focus()" }} x-ref="textDisplay"></div>
              <input
                type="text"
                class="hidden-input"
                x-ref="typeInput"
                {...{ "@keydown": "onKeydown($event)" }}
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck={false}
              />
            </div>
          </template>

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
                <button {...{ "@click": "reset()" }} class="rounded-xl bg-ink text-white font-semibold px-6 py-3 hover:bg-ink/90 transition-colors">
                  Coba Lagi
                </button>
              </div>
            </div>
          </template>
        </div>

        <div style="display:none" id="quick-data" data-title={text.title} data-text={text.content}></div>
      </div>
    </>
  );
});
