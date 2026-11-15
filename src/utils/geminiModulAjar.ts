
import { model } from "../lib/firebase";
import type { ModulAjarV2 } from "../types/modulAjar";

type KontenModulAI = Pick<
  ModulAjarV2,
  | "identifikasiPesertaDidik"
  | "desainPembelajaran"
  | "kerangkaPembelajaranMendalam"
  | "langkahPembelajaran"
  | "pertemuanList"
  | "asesmenList"
  | "rubrikList"
  | "pengayaanRemedial"
  | "mediaList"
  | "sumberBelajarList"
  | "lkpdList"
  | "instrumenPenilaian"
>;

function buatId(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index + 1}`;
}

/**
 * Mengubah format alokasi seperti "2 x 35 menit" menjadi 70 menit.
 * Jika hanya tertulis "70 menit", nilainya tetap 70.
 */
function hitungTotalMenit(alokasiWaktu: string): number | null {
  const teks = String(alokasiWaktu || "").toLowerCase().replace(/,/g, ".");
  const perkalian = teks.match(/(\\d+(?:\\.\\d+)?)\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)/i);

  if (perkalian) {
    const jumlahJamPelajaran = Number(perkalian[1]);
    const menitPerJam = Number(perkalian[2]);
    const total = jumlahJamPelajaran * menitPerJam;
    return Number.isFinite(total) && total > 0 ? Math.round(total) : null;
  }

  const tunggal = teks.match(/(\\d+(?:\\.\\d+)?)\\s*(?:menit|mnt)\\b/i);
  if (tunggal) {
    const total = Number(tunggal[1]);
    return Number.isFinite(total) && total > 0 ? Math.round(total) : null;
  }

  return null;
}

function ambilJSON(teks: string): unknown {
  const bersih = teks
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const awal = bersih.indexOf("{");
  const akhir = bersih.lastIndexOf("}");

  if (awal === -1 || akhir === -1) {
    throw new Error("Jawaban AI bukan format JSON yang valid.");
  }

  return JSON.parse(bersih.substring(awal, akhir + 1));
}

export async function buatModulDenganAI(
  identitas: ModulAjarV2["identitas"]
): Promise<KontenModulAI> {
  if (
    !identitas.jenjang ||
    !identitas.kelas ||
    !identitas.mataPelajaran ||
    !identitas.topik
  ) {
    throw new Error(
      "Lengkapi jenjang, kelas, mata pelajaran, dan topik terlebih dahulu."
    );
  }

  const totalMenit = hitungTotalMenit(identitas.alokasiWaktu);
  const keteranganDurasi = totalMenit
    ? `Alokasi waktu "${identitas.alokasiWaktu}" berarti SATU KALI PERTEMUAN dengan total ${totalMenit} menit.`
    : `Alokasi waktu "${identitas.alokasiWaktu}" digunakan untuk SATU KALI PERTEMUAN. Tafsirkan durasinya secara wajar dan jangan membaginya menjadi beberapa pertemuan.`;

  const prompt = `
Anda adalah ahli perencanaan pembelajaran sekolah Indonesia.

Susun rancangan Modul Ajar/Rencana Pembelajaran Mendalam
berdasarkan identitas berikut:

${JSON.stringify(identitas, null, 2)}

ATURAN PENTING PENAFSIRAN ALOKASI WAKTU:
${keteranganDurasi}

Satu kali proses pembuatan modul AI menghasilkan TEPAT SATU PERTEMUAN.
Angka sebelum tanda x/× adalah jumlah jam pelajaran dalam SATU pertemuan,
BUKAN jumlah pertemuan. Contoh:
- 1 x 35 menit = 1 pertemuan dengan total 35 menit.
- 2 x 35 menit = 1 pertemuan dengan total 70 menit.
- 3 x 35 menit = 1 pertemuan dengan total 105 menit.
- 2 x 40 menit = 1 pertemuan dengan total 80 menit.
JANGAN membuat Pertemuan 1 dan Pertemuan 2 hanya karena angka pengali
alokasi waktunya 2 atau 3. Dalam pertemuan tunggal tersebut hanya boleh ada
SATU Kegiatan Awal, SATU rangkaian Kegiatan Inti (Memahami, Mengaplikasi,
Merefleksi), dan SATU Kegiatan Penutup.

KETENTUAN PENYUSUNAN:

1. Sesuaikan seluruh isi dengan jenjang, kelas, fase, mata pelajaran,
   topik, karakteristik peserta didik, dan alokasi waktu yang diberikan.
2. Gunakan bahasa Indonesia baku, jelas, operasional, dan mudah diikuti guru.
3. Buat tepat SATU objek pada pertemuanList. Judulnya "Pertemuan 1: [topik
   pembelajaran]". Isi alokasiWaktu dengan total menit, misalnya "70 menit"
   untuk identitas "2 x 35 menit". Jangan membuat pertemuan kedua atau
   memecah kegiatan menjadi dua sesi 35 menit.
4. Terapkan pembelajaran mendalam: berkesadaran, bermakna, dan menggembirakan.
5. KEGIATAN PEMBELAJARAN PER PERTEMUAN ADALAH BAGIAN TERPENTING.
   Jangan menulis ringkasan pendek atau kalimat umum. Setiap tahap harus
   berupa langkah-langkah bernomor yang rinci, konkret, berurutan, dan
   dapat langsung dipakai guru saat mengajar.
6. Untuk SATU PERTEMUAN tersebut, isi kelima field kegiatan secara lengkap:
   a. kegiatanAwal: salam, doa, pemeriksaan kehadiran/kesiapan, apersepsi,
      pengaitan pengetahuan awal, motivasi, pertanyaan pemantik, penyampaian
      tujuan, dan penjelasan alur kegiatan. Sesuaikan durasi; jangan dipaksakan
      semua menjadi panjang jika waktu terbatas.
   b. memahami: tindakan guru saat menyajikan konsep, media/sumber yang
      digunakan, kegiatan mengamati atau membaca, pertanyaan penuntun,
      diskusi/tanya jawab, miskonsepsi yang perlu diluruskan, serta bukti
      pemahaman yang diamati guru.
   c. mengaplikasi: instruksi tugas/praktik yang jelas, pengelompokan siswa
      bila relevan, alat/bahan atau LKPD, urutan kerja siswa, peran guru saat
      membimbing, bentuk hasil kerja, presentasi/berbagi hasil, dan cara guru
      memberi umpan balik. Buat aktivitas sesuai usia dan fasilitas sekolah.
   d. merefleksi: cara siswa meninjau proses/hasil belajar, pertanyaan refleksi,
      cara siswa menyampaikan pemahaman atau kesulitan, dan tindak lanjut
      singkat dari guru.
   e. kegiatanPenutup: rangkuman bersama, pengecekan ketercapaian tujuan
      atau evaluasi singkat, apresiasi/umpan balik, tindak lanjut atau tugas
      bila relevan, informasi pertemuan berikutnya, doa, dan salam.
7. Karena judul setiap tahap sudah ditampilkan oleh dokumen cetak, isi setiap
   field kegiatan dimulai dengan keterangan waktu pada baris pertama, lalu
   langkah bernomor. Contoh format teks:
   Alokasi waktu: 5 menit\n1. Guru ...\n2. Peserta didik ...
   Jangan mengulang judul tahap di dalam isi dan jangan menggabungkan kelima
   tahap menjadi satu paragraf.
8. RINCIAN WAKTU WAJIB TEPAT. Bagi TOTAL ${totalMenit ?? "durasi yang ditafsirkan dari identitas"}
   menit untuk SATU PERTEMUAN ke dalam kegiatan awal, memahami, mengaplikasi,
   merefleksi, dan penutup. Jumlah seluruh menit kelima tahap harus sama
   persis dengan total durasi satu pertemuan. Cantumkan menit pada label
   setiap tahap. Jangan membagi waktu menjadi pertemuan-pertemuan terpisah.
   Alokasikan waktu secara wajar dan proporsional.
9. Di dalam langkah-langkah, jelaskan secara nyata siapa melakukan apa:
   gunakan subjek "Guru ..." dan "Peserta didik ...". Hindari instruksi kabur
   seperti "guru menjelaskan materi" tanpa rincian materi, media, pertanyaan,
   atau aktivitas siswa.
10. Sertakan diferensiasi/pendampingan yang realistis bagi siswa yang
    membutuhkan bantuan dan tantangan/pengayaan bagi siswa yang siap.
11. Isi langkahPembelajaran sebagai gambaran ringkas keseluruhan, tetapi
    rincian utama wajib berada pada pertemuanList.
12. Susun asesmen awal, proses, dan akhir secara terpisah. Sertakan tujuan,
    teknik, instrumen, waktu, butir soal yang relevan, kunci jawaban, kriteria,
    dan tindak lanjut. Jangan membuat butir soal kosong.
13. Sertakan rubrik dengan empat tingkat pencapaian dan deskripsi terukur
    untuk setiap aspek yang dinilai.
14. Buat LKPD yang benar-benar dapat digunakan peserta didik: identitas,
    tujuan, petunjuk, bahan/materi, langkah kerja, pertanyaan/tugas, dan
    kriteria penilaian yang sesuai dengan kegiatan pertemuan.
15. Media dan sumber belajar harus relevan dengan kegiatan yang dirancang.
    Cantumkan media/sumber yang realistis; jangan mengarang URL.
16. Jangan mengarang nama sekolah, nama guru, NIP, tanda tangan, atau
    identitas pribadi. Jangan membuat CP/TP yang tidak sesuai jenjang dan
    mata pelajaran. Jika rumusan resmi tidak dapat dipastikan, tulis rumusan
    pembelajaran yang relevan tanpa mengklaim sebagai kutipan resmi.
17. Jangan membuat pertemuan kedua. Seluruh tujuan dan aktivitas
    pembelajaran untuk alokasi waktu yang diberikan harus disusun dalam
    satu rangkaian pertemuan tunggal.
18. Isi semua bagian secara konkret dan konsisten. Jangan mengisi daftar
    dengan objek kosong hanya untuk memenuhi struktur JSON.
Keluarkan HANYA JSON valid. Jangan gunakan markdown,
komentar, atau penjelasan di luar JSON.

STRUKTUR JSON:

{
  "identifikasiPesertaDidik": {
    "kesiapanMurid": "",
    "karakteristikMateri": "",
    "pengetahuanAwal": "",
    "minatMurid": "",
    "latarBelakangMurid": "",
    "kebutuhanBelajar": "",
    "kondisiKelas": ""
  },
  "desainPembelajaran": {
    "cp": "",
    "lintasDisiplinIlmu": "",
    "tp": "",
    "indikatorPencapaian": "",
    "topikPembelajaran": "",
    "materiPokok": "",
    "pertanyaanPemantik": "",
    "modelPembelajaran": "",
    "pendekatanPembelajaran": "",
    "metodePembelajaran": "",
    "tujuanPembelajaran": []
  },
  "kerangkaPembelajaranMendalam": {
    "dimensiProfil": [],
    "prinsipPembelajaran": [],
    "indikatorCapaian": "",
    "praktikPedagogis": "",
    "kemitraan": "",
    "lingkungan": "",
    "pemanfaatanDigital": ""
  },
  "langkahPembelajaran": {
    "kegiatanAwal": "",
    "memahami": "",
    "mengaplikasi": "",
    "merefleksi": "",
    "kegiatanPenutup": ""
  },
  "pertemuanList": [
    {
      "judul": "",
      "tujuanPertemuan": "",
      "indikator": "",
      "alokasiWaktu": "",
      "kegiatanAwal": "",
      "memahami": "",
      "mengaplikasi": "",
      "merefleksi": "",
      "kegiatanPenutup": "",
      "mediaList": [],
      "sumberBelajarList": [],
      "asesmenIdList": []
    }
  ],
  "asesmenList": [
    {
      "judul": "Asesmen Awal",
      "tahap": "Awal",
      "jenis": "Diagnostik",
      "tujuan": "",
      "teknik": "",
      "instrumen": "",
      "waktuPelaksanaan": "",
      "butirSoalList": [
        {
          "pertanyaan": "",
          "jenisSoal": "Uraian",
          "pilihanJawaban": [],
          "kunciJawaban": "",
          "skor": 10
        }
      ],
      "kriteriaPenilaian": "",
      "tindakLanjut": ""
    },
    {
      "judul": "Asesmen Proses",
      "tahap": "Proses",
      "jenis": "Formatif",
      "tujuan": "",
      "teknik": "",
      "instrumen": "",
      "waktuPelaksanaan": "",
      "butirSoalList": [],
      "kriteriaPenilaian": "",
      "tindakLanjut": ""
    },
    {
      "judul": "Asesmen Akhir",
      "tahap": "Akhir",
      "jenis": "Sumatif",
      "tujuan": "",
      "teknik": "",
      "instrumen": "",
      "waktuPelaksanaan": "",
      "butirSoalList": [
        {
          "pertanyaan": "",
          "jenisSoal": "Uraian",
          "pilihanJawaban": [],
          "kunciJawaban": "",
          "skor": 10
        }
      ],
      "kriteriaPenilaian": "",
      "tindakLanjut": ""
    }
  ],
  "rubrikList": [
    {
      "judul": "",
      "tujuan": "",
      "aspekList": [
        {
          "namaAspek": "",
          "tingkatList": [
            {
              "namaTingkat": "Sangat Baik",
              "skor": 4,
              "deskripsi": ""
            },
            {
              "namaTingkat": "Baik",
              "skor": 3,
              "deskripsi": ""
            },
            {
              "namaTingkat": "Cukup",
              "skor": 2,
              "deskripsi": ""
            },
            {
              "namaTingkat": "Perlu Bimbingan",
              "skor": 1,
              "deskripsi": ""
            }
          ]
        }
      ]
    }
  ],
  "instrumenPenilaian": {
    "soalTesTertulis": "",
    "kunciJawaban": "",
    "rubrikKeterampilan": "",
    "rubrikSikap": "",
    "observasiSikap": "",
    "penilaianDiri": "",
    "penilaianAntarteman": ""
  },
  "pengayaanRemedial": {
    "pengayaan": "",
    "remedial": "",
    "pendampingan": "",
    "tindakLanjut": ""
  },
  "mediaList": [
    {
      "nama": "",
      "keterangan": ""
    }
  ],
  "sumberBelajarList": [
    {
      "nama": "",
      "jenis": "",
      "keterangan": "",
      "url": ""
    }
  ],
  "lkpdList": [
    {
      "judul": "",
      "tujuan": "",
      "petunjuk": "",
      "materi": "",
      "langkahKerja": "",
      "pertanyaan": [],
      "tugas": "",
      "penilaian": ""
    }
  ]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const teksJawaban = result.response.text();

    if (!teksJawaban) {
      throw new Error("Gemini tidak memberikan hasil.");
    }

    const hasil = ambilJSON(teksJawaban) as Record<string, any>;

    const wajib = [
      "identifikasiPesertaDidik",
      "desainPembelajaran",
      "kerangkaPembelajaranMendalam",
      "langkahPembelajaran",
      "pertemuanList",
      "asesmenList",
      "rubrikList",
      "pengayaanRemedial",
      "mediaList",
      "sumberBelajarList",
      "lkpdList"
    ];

    for (const bagian of wajib) {
      if (hasil[bagian] === undefined || hasil[bagian] === null) {
        throw new Error(`Hasil AI tidak memiliki bagian ${bagian}.`);
      }
    }

    if (!Array.isArray(hasil.pertemuanList)) {
      throw new Error("Data pertemuan dari AI tidak valid.");
    }

    if (!Array.isArray(hasil.asesmenList)) {
      throw new Error("Data asesmen dari AI tidak valid.");
    }

    if (!Array.isArray(hasil.rubrikList)) {
      throw new Error("Data rubrik dari AI tidak valid.");
    }

    if (!Array.isArray(hasil.lkpdList)) {
      throw new Error("Data LKPD dari AI tidak valid.");
    }

    hasil.pertemuanList = hasil.pertemuanList.map(
      (item: Record<string, any>, i: number) => ({
        ...item,
        id: buatId("pertemuan", i),
        mediaList: Array.isArray(item.mediaList) ? item.mediaList : [],
        sumberBelajarList: Array.isArray(item.sumberBelajarList)
          ? item.sumberBelajarList
          : [],
        asesmenIdList: Array.isArray(item.asesmenIdList)
          ? item.asesmenIdList
          : []
      })
    );

    // Pengaman: hasil AI untuk satu kali generate selalu dinormalisasi
    // menjadi satu pertemuan. Jika AI tetap mengirim beberapa objek,
    // isi kegiatan digabung agar tidak ada materi yang terbuang.
    if (hasil.pertemuanList.length > 1) {
      const daftar = hasil.pertemuanList as Record<string, any>[];
      const gabungTahap = (kunci: string): string => {
        const bagian = daftar
          .map((item) => String(item[kunci] || "").trim())
          .filter(Boolean)
          .map((teks) =>
            teks
              .replace(/^\\s*alokasi\\s*waktu\\s*:\\s*[^\\n]+\\n?/i, "")
              .trim()
          )
          .filter(Boolean);

        return bagian.length
          ? bagian.map((teks, index) => `Bagian kegiatan ${index + 1}:\\n${teks}`).join("\\n\\n")
          : "";
      };

      const pertama = daftar[0];
      hasil.pertemuanList = [{
        ...pertama,
        id: buatId("pertemuan", 0),
        judul: `Pertemuan 1: ${pertama.judul || identitas.topik}`,
        alokasiWaktu: `${totalMenit ?? daftar.length} menit`,
        tujuanPertemuan: [...new Set(daftar.map((x) => String(x.tujuanPertemuan || "").trim()).filter(Boolean))].join(" "),
        indikator: [...new Set(daftar.map((x) => String(x.indikator || "").trim()).filter(Boolean))].join("\\n"),
        kegiatanAwal: gabungTahap("kegiatanAwal"),
        memahami: gabungTahap("memahami"),
        mengaplikasi: gabungTahap("mengaplikasi"),
        merefleksi: gabungTahap("merefleksi"),
        kegiatanPenutup: gabungTahap("kegiatanPenutup"),
        mediaList: [...new Set(daftar.flatMap((x) => Array.isArray(x.mediaList) ? x.mediaList : []))],
        sumberBelajarList: [...new Set(daftar.flatMap((x) => Array.isArray(x.sumberBelajarList) ? x.sumberBelajarList : []))],
        asesmenIdList: [...new Set(daftar.flatMap((x) => Array.isArray(x.asesmenIdList) ? x.asesmenIdList : []))]
      }];
    }

    // Pastikan label durasi pada satu pertemuan memakai total menit,
    // bukan jumlah jam pelajaran per pertemuan.
    if (hasil.pertemuanList.length === 1 && totalMenit) {
      hasil.pertemuanList[0].alokasiWaktu = `${totalMenit} menit`;
    }

    hasil.asesmenList = hasil.asesmenList.map(
      (item: Record<string, any>, i: number) => ({
        ...item,
        id: buatId("asesmen", i),
        tahap:
          item.tahap ||
          (item.jenis === "Diagnostik"
            ? "Awal"
            : item.jenis === "Sumatif"
              ? "Akhir"
              : "Proses"),
        butirSoalList: (Array.isArray(item.butirSoalList)
          ? item.butirSoalList
          : []
        ).map((soal: Record<string, any>, j: number) => ({
          ...soal,
          id: buatId(`soal-${i}`, j)
        }))
      })
    );

    hasil.rubrikList = hasil.rubrikList.map(
      (item: Record<string, any>, i: number) => ({
        ...item,
        id: buatId("rubrik", i),
        aspekList: (Array.isArray(item.aspekList) ? item.aspekList : []).map(
          (aspek: Record<string, any>, j: number) => ({
            ...aspek,
            id: buatId(`aspek-${i}`, j),
            tingkatList: (
              Array.isArray(aspek.tingkatList) ? aspek.tingkatList : []
            ).map((tingkat: Record<string, any>, k: number) => ({
              ...tingkat,
              id: buatId(`tingkat-${i}-${j}`, k)
            }))
          })
        )
      })
    );

    hasil.lkpdList = hasil.lkpdList.map(
      (item: Record<string, any>, i: number) => ({
        ...item,
        id: buatId("lkpd", i)
      })
    );

    hasil.sumberBelajarList = (
      Array.isArray(hasil.sumberBelajarList)
        ? hasil.sumberBelajarList
        : []
    ).map((item: Record<string, any>, i: number) => ({
      ...item,
      id: buatId("sumber", i)
    }));

    hasil.mediaList = Array.isArray(hasil.mediaList)
      ? hasil.mediaList
      : [];

    // Normalisasi data kerangka pembelajaran agar selalu berbentuk array.
const kerangka = hasil.kerangkaPembelajaranMendalam || {};

const ubahKeArrayTeks = (nilai: unknown): string[] => {
  if (Array.isArray(nilai)) {
    return nilai.map((item) => {
      if (typeof item === "string") return item;

      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return String(
          obj.nama ||
          obj.prinsip ||
          obj.label ||
          obj.judul ||
          obj.value ||
          obj.deskripsi ||
          ""
        );
      }

      return String(item ?? "");
    }).filter(Boolean);
  }

  if (typeof nilai === "string" && nilai.trim()) {
    return [nilai.trim()];
  }

  return [];
};

hasil.kerangkaPembelajaranMendalam = {
  ...kerangka,
  dimensiProfil: ubahKeArrayTeks(kerangka.dimensiProfil),
  prinsipPembelajaran: ubahKeArrayTeks(kerangka.prinsipPembelajaran),
};
      return hasil as KontenModulAI;
  } catch (error) {
    console.error("Gagal menyusun Modul Ajar dengan AI:", error);
    throw error;
  }
}
