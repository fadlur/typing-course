/** Perhitungan skor latihan mengetik. */

export type ScoreResult = {
  wpm: number;
  accuracy: number; // persen 0-100
  score: number;
  correctChars: number;
  wrongChars: number;
  durationMs: number;
};

/**
 * Hitung skor dari hasil ketik.
 * - totalTyped: jumlah karakter yang berhasil diketik (sebelum timer habis)
 * - errors: jumlah karakter salah di antaranya
 * - WPM: karakter benar / 5 (rata-rata panjang kata) per menit
 * - Accuracy: % karakter benar dari total yang diketik
 * - Score: wpm * (accuracy/100)^2 — memberi bobot besar pada akurasi
 */
export function computeScore(opts: {
  totalTyped: number;
  errors: number;
  durationMs: number;
}): ScoreResult {
  const { totalTyped, errors, durationMs } = opts;

  const correctChars = Math.max(0, totalTyped - errors);
  const minutes = durationMs / 60000;

  const wpm = minutes > 0 ? correctChars / 5 / minutes : 0;
  const accuracy = totalTyped > 0 ? (correctChars / totalTyped) * 100 : 0;
  const score = wpm * Math.pow(accuracy / 100, 2);

  return {
    wpm: Math.round(wpm * 10) / 10,
    accuracy: Math.round(accuracy * 10) / 10,
    score: Math.round(score * 10) / 10,
    correctChars,
    wrongChars: errors,
    durationMs,
  };
}

/** Slug unik untuk sesi latihan. */
export function randomSlug(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const rand = new Uint32Array(length);
  crypto.getRandomValues(rand);
  for (let i = 0; i < length; i++) {
    out += chars[rand[i]! % chars.length];
  }
  return out;
}
