import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FotoProfilKepsek from '../components/FotoProfilKepsek';
import ilustrasiGuruLakiLaki from '../assets/ilustrasi-guru-laki-laki.png';
import ilustrasiGuruPerempuan from '../assets/ilustrasi-guru-perempuan.png';
import { useAuth } from '../contexts/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  collection, onSnapshot, query, where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  buildWeeklyTrend,
  formatIndonesianNumber,
  getLastSevenDays,
  isStudentActiveForYear,
  localDateKey,
  summarizeAttendance,
  type DashboardRow
} from '../lib/dashboardUtils';

type ClassRow = DashboardRow & { tahunAjaran?: string; jenjang?: string };
type YearRow = DashboardRow & { tahun?: string; semester?: string; status?: string };
type JournalRow = DashboardRow & { status?: string };

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

export default function KepsekDashboard() {
  const { userData } = useAuth();
  const namaKepsek = userData?.nama || 'Kepala Sekolah';
  // Sama persis dengan Dashboard Guru: jenis kelamin dibaca dari userData AuthContext.
  const ilustrasiKepsek =
    userData?.jenisKelamin === 'Perempuan'
      ? ilustrasiGuruPerempuan
      : userData?.jenisKelamin === 'Laki-laki'
        ? ilustrasiGuruLakiLaki
        : null;
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [siswaList, setSiswaList] = useState<DashboardRow[]>([]);
  const [pegawaiList, setPegawaiList] = useState<DashboardRow[]>([]);
  const [kelasList, setKelasList] = useState<ClassRow[]>([]);
  const [tahunList, setTahunList] = useState<YearRow[]>([]);
  const [absensiList, setAbsensiList] = useState<DashboardRow[]>([]);
  const [jurnalList, setJurnalList] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const today = localDateKey(new Date());
  const weekStart = getLastSevenDays()[0].tanggal;

  useEffect(() => {
    const ready: Record<string, boolean> = {
      siswa: false, pegawai: false, kelas: false, tahun: false, absensi: false, jurnal: false
    };
    const markReady = (key: string) => {
      if (!ready[key]) ready[key] = true;
      if (Object.values(ready).every(Boolean)) setLoading(false);
    };
    const handleError = (label: string, key: string) => (error: Error) => {
      console.error(`Gagal memuat ${label}:`, error);
      setErrorMessage(`Sebagian data ${label} tidak dapat dimuat. Periksa koneksi dan aturan akses Firebase.`);
      markReady(key);
    };

    const unsubscribers = [
      onSnapshot(collection(db, 'siswa'), (snap) => {
        setSiswaList(snap.docs.map((item) => ({ id: item.id, ...item.data() })) as DashboardRow[]);
        markReady('siswa');
      }, handleError('siswa', 'siswa')),
      onSnapshot(collection(db, 'guru'), (snap) => {
        setPegawaiList(snap.docs.map((item) => ({ id: item.id, ...item.data() })) as DashboardRow[]);
        markReady('pegawai');
      }, handleError('pegawai', 'pegawai')),
      onSnapshot(collection(db, 'kelas'), (snap) => {
        setKelasList(snap.docs.map((item) => ({ id: item.id, ...item.data() })) as ClassRow[]);
        markReady('kelas');
      }, handleError('kelas', 'kelas')),
      onSnapshot(query(collection(db, 'tahun_ajaran'), where('status', '==', 'Aktif')), (snap) => {
        setTahunList(snap.docs.map((item) => ({ id: item.id, ...item.data() })) as YearRow[]);
        markReady('tahun');
      }, handleError('tahun ajaran', 'tahun')),
      onSnapshot(
        query(collection(db, 'absensi'), where('tanggal', '>=', weekStart), where('tanggal', '<=', today)),
        (snap) => {
          setAbsensiList(snap.docs.map((item) => ({ id: item.id, ...item.data() })) as DashboardRow[]);
          markReady('absensi');
        },
        handleError('absensi', 'absensi')
      ),
      onSnapshot(collection(db, 'jurnal'), (snap) => {
        setJurnalList(snap.docs.map((item) => ({ id: item.id, ...item.data() })) as JournalRow[]);
        markReady('jurnal');
      }, handleError('jurnal', 'jurnal'))
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [today, weekStart]);

  const activePeriod = useMemo(
    () => tahunList.find((item) => item.status === 'Aktif') || null,
    [tahunList]
  );
  const activeYear = activePeriod?.tahun || null;
  const activeSemester = activePeriod?.semester || null;
  const siswaAktif = useMemo(
    () => siswaList.filter((item) => isStudentActiveForYear(item, activeYear)),
    [siswaList, activeYear]
  );
  const kelasAktif = useMemo(
    () => activeYear ? kelasList.filter((item) => item.tahunAjaran === activeYear) : kelasList,
    [kelasList, activeYear]
  );
  const kehadiran = useMemo(
    () => summarizeAttendance(absensiList, siswaAktif.length, today),
    [absensiList, siswaAktif.length, today]
  );
  const trend = useMemo(
    () => buildWeeklyTrend(absensiList, siswaAktif.length),
    [absensiList, siswaAktif.length]
  );
  const hasTrendData = trend.some((item) => item.hadir !== null);
  const jurnalMenunggu = jurnalList.filter((item) =>
    item.status === 'Dikirim' &&
    (!activeYear || item.tahunAjaran === activeYear) &&
    (!activeSemester || item.semester === activeSemester)
  ).length;

  const bulanNama = calendarMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const hariPertama = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const jumlahHari = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const offsetSenin = (hariPertama.getDay() + 6) % 7;
  const tanggalHariIni = new Date();
  const namaTanggal = tanggalHariIni.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: offsetSenin }, () => null),
    ...Array.from({ length: jumlahHari }, (_, index) => index + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);


  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-10">
      <style>{`
        @keyframes kepsek-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-9px); }
        }
        .kepsek-illustration { animation: kepsek-float 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .kepsek-illustration { animation: none; }
        }
      `}</style>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-5">
          {/* Banner mengikuti struktur Dashboard Guru */}
          <section className="relative isolate flex min-h-[220px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#123D83] via-[#155EEF] to-[#3188E8] p-4 text-white shadow-xl sm:min-h-[250px] sm:p-6">
            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl" />
            <div className="relative z-10 flex w-full items-center gap-1 sm:gap-2">
              <div className="flex w-[27%] shrink-0 items-center justify-center sm:w-[28%]">
                {ilustrasiKepsek && (
                  <img
                    src={ilustrasiKepsek}
                    alt="Ilustrasi Kepala Sekolah"
                    className="kepsek-illustration h-44 w-full max-w-[160px] object-contain object-center drop-shadow-2xl sm:h-56 sm:max-w-[230px]"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[9px] font-bold tracking-[0.12em] text-blue-100 sm:text-xs sm:tracking-[0.16em]">
                  EXECUTIVE DASHBOARD
                </span>
                <p className="mt-2 text-xs font-medium text-blue-100 sm:mt-3 sm:text-lg">Selamat datang kembali,</p>
                <h1 className="mt-1 break-words text-xl font-extrabold leading-tight tracking-tight sm:text-4xl">{namaKepsek}</h1>
                <p className="mt-2 max-w-lg text-[11px] leading-4 text-blue-100 sm:mt-3 sm:text-sm sm:leading-6">
                  Pantau perkembangan sekolah, kehadiran siswa, dan aktivitas pembelajaran dalam satu tempat.
                </p>
                {activePeriod ? (
                  <div className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-semibold sm:mt-4 sm:text-sm">
                    <span className="text-blue-100">Tahun Pelajaran</span>
                    <span>{activePeriod.tahun || '-'}</span>
                    <span className="text-blue-200">·</span>
                    <span>Semester {activeSemester || '-'}</span>
                  </div>
                ) : (
                  <p className="mt-3 inline-flex rounded-xl bg-amber-300/15 px-3 py-2 text-[10px] font-semibold text-amber-100 sm:mt-4 sm:text-xs">
                    Tahun ajaran aktif belum diatur
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <Link
                  to="/kepsek/profil"
                  className="group flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 text-center transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  title="Buka Profil Kepala Sekolah"
                  aria-label="Buka Profil Kepala Sekolah"
                >
                  <FotoProfilKepsek
                    uid={userData?.uid}
                    nama={namaKepsek}
                    className="h-10 w-10 border-2 border-white/80 text-sm shadow-lg transition-transform group-hover:scale-105 sm:h-12 sm:w-12 sm:text-base"
                  />
                  <span className="text-[10px] font-semibold leading-tight text-blue-100 transition-colors group-hover:text-white sm:text-xs">
                    Kepsek Sekolah
                  </span>
                </Link>
              </div>
            </div>
          </section>

          {errorMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          )}

          {/* Kartu AI bersifat informasi sampai integrasi tersedia */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-[#F5F0FF] to-white p-5 shadow-sm">
              <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-violet-200/40 blur-xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-xl text-white shadow-md">✦</div>
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">Segera hadir</span>
              </div>
              <h2 className="relative mt-4 text-base font-extrabold text-slate-900 sm:text-lg">AI Asisten Kepala Sekolah</h2>
              <p className="relative mt-1 max-w-sm text-xs leading-5 text-slate-600 sm:text-sm">
                Dukungan AI untuk membantu menyiapkan analisis dan ringkasan pengelolaan sekolah.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-[#EAFBFF] to-white p-5 shadow-sm">
              <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-cyan-200/40 blur-xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-xl text-white shadow-md">✧</div>
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700">Segera hadir</span>
              </div>
              <h2 className="relative mt-4 text-base font-extrabold text-slate-900 sm:text-lg">AI Analisis Sekolah</h2>
              <p className="relative mt-1 max-w-sm text-xs leading-5 text-slate-600 sm:text-sm">
                Ringkasan berbantuan AI untuk mendukung evaluasi data dan perencanaan sekolah.
              </p>
            </div>
          </section>

          {/* Statistik Firestore asli Kepsek tetap dipertahankan */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total Siswa Aktif', value: siswaAktif.length, icon: 'users' as const },
              { label: 'Total Pegawai', value: pegawaiList.length, icon: 'briefcase' as const },
              { label: 'Rombel Tahun Aktif', value: kelasAktif.length, icon: 'school' as const },
              { label: 'Jurnal Menunggu Persetujuan', value: jurnalMenunggu, icon: 'clipboard-check' as const }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs">{item.label}</p>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <StatIcon name={item.icon} />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  {loading ? '...' : formatIndonesianNumber(item.value)}
                </p>
                <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Data diperbarui dari Firestore</p>
              </div>
            ))}
          </section>

          {/* Grafik dan rincian kehadiran asli */}
          <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
            <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5">
                <h2 className="font-extrabold text-slate-900">Tren Kehadiran Sekolah</h2>
                <p className="mt-1 text-xs text-slate-500">Persentase siswa yang tercatat hadir dalam 7 hari terakhir.</p>
              </div>
              {hasTrendData ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorKepsekReal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#155EEF" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#155EEF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EEF6" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} dy={8} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} unit="%" />
                      <Tooltip
                        formatter={(value) => value == null ? ['Belum ada data', 'Kehadiran'] : [`${value}%`, 'Kehadiran']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.tanggal || ''}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }}
                      />
                      <Area type="monotone" dataKey="hadir" connectNulls={false} stroke="#155EEF" strokeWidth={3} fillOpacity={1} fill="url(#colorKepsekReal)" dot={{ fill: '#155EEF', strokeWidth: 2, r: 3, stroke: '#fff' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-slate-500">
                  Belum ada catatan absensi dalam 7 hari terakhir.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="font-extrabold text-slate-900">Kehadiran Sekolah Hari Ini</h2>
              <p className="mt-1 text-xs text-slate-500">Ringkasan status kehadiran seluruh siswa aktif.</p>
              {siswaAktif.length > 0 ? (
                <>
                  <div className="relative flex min-h-[210px] items-center justify-center">
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie data={kehadiran.pieData} cx="50%" cy="50%" innerRadius={62} outerRadius={86} paddingAngle={1} dataKey="value" stroke="none">
                          {kehadiran.pieData.map((item, index) => <Cell key={item.name} fill={COLORS[index]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold text-slate-900">{kehadiran.persentaseHadir}%</span>
                      <span className="mt-1 text-xs font-semibold text-slate-500">Hadir</span>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                    <div className="flex justify-between"><span className="text-slate-600">Hadir</span><b className="text-emerald-600">{kehadiran.hadir}</b></div>
                    <div className="flex justify-between"><span className="text-slate-600">Sakit / Izin / Alpa</span><b className="text-amber-600">{kehadiran.tidakHadir}</b></div>
                    <div className="flex justify-between"><span className="text-slate-600">Belum diisi</span><b className="text-slate-500">{kehadiran.belumDiisi}</b></div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[240px] items-center justify-center text-center text-sm text-slate-500">
                  Belum ada siswa aktif pada tahun ajaran ini.
                </div>
              )}
            </div>
          </section>

          {/* Ringkasan monitoring asli */}
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-extrabold text-slate-900">Ringkasan Monitoring</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Hari ini tercatat {kehadiran.hadir} siswa hadir, {kehadiran.tidakHadir} siswa berstatus sakit/izin/alpa, dan {kehadiran.belumDiisi} siswa belum memiliki catatan absensi.
            </p>
            <p className="mt-2 text-xs text-slate-400">Angka diperbarui otomatis dari Firestore. Tanggal hari ini: {today}.</p>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
              <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-blue-200/40 blur-xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-md">⌂</div>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">Monitoring</span>
              </div>
              <h2 className="relative mt-4 text-base font-extrabold text-slate-900 sm:text-lg">Pemantauan Sekolah</h2>
              <p className="relative mt-1 max-w-sm text-xs leading-5 text-slate-600 sm:text-sm">
                Pantau data siswa, pegawai, rombongan belajar, dan kehadiran sekolah dari ringkasan dashboard.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-sm">
              <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full bg-cyan-200/40 blur-xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-xl text-white shadow-md">✧</div>
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700">Ringkasan data</span>
              </div>
              <h2 className="relative mt-4 text-base font-extrabold text-slate-900 sm:text-lg">Evaluasi Kehadiran</h2>
              <p className="relative mt-1 max-w-sm text-xs leading-5 text-slate-600 sm:text-sm">
                Persentase dan rincian kehadiran siswa mengikuti catatan absensi yang masuk ke sistem.
              </p>
            </div>
          </section>
        </main>

        {/* Kolom kanan mengikuti pola Dashboard Guru */}
        <aside className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-extrabold text-slate-900">Kalender Sekolah</h2>
                <p className="mt-1 text-xs text-slate-500">Lihat tanggal dan hari berjalan.</p>
              </div>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700">Hari ini</span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Bulan sebelumnya">‹</button>
              <h3 className="text-sm font-bold capitalize text-slate-800">{bulanNama}</h3>
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Bulan berikutnya">›</button>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-y-2 text-center">
              {['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'].map((day) => (
                <span key={day} className="pb-1 text-[10px] font-bold text-slate-400">{day}</span>
              ))}
              {calendarCells.map((day, index) => {
                const isToday = day === tanggalHariIni.getDate() &&
                  calendarMonth.getMonth() === tanggalHariIni.getMonth() &&
                  calendarMonth.getFullYear() === tanggalHariIni.getFullYear();
                return (
                  <span key={`${day ?? 'blank'}-${index}`} className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs ${isToday ? 'bg-blue-600 font-extrabold text-white shadow-md' : day ? 'text-slate-700 hover:bg-slate-100' : 'text-transparent'}`}>
                    {day || '·'}
                  </span>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tanggal sekarang</p>
              <p className="mt-1 text-xs font-bold capitalize text-slate-700">{namaTanggal}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-extrabold text-slate-900">Agenda Sekolah</h2>
                <p className="mt-1 text-xs text-slate-500">Informasi kegiatan sekolah.</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">▦</span>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-7 text-center">
              <p className="text-sm font-bold text-slate-700">Belum ada agenda ditampilkan</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Bagian ini siap menampilkan agenda setelah sumber data agenda sekolah tersedia.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-extrabold text-slate-900">Aktivitas Monitoring</h2>
                <p className="mt-1 text-xs text-slate-500">Ringkasan kondisi data sekolah.</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600">✓</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Data siswa aktif', value: siswaAktif.length },
                { label: 'Data pegawai', value: pegawaiList.length },
                { label: 'Rombel tahun aktif', value: kelasAktif.length },
                { label: 'Jurnal menunggu persetujuan', value: jurnalMenunggu }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <span className="text-xs text-slate-600">{item.label}</span>
                  <b className="text-sm tabular-nums text-slate-900">{loading ? '...' : formatIndonesianNumber(item.value)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-gradient-to-br from-[#123D83] to-[#155EEF] p-5 text-white shadow-lg">
            <p className="text-xs font-semibold text-blue-100">Pengingat</p>
            <h2 className="mt-1 text-lg font-extrabold">Pantau perkembangan sekolah</h2>
            <p className="mt-2 text-xs leading-5 text-blue-100">
              Periksa data kehadiran, rombongan belajar, dan jurnal yang menunggu persetujuan secara berkala.
            </p>
          </section>
        </aside>
      </div>

      <p className="text-center text-[10px] text-slate-400">
        Data dashboard diperbarui dari Firestore. Tanggal hari ini: {today}.
      </p>
    </div>
  );
}
