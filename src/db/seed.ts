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
  {
    title: "Kecerdasan buatan",
    category: "teknologi",
    difficulty: "sedang",
    content:
      "Kecerdasan buatan membantu manusia mengerjakan tugas yang rumit dengan cepat. Mesin belajar dari data agar dapat mengambil keputusan yang tepat.",
  },
  {
    title: "Keamanan siber",
    category: "teknologi",
    difficulty: "sulit",
    content:
      "Keamanan siber melindungi data dan sistem dari ancaman yang tidak diinginkan. Setiap pengguna internet perlu memahami dasar-dasar perlindungan informasi pribadi.",
  },
  {
    title: "Internet untuk belajar",
    category: "teknologi",
    difficulty: "mudah",
    content:
      "Internet membuka akses ilmu pengetahuan yang sangat luas. Siapa pun bisa belajar hal baru setiap hari dengan mudah dan murah.",
  },
  {
    title: "Fokus itu pilihan",
    category: "motivasi",
    difficulty: "mudah",
    content:
      "Fokus adalah pilihan yang kita buat setiap hari. Jauhkan gangguan, selesaikan satu hal, lalu lakukan dengan sepenuh hati.",
  },
  {
    title: "Gagal itu proses",
    category: "motivasi",
    difficulty: "sedang",
    content:
      "Kegagalan bukan akhir dari segalanya. Setiap kesalahan adalah pelajaran berharga yang membentuk kita menjadi pribadi yang lebih tangguh.",
  },
  {
    title: "Bersyukur setiap hari",
    category: "motivasi",
    difficulty: "mudah",
    content:
      "Rasa syukur mengubah cara pandang kita terhadap kehidupan. Hal-hal kecil yang sederhana sering kali membawa kebahagiaan terbesar.",
  },
  {
    title: "Waktu adalah modal",
    category: "motivasi",
    difficulty: "sedang",
    content:
      "Waktu adalah modal yang tidak bisa dibeli kembali. Gunakan setiap detik untuk hal-hal yang benar-benar berarti bagi masa depanmu.",
  },
  {
    title: "Membaca jendela dunia",
    category: "umum",
    difficulty: "mudah",
    content:
      "Membaca membuka jendela dunia yang sangat luas. Melalui buku, kita dapat menjelajah berbagai tempat dan pengalaman tanpa batas.",
  },
  {
    title: "Menjaga kesehatan",
    category: "umum",
    difficulty: "mudah",
    content:
      "Tubuh yang sehat menopang pikiran yang jernih. Istirahat yang cukup, makanan bergizi, dan olahraga teratur adalah kuncinya.",
  },
  {
    title: "Prinsip desain",
    category: "desain",
    difficulty: "sedang",
    content:
      "Desain yang baik memadukan fungsi dan keindahan secara seimbang. Ruang kosong, keseimbangan, dan konsistensi membuat karya terasa nyaman.",
  },
  {
    title: "Warna dan emosi",
    category: "desain",
    difficulty: "sulit",
    content:
      "Warna membangkitkan emosi yang berbeda pada setiap orang. Pemilihan palet yang tepat mampu memperkuat pesan dari sebuah desain.",
  },
  {
    title: "Menabung sejak dini",
    category: "ekonomi",
    difficulty: "mudah",
    content:
      "Menabung sejak dini membentuk kebiasaan finansial yang sehat. Sisihkan sebagian penghasilan untuk masa depan yang lebih aman.",
  },
  {
    title: "Hutan paru-paru dunia",
    category: "sains",
    difficulty: "sedang",
    content:
      "Hutan adalah paru-paru dunia yang menyerap karbon dan menghasilkan oksigen. Melestarikan hutan berarti menjaga kelangsungan kehidupan.",
  },
  {
    title: "Laut yang luas",
    category: "sains",
    difficulty: "mudah",
    content:
      "Laut menyimpan kekayaan alam yang luar biasa besarnya. Menjaga kebersihan laut merupakan kewajiban kita semua.",
  },
];

/** Seed teks latihan (tambahkan yang belum ada, idempotent). */
export async function seedTexts(): Promise<void> {
  let inserted = 0;
  for (const t of TEXTS) {
    const existing = await one(`SELECT id FROM texts WHERE title = ?`, [
      t.title,
    ]);
    if (!existing) {
      await run(
        `INSERT INTO texts (title, category, difficulty, content) VALUES (?, ?, ?, ?)`,
        [t.title, t.category, t.difficulty, t.content]
      );
      inserted += 1;
    }
  }
  if (inserted > 0) {
    console.log(`Seed ${inserted} teks latihan baru.`);
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
