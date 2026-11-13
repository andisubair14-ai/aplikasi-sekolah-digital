
import { describe, it, expect } from 'vitest';

import {
  adaptModulAjarLegacyToV2,
} from './modulAjarAdapter';

import type {
  ModulAjarLegacy,
} from '../types/modulAjar';

describe('Modul Ajar Legacy Adapter', () => {
  const dataLama: ModulAjarLegacy = {
    id: 'modul-001',
    userId: 'user-001',
    guruId: 'guru-001',
    namaGuru: 'Guru Penguji',

    judulModul: 'Menjelajahi Kegiatan Ekonomi',
    jenjang: 'SD',
    kelas: '5',
    fase: 'C',
    semester: 'Ganjil',
    tahunAjaran: '2026/2027',
    mataPelajaran: 'IPAS',
    topik: 'Kegiatan Ekonomi',
    alokasiWaktu: '2 x 35 menit',

    cp: 'Peserta didik memahami kegiatan ekonomi.',
    tp: 'Mengidentifikasi kegiatan ekonomi.',
    kesiapanMurid: 'Peserta didik memiliki pengetahuan awal.',
    karakteristikMateri: 'Materi kontekstual.',
    dimensiProfil: ['Bernalar Kritis', 'Gotong Royong'],

    kegiatanAwal: 'Guru membuka pembelajaran.',
    memahami: 'Peserta didik mengamati materi.',
    mengaplikasi: 'Peserta didik mengerjakan tugas.',
    merefleksi: 'Peserta didik melakukan refleksi.',
    kegiatanPenutup: 'Guru menutup pembelajaran.',

    asesmenAwal: 'Pertanyaan diagnostik.',
    asesmenProses: 'Observasi diskusi.',
    asesmenAkhir: 'Tes tertulis.',
    instrumen: 'Lembar penilaian.',
    tindakLanjut: 'Pendampingan peserta didik.',

    bahanAjar: 'Bahan bacaan kegiatan ekonomi.',
    lkpd: 'LKPD utama versi lama.',
    lkpd1: 'LKPD pertama.',
    lkpd2: 'LKPD kedua.',
    media: 'Gambar kegiatan ekonomi.',
    sumberBelajar: 'Buku IPAS kelas V.',

    namaPenyusun: 'Guru Penguji',
    nipPenyusun: '123456',
    jumlahSiswa: '28',
    pertanyaanPemantik: 'Apa kegiatan ekonomi di daerahmu?',

    pertemuanList: [
      {
        id: 'pertemuan-1',
        judul: 'Pertemuan Pertama',
        indikator: 'Mengenali kegiatan ekonomi.',
        kegiatanAwal: 'Apersepsi.',
        kegiatanInti: 'Mengamati gambar kegiatan ekonomi.',
        kegiatanPenutup: 'Kesimpulan.',
      },
    ],

    soalTesTertulis: 'Sebutkan tiga kegiatan ekonomi.',
    kunciJawaban: 'Produksi, distribusi, konsumsi.',
    rubrikKeterampilan: 'Rubrik keterampilan lama.',
    rubrikSikap: 'Rubrik sikap lama.',

    lkpd3: 'LKPD ketiga.',
    lkpd4: 'LKPD keempat.',
    glosarium: 'Produksi: kegiatan menghasilkan barang.',
    daftarPustaka: 'Buku IPAS kelas V.',
    refleksiGuru: 'Pembelajaran berjalan baik.',
  };

  it('mempertahankan identitas dan informasi utama', () => {
    const hasil = adaptModulAjarLegacyToV2(dataLama);

    expect(hasil.versiStruktur).toBe(2);
    expect(hasil.id).toBe('modul-001');
    expect(hasil.userId).toBe('user-001');
    expect(hasil.identitas.judulModul).toBe(
      'Menjelajahi Kegiatan Ekonomi'
    );
    expect(hasil.identitas.jenjang).toBe('SD');
    expect(hasil.desainPembelajaran.cp).toBe(
      dataLama.cp
    );
    expect(hasil.desainPembelajaran.tp).toBe(
      dataLama.tp
    );
  });

  it('mempertahankan langkah pembelajaran', () => {
    const hasil = adaptModulAjarLegacyToV2(dataLama);

    expect(hasil.langkahPembelajaran.kegiatanAwal).toBe(
      dataLama.kegiatanAwal
    );
    expect(hasil.langkahPembelajaran.memahami).toBe(
      dataLama.memahami
    );
    expect(hasil.langkahPembelajaran.mengaplikasi).toBe(
      dataLama.mengaplikasi
    );
    expect(hasil.langkahPembelajaran.merefleksi).toBe(
      dataLama.merefleksi
    );
    expect(hasil.langkahPembelajaran.kegiatanPenutup).toBe(
      dataLama.kegiatanPenutup
    );
  });

  it('mengonversi daftar pertemuan lama', () => {
    const hasil = adaptModulAjarLegacyToV2(dataLama);

    expect(hasil.pertemuanList).toHaveLength(1);
    expect(hasil.pertemuanList[0].judul).toBe(
      'Pertemuan Pertama'
    );
    expect(hasil.pertemuanList[0].indikator).toBe(
      'Mengenali kegiatan ekonomi.'
    );

    // Isi kegiatan inti lama tetap tersedia di salinan data lama.
    expect(
      hasil.legacyData?.pertemuanList
    ).toEqual(dataLama.pertemuanList);
  });

  it('memetakan asesmen dan LKPD yang didukung adapter', () => {
    const hasil = adaptModulAjarLegacyToV2(dataLama);

    expect(hasil.asesmenList).toHaveLength(3);
    expect(hasil.asesmenList[0].jenis).toBe('Diagnostik');
    expect(hasil.asesmenList[1].jenis).toBe('Formatif');
    expect(hasil.asesmenList[2].jenis).toBe('Sumatif');

    expect(hasil.lkpdList).toHaveLength(5);
    expect(hasil.lkpdList[0].langkahKerja).toBe(
      'LKPD pertama.'
    );
  });

  it('mempertahankan seluruh field lama di legacyData', () => {
    const hasil = adaptModulAjarLegacyToV2(dataLama);

    expect(hasil.legacyData).toEqual(dataLama);

    expect(hasil.legacyData?.soalTesTertulis).toBe(
      dataLama.soalTesTertulis
    );
    expect(hasil.legacyData?.kunciJawaban).toBe(
      dataLama.kunciJawaban
    );
    expect(hasil.legacyData?.rubrikKeterampilan).toBe(
      dataLama.rubrikKeterampilan
    );
    expect(hasil.legacyData?.rubrikSikap).toBe(
      dataLama.rubrikSikap
    );
    expect(hasil.legacyData?.lkpd).toBe(dataLama.lkpd);
    expect(hasil.legacyData?.bahanAjar).toBe(
      dataLama.bahanAjar
    );
    expect(hasil.legacyData?.glosarium).toBe(
      dataLama.glosarium
    );
  });

  it('tidak mengubah objek data lama saat konversi', () => {
    const salinanSebelum = JSON.stringify(dataLama);

    adaptModulAjarLegacyToV2(dataLama);

    const salinanSesudah = JSON.stringify(dataLama);

    expect(salinanSesudah).toBe(salinanSebelum);
  });
});
