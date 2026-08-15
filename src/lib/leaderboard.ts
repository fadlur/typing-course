/** Query leaderboard & hasil sesi latihan. */
import { all, one } from "../db/client";

export type LeaderboardEntry = {
  nickname: string;
  wpm: number;
  accuracy: number;
  score: number;
  durationMs: number;
  isYou: boolean;
  attempts: number;
  created_at: string;
};

/**
 * Ambil leaderboard sesi: skor TERBAIK per nickname (case-insensitive).
 * Setiap nickname boleh coba ulang dari perangkat mana pun.
 */
export async function getLeaderboard(
  sessionId: number,
  opts: { limit?: number; myNickname?: string } = {}
): Promise<LeaderboardEntry[]> {
  const limit = opts.limit ?? 50;
  const rows = await all<{
    nickname: string;
    wpm: number;
    accuracy: number;
    score: number;
    duration_ms: number;
    attempts: number;
    created_at: string;
  }>(
    `SELECT
        nickname,
        wpm,
        accuracy,
        score,
        duration_ms,
        attempts,
        created_at
     FROM (
        SELECT nickname, wpm, accuracy, score, duration_ms, created_at,
               COUNT(*) OVER (PARTITION BY LOWER(nickname)) AS attempts,
               ROW_NUMBER() OVER (
                 PARTITION BY LOWER(nickname)
                 ORDER BY score DESC, created_at ASC
               ) AS rn
        FROM typing_results
        WHERE session_id = $1
     ) t
     WHERE rn = 1
     ORDER BY score DESC, created_at ASC
     LIMIT $2`,
    [sessionId, limit]
  );

  const myLower = opts.myNickname?.toLowerCase();
  return rows.map((r) => ({
    nickname: r.nickname,
    wpm: Number(r.wpm),
    accuracy: Number(r.accuracy),
    score: Number(r.score),
    durationMs: Number(r.duration_ms ?? 0),
    attempts: Number(r.attempts),
    created_at: r.created_at,
    isYou: !!myLower && r.nickname.toLowerCase() === myLower,
  }));
}

/** Skor terbaik nickname tertentu di sebuah sesi (jika ada). */
export async function getMyBestScore(
  sessionId: number,
  nickname: string
): Promise<{
  wpm: number;
  accuracy: number;
  score: number;
} | null> {
  const row = await one<{ wpm: number; accuracy: number; score: number }>(
    `SELECT wpm, accuracy, score
     FROM typing_results
     WHERE session_id = $1 AND LOWER(nickname) = LOWER($2)
     ORDER BY score DESC
     LIMIT 1`,
    [sessionId, nickname]
  );
  return row ? { wpm: Number(row.wpm), accuracy: Number(row.accuracy), score: Number(row.score) } : null;
}

/** Jumlah peserta unik di sesi (distinct nickname). */
export async function countUniqueNicknames(sessionId: number): Promise<number> {
  const row = await one<{ c: number }>(
    `SELECT COUNT(DISTINCT LOWER(nickname)) AS c FROM typing_results WHERE session_id = $1`,
    [sessionId]
  );
  return Number(row?.c ?? 0);
}
