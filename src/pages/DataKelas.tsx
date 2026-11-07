
import { useState, useEffect, useRef, useMemo, type ChangeEvent, type FormEvent } from 'react';
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type WriteBatch
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

// ==========================================
// TIPE DATA
// ==========================================

interface Guru {
  id: string;
  nama: string;
  jabatan: string;
}

interface Kelas {
  id: string;
  namaKelas: string;
  jenjang: string;
  tingkat: number | string;
  waliKelas: string;
  waliKelasId?: string | null;
  tahunAjaran: string;
  urutanRombel?: number;
}

// ==========================================
// KONVERSI TINGKAT ANGKA KE ROMAWI
// ==========================================

const toRoman = (nilai: number | string): string => {
  const angka = parseInt(String(nilai), 10);

  const romawi: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
    6: 'VI',
    7: 'VII',
    8: 'VIII',
    9: 'IX'
  };

  return romawi[angka] || String(nilai);
};

// ==========================================
// KONVERSI ANGKA ATAU ROMAWI KE ANGKA
// ==========================================

const parseTingkat = (nilai: any): number => {
  const teks = String(nilai || '')
    .trim()
    .toUpperCase()
    .replace(/^TINGKAT\s*/, '');

  const daftarRomawi: Record<string, number> = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9
  };

  if (daftarRomawi[teks]) {
    return daftarRomawi[teks];
  }

  return parseInt(teks, 10);
};

// ==========================================
// NOMOR URUT ROMBEL MENJADI HURUF
// 0 = A, 1 = B, 25 = Z, 26 = AA
// ==========================================

const indexKeHuruf = (index: number): string => {
  let angka = index + 1;
  let hasil = '';

  while (angka > 0) {
    const sisa = (angka - 1) % 26;

    hasil = String.fromCharCode(65 + sisa) + hasil;
    angka = Math.floor((angka - 1) / 26);
  }

  return hasil;
};

// ==========================================
// MEMBUAT NAMA ROMBEL OTOMATIS
// ==========================================

const buatNamaRombel = (
  tingkat: number,
  jumlahRombel: number,
  index: number
): string => {
  if (jumlahRombel === 1) {
    return String(tingkat);
  }

  return `${tingkat}${indexKeHuruf(index)}`;
};

// ==========================================
// KUNCI KELOMPOK ROMBEL
// Jenjang + Tingkat + Tahun Ajaran
// ==========================================

const buatKunciKelompok = (kelas: any): string => {
  return [
    String(kelas.jenjang || '').toUpperCase(),
    String(parseTingkat(kelas.tingkat)),
    String(kelas.tahunAjaran || '')
  ].join('|');
};

// ==========================================
// MENJALANKAN OPERASI FIRESTORE BERTAHAP
// ==========================================

const jalankanOperasiBatch = async (
  operasi: Array<(batch: WriteBatch) => void>
) => {
  const ukuranBatch = 400;

  for (let i = 0; i < operasi.length; i += ukuranBatch) {
    const batch = writeBatch(db);

    operasi
      .slice(i, i + ukuranBatch)
      .forEach((fungsi) => fungsi(batch));

    await batch.commit();
  }
};

// ==========================================
// KOMPONEN UTAMA
// ==========================================

export default function DataKelas() {
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([]);
  const [jenjangSekolah, setJenjangSekolah] = useState<string[]>([]);
  const [konfigurasiError, setKonfigurasiError] = useState('');

  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isNormalisasi, setIsNormalisasi] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ==========================================
  // STATE FORM
  // ==========================================

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [jenjang, setJenjang] = useState('SD');
  const [tingkat, setTingkat] = useState('1');
  const [waliKelasId, setWaliKelasId] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');

  // Pencarian
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // MENGAMBIL DATA FIRESTORE
  // ==========================================

  useEffect(() => {
    let kelasReady = false;
    let guruReady = false;
    let tahunReady = false;
    let konfigurasiReady = false;

    const periksaLoading = () => {
      if (kelasReady && guruReady && tahunReady && konfigurasiReady) {
        setLoading(false);
      }
    };

    const unsubKelas = onSnapshot(
      collection(db, 'kelas'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        })) as Kelas[];

        setKelasList(data);
        kelasReady = true;
        periksaLoading();
      },
      (error) => {
        console.error('Gagal mengambil data kelas:', error);
        alert('Gagal mengambil data kelas dari Firebase.');

        kelasReady = true;
        periksaLoading();
      }
    );

    const unsubGuru = onSnapshot(
      collection(db, 'guru'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        })) as Guru[];

        setGuruList(data);
        guruReady = true;
        periksaLoading();
      },
      (error) => {
        console.error('Gagal mengambil data guru:', error);

        guruReady = true;
        periksaLoading();
      }
    );

    const unsubTahun = onSnapshot(
      collection(db, 'tahun_ajaran'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setTahunAjaranList(data);
        tahunReady = true;
        periksaLoading();
      },
      (error) => {
        console.error('Gagal mengambil tahun ajaran:', error);

        tahunReady = true;
        periksaLoading();
      }
    );

    // Membaca konfigurasi jenjang yang sama dengan menu Pengaturan.
    // Field jenjangSekolah berbentuk array: ['SD'], ['SMP'], atau ['SD', 'SMP'].
    const unsubPengaturan = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        const daftarJenjang = Array.isArray(data.jenjangSekolah)
          ? ['SD', 'SMP'].filter((item) => data.jenjangSekolah.includes(item))
          : [];

        setJenjangSekolah(daftarJenjang);
        setKonfigurasiError('');

        if (daftarJenjang.length > 0) {
          const jenjangDefault = daftarJenjang[0];
          setJenjang(jenjangDefault);
          setTingkat(jenjangDefault === 'SD' ? '1' : '7');
        }

        konfigurasiReady = true;
        periksaLoading();
      },
      (error) => {
        console.error('Gagal membaca konfigurasi jenjang sekolah:', error);
        setKonfigurasiError('Konfigurasi jenjang sekolah tidak dapat dibaca dari Firebase.');
        setJenjangSekolah([]);
        konfigurasiReady = true;
        periksaLoading();
      }
    );

    return () => {
      unsubKelas();
      unsubGuru();
      unsubTahun();
      unsubPengaturan();
    };
  }, []);

  // ==========================================
  // TAHUN AJARAN AKTIF
  // ==========================================

  const tahunAktif = tahunAjaranList.find(
    (item) => item.status === 'Aktif'
  );

  const jenjangTersedia = ['SD', 'SMP'].filter((item) =>
    jenjangSekolah.includes(item)
  );

  const labelJenjangSekolah = jenjangTersedia.length === 2
    ? 'SD dan SMP (Gabungan)'
    : jenjangTersedia[0] || 'Belum dikonfigurasi';

  // ==========================================
  // GURU YANG DAPAT MENJADI WALI KELAS
  // ==========================================

  const guruBisaMenjadiWali = guruList.filter(
    (guru) =>
      guru.jabatan !== 'Tenaga Kependidikan' &&
      guru.nama
  );

  // ==========================================
  // PENGURUTAN DATA ROMBEL
  // ==========================================

  const kelasTampil = useMemo(() => {
    return [...kelasList]
      .filter((kelas) => {
        const jenjangKelas = String(kelas.jenjang || '').toUpperCase();
        if (!jenjangSekolah.includes(jenjangKelas)) return false;

        const cocokNama =
          kelas.namaKelas?.toLowerCase().includes(
            searchTerm.toLowerCase()
          );

        const cocokWali =
          kelas.waliKelas?.toLowerCase().includes(
            searchTerm.toLowerCase()
          );

        const cocokTahun =
          kelas.tahunAjaran?.toLowerCase().includes(
            searchTerm.toLowerCase()
          );

        return cocokNama || cocokWali || cocokTahun;
      })
      .sort((a, b) => {
        if (a.tahunAjaran !== b.tahunAjaran) {
          return (b.tahunAjaran || '').localeCompare(
            a.tahunAjaran || ''
          );
        }

        if (a.jenjang !== b.jenjang) {
          return a.jenjang === 'SD' ? -1 : 1;
        }

        const tingkatA = parseTingkat(a.tingkat);
        const tingkatB = parseTingkat(b.tingkat);

        if (tingkatA !== tingkatB) {
          return tingkatA - tingkatB;
        }

        return (a.namaKelas || '').localeCompare(
          b.namaKelas || '',
          'id',
          { numeric: true }
        );
      });
  }, [kelasList, searchTerm, jenjangSekolah]);

  // ==========================================
  // MENCARI NAMA GURU
  // ==========================================

  const getNamaGuru = (id: string | null | undefined) => {
    if (!id) return '-';

    const guru = guruList.find((item) => item.id === id);

    return guru?.nama || 'Guru tidak ditemukan';
  };

  // ==========================================
  // MENCARI PREVIEW NAMA ROMBEL
  // ==========================================

  const previewNamaRombel = useMemo(() => {
    const nomorTingkat = parseInt(tingkat, 10);

    if (!tahunAjaran || !nomorTingkat) {
      return '-';
    }

    const kelompok = kelasList.filter((item) => {
      const cocokKelompok =
        item.jenjang === jenjang &&
        parseTingkat(item.tingkat) === nomorTingkat &&
        item.tahunAjaran === tahunAjaran;

      return cocokKelompok && item.id !== editId;
    });

    const dataEdit = editId
      ? kelasList.find((item) => item.id === editId)
      : null;

    const kunciLama = dataEdit
      ? buatKunciKelompok(dataEdit)
      : '';

    const kunciBaru = buatKunciKelompok({
      jenjang,
      tingkat: nomorTingkat,
      tahunAjaran
    });

    if (
      dataEdit &&
      kunciLama === kunciBaru &&
      dataEdit.urutanRombel
    ) {
      const seluruhnya = [
        ...kelompok,
        dataEdit
      ].sort(
        (a, b) =>
          (a.urutanRombel || 9999) -
          (b.urutanRombel || 9999)
      );

      const jumlah = seluruhnya.length;
      const index = seluruhnya.findIndex(
        (item) => item.id === editId
      );

      return buatNamaRombel(
        nomorTingkat,
        jumlah,
        Math.max(index, 0)
      );
    }

    const jumlahSetelahSimpan = kelompok.length + 1;

    return buatNamaRombel(
      nomorTingkat,
      jumlahSetelahSimpan,
      kelompok.length
    );
  }, [
    jenjang,
    tingkat,
    tahunAjaran,
    kelasList,
    editId
  ]);

  // ==========================================
  // MENCARI KELAS BERDASARKAN KELOMPOK
  // ==========================================

  const kelompokKelas = (
    daftar: any[],
    kunci: string
  ) => {
    return daftar.filter(
      (item) => buatKunciKelompok(item) === kunci
    );
  };

  // ==========================================
  // PENATAAN ULANG NAMA ROMBEL
  // MEMPERTAHANKAN ID DOKUMEN
  // ==========================================

  const normalisasiSemuaRombel = async (
    tampilkanPesan = true
  ) => {
    if (isNormalisasi) return;

    if (jenjangTersedia.length === 0) {
      alert('Konfigurasi jenjang sekolah belum dipilih. Buka menu Pengaturan terlebih dahulu.');
      return;
    }

    setIsNormalisasi(true);

    try {
      const snapshot = await getDocs(collection(db, 'kelas'));

      const daftarKelas: any[] = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      const kelompokMap = new Map<string, any[]>();

      daftarKelas.forEach((item) => {
        const nomorTingkat = parseTingkat(item.tingkat);

        if (
          !jenjangSekolah.includes(String(item.jenjang || '').toUpperCase()) ||
          !nomorTingkat ||
          nomorTingkat < 1 ||
          nomorTingkat > 9 ||
          !item.tahunAjaran
        ) {
          return;
        }

        const dataBersih = {
          ...item,
          jenjang: String(item.jenjang).toUpperCase(),
          tingkat: nomorTingkat,
          tahunAjaran: String(item.tahunAjaran).trim()
        };

        const kunci = buatKunciKelompok(dataBersih);

        if (!kelompokMap.has(kunci)) {
          kelompokMap.set(kunci, []);
        }

        kelompokMap.get(kunci)!.push(dataBersih);
      });

      const operasi: Array<(batch: WriteBatch) => void> = [];

      let jumlahRombel = 0;
      let jumlahNamaBerubah = 0;

      for (const daftarKelompok of kelompokMap.values()) {
        const daftarUrut = [...daftarKelompok].sort((a, b) => {
          const urutanA = Number(a.urutanRombel || 0);
          const urutanB = Number(b.urutanRombel || 0);

          if (urutanA && urutanB && urutanA !== urutanB) {
            return urutanA - urutanB;
          }

          if (urutanA && !urutanB) return -1;
          if (!urutanA && urutanB) return 1;

          return String(a.namaKelas || '').localeCompare(
            String(b.namaKelas || ''),
            'id',
            { numeric: true }
          );
        });

        const jumlah = daftarUrut.length;

        for (let index = 0; index < jumlah; index++) {
          const item = daftarUrut[index];

          const namaBaru = buatNamaRombel(
            Number(item.tingkat),
            jumlah,
            index
          );

          let waliId = item.waliKelasId || null;
          let namaWali = item.waliKelas || '-';

          // Jika data lama hanya memiliki nama wali kelas,
          // cari ID guru apabila namanya ditemukan secara unik.
          if (!waliId && namaWali !== '-') {
            const guruCocok = guruList.filter(
              (guru) => guru.nama === namaWali
            );

            if (guruCocok.length === 1) {
              waliId = guruCocok[0].id;
            }
          }

          if (waliId) {
            namaWali = getNamaGuru(waliId);
          }

          const dataBaru = {
            namaKelas: namaBaru,
            jenjang: item.jenjang,
            tingkat: Number(item.tingkat),
            tahunAjaran: item.tahunAjaran,
            urutanRombel: index + 1,
            waliKelasId: waliId,
            waliKelas: namaWali
          };

          const namaLama = String(item.namaKelas || '');

          if (namaLama !== namaBaru) {
            jumlahNamaBerubah++;
          }

          jumlahRombel++;

          const refKelas = doc(db, 'kelas', item.id);

          operasi.push((batch) => {
            batch.set(refKelas, dataBaru, { merge: true });
          });

          // Perbarui nama kelas pada dokumen siswa yang sudah
          // memiliki kelasId. ID siswa tidak berubah.
          if (namaLama !== namaBaru) {
            const [siswaSnap, ringkasSnap] = await Promise.all([
              getDocs(
                query(
                  collection(db, 'siswa'),
                  where('kelasId', '==', item.id)
                )
              ),
              getDocs(
                query(
                  collection(db, 'siswa_ringkas'),
                  where('kelasId', '==', item.id)
                )
              )
            ]);

            siswaSnap.docs.forEach((siswaDoc) => {
              operasi.push((batch) => {
                batch.update(siswaDoc.ref, {
                  kelas: namaBaru
                });
              });
            });

            ringkasSnap.docs.forEach((siswaDoc) => {
              operasi.push((batch) => {
                batch.update(siswaDoc.ref, {
                  kelas: namaBaru
                });
              });
            });
          }
        }
      }

      if (jumlahRombel === 0) {
        alert('Tidak ada data rombel yang dapat ditata ulang.');
        return;
      }

      await jalankanOperasiBatch(operasi);

      if (tampilkanPesan) {
        alert(
          `Penataan ulang selesai.\n\n` +
          `Jumlah rombel diperiksa: ${jumlahRombel}\n` +
          `Nama rombel diperbarui: ${jumlahNamaBerubah}\n\n` +
          `ID dokumen rombel tetap dipertahankan.`
        );
      }

    } catch (error) {
      console.error('Gagal menata ulang rombel:', error);

      alert(
        'Gagal menata ulang rombel. Periksa koneksi dan hak akses Firebase. Jika proses terhenti, periksa kembali data sebelum mencoba lagi.'
      );

    } finally {
      setIsNormalisasi(false);
    }
  };

  // ==========================================
  // DOWNLOAD TEMPLATE EXCEL
  // ==========================================

  const handleDownloadTemplate = () => {
    if (jenjangTersedia.length === 0) {
      alert('Konfigurasi jenjang sekolah belum dipilih. Buka menu Pengaturan terlebih dahulu.');
      return;
    }

    // Dua baris contoh per jenjang agar pola beberapa rombel terlihat.
    // Jika hanya satu baris yang dipakai, nama rombel tetap menjadi angka tunggal.
    const formatData = jenjangTersedia.flatMap((jenjangAktif) => {
      const tingkatContoh = jenjangAktif === 'SD' ? '1' : '7';

      return [
        {
          'Jenjang': jenjangAktif,
          'Tingkat': tingkatContoh,
          'Wali Kelas': '',
          'Tahun Ajaran': tahunAktif?.tahun || ''
        },
        {
          'Jenjang': jenjangAktif,
          'Tingkat': tingkatContoh,
          'Wali Kelas': '',
          'Tahun Ajaran': tahunAktif?.tahun || ''
        }
      ];
    });

    const worksheet = XLSX.utils.json_to_sheet(formatData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Format Rombel'
    );

    XLSX.writeFile(
      workbook,
      'Format_Upload_Rombel.xlsx'
    );
  };

  // ==========================================
  // DOWNLOAD DATA ROMBEL
  // ==========================================

  const handleDownloadData = () => {
    if (kelasTampil.length === 0) {
      alert('Tidak ada data untuk diunduh.');
      return;
    }

    const dataToExport = kelasTampil.map((item) => ({
      'Tahun Ajaran': item.tahunAjaran,
      'Jenjang': item.jenjang,
      'Tingkat': toRoman(item.tingkat),
      'Nama Rombel': item.namaKelas,
      'Urutan Rombel': item.urutanRombel || '-',
      'Wali Kelas': item.waliKelas || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Data Rombel'
    );

    XLSX.writeFile(
      workbook,
      'Data_Rombel_Sekolah.xlsx'
    );
  };

  // ==========================================
  // UPLOAD ROMBEL DARI EXCEL
  // ==========================================

  const handleFileUpload = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (jenjangTersedia.length === 0) {
      alert('Konfigurasi jenjang sekolah belum dipilih. Buka menu Pengaturan terlebih dahulu.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(
          event.target?.result as ArrayBuffer
        );

        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          throw new Error('File Excel kosong.');
        }

        // Validasi seluruh baris sebelum menyimpan.
        const dataSiapSimpan = jsonData.map((row, index) => {
          const tingkatAngka = parseTingkat(row['Tingkat']);

          const jenjangExcel = String(
            row['Jenjang'] || ''
          ).trim().toUpperCase();

          const tahunExcel = String(
            row['Tahun Ajaran'] || ''
          ).trim();

          if (!['SD', 'SMP'].includes(jenjangExcel)) {
            throw new Error(
              `Jenjang pada baris ${index + 2} harus SD atau SMP.`
            );
          }

          if (!jenjangSekolah.includes(jenjangExcel)) {
            throw new Error(
              `Jenjang ${jenjangExcel} pada baris ${index + 2} tidak termasuk konfigurasi sekolah saat ini (${labelJenjangSekolah}). Periksa Pengaturan Sekolah atau file Excel.`
            );
          }

          const batasTingkat =
            jenjangExcel === 'SD'
              ? [1, 6]
              : [7, 9];

          if (
            !tingkatAngka ||
            tingkatAngka < batasTingkat[0] ||
            tingkatAngka > batasTingkat[1]
          ) {
            throw new Error(
              `Tingkat pada baris ${index + 2} tidak sesuai dengan jenjang ${jenjangExcel}.`
            );
          }

          if (
            !tahunAjaranList.some(
              (item) => item.tahun === tahunExcel
            )
          ) {
            throw new Error(
              `Tahun ajaran "${tahunExcel}" pada baris ${index + 2} tidak ditemukan.`
            );
          }

          const namaWaliExcel = String(
            row['Wali Kelas'] || ''
          ).trim();

          let waliId: string | null = null;

          if (namaWaliExcel) {
            const guruCocok = guruList.filter(
              (guru) => guru.nama === namaWaliExcel
            );

            if (guruCocok.length > 1) {
              throw new Error(
                `Nama guru "${namaWaliExcel}" ditemukan lebih dari satu. Periksa data pegawai.`
              );
            }

            if (guruCocok.length === 1) {
              waliId = guruCocok[0].id;
            }
          }

          return {
            jenjang: jenjangExcel,
            tingkat: tingkatAngka,
            tahunAjaran: tahunExcel,
            waliKelasId: waliId,
            waliKelas: namaWaliExcel || '-',
            namaKelas: '',
            urutanRombel: 0
          };
        });

        const kelasRef = collection(db, 'kelas');
        const batch = writeBatch(db);

        dataSiapSimpan.forEach((item) => {
          const refBaru = doc(kelasRef);

          batch.set(refBaru, item);
        });

        await batch.commit();

        // Setelah data masuk, rapikan nama semua kelompok.
        await normalisasiSemuaRombel(false);

        alert(
          `Berhasil mengimpor ${dataSiapSimpan.length} data rombel.\nNama rombel sudah disusun otomatis.`
        );

      } catch (error) {
        console.error('Gagal mengimpor rombel:', error);

        const pesan =
          error instanceof Error
            ? error.message
            : 'Periksa kembali format file Excel.';

        alert('Gagal mengimpor: ' + pesan);

      } finally {
        setIsUploading(false);

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setIsUploading(false);

      alert('File Excel tidak dapat dibaca.');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // ==========================================
  // FORM TAMBAH ROMBEL
  // ==========================================

  const handleOpenTambah = () => {
    if (jenjangTersedia.length === 0) {
      alert('Konfigurasi jenjang sekolah belum dipilih. Buka menu Pengaturan terlebih dahulu.');
      return;
    }

    const jenjangDefault = jenjangTersedia[0];

    setEditId(null);
    setJenjang(jenjangDefault);
    setTingkat(jenjangDefault === 'SD' ? '1' : '7');
    setWaliKelasId('');

    setTahunAjaran(
      tahunAktif?.tahun || ''
    );

    setIsModalOpen(true);
  };

  // ==========================================
  // FORM EDIT ROMBEL
  // ==========================================

  const handleOpenEdit = (kelas: Kelas) => {
    const jenjangKelas = String(kelas.jenjang || '').toUpperCase();

    if (!jenjangSekolah.includes(jenjangKelas)) {
      alert('Rombel ini tidak termasuk jenjang yang diaktifkan pada Pengaturan Sekolah.');
      return;
    }

    setEditId(kelas.id);
    setJenjang(jenjangKelas);

    setTingkat(
      String(parseTingkat(kelas.tingkat))
    );

    setTahunAjaran(kelas.tahunAjaran || '');

    // Gunakan ID jika tersedia.
    if (kelas.waliKelasId) {
      setWaliKelasId(kelas.waliKelasId);
    } else {
      // Migrasi ringan: cari ID dari nama wali lama
      // hanya apabila nama guru ditemukan secara unik.
      const hasil = guruList.filter(
        (guru) => guru.nama === kelas.waliKelas
      );

      setWaliKelasId(
        hasil.length === 1 ? hasil[0].id : ''
      );
    }

    setIsModalOpen(true);
  };

  // ==========================================
  // SIMPAN TAMBAH / EDIT ROMBEL
  // ==========================================

  const handleSimpanKelas = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (jenjangTersedia.length === 0) {
      alert('Konfigurasi jenjang sekolah belum dipilih. Buka menu Pengaturan terlebih dahulu.');
      return;
    }

    if (!jenjangSekolah.includes(jenjang)) {
      alert('Jenjang yang dipilih tidak sesuai dengan konfigurasi sekolah.');
      return;
    }

    if (!tahunAjaran) {
      alert('Silakan pilih Tahun Ajaran terlebih dahulu.');
      return;
    }

    const tingkatAngka = parseInt(tingkat, 10);

    if (
      jenjang === 'SD' &&
      (tingkatAngka < 1 || tingkatAngka > 6)
    ) {
      alert('Tingkat SD hanya boleh I sampai VI.');
      return;
    }

    if (
      jenjang === 'SMP' &&
      (tingkatAngka < 7 || tingkatAngka > 9)
    ) {
      alert('Tingkat SMP hanya boleh VII sampai IX.');
      return;
    }

    const tahunValid = tahunAjaranList.some(
      (item) => item.tahun === tahunAjaran
    );

    if (!tahunValid) {
      alert('Tahun ajaran yang dipilih tidak ditemukan.');
      return;
    }

    const waliTerpilih = waliKelasId
      ? guruList.find((item) => item.id === waliKelasId)
      : null;

    if (waliKelasId && !waliTerpilih) {
      alert('Data Wali Kelas tidak ditemukan. Silakan pilih kembali.');
      return;
    }

    setIsSaving(true);

    try {
      // Ambil data terbaru langsung dari Firebase.
      const snapshot = await getDocs(collection(db, 'kelas'));

      const daftarLama = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      })) as any[];

      let idTarget = editId;

      if (!idTarget) {
        idTarget = doc(collection(db, 'kelas')).id;
      }

      const dataTarget = {
        jenjang,
        tingkat: tingkatAngka,
        tahunAjaran,
        waliKelasId: waliTerpilih?.id || null,
        waliKelas: waliTerpilih?.nama || '-'
      };

      const daftarBaru = daftarLama.filter(
        (item) => item.id !== idTarget
      );

      const targetLama = daftarLama.find(
        (item) => item.id === idTarget
      );

      daftarBaru.push({
        ...(targetLama || {}),
        id: idTarget,
        ...dataTarget
      });

      const kunciBaru = buatKunciKelompok(dataTarget);

      const kunciLama = targetLama
        ? buatKunciKelompok(targetLama)
        : null;

      const kunciYangDirapikan = new Set<string>([
        kunciBaru
      ]);

      if (kunciLama) {
        kunciYangDirapikan.add(kunciLama);
      }

      const operasi: Array<(batch: WriteBatch) => void> = [];

      // Pastikan dokumen target memiliki ID yang sama
      // apabila sedang melakukan edit.
      if (!editId) {
        const refBaru = doc(db, 'kelas', idTarget);

        operasi.push((batch) => {
          batch.set(refBaru, {
            ...dataTarget,
            namaKelas: '',
            urutanRombel: 0
          });
        });
      }

      for (const kunci of kunciYangDirapikan) {
        const anggota = kelompokKelas(daftarBaru, kunci);

        const anggotaUrut = [...anggota].sort((a, b) => {
          if (a.id === idTarget) return 1;
          if (b.id === idTarget) return -1;

          const urutanA = Number(a.urutanRombel || 0);
          const urutanB = Number(b.urutanRombel || 0);

          if (urutanA && urutanB && urutanA !== urutanB) {
            return urutanA - urutanB;
          }

          if (urutanA && !urutanB) return -1;
          if (!urutanA && urutanB) return 1;

          return String(a.namaKelas || '').localeCompare(
            String(b.namaKelas || ''),
            'id',
            { numeric: true }
          );
        });

        const jumlah = anggotaUrut.length;

        for (let index = 0; index < jumlah; index++) {
          const item = anggotaUrut[index];

          const namaBaru = buatNamaRombel(
            Number(item.tingkat),
            jumlah,
            index
          );

          const refKelas = doc(db, 'kelas', item.id);

          const waliId =
            item.id === idTarget
              ? dataTarget.waliKelasId
              : item.waliKelasId || null;

          const waliNama =
            waliId
              ? getNamaGuru(waliId)
              : item.waliKelas || '-';

          const dataSimpan = {
            namaKelas: namaBaru,
            jenjang: item.jenjang,
            tingkat: Number(item.tingkat),
            tahunAjaran: item.tahunAjaran,
            urutanRombel: index + 1,
            waliKelasId: waliId,
            waliKelas: waliNama
          };

          operasi.push((batch) => {
            batch.set(refKelas, dataSimpan, { merge: true });
          });

          // Perbarui label siswa yang sudah menggunakan kelasId.
          if (item.namaKelas && item.namaKelas !== namaBaru) {
            const [siswaSnap, ringkasSnap] = await Promise.all([
              getDocs(
                query(
                  collection(db, 'siswa'),
                  where('kelasId', '==', item.id)
                )
              ),
              getDocs(
                query(
                  collection(db, 'siswa_ringkas'),
                  where('kelasId', '==', item.id)
                )
              )
            ]);

            siswaSnap.docs.forEach((siswaDoc) => {
              operasi.push((batch) => {
                batch.update(siswaDoc.ref, {
                  kelas: namaBaru
                });
              });
            });

            ringkasSnap.docs.forEach((siswaDoc) => {
              operasi.push((batch) => {
                batch.update(siswaDoc.ref, {
                  kelas: namaBaru
                });
              });
            });
          }
        }
      }

      await jalankanOperasiBatch(operasi);

      setIsModalOpen(false);

      alert(
        editId
          ? 'Data rombel berhasil diperbarui.'
          : 'Rombel baru berhasil ditambahkan.'
      );

    } catch (error) {
      console.error('Gagal menyimpan rombel:', error);

      alert(
        'Gagal menyimpan data rombel. Periksa koneksi dan Firebase.'
      );

    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // HAPUS ROMBEL DENGAN PEMERIKSAAN REFERENSI
  // ==========================================

  const handleHapus = async (kelas: Kelas) => {
    if (
      !window.confirm(
        `Hapus rombel ${kelas.namaKelas}?\n\nSistem akan memeriksa apakah rombel masih digunakan oleh siswa, absensi, jurnal, atau penugasan guru.`
      )
    ) {
      return;
    }

    try {
      const [siswa, ringkas, absensi, jurnal, guruMapel] =
        await Promise.all([
          getDocs(
            query(
              collection(db, 'siswa'),
              where('kelasId', '==', kelas.id)
            )
          ),
          getDocs(
            query(
              collection(db, 'siswa_ringkas'),
              where('kelasId', '==', kelas.id)
            )
          ),
          getDocs(
            query(
              collection(db, 'absensi'),
              where('kelas', '==', kelas.namaKelas)
            )
          ),
          getDocs(
            query(
              collection(db, 'jurnal'),
              where('kelas', '==', kelas.namaKelas)
            )
          ),
          getDocs(
            query(
              collection(db, 'guru'),
              where('kelasDiampu', 'array-contains', kelas.id)
            )
          )
        ]);

      if (
        !siswa.empty ||
        !ringkas.empty ||
        !absensi.empty ||
        !jurnal.empty ||
        !guruMapel.empty
      ) {
        alert(
          'Rombel tidak dapat dihapus karena masih memiliki hubungan dengan data siswa, absensi, jurnal, atau penugasan guru.\n\nKosongkan atau pindahkan hubungan tersebut terlebih dahulu.'
        );

        return;
      }

      const kunciLama = buatKunciKelompok(kelas);

      await deleteDoc(doc(db, 'kelas', kelas.id));

      // Rapikan kembali nama rombel yang tersisa.
      const snapshot = await getDocs(collection(db, 'kelas'));

      const anggota = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data()
        }))
        .filter(
          (item: any) =>
            buatKunciKelompok(item) === kunciLama
        );

      const jumlah = anggota.length;

      const operasi: Array<(batch: WriteBatch) => void> = [];

      anggota
        .sort((a: any, b: any) => {
          return (
            Number(a.urutanRombel || 9999) -
            Number(b.urutanRombel || 9999)
          );
        })
        .forEach((item: any, index) => {
          const namaBaru = buatNamaRombel(
            parseTingkat(item.tingkat),
            jumlah,
            index
          );

          const ref = doc(db, 'kelas', item.id);

          operasi.push((batch) => {
            batch.update(ref, {
              namaKelas: namaBaru,
              urutanRombel: index + 1
            });
          });
        });

      await jalankanOperasiBatch(operasi);

      alert('Rombel berhasil dihapus.');

    } catch (error) {
      console.error('Gagal menghapus rombel:', error);

      alert(
        'Gagal menghapus rombel. Periksa koneksi dan Firebase.'
      );
    }
  };

  // ==========================================
  // TAMPILAN HALAMAN
  // ==========================================

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">

        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">
            Data Kelas & Rombel
          </h1>

          <p className="text-slate-500 mt-1 font-medium">
            Kelola rombongan belajar sesuai jenjang pendidikan yang diaktifkan pada Pengaturan Sekolah.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          <input
            type="file"
            accept=".xlsx, .xls"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={handleDownloadTemplate}
            className="bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-bold text-sm border border-slate-300 shadow-sm"
          >
            Unduh Template
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || jenjangTersedia.length === 0}
            className="bg-[#155EEF] hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
          >
            {isUploading ? 'Mengunggah...' : 'Upload Excel'}
          </button>

          <button
            onClick={() => normalisasiSemuaRombel(true)}
            disabled={isNormalisasi || loading}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
          >
            {isNormalisasi
              ? 'Menata Rombel...'
              : 'Rapikan Rombel Lama'}
          </button>

          <button
            onClick={handleDownloadData}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-bold text-sm"
          >
            Unduh Data
          </button>

          <button
            onClick={handleOpenTambah}
            disabled={jenjangTersedia.length === 0}
            className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Tambah Rombel
          </button>

        </div>
      </div>

      {/* INFORMASI KONFIGURASI DAN ATURAN ROMBEL */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <div>
          <p className="text-sm font-bold text-blue-800">Jenjang Sekolah Aktif</p>
          <p className="text-sm text-blue-700 mt-1">{labelJenjangSekolah}</p>
        </div>
        <div className="border-t border-blue-200 pt-2">
          <p className="text-sm font-bold text-blue-800">Aturan Penamaan Rombel Otomatis</p>
          <p className="text-sm text-blue-700 mt-1">
            Satu rombel menggunakan angka saja, misalnya 1. Jika ada dua rombel menjadi 1A dan 1B; tiga rombel menjadi 1A, 1B, dan 1C. Tingkat ditampilkan dengan angka Romawi.
          </p>
        </div>
      </div>

      {konfigurasiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {konfigurasiError} Periksa koneksi Firebase dan Firestore Security Rules.
        </div>
      )}

      {!loading && jenjangTersedia.length === 0 && !konfigurasiError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Jenjang sekolah belum dikonfigurasi. Buka menu Pengaturan Sekolah dan pilih SD, SMP, atau SD dan SMP (Gabungan).
        </div>
      )}

      {/* PENCARIAN */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">

        <input
          type="text"
          placeholder="Cari rombel, wali kelas, atau tahun ajaran..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-96 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#155EEF] outline-none text-sm"
        />

        <p className="text-sm text-slate-500 font-medium">
          Total: {kelasTampil.length} rombel
        </p>

      </div>

      {/* TABEL ROMBEL */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">

        <table className="w-full text-left border-collapse whitespace-nowrap">

          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <th className="p-4 text-xs font-bold uppercase">No</th>
              <th className="p-4 text-xs font-bold uppercase">Tahun Ajaran</th>
              <th className="p-4 text-xs font-bold uppercase">Jenjang</th>
              <th className="p-4 text-xs font-bold uppercase">Tingkat</th>
              <th className="p-4 text-xs font-bold uppercase">Nama Rombel</th>
              <th className="p-4 text-xs font-bold uppercase">Wali Kelas</th>
              <th className="p-4 text-xs font-bold uppercase">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Memuat data rombel...
                </td>
              </tr>
            ) : kelasTampil.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Belum ada data rombel.
                </td>
              </tr>
            ) : (
              kelasTampil.map((kelas, index) => (
                <tr
                  key={kelas.id}
                  className="border-b border-slate-100 hover:bg-[#F5F7FB] text-sm"
                >
                  <td className="p-4 text-slate-500">
                    {index + 1}
                  </td>

                  <td className="p-4">
                    <span className="bg-blue-50 text-[#155EEF] px-3 py-1 rounded-md text-xs font-bold">
                      {kelas.tahunAjaran || '-'}
                    </span>
                  </td>

                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                      kelas.jenjang === 'SD'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {kelas.jenjang}
                    </span>
                  </td>

                  <td className="p-4 text-slate-600 font-medium">
                    {toRoman(kelas.tingkat)}
                  </td>

                  <td className="p-4 font-bold text-[#082B62]">
                    {kelas.namaKelas || '-'}
                  </td>

                  <td className="p-4 text-slate-600 font-medium">
                    {kelas.waliKelasId
                      ? getNamaGuru(kelas.waliKelasId)
                      : kelas.waliKelas || '-'}
                  </td>

                  <td className="p-4">
                    <button
                      onClick={() => handleOpenEdit(kelas)}
                      className="text-[#155EEF] font-bold mr-4"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleHapus(kelas)}
                      className="text-red-500 font-bold"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>

        </table>
      </div>

      {/* MODAL TAMBAH / EDIT ROMBEL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">

          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl my-auto">

            <div className="flex justify-between items-center mb-6 border-b pb-4">

              <h2 className="text-xl font-bold text-[#082B62]">
                {editId ? 'Edit Rombel' : 'Tambah Rombel'}
              </h2>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={handleSimpanKelas}
              className="space-y-4"
            >

              {/* TAHUN AJARAN */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Tahun Ajaran
                </label>

                <select
                  value={tahunAjaran}
                  onChange={(e) => setTahunAjaran(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">
                    -- Pilih Tahun Ajaran --
                  </option>

                  {tahunAjaranList.map((item) => (
                    <option
                      key={item.id}
                      value={item.tahun}
                    >
                      {item.tahun} ({item.semester})
                      {item.status === 'Aktif' ? ' ✓ Aktif' : ''}
                    </option>
                  ))}

                </select>
              </div>

              {/* JENJANG */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Jenjang Sekolah
                </label>

                <select
                  value={jenjang}
                  onChange={(e) => {
                    const nilai = e.target.value;
                    setJenjang(nilai);
                    setTingkat(nilai === 'SD' ? '1' : '7');
                  }}
                  disabled={jenjangTersedia.length <= 1}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {jenjangTersedia.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                {jenjangTersedia.length === 1 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Pilihan jenjang mengikuti konfigurasi sekolah dan hanya dapat diubah melalui menu Pengaturan.
                  </p>
                )}
              </div>

              {/* TINGKAT */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Tingkat
                </label>

                <select
                  value={tingkat}
                  onChange={(e) => setTingkat(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  {(jenjang === 'SD'
                    ? [1, 2, 3, 4, 5, 6]
                    : [7, 8, 9]
                  ).map((item) => (
                    <option key={item} value={String(item)}>
                      Tingkat {toRoman(item)} (Kelas {item})
                    </option>
                  ))}
                </select>
              </div>

              {/* PREVIEW NAMA ROMBEL */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">

                <p className="text-sm font-bold text-emerald-800">
                  Nama Rombel Otomatis
                </p>

                <p className="text-3xl font-extrabold text-emerald-700 mt-1">
                  {previewNamaRombel}
                </p>

                <p className="text-xs text-emerald-700 mt-1">
                  Nama rombel ditentukan berdasarkan jumlah rombel
                  pada jenjang, tingkat, dan tahun ajaran yang dipilih.
                </p>

              </div>

              {/* WALI KELAS */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Wali Kelas
                </label>

                <select
                  value={waliKelasId}
                  onChange={(e) => setWaliKelasId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">
                    -- Belum Ditentukan --
                  </option>

                  {guruBisaMenjadiWali.map((guru) => (
                    <option key={guru.id} value={guru.id}>
                      {guru.nama} ({guru.jabatan})
                    </option>
                  ))}

                </select>

                <p className="text-xs text-slate-500 mt-1">
                  Wali kelas ditautkan langsung menggunakan ID data pegawai.
                </p>
              </div>

              {/* TOMBOL */}
              <div className="flex justify-end gap-3 mt-6 border-t pt-4">

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-[#155EEF] hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {isSaving
                    ? 'Menyimpan...'
                    : editId
                      ? 'Simpan Perubahan'
                      : 'Simpan Rombel'}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
