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

type YearRow = DashboardRow & { tahun?: string; status?: string };
type JournalRow = DashboardRow & { guruId?: string; namaGuru?: string; tanggal?: string; createdAt?: string; kelas?: string };

const COLORS = ['#10B981', '#F59E0B', '#E2E8F0'];

export default function GuruDashboard() {
  const { userData } = useAuth();
  const namaGuru = userData?.nama || 'Bapak/Ibu Guru';
  const guruId = userData?.guruId || null;

  const [guruData, setGuruData] = useState<DashboardRow | null>(null);
  const [kelasList, setKelasList] = useState<ClassRow[]>([]);
  const [siswaList, setSiswaList] = useState<DashboardRow[]>([]);
  const [tahunList, setTahunList] = useState<YearRow[]>([]);
  const [absensiList, setAbsensiList] = useState<DashboardRow[]>([]);
  const [jurnalList, setJurnalList] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const today = localDateKey(new Date());
  const weekStart = getLastSevenDays()[0].tanggal;

  useEffect(() => {
    if (!guruId) {
      setLoading(false);
      setErrorMessage('Akun Guru belum terhubung dengan data pegawai. Hubungkan akun melalui menu Manajemen Pengguna.');
      return;
    }

    const ready: Record<string, boolean> = {
      guru: false, kelas: false, siswa: false, tahun: false, absensi: false, jurnal: false
    };
    const markReady = (key: string) => {
      if (!ready[key]) ready[key] = true;
      if (Object.values(ready).every(Boolean)) setLoading(false);
    };
    const handleError = (label: string, key: string) => (error: Error) => {
      console.error(`Gagal memuat ${label}:`, error);
      setErrorMessage(`Data ${label} tidak dapat dimuat. Periksa koneksi dan aturan akses Firebase.`);
      markReady(key);
    };

    const unsubscribers = [
      onSnapshot(doc(db, 'guru', guruId), (snap) => {
        setGuruData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        markReady('guru');
      }, handleError('profil guru', 'guru')),
      onSnapshot(collection(db, 'kelas'), (snap) => {
        setKelasList(snap.docs.map((item) => ({ id: item.id, ...item.data() })) as ClassRow[]);
        markReady('kelas');
      }, handleError('rombel', 'kelas')),
      onSnapshot(collection(db, 'siswa'), (snap) => {
        setSiswaList(snap.docs.map((item) => ({ id: item.id, ...item.data() })) as DashboardRow[]);
        markReady('siswa');
      }, handleError('siswa', 'siswa')),
      onSnapshot(collection(db, 'tahun_ajaran'), (snap) => {
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
  }, [guruId, today, weekStart]);

  const activeYear = tahunList.find((item) => item.status === 'Aktif')?.tahun || null;

  const kelasAktif = useMemo(() => {
    const padaTahunAktif = activeYear
      ? kelasList.filter((item) => item.tahunAjaran === activeYear)
      : kelasList;
    const kelasMap = new Map<string, ClassRow>();
    const idsMapel = Array.isArray(guruData?.kelasDiampu)
      ? guruData.kelasDiampu as string[]
      : [];

    padaTahunAktif.forEach((kelas) => {
      const id = String(kelas.id || '');
      if (kelas.waliKelasId === guruId || idsMapel.includes(id)) {
        kelasMap.set(id, kelas);
      }
    });

    return Array.from(kelasMap.values());
  }, [kelasList, guruData, guruId, activeYear]);

  const kelasIds = useMemo(() => new Set(kelasAktif.map((item) => String(item.id || ''))), [kelasAktif]);
  const kelasNames = useMemo(() => new Set(kelasAktif.map((item) => String(item.namaKelas || ''))), [kelasAktif]);

  const siswaDiampu = useMemo(() => {
    return siswaList.filter((student) => {
      if (!isStudentActiveForYear(student, activeYear)) return false;
      const id = String(student.kelasId || '');
      const namaKelas = String(student.kelas || '');
      const yearMatches = !activeYear || !student.tahunAjaran || student.tahunAjaran === activeYear;
      return kelasIds.has(id) || (yearMatches && kelasNames.has(namaKelas));
    });
  }, [siswaList, activeYear, kelasIds, kelasNames]);

  const absensiHariIni = useMemo(
    () => summarizeAttendance(absensiList, siswaDiampu.length, today, kelasNames),
    [absensiList, siswaDiampu.length, today, kelasNames]
  );

  const trend = useMemo(
    () => buildWeeklyTrend(absensiList, siswaDiampu.length, kelasNames),
    [absensiList, siswaDiampu.length, kelasNames]
  );
  const hasTrendData = trend.some((item) => item.hadir !== null);

  const absensiBelumLengkap = useMemo(() => {
    if (siswaDiampu.length === 0) return 0;

    return kelasAktif.filter((kelas) => {
      const namaKelas = String(kelas.namaKelas || '');
      const siswaKelas = siswaDiampu.filter((student) => {
        const id = String(student.kelasId || '');
        return id ? id === kelas.id : String(student.kelas || '') === namaKelas;
      });

      if (siswaKelas.length === 0) return false;

      const recorded = new Set(
        absensiList
          .filter((item) => item.tanggal === today && String(item.kelas || '') === namaKelas)
          .map((item) => String(item.nisn || ''))
      );

      return siswaKelas.some((student) => !recorded.has(String(student.nisn || '')));
    }).length;
  }, [kelasAktif, siswaDiampu, absensiList, today]);

  const jurnalBulanIni = useMemo(() => {
    return jurnalList.filter((item) => {
      const milikGuru = item.guruId
        ? item.guruId === guruId
        : item.namaGuru === namaGuru;
      const tanggalJurnal = item.tanggal || item.createdAt;
      return milikGuru && isThisMonth(tanggalJurnal);
    }).length;
  }, [jurnalList, guruId, namaGuru]);

  const cardClass = 'bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden';

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="relative bg-[#155EEF] rounded-3xl overflow-hidden shadow-lg flex items-center min-h-[160px]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#155EEF] via-[#155EEF]/80 to-transparent" />
        <div className="relative z-10 flex items-center gap-6 px-8 sm:px-12 py-6 w-full">
          <div>
            <h1 className="text-xl sm:text-2xl text-blue-100 font-medium mb-1">Selamat Datang,</h1>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-wide">{namaGuru}</h2>
            <p className="text-blue-50 text-sm sm:text-base font-medium">Ringkasan tugas mengajar dan kehadiran rombel Anda.</p>
            <p className="text-blue-100 text-xs mt-1">{activeYear ? `Tahun Ajaran ${activeYear}` : 'Semua tahun ajaran — belum ada tahun ajaran aktif'}</p>
          </div>
        </div>
      </div>

      {errorMessage && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">{errorMessage}</div>}
      {!guruData && guruId && !loading && <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">Profil pegawai untuk akun ini tidak ditemukan pada koleksi guru.</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#155EEF] text-white flex items-center justify-center shadow-lg mb-4 text-xl">▣</div>
          <p className="text-slate-500 font-semibold text-sm">Rombel yang Diampu</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(kelasAktif.length)}</h3>
        </div>
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#10B981] text-white flex items-center justify-center shadow-lg mb-4 text-xl">♧</div>
          <p className="text-slate-500 font-semibold text-sm">Total Siswa Diampu</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(siswaDiampu.length)}</h3>
        </div>
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shadow-lg mb-4 text-xl">✓</div>
          <p className="text-slate-500 font-semibold text-sm">Rombel Absensi Belum Lengkap</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{loading ? '...' : formatIndonesianNumber(absensiBelumLengkap)}</h3>
          <p className="text-xs text-slate-500 mt-1">Rombel yang masih memiliki siswa belum diabsen</p>
        </div>
        <div className={cardClass}>
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shadow-lg mb-4 text-xl">✎</div>
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
