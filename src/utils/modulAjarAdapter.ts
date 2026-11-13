
import type {
  Asesmen,
  AspekRubrik,
  ButirSoal,
  IdentifikasiPesertaDidik,
  IdentitasModul,
  JenjangSekolah,
  KerangkaPembelajaranMendalam,
  LangkahPembelajaran,
  Lampiran,
  LKPD,
  ModulAjarLegacy,
  ModulAjarV2,
  Pertemuan,
  PengayaanRemedial,
  RefleksiPembelajaran,
  Rubrik,
  SumberBelajar,
  DesainPembelajaran,
  PengesahanModul,
} from '../types/modulAjar';

function teks(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function daftarTeks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === 'string'
  );
}

function daftarObjek<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function buatId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

export function buatModulAjarKosongV2(
  userId = '',
  guruId = '',
  namaGuru = ''
): ModulAjarV2 {
  return {
    versiStruktur: 2,
    userId,
    guruId,
    namaGuru,

    identitas: {
      judulModul: '',
      namaSekolah: '',
      namaPenyusun: namaGuru,
      nipPenyusun: '',
      jenjang: 'SD',
      kelas: '',
      fase: '',
      semester: '',
      tahunAjaran: '',
      mataPelajaran: '',
      topik: '',
      alokasiWaktu: '',
      jumlahSiswa: '',
    },

    identifikasiPesertaDidik: {
      kesiapanMurid: '',
      karakteristikMateri: '',
      pengetahuanAwal: '',
      kebutuhanBelajar: '',
      kondisiKelas: '',
    },

    desainPembelajaran: {
      cp: '',
      tp: '',
      materiPokok: '',
      pertanyaanPemantik: '',
      modelPembelajaran: '',
      pendekatanPembelajaran: '',
      metodePembelajaran: '',
      tujuanPembelajaran: [],
    },

    kerangkaPembelajaranMendalam: {
      dimensiProfil: [],
      prinsipPembelajaran: [],
      praktikPedagogis: '',
      kemitraan: '',
      lingkungan: '',
      pemanfaatanDigital: '',
    },

    langkahPembelajaran: {
      kegiatanAwal: '',
      memahami: '',
      mengaplikasi: '',
      merefleksi: '',
      kegiatanPenutup: '',
    },

    pertemuanList: [],
    asesmenList: [],
    rubrikList: [],

    pengayaanRemedial: {
      pengayaan: '',
      remedial: '',
      pendampingan: '',
      tindakLanjut: '',
    },

    mediaList: [],
    sumberBelajarList: [],
    lkpdList: [],
    lampiranList: [],

    refleksi: {
      refleksiGuru: '',
      refleksiPesertaDidik: '',
      kendala: '',
      rencanaPerbaikan: '',
    },

    pengesahan: {
      tempat: '',
      tanggal: '',
      namaKepalaSekolah: '',
      nipKepalaSekolah: '',
      namaPenyusun: namaGuru,
      nipPenyusun: '',
    },
  };
}

function konversiPertemuanLama(
  item: NonNullable<ModulAjarLegacy['pertemuanList']>[number],
  index: number
): Pertemuan {
  return {
    id: teks(item.id, buatId('pertemuan', index)),
    judul: teks(item.judul, `Pertemuan ${index + 1}`),
    tujuanPertemuan: '',
    indikator: teks(item.indikator),
    alokasiWaktu: '',
    kegiatanAwal: teks(item.kegiatanAwal),

    // Redaksi kegiatan inti lama tidak ditafsirkan ulang.
    kegiatanIntiAsli: teks(item.kegiatanInti),

    memahami: '',
    mengaplikasi: '',
    merefleksi: '',
    kegiatanPenutup: teks(item.kegiatanPenutup),

    mediaList: [],
    sumberBelajarList: [],
    asesmenIdList: [],
  };
}

function konversiRubrikLama(
  judul: string,
  isi: string,
  id: string
): Rubrik | null {
  if (!isi.trim()) return null;

  const aspek: AspekRubrik = {
    id: `${id}-aspek-1`,
    namaAspek: 'Isi rubrik asli',
    tingkatList: [
      {
        id: `${id}-tingkat-1`,
        namaTingkat: 'Deskripsi asli',
        skor: 0,
        deskripsi: isi,
      },
    ],
  };

  return {
    id,
    judul,
    tujuan: 'Dokumen rubrik dari Modul Ajar versi lama.',
    aspekList: [aspek],
  };
}

function buatLampiranTeks(
  id: string,
  judul: string,
  isi: string
): Lampiran | null {
  if (!isi.trim()) return null;

  return {
    id,
    judul,
    jenis: 'Teks',
    deskripsi: isi,
    namaFile: '',
    fileUrl: '',
    contentType: 'text/plain',
  };
}

export function adaptModulAjarLegacyToV2(
  raw: ModulAjarLegacy
): ModulAjarV2 {
  const hasil = buatModulAjarKosongV2(
    teks(raw.userId),
    teks(raw.guruId),
    teks(raw.namaGuru)
  );

  const jenjang: JenjangSekolah =
    raw.jenjang === 'SMP' ? 'SMP' : 'SD';

  const identitas: IdentitasModul = {
    judulModul: teks(raw.judulModul),
    namaSekolah: teks(raw.namaSekolah),
    namaPenyusun: teks(raw.namaPenyusun, teks(raw.namaGuru)),
    nipPenyusun: teks(raw.nipPenyusun),
    jenjang,
    kelas: teks(raw.kelas),
    fase: teks(raw.fase),
    semester: teks(raw.semester),
    tahunAjaran: teks(raw.tahunAjaran),
    mataPelajaran: teks(raw.mataPelajaran),
    topik: teks(raw.topik),
    alokasiWaktu: teks(raw.alokasiWaktu),
    jumlahSiswa: teks(raw.jumlahSiswa),
  };

  const identifikasiPesertaDidik: IdentifikasiPesertaDidik = {
    kesiapanMurid: teks(raw.kesiapanMurid),
    karakteristikMateri: teks(raw.karakteristikMateri),
    pengetahuanAwal: '',
    kebutuhanBelajar: '',
    kondisiKelas: '',
  };

  const desainPembelajaran: DesainPembelajaran = {
    cp: teks(raw.cp),
    tp: teks(raw.tp),
    materiPokok: teks(raw.topik),
    pertanyaanPemantik: teks(raw.pertanyaanPemantik),
    modelPembelajaran: '',
    pendekatanPembelajaran: '',
    metodePembelajaran: '',
    tujuanPembelajaran: [],
  };

  const kerangkaPembelajaranMendalam: KerangkaPembelajaranMendalam = {
    dimensiProfil: daftarTeks(raw.dimensiProfil),
    prinsipPembelajaran: [],
    praktikPedagogis: teks(raw.praktikPedagogis),
    kemitraan: teks(raw.kemitraan),
    lingkungan: teks(raw.lingkungan),
    pemanfaatanDigital: teks(raw.pemanfaatanDigital),
  };

  const langkahPembelajaran: LangkahPembelajaran = {
    kegiatanAwal: teks(raw.kegiatanAwal),
    memahami: teks(raw.memahami),
    mengaplikasi: teks(raw.mengaplikasi),
    merefleksi: teks(raw.merefleksi),
    kegiatanPenutup: teks(raw.kegiatanPenutup),
  };

  const pertemuanLama = daftarObjek<
    NonNullable<ModulAjarLegacy['pertemuanList']>[number]
  >(raw.pertemuanList);

  const pertemuanBaru = pertemuanLama.map(
    konversiPertemuanLama
  );

  // LKPD 1 sampai 4 dari format lama.
  const lkpdList: LKPD[] = [
    raw.lkpd1,
    raw.lkpd2,
    raw.lkpd3,
    raw.lkpd4,
  ]
    .filter(
      (item): item is string =>
        typeof item === 'string' && item.trim() !== ''
    )
    .map((item, index) => ({
      id: buatId('lkpd', index),
      judul: `LKPD ${index + 1}`,
      tujuan: '',
      petunjuk: '',
      materi: '',
      langkahKerja: item,
      pertanyaan: [],
      tugas: '',
      penilaian: '',
    }));

  // LKPD umum versi lama.
  const lkpdUmum = teks(raw.lkpd);

  if (lkpdUmum.trim()) {
    lkpdList.push({
      id: 'lkpd-legacy-utama',
      judul: 'LKPD Utama (Versi Lama)',
      tujuan: '',
      petunjuk: '',
      materi: '',
      langkahKerja: lkpdUmum,
      pertanyaan: [],
      tugas: '',
      penilaian: '',
    });
  }

  const mediaList = [teks(raw.media)].filter(
    (item) => item.trim() !== ''
  );

  const sumberBelajarList: SumberBelajar[] = [
    teks(raw.sumberBelajar),
  ]
    .filter((item) => item.trim() !== '')
    .map((item, index) => ({
      id: buatId('sumber', index),
      nama: item,
      jenis: 'Lainnya',
      keterangan: '',
      url: '',
    }));

  const pengayaanRemedial: PengayaanRemedial = {
    pengayaan: '',
    remedial: '',
    pendampingan: '',
    tindakLanjut: teks(raw.tindakLanjut),
  };

  const refleksi: RefleksiPembelajaran = {
    refleksiGuru: teks(raw.refleksiGuru),
    refleksiPesertaDidik: '',
    kendala: '',
    rencanaPerbaikan: '',
  };

  const asesmenList: Asesmen[] = [];

  if (teks(raw.asesmenAwal).trim()) {
    asesmenList.push({
      id: 'asesmen-awal',
      judul: 'Asesmen Awal',
      jenis: 'Diagnostik',
      tujuan: '',
      teknik: '',
      instrumen: teks(raw.asesmenAwal),
      waktuPelaksanaan: '',
      butirSoalList: [],
      kriteriaPenilaian: '',
      tindakLanjut: '',
    });
  }

  if (teks(raw.asesmenProses).trim()) {
    asesmenList.push({
      id: 'asesmen-proses',
      judul: 'Asesmen Proses',
      jenis: 'Formatif',
      tujuan: '',
      teknik: '',
      instrumen: teks(raw.asesmenProses),
      waktuPelaksanaan: '',
      butirSoalList: [],
      kriteriaPenilaian: '',
      tindakLanjut: '',
    });
  }

  if (teks(raw.asesmenAkhir).trim()) {
    asesmenList.push({
      id: 'asesmen-akhir',
      judul: 'Asesmen Akhir',
      jenis: 'Sumatif',
      tujuan: '',
      teknik: '',
      instrumen: teks(raw.asesmenAkhir),
      waktuPelaksanaan: '',
      butirSoalList: [],
      kriteriaPenilaian: '',
      tindakLanjut: '',
    });
  }

  // Soal dan kunci jawaban lama dimasukkan sebagai satu butir utuh.
  const soalLama = teks(raw.soalTesTertulis);
  const kunciLama = teks(raw.kunciJawaban);

  if (soalLama.trim() || kunciLama.trim()) {
    let asesmenSumatif = asesmenList.find(
      (item) => item.jenis === 'Sumatif'
    );

    if (!asesmenSumatif) {
      asesmenSumatif = {
        id: 'asesmen-sumatif-legacy',
        judul: 'Tes Tertulis (Versi Lama)',
        jenis: 'Sumatif',
        tujuan: '',
        teknik: 'Tes tertulis',
        instrumen: '',
        waktuPelaksanaan: '',
        butirSoalList: [],
        kriteriaPenilaian: '',
        tindakLanjut: '',
      };

      asesmenList.push(asesmenSumatif);
    }

    const butirSoal: ButirSoal = {
      id: 'soal-legacy-1',
      pertanyaan: soalLama,
      jenisSoal: 'Format asli versi lama',
      pilihanJawaban: [],
      kunciJawaban: kunciLama,
      skor: 0,
    };

    asesmenSumatif.butirSoalList.push(butirSoal);
  }

  const rubrikList: Rubrik[] = [
    konversiRubrikLama(
      'Rubrik Keterampilan (Versi Lama)',
      teks(raw.rubrikKeterampilan),
      'rubrik-keterampilan-legacy'
    ),
    konversiRubrikLama(
      'Rubrik Sikap (Versi Lama)',
      teks(raw.rubrikSikap),
      'rubrik-sikap-legacy'
    ),
  ].filter((item): item is Rubrik => item !== null);

  const lampiranList: Lampiran[] = [
    buatLampiranTeks(
      'bahan-ajar-legacy',
      'Bahan Ajar (Versi Lama)',
      teks(raw.bahanAjar)
    ),
    buatLampiranTeks(
      'glosarium-legacy',
      'Glosarium (Versi Lama)',
      teks(raw.glosarium)
    ),
    buatLampiranTeks(
      'daftar-pustaka-legacy',
      'Daftar Pustaka (Versi Lama)',
      teks(raw.daftarPustaka)
    ),
    buatLampiranTeks(
      'instrumen-legacy',
      'Instrumen Penilaian (Versi Lama)',
      teks(raw.instrumen)
    ),
  ].filter((item): item is Lampiran => item !== null);

  const pengesahan: PengesahanModul = {
    tempat: '',
    tanggal: '',
    namaKepalaSekolah: '',
    nipKepalaSekolah: '',
    namaPenyusun: teks(raw.namaPenyusun, teks(raw.namaGuru)),
    nipPenyusun: teks(raw.nipPenyusun),
  };

  return {
    ...hasil,

    id: raw.id,
    versiStruktur: 2,

    identitas,
    identifikasiPesertaDidik,
    desainPembelajaran,
    kerangkaPembelajaranMendalam,

    langkahPembelajaran,

    pertemuanList: pertemuanBaru,
    asesmenList,
    rubrikList,

    pengayaanRemedial,

    mediaList,
    sumberBelajarList,

    lkpdList,
    lampiranList,

    refleksi,
    pengesahan,

    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,

    // Salinan utuh seluruh data lama.
    legacyData: { ...raw },
  };
}

export function adaptModulAjarToV2(
  raw: ModulAjarLegacy | ModulAjarV2
): ModulAjarV2 {
  if (
    'versiStruktur' in raw &&
    raw.versiStruktur === 2 &&
    'identitas' in raw
  ) {
    return raw as ModulAjarV2;
  }

  return adaptModulAjarLegacyToV2(raw as ModulAjarLegacy);
}
