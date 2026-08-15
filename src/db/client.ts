/** PostgreSQL client via postgres.js. Helper global dengan dukungan transaksi (AsyncLocalStorage). */
import postgres from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "../config";

const sql = postgres(config.database.url, {
  max: config.database.maxConnections,
  idle_timeout: 30,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
});

export type Sql = postgres.Sql<{}>;

/** Menyimpan koneksi transaksi aktif (jika ada). */
const txStorage = new AsyncLocalStorage<postgres.TransactionSql<{}>>();

export function getDb(): Sql {
  return sql;
}

/** Koneksi yang sedang aktif: transaksi jika di dalam tx, selain itu pool. */
function currentSql(): Sql {
  const t = txStorage.getStore();
  return (t ?? sql) as unknown as Sql;
}

/** Konversi placeholder `?` (sqlite style) ke `$1, $2, ...` (postgres). */
function convertQuery(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

/** Eksekusi query dan kembalikan semua baris. */
export async function all<T = any>(query: string, params: unknown[] = []): Promise<T[]> {
  const rows = await currentSql().unsafe(convertQuery(query), params as any[]);
  return rows as unknown as T[];
}

/** Eksekusi query dan kembalikan satu baris (atau null). */
export async function one<T = any>(query: string, params: unknown[] = []): Promise<T | null> {
  const rows = await all<T>(query, params);
  return rows[0] ?? null;
}

/** Eksekusi INSERT/UPDATE/DELETE. Mengembalikan jumlah baris terpengaruh. */
export async function run(query: string, params: unknown[] = []): Promise<number> {
  const rows = await all(query, params);
  return rows.length;
}

/** INSERT yang mengembalikan id baris baru. */
export async function insert(query: string, params: unknown[] = []): Promise<number> {
  const hasReturning = /\sRETURNING\s/i.test(query);
  const finalQuery = hasReturning
    ? query
    : `${query.trim().replace(/;\s*$/, "")} RETURNING id`;
  const rows = await all<{ id: number }>(finalQuery, params);
  return rows.length > 0 ? Number(rows[0]!.id) : 0;
}

/** Eksekusi statement tanpa hasil (DDL). */
export async function exec(query: string): Promise<void> {
  await currentSql().unsafe(query);
}

/** Transaksi. Callback boleh async; helper global otomatis memakai koneksi transaksi. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  const result = await sql.begin(async (t) => {
    return await txStorage.run(t, fn);
  });
  return result as unknown as T;
}

/** Cek koneksi database. */
export async function ping(): Promise<void> {
  await sql`SELECT 1`;
}
