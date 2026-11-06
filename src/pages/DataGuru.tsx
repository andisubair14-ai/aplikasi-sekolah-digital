import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type FormEvent
} from 'react';

import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
  query,
  where
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

interface Guru {
  id: string;
  nama: string;
  nip: string;
  nuptk: string;
  mapel: string;
  jabatan: string;
  // Field lama tetap dibaca untuk kompatibilitas, tetapi tidak lagi
  // menjadi sumber penugasan Wali Kelas.
  jenjangWali?: string | null;
  kelasWali?: string | null;
  kelasDiampu?: string[];
  noHp: string;
  alamat: string;
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

interface TahunAjaran {
  id: string;
  tahun: string;
  semester: string;
  status: string;
}

const toRoman = (value: number | string): string => {
  const number = parseInt(String(value), 10);
  const roman: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX'
  };
  return roman[number] || String(value);
};

const urutKelas = (a: Kelas, b: Kelas) => {
  if (a.jenjang !== b.jenjang) return a.jenjang === 'SD' ? -1 : 1;
  const tingkatA = parseInt(String(a.tingkat || '0'), 10);
  const tingkatB = parseInt(String(b.tingkat || '0'), 10);
  if (tingkatA !== tingkatB) return tingkatA - tingkatB;
  return (a.namaKelas || '').localeCompare(b.namaKelas || '', 'id', { numeric: true });
};

export default function DataPegawai() {
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaran[]>([]);

  const [loadingGuru, setLoadingGuru] = useState(true);
  const [loadingKelas, setLoadingKelas] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [nuptk, setNuptk] = useState('');
  const [mapel, setMapel] = useState('');
  const [jabatan, setJabatan] = useState('Guru Mata Pelajaran');
  const [noHp, setNoHp] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kelasDiampu, setKelasDiampu] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pilihanJabatan = [
    'Guru Mata Pelajaran',
    'Wali Kelas',
    'Kepala Sekolah',
    'Wakil Kepala Sekolah',
    'Guru BK',
    'Tenaga Kependidikan'
  ];

  // --------------------------------------------------
  // MEMBACA DATA GURU, ROMBEL, DAN TAHUN AJARAN
  // --------------------------------------------------
  useEffect(() => {
    const unsubGuru = onSnapshot(
      collection(db, 'guru'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        })) as Guru[];
        setGuruList(data);
        setLoadingGuru(false);
      },
      (error) => {
        console.error('Gagal mengambil data guru:', error);
        setLoadingGuru(false);
        alert('Gagal mengambil data pegawai. Periksa koneksi Firebase.');
      }
    );

    const unsubKelas = onSnapshot(
      collection(db, 'kelas'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        })) as Kelas[];
        setKelasList(data);
        setLoadingKelas(false);
      },
      (error) => {
        console.error('Gagal mengambil data rombel:', error);
        setLoadingKelas(false);
      }
    );

    const unsubTahun = onSnapshot(
      collection(db, 'tahun_ajaran'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        })) as TahunAjaran[];
        setTahunAjaranList(data);
      },
      (error) => {
        console.error('Gagal mengambil tahun ajaran:', error);
      }
    );

    return () => {
      unsubGuru();
      unsubKelas();
      unsubTahun();
    };
  }, []);

  const tahunAktif = tahunAjaranList.find((item) => item.status === 'Aktif');

  // Kelas yang dapat dipilih Guru Mata Pelajaran.
  // Jika belum ada tahun aktif, semua kelas ditampilkan sebagai referensi,
  // tetapi penyimpanan penugasan tetap dicegah di bawah.
  const kelasTersedia = useMemo(() => {
    return kelasList
      .filter((item) => !tahunAktif || item.tahunAjaran === tahunAktif.tahun)
      .sort(urutKelas);
  }, [kelasList, tahunAktif?.tahun]);

  const getNamaKelas = (id: string) => {
    const kelas = kelasList.find((item) => item.id === id);
    if (!kelas) return 'Kelas tidak ditemukan';
    return `${kelas.namaKelas} (${kelas.jenjang}, Tingkat ${toRoman(kelas.tingkat)})`;
  };

  // Sumber resmi Wali Kelas adalah kelas.waliKelasId.
  // Data lama yang hanya memiliki nama ditampilkan sebagai peringatan,
  // bukan dianggap sebagai penugasan yang sudah tervalidasi.
  const getPenugasanWali = (guru: Guru) => {
    const penugasanResmi = kelasList
      .filter((item) => {
        const cocokGuru = item.waliKelasId === guru.id;
        const cocokTahun = !tahunAktif || item.tahunAjaran === tahunAktif.tahun;
        return cocokGuru && cocokTahun;
      })
      .sort(urutKelas);

    const penugasanLamaBelumTertaut = kelasList
      .filter((item) => {
        const cocokNama = item.waliKelas === guru.nama;
        const belumAdaId = !item.waliKelasId;
        const cocokTahun = !tahunAktif || item.tahunAjaran === tahunAktif.tahun;
        return cocokNama && belumAdaId && cocokTahun;
      })
      .sort(urutKelas);

    return { penugasanResmi, penugasanLamaBelumTertaut };
  };

  const handlePilihKelas = (idKelas: string) => {
    setKelasDiampu((sebelumnya) => {
      if (sebelumnya.includes(idKelas)) {
        return sebelumnya.filter((id) => id !== idKelas);
      }
      return [...sebelumnya, idKelas];
    });
  };

  const getRank = (jab: string) => {
    if (jab === 'Kepala Sekolah') return 1;
    if (jab === 'Wakil Kepala Sekolah') return 2;
    if (jab === 'Wali Kelas') return 3;
    if (jab === 'Guru BK') return 4;
    if (jab === 'Guru Mata Pelajaran') return 5;
    return 6;
  };

  const guruTampil = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return [...guruList]
      .filter((guru) => {
        const penugasanWali = getPenugasanWali(guru);
        const teksWali = penugasanWali.penugasanResmi
          .map((item) => `${item.namaKelas} ${item.jenjang} ${item.tahunAjaran}`)
          .join(' ')
          .toLowerCase();
        const teksMapel = (guru.kelasDiampu || [])
          .map((id) => getNamaKelas(id))
          .join(' ')
          .toLowerCase();

        return (
          !term ||
          guru.nama?.toLowerCase().includes(term) ||
          guru.nip?.toLowerCase().includes(term) ||
          guru.nuptk?.toLowerCase().includes(term) ||
          guru.mapel?.toLowerCase().includes(term) ||
          guru.jabatan?.toLowerCase().includes(term) ||
          teksWali.includes(term) ||
          teksMapel.includes(term)
        );
      })
      .sort((a, b) => {
        const rankA = getRank(a.jabatan);
        const rankB = getRank(b.jabatan);
        if (rankA !== rankB) return rankA - rankB;
        return (a.nama || '').localeCompare(b.nama || '');
      });
  }, [guruList, kelasList, tahunAktif?.tahun, searchTerm]);

  // --------------------------------------------------
  // TEMPLATE EXCEL BARU
  // Penugasan Wali Kelas diatur dari halaman Data Kelas.
  // --------------------------------------------------
  const handleDownloadTemplate = () => {
    const formatData = [
      {
        'Nama Lengkap': 'Budi Santoso, S.Pd.',
        'NIP': '1987654321',
        'NUPTK': '1234567890123456',
        'Mata Pelajaran': 'Matematika',
        'Jabatan': 'Guru Mata Pelajaran',
        'Kelas Diampu': '1, 2A',
        'Nomor HP': '081234567890',
        'Alamat': 'Jl. Pendidikan No. 1'
      },
      {
        'Nama Lengkap': 'Siti Aminah, S.Pd.',
        'NIP': '1987654322',
        'NUPTK': '',
        'Mata Pelajaran': '',
        'Jabatan': 'Wali Kelas',
        'Kelas Diampu': '',
        'Nomor HP': '081234567891',
        'Alamat': 'Jl. Pendidikan No. 2'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(formatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Format Pegawai');
    XLSX.writeFile(wb, 'Format_Upload_Pegawai.xlsx');
  };

  // --------------------------------------------------
  // DOWNLOAD DATA PEGAWAI
  // --------------------------------------------------
  const handleDownloadData = () => {
    if (guruTampil.length === 0) {
      alert('Tidak ada data untuk diunduh.');
      return;
    }

    const dataToExport = guruTampil.map((guru) => {
      const penugasanWali = getPenugasanWali(guru);
      return {
        'Nama Lengkap': guru.nama,
        'NIP': guru.nip,
        'NUPTK': guru.nuptk,
        'Mata Pelajaran': guru.mapel,
        'Jabatan': guru.jabatan,
        'Rombel Wali Kelas': penugasanWali.penugasanResmi
          .map((item) => `${item.namaKelas} (${item.jenjang}, Tingkat ${toRoman(item.tingkat)})`)
          .join(', ') || (penugasanWali.penugasanLamaBelumTertaut.length
            ? 'Perlu ditautkan di Data Kelas & Rombel'
            : '-'),
        'Kelas Diampu': (guru.kelasDiampu || [])
          .map((id) => getNamaKelas(id))
          .join(', '),
        'Nomor HP': guru.noHp,
        'Alamat': guru.alamat
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Pegawai');
    XLSX.writeFile(wb, 'Data_Pegawai_Sekolah.xlsx');
  };

  // --------------------------------------------------
  // UPLOAD DATA PEGAWAI DARI EXCEL
  // --------------------------------------------------
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          throw new Error('File Excel kosong.');
        }

        const dataSiapSimpan = jsonData.map((row, index) => {
          const jabatanExcel = String(row.Jabatan || 'Guru Mata Pelajaran').trim();

          if (!pilihanJabatan.includes(jabatanExcel)) {
            throw new Error(`Jabatan pada baris ${index + 2} tidak dikenal: ${jabatanExcel}`);
          }

          const namaKelasExcel = String(row['Kelas Diampu'] || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

          const kelasYangDipilih: string[] = [];

          if (jabatanExcel === 'Guru Mata Pelajaran') {
            if (!tahunAktif && kelasList.length > 0) {
              throw new Error('Belum ada Tahun Ajaran Aktif. Atur tahun ajaran aktif sebelum mengimpor penugasan Guru Mata Pelajaran.');
            }

            if (namaKelasExcel.length === 0) {
              throw new Error(`Guru Mata Pelajaran pada baris ${index + 2} belum memiliki Kelas Diampu.`);
            }

            namaKelasExcel.forEach((namaRombel) => {
              const hasil = kelasTersedia.filter(
                (item) => item.namaKelas?.toLowerCase() === namaRombel.toLowerCase()
              );

              if (hasil.length === 0) {
                throw new Error(`Rombel "${namaRombel}" pada baris ${index + 2} tidak ditemukan pada Tahun Ajaran Aktif.`);
              }

              if (hasil.length > 1) {
                throw new Error(`Nama rombel "${namaRombel}" tidak unik. Periksa data rombel pada Tahun Ajaran Aktif.`);
              }

              kelasYangDipilih.push(hasil[0].id);
            });
          }

          return {
            nama: String(row['Nama Lengkap'] || '-').trim(),
            nip: String(row.NIP || '-').trim(),
            nuptk: String(row.NUPTK || '').trim(),
            mapel: jabatanExcel === 'Guru Mata Pelajaran'
              ? String(row['Mata Pelajaran'] || '').trim()
              : String(row['Mata Pelajaran'] || '-').trim(),
            jabatan: jabatanExcel,
            kelasDiampu: kelasYangDipilih,
            noHp: String(row['Nomor HP'] || '-').trim(),
            alamat: String(row.Alamat || '-').trim()
          };
        });

        // Maksimal 400 dokumen per batch agar tetap di bawah batas Firestore.
        for (let i = 0; i < dataSiapSimpan.length; i += 400) {
          const batch = writeBatch(db);
          const potongan = dataSiapSimpan.slice(i, i + 400);
          potongan.forEach((item) => {
            const ref = doc(collection(db, 'guru'));
            batch.set(ref, item);
          });
          await batch.commit();
        }

        alert(
          `Berhasil mengimpor ${dataSiapSimpan.length} data pegawai.\n\nUntuk pegawai dengan jabatan Wali Kelas, tentukan rombel yang menjadi tanggung jawabnya melalui menu Data Kelas & Rombel.`
        );
      } catch (error) {
        console.error('Gagal mengimpor data pegawai:', error);
        const pesan = error instanceof Error
          ? error.message
          : 'Pastikan format file sesuai template.';
        alert('Gagal mengimpor data: ' + pesan);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setIsUploading(false);
      alert('File Excel tidak dapat dibaca.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsArrayBuffer(file);
  };

  // --------------------------------------------------
  // FORM TAMBAH PEGAWAI
  // --------------------------------------------------
  const handleOpenTambah = () => {
    setEditId(null);
    setNama('');
    setNip('');
    setNuptk('');
    setMapel('');
    setJabatan('Guru Mata Pelajaran');
    setNoHp('');
    setAlamat('');
    setKelasDiampu([]);
    setIsModalOpen(true);
  };

  // --------------------------------------------------
  // FORM EDIT PEGAWAI
  // --------------------------------------------------
  const handleOpenEdit = (guru: Guru) => {
    setEditId(guru.id);
    setNama(guru.nama || '');
    setNip(guru.nip || '');
    setNuptk(guru.nuptk || '');
    setMapel(guru.mapel || '');
    setJabatan(guru.jabatan || 'Guru Mata Pelajaran');
    setNoHp(guru.noHp || '');
    setAlamat(guru.alamat || '');
    setKelasDiampu(guru.kelasDiampu || []);
    setIsModalOpen(true);
  };

  // --------------------------------------------------
  // SIMPAN DATA PEGAWAI
  // --------------------------------------------------
  const handleSimpanPegawai = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!nama.trim()) {
      alert('Nama lengkap wajib diisi.');
      return;
    }

    if (jabatan === 'Guru Mata Pelajaran' && !mapel.trim()) {
      alert('Mata Pelajaran wajib diisi untuk Guru Mata Pelajaran.');
      return;
    }

    if (jabatan === 'Guru Mata Pelajaran' && kelasDiampu.length === 0) {
      alert('Silakan pilih minimal satu rombel yang diajar.');
      return;
    }

    if (jabatan === 'Guru Mata Pelajaran' && !tahunAktif && kelasList.length > 0) {
      alert('Belum ada Tahun Ajaran Aktif. Atur tahun ajaran aktif sebelum menyimpan penugasan guru.');
      return;
    }

    // Jangan mengubah jabatan pegawai yang masih ditugaskan sebagai Wali Kelas.
    // Lepaskan/ubah penugasannya terlebih dahulu di Data Kelas & Rombel.
    if (editId && jabatan !== 'Wali Kelas') {
      const masihMenjadiWali = kelasList.some(
        (item) => item.waliKelasId === editId
      );

      if (masihMenjadiWali) {
        alert(
          'Pegawai ini masih ditugaskan sebagai Wali Kelas pada satu atau beberapa rombel.\n\nUbah atau lepaskan penugasannya terlebih dahulu melalui menu Data Kelas & Rombel, kemudian ubah jabatan pegawai.'
        );
        return;
      }
    }

    setIsSaving(true);

    try {
      const dataBaru: Record<string, any> = {
        nama: nama.trim(),
        nip: nip.trim(),
        nuptk: nuptk.trim(),
        mapel: jabatan === 'Wali Kelas'
          ? '-'
          : (mapel.trim() || '-'),
        jabatan,
        noHp: noHp.trim(),
        alamat: alamat.trim(),
        kelasDiampu: jabatan === 'Guru Mata Pelajaran'
          ? kelasDiampu
          : []
      };

      // Field lama jenjangWali/kelasWali tidak lagi ditulis.
      // Saat edit dengan merge, nilainya dibiarkan agar data historis
      // tidak terhapus mendadak. Tampilan baru tidak menggunakannya.

      if (editId) {
        await updateDoc(doc(db, 'guru', editId), dataBaru);
      } else {
        const batch = writeBatch(db);
        const refBaru = doc(collection(db, 'guru'));
        batch.set(refBaru, dataBaru);
        await batch.commit();
      }

      setIsModalOpen(false);
      alert(
        editId
          ? 'Data pegawai berhasil diperbarui.'
          : jabatan === 'Wali Kelas'
            ? 'Data pegawai berhasil ditambahkan. Selanjutnya tentukan rombel wali kelas melalui Data Kelas & Rombel.'
            : 'Data pegawai berhasil ditambahkan.'
      );
    } catch (error) {
      console.error('Gagal menyimpan data pegawai:', error);
      alert('Gagal menyimpan data pegawai. Periksa koneksi Firebase.');
    } finally {
      setIsSaving(false);
    }
  };

  // --------------------------------------------------
  // HAPUS DATA PEGAWAI DENGAN PEMERIKSAAN HUBUNGAN
  // --------------------------------------------------
  const handleHapus = async (id: string) => {
    const guru = guruList.find((item) => item.id === id);
    if (!guru) return;

    const masihMenjadiWali = kelasList.some(
      (item) => item.waliKelasId === id
    );

    if (masihMenjadiWali) {
      alert(
        'Pegawai ini masih ditugaskan sebagai Wali Kelas. Lepaskan penugasannya terlebih dahulu melalui menu Data Kelas & Rombel.'
      );
      return;
    }

    if ((guru.kelasDiampu || []).length > 0) {
      alert(
        'Pegawai ini masih memiliki penugasan Guru Mata Pelajaran. Edit pegawai dan lepaskan semua rombel yang diampu terlebih dahulu.'
      );
      return;
    }

    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus data pegawai ${guru.nama}?\n\nJika akun login masih terhubung ke pegawai ini, hapus atau ubah tautan akunnya terlebih dahulu melalui Manajemen Pengguna.`
      )
    ) {
      return;
    }

    try {
      // Periksa apakah akun pengguna masih memakai guruId ini.
      const akunTerkait = await getDocs(
        query(collection(db, 'users'), where('guruId', '==', id))
      );

      if (!akunTerkait.empty) {
        alert(
          'Data pegawai tidak dapat dihapus karena masih terhubung dengan akun login pada Manajemen Pengguna. Lepaskan hubungan akun tersebut terlebih dahulu.'
        );
        return;
      }

      const dataKelasLama = kelasList.some(
        (item) => !item.waliKelasId && item.waliKelas === guru.nama
      );

      if (dataKelasLama) {
        alert(
          'Masih ditemukan penugasan Wali Kelas lama yang belum ditautkan dengan ID Guru. Periksa rombel tersebut di Data Kelas & Rombel sebelum menghapus pegawai.'
        );
        return;
      }

      const batch = writeBatch(db);
      batch.delete(doc(db, 'guru', id));
      await batch.commit();
      alert('Data pegawai berhasil dihapus.');
    } catch (error) {
      console.error('Gagal menghapus data pegawai:', error);
      alert('Gagal menghapus data pegawai. Periksa koneksi Firebase.');
    }
  };

  const loading = loadingGuru || loadingKelas;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">Data Pegawai</h1>
          <p className="text-slate-500 mt-1 font-medium">
            Kelola informasi pendidik dan tenaga kependidikan serta penugasan rombel.
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
            disabled={isUploading}
            className="bg-[#155EEF] hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
          >
            {isUploading ? 'Mengunggah...' : 'Upload Excel'}
          </button>

          <button
            onClick={handleDownloadData}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-bold text-sm"
          >
            Unduh Data
          </button>

          <button
            onClick={handleOpenTambah}
            className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
          >
            + Tambah Pegawai
          </button>
        </div>
      </div>

      {/* KETERANGAN SUMBER PENUGASAN */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-bold text-blue-800">Informasi Penugasan</p>
        <p className="text-sm text-blue-700 mt-1">
          Penugasan Wali Kelas ditentukan melalui menu Data Kelas & Rombel. Halaman ini menampilkan rombel berdasarkan ID Wali Kelas yang tersimpan pada data rombel. Guru Mata Pelajaran tetap ditugaskan ke beberapa rombel melalui formulir pegawai.
        </p>
      </div>

      {/* PENCARIAN */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
        <input
          type="text"
          placeholder="Cari Nama, NIP, Mata Pelajaran, atau Rombel..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-96 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#155EEF] outline-none text-sm"
        />

        <span className="text-sm text-slate-500 font-medium">
          Total: {guruList.length} pegawai
        </span>
      </div>

      {/* TABEL PEGAWAI */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <th className="p-4 text-xs font-bold uppercase">No</th>
              <th className="p-4 text-xs font-bold uppercase">Nama Lengkap</th>
              <th className="p-4 text-xs font-bold uppercase">NIP / NUPTK</th>
              <th className="p-4 text-xs font-bold uppercase">Jabatan / Tugas</th>
              <th className="p-4 text-xs font-bold uppercase">Kontak</th>
              <th className="p-4 text-xs font-bold uppercase">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                  Memuat data pegawai...
                </td>
              </tr>
            ) : guruTampil.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                  Tidak ada data pegawai ditemukan.
                </td>
              </tr>
            ) : (
              guruTampil.map((guru, index) => {
                const penugasanWali = getPenugasanWali(guru);

                return (
                  <tr
                    key={guru.id}
                    className="border-b border-slate-100 hover:bg-[#F5F7FB] text-sm align-top"
                  >
                    <td className="p-4 text-slate-500 font-medium">{index + 1}</td>

                    <td className="p-4 font-bold text-[#082B62]">{guru.nama}</td>

                    <td className="p-4 text-slate-600 font-medium">
                      {guru.nip || '-'}
                      <br />
                      <span className="text-xs text-slate-400">{guru.nuptk || '-'}</span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-md text-xs font-bold inline-block mb-1 ${
                          guru.jabatan === 'Kepala Sekolah'
                            ? 'bg-purple-100 text-purple-700'
                            : guru.jabatan === 'Wali Kelas'
                              ? 'bg-blue-100 text-blue-700'
                              : guru.jabatan === 'Guru Mata Pelajaran'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {guru.jabatan}
                      </span>

                      {guru.jabatan === 'Wali Kelas' && (
                        <div className="text-xs text-slate-600 font-medium mt-1 whitespace-normal max-w-xs">
                          <span className="font-bold">Rombel Wali:</span>{' '}
                          {penugasanWali.penugasanResmi.length > 0 ? (
                            penugasanWali.penugasanResmi.map((item) => (
                              <div key={item.id} className="mt-1">
                                {item.namaKelas} ({item.jenjang}, Tingkat {toRoman(item.tingkat)})
                                <span className="text-slate-400"> — {item.tahunAjaran}</span>
                              </div>
                            ))
                          ) : penugasanWali.penugasanLamaBelumTertaut.length > 0 ? (
                            <div className="text-amber-700 mt-1">
                              Penugasan lama belum ditautkan: {' '}
                              {penugasanWali.penugasanLamaBelumTertaut
                                .map((item) => `${item.namaKelas} (${item.jenjang}, Tingkat ${toRoman(item.tingkat)})`)
                                .join(', ')}.
                              Periksa melalui Data Kelas & Rombel.
                            </div>
                          ) : (
                            <div className="text-amber-700 mt-1">
                              Belum ditugaskan. Atur melalui Data Kelas & Rombel.
                            </div>
                          )}
                        </div>
                      )}

                      {guru.jabatan === 'Guru Mata Pelajaran' && (
                        <div className="text-xs text-slate-500 mt-1 whitespace-normal max-w-xs">
                          <div><span className="font-bold">Mapel:</span> {guru.mapel || '-'}</div>
                          <div className="mt-1">
                            <span className="font-bold">Rombel Diampu:</span>{' '}
                            {(guru.kelasDiampu || []).length > 0
                              ? guru.kelasDiampu!.map((id) => getNamaKelas(id)).join(', ')
                              : 'Belum ditentukan'}
                          </div>
                        </div>
                      )}

                      {guru.jabatan !== 'Wali Kelas' &&
                        guru.jabatan !== 'Guru Mata Pelajaran' &&
                        guru.mapel && guru.mapel !== '-' && (
                          <div className="text-xs text-slate-500 mt-1">Mapel: {guru.mapel}</div>
                        )}
                    </td>

                    <td className="p-4 text-slate-600 font-medium">{guru.noHp || '-'}</td>

                    <td className="p-4">
                      <button
                        onClick={() => handleOpenEdit(guru)}
                        className="text-[#155EEF] hover:text-blue-800 font-bold mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleHapus(guru.id)}
                        className="text-[#EF4444] hover:text-red-800 font-bold"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL TAMBAH / EDIT PEGAWAI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-[#082B62]">
                {editId ? 'Edit Data Pegawai' : 'Tambah Data Pegawai'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimpanPegawai} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* KOLOM KIRI */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nama Lengkap (dengan Gelar)</label>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">NIP</label>
                  <input
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">NUPTK (Opsional)</label>
                  <input
                    type="text"
                    value={nuptk}
                    onChange={(e) => setNuptk(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nomor HP</label>
                  <input
                    type="text"
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
                  />
                </div>
              </div>

              {/* KOLOM KANAN */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Jabatan</label>
                  <select
                    value={jabatan}
                    onChange={(e) => {
                      const jabatanBaru = e.target.value;
                      setJabatan(jabatanBaru);
                      if (jabatanBaru !== 'Guru Mata Pelajaran') {
                        setKelasDiampu([]);
                      }
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer"
                  >
                    {pilihanJabatan.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>

                {/* WALI KELAS: PENUGASAN DITENTUKAN DARI DATA KELAS */}
                {jabatan === 'Wali Kelas' && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-sm font-bold text-blue-800">Penugasan Wali Kelas</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Rombel tidak dipilih pada formulir ini. Setelah data pegawai disimpan, buka menu Data Kelas & Rombel, lalu pilih nama pegawai ini sebagai Wali Kelas pada rombel yang sesuai.
                    </p>
                    {editId && (
                      <div className="mt-3 text-xs text-blue-900">
                        Rombel yang saat ini ditugaskan:
                        <ul className="list-disc pl-5 mt-1">
                          {getPenugasanWali(guruList.find((item) => item.id === editId) || {
                            id: editId,
                            nama,
                            nip,
                            nuptk,
                            mapel,
                            jabatan,
                            noHp,
                            alamat
                          }).penugasanResmi.map((item) => (
                            <li key={item.id}>
                              {item.namaKelas} — {item.jenjang}, Tingkat {toRoman(item.tingkat)}
                            </li>
                          ))}
                        </ul>
                        {getPenugasanWali(guruList.find((item) => item.id === editId) || {
                          id: editId,
                          nama,
                          nip,
                          nuptk,
                          mapel,
                          jabatan,
                          noHp,
                          alamat
                        }).penugasanResmi.length === 0 && (
                          <p className="mt-1">Belum ada rombel yang ditugaskan.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* MATA PELAJARAN */}
                {jabatan !== 'Wali Kelas' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Mata Pelajaran {jabatan === 'Guru Mata Pelajaran' ? '*' : '(Opsional)'}
                    </label>
                    <input
                      type="text"
                      value={mapel}
                      onChange={(e) => setMapel(e.target.value)}
                      required={jabatan === 'Guru Mata Pelajaran'}
                      placeholder={jabatan === 'Guru Mata Pelajaran' ? 'Wajib diisi' : 'Boleh dikosongkan'}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
                    />
                  </div>
                )}

                {/* PENUGASAN GURU MATA PELAJARAN */}
                {jabatan === 'Guru Mata Pelajaran' && (
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <label className="block text-sm font-bold text-emerald-800">Rombel yang Diampu *</label>
                      <span className="text-xs bg-white text-emerald-700 px-2 py-1 rounded-md font-bold">
                        {kelasDiampu.length} dipilih
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mb-3">
                      Centang semua rombel yang diajar oleh guru ini.
                    </p>

                    {!tahunAktif && (
                      <div className="bg-amber-100 text-amber-800 text-xs p-2 rounded-lg mb-3">
                        Belum ditemukan Tahun Ajaran Aktif. Atur tahun ajaran aktif terlebih dahulu sebelum menyimpan penugasan.
                      </div>
                    )}

                    {kelasTersedia.length === 0 ? (
                      <div className="bg-white rounded-lg p-3 text-sm text-slate-500 border border-emerald-100">
                        Belum ada data rombel yang tersedia untuk dipilih.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-2 bg-white rounded-lg p-3 border border-emerald-100">
                        {kelasTersedia.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-emerald-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={kelasDiampu.includes(item.id)}
                              onChange={() => handlePilihKelas(item.id)}
                              className="w-4 h-4 accent-emerald-600"
                            />
                            <span className="font-medium">
                              {item.namaKelas} — {item.jenjang}, Tingkat {toRoman(item.tingkat)} ({item.tahunAjaran})
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-emerald-800 mt-2">
                      Penugasan disimpan menggunakan ID dokumen rombel, bukan hanya nama rombel.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Alamat Lengkap</label>
                  <textarea
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium resize-none"
                  />
                </div>
              </div>

              {/* TOMBOL FORM */}
              <div className="md:col-span-2 flex justify-end gap-3 mt-4 border-t pt-4">
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
                  {isSaving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
