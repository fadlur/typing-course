import { exec } from "./client";

/** Skema database PostgreSQL. Dijalankan sekali pada init. */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS texts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'umum',
  content TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'mudah',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  text_id INTEGER REFERENCES texts(id) ON DELETE SET NULL,
  text_content TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_owner ON practice_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_slug ON practice_sessions(slug);

-- Tamu bebas ikut dari perangkat mana pun (tanpa pembatasan device).
-- Setiap percobaan disimpan di typing_results; leaderboard ambil skor terbaik per nickname.
CREATE TABLE IF NOT EXISTS typing_results (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nickname TEXT NOT NULL,
  wpm NUMERIC NOT NULL,
  accuracy NUMERIC NOT NULL,
  score NUMERIC NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_results_session ON typing_results(session_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_results_nickname ON typing_results(session_id, LOWER(nickname), score DESC);
`;

/** Jalankan skema. */
export async function initSchema(): Promise<void> {
  await exec(SCHEMA);
}
