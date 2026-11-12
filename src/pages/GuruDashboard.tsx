import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FotoProfilGuru from '../components/FotoProfilGuru';
import ilustrasiGuruLakiLaki from '../assets/ilustrasi-guru-laki-laki.png';
import ilustrasiGuruPerempuan from '../assets/ilustrasi-guru-perempuan.png';
import { useAuth } from '../contexts/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  collection, doc, onSnapshot, query, where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  buildWeeklyTrend,
  formatIndonesianNumber,
  getLastSevenDays,
  isStudentActiveForYear,
  isThisMonth,
  localDateKey,
  summarizeAttendance,
  type DashboardRow
} from '../lib/dashboardUtils';

type ClassRow = DashboardRow & {
  namaKelas?: string;
  jenjang?: string;
  tingkat?: number | string;
  tahunAjaran?: string;
  waliKelasId?: string;
  kelasDiampu?: string[];
};

type GuruProfileRow = DashboardRow & { kelasDiampu?: string[] };
type YearRow = DashboardRow & { tahun?: string; semester?: string; status?: string };
type JournalRow = DashboardRow & { userId?: string; guruId?: string; namaGuru?: string; tanggal?: string; createdAt?: string; kelas?: string };
type ScheduleRow = DashboardRow & { guruId?: string; hari?: string; jamMulai?: string; jamSelesai?: string; mataPelajaran?: string; namaKelas?: string; ruang?: string; tahunAjaran?: string; semester?: string; keterangan?: string };

const COLORS = ['#10B981', '#F59E0B', '#E2E8F0'];

export default function GuruDashboard() {
  const { userData } = useAuth();
  const namaGuru = userData?.nama || 'Bapak/Ibu Guru';
  const guruId = userData?.guruId || null;
  const uid = userData?.uid || null;
  const ilustrasiGuru =
  userData?.jenisKelamin === 'Perempuan'
    ? ilustrasiGuruPerempuan
    : userData?.jenisKelamin === 'Laki-laki'
      ? ilustrasiGuruLakiLaki
      : null;

  const [guruData, setGuruData] = useState<GuruProfileRow | null>(null);
  const [kelasList, setKelasList] = useState<ClassRow[]>([]);
  const [siswaList, setSiswaList] = useState<DashboardRow[]>([]);
  const [tahunList, setTahunList] = useState<YearRow[]>([]);
  const [absensiList, setAbsensiList] = useState<DashboardRow[]>([]);
  const [jurnalUserIdList, setJurnalUserIdList] = useState<JournalRow[]>([]);
  const [jurnalGuruIdList, setJurnalGuruIdList] = useState<JournalRow[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [jadwalList, setJadwalList] = useState<ScheduleRow[]>([]);
  const [jadwalError, setJadwalError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  // Status pemuatan dipisah karena data Guru dimuat bertahap:
  // profil -> rombel yang ditugaskan -> siswa ringkas dan absensi per rombel.
  const [loaded, setLoaded] = useState({
    guru: false,
    tahun: false,
    jurnalUserId: false,
    jurnalGuruId: false,
    kelas: false,
    siswa: false,
    absensi: false,
  });
  const loading = Object.values(loaded).some((value) => !value);

  const today = localDateKey(new Date());
  const weekStart = getLastSevenDays()[0].tanggal;

  // Ambil hanya profil Guru milik akun, tahun ajaran aktif, dan jurnal milik akun.
  useEffect(() => {
    if (!guruId || !uid) {
      setGuruData(null);
      setKelasList([]);
      setSiswaList([]);
      setAbsensiList([]);
      setErrorMessage(
        'Akun Guru belum terhubung dengan data pegawai. Hubungkan akun melalui menu Manajemen Pengguna.'
      );
      setLoaded({
        guru: true,
        tahun: true,
        jurnalUserId: true,
        jurnalGuruId: true,
        kelas: true,
        siswa: true,
        absensi: true,
      });
      return;
    }

    setErrorMessage('');
    setGuruData(null);
    setKelasList([]);
    setSiswaList([]);
    setAbsensiList([]);
    setTahunList([]);
    setJurnalUserIdList([]);
    setJurnalGuruIdList([]);
    setLoaded({
      guru: false,
      tahun: false,
      jurnalUserId: false,
      jurnalGuruId: false,
      kelas: false,
      siswa: false,
      absensi: false,
    });

    const setSelesai = (key: keyof typeof loaded) => {
      setLoaded((current) => ({ ...current, [key]: true }));
    };
    const gagalMemuat = (label: string, key: keyof typeof loaded) => (error: Error) => {
      console.error(`Gagal memuat ${label}:`, error);
      setErrorMessage(
        `Data ${label} tidak dapat dimuat. Periksa koneksi dan aturan akses Firebase.`
      );
      setSelesai(key);
    };

    const unsubscribers = [
      onSnapshot(
        doc(db, 'guru', guruId),
        (snap) => {
          setGuruData(snap.exists() ? ({ id: snap.id, ...snap.data() } as GuruProfileRow) : null);
          setSelesai('guru');
        },
        gagalMemuat('profil guru', 'guru')
      ),
      onSnapshot(
        query(collection(db, 'tahun_ajaran'), where('status', '==', 'Aktif')),
        (snap) => {
          setTahunList(
            snap.docs.map((item) => ({ id: item.id, ...item.data() })) as YearRow[]
          );
          setSelesai('tahun');
        },
        gagalMemuat('tahun ajaran', 'tahun')
      ),
      // Query dipisah supaya setiap permintaan hanya membaca jurnal milik akun ini.
      onSnapshot(
        query(collection(db, 'jurnal'), where('userId', '==', uid)),
        (snap) => {
          setJurnalUserIdList(
            snap.docs.map((item) => ({ id: item.id, ...item.data() })) as JournalRow[]
          );
          setSelesai('jurnalUserId');
        },
        gagalMemuat('jurnal milik akun', 'jurnalUserId')
      ),
      // Menjaga kompatibilitas dengan jurnal lama yang menyimpan UID pada guruId.
      onSnapshot(
        query(collection(db, 'jurnal'), where('guruId', '==', uid)),
        (snap) => {
          setJurnalGuruIdList(
            snap.docs.map((item) => ({ id: item.id, ...item.data() })) as JournalRow[]
          );
          setSelesai('jurnalGuruId');
        },
        gagalMemuat('jurnal berdasarkan UID guru', 'jurnalGuruId')
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [guruId, uid]);

  // Daftar ID rombel mapel berasal dari dokumen guru yang terhubung ke akun.
  const kelasMapelIds = useMemo(() => {
    const nilai = guruData?.kelasDiampu;
    if (!Array.isArray(nilai)) return [];

    return Array.from(
      new Set(
        nilai
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => id.trim())
      )
    );
  }, [guruData]);

  // Ambil rombel wali kelas melalui query waliKelasId, dan rombel mapel
  // melalui pembacaan dokumen berdasarkan ID yang ditugaskan pada profil Guru.
  // Tidak ada lagi pembacaan seluruh koleksi kelas.
  useEffect(() => {
    if (!loaded.guru) return;

    if (!guruId || !guruData) {
      setKelasList([]);
      setLoaded((current) => ({ ...current, kelas: true }));
      return;
    }

    let aktif = true;
    const kelasWaliMap = new Map<string, ClassRow>();
    const kelasMapelMap = new Map<string, ClassRow>();
    let kelasWaliSiap = false;
    const mapelSiap = new Set<string>();

    setKelasList([]);
    setLoaded((current) => ({ ...current, kelas: false }));

    const kirimKelas = () => {
      if (!aktif) return;
      const gabungan = new Map<string, ClassRow>(kelasWaliMap);
      kelasMapelMap.forEach((kelas, id) => gabungan.set(id, kelas));
      setKelasList(Array.from(gabungan.values()));
    };

    const tandaiKelasSiap = () => {
      if (aktif && kelasWaliSiap && mapelSiap.size === kelasMapelIds.length) {
        setLoaded((current) => ({ ...current, kelas: true }));
      }
    };

    const unsubscribeWali = onSnapshot(
      query(collection(db, 'kelas'), where('waliKelasId', '==', guruId)),
      (snap) => {
        if (!aktif) return;
        kelasWaliMap.clear();
        snap.docs.forEach((item) => {
          kelasWaliMap.set(item.id, { id: item.id, ...item.data() } as ClassRow);
        });
        kelasWaliSiap = true;
        kirimKelas();
        tandaiKelasSiap();
      },
      (error) => {
        console.error('Gagal memuat rombel wali kelas:', error);
        setErrorMessage(
          'Daftar rombel wali kelas tidak dapat dimuat. Periksa aturan akses koleksi kelas.'
        );
        kelasWaliSiap = true;
        tandaiKelasSiap();
      }
    );

    const unsubscribeMapel = kelasMapelIds.map((kelasId) =>
      onSnapshot(
        doc(db, 'kelas', kelasId),
        (snap) => {
          if (!aktif) return;
          if (snap.exists()) {
            kelasMapelMap.set(snap.id, { id: snap.id, ...snap.data() } as ClassRow);
          } else {
            kelasMapelMap.delete(kelasId);
          }
          if (!mapelSiap.has(kelasId)) mapelSiap.add(kelasId);
          kirimKelas();
          tandaiKelasSiap();
        },
        (error) => {
          console.error(`Gagal memuat rombel mapel ${kelasId}:`, error);
          setErrorMessage(
            'Sebagian rombel mata pelajaran tidak dapat dimuat. Periksa penugasan kelas dan aturan akses Firebase.'
          );
          if (!mapelSiap.has(kelasId)) mapelSiap.add(kelasId);
          tandaiKelasSiap();
        }
      )
    );

    return () => {
      aktif = false;
      unsubscribeWali();
      unsubscribeMapel.forEach((unsubscribe) => unsubscribe());
    };
  }, [guruId, guruData, loaded.guru, kelasMapelIds]);

  const jurnalList = useMemo(() => {
    const gabungan = new Map<string, JournalRow>();
    [...jurnalUserIdList, ...jurnalGuruIdList].forEach((jurnal) =>
      gabungan.set(String(jurnal.id), jurnal)
    );
    return Array.from(gabungan.values());
  }, [jurnalUserIdList, jurnalGuruIdList]);

  const activePeriod = useMemo(
    () => tahunList.find((item) => item.status === 'Aktif') || null,
    [tahunList]
  );
  const activeYear = activePeriod?.tahun || null;

  // Jadwal mengajar dibaca khusus untuk ID Guru yang sedang login.
  useEffect(() => {
    if (!guruId) {
      setJadwalList([]);
      setJadwalError('Akun Guru belum terhubung dengan ID pegawai.');
      return;
    }

    setJadwalError('');
    const unsubscribe = onSnapshot(
      query(collection(db, 'jadwal_pelajaran'), where('guruId', '==', guruId)),
      (snap) => {
        setJadwalList(snap.docs.map((item) => ({ id: item.id, ...item.data() })) as ScheduleRow[]);
        setJadwalError('');
      },
      (error) => {
        console.error('Gagal memuat jadwal mengajar:', error);
        setJadwalError('Jadwal mengajar belum dapat dimuat. Periksa akses Firestore.');
      }
    );
    return () => unsubscribe();
  }, [guruId]);

  const namaHariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
  const jadwalHariIni = useMemo(() => jadwalList
    .filter((item) => item.hari === namaHariIni)
    .filter((item) => !activeYear || !item.tahunAjaran || item.tahunAjaran === activeYear)
    .filter((item) => !activePeriod?.semester || !item.semester || item.semester === activePeriod.semester)
    .sort((a, b) => String(a.jamMulai || '').localeCompare(String(b.jamMulai || ''))),
  [jadwalList, namaHariIni, activeYear, activePeriod?.semester]);

  const kelasAktif = useMemo(() => {
    const idsMapel = new Set(kelasMapelIds);
    return kelasList.filter((kelas) => {
      const tahunSesuai = !activeYear || kelas.tahunAjaran === activeYear;
      const ditugaskan = kelas.waliKelasId === guruId || idsMapel.has(String(kelas.id || ''));
      return tahunSesuai && ditugaskan;
    });
  }, [kelasList, kelasMapelIds, guruId, activeYear]);

  const kelasIds = useMemo(
    () => new Set(kelasAktif.map((item) => String(item.id || '')).filter(Boolean)),
    [kelasAktif]
  );
  const kelasIdsList = useMemo(() => Array.from(kelasIds), [kelasIds]);

  // Guru hanya menerima data ringkas siswa untuk ID rombel yang ditugaskan.
  // Query dibagi maksimal 30 ID agar sesuai batas operator in Firestore.
  useEffect(() => {
    if (!loaded.kelas || !loaded.tahun) return;

    let aktif = true;
    const kelompok: string[][] = [];
    for (let index = 0; index < kelasIdsList.length; index += 30) {
      kelompok.push(kelasIdsList.slice(index, index + 30));
    }

    setSiswaList([]);
    setLoaded((current) => ({ ...current, siswa: false }));

    if (kelompok.length === 0) {
      setLoaded((current) => ({ ...current, siswa: true }));
      return () => {
        aktif = false;
      };
    }

    const hasilPerKelompok = new Map<number, DashboardRow[]>();
    const kelompokSiap = new Set<number>();
    const unsubscribers: Array<() => void> = [];

    const kirimSiswa = () => {
      if (!aktif) return;
      const gabungan = Array.from(hasilPerKelompok.values()).flat();
      const unik = new Map<string, DashboardRow>();
      gabungan.forEach((siswa) => unik.set(String(siswa.id), siswa));
      setSiswaList(Array.from(unik.values()));
    };

    const tandaiKelompokSiswaSiap = (index: number) => {
      if (!aktif || kelompokSiap.has(index)) return;
      kelompokSiap.add(index);
      if (kelompokSiap.size === kelompok.length) {
        setLoaded((current) => ({ ...current, siswa: true }));
      }
    };

    kelompok.forEach((idKelompok, index) => {
      const q = query(
        collection(db, 'siswa_ringkas'),
        where('kelasId', 'in', idKelompok)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (!aktif) return;
          const data = snap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as DashboardRow[];
          hasilPerKelompok.set(index, data);
          kirimSiswa();
          tandaiKelompokSiswaSiap(index);
        },
        (error) => {
          console.error('Gagal memuat data siswa ringkas:', error);
          setErrorMessage(
            'Data siswa ringkas tidak dapat dimuat. Periksa indeks dan aturan akses Firebase.'
          );
          tandaiKelompokSiswaSiap(index);
        }
      );
      unsubscribers.push(unsubscribe);
    });

    return () => {
      aktif = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [loaded.kelas, loaded.tahun, kelasIdsList]);

  // Absensi dibatasi berdasarkan tanggal dan ID rombel yang sama.
  // Catatan absensi lama tanpa kelasId tidak dimuat ke dashboard Guru.
  useEffect(() => {
    if (!loaded.kelas || !loaded.tahun) return;

    let aktif = true;
    const kelompok: string[][] = [];
    for (let index = 0; index < kelasIdsList.length; index += 30) {
      kelompok.push(kelasIdsList.slice(index, index + 30));
    }

    setAbsensiList([]);
    setLoaded((current) => ({ ...current, absensi: false }));

    if (kelompok.length === 0) {
      setLoaded((current) => ({ ...current, absensi: true }));
      return () => {
        aktif = false;
      };
    }

    const hasilPerKelompok = new Map<number, DashboardRow[]>();
    const kelompokSiap = new Set<number>();
    const unsubscribers: Array<() => void> = [];

    const kirimAbsensi = () => {
      if (!aktif) return;
      const gabungan = Array.from(hasilPerKelompok.values()).flat();
      const unik = new Map<string, DashboardRow>();
      gabungan.forEach((record) => unik.set(String(record.id), record));
      setAbsensiList(Array.from(unik.values()));
    };

    const tandaiKelompokAbsensiSiap = (index: number) => {
      if (!aktif || kelompokSiap.has(index)) return;
      kelompokSiap.add(index);
      if (kelompokSiap.size === kelompok.length) {
        setLoaded((current) => ({ ...current, absensi: true }));
      }
    };

    kelompok.forEach((idKelompok, index) => {
      const q = query(
        collection(db, 'absensi'),
        where('kelasId', 'in', idKelompok),
        where('tanggal', '>=', weekStart),
        where('tanggal', '<=', today)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (!aktif) return;
          const data = snap.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as DashboardRow[];
          hasilPerKelompok.set(index, data);
          kirimAbsensi();
          tandaiKelompokAbsensiSiap(index);
        },
        (error) => {
          console.error('Gagal memuat absensi rombel:', error);
          setErrorMessage(
            'Data absensi rombel tidak dapat dimuat. Jika muncul permintaan indeks Firebase, buat indeks yang disarankan lalu muat ulang dashboard.'
          );
          tandaiKelompokAbsensiSiap(index);
        }
      );
      unsubscribers.push(unsubscribe);
    });

    return () => {
      aktif = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [loaded.kelas, loaded.tahun, kelasIdsList, weekStart, today]);

  const siswaDiampu = useMemo(() => {
    return siswaList.filter((student) => {
      if (!isStudentActiveForYear(student, activeYear)) return false;
      return kelasIds.has(String(student.kelasId || ''));
    });
  }, [siswaList, activeYear, kelasIds]);

  const absensiHariIni = useMemo(
    () => summarizeAttendance(absensiList, siswaDiampu.length, today, kelasIds),
    [absensiList, siswaDiampu.length, today, kelasIds]
  );

  const trend = useMemo(
    () => buildWeeklyTrend(absensiList, siswaDiampu.length, kelasIds),
    [absensiList, siswaDiampu.length, kelasIds]
  );
  const hasTrendData = trend.some((item) => item.hadir !== null);

  const absensiBelumLengkap = useMemo(() => {
    if (siswaDiampu.length === 0) return 0;

    return kelasAktif.filter((kelas) => {
      const siswaKelas = siswaDiampu.filter(
        (student) => String(student.kelasId || '') === String(kelas.id)
      );

      if (siswaKelas.length === 0) return false;

      const recorded = new Set(
        absensiList
          .filter(
            (item) =>
              item.tanggal === today &&
              String(item.kelasId || '') === String(kelas.id)
          )
          .map((item) => String(item.nisn || ''))
      );

      return siswaKelas.some((student) => !recorded.has(String(student.nisn || '')));
    }).length;
  }, [kelasAktif, siswaDiampu, absensiList, today]);

  const jurnalBulanIni = useMemo(() => {
    return jurnalList.filter((item) => {
      const milikGuru = item.userId === uid || item.guruId === uid;
      const tanggalJurnal = item.tanggal || item.createdAt;
      const sesuaiPeriode =
        (!activeYear || item.tahunAjaran === activeYear) &&
        (!activePeriod?.semester || item.semester === activePeriod.semester);
      return milikGuru && sesuaiPeriode && isThisMonth(tanggalJurnal);
    }).length;
  }, [jurnalList, uid, activeYear, activePeriod?.semester]);

  const bulanNama = calendarMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const hariPertama = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const jumlahHari = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const offsetSenin = (hariPertama.getDay() + 6) % 7;
  const tanggalHariIni = new Date();
  const namaTanggal = tanggalHariIni.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const calendarCells = [
    ...Array.from({ length: offsetSenin }, () => null),
    ...Array.from({ length: jumlahHari }, (_, index) => index + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const quickLinks = [
    { title: 'Absensi Siswa', detail: 'Kelola kehadiran rombel', icon: '✓', to: '/guru/absensi', tone: 'bg-emerald-50 text-emerald-700' },
    { title: 'Jurnal Mengajar', detail: 'Catat kegiatan pembelajaran', icon: '▤', to: '/guru/jurnal', tone: 'bg-violet-50 text-violet-700' },
    { title: 'Jadwal Pelajaran', detail: 'Lihat jadwal mengajar', icon: '◷', to: '/guru/jadwal', tone: 'bg-blue-50 text-blue-700' },
    { title: 'Profil Saya', detail: 'Perbarui informasi akun', icon: '♙', to: '/guru/profil', tone: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-10">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-5">
          {/* Welcome banner */}
          <section className="relative isolate flex min-h-[220px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#123D83] via-[#155EEF] to-[#3188E8] p-4 text-white shadow-xl sm:min-h-[250px] sm:p-6">
            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl" />
            <div className="relative z-10 flex w-full items-center gap-1 sm:gap-2">
              {/* Ilustrasi dibuat dominan di sisi kiri banner */}
              <div className="flex w-[27%] shrink-0 items-center justify-center sm:w-[28%]">
                {ilustrasiGuru && (
                  <img
                    src={ilustrasiGuru}
                    alt="Ilustrasi Guru"
                    className="h-44 w-full max-w-[160px] object-contain object-center drop-shadow-2xl sm:h-56 sm:max-w-[230px]"
                  />
                )}
              </div>

              {/* Teks sambutan didekatkan ke ilustrasi */}
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[9px] font-bold tracking-[0.12em] text-blue-100 sm:text-xs sm:tracking-[0.16em]">RUANG KERJA GURU</span>
                <p className="mt-2 text-xs font-medium text-blue-100 sm:mt-3 sm:text-lg">Selamat datang kembali,</p>
                <h1 className="mt-1 break-words text-xl font-extrabold leading-tight tracking-tight sm:text-4xl">{namaGuru}</h1>
                <p className="mt-2 max-w-lg text-[11px] leading-4 text-blue-100 sm:mt-3 sm:text-sm sm:leading-6">Pantau kegiatan mengajar, kehadiran siswa, dan aktivitas pembelajaran Anda dalam satu tempat.</p>
                {activePeriod ? (
                  <div className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-semibold sm:mt-4 sm:text-sm">
                    <span className="text-blue-100">Tahun Pelajaran</span>
                    <span>{activePeriod.tahun || '-'}</span><span className="text-blue-200">·</span><span>Semester {activePeriod.semester || '-'}</span>
                  </div>
                ) : <p className="mt-3 inline-flex rounded-xl bg-amber-300/15 px-3 py-2 text-[10px] font-semibold text-amber-100 sm:mt-4 sm:text-xs">Tahun ajaran aktif belum diatur</p>}
              </div>

              {/* Profil Guru di sisi kanan banner */}
              <div className="flex w-[54px] shrink-0 flex-col items-center justify-center sm:w-[82px]">
                <Link to="/guru/profil" className="group flex flex-col items-center gap-1 rounded-xl p-1 transition hover:bg-white/10" title="Buka Profil Saya">
                  <FotoProfilGuru uid={userData?.uid} nama={namaGuru} className="h-10 w-10 border-2 border-white/80 text-sm shadow-lg sm:h-14 sm:w-14 sm:text-lg" />
                  <span className="text-[9px] font-semibold text-blue-100 group-hover:text-white sm:text-xs">Profil Saya</span>
                </Link>
              </div>
            </div>
          </section>

          {errorMessage && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>}
          {!guruData && guruId && !loading && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Profil pegawai untuk akun ini tidak ditemukan pada koleksi guru.</div>}

          {/* AI feature cards: informative until the AI workflow is connected */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-[#F5F0FF] to-white p-5 shadow-sm">
              <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-violet-200/40 blur-xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-xl text-white shadow-md">✦</div>
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">Segera hadir</span>
              </div>
              <h2 className="relative mt-4 text-base font-extrabold text-slate-900 sm:text-lg">AI Lesson Planner</h2>
              <p className="relative mt-1 max-w-sm text-xs leading-5 text-slate-600 sm:text-sm">Bantu susun modul ajar dan perangkat pembelajaran berdasarkan kebutuhan kelas.</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-[#EAFBFF] to-white p-5 shadow-sm">
              <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-cyan-200/40 blur-xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-xl text-white shadow-md">✧</div>
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700">Segera hadir</span>
              </div>
              <h2 className="relative mt-4 text-base font-extrabold text-slate-900 sm:text-lg">AI Content Generator</h2>
              <p className="relative mt-1 max-w-sm text-xs leading-5 text-slate-600 sm:text-sm">Rencana bantuan membuat bahan ajar, aktivitas kelas, dan ide asesmen yang relevan.</p>
            </div>
          </section>

          {/* Existing live statistics */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Rombel Diampu', value: kelasAktif.length, icon: '▦', color: 'bg-blue-600', note: 'Kelas penugasan Anda' },
              { label: 'Total Siswa', value: siswaDiampu.length, icon: '♙', color: 'bg-emerald-500', note: 'Siswa aktif di rombel' },
              { label: 'Absensi Belum Lengkap', value: absensiBelumLengkap, icon: '✓', color: 'bg-violet-500', note: 'Rombel perlu dilengkapi' },
              { label: 'Jurnal Bulan Ini', value: jurnalBulanIni, icon: '▤', color: 'bg-amber-500', note: 'Jurnal yang sudah diisi' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs">{item.label}</p>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.color} text-lg font-bold text-white shadow-sm`}>{item.icon}</span>
                </div>
                <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{loading ? '...' : formatIndonesianNumber(item.value)}</p>
                <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">{item.note}</p>
              </div>
            ))}
          </section>

          {/* Existing charts and attendance calculations */}
          <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
            <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5">
                <h2 className="font-extrabold text-slate-900">Tren Kehadiran Rombel</h2>
                <p className="mt-1 text-xs text-slate-500">Persentase siswa yang tercatat hadir dalam 7 hari terakhir.</p>
              </div>
              {hasTrendData ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                      <defs><linearGradient id="colorGuruReal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#155EEF" stopOpacity={0.28} /><stop offset="95%" stopColor="#155EEF" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF6" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} dy={8} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} unit="%" />
                      <Tooltip formatter={(value) => value == null ? ['Belum ada data', 'Kehadiran'] : [`${value}%`, 'Kehadiran']} labelFormatter={(_, payload) => payload?.[0]?.payload?.tanggal || ''} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }} />
                      <Area type="monotone" dataKey="hadir" connectNulls={false} stroke="#155EEF" strokeWidth={3} fillOpacity={1} fill="url(#colorGuruReal)" dot={{ fill: '#155EEF', strokeWidth: 2, r: 3, stroke: '#fff' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-slate-500">Belum ada catatan absensi pada rombel Anda dalam 7 hari terakhir.</div>}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="font-extrabold text-slate-900">Kehadiran Siswa Hari Ini</h2>
              <p className="mt-1 text-xs text-slate-500">Ringkasan status kehadiran rombel Anda.</p>
              {siswaDiampu.length > 0 ? (
                <>
                  <div className="relative flex min-h-[210px] items-center justify-center">
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie data={absensiHariIni.pieData} cx="50%" cy="50%" innerRadius={62} outerRadius={86} paddingAngle={1} dataKey="value" stroke="none">
                          {absensiHariIni.pieData.map((item, index) => <Cell key={item.name} fill={COLORS[index]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold text-slate-900">{absensiHariIni.persentaseHadir}%</span>
                      <span className="mt-1 text-xs font-semibold text-slate-500">Hadir</span>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                    <div className="flex justify-between"><span className="text-slate-600">Hadir</span><b className="text-emerald-600">{absensiHariIni.hadir}</b></div>
                    <div className="flex justify-between"><span className="text-slate-600">Sakit / Izin / Alpa</span><b className="text-amber-600">{absensiHariIni.tidakHadir}</b></div>
                    <div className="flex justify-between"><span className="text-slate-600">Belum diisi</span><b className="text-slate-500">{absensiHariIni.belumDiisi}</b></div>
                  </div>
                </>
              ) : <div className="flex min-h-[240px] items-center justify-center text-center text-sm text-slate-500">Belum ada siswa pada rombel yang ditugaskan kepada Anda.</div>}
            </div>
          </section>

          {/* Assigned classes */}
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-extrabold text-slate-900">Rombel Tanggung Jawab</h2><p className="mt-1 text-xs text-slate-500">Daftar kelas yang terhubung dengan penugasan Anda.</p></div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{kelasAktif.length} rombel</span>
            </div>
            {kelasAktif.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {kelasAktif.map((kelas) => (
                  <div key={kelas.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50/50">
                    <p className="text-[10px] font-medium text-slate-500">{kelas.jenjang || 'Jenjang'} · Tingkat {kelas.tingkat ?? '-'}</p>
                    <p className="mt-1 text-xl font-extrabold text-[#123D83]">{kelas.namaKelas || '-'}</p>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada penugasan rombel untuk akun ini.</p>}
          </section>

          {/* Quick links */}
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-extrabold text-slate-900">Akses Cepat</h2>
            <p className="mt-1 text-xs text-slate-500">Buka menu yang paling sering digunakan.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickLinks.map((item) => (
                <Link key={item.title} to={item.to} className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${item.tone}`}>{item.icon}</span>
                  <span className="min-w-0"><b className="block truncate text-xs text-slate-800 sm:text-sm">{item.title}</b><small className="mt-0.5 block text-[10px] leading-4 text-slate-400">{item.detail}</small></span>
                </Link>
              ))}
            </div>
          </section>
        </main>

        {/* Right rail: calendar and real daily teaching schedule */}
        <aside className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div><h2 className="font-extrabold text-slate-900">Kalender</h2><p className="mt-1 text-xs text-slate-500">Lihat tanggal dan hari berjalan.</p></div>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700">Hari ini</span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Bulan sebelumnya">‹</button>
              <h3 className="text-sm font-bold capitalize text-slate-800">{bulanNama}</h3>
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Bulan berikutnya">›</button>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-y-2 text-center">
              {['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'].map((day) => <span key={day} className="pb-1 text-[10px] font-bold text-slate-400">{day}</span>)}
              {calendarCells.map((day, index) => {
                const isToday = day === tanggalHariIni.getDate() && calendarMonth.getMonth() === tanggalHariIni.getMonth() && calendarMonth.getFullYear() === tanggalHariIni.getFullYear();
                return <span key={`${day ?? 'blank'}-${index}`} className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs ${isToday ? 'bg-blue-600 font-extrabold text-white shadow-md' : day ? 'text-slate-700 hover:bg-slate-100' : 'text-transparent'}`}>{day || '·'}</span>;
              })}
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tanggal sekarang</p>
              <p className="mt-1 text-xs font-bold capitalize text-slate-700">{namaTanggal}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div><h2 className="font-extrabold text-slate-900">Jadwal Hari Ini</h2><p className="mt-1 text-xs capitalize text-slate-500">{namaHariIni}, kegiatan mengajar Anda</p></div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600">◷</span>
            </div>
            {jadwalError ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">{jadwalError}</p> : jadwalHariIni.length > 0 ? (
              <div className="mt-4 space-y-3">
                {jadwalHariIni.map((item) => (
                  <div key={item.id} className="relative rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex min-w-[58px] flex-col items-center rounded-lg bg-white px-2 py-2 text-center shadow-sm">
                        <span className="text-xs font-extrabold tabular-nums text-[#123D83]">{item.jamMulai || '--:--'}</span>
                        <span className="my-1 h-px w-7 bg-slate-200" />
                        <span className="text-[10px] font-semibold tabular-nums text-slate-500">{item.jamSelesai || '--:--'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold leading-5 text-slate-800">{item.mataPelajaran || 'Mata pelajaran'}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.namaKelas || 'Rombel belum dicantumkan'}</p>
                        {item.ruang && <p className="mt-1 text-[10px] text-slate-400">Ruang {item.ruang}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                <Link to="/guru/jadwal" className="block rounded-xl border border-blue-100 px-3 py-2.5 text-center text-xs font-bold text-blue-700 transition hover:bg-blue-50">Lihat semua jadwal</Link>
              </div>
            ) : <div className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center"><span className="text-2xl text-slate-300">◷</span><p className="mt-2 text-sm font-bold text-slate-700">Tidak ada jadwal hari ini</p><p className="mt-1 text-xs leading-5 text-slate-500">Jika seharusnya ada jadwal, pastikan penugasan Guru dan tahun ajaran sudah sesuai.</p></div>}
          </section>

          <section className="rounded-2xl bg-gradient-to-br from-[#123D83] to-[#155EEF] p-5 text-white shadow-lg">
            <p className="text-xs font-semibold text-blue-100">Pengingat</p>
            <h2 className="mt-1 text-lg font-extrabold">Tetap terorganisasi</h2>
            <p className="mt-2 text-xs leading-5 text-blue-100">Periksa jadwal, lengkapi absensi siswa, dan isi jurnal mengajar agar catatan pembelajaran selalu diperbarui.</p>
          </section>
        </aside>
      </div>
      <p className="text-center text-[10px] text-slate-400">Data dashboard diperbarui dari Firestore. Tanggal hari ini: {today}.</p>
    </div>
  );
}