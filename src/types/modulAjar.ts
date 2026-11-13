
/**
 * STRUKTUR DATA MODUL AJAR V2
 * Format universal SD dan SMP.
 *
 * Catatan:
 * - Tidak menghapus struktur data versi lama.
 * - Data Firestore lama tetap dapat dibaca.
 * - Field versi 2 disusun lebih terstruktur.
 */

export type JenjangSekolah = 'SD' | 'SMP';

export interface IdentitasModul {
  judulModul: string;
  namaSekolah: string;
  namaPenyusun: string;
  nipPenyusun: string;
  jenjang: JenjangSekolah;
  kelas: string;
  fase: string;
  semester: string;
  tahunAjaran: string;
  mataPelajaran: string;
  topik: string;
  alokasiWaktu: string;
  jumlahSiswa: string;
}

export interface IdentifikasiPesertaDidik {
  kesiapanMurid: string;
  karakteristikMateri: string;
  pengetahuanAwal: string;
  kebutuhanBelajar: string;
  kondisiKelas: string;
}

export interface DesainPembelajaran {
  cp: string;
  tp: string;
  materiPokok: string;
  pertanyaanPemantik: string;
  modelPembelajaran: string;
  pendekatanPembelajaran: string;
  metodePembelajaran: string;
  tujuanPembelajaran: string[];
}

export interface KerangkaPembelajaranMendalam {
  dimensiProfil: string[];
  prinsipPembelajaran: string[];
  praktikPedagogis: string;
  kemitraan: string;
  lingkungan: string;
  pemanfaatanDigital: string;
}

export interface LangkahPembelajaran {
  kegiatanAwal: string;
  memahami: string;
  mengaplikasi: string;
  merefleksi: string;
  kegiatanPenutup: string;
}

export interface Pertemuan {
  id: string;
  judul: string;
  tujuanPertemuan: string;
  indikator: string;
  alokasiWaktu: string;
  kegiatanAwal: string;
  memahami: string;
  mengaplikasi: string;
  merefleksi: string;
  kegiatanPenutup: string;
  // Menyimpan kegiatan inti dari format pertemuan lama.
  kegiatanIntiAsli?: string;
  mediaList: string[];
  sumberBelajarList: string[];
  asesmenIdList: string[];
}

export type JenisAsesmen =
  | 'Diagnostik'
  | 'Formatif'
  | 'Sumatif'
  | 'Praktik'
  | 'Proyek'
  | 'Tugas'
  | 'Lainnya';

export interface ButirSoal {
  id: string;
  pertanyaan: string;
  jenisSoal: string;
  pilihanJawaban: string[];
  kunciJawaban: string;
  skor: number;
}

export interface Asesmen {
  id: string;
  judul: string;
  jenis: JenisAsesmen;
  tujuan: string;
  teknik: string;
  instrumen: string;
  waktuPelaksanaan: string;
  butirSoalList: ButirSoal[];
  kriteriaPenilaian: string;
  tindakLanjut: string;
}

export interface TingkatRubrik {
  id: string;
  namaTingkat: string;
  skor: number;
  deskripsi: string;
}

export interface AspekRubrik {
  id: string;
  namaAspek: string;
  tingkatList: TingkatRubrik[];
}

export interface Rubrik {
  id: string;
  judul: string;
  tujuan: string;
  aspekList: AspekRubrik[];
}

export interface PengayaanRemedial {
  pengayaan: string;
  remedial: string;
  pendampingan: string;
  tindakLanjut: string;
}

export interface LKPD {
  id: string;
  judul: string;
  tujuan: string;
  petunjuk: string;
  materi: string;
  langkahKerja: string;
  pertanyaan: string[];
  tugas: string;
  penilaian: string;
}

export interface SumberBelajar {
  id: string;
  nama: string;
  jenis: string;
  keterangan: string;
  url: string;
}

export interface Lampiran {
  id: string;
  judul: string;
  jenis: string;
  deskripsi: string;
  namaFile: string;
  fileUrl: string;
  contentType: string;
}

export interface RefleksiPembelajaran {
  refleksiGuru: string;
  refleksiPesertaDidik: string;
  kendala: string;
  rencanaPerbaikan: string;
}

export interface PengesahanModul {
  tempat: string;
  tanggal: string;
  namaKepalaSekolah: string;
  nipKepalaSekolah: string;
  namaPenyusun: string;
  nipPenyusun: string;
}

/**
 * Struktur dokumen Modul Ajar versi 2.
 */
export interface ModulAjarV2 {
  id?: string;
  versiStruktur: 2;

  userId: string;
  guruId: string;
  namaGuru: string;

  identitas: IdentitasModul;
  identifikasiPesertaDidik: IdentifikasiPesertaDidik;
  desainPembelajaran: DesainPembelajaran;
  kerangkaPembelajaranMendalam: KerangkaPembelajaranMendalam;

  langkahPembelajaran: LangkahPembelajaran;

  pertemuanList: Pertemuan[];
  asesmenList: Asesmen[];
  rubrikList: Rubrik[];

  pengayaanRemedial: PengayaanRemedial;

  mediaList: string[];
  sumberBelajarList: SumberBelajar[];

  lkpdList: LKPD[];
  lampiranList: Lampiran[];

  refleksi: RefleksiPembelajaran;
  pengesahan: PengesahanModul;

  createdAt?: unknown;
  updatedAt?: unknown;

  /**
   * Menyimpan salinan data lama untuk kompatibilitas.
   * Jangan dihapus sebelum proses migrasi dinyatakan aman.
   */
  legacyData?: Record<string, unknown>;
}

/**
 * Bentuk dasar dokumen lama yang sudah digunakan aplikasi.
 */
export interface ModulAjarLegacy {
  id?: string;

  userId?: string;
  guruId?: string;
  namaGuru?: string;

  judulModul?: string;
  jenjang?: string;
  kelas?: string;
  fase?: string;
  semester?: string;
  tahunAjaran?: string;
  mataPelajaran?: string;
  topik?: string;
  alokasiWaktu?: string;

  cp?: string;
  tp?: string;
  kesiapanMurid?: string;
  karakteristikMateri?: string;
  dimensiProfil?: string[];

  praktikPedagogis?: string;
  kemitraan?: string;
  lingkungan?: string;
  pemanfaatanDigital?: string;

  kegiatanAwal?: string;
  memahami?: string;
  mengaplikasi?: string;
  merefleksi?: string;
  kegiatanPenutup?: string;

  asesmenAwal?: string;
  asesmenProses?: string;
  asesmenAkhir?: string;
  instrumen?: string;
  tindakLanjut?: string;

  bahanAjar?: string;
  lkpd?: string;
  media?: string;
  sumberBelajar?: string;

  namaPenyusun?: string;
  nipPenyusun?: string;
  jumlahSiswa?: string;
  pertanyaanPemantik?: string;

  pertemuanList?: Array<{
    id: string;
    judul: string;
    indikator: string;
    kegiatanAwal: string;
    kegiatanInti: string;
    kegiatanPenutup: string;
  }>;

  soalTesTertulis?: string;
  kunciJawaban?: string;
  rubrikKeterampilan?: string;
  rubrikSikap?: string;

  lkpd1?: string;
  lkpd2?: string;
  lkpd3?: string;
  lkpd4?: string;

  glosarium?: string;
  daftarPustaka?: string;
  refleksiGuru?: string;

  createdAt?: unknown;
  updatedAt?: unknown;

  [key: string]: unknown;
}
