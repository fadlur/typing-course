/** Inisialisasi database: jalankan skema + seed teks latihan. */
import { initSchema } from "./schema";
import { seedTexts, seedAdmin } from "./seed";
import { ping } from "./client";

export async function initDb(): Promise<void> {
  await ping();
  await initSchema();
  await seedTexts();
  await seedAdmin();
}

if (process.argv[1] && process.argv[1].endsWith("init.ts")) {
  initDb()
    .then(() => {
      console.log("Database siap.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Gagal init database:", err);
      process.exit(1);
    });
}
