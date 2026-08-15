/** Seed data awal: admin + kumpulan teks latihan mengetik. */
import { one, run } from "./client";
import { hashPassword } from "../lib/password";
import { config } from "../config";

const TEXTS = [
  {
    title: "Pemrograman itu seni",
    category: "teknologi",
    difficulty: "mudah",
    content:
      "Menulis kode adalah seni menuangkan logika menjadi instruksi yang bisa dimengerti mesin. Setiap baris punya makna dan tujuan.",
  },
  {
    title: "Kebiasaan kecil",
    category: "motivasi",
    difficulty: "mudah",
    content:
      "Perubahan besar selalu dimulai dari kebiasaan kecil yang dilakukan setiap hari. Konsistensi mengalahkan intensitas sesaat.",
  },
  {
    title: "Bahasa Indonesia",
    category: "umum",
    difficulty: "sedang",
    content:
      "Bahasa Indonesia adalah bahasa persatuan bangsa. Melalui bahasa, kita menyampaikan gagasan, perasaan, dan harapan kepada sesama.",
  },
  {
    title: "Algoritma dan struktur data",
    category: "teknologi",
    difficulty: "sedang",
    content:
      "Algoritma adalah langkah-langkah sistematis untuk menyelesaikan masalah. Struktur data adalah cara mengorganisir data agar efisien.",
  },
  {
    title: "Jenis huruf tipografi",
    category: "desain",
    difficulty: "sulit",
    content:
      "Tipografi adalah seni menyusun huruf agar mudah dibaca dan indah dipandang. Pilihan font mempengaruhi suasana sebuah tulisan.",
  },
  {
    title: "Jaringan komputer",
    category: "teknologi",
    difficulty: "sulit",
    content:
      "Jaringan komputer menghubungkan banyak perangkat agar saling bertukar data. Protokol mengatur aturan komunikasi antar perangkat.",
  },
];

/** Seed teks latihan (hanya jika tabel kosong). */
export async function seedTexts(): Promise<void> {
  const count = await one<{ c: string | number }>(`SELECT COUNT(*) AS c FROM texts`);
  if (!count || Number(count.c) === 0) {
    for (const t of TEXTS) {
      await run(
        `INSERT INTO texts (title, category, difficulty, content) VALUES (?, ?, ?, ?)`,
        [t.title, t.category, t.difficulty, t.content]
      );
    }
    console.log(`Seed ${TEXTS.length} teks latihan.`);
  }
}

/** Seed akun admin (hanya jika belum ada). */
export async function seedAdmin(): Promise<void> {
  const existing = await one(`SELECT id FROM users WHERE email = ?`, [
    config.admin.email,
  ]);
  if (!existing) {
    const hash = await hashPassword(config.admin.password);
    await run(
      `INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)`,
      ["Admin", config.admin.email, hash]
    );
    console.log(`Akun admin dibuat: ${config.admin.email}`);
  }
}
