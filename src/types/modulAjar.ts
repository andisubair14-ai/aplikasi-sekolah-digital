
/**
 * STRUKTUR DATA RPM / MODUL AJAR V2
 * Format universal SD dan SMP.
 *
 * Prinsip:
 * - Field lama tetap dipertahankan.
 * - Field baru ditambahkan secara opsional.
 * - Data Firestore lama tetap dapat dibaca.
 * - Tidak melakukan migrasi atau penghapusan data secara otomatis.
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

  // Tambahan untuk format RPM.
  minatMurid?: string;
  latarBelakangMurid?: string;
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

  // Tambahan untuk menyesuaikan format dokumen contoh.
  lintasDisiplinIlmu?: string;
  indikatorPencapaian?: string;
  topikPembelajaran?: string;
}

export interface KerangkaPembelajaranMendalam {
  dimensiProfil: string[];
  prinsipPembelajaran: string[];
  praktikPedagogis: string;
  kemitraan: string;
  lingkungan: string;
  pemanfaatanDigital: string;

  // Tambahan untuk indikator capaian pada kerangka pembelajaran.
  indikatorCapaian?: string;
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

  // Mempertahankan kegiatan inti dari format lama.
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

// Tahapan asesmen pada format RPM.
export type TahapAsesmen = 'Awal' | 'Proses' | 'Akhir';

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

  // Opsional agar data asesmen lama tetap kompatibel.
  tahap?: TahapAsesmen;
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

/**
 * Media pembelajaran.
 * Mendukung format teks lama maupun objek baru.
 */
export interface MediaPembelajaran {
  id?: string;
  nama: string;
  keterangan: string;
  jenis?: string;
}

export type ItemMediaPembelajaran = string | MediaPembelajaran;

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

/**
 * Instrumen penilaian tambahan untuk format RPM.
 * Seluruh field opsional agar dokumen lama tetap kompatibel.
 */
export interface InstrumenPenilaianTambahan {
  soalTesTertulis?: string;
  kunciJawaban?: string;
  rubrikKeterampilan?: string;
  rubrikSikap?: string;
  observasiSikap?: string;
  penilaianDiri?: string;
  penilaianAntarteman?: string;
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
 * Struktur dokumen Modul Ajar / RPM versi 2.
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

  // String lama dan objek media baru sama-sama didukung.
  mediaList: ItemMediaPembelajaran[];

  sumberBelajarList: SumberBelajar[];

  lkpdList: LKPD[];
  lampiranList: Lampiran[];

  // Instrumen tambahan untuk format RPM.
  instrumenPenilaian?: InstrumenPenilaianTambahan;

  refleksi: RefleksiPembelajaran;
  pengesahan: PengesahanModul;

  createdAt?: unknown;
  updatedAt?: unknown;

  /**
   * Salinan data lama untuk kompatibilitas.
   * Jangan dihapus sebelum migrasi dinyatakan aman.
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
  namaSekolah?: string;
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
