import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

 type StatusAbsensi = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
 type TabAbsensi = 'manual' | 'scan' | 'kartu';

interface Kelas {
  id: string;
  namaKelas: string;
  jenjang: 'SD' | 'SMP' | string;
  tingkat: number | string;
  tahunAjaran: string;
  waliKelas?: string;
  waliKelasId?: string | null;
}

interface Siswa {
  id: string;
  nama: string;
  nisn: string;
  kelas?: string;
  kelasId?: string;
  tahunAjaran?: string;
  semester?: string;
  status?: string;
  fotoUrl?: string;
}

interface TahunAjaran {
  id: string;
  tahun: string;
  semester: string;
  status: string;
}

interface GuruProfile {
  id: string;
  nama: string;
  jabatan: string;
  kelasDiampu?: string[];
}

interface AttendanceRecord {
  nisn: string;
  status: StatusAbsensi;
  kelas?: string;
  kelasId?: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

// Tanggal lokal perangkat, bukan UTC, agar tanggal absensi tidak bergeser.
const tanggalLokal = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const angkaRomawi = (value: number | string) => {
  const number = Number.parseInt(String(value), 10);
  const map: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX',
  };
  return map[number] || String(value || '-');
};

const labelKelas = (kelas: Kelas) =>
  `${kelas.namaKelas} — ${kelas.jenjang}, Tingkat ${angkaRomawi(kelas.tingkat)}`;

const siswaMasihAktif = (siswa: Siswa) =>
  !['Lulus', 'Pindah Keluar'].includes(String(siswa.status || 'Aktif'));

const idDokumenAbsensi = (tanggal: string, nisn: string) =>
  `${tanggal}_${nisn.trim()}`;

const potong = <T,>(items: T[], size: number): T[][] => {
  const hasil: T[][] = [];
  for (let i = 0; i < items.length; i += size) hasil.push(items.slice(i, i + size));
  return hasil;
};

export default function Absensi() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const isGuru = userData?.role === 'guru';
  const isKepsek = userData?.role === 'kepsek';
  const bolehMengubah = isAdmin || isGuru;

  const [activeTab, setActiveTab] = useState<TabAbsensi>('manual');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaran[]>([]);
  const [jenjangSekolah, setJenjangSekolah] = useState<string[]>([]);
  const [namaSekolah, setNamaSekolah] = useState('Sekolah Digital');
  const [npsnSekolah, setNpsnSekolah] = useState('');
  const [guruProfile, setGuruProfile] = useState<GuruProfile | null>(null);

  const [loadingMaster, setLoadingMaster] = useState(true);
  const [loadingSiswa, setLoadingSiswa] = useState(true);
  const [loadingGuru, setLoadingGuru] = useState(isGuru);
  const [loadingAbsensi, setLoadingAbsensi] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Pilihan ini berlaku untuk satu tanggal dan rombel yang sedang dipilih.
  // Pengiriman WhatsApp baru aktif setelah backend Cloud Functions dikonfigurasi.
  const [aktifkanNotifikasiAlpa, setAktifkanNotifikasiAlpa] = useState(false);
  const [errorHalaman, setErrorHalaman] = useState('');
  const [errorGuru, setErrorGuru] = useState('');

  const [selectedTanggal, setSelectedTanggal] = useState(tanggalLokal());
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [absensiHariIni, setAbsensiHariIni] = useState<Record<string, StatusAbsensi>>({});
  const [scanMessage, setScanMessage] = useState('');
  const [scanError, setScanError] = useState('');

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scanSedangDiproses = useRef(false);
  const absensiRef = useRef<Record<string, StatusAbsensi>>({});

  useEffect(() => {
    absensiRef.current = absensiHariIni;
  }, [absensiHariIni]);

  const tahunAktif = useMemo(
    () => tahunAjaranList.find((item) => item.status === 'Aktif') || null,
    [tahunAjaranList]
  );

  // Data master sekolah, konfigurasi jenjang, dan rombel sesuai peran.
  useEffect(() => {
    let kelasReady = false;
    let tahunReady = false;
    let pengaturanReady = false;
    let masihAktif = true;
    const unsubscribers: Unsubscribe[] = [];

    setLoadingMaster(true);

    const cekSelesai = () => {
      if (masihAktif && kelasReady && tahunReady && pengaturanReady) {
        setLoadingMaster(false);
      }
    };

    // Admin dan Kepala Sekolah dapat membaca daftar rombel sekolah.
    if (!isGuru) {
      const unsubKelas = onSnapshot(
        collection(db, 'kelas'),
        (snapshot) => {
          if (!masihAktif) return;
          setKelasList(
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Kelas[]
          );
          kelasReady = true;
          cekSelesai();
        },
        (error) => {
          console.error('Gagal membaca rombel:', error);
          if (!masihAktif) return;
          setErrorHalaman('Data rombel tidak dapat dibaca dari Firebase.');
          kelasReady = true;
          cekSelesai();
        }
      );
      unsubscribers.push(unsubKelas);
    } else if (loadingGuru) {
      // Tunggu profil Guru selesai dimuat sebelum meminta rombel yang ditugaskan.
      kelasReady = false;
    } else if (!guruProfile) {
      setKelasList([]);
      kelasReady = true;
      cekSelesai();
    } else {
      // Guru hanya membaca rombel wali kelas miliknya dan dokumen rombel
      // yang secara eksplisit tercantum pada kelasDiampu di profil Guru.
      const kelasWaliMap = new Map<string, Kelas>();
      const kelasMapelMap = new Map<string, Kelas>();
      const kelasMapelIds = Array.from(
        new Set(
          (Array.isArray(guruProfile.kelasDiampu) ? guruProfile.kelasDiampu : [])
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            .map((id) => id.trim())
        )
      );
      const mapelSiap = new Set<string>();
      let kelasWaliSiap = false;

      const kirimKelas = () => {
        if (!masihAktif) return;
        const gabungan = new Map<string, Kelas>(kelasWaliMap);
        kelasMapelMap.forEach((kelas, id) => gabungan.set(id, kelas));
        setKelasList(Array.from(gabungan.values()));
      };

      const tandaiKelasSiap = () => {
        if (!masihAktif) return;
        if (kelasWaliSiap && mapelSiap.size === kelasMapelIds.length) {
          kelasReady = true;
          kirimKelas();
          cekSelesai();
        }
      };

      const unsubKelasWali = onSnapshot(
        query(
          collection(db, 'kelas'),
          where('waliKelasId', '==', guruProfile.id)
        ),
        (snapshot) => {
          if (!masihAktif) return;
          kelasWaliMap.clear();
          snapshot.docs.forEach((item) => {
            kelasWaliMap.set(item.id, { id: item.id, ...item.data() } as Kelas);
          });
          kelasWaliSiap = true;
          kirimKelas();
          tandaiKelasSiap();
        },
        (error) => {
          console.error('Gagal membaca rombel wali kelas:', error);
          if (!masihAktif) return;
          setErrorHalaman('Rombel wali kelas tidak dapat dibaca. Periksa penugasan dan aturan akses Firebase.');
          kelasWaliSiap = true;
          tandaiKelasSiap();
        }
      );
      unsubscribers.push(unsubKelasWali);

      kelasMapelIds.forEach((kelasId) => {
        const unsubKelasMapel = onSnapshot(
          doc(db, 'kelas', kelasId),
          (snapshot) => {
            if (!masihAktif) return;
            if (snapshot.exists()) {
              kelasMapelMap.set(
                snapshot.id,
                { id: snapshot.id, ...snapshot.data() } as Kelas
              );
            } else {
              kelasMapelMap.delete(kelasId);
            }
            mapelSiap.add(kelasId);
            kirimKelas();
            tandaiKelasSiap();
          },
          (error) => {
            console.error(`Gagal membaca rombel mapel ${kelasId}:`, error);
            if (!masihAktif) return;
            setErrorHalaman('Sebagian rombel mata pelajaran tidak dapat dibaca. Periksa penugasan dan aturan akses Firebase.');
            mapelSiap.add(kelasId);
            tandaiKelasSiap();
          }
        );
        unsubscribers.push(unsubKelasMapel);
      });
    }

    const queryTahunAjaran = isAdmin
      ? collection(db, 'tahun_ajaran')
      : query(collection(db, 'tahun_ajaran'), where('status', '==', 'Aktif'));

    const unsubTahun = onSnapshot(
      queryTahunAjaran,
      (snapshot) => {
        if (!masihAktif) return;
        setTahunAjaranList(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TahunAjaran[]
        );
        tahunReady = true;
        cekSelesai();
      },
      (error) => {
        console.error('Gagal membaca tahun ajaran:', error);
        if (!masihAktif) return;
        setErrorHalaman('Data tahun ajaran tidak dapat dibaca dari Firebase.');
        tahunReady = true;
        cekSelesai();
      }
    );
    unsubscribers.push(unsubTahun);

    const unsubPengaturan = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      (snapshot) => {
        if (!masihAktif) return;
        const data = snapshot.exists() ? snapshot.data() : {};
        setNamaSekolah(data.namaSekolah || 'Sekolah Digital');
        setNpsnSekolah(data.npsn || '');
        const tersedia = Array.isArray(data.jenjangSekolah)
          ? ['SD', 'SMP'].filter((item) => data.jenjangSekolah.includes(item))
          : [];
        setJenjangSekolah(tersedia);
        pengaturanReady = true;
        cekSelesai();
      },
      (error) => {
        console.error('Gagal membaca pengaturan sekolah:', error);
        if (!masihAktif) return;
        setErrorHalaman('Konfigurasi jenjang sekolah tidak dapat dibaca. Periksa menu Pengaturan dan hak akses Firebase.');
        pengaturanReady = true;
        cekSelesai();
      }
    );
    unsubscribers.push(unsubPengaturan);

    return () => {
      masihAktif = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [isAdmin, isGuru, loadingGuru, guruProfile]);

  // Profil guru ditautkan melalui users/{uid}.guruId ke guru/{guruId}.
  useEffect(() => {
    if (!isGuru) {
      setGuruProfile(null);
      setErrorGuru('');
      setLoadingGuru(false);
      return;
    }

    if (!userData?.guruId) {
      setGuruProfile(null);
      setErrorGuru('Akun Guru belum terhubung dengan Data Pegawai. Hubungi Administrator untuk menghubungkan akun melalui Manajemen Pengguna.');
      setLoadingGuru(false);
      return;
    }

    let masihAktif = true;
    setLoadingGuru(true);
    setErrorGuru('');

    const ambilProfil = async () => {
      try {
        const snapshot = await getDoc(doc(db, 'guru', userData.guruId!));
        if (!masihAktif) return;
        if (!snapshot.exists()) {
          setGuruProfile(null);
          setErrorGuru('Data pegawai yang terhubung dengan akun ini tidak ditemukan.');
        } else {
          setGuruProfile({ id: snapshot.id, ...snapshot.data() } as GuruProfile);
        }
      } catch (error) {
        console.error('Gagal mengambil profil guru:', error);
        if (masihAktif) {
          setGuruProfile(null);
          setErrorGuru('Profil Guru tidak dapat dibaca dari Firebase.');
        }
      } finally {
        if (masihAktif) setLoadingGuru(false);
      }
    };

    ambilProfil();
    return () => { masihAktif = false; };
  }, [isGuru, userData?.guruId]);

  // Rombel aktif yang boleh dipilih masing-masing peran.
  const kelasTahunAktif = useMemo(() => {
    if (!tahunAktif || jenjangSekolah.length === 0) return [];
    return kelasList
      .filter((item) => item.tahunAjaran === tahunAktif.tahun && jenjangSekolah.includes(String(item.jenjang || '').toUpperCase()))
      .sort((a, b) => {
        if (a.jenjang !== b.jenjang) return a.jenjang === 'SD' ? -1 : 1;
        const tingkatA = Number.parseInt(String(a.tingkat), 10) || 0;
        const tingkatB = Number.parseInt(String(b.tingkat), 10) || 0;
        if (tingkatA !== tingkatB) return tingkatA - tingkatB;
        return (a.namaKelas || '').localeCompare(b.namaKelas || '', 'id', { numeric: true });
      });
  }, [kelasList, tahunAktif?.tahun, jenjangSekolah]);

  const kelasDiizinkan = useMemo(() => {
    if (!isGuru || !guruProfile) return [];

    if (guruProfile.jabatan === 'Guru Mata Pelajaran') {
      const idKelas = Array.isArray(guruProfile.kelasDiampu) ? guruProfile.kelasDiampu : [];
      return kelasTahunAktif.filter((item) => idKelas.includes(item.id));
    }

    if (guruProfile.jabatan === 'Wali Kelas') {
      return kelasTahunAktif.filter((item) => item.waliKelasId === guruProfile.id);
    }

    return [];
  }, [isGuru, guruProfile, kelasTahunAktif]);

  const kelasTersedia = isGuru ? kelasDiizinkan : kelasTahunAktif;
  const kelasTerpilih = kelasTersedia.find((item) => item.id === selectedKelasId) || null;

  // Admin/Kepala Sekolah membaca data siswa lengkap. Guru hanya membaca siswa_ringkas
  // untuk ID rombel yang ditugaskan kepadanya.
  useEffect(() => {
    if (isGuru) return;
    if (!isAdmin && !isKepsek) {
      setSiswaList([]);
      setLoadingSiswa(false);
      return;
    }

    setLoadingSiswa(true);
    const unsub = onSnapshot(
      collection(db, 'siswa'),
      (snapshot) => {
        setSiswaList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Siswa[]);
        setLoadingSiswa(false);
      },
      (error) => {
        console.error('Gagal membaca data siswa:', error);
        setErrorHalaman('Data siswa tidak dapat dibaca. Periksa koneksi dan hak akses Firebase.');
        setLoadingSiswa(false);
      }
    );
    return () => unsub();
  }, [isGuru, isAdmin, isKepsek]);

  useEffect(() => {
    if (!isGuru) return;
    if (loadingGuru || loadingMaster) return;

    if (!guruProfile || kelasDiizinkan.length === 0) {
      setSiswaList([]);
      setLoadingSiswa(false);
      return;
    }

    setLoadingSiswa(true);
    const kelompok = potong(kelasDiizinkan.map((item) => item.id), 30);
    const hasil = new Map<number, Siswa[]>();
    const unsubscribers: Unsubscribe[] = [];
    let awalSelesai = 0;
    

    kelompok.forEach((idKelompok, index) => {
      const q = query(collection(db, 'siswa_ringkas'), where('kelasId', 'in', idKelompok));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Siswa[];
          if (!hasil.has(index)) awalSelesai += 1;
          hasil.set(index, data);
          const gabungan = Array.from(hasil.values()).flat();
          const unik = new Map(gabungan.map((item) => [item.id, item]));
          setSiswaList(Array.from(unik.values()));
          if (awalSelesai === kelompok.length) setLoadingSiswa(false);
        },
        (error) => {
          console.error('Gagal membaca data siswa ringkas:', error);
          
          setSiswaList([]);
          setErrorHalaman('Data siswa ringkas tidak dapat dibaca. Pastikan Sinkronisasi Data Ringkas sudah dijalankan oleh Admin dan hak akses Firebase sudah sesuai.');
          setLoadingSiswa(false);
        }
      );
      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [isGuru, guruProfile, loadingGuru, loadingMaster, kelasDiizinkan.map((item) => item.id).join('|')]);

  // Pilih rombel pertama secara otomatis jika pilihan sebelumnya sudah tidak tersedia.
  useEffect(() => {
    if (loadingMaster || loadingGuru) return;
    if (kelasTersedia.length === 0) {
      setSelectedKelasId('');
      setAbsensiHariIni({});
      return;
    }
    if (!kelasTersedia.some((item) => item.id === selectedKelasId)) {
      setSelectedKelasId(kelasTersedia[0].id);
    }
  }, [loadingMaster, loadingGuru, kelasTersedia, selectedKelasId]);

  const siswaDiKelas = useMemo(() => {
    if (!kelasTerpilih) return [];
    return siswaList
      .filter((siswa) => {
        if (!siswaMasihAktif(siswa)) return false;
        const tahunCocok = !siswa.tahunAjaran || siswa.tahunAjaran === kelasTerpilih.tahunAjaran;
        const kelasCocok = siswa.kelasId
          ? siswa.kelasId === kelasTerpilih.id
          : siswa.kelas === kelasTerpilih.namaKelas && tahunCocok;
        return kelasCocok && tahunCocok;
      })
      .sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
  }, [siswaList, kelasTerpilih]);

  // Muat kehadiran berdasarkan tanggal. kelasId menjadi kunci utama;
  // nama rombel hanya digunakan untuk membaca data lama yang belum memiliki kelasId.
  useEffect(() => {
    if (!selectedTanggal || !kelasTerpilih) {
      setAbsensiHariIni({});
      setLoadingAbsensi(false);
      return;
    }

    setLoadingAbsensi(true);
    setAbsensiHariIni({});

    // Guru hanya membaca absensi pada rombel yang sedang dipilih.
    // Admin/Kepala Sekolah tetap dapat melihat catatan tanggal tersebut,
    // termasuk catatan lama yang belum memiliki kelasId.
    const qAbsensi = isGuru
      ? query(
          collection(db, 'absensi'),
          where('kelasId', '==', kelasTerpilih.id),
          where('tanggal', '==', selectedTanggal)
        )
      : query(
          collection(db, 'absensi'),
          where('tanggal', '==', selectedTanggal)
        );

    const unsub = onSnapshot(
      qAbsensi,
  
      (snapshot) => {
        const data: Record<string, StatusAbsensi> = {};
        snapshot.docs.forEach((item) => {
          const record = item.data() as AttendanceRecord;
          const cocokKelas = isGuru
            ? record.kelasId === kelasTerpilih.id
            : record.kelasId
              ? record.kelasId === kelasTerpilih.id
              : record.kelas === kelasTerpilih.namaKelas;
          if (cocokKelas && record.nisn && ['Hadir', 'Sakit', 'Izin', 'Alpa'].includes(record.status)) {
            data[record.nisn] = record.status;
          }
        });
        setAbsensiHariIni(data);
        setLoadingAbsensi(false);
      },
      (error) => {
        console.error('Gagal memuat absensi:', error);
        setErrorHalaman('Data absensi tidak dapat dibaca. Periksa koneksi dan hak akses Firebase.');
        setLoadingAbsensi(false);
      }
    );

    return () => unsub();
  }, [isGuru, selectedTanggal, kelasTerpilih?.id, kelasTerpilih?.namaKelas]);

  const ringkasan = useMemo(() => {
    const total = siswaDiKelas.length;
    // Hitung hanya status siswa yang saat ini berada di rombel terpilih.
    const nilai = siswaDiKelas
      .map((siswa) => absensiHariIni[siswa.nisn])
      .filter((status): status is StatusAbsensi => Boolean(status));
    const hadir = nilai.filter((item) => item === 'Hadir').length;
    const sakit = nilai.filter((item) => item === 'Sakit').length;
    const izin = nilai.filter((item) => item === 'Izin').length;
    const alpa = nilai.filter((item) => item === 'Alpa').length;
    const tercatat = hadir + sakit + izin + alpa;
    const belum = Math.max(0, total - tercatat);
    const persentase = total > 0 ? Math.round((hadir / total) * 1000) / 10 : 0;
    return { total, hadir, sakit, izin, alpa, tercatat, belum, persentase };
  }, [siswaDiKelas, absensiHariIni]);

  const simpanSatuAbsensi = useCallback(async (siswa: Siswa, status: StatusAbsensi, metode: 'Manual' | 'Scan QR') => {
    if (!kelasTerpilih) throw new Error('Pilih rombel terlebih dahulu.');
    if (!siswa.nisn) throw new Error('NISN siswa tidak tersedia.');

    const ref = doc(db, 'absensi', idDokumenAbsensi(selectedTanggal, siswa.nisn));
    const sekarang = new Date().toISOString();
    // Penyimpanan menggunakan batch Firestore agar format rekaman konsisten.
    const batch = writeBatch(db);
    batch.set(ref, {
      tanggal: selectedTanggal,
      nisn: siswa.nisn,
      namaSiswa: siswa.nama || '',
      kelas: kelasTerpilih.namaKelas,
      kelasId: kelasTerpilih.id,
      jenjang: kelasTerpilih.jenjang,
      tingkat: kelasTerpilih.tingkat,
      tahunAjaran: kelasTerpilih.tahunAjaran,
      status,
      metode,
      // Scan QR selalu mencatat Hadir, sehingga tidak meminta notifikasi Alpa.
      kirimNotifikasiWaAlpa: false,
      waktuScan: sekarang,
      dicatatOleh: userData?.nama || (isAdmin ? 'Administrator' : 'Guru'),
      dicatatOlehUid: userData?.uid || '',
      updatedAt: sekarang,
    });
    await batch.commit();
  }, [kelasTerpilih, selectedTanggal, userData?.nama, userData?.uid, isAdmin]);

  const handleStatusChange = (nisn: string, status: StatusAbsensi) => {
    if (!bolehMengubah) return;
    setAbsensiHariIni((sebelumnya) => ({ ...sebelumnya, [nisn]: status }));
  };

  // Isi status Hadir hanya untuk siswa yang belum memiliki status.
  // Status Sakit, Izin, dan Alpa yang sudah dipilih tidak akan tertimpa.
  const handleHadirSemua = () => {
    if (!isGuru || !kelasTerpilih || siswaDiKelas.length === 0) return;

    setAbsensiHariIni((sebelumnya) => {
      const berikutnya = { ...sebelumnya };
      siswaDiKelas.forEach((siswa) => {
        if (!berikutnya[siswa.nisn]) berikutnya[siswa.nisn] = 'Hadir';
      });
      return berikutnya;
    });
  };

  const handleSimpanManual = async () => {
    if (!bolehMengubah) return;
    if (!kelasTerpilih) return alert('Pilih rombel terlebih dahulu.');
    if (siswaDiKelas.length === 0) return alert('Tidak ada siswa aktif pada rombel ini.');

    const dataUntukDisimpan = siswaDiKelas.filter((siswa) => Boolean(absensiHariIni[siswa.nisn]));
    if (dataUntukDisimpan.length === 0) return alert('Belum ada status kehadiran yang dipilih.');

    setIsSaving(true);
    try {
      // Batch maksimum 450 dokumen, di bawah batas 500 operasi Firestore.
      for (const kelompok of potong(dataUntukDisimpan, 450)) {
        const batch = writeBatch(db);
        const sekarang = new Date().toISOString();
        kelompok.forEach((siswa) => {
          const status = absensiHariIni[siswa.nisn];
          if (!status) return;
          const ref = doc(db, 'absensi', idDokumenAbsensi(selectedTanggal, siswa.nisn));
          batch.set(ref, {
            tanggal: selectedTanggal,
            nisn: siswa.nisn,
            namaSiswa: siswa.nama || '',
            kelas: kelasTerpilih.namaKelas,
            kelasId: kelasTerpilih.id,
            jenjang: kelasTerpilih.jenjang,
            tingkat: kelasTerpilih.tingkat,
            tahunAjaran: kelasTerpilih.tahunAjaran,
            status,
            metode: 'Manual',
            // Penanda hanya aktif pada catatan Alpa jika Guru mencentang pilihan.
            kirimNotifikasiWaAlpa: isGuru && aktifkanNotifikasiAlpa && status === 'Alpa',
            waktuScan: sekarang,
            dicatatOleh: userData?.nama || (isAdmin ? 'Administrator' : 'Guru'),
            dicatatOlehUid: userData?.uid || '',
            updatedAt: sekarang,
          });
        });
        await batch.commit();
      }
      const catatanNotifikasi = isGuru
        ? (aktifkanNotifikasiAlpa
            ? '\n\nPilihan notifikasi Alpa: AKTIF. Penanda permintaan disimpan. Pesan WhatsApp baru akan dikirim setelah Admin menyelesaikan integrasi Meta.'
            : '\n\nPilihan notifikasi Alpa: TIDAK AKTIF. Tidak ada permintaan WhatsApp yang disimpan.')
        : '';
      alert(`Absensi berhasil disimpan.\n\nHadir: ${ringkasan.hadir}\nSakit: ${ringkasan.sakit}\nIzin: ${ringkasan.izin}\nAlpa: ${ringkasan.alpa}\nBelum diisi: ${ringkasan.belum}${catatanNotifikasi}`);
    } catch (error) {
      console.error('Gagal menyimpan absensi manual:', error);
      alert('Gagal menyimpan absensi. Periksa koneksi dan hak akses Firebase.');
    } finally {
      setIsSaving(false);
    }
  };

  const prosesScan = useCallback(async (teksQR: string) => {
    if (!bolehMengubah || !kelasTerpilih) return;
    const siswa = siswaDiKelas.find((item) => item.nisn === teksQR.trim());

    if (!siswa) {
      setScanError('Kartu tidak cocok dengan rombel yang sedang dipilih. Pastikan siswa berada pada rombel ini.');
      return;
    }

    if (absensiRef.current[siswa.nisn]) {
      setScanMessage(`${siswa.nama} sudah tercatat ${absensiRef.current[siswa.nisn]} pada tanggal ini.`);
      return;
    }

    try {
      await simpanSatuAbsensi(siswa, 'Hadir', 'Scan QR');
      setAbsensiHariIni((sebelumnya) => ({ ...sebelumnya, [siswa.nisn]: 'Hadir' }));
      setScanMessage(`${siswa.nama} berhasil dicatat Hadir.`);
      setScanError('');
    } catch (error) {
      console.error('Gagal menyimpan hasil scan:', error);
      setScanError('Absensi gagal disimpan. Periksa koneksi dan hak akses Firebase.');
    }
  }, [bolehMengubah, kelasTerpilih, siswaDiKelas, simpanSatuAbsensi]);

  // Scanner dibuat ulang hanya ketika tab/tanggal/rombel berubah.
  useEffect(() => {
    if (activeTab !== 'scan' || !bolehMengubah || !selectedKelasId || loadingSiswa || siswaDiKelas.length === 0) {
      return;
    }

    let masihAktif = true;
    scanSedangDiproses.current = false;
    setScanMessage('');
    setScanError('');

    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 230, height: 230 } },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      async (decodedText) => {
        if (!masihAktif || scanSedangDiproses.current) return;
        scanSedangDiproses.current = true;
        try { scanner.pause(true); } catch { /* Scanner mungkin sedang berhenti. */ }
        setScanError('');
        setScanMessage('Memeriksa kartu siswa...');
        await prosesScan(decodedText);
        window.setTimeout(() => {
          if (!masihAktif) return;
          scanSedangDiproses.current = false;
          try { scanner.resume(); } catch { /* Jika kamera berhenti, pengguna dapat pindah tab dan kembali. */ }
        }, 1600);
      },
      () => {
        // Kesalahan pembacaan per frame normal ketika kamera sedang mencari QR.
      }
    );

    return () => {
      masihAktif = false;
      scanSedangDiproses.current = false;
      if (scannerRef.current === scanner) scannerRef.current = null;
      scanner.clear().catch((error) => console.warn('Scanner selesai dibersihkan:', error));
    };
  }, [activeTab, bolehMengubah, selectedKelasId, selectedTanggal, loadingSiswa, siswaDiKelas, prosesScan]);

  const pilihKelas = (id: string) => {
    setSelectedKelasId(id);
    setAbsensiHariIni({});
    setAktifkanNotifikasiAlpa(false);
    setScanMessage('');
    setScanError('');
  };

  const ubahTanggalAbsensi = (tanggal: string) => {
    setSelectedTanggal(tanggal);
    setAktifkanNotifikasiAlpa(false);
  };

  const renderPilihanKelas = (tambahanClass = '') => (
    <select
      value={selectedKelasId}
      onChange={(e) => pilihKelas(e.target.value)}
      className={`px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium bg-white ${tambahanClass}`}
      disabled={kelasTersedia.length === 0}
    >
      <option value="">-- Pilih Rombel --</option>
      {kelasTersedia.map((kelas) => (
        <option key={kelas.id} value={kelas.id}>
          {labelKelas(kelas)}
        </option>
      ))}
    </select>
  );

  if (loadingMaster || loadingGuru || loadingSiswa) {
    return <div className="p-10 text-center font-bold text-slate-500">Memuat data absensi dan penugasan...</div>;
  }

  if (!isAdmin && !isGuru && !isKepsek) {
    return <div className="p-10 text-center text-slate-500">Anda tidak memiliki izin untuk membuka halaman absensi.</div>;
  }

  if (errorGuru) {
    return (
      <div className="max-w-3xl mx-auto bg-white border border-amber-200 rounded-2xl p-6">
        <h2 className="font-bold text-amber-800">Akun Guru belum siap</h2>
        <p className="text-sm text-slate-600 mt-2">{errorGuru}</p>
      </div>
    );
  }

  const tidakAdaTahunAktif = !tahunAktif;
  const tidakAdaRombel = kelasTersedia.length === 0;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">Absensi Siswa</h1>
          <p className="text-slate-500 mt-1 font-medium">
            {isAdmin
              ? 'Kelola kehadiran siswa pada seluruh rombel tahun ajaran aktif.'
              : isGuru
                ? 'Kelola kehadiran siswa hanya pada rombel yang ditugaskan kepada Anda.'
                : 'Monitoring kehadiran siswa pada seluruh rombel tahun ajaran aktif.'}
          </p>
          {tahunAktif && (
            <p className="text-xs text-blue-700 mt-2 font-semibold">
              Tahun ajaran aktif: {tahunAktif.tahun} — Semester {tahunAktif.semester}
            </p>
          )}
        </div>
        {renderPilihanKelas('w-full lg:w-auto lg:min-w-[280px]')}
      </div>

      {errorHalaman && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {errorHalaman}
        </div>
      )}

      {tidakAdaTahunAktif && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          Belum ada tahun ajaran berstatus Aktif. Atur tahun ajaran aktif melalui menu Tahun Ajaran terlebih dahulu.
        </div>
      )}

      {!tidakAdaTahunAktif && tidakAdaRombel && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          {isGuru
            ? 'Belum ada rombel tahun ajaran aktif yang ditugaskan kepada akun Guru ini. Periksa penugasan di Data Kelas & Rombel atau Data Pegawai.'
            : 'Belum ada rombel pada jenjang sekolah yang diaktifkan untuk tahun ajaran ini. Tambahkan rombel melalui Data Kelas & Rombel.'}
        </div>
      )}

      {kelasTerpilih && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <p className="text-xs text-slate-500 font-semibold">Total Siswa Aktif</p>
            <p className="text-2xl font-extrabold text-[#082B62] mt-1">{ringkasan.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
            <p className="text-xs text-emerald-700 font-semibold">Hadir</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">{ringkasan.hadir}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
            <p className="text-xs text-amber-700 font-semibold">Sakit / Izin</p>
            <p className="text-2xl font-extrabold text-amber-700 mt-1">{ringkasan.sakit + ringkasan.izin}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
            <p className="text-xs text-red-700 font-semibold">Alpa</p>
            <p className="text-2xl font-extrabold text-red-700 mt-1">{ringkasan.alpa}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm col-span-2 md:col-span-1">
            <p className="text-xs text-blue-700 font-semibold">Persentase Hadir</p>
            <p className="text-2xl font-extrabold text-blue-700 mt-1">{ringkasan.persentase}%</p>
            <p className="text-[11px] text-slate-500 mt-1">{ringkasan.belum} belum diisi</p>
          </div>
        </div>
      )}

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto gap-1 no-print">
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'manual' ? 'bg-[#EFF6FF] text-[#155EEF]' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Input / Rekap Absensi
        </button>
        {bolehMengubah && (
          <button
            onClick={() => setActiveTab('scan')}
            className={`px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'scan' ? 'bg-[#EFF6FF] text-[#155EEF]' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Scan QR Code
          </button>
        )}
        <button
          onClick={() => setActiveTab('kartu')}
          className={`px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'kartu' ? 'bg-[#EFF6FF] text-[#155EEF]' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Cetak Kartu Pelajar
        </button>
      </div>

      {activeTab === 'manual' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5 border-b pb-4">
            <div>
              <h2 className="font-bold text-[#082B62] text-lg">{bolehMengubah ? 'Input Kehadiran Manual' : 'Monitoring Kehadiran'}</h2>
              <p className="text-xs text-slate-500 mt-1">Pilih tanggal untuk melihat atau mengisi kehadiran siswa.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <input
                type="date"
                value={selectedTanggal}
                onChange={(e) => ubahTanggalAbsensi(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
              />
              {isGuru && (
                <button
                  type="button"
                  onClick={handleHadirSemua}
                  disabled={isSaving || loadingAbsensi || siswaDiKelas.length === 0 || ringkasan.belum === 0}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm transition-colors disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed whitespace-nowrap"
                  title="Mengisi Hadir untuk siswa yang belum memiliki status"
                >
                  <span aria-hidden="true" className="text-lg leading-none">✓</span>
                  Hadir Semua
                </button>
              )}
            </div>
          </div>
          {isGuru && (
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              <strong>Tips:</strong> Klik <strong>Hadir Semua</strong> untuk mengisi siswa yang belum memiliki status menjadi Hadir. Status Sakit, Izin, dan Alpa yang sudah Anda pilih tetap dipertahankan. Periksa kembali daftar, lalu klik <strong>Simpan Absensi</strong>.
            </div>
          )}

          {isGuru && kelasTerpilih && (
            <div className="mb-5 rounded-xl border border-[#C7D8F1] bg-[#F7FAFF] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <input
                  id="aktifkan-notifikasi-wa-alpa"
                  type="checkbox"
                  checked={aktifkanNotifikasiAlpa}
                  onChange={(e) => setAktifkanNotifikasiAlpa(e.target.checked)}
                  disabled={isSaving || loadingAbsensi}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-[#155EEF] focus:ring-[#155EEF]"
                />
                <div className="min-w-0">
                  <label htmlFor="aktifkan-notifikasi-wa-alpa" className="cursor-pointer font-bold text-[#082B62]">
                    Kirim pemberitahuan WhatsApp jika ada siswa Alpa
                  </label>
                  <p className="mt-1 text-sm text-slate-600">
                    Centang untuk meminta pemberitahuan kepada orang tua siswa yang berstatus Alpa pada absensi tanggal dan rombel ini. Siswa Hadir, Sakit, dan Izin tidak akan diberi tanda untuk dikirimi pesan.
                  </p>
                  <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Pengiriman WhatsApp belum aktif pada tahap ini. Pilihan Anda akan disimpan bersama catatan absensi; pesan baru dapat dikirim setelah Admin menghubungkan akun WhatsApp Business Meta dan mengaktifkan layanan backend.
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Pilihan otomatis kembali tidak dicentang saat tanggal atau rombel diganti.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!kelasTerpilih ? (
            <div className="text-center py-10 text-slate-500">Silakan pilih rombel terlebih dahulu.</div>
          ) : loadingAbsensi ? (
            <div className="text-center py-10 text-slate-500">Memuat catatan kehadiran...</div>
          ) : siswaDiKelas.length === 0 ? (
            <div className="text-center py-10 text-slate-500">Belum ada siswa aktif pada rombel ini.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                      <th className="p-3 font-bold uppercase">No</th>
                      <th className="p-3 font-bold uppercase">Nama Siswa</th>
                      <th className="p-3 font-bold uppercase">NISN</th>
                      <th className="p-3 font-bold uppercase text-center">Hadir</th>
                      <th className="p-3 font-bold uppercase text-center">Sakit</th>
                      <th className="p-3 font-bold uppercase text-center">Izin</th>
                      <th className="p-3 font-bold uppercase text-center">Alpa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siswaDiKelas.map((siswa, index) => {
                      const currentStatus = absensiHariIni[siswa.nisn] || '';
                      return (
                        <tr key={siswa.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm">
                          <td className="p-3 text-slate-500">{index + 1}</td>
                          <td className="p-3 font-bold text-[#082B62]">{siswa.nama}</td>
                          <td className="p-3 text-slate-500">{siswa.nisn}</td>
                          {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as StatusAbsensi[]).map((status) => (
                            <td key={status} className="p-3 text-center">
                              <button
                                type="button"
                                disabled={!bolehMengubah}
                                aria-label={`${siswa.nama}: ${status}`}
                                onClick={() => handleStatusChange(siswa.nisn, status)}
                                className={`w-9 h-9 rounded-lg font-bold transition-all disabled:cursor-not-allowed ${
                                  currentStatus === status
                                    ? status === 'Hadir' ? 'bg-emerald-500 text-white shadow-md'
                                      : status === 'Sakit' ? 'bg-amber-500 text-white shadow-md'
                                        : status === 'Izin' ? 'bg-blue-500 text-white shadow-md'
                                          : 'bg-red-500 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200 disabled:hover:bg-slate-100'
                                }`}
                              >
                                {status === 'Hadir' ? 'H' : status === 'Sakit' ? 'S' : status === 'Izin' ? 'I' : 'A'}
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-5">
                <p className="text-xs text-slate-500">
                  Tercatat {ringkasan.tercatat} dari {ringkasan.total} siswa. {bolehMengubah ? 'Pilih status siswa, kemudian simpan.' : 'Akses Kepala Sekolah hanya untuk monitoring.'}
                </p>
                {bolehMengubah && (
                  <button
                    type="button"
                    onClick={handleSimpanManual}
                    disabled={isSaving || loadingAbsensi || ringkasan.tercatat === 0}
                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#155EEF] hover:bg-blue-700 shadow-sm disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Absensi'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'scan' && bolehMengubah && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6 max-w-2xl mx-auto text-center">
          <h2 className="font-bold text-[#082B62] text-lg mb-2">Scan QR Code Kartu Siswa</h2>
          <p className="text-slate-500 text-sm mb-5">Arahkan kamera ke QR Code pada kartu pelajar siswa di rombel yang dipilih.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-5">
            <input
              type="date"
              value={selectedTanggal}
              onChange={(e) => ubahTanggalAbsensi(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl outline-none"
            />
            {renderPilihanKelas('w-full sm:w-auto')}
          </div>
          {!kelasTerpilih ? (
            <div className="py-8 text-slate-500">Pilih rombel terlebih dahulu sebelum memindai kartu.</div>
          ) : siswaDiKelas.length === 0 ? (
            <div className="py-8 text-slate-500">Tidak ada siswa aktif pada rombel ini.</div>
          ) : (
            <div id="reader" className="w-full rounded-xl overflow-hidden border border-slate-200" />
          )}
          {scanMessage && <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-semibold">{scanMessage}</div>}
          {scanError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">{scanError}</div>}
          <p className="text-xs text-slate-500 mt-4">QR Code menggunakan NISN seperti kartu yang sudah dibuat sebelumnya. Pemindaian hanya menerima siswa dari rombel terpilih dan mencegah pencatatan ganda.</p>
        </div>
      )}

      {activeTab === 'kartu' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-4 no-print">
            <div>
              <h2 className="font-bold text-[#082B62] text-lg">Cetak Kartu Pelajar</h2>
              <p className="text-slate-500 text-sm">Ukuran kartu 85,6 × 54 mm (standar ID Card/name tag), dengan QR Code NISN untuk absensi.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {renderPilihanKelas('w-full sm:w-auto')}
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!kelasTerpilih || siswaDiKelas.length === 0}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold disabled:bg-slate-400"
              >
                Cetak Kartu
              </button>
            </div>
          </div>

          {!kelasTerpilih ? (
            <div className="text-center py-10 text-slate-500 no-print">Silakan pilih rombel terlebih dahulu.</div>
          ) : siswaDiKelas.length === 0 ? (
            <div className="text-center py-10 text-slate-500 no-print">Belum ada siswa aktif pada rombel ini.</div>
          ) : (
            <div id="print-area" className="print-grid flex flex-wrap items-start gap-4">
              {siswaDiKelas.map((siswa) => (
                <div
                  key={siswa.id}
                  className="print-card relative h-[54mm] w-[85.6mm] shrink-0 overflow-hidden rounded-[3mm] border border-[#C7D8F1] bg-white shadow-md"
                >
                  <div className="h-[1.5mm] bg-gradient-to-r from-[#C89B3C] via-[#F3D98B] to-[#C89B3C]" />
                  <div className="relative h-[14mm] overflow-hidden bg-gradient-to-br from-[#082B62] via-[#12458D] to-[#082B62] px-[2.5mm] py-[1.2mm] text-white">
                    <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full border border-white/10" />
                    <div className="absolute -right-2 -top-7 h-20 w-20 rounded-full border border-white/10" />
                    <div className="relative flex h-full items-center gap-[2mm]">
                      <div className="flex h-[8mm] w-[8mm] shrink-0 items-center justify-center rounded-full border-2 border-[#E7C66D] bg-white/10 text-[8px] font-black tracking-wide text-[#FFE7A3]">
                        {String(kelasTerpilih.jenjang || 'SD').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[6px] font-semibold uppercase leading-[7px] tracking-[0.14em] text-blue-100">Identitas Resmi Siswa</p>
                        <h3 className="break-words text-[8px] font-extrabold leading-[9px]">{namaSekolah}</h3>
                        {npsnSekolah && <p className="mt-[0.3mm] text-[6px] leading-[7px] text-blue-100">NPSN: {npsnSekolah}</p>}
                      </div>
                      <div className="w-[13mm] shrink-0 rounded border border-white/25 px-[1mm] py-[1mm] text-center text-[5.5px] font-bold leading-[7px] tracking-wide text-[#FFE7A3]">
                        KARTU PELAJAR
                      </div>
                    </div>
                  </div>

                  <div className="grid h-[31.5mm] grid-cols-[18mm_minmax(0,1fr)_17mm] items-center gap-[2mm] px-[2.5mm] py-[1.5mm]">
                    <div className="flex h-[24mm] w-[18mm] shrink-0 items-center justify-center overflow-hidden rounded-[1.5mm] border border-2 border-[#D6B45B] bg-gradient-to-b from-slate-100 to-slate-200 text-center">
                      {siswa.fotoUrl ? (
                        <img src={siswa.fotoUrl} alt={`Foto ${siswa.nama}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="px-1 text-[#64748B]">
                          <svg viewBox="0 0 24 24" className="mx-auto mb-1 h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19a6 6 0 0 0-12 0m6-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-4h5m-2.5-2.5v5" />
                          </svg>
                          <span className="block text-[6px] font-extrabold leading-tight tracking-wide">FOTO SISWA</span>
                          <span className="mt-0.5 block text-[5.5px]">3 × 4 cm</span>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 self-stretch overflow-hidden py-[1mm]">
                      <p className="text-[5.5px] font-bold uppercase leading-[7px] tracking-[0.12em] text-[#B18A35]">Kartu Identitas Siswa</p>
                      <h4 className="mt-[0.5mm] break-words text-[8px] font-extrabold uppercase leading-[9px] text-[#082B62]">{siswa.nama}</h4>
                      <div className="mt-[1mm] space-y-[0.6mm] text-[6.5px] leading-[7.5px] text-slate-600">
                        <p><span className="font-bold text-slate-800">NISN</span>: {siswa.nisn || '-'}</p>
                        <p><span className="font-bold text-slate-800">Rombel</span>: {kelasTerpilih.namaKelas}</p>
                        <p><span className="font-bold text-slate-800">Jenjang</span>: {kelasTerpilih.jenjang} — {angkaRomawi(kelasTerpilih.tingkat)}</p>
                        <p><span className="font-bold text-slate-800">Tahun Ajaran</span>: {kelasTerpilih.tahunAjaran}</p>
                      </div>
                    </div>

                    <div className="flex h-[17mm] w-[17mm] flex-col items-center justify-center gap-[0.5mm] rounded-[1.5mm] border border-slate-200 bg-white p-[1mm]">
                      <QRCodeSVG value={siswa.nisn || siswa.id} size={48} level="H" includeMargin />
                      <span className="text-[5px] font-extrabold uppercase leading-[6px] tracking-wide text-[#082B62]">Scan Absensi</span>
                    </div>
                  </div>

                  <div className="flex h-[7mm] items-center justify-between gap-2 border-t border-[#E7D8B2] bg-[#F8FAFD] px-[2.5mm]">
                    <p className="text-[5.5px] font-semibold leading-[6px] text-slate-500">KARTU WAJIB DIBAWA SAAT KE SEKOLAH</p>
                    <p className="text-[5.5px] font-extrabold leading-[6px] tracking-[0.12em] text-[#A47A24]">IDENTITAS SISWA</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(2, 85.6mm) !important;
            justify-content: center !important;
            align-content: start !important;
            column-gap: 8mm !important;
            row-gap: 6mm !important;
          }
          #print-area .print-card {
            position: relative !important;
            width: 85.6mm !important;
            height: 54mm !important;
            min-height: 54mm !important;
            max-height: 54mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: 0.25mm solid #9CA3AF !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
