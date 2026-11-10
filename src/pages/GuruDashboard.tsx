import { useEffect, useMemo, useState } from 'react';
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

const COLORS = ['#10B981', '#F59E0B', '#E2E8F0'];

type StatIconName =
  | 'users'
  | 'briefcase'
  | 'clipboard-check'
  | 'school'
  | 'book-open'
  | 'notebook-pen';

function StatIcon({ name }: { name: StatIconName }) {
  return (
    <svg
      aria-hidden="true"
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'users' && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      )}

      {name === 'briefcase' && (
        <>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
          <path d="M10 12v2h4v-2" />
        </>
      )}

      {name === 'clipboard-check' && (
        <>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4.5h6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1Z" />
          <path d="m8.5 13 2.2 2.2 4.8-4.8" />
        </>
      )}

      {name === 'school' && (
        <>
          <path d="m3 9 9-5 9 5" />
          <path d="M5 10h14" />
          <path d="M6 10v9M10 10v9M14 10v9M18 10v9" />
          <path d="M3 21h18M4 19h16" />
        </>
      )}

      {name === 'book-open' && (
        <>
          <path d="M12 7v14" />
          <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 23Z" />
          <path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 1 2.5 2Z" />
        </>
      )}

      {name === 'notebook-pen' && (
        <>
          <path d="M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9" />
          <path d="M8 2v4M3 9h5M3 14h5" />
          <path d="m14 16 5.5-5.5a1.8 1.8 0 0 1 2.5 2.5L16.5 19 13 20Z" />
        </>
      )}
    </svg>
  );
}

export default function GuruDashboard() {
  const { userData } = useAuth();
  const namaGuru = userData?.nama || 'Bapak/Ibu Guru';
  const guruId = userData?.guruId || null;
  const uid = userData?.uid || null;

  const [guruData, setGuruData] = useState<GuruProfileRow | null>(null);
  const [kelasList, setKelasList] = useState<ClassRow[]>([]);
  const [siswaList, setSiswaList] = useState<DashboardRow[]>([]);
  const [tahunList, setTahunList] = useState<YearRow[]>([]);
  const [absensiList, setAbsensiList] = useState<DashboardRow[]>([]);
  const [jurnalUserIdList, setJurnalUserIdList] = useState<JournalRow[]>([]);
  const [jurnalGuruIdList, setJurnalGuruIdList] = useState<JournalRow[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

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

  const cardClass = 'min-w-[160px] max-w-[180px] shrink-0 snap-start bg-white rounded-2xl p-4 shadow-sm border border-slate-100 relative overflow-hidden sm:min-w-0 sm:max-w-none sm:shrink sm:p-5';

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="relative bg-[#155EEF] rounded-3xl overflow-hidden shadow-lg flex items-center min-h-[160px]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#155EEF] via-[#155EEF]/80 to-transparent" />
        <div className="relative z-10 flex items-center gap-6 px-8 sm:px-12 py-6 w-full">
          <div>
            <h1 className="text-xl sm:text-2xl text-blue-100 font-medium mb-1">Selamat Datang,</h1>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-wide">{namaGuru}</h2>
            <p className="text-blue-50 text-sm sm:text-base font-medium">Ringkasan tugas mengajar dan kehadiran rombel Anda.</p>
            {activePeriod ? (
              <div className="mt-3 inline-flex flex-col gap-1 rounded-xl border border-white/20 bg-white/15 px-4 py-2 shadow-sm sm:flex-row sm:items-center sm:gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-100">Periode Akademik Berjalan</span>
                <span className="text-sm font-extrabold text-white sm:text-base">
                  Tahun Pelajaran {activePeriod.tahun} <span className="text-blue-200">·</span> Semester {activePeriod.semester || '-'}
                </span>
              </div>
            ) : (
              <p className="mt-3 inline-flex rounded-xl border border-amber-200/40 bg-amber-300/15 px-4 py-2 text-sm font-semibold text-amber-100">
                Belum ada tahun pelajaran dan semester aktif
              </p>
            )}
          </div>
        </div>
      </div>

      {errorMessage && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">{errorMessage}</div>}
      {!guruData && guruId && !loading && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">Profil pegawai untuk akun ini tidak ditemukan pada koleksi guru.</div>}

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#155EEF] text-white flex items-center justify-center shadow-lg mb-4 "><StatIcon name="book-open" /></div>
          <p className="text-slate-500 font-semibold text-sm">Rombel yang Diampu</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(kelasAktif.length)}</h3>
        </div>
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#10B981] text-white flex items-center justify-center shadow-lg mb-4 "><StatIcon name="users" /></div>
          <p className="text-slate-500 font-semibold text-sm">Total Siswa Diampu</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(siswaDiampu.length)}</h3>
        </div>
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shadow-lg mb-4 "><StatIcon name="clipboard-check" /></div>
          <p className="text-slate-500 font-semibold text-sm">Rombel Absensi Belum Lengkap</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(absensiBelumLengkap)}</h3>
          <p className="text-xs text-slate-500 mt-1">Rombel yang masih memiliki siswa belum diabsen</p>
        </div>
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shadow-lg mb-4 "><StatIcon name="notebook-pen" /></div>
          <p className="text-slate-500 font-semibold text-sm">Jurnal Terisi Bulan Ini</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(jurnalBulanIni)}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-[#082B62] text-lg">Tren Kehadiran Rombel Anda</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">Persentase siswa yang tercatat hadir pada rombel yang Anda ampu.</p>
          {hasTrendData ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs><linearGradient id="colorGuruReal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#155EEF" stopOpacity={0.3} /><stop offset="95%" stopColor="#155EEF" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} dy={10} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} unit="%" />
                  <Tooltip formatter={(value) => value == null ? ['Belum ada data', 'Kehadiran'] : [`${value}%`, 'Kehadiran']} labelFormatter={(_, payload) => payload?.[0]?.payload?.tanggal || ''} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Area type="monotone" dataKey="hadir" connectNulls={false} stroke="#155EEF" strokeWidth={4} fillOpacity={1} fill="url(#colorGuruReal)" dot={{ fill: '#155EEF', strokeWidth: 2, r: 4, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-center text-slate-500 text-sm">Belum ada catatan absensi pada rombel Anda dalam 7 hari terakhir.</div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <h3 className="font-bold text-[#082B62] text-lg">Kehadiran Siswa Hari Ini</h3>
          {siswaDiampu.length > 0 ? (
            <>
              <div className="flex-1 relative flex items-center justify-center min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={absensiHariIni.pieData} cx="50%" cy="50%" innerRadius={72} outerRadius={96} paddingAngle={1} dataKey="value" stroke="none">
                      {absensiHariIni.pieData.map((item, index) => <Cell key={item.name} fill={COLORS[index]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-extrabold text-[#082B62]">{absensiHariIni.persentaseHadir}%</span>
                  <span className="text-sm font-semibold text-slate-500 mt-1">Hadir</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Hadir</span><b className="text-emerald-600">{absensiHariIni.hadir}</b></div>
                <div className="flex justify-between"><span className="text-slate-600">Sakit / Izin / Alpa</span><b className="text-amber-600">{absensiHariIni.tidakHadir}</b></div>
                <div className="flex justify-between"><span className="text-slate-600">Belum diisi</span><b className="text-slate-500">{absensiHariIni.belumDiisi}</b></div>
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-[220px] flex items-center justify-center text-center text-slate-500 text-sm">Belum ada siswa pada rombel yang ditugaskan kepada Anda.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-[#082B62] mb-3">Rombel yang Menjadi Tanggung Jawab Anda</h3>
        {kelasAktif.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {kelasAktif.map((kelas) => (
              <div key={kelas.id} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-w-32">
                <p className="text-xs text-slate-500">{kelas.jenjang || 'Jenjang'} · Tingkat {kelas.tingkat ?? '-'}</p>
                <p className="text-2xl font-extrabold text-[#082B62]">{kelas.namaKelas || '-'}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">Belum ada penugasan rombel untuk akun ini.</p>}
      </div>
      <p className="text-xs text-slate-400">Data dihitung dari penugasan ID guru dan data Firestore. Tanggal hari ini: {today}.</p>
    </div>
  );
}