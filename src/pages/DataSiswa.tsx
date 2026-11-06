
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
  deleteDoc,
  writeBatch,
  getDoc,
  query,
  where
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

// ==========================================
// TIPE DATA
// ==========================================

interface Kelas {
  id: string;
  namaKelas: string;
  jenjang: string;
  tingkat: string;
  waliKelas: string;
  tahunAjaran: string;
}

interface Siswa {
  id: string;
  nama: string;
  nisn: string;
  kelas: string;
  kelasId?: string;
  tahunAjaran: string;
  semester: string;
  status: string;
  riwayat?: any[];

  tempatLahir?: string;
  tanggalLahir?: string;
  agama?: string;
  namaAyah?: string;
  namaIbu?: string;
  pekerjaanOrtu?: string;
  alamat?: string;
  noHp?: string;
}

interface TahunAjaran {
  id: string;
  tahun: string;
  semester: string;
  status: string;
}

// ==========================================
// MEMBERSIHKAN DATA SEBELUM DIKIRIM KE FIRESTORE
// ==========================================

const bersihkanUndefined = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : bersihkanUndefined(item)
    );
  }

  if (
    value !== null &&
    typeof value === 'object' &&
    value.constructor === Object
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [
          key,
          bersihkanUndefined(item)
        ])
    );
  }

  return value;
};

// ==========================================
// MENCARI KELAS SISWA
// ==========================================

const cariKelasSiswa = (
  siswa: any,
  daftarKelas: Kelas[]
): Kelas | null => {

  // 1. Prioritaskan ID dokumen kelas.
  if (siswa.kelasId) {
    const kelasDenganId = daftarKelas.find(
      (item) =>
        item.id === siswa.kelasId &&
        item.namaKelas === siswa.kelas &&
        (
          !siswa.tahunAjaran ||
          siswa.tahunAjaran === '-' ||
          item.tahunAjaran === siswa.tahunAjaran
        )
    );

    if (kelasDenganId) {
      return kelasDenganId;
    }
  }

  const tahun = String(siswa.tahunAjaran || '').trim();
  const namaKelas = String(siswa.kelas || '').trim();

  if (!namaKelas || namaKelas === '-') {
    return null;
  }

  // 2. Jika tahun ajaran tersedia, cocokkan keduanya.
  if (tahun && tahun !== '-') {
    const hasil = daftarKelas.filter(
      (item) =>
        item.namaKelas === namaKelas &&
        item.tahunAjaran === tahun
    );

    return hasil.length === 1 ? hasil[0] : null;
  }

  // 3. Jika tahun ajaran kosong, cocokkan nama kelas
  // hanya apabila hasilnya benar-benar unik.
  const kandidat = daftarKelas.filter(
    (item) => item.namaKelas === namaKelas
  );

  return kandidat.length === 1 ? kandidat[0] : null;
};

// ==========================================
// MEMBUAT DATA SISWA RINGKAS
// ==========================================

const buatDataRingkas = (
  siswa: any,
  kelas: Kelas
) => ({
  nama: siswa.nama || '',
  nisn: siswa.nisn || '',
  kelas: kelas.namaKelas || '',
  kelasId: kelas.id,
  jenjang: kelas.jenjang || '',
  tingkat: kelas.tingkat || '',
  tahunAjaran:
    siswa.tahunAjaran &&
    siswa.tahunAjaran !== '-'
      ? siswa.tahunAjaran
      : kelas.tahunAjaran || '',
  semester:
    siswa.semester && siswa.semester !== '-'
      ? siswa.semester
      : '',
  status: siswa.status || 'Aktif'
});

// ==========================================
// KOMPONEN UTAMA
// ==========================================

export default function DataSiswa() {
  const { userData } = useAuth();

  const isAdmin = userData?.role === 'admin';
  const isKepsek = userData?.role === 'kepsek';
  const isGuru = userData?.role === 'guru';

  const bolehMelihatLengkap = isAdmin || isKepsek;

  // ==========================================
  // STATE DATA FIRESTORE
  // ==========================================

  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [tahunAjaranList, setTahunAjaranList] =
    useState<TahunAjaran[]>([]);

  const [masterLoading, setMasterLoading] = useState(true);
  const [fullLoading, setFullLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [teacherLoading, setTeacherLoading] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [profileError, setProfileError] = useState('');

  const [guruProfile, setGuruProfile] = useState<any>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // STATE FORM
  // ==========================================

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [nama, setNama] = useState('');
  const [nisn, setNisn] = useState('');
  const [tempatLahir, setTempatLahir] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');

  const [namaAyah, setNamaAyah] = useState('');
  const [namaIbu, setNamaIbu] = useState('');
  const [pekerjaanOrtu, setPekerjaanOrtu] = useState('');

  const [alamat, setAlamat] = useState('');
  const [noHp, setNoHp] = useState('');
  const [agama, setAgama] = useState('Islam');

  const [tahunAjaranId, setTahunAjaranId] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [semester, setSemester] = useState('');

  const [kelas, setKelas] = useState('');
  const [kelasId, setKelasId] = useState('');

  const [status, setStatus] = useState('Aktif');

  // ==========================================
  // STATE FILTER DAN DOWNLOAD
  // ==========================================

  const [filterStatus, setFilterStatus] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadTAId, setDownloadTAId] = useState('');

  const pilihanAgama = [
    'Islam',
    'Kristen',
    'Katolik',
    'Hindu',
    'Buddha',
    'Khonghucu'
  ];

  const pilihanStatus = [
    'Aktif',
    'Lulus',
    'Pindah Keluar',
    'Tinggal Kelas',
    'Mutasi Masuk'
  ];

  // ==========================================
  // MENGAMBIL DATA MASTER KELAS DAN TAHUN AJARAN
  // ==========================================

  useEffect(() => {
    let kelasReady = false;
    let tahunReady = false;

    const periksaSelesai = () => {
      if (kelasReady && tahunReady) {
        setMasterLoading(false);
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
        periksaSelesai();
      },
      (error) => {
        console.error('Gagal mengambil data kelas:', error);
        setLoadError('Gagal mengambil data kelas.');
        kelasReady = true;
        periksaSelesai();
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
        tahunReady = true;
        periksaSelesai();
      },
      (error) => {
        console.error('Gagal mengambil tahun ajaran:', error);
        setLoadError('Gagal mengambil tahun ajaran.');
        tahunReady = true;
        periksaSelesai();
      }
    );

    return () => {
      unsubKelas();
      unsubTahun();
    };
  }, []);

  // ==========================================
  // ADMIN DAN KEPALA SEKOLAH:
  // MEMBACA DATA SISWA LENGKAP
  // ==========================================

  useEffect(() => {
    if (!bolehMelihatLengkap) {
      setFullLoading(false);
      return;
    }

    setFullLoading(true);
    setLoadError('');

    const unsubSiswa = onSnapshot(
      collection(db, 'siswa'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        })) as Siswa[];

        setSiswaList(data);
        setFullLoading(false);
      },
      (error) => {
        console.error('Gagal mengambil data siswa:', error);

        setLoadError(
          'Data siswa tidak dapat dibaca. Periksa koneksi dan hak akses Firebase.'
        );

        setFullLoading(false);
      }
    );

    return () => unsubSiswa();
  }, [bolehMelihatLengkap, userData?.uid]);

  // ==========================================
  // GURU:
  // MENGAMBIL PROFIL GURU BERDASARKAN guruId
  // ==========================================

  useEffect(() => {
    if (!isGuru) {
      setGuruProfile(null);
      setProfileLoading(false);
      setProfileError('');
      return;
    }

    if (!userData?.guruId) {
      setGuruProfile(null);
      setProfileError(
        'Akun Guru belum terhubung dengan Data Pegawai. Hubungi Administrator.'
      );
      setProfileLoading(false);
      return;
    }

    let masihAktif = true;

    setProfileLoading(true);
    setProfileError('');

    const ambilProfilGuru = async () => {
      try {
        const refGuru = doc(db, 'guru', userData.guruId!);
        const snapGuru = await getDoc(refGuru);

        if (!masihAktif) return;

        if (snapGuru.exists()) {
          setGuruProfile({
            id: snapGuru.id,
            ...snapGuru.data()
          });
        } else {
          setGuruProfile(null);
          setProfileError(
            'Data Guru yang terhubung dengan akun ini tidak ditemukan.'
          );
        }
      } catch (error) {
        console.error('Gagal mengambil profil guru:', error);

        if (masihAktif) {
          setGuruProfile(null);
          setProfileError(
            'Profil Guru tidak dapat dibaca dari Firebase.'
          );
        }
      } finally {
        if (masihAktif) {
          setProfileLoading(false);
        }
      }
    };

    ambilProfilGuru();

    return () => {
      masihAktif = false;
    };
  }, [isGuru, userData?.guruId]);

  // ==========================================
  // MENENTUKAN TAHUN AJARAN AKTIF
  // ==========================================

  const tahunAktif = tahunAjaranList.find(
    (item) => item.status === 'Aktif'
  );

  // ==========================================
  // MENENTUKAN KELAS YANG DITUGASKAN KEPADA GURU
  // ==========================================

  const kelasDiizinkan = useMemo(() => {
    if (!isGuru || !guruProfile || !tahunAktif) {
      return [];
    }

    // Guru Mata Pelajaran:
    // Menggunakan daftar ID rombel yang ditugaskan.
    if (guruProfile.jabatan === 'Guru Mata Pelajaran') {
      const daftarId: string[] = Array.isArray(guruProfile.kelasDiampu)
        ? guruProfile.kelasDiampu
        : [];

      return daftarId.filter((id) =>
        kelasList.some(
          (item) =>
            item.id === id &&
            item.tahunAjaran === tahunAktif.tahun
        )
      );
    }

    // Wali Kelas:
    // Menggunakan nama wali kelas pada dokumen rombel.
    // Dengan cara ini, kelas 1A dan 1B tidak tertukar.
    if (guruProfile.jabatan === 'Wali Kelas') {
      return kelasList
        .filter(
          (item) =>
            item.waliKelas === guruProfile.nama &&
            item.jenjang === guruProfile.jenjangWali &&
            item.tahunAjaran === tahunAktif.tahun
        )
        .map((item) => item.id);
    }

    return [];
  }, [
    isGuru,
    guruProfile,
    kelasList,
    tahunAktif?.tahun
  ]);

  // ==========================================
  // GURU:
  // MEMBACA DATA SISWA RINGKAS SESUAI PENUGASAN
  // Mendukung lebih dari 30 rombel dengan beberapa query.
  // ==========================================

  useEffect(() => {
    if (!isGuru) {
      setTeacherLoading(false);
      return;
    }

    if (profileLoading || masterLoading) {
      return;
    }

    if (!guruProfile) {
      setSiswaList([]);
      setTeacherLoading(false);
      return;
    }

    if (kelasDiizinkan.length === 0) {
      setSiswaList([]);
      setTeacherLoading(false);
      return;
    }

    setTeacherLoading(true);
    setLoadError('');

    const ukuranKelompok = 30;
    const kelompokKelas: string[][] = [];

    for (
      let i = 0;
      i < kelasDiizinkan.length;
      i += ukuranKelompok
    ) {
      kelompokKelas.push(
        kelasDiizinkan.slice(i, i + ukuranKelompok)
      );
    }

    const hasilPerKelompok = new Map<number, Siswa[]>();
    const unsubscribeList: Array<() => void> = [];

    let jumlahAwalSelesai = 0;
    let terjadiError = false;

    kelompokKelas.forEach((kelompok, index) => {
      const q = query(
        collection(db, 'siswa_ringkas'),
        where('kelasId', 'in', kelompok)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
          })) as Siswa[];

          const belumPernahMenerimaData =
            !hasilPerKelompok.has(index);

          hasilPerKelompok.set(index, data);

          if (belumPernahMenerimaData) {
            jumlahAwalSelesai++;
          }

          const semuaData = Array.from(
            hasilPerKelompok.values()
          ).flat();

          setSiswaList(semuaData);

          if (jumlahAwalSelesai === kelompokKelas.length) {
            setTeacherLoading(false);
          }
        },
        (error) => {
          console.error(
            `Gagal mengambil kelompok kelas ke-${index + 1}:`,
            error
          );

          if (!terjadiError) {
            terjadiError = true;
            setSiswaList([]);
            setLoadError(
              'Data siswa ringkas belum dapat dibaca. Pastikan sinkronisasi Admin sudah berhasil dan Firebase Rules sudah sesuai.'
            );
            setTeacherLoading(false);
          }
        }
      );

      unsubscribeList.push(unsubscribe);
    });

    return () => {
      unsubscribeList.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    isGuru,
    guruProfile,
    profileLoading,
    masterLoading,
    kelasDiizinkan.join('|')
  ]);

  // ==========================================
  // STATUS LOADING HALAMAN
  // ==========================================

  const loadingHalaman =
    masterLoading ||
    (
      bolehMelihatLengkap
        ? fullLoading
        : isGuru
          ? profileLoading || teacherLoading
          : false
    );

  // ==========================================
  // FILTER DAN PENGURUTAN SISWA
  // ==========================================

  const siswaTampil = useMemo(() => {
    return [...siswaList]
      .filter((siswa) => {
        const cocokStatus =
          filterStatus === 'Semua' ||
          siswa.status === filterStatus;

        const cocokNama =
          siswa.nama?.toLowerCase().includes(
            searchTerm.toLowerCase()
          );

        const cocokNisn =
          siswa.nisn?.includes(searchTerm);

        return cocokStatus && (cocokNama || cocokNisn);
      })
      .sort((a, b) => {
        const kelasA = kelasList.find(
          (item) => item.id === a.kelasId
        );

        const kelasB = kelasList.find(
          (item) => item.id === b.kelasId
        );

        const tingkatA = parseInt(kelasA?.tingkat || '99');
        const tingkatB = parseInt(kelasB?.tingkat || '99');

        if (tingkatA !== tingkatB) {
          return tingkatA - tingkatB;
        }

        if (a.kelas !== b.kelas) {
          return (a.kelas || '').localeCompare(b.kelas || '');
        }

        return (a.nama || '').localeCompare(b.nama || '');
      });
  }, [siswaList, kelasList, filterStatus, searchTerm]);

  // ==========================================
  // KELAS DINAMIS BERDASARKAN TAHUN AJARAN
  // ==========================================

  const pilihanKelasDinamis = kelasList
    .filter((item) => item.tahunAjaran === tahunAjaran)
    .sort((a, b) => {
      if (a.jenjang !== b.jenjang) {
        return a.jenjang === 'SD' ? -1 : 1;
      }

      const tingkatA = parseInt(a.tingkat || '0');
      const tingkatB = parseInt(b.tingkat || '0');

      if (tingkatA !== tingkatB) {
        return tingkatA - tingkatB;
      }

      return a.namaKelas.localeCompare(b.namaKelas);
    });

  // ==========================================
  // STATUS BADGE
  // ==========================================

  const getStatusBadge = (nilai: string) => {
    switch (nilai) {
      case 'Aktif':
        return 'bg-emerald-100 text-emerald-700';
      case 'Lulus':
        return 'bg-blue-100 text-blue-700';
      case 'Pindah Keluar':
        return 'bg-amber-100 text-amber-700';
      case 'Tinggal Kelas':
        return 'bg-orange-100 text-orange-700';
      case 'Mutasi Masuk':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  // ==========================================
  // SINKRONISASI DATA SISWA LAMA
  // ==========================================

  const handleSinkronisasi = async () => {
    if (!isAdmin) return;

    if (siswaList.length === 0) {
      alert('Belum ada data siswa yang dapat disinkronkan.');
      return;
    }

    if (kelasList.length === 0) {
      alert('Data kelas belum tersedia. Periksa menu Data Kelas terlebih dahulu.');
      return;
    }

    if (
      !window.confirm(
        'Sistem akan mencocokkan siswa dengan rombel yang tersedia, menambahkan kelasId pada data siswa yang cocok, dan membuat data ringkas. Data lengkap siswa tidak akan dihapus. Lanjutkan?'
      )
    ) {
      return;
    }

    setIsSyncing(true);

    try {
      const dataBerhasil: Array<{
        siswa: Siswa;
        kelas: Kelas;
      }> = [];

      const dataTidakCocok: string[] = [];

      siswaList.forEach((siswa) => {
        const kelasCocok = cariKelasSiswa(siswa, kelasList);

        if (!kelasCocok) {
          dataTidakCocok.push(
            `${siswa.nama || '-'} | Kelas: ${siswa.kelas || '-'} | Tahun: ${siswa.tahunAjaran || '-'}`
          );
        } else {
          dataBerhasil.push({
            siswa,
            kelas: kelasCocok
          });
        }
      });

      // Maksimal 200 siswa per batch.
      // Setiap siswa memerlukan dua operasi tulis.
      for (let i = 0; i < dataBerhasil.length; i += 200) {
        const potongan = dataBerhasil.slice(i, i + 200);
        const batch = writeBatch(db);

        potongan.forEach(({ siswa, kelas }) => {
          const refSiswa = doc(db, 'siswa', siswa.id);
          const refRingkas = doc(db, 'siswa_ringkas', siswa.id);

          batch.set(
            refSiswa,
            bersihkanUndefined({
              kelasId: kelas.id
            }),
            { merge: true }
          );

          batch.set(
            refRingkas,
            bersihkanUndefined(
              buatDataRingkas(siswa, kelas)
            )
          );
        });

        await batch.commit();
      }

      let pesan =
        `SINKRONISASI SELESAI\n\n` +
        `Berhasil: ${dataBerhasil.length} siswa\n` +
        `Belum cocok: ${dataTidakCocok.length} siswa`;

      if (dataTidakCocok.length > 0) {
        pesan +=
          '\n\nSebagian data belum cocok karena nama kelas atau tahun ajarannya tidak ditemukan secara unik. Data tersebut tidak diubah.';

        pesan +=
          '\n\nContoh data yang perlu diperiksa:\n' +
          dataTidakCocok.slice(0, 8).join('\n');

        if (dataTidakCocok.length > 8) {
          pesan +=
            `\n...dan ${dataTidakCocok.length - 8} data lainnya.`;
        }
      }

      alert(pesan);

    } catch (error) {
      console.error('Gagal sinkronisasi:', error);

      alert(
        'Sinkronisasi gagal. Periksa koneksi Firebase dan hak akses database. Jika sebagian batch sudah tersimpan, jalankan kembali sinkronisasi setelah masalah diperbaiki.'
      );

    } finally {
      setIsSyncing(false);
    }
  };

  // ==========================================
  // DOWNLOAD TEMPLATE EXCEL
  // ==========================================

  const handleDownloadTemplate = () => {
    const formatData = [
      {
        Nama: 'Budi Santoso',
        NISN: '1234567890',
        'Tempat Lahir': 'Makassar',
        'Tanggal Lahir': '2015-08-17',
        Agama: 'Islam',
        'Nama Ayah': 'Joko',
        'Nama Ibu': 'Siti',
        'Pekerjaan Orang Tua': 'Petani',
        Alamat: 'Jl. Pendidikan No. 1',
        'Nomor HP': '081234567890',
        'Tahun Ajaran': '2026/2027',
        Semester: 'Ganjil',
        Kelas: '1A',
        Status: 'Aktif'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(formatData);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Format Siswa');
    XLSX.writeFile(wb, 'Format_Upload_Siswa.xlsx');
  };

  // ==========================================
  // DOWNLOAD DATA SISWA
  // ==========================================

  const handleDownloadFiltered = () => {
    if (!isAdmin) return;

    let filteredData: any[] = [];
    let fileNameSuffix = 'Semua';

    if (downloadTAId) {
      const selectedTA = tahunAjaranList.find(
        (item) => item.id === downloadTAId
      );

      if (!selectedTA) {
        alert('Tahun ajaran tidak ditemukan.');
        return;
      }

      fileNameSuffix =
        `${selectedTA.tahun.replace('/', '-')}_${selectedTA.semester}`;

      siswaList.forEach((siswa) => {
        if (
          siswa.tahunAjaran === selectedTA.tahun &&
          siswa.semester === selectedTA.semester
        ) {
          filteredData.push(siswa);
        } else if (Array.isArray(siswa.riwayat)) {
          const riwayat = siswa.riwayat.find(
            (item: any) =>
              item.tahunAjaran === selectedTA.tahun &&
              item.semester === selectedTA.semester
          );

          if (riwayat) {
            filteredData.push({
              ...siswa,
              tahunAjaran: riwayat.tahunAjaran,
              semester: riwayat.semester,
              kelas: riwayat.kelas,
              status: riwayat.status
            });
          }
        }
      });
    } else {
      filteredData = siswaList;
    }

    if (filteredData.length === 0) {
      alert('Tidak ada data siswa untuk filter yang dipilih.');
      return;
    }

    const dataToExport = filteredData.map((siswa) => ({
      Nama: siswa.nama,
      NISN: siswa.nisn,
      'Tempat Lahir': siswa.tempatLahir,
      'Tanggal Lahir': siswa.tanggalLahir,
      Agama: siswa.agama,
      'Nama Ayah': siswa.namaAyah,
      'Nama Ibu': siswa.namaIbu,
      'Pekerjaan Orang Tua': siswa.pekerjaanOrtu,
      Alamat: siswa.alamat,
      'Nomor HP': siswa.noHp,
      'Tahun Ajaran': siswa.tahunAjaran,
      Semester: siswa.semester || '-',
      Kelas: siswa.kelas,
      Status: siswa.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');

    XLSX.writeFile(
      wb,
      `Data_Siswa_${fileNameSuffix}.xlsx`
    );

    setIsDownloadModalOpen(false);
    setDownloadTAId('');
  };

  // ==========================================
  // UPLOAD EXCEL SISWA
  // ==========================================

  const handleFileUpload = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    if (!isAdmin) return;

    const file = e.target.files?.[0];

    if (!file) return;

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

        // Validasi seluruh kelas terlebih dahulu.
        // Nama rombel dan tahun ajaran harus cocok secara unik.
        const dataSiapSimpan = jsonData.map((row, index) => {
          const tahun = String(
            row['Tahun Ajaran'] || ''
          ).trim();

          const namaKelas = String(
            row.Kelas || ''
          ).trim();

          const kelasCocok = cariKelasSiswa(
            {
              kelas: namaKelas,
              tahunAjaran: tahun || '-'
            },
            kelasList
          );

          if (!kelasCocok) {
            throw new Error(
              `Kelas "${namaKelas}" tahun ajaran "${tahun || '-'}" pada baris ${index + 2} tidak ditemukan secara unik.`
            );
          }

          const siswa = bersihkanUndefined({
            nama: String(row.Nama || '-').trim(),
            nisn: String(row.NISN || '-').trim(),
            tempatLahir: row['Tempat Lahir'] || '',
            tanggalLahir: row['Tanggal Lahir'] || '',
            agama: row.Agama || '',
            namaAyah: row['Nama Ayah'] || '',
            namaIbu: row['Nama Ibu'] || '',
            pekerjaanOrtu: row['Pekerjaan Orang Tua'] || '',
            alamat: row.Alamat || '',
            noHp: String(row['Nomor HP'] || ''),
            tahunAjaran: tahun || kelasCocok.tahunAjaran || '',
            semester: String(row.Semester || ''),
            kelas: namaKelas,
            kelasId: kelasCocok.id,
            status: row.Status || 'Aktif',
            riwayat: []
          });

          return {
            siswa,
            kelas: kelasCocok
          };
        });

        // Maksimal 200 siswa per batch.
        for (
          let i = 0;
          i < dataSiapSimpan.length;
          i += 200
        ) {
          const potongan = dataSiapSimpan.slice(i, i + 200);
          const batch = writeBatch(db);

          potongan.forEach(({ siswa, kelas }) => {
            const refSiswa = doc(collection(db, 'siswa'));

            const refRingkas = doc(
              db,
              'siswa_ringkas',
              refSiswa.id
            );

            batch.set(
              refSiswa,
              bersihkanUndefined(siswa)
            );

            batch.set(
              refRingkas,
              bersihkanUndefined(
                buatDataRingkas(siswa, kelas)
              )
            );
          });

          await batch.commit();
        }

        alert(
          `Berhasil mengimpor ${dataSiapSimpan.length} data siswa beserta data ringkasnya.`
        );

      } catch (error) {
        console.error('Gagal mengimpor siswa:', error);

        const pesan =
          error instanceof Error
            ? error.message
            : 'Pastikan format file sesuai dengan template.';

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
  // FORM TAMBAH SISWA
  // ==========================================

  const handleOpenTambah = () => {
    if (!isAdmin) return;

    setEditId(null);

    setNama('');
    setNisn('');
    setTempatLahir('');
    setTanggalLahir('');

    setNamaAyah('');
    setNamaIbu('');
    setPekerjaanOrtu('');

    setAlamat('');
    setNoHp('');
    setAgama('Islam');

    setTahunAjaranId('');
    setTahunAjaran('');
    setSemester('');

    setKelas('');
    setKelasId('');

    setStatus('Aktif');

    setIsModalOpen(true);
  };

  // ==========================================
  // FORM EDIT SISWA
  // ==========================================

  const handleOpenEdit = (siswa: Siswa) => {
    if (!isAdmin) return;

    setEditId(siswa.id);

    setNama(siswa.nama || '');
    setNisn(siswa.nisn || '');

    setTempatLahir(siswa.tempatLahir || '');
    setTanggalLahir(siswa.tanggalLahir || '');

    setAgama(siswa.agama || 'Islam');

    setNamaAyah(siswa.namaAyah || '');
    setNamaIbu(siswa.namaIbu || '');
    setPekerjaanOrtu(siswa.pekerjaanOrtu || '');

    setAlamat(siswa.alamat || '');
    setNoHp(siswa.noHp || '');

    const kelasCocok = cariKelasSiswa(siswa, kelasList);

    // Jika data lama belum memiliki tahun ajaran,
    // gunakan tahun dari kelas hanya apabila kelasnya unik.
    const tahunSiswa =
      siswa.tahunAjaran &&
      siswa.tahunAjaran !== '-'
        ? siswa.tahunAjaran
        : kelasCocok?.tahunAjaran || '';

    const daftarTA = tahunAjaranList.filter(
      (item) => item.tahun === tahunSiswa
    );

    let taCocok = daftarTA.find(
      (item) => item.semester === siswa.semester
    );

    if (!taCocok) {
      taCocok = daftarTA.find(
        (item) => item.status === 'Aktif'
      );
    }

    if (!taCocok && daftarTA.length > 0) {
      taCocok = daftarTA[0];
    }

    setTahunAjaranId(taCocok?.id || '');
    setTahunAjaran(taCocok?.tahun || tahunSiswa);
    setSemester(taCocok?.semester || siswa.semester || '');

    setKelas(siswa.kelas || kelasCocok?.namaKelas || '');
    setKelasId(kelasCocok?.id || '');

    setStatus(siswa.status || 'Aktif');

    setIsModalOpen(true);
  };

  // ==========================================
  // SIMPAN SISWA
  // ==========================================

  const handleSimpanSiswa = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!isAdmin) return;

    const kelasTerpilih = kelasList.find(
      (item) =>
        item.id === kelasId &&
        item.namaKelas === kelas &&
        item.tahunAjaran === tahunAjaran
    );

    if (!kelasTerpilih) {
      alert(
        'Kelas belum dipilih dengan benar. Silakan pilih ulang kelas siswa.'
      );
      return;
    }

    if (!nama.trim() || !nisn.trim()) {
      alert('Nama siswa dan NISN wajib diisi.');
      return;
    }

    try {
      const siswaLama = editId
        ? siswaList.find((item) => item.id === editId)
        : null;

      const dataRiwayat = siswaLama
        ? [...(siswaLama.riwayat || [])]
        : [];

      if (
        siswaLama &&
        (
          siswaLama.tahunAjaran !== tahunAjaran ||
          siswaLama.semester !== semester ||
          siswaLama.kelas !== kelas ||
          siswaLama.kelasId !== kelasTerpilih.id
        )
      ) {
        const sudahAda = dataRiwayat.some(
          (item: any) =>
            item.tahunAjaran === siswaLama.tahunAjaran &&
            item.semester === siswaLama.semester &&
            item.kelas === siswaLama.kelas &&
            item.kelasId === siswaLama.kelasId
        );

        if (
          !sudahAda &&
          siswaLama.tahunAjaran &&
          siswaLama.tahunAjaran !== '-'
        ) {
          dataRiwayat.push({
            tahunAjaran: siswaLama.tahunAjaran,
            semester: siswaLama.semester || '',
            kelas: siswaLama.kelas || '',
            kelasId: siswaLama.kelasId || null,
            status: siswaLama.status || 'Aktif'
          });
        }
      }

      const dataBaru = bersihkanUndefined({
        nama: nama.trim(),
        nisn: nisn.trim(),
        tempatLahir,
        tanggalLahir,
        agama,
        namaAyah,
        namaIbu,
        pekerjaanOrtu,
        alamat,
        noHp,
        tahunAjaran,
        semester,
        kelas,
        kelasId: kelasTerpilih.id,
        status,
        riwayat: dataRiwayat
      });

      const ringkas = bersihkanUndefined(
        buatDataRingkas(dataBaru, kelasTerpilih)
      );

      const batch = writeBatch(db);

      const refSiswa = editId
        ? doc(db, 'siswa', editId)
        : doc(collection(db, 'siswa'));

      const refRingkas = doc(
        db,
        'siswa_ringkas',
        refSiswa.id
      );

      batch.set(
        refSiswa,
        dataBaru,
        { merge: true }
      );

      batch.set(
        refRingkas,
        ringkas
      );

      await batch.commit();

      setIsModalOpen(false);

      alert(
        editId
          ? 'Data siswa berhasil diperbarui.'
          : 'Data siswa berhasil ditambahkan.'
      );

    } catch (error) {
      console.error('Gagal menyimpan siswa:', error);
      alert('Gagal menyimpan data siswa: ' + error);
    }
  };

  // ==========================================
  // HAPUS SISWA DAN DATA RINGKAS
  // ==========================================

  const handleHapus = async (id: string) => {
    if (!isAdmin) return;

    if (
      window.confirm(
        'Apakah Anda yakin ingin menghapus data siswa ini? Data lengkap dan data ringkasnya akan dihapus.'
      )
    ) {
      try {
        const batch = writeBatch(db);

        batch.delete(doc(db, 'siswa', id));
        batch.delete(doc(db, 'siswa_ringkas', id));

        await batch.commit();

        alert('Data siswa berhasil dihapus.');

      } catch (error) {
        console.error('Gagal menghapus siswa:', error);
        alert('Gagal menghapus data siswa: ' + error);
      }
    }
  };

  // ==========================================
  // TAMPILAN LOADING
  // ==========================================

  if (loadingHalaman) {
    return (
      <div className="p-10 text-center font-bold text-slate-500">
        Memuat data siswa...
      </div>
    );
  }

  // ==========================================
  // TAMPILAN ERROR
  // ==========================================

  if (loadError || profileError) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-3xl mx-auto">
        <h2 className="text-lg font-bold text-red-600 mb-2">
          Data Tidak Dapat Ditampilkan
        </h2>

        <p className="text-sm text-slate-600">
          {profileError || loadError}
        </p>
      </div>
    );
  }

  if (!isAdmin && !isKepsek && !isGuru) {
    return (
      <div className="p-10 text-center text-slate-500">
        Anda tidak memiliki izin untuk membuka halaman ini.
      </div>
    );
  }

  // ==========================================
  // RENDER HALAMAN
  // ==========================================

  const jumlahKolom = isAdmin ? 8 : 7;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">

      {/* HEADER HALAMAN */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">

        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">
            {isGuru
              ? 'Data Siswa Kelas yang Diampu'
              : 'Data Siswa'}
          </h1>

          <p className="text-slate-500 mt-1 font-medium">
            {isGuru
              ? 'Informasi ringkas siswa sesuai penugasan kelas Anda.'
              : isAdmin
                ? 'Kelola profil dan riwayat akademik seluruh siswa.'
                : 'Monitoring informasi siswa sekolah.'}
          </p>
        </div>

        {/* TOMBOL KHUSUS ADMIN */}
        {isAdmin && (
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
              className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-semibold text-sm border border-slate-300 shadow-sm"
            >
              Template
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-[#155EEF] hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {isUploading ? 'Mengunggah...' : 'Upload Excel'}
            </button>

            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm"
            >
              Download Data
            </button>

            <button
              onClick={handleSinkronisasi}
              disabled={isSyncing}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {isSyncing
                ? 'Menyinkronkan...'
                : 'Sinkronisasi Data Ringkas'}
            </button>

            <button
              onClick={handleOpenTambah}
              className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm"
            >
              + Tambah Siswa
            </button>

          </div>
        )}
      </div>

      {/* INFORMASI AKSES GURU */}
      {isGuru && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">

          <p className="text-sm font-bold text-blue-800">
            Informasi Akses Guru
          </p>

          <p className="text-sm text-blue-700 mt-1">
            Anda hanya dapat melihat nama, NISN, kelas, tahun ajaran,
            semester, dan status siswa pada rombel yang ditugaskan.
          </p>

          <p className="text-xs text-blue-700 mt-2">
            Rombel yang dapat diakses:{' '}
            {kelasDiizinkan.length > 0
              ? kelasDiizinkan
                  .map((id) => {
                    const item = kelasList.find(
                      (kelas) => kelas.id === id
                    );

                    return item
                      ? `${item.namaKelas} (${item.jenjang})`
                      : '';
                  })
                  .filter(Boolean)
                  .join(', ')
              : 'Belum ada rombel yang ditugaskan pada tahun ajaran aktif.'}
          </p>

        </div>
      )}

      {/* INFORMASI KEPALA SEKOLAH */}
      {isKepsek && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          Anda menggunakan akses monitoring. Data siswa dapat dilihat,
          tetapi tidak dapat ditambah, diedit, atau dihapus.
        </div>
      )}

      {/* FILTER STATUS DAN PENCARIAN */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">

        <div className="flex overflow-x-auto pb-2 xl:pb-0 gap-2 w-full xl:w-auto">
          {[
            'Semua',
            'Aktif',
            'Lulus',
            'Pindah Keluar',
            'Tinggal Kelas'
          ].map((item) => (
            <button
              key={item}
              onClick={() => setFilterStatus(item)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                filterStatus === item
                  ? 'bg-[#EFF6FF] text-[#155EEF]'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {item === 'Semua' ? 'Semua Siswa' : item}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Cari Nama atau NISN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full xl:w-64 px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none text-sm"
        />

      </div>

      {/* TABEL DATA SISWA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">

          <table className="w-full text-left border-collapse whitespace-nowrap">

            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <th className="p-4 text-xs font-bold uppercase">No</th>
                <th className="p-4 text-xs font-bold uppercase">Nama Siswa</th>
                <th className="p-4 text-xs font-bold uppercase">NISN</th>
                <th className="p-4 text-xs font-bold uppercase">Tahun Ajaran</th>
                <th className="p-4 text-xs font-bold uppercase">Semester</th>
                <th className="p-4 text-xs font-bold uppercase">Kelas / Rombel</th>
                <th className="p-4 text-xs font-bold uppercase">Status</th>

                {isAdmin && (
                  <th className="p-4 text-xs font-bold uppercase">Aksi</th>
                )}
              </tr>
            </thead>

            <tbody>
              {siswaTampil.length === 0 ? (
                <tr>
                  <td
                    colSpan={jumlahKolom}
                    className="p-8 text-center text-slate-500 font-medium"
                  >
                    {isGuru && kelasDiizinkan.length === 0
                      ? 'Belum ada rombel yang ditugaskan kepada Anda.'
                      : 'Tidak ada data siswa ditemukan.'}
                  </td>
                </tr>
              ) : (
                siswaTampil.map((siswa, index) => (
                  <tr
                    key={siswa.id}
                    className="border-b border-slate-100 hover:bg-[#F5F7FB] text-sm"
                  >
                    <td className="p-4 text-slate-500">
                      {index + 1}
                    </td>

                    <td className="p-4 font-bold text-[#082B62]">
                      {siswa.nama}
                    </td>

                    <td className="p-4 text-slate-600">
                      {siswa.nisn}
                    </td>

                    <td className="p-4 text-slate-600">
                      {siswa.tahunAjaran || '-'}
                    </td>

                    <td className="p-4 text-slate-600">
                      {siswa.semester || '-'}
                    </td>

                    <td className="p-4">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-md text-xs font-bold">
                        {siswa.kelas || '-'}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-md text-xs font-bold ${getStatusBadge(siswa.status)}`}>
                        {siswa.status || 'Aktif'}
                      </span>
                    </td>

                    {isAdmin && (
                      <td className="p-4">

                        <button
                          onClick={() => handleOpenEdit(siswa)}
                          className="text-[#155EEF] font-bold mr-4"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleHapus(siswa.id)}
                          className="text-red-500 font-bold"
                        >
                          Hapus
                        </button>

                      </td>
                    )}

                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>
      </div>

      {/* MODAL DOWNLOAD EXCEL */}
      {isAdmin && isDownloadModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">

          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">

            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-[#082B62]">
                Filter Download Data Siswa
              </h2>

              <button
                onClick={() => setIsDownloadModalOpen(false)}
                className="text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Tahun Ajaran dan Semester
                </label>

                <select
                  value={downloadTAId}
                  onChange={(e) => setDownloadTAId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">
                    -- Semua Data Siswa --
                  </option>

                  {tahunAjaranList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.tahun} - {item.semester}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">

                <button
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 font-bold"
                >
                  Batal
                </button>

                <button
                  onClick={handleDownloadFiltered}
                  className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg"
                >
                  Download Excel
                </button>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT SISWA */}
      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 bg-[#0B1F46]/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">

          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-3xl shadow-2xl my-auto">

            <div className="flex items-center justify-between mb-8 border-b pb-4">

              <h2 className="text-2xl font-bold text-[#0B1F46]">
                {editId ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
              </h2>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={handleSimpanSiswa}
              className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5"
            >

              {/* PROFIL SISWA */}
              <div className="space-y-5">

                <h3 className="font-bold text-[#155EEF] border-b pb-1">
                  Profil Siswa
                </h3>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Nama Lengkap
                  </label>

                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    NISN
                  </label>

                  <input
                    type="text"
                    value={nisn}
                    onChange={(e) => setNisn(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm font-bold mb-1.5">
                      Tempat Lahir
                    </label>

                    <input
                      type="text"
                      value={tempatLahir}
                      onChange={(e) => setTempatLahir(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1.5">
                      Tanggal Lahir
                    </label>

                    <input
                      type="date"
                      value={tanggalLahir}
                      onChange={(e) => setTanggalLahir(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl"
                    />
                  </div>

                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Agama
                  </label>

                  <select
                    value={agama}
                    onChange={(e) => setAgama(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    {pilihanAgama.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Nomor HP
                  </label>

                  <input
                    type="text"
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Alamat Lengkap
                  </label>

                  <textarea
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl resize-none"
                  />
                </div>

              </div>

              {/* AKADEMIK DAN ORANG TUA */}
              <div className="space-y-5">

                <h3 className="font-bold text-[#155EEF] border-b pb-1">
                  Data Akademik dan Riwayat
                </h3>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Tahun Ajaran dan Semester
                  </label>

                  <select
                    value={tahunAjaranId}
                    onChange={(e) => {
                      const idTA = e.target.value;

                      const dataTA = tahunAjaranList.find(
                        (item) => item.id === idTA
                      );

                      setTahunAjaranId(idTA);
                      setTahunAjaran(dataTA?.tahun || '');
                      setSemester(dataTA?.semester || '');

                      setKelas('');
                      setKelasId('');
                    }}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">
                      -- Pilih Tahun Ajaran --
                    </option>

                    {tahunAjaranList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.tahun} - {item.semester}
                        {item.status === 'Aktif' ? ' ✓ Aktif' : ''}
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-emerald-600 mt-1">
                    Perubahan tahun ajaran atau kelas akan menyimpan
                    data akademik sebelumnya ke riwayat.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Kelas / Rombel
                  </label>

                  <select
                    value={kelasId}
                    onChange={(e) => {
                      const idKelas = e.target.value;

                      const dataKelas = kelasList.find(
                        (item) => item.id === idKelas
                      );

                      setKelasId(idKelas);
                      setKelas(dataKelas?.namaKelas || '');
                    }}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">
                      -- Pilih Kelas --
                    </option>

                    {pilihanKelasDinamis.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.namaKelas} — {item.jenjang}, Tingkat {item.tingkat}
                      </option>
                    ))}
                  </select>

                  {pilihanKelasDinamis.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Belum ada kelas untuk tahun ajaran ini.
                    </p>
                  )}

                  {editId && !kelasId && kelas && (
                    <p className="text-xs text-amber-600 mt-1">
                      Kelas lama belum dapat dicocokkan. Silakan pilih ulang kelas siswa.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Status Siswa
                  </label>

                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-xl font-bold ${getStatusBadge(status)}`}
                  >
                    {pilihanStatus.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <h3 className="font-bold text-[#155EEF] border-b pb-1 pt-3">
                  Data Orang Tua
                </h3>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Nama Ayah
                  </label>

                  <input
                    type="text"
                    value={namaAyah}
                    onChange={(e) => setNamaAyah(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Nama Ibu
                  </label>

                  <input
                    type="text"
                    value={namaIbu}
                    onChange={(e) => setNamaIbu(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    Pekerjaan Orang Tua
                  </label>

                  <input
                    type="text"
                    value={pekerjaanOrtu}
                    onChange={(e) => setPekerjaanOrtu(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

              </div>

              {/* TOMBOL FORM */}
              <div className="md:col-span-2 flex justify-end gap-3 mt-4 border-t pt-6">

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="px-8 py-2.5 bg-[#155EEF] hover:bg-blue-700 text-white font-bold rounded-xl"
                >
                  {editId ? 'Simpan Perubahan' : 'Simpan Data'}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
