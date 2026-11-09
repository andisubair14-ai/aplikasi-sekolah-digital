import { useEffect, useMemo, useState } from 'react';
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

  const cardClass = 'min-w-[160px] max-w-[180px] shrink-0 snap-start bg-white rounded-2xl p-4 shadow-sm border border-slate-100 relative overflow-hidden sm:min-w-0 sm:max-w-none sm:shrink sm:p-5';

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="relative bg-[#082B62] rounded-3xl overflow-hidden shadow-lg flex items-center min-h-[160px]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#082B62] via-[#082B62]/90 to-[#155EEF]/50" />
        <div className="relative z-10 flex items-center gap-6 px-8 sm:px-12 py-6 w-full">
          <div>
            <h1 className="text-xl sm:text-2xl text-blue-100 font-medium mb-1">Executive Dashboard</h1>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-wide">Selamat Datang, {namaKepsek}</h2>
            <p className="text-blue-50 text-sm sm:text-base font-medium">Ringkasan monitoring sekolah berdasarkan data aktual.</p>
            {activePeriod ? (
              <div className="mt-3 inline-flex flex-col gap-1 rounded-xl border border-white/20 bg-white/15 px-4 py-2 shadow-sm sm:flex-row sm:items-center sm:gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-100">Periode Akademik Berjalan</span>
                <span className="text-sm font-extrabold text-white sm:text-base">
                  Tahun Pelajaran {activePeriod.tahun} <span className="text-blue-200">·</span> Semester {activeSemester || '-'}
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

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#155EEF] text-white flex items-center justify-center shadow-lg mb-4 "><StatIcon name="users" /></div>
          <p className="text-slate-500 font-semibold text-sm">Total Siswa Aktif</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(siswaAktif.length)}</h3>
        </div>
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#10B981] text-white flex items-center justify-center shadow-lg mb-4 "><StatIcon name="briefcase" /></div>
          <p className="text-slate-500 font-semibold text-sm">Total Pegawai</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(pegawaiList.length)}</h3>
        </div>
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shadow-lg mb-4 "><StatIcon name="school" /></div>
          <p className="text-slate-500 font-semibold text-sm">Rombel Tahun Aktif</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(kelasAktif.length)}</h3>
        </div>
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shadow-lg mb-4 "><StatIcon name="clipboard-check" /></div>
          <p className="text-slate-500 font-semibold text-sm">Jurnal Menunggu Persetujuan</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(jurnalMenunggu)}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-[#082B62] text-lg">Tren Kehadiran Sekolah</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">Persentase siswa hadir dibandingkan jumlah siswa aktif.</p>
          {hasTrendData ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs><linearGradient id="colorKepsekReal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#155EEF" stopOpacity={0.3} /><stop offset="95%" stopColor="#155EEF" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} dy={10} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} unit="%" />
                  <Tooltip formatter={(value) => value == null ? ['Belum ada data', 'Kehadiran'] : [`${value}%`, 'Kehadiran']} labelFormatter={(_, payload) => payload?.[0]?.payload?.tanggal || ''} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Area type="monotone" dataKey="hadir" connectNulls={false} stroke="#155EEF" strokeWidth={4} fillOpacity={1} fill="url(#colorKepsekReal)" dot={{ fill: '#155EEF', strokeWidth: 2, r: 4, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-center text-slate-500 text-sm">Belum ada catatan absensi dalam 7 hari terakhir.</div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <h3 className="font-bold text-[#082B62] text-lg">Rincian Kehadiran Sekolah Hari Ini</h3>
          {siswaAktif.length > 0 ? (
            <>
              <div className="flex-1 relative flex items-center justify-center min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={kehadiran.pieData} cx="50%" cy="50%" innerRadius={72} outerRadius={96} paddingAngle={1} dataKey="value" stroke="none">
                      {kehadiran.pieData.map((item, index) => <Cell key={item.name} fill={COLORS[index]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-extrabold text-[#082B62]">{kehadiran.persentaseHadir}%</span>
                  <span className="text-sm font-semibold text-slate-500 mt-1">Hadir</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Hadir</span><b className="text-emerald-600">{kehadiran.hadir}</b></div>
                <div className="flex justify-between"><span className="text-slate-600">Sakit / Izin / Alpa</span><b className="text-amber-600">{kehadiran.tidakHadir}</b></div>
                <div className="flex justify-between"><span className="text-slate-600">Belum diisi</span><b className="text-slate-500">{kehadiran.belumDiisi}</b></div>
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-[220px] flex items-center justify-center text-center text-slate-500 text-sm">Belum ada siswa aktif pada tahun ajaran ini.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-[#082B62] mb-2">Ringkasan Monitoring</h3>
        <p className="text-sm text-slate-600">Hari ini tercatat {kehadiran.hadir} siswa hadir, {kehadiran.tidakHadir} siswa berstatus sakit/izin/alpa, dan {kehadiran.belumDiisi} siswa belum memiliki catatan absensi.</p>
        <p className="text-xs text-slate-400 mt-2">Angka diperbarui otomatis dari Firestore. Tanggal hari ini: {today}.</p>
      </div>
    </div>
  );
}