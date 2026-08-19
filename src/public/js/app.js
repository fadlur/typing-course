/** Aplikasi front-end latihan mengetik + leaderboard real-time. */
document.addEventListener("alpine:init", () => {
  Alpine.data("typingApp", () => ({
    // data sesi
    sessionTitle: "",
    text: "",
    duration: 60,
    slug: "",
    wsUrl: "",
    // state
    nickname: "",
    nicknameInput: "",
    started: false,
    finished: false,
    remaining: 0,
    leaderboard: [],
    participantCount: 0,
    result: { wpm: 0, accuracy: 0, score: 0 },
    liveWpm: 0,
    liveAccuracy: 100,
    // internal
    index: 0,
    errors: 0,
    totalTyped: 0,
    startTime: 0,
    timerId: null,
    ws: null,
    charEls: [],
    reconnectTimer: null,

    init() {
      const el = document.getElementById("session-data");
      if (!el) return;
      this.slug = el.dataset.slug;
      this.sessionTitle = el.dataset.title;
      this.text = el.dataset.text;
      this.duration = Number(el.dataset.duration || 60);
      this.wsUrl = el.dataset.wsUrl;
      this.nickname = el.dataset.nickname || "";
      this.nicknameInput = this.nickname;
      this.renderText();
      this.connectWs();
    },

    /** Render teks menjadi per-karakter span. */
    renderText() {
      const display =
        this.$refs.textDisplay || this.$root?.querySelector(".type-text");
      if (!display) return;
      display.innerHTML = "";
      this.charEls = [];
      for (const ch of this.text) {
        const span = document.createElement("span");
        span.textContent = ch;
        span.classList.add("type-plain");
        display.appendChild(span);
        this.charEls.push(span);
      }
    },

    connectWs() {
      if (!this.wsUrl) return;
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      this.ws = new WebSocket(proto + location.host + this.wsUrl);
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "leaderboard") {
            this.leaderboard = msg.leaderboard || [];
            this.participantCount =
              msg.participantCount ?? this.participantCount;
          }
        } catch {}
      };
      this.ws.onclose = () => {
        // reconnect ringan
        this.reconnectTimer = setTimeout(() => this.connectWs(), 3000);
      };
    },

    join() {
      const name = this.nicknameInput.trim();
      if (!name) return;
      this.nickname = name.slice(0, 20);
      // ingat nickname di cookie via server saat submit skor; untuk sekarang pakai localStorage
      try {
        localStorage.setItem("typing_nickname", this.nickname);
      } catch {}
    },

    begin() {
      this.started = true;
      this.finished = false;
      this.index = 0;
      this.errors = 0;
      this.totalTyped = 0;
      this.remaining = this.duration;
      this.liveWpm = 0;
      this.liveAccuracy = 100;
      // mulai countdown
      this.timerId = setInterval(() => {
        this.remaining -= 1;
        if (this.remaining <= 0) {
          clearInterval(this.timerId);
          this.finish();
        }
      }, 1000);
      // fokus input; teks di-render otomatis oleh x-init pada elemen .type-text
      this.$nextTick(() => this.$refs.typeInput?.focus());
    },

    onKeydown(e) {
      if (!this.started || this.finished) return;
      // hanya huruf/tanda baca
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
        if (e.key === "Backspace") {
          // izinkan hapus untuk koreksi (tidak dihitung sebagai salah)
        }
        return;
      }
      e.preventDefault();

      // start time saat karakter pertama
      if (this.totalTyped === 0) {
        this.startTime = Date.now();
      }

      const expected = this.text[this.index];
      if (e.key === expected) {
        if (this.charEls[this.index]) {
          this.charEls[this.index].classList.remove(
            "type-plain",
            "type-wrong",
            "type-current",
          );
          this.charEls[this.index].classList.add("type-correct");
        }
      } else {
        this.errors += 1;
        if (this.charEls[this.index]) {
          this.charEls[this.index].classList.remove(
            "type-plain",
            "type-current",
          );
          this.charEls[this.index].classList.add("type-wrong");
        }
      }
      this.totalTyped += 1;
      this.index += 1;

      // highlight karakter berikutnya
      if (this.charEls[this.index]) {
        this.charEls[this.index].classList.remove("type-plain");
        this.charEls[this.index].classList.add("type-current");
      }

      // hitung live
      const minutes = (Date.now() - this.startTime) / 60000;
      const correct = Math.max(0, this.totalTyped - this.errors);
      this.liveWpm =
        minutes > 0 ? Math.round((correct / 5 / minutes) * 10) / 10 : 0;
      this.liveAccuracy =
        this.totalTyped > 0
          ? Math.round((correct / this.totalTyped) * 1000) / 10
          : 100;

      // selesai jika teks habis
      if (this.index >= this.text.length) {
        this.finish();
      }
    },

    async finish() {
      if (this.finished) return;
      this.finished = true;
      if (this.timerId) clearInterval(this.timerId);
      const durationMs = this.startTime
        ? Date.now() - this.startTime
        : this.duration * 1000;
      const r = await this.submitScore(durationMs);
      if (r) {
        this.result = { wpm: r.wpm, accuracy: r.accuracy, score: r.score };
        if (r.leaderboard) {
          this.leaderboard = r.leaderboard;
          this.participantCount = r.participantCount ?? this.participantCount;
        }
      }
    },

    async submitScore(durationMs) {
      try {
        const res = await fetch(`/api/s/${this.slug}/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: this.nickname,
            errors: this.errors,
            totalTyped: this.totalTyped,
            durationMs: Math.round(durationMs),
          }),
        });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },

    reset() {
      this.finished = false;
      this.started = false;
      this.remaining = this.duration;
      this.index = 0;
      this.errors = 0;
      this.totalTyped = 0;
      this.liveWpm = 0;
      this.liveAccuracy = 100;
    },

    onInput() {
      // input disembunyikan; kunci dari onKeydown yang preventDefault
      this.$refs.typeInput.value = "";
    },

    medal(i) {
      return ["🥇", "🥈", "🥉"][i] ?? "";
    },
  }));

  // Latihan cepat tanpa sesi / leaderboard
  Alpine.data("quickApp", () => ({
    title: "",
    text: "",
    difficulty: "semua",
    started: false,
    finished: false,
    result: { wpm: 0, accuracy: 0, score: 0 },
    liveWpm: 0,
    liveAccuracy: 100,
    index: 0,
    errors: 0,
    totalTyped: 0,
    startTime: 0,
    charEls: [],

    init() {
      const el = document.getElementById("quick-data");
      if (!el) return;
      this.title = el.dataset.title;
      this.text = el.dataset.text;
      this.renderText();
    },

    labelDifficulty(d) {
      return { semua: "Semua", mudah: "Mudah", sedang: "Sedang", sulit: "Sulit" }[d] ?? d;
    },

    async setDifficulty(d) {
      if (d === this.difficulty) return;
      this.difficulty = d;
      // reset state mengetik sebelum ganti teks
      this.started = false;
      this.finished = false;
      this.index = 0;
      this.errors = 0;
      this.totalTyped = 0;
      this.liveWpm = 0;
      this.liveAccuracy = 100;
      await this.loadText();
    },

    async loadText() {
      try {
        const res = await fetch(
          `/api/latihan/teks?difficulty=${this.difficulty}`,
        );
        if (!res.ok) return;
        const t = await res.json();
        if (!t || !t.content) return;
        this.title = t.title;
        this.text = t.content;
        // render ulang jika elemen teks sedang tampil
        this.renderText();
      } catch {}
    },

    renderText() {
      const display =
        this.$refs.textDisplay || this.$root?.querySelector(".type-text");
      if (!display) return;
      display.innerHTML = "";
      this.charEls = [];
      for (const ch of this.text) {
        const span = document.createElement("span");
        span.textContent = ch;
        span.classList.add("type-plain");
        display.appendChild(span);
        this.charEls.push(span);
      }
    },

    begin() {
      this.started = true;
      this.finished = false;
      this.index = 0;
      this.errors = 0;
      this.totalTyped = 0;
      // fokus input; teks di-render otomatis oleh x-init pada elemen .type-text
      this.$nextTick(() => this.$refs.typeInput?.focus());
    },

    onKeydown(e) {
      if (!this.started || this.finished) return;
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();

      if (this.totalTyped === 0) this.startTime = Date.now();

      const expected = this.text[this.index];
      if (e.key === expected) {
        if (this.charEls[this.index]) {
          this.charEls[this.index].classList.remove(
            "type-plain",
            "type-wrong",
            "type-current",
          );
          this.charEls[this.index].classList.add("type-correct");
        }
      } else {
        this.errors += 1;
        if (this.charEls[this.index]) {
          this.charEls[this.index].classList.remove(
            "type-plain",
            "type-current",
          );
          this.charEls[this.index].classList.add("type-wrong");
        }
      }
      this.totalTyped += 1;
      this.index += 1;

      if (this.charEls[this.index]) {
        this.charEls[this.index].classList.remove("type-plain");
        this.charEls[this.index].classList.add("type-current");
      }

      const minutes = (Date.now() - this.startTime) / 60000;
      const correct = Math.max(0, this.totalTyped - this.errors);
      this.liveWpm =
        minutes > 0 ? Math.round((correct / 5 / minutes) * 10) / 10 : 0;
      this.liveAccuracy =
        this.totalTyped > 0
          ? Math.round((correct / this.totalTyped) * 1000) / 10
          : 100;

      if (this.index >= this.text.length) this.finish();
    },

    finish() {
      if (this.finished) return;
      this.finished = true;
      const durationMs = Date.now() - this.startTime;
      const correct = Math.max(0, this.totalTyped - this.errors);
      const minutes = durationMs / 60000;
      const wpm =
        minutes > 0 ? Math.round((correct / 5 / minutes) * 10) / 10 : 0;
      const accuracy =
        this.totalTyped > 0
          ? Math.round((correct / this.totalTyped) * 1000) / 10
          : 100;
      const score = Math.round(wpm * Math.pow(accuracy / 100, 2) * 10) / 10;
      this.result = { wpm, accuracy, score };
    },

    reset() {
      this.finished = false;
      this.started = false;
      this.index = 0;
      this.errors = 0;
      this.totalTyped = 0;
      this.liveWpm = 0;
      this.liveAccuracy = 100;
    },
  }));
});
