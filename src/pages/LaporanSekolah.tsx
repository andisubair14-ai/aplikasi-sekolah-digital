import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type SchoolRecord = Record<string, unknown> & { id: string };
type SourceKey =
  | 'siswa'
  | 'guru'
  | 'kelas'
  | 'absensi'
  | 'absensiGuru'
  | 'jurnal'
  | 'inventaris'
  | 'ruang'
  | 'pemeliharaan';

type SourceState = {
  rows: SchoolRecord[] | null;
  loading: boolean;
  error: string;
};

const COLLECTIONS: Record<SourceKey, string> = {
  siswa: 'siswa',
  guru: 'guru',
  kelas: 'kelas',
  absensi: 'absensi',
  absensiGuru: 'absensi_guru',
  jurnal: 'jurnal',
  inventaris: 'inventaris_sarpras',
  ruang: 'ruang_fasilitas_sarpras',
  pemeliharaan: 'pemeliharaan_sarpras',
};

const buatSumberAwal = (): Record<SourceKey, SourceState> => ({
  siswa: { rows: null, loading: true, error: '' },
  guru: { rows: null, loading: true, error: '' },
  kelas: { rows: null, loading: true, error: '' },
  absensi: { rows: null, loading: true, error: '' },
  absensiGuru: { rows: null, loading: true, error: '' },
  jurnal: { rows: null, loading: true, error: '' },
  inventaris: { rows: null, loading: true, error: '' },
  ruang: { rows: null, loading: true, error: '' },
  pemeliharaan: { rows: null, loading: true, error: '' },
});

const tanggalLokal = (date: Date): string => {
  const tahun = date.getFullYear();
  const bulan = String(date.getMonth() + 1).padStart(2, '0');
  const hari = String(date.getDate()).padStart(2, '0');
  return `${tahun}-${bulan}-${hari}`;
};

const formatAngka = (value: number): string =>
  value.toLocaleString('id-ID');

const formatTanggalPanjang = (date: Date): string =>
  new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: 'users' | 'briefcase' | 'calendar' | 'book' | 'building' | 'box' | 'clipboard' | 'file' | 'printer' | 'alert' | 'chart' | 'refresh';
  className?: string;
}) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'users': return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case 'briefcase': return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></svg>;
    case 'calendar': return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h3M8 17h6" /></svg>;
    case 'book': return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5ZM4 18a2.5 2.5 0 0 1 2.5-2.5H20" /></svg>;
    case 'building': return <svg {...common}><path d="M3 21h18M5 21V5l7-2 7 2v16M9 8h1m4 0h1M9 12h1m4 0h1M9 16h1m4 0h1M11 21v-3h2v3" /></svg>;
    case 'box': return <svg {...common}><path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" /><path d="m3.8 7.7 8.2 4.4 8.2-4.4M12 12.1V21" /></svg>;
    case 'clipboard': return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M8 10h8M8 14h8M8 18h5" /></svg>;
    case 'file': return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg>;
    case 'printer': return <svg {...common}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6zM18 12h.01" /></svg>;
    case 'alert': return <svg {...common}><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></svg>;
    case 'chart': return <svg {...common}><path d="M3 3v18h18M8 15l4-4 3 3 6-7" /></svg>;
    case 'refresh': return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></svg>;
    default: return null;
  }
}

const REPORT_CATEGORIES = [
  { title: 'Laporan Data Siswa', description: 'Jumlah peserta didik, sebaran kelas, dan status siswa.', icon: 'users' as const, tone: 'blue', slug: 'data-siswa' },
  { title: 'Laporan Kehadiran', description: 'Rekap kehadiran siswa dan guru berdasarkan periode.', icon: 'calendar' as const, tone: 'emerald', slug: 'kehadiran' },
  { title: 'Laporan Pembelajaran', description: 'Aktivitas jurnal mengajar dan status persetujuannya.', icon: 'book' as const, tone: 'violet', slug: 'pembelajaran' },
  { title: 'Laporan Kepegawaian', description: 'Ringkasan data guru dan tenaga kependidikan.', icon: 'briefcase' as const, tone: 'amber', slug: 'kepegawaian' },
  { title: 'Laporan Sarpras', description: 'Inventaris, ruang, fasilitas, serta pemeliharaan.', icon: 'building' as const, tone: 'cyan', slug: 'sarpras' },
  { title: 'Laporan Administrasi', description: 'Ringkasan kegiatan administrasi dan pengumuman.', icon: 'file' as const, tone: 'rose', slug: 'administrasi' },
];

export default function LaporanSekolah() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const basePath = isAdmin ? '/admin' : '/kepsek';
  const [sources, setSources] = useState<Record<SourceKey, SourceState>>(buatSumberAwal);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribers = (Object.entries(COLLECTIONS) as [SourceKey, string][]).map(([key, collectionName]) =>
      onSnapshot(
        collection(db, collectionName),
        (snapshot) => {
          const rows = snapshot.docs.map((item) => ({ ...item.data(), id: item.id })) as SchoolRecord[];
          setSources((previous) => ({
            ...previous,
            [key]: { rows, loading: false, error: '' },
          }));
          setLastUpdated(new Date());
        },
        (error) => {
          console.error(`Gagal membaca koleksi ${collectionName}:`, error);
          setSources((previous) => ({
            ...previous,
            [key]: {
              rows: null,
              loading: false,
              error: 'Data tidak dapat dibaca. Periksa koneksi dan hak akses Firestore.',
            },
          }));
        }
      )
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const getRows = (key: SourceKey): SchoolRecord[] => sources[key].rows || [];
  const isReady = (key: SourceKey): boolean => sources[key].rows !== null;
  const isLoading = Object.values(sources).some((source) => source.loading);
  const errors = Object.entries(sources).filter(([, source]) => Boolean(source.error));

  const tanggalHariIni = tanggalLokal(new Date());
  const dataAbsensiHariIni = useMemo(
    () => getRows('absensi').filter((item) => String(item.tanggal || '') === tanggalHariIni),
    [sources.absensi.rows, tanggalHariIni]
  );
  const hadirHariIni = dataAbsensiHariIni.filter((item) => item.status === 'Hadir').length;
  const persentaseHadir = dataAbsensiHariIni.length
    ? Math.round((hadirHariIni / dataAbsensiHariIni.length) * 100)
    : 0;

  const jurnalMenunggu = getRows('jurnal').filter((item) => item.status === 'Dikirim').length;
  const jurnalDisetujui = getRows('jurnal').filter((item) => item.status === 'Disetujui').length;
  const jurnalPerbaikan = getRows('jurnal').filter((item) => item.status === 'Perlu Perbaikan').length;

  const totalUnitInventaris = getRows('inventaris').reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
  const inventarisPerhatian = getRows('inventaris').filter((item) => item.kondisi !== 'Baik').length;
  const ruangPerhatian = getRows('ruang').filter((item) => item.kondisi !== 'Baik').length;
  const pemeliharaanTerbuka = getRows('pemeliharaan').filter(
    (item) => !['Selesai', 'Tidak Dapat Diperbaiki'].includes(String(item.status || ''))
  ).length;

  const trenKehadiran = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = tanggalLokal(date);
      const rows = getRows('absensi').filter((item) => String(item.tanggal || '') === key);
      const present = rows.filter((item) => item.status === 'Hadir').length;
      const percent = rows.length ? Math.round((present / rows.length) * 100) : 0;
      return {
        key,
        label: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date),
        present,
        total: rows.length,
        percent,
      };
    });
  }, [sources.absensi.rows]);

  const latestJurnal = useMemo(() => {
    return [...getRows('jurnal')]
      .sort((a, b) => String(b.tanggal || b.createdAt || '').localeCompare(String(a.tanggal || a.createdAt || '')))
      .slice(0, 5);
  }, [sources.jurnal.rows]);

  const attendanceBreakdown = [
    { label: 'Hadir', count: dataAbsensiHariIni.filter((item) => item.status === 'Hadir').length, style: 'bg-emerald-500' },
    { label: 'Izin', count: dataAbsensiHariIni.filter((item) => item.status === 'Izin').length, style: 'bg-blue-500' },
    { label: 'Sakit', count: dataAbsensiHariIni.filter((item) => item.status === 'Sakit').length, style: 'bg-amber-500' },
    { label: 'Alpa', count: dataAbsensiHariIni.filter((item) => item.status === 'Alpa').length, style: 'bg-rose-500' },
  ];
  const maxAttendanceCount = Math.max(1, ...attendanceBreakdown.map((item) => item.count));

  const nilaiSumber = (key: SourceKey, value: number): string =>
    isReady(key) ? formatAngka(value) : '—';

  const handlePrint = () => window.print();

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 text-slate-700">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .report-print { box-shadow: none !important; border-color: #dbe2ea !important; break-inside: avoid; }
          .report-shell { padding: 0 !important; }
        }
      `}</style>

      <section className="report-print overflow-hidden rounded-3xl bg-gradient-to-br from-[#082B62] via-[#10458A] to-[#1766C4] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide text-blue-100">
              <Icon name="chart" className="h-4 w-4" /> PUSAT LAPORAN SEKOLAH
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Ringkasan Laporan</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">
              Pantau data peserta didik, kehadiran, pembelajaran, kepegawaian, serta kondisi sarana dan prasarana sekolah dalam satu halaman.
            </p>
            <p className="mt-4 text-sm font-semibold text-white">{formatTanggalPanjang(new Date())}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20">
              <Icon name="refresh" className="h-4 w-4" /> Muat Ulang
            </button>
            <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-[#10458A] shadow-sm transition hover:bg-blue-50">
              <Icon name="printer" className="h-4 w-4" /> Cetak Ringkasan
            </button>
          </div>
        </div>
      </section>

      {errors.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Sebagian data laporan belum dapat dimuat.</p>
              <p className="mt-1">Bagian yang bermasalah: {errors.map(([key]) => key).join(', ')}. Periksa koneksi dan aturan akses Firestore. Angka untuk sumber tersebut ditampilkan sebagai tanda pisah, bukan dianggap nol.</p>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-[#082B62]">Gambaran Umum Sekolah</h2>
            <p className="mt-1 text-sm text-slate-500">Ringkasan diperbarui otomatis mengikuti perubahan data Firestore.</p>
          </div>
          <span className="text-xs text-slate-400">{lastUpdated ? `Data diperbarui ${lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : isLoading ? 'Menghubungkan ke Firebase…' : 'Menunggu pembaruan data'}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="report-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">Data Siswa</span><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon name="users" className="h-5 w-5" /></span></div>
            <p className="mt-3 text-3xl font-extrabold text-[#082B62]">{nilaiSumber('siswa', getRows('siswa').length)}</p>
            <p className="mt-1 text-xs text-slate-400">Jumlah data peserta didik</p>
          </article>
          <article className="report-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">Data Pegawai</span><span className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><Icon name="briefcase" className="h-5 w-5" /></span></div>
            <p className="mt-3 text-3xl font-extrabold text-[#082B62]">{nilaiSumber('guru', getRows('guru').length)}</p>
            <p className="mt-1 text-xs text-slate-400">Guru dan tenaga kependidikan terdata</p>
          </article>
          <article className="report-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">Kehadiran Siswa Hari Ini</span><span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Icon name="calendar" className="h-5 w-5" /></span></div>
            <p className="mt-3 text-3xl font-extrabold text-[#082B62]">{isReady('absensi') && dataAbsensiHariIni.length > 0 ? `${persentaseHadir}%` : '—'}</p>
            <p className="mt-1 text-xs text-slate-400">{!isReady('absensi') ? 'Data kehadiran belum tersedia' : dataAbsensiHariIni.length > 0 ? `${formatAngka(hadirHariIni)} hadir dari ${formatAngka(dataAbsensiHariIni.length)} catatan absensi hari ini` : 'Belum ada absensi siswa yang dicatat hari ini'}</p>
          </article>
          <article className="report-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">Jurnal Menunggu</span><span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Icon name="clipboard" className="h-5 w-5" /></span></div>
            <p className="mt-3 text-3xl font-extrabold text-[#082B62]">{nilaiSumber('jurnal', jurnalMenunggu)}</p>
            <p className="mt-1 text-xs text-slate-400">Jurnal berstatus Dikirim</p>
          </article>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <article className="report-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="font-extrabold text-[#082B62]">Tren Kehadiran Siswa</h2><p className="mt-1 text-xs text-slate-500">Persentase Hadir dari catatan absensi setiap hari · 7 hari terakhir</p></div>
            <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Harian</span>
          </div>
          {isReady('absensi') && trenKehadiran.some((day) => day.total > 0) ? (
            <div className="mt-6 flex h-52 items-end justify-between gap-2 border-b border-slate-100 pb-2">
              {trenKehadiran.map((day) => (
                <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[11px] font-bold text-slate-500">{day.total ? `${day.percent}%` : '—'}</span>
                  <div className="flex h-36 w-full max-w-12 items-end overflow-hidden rounded-t-lg bg-slate-100">
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-blue-400 transition-all" style={{ height: `${day.total ? Math.max(5, day.percent) : 0}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">{day.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 flex h-52 items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-sm text-slate-500">
              {isReady('absensi') ? 'Belum ada catatan absensi siswa dalam 7 hari terakhir.' : 'Data absensi belum dapat dibaca.'}
            </div>
          )}
        </article>

        <article className="report-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-[#082B62]">Rincian Kehadiran Hari Ini</h2>
          <p className="mt-1 text-xs text-slate-500">Berdasarkan data absensi siswa yang tercatat.</p>
          {isReady('absensi') && dataAbsensiHariIni.length > 0 ? (
            <div className="mt-5 space-y-4">
              {attendanceBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium text-slate-600">{item.label}</span><strong className="text-slate-800">{formatAngka(item.count)}</strong></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.style}`} style={{ width: `${(item.count / maxAttendanceCount) * 100}%` }} /></div>
                </div>
              ))}
              <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">Total catatan: {formatAngka(dataAbsensiHariIni.length)}</p>
            </div>
          ) : (
            <div className="mt-5 flex h-40 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">
              {isReady('absensi') ? 'Belum ada absensi siswa yang dicatat hari ini.' : 'Data belum tersedia.'}
            </div>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <article className="report-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold text-[#082B62]">Status Pembelajaran</h2><p className="mt-1 text-xs text-slate-500">Rekap jurnal mengajar yang tersimpan.</p></div><Icon name="book" className="h-6 w-6 text-violet-600" /></div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-700">Dikirim</p><p className="mt-1 text-2xl font-extrabold text-amber-800">{nilaiSumber('jurnal', jurnalMenunggu)}</p></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-700">Disetujui</p><p className="mt-1 text-2xl font-extrabold text-emerald-800">{nilaiSumber('jurnal', jurnalDisetujui)}</p></div>
            <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs font-semibold text-rose-700">Perlu Revisi</p><p className="mt-1 text-2xl font-extrabold text-rose-800">{nilaiSumber('jurnal', jurnalPerbaikan)}</p></div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Jurnal Terbaru</p>
            {latestJurnal.length ? <div className="space-y-3">{latestJurnal.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 text-sm"><div className="min-w-0"><p className="truncate font-semibold text-slate-700">{String(item.mataPelajaran || 'Jurnal Mengajar')} · {String(item.namaGuru || 'Guru')}</p><p className="mt-0.5 text-xs text-slate-400">{String(item.kelas || 'Kelas belum dicantumkan')} · {String(item.tanggal || 'Tanggal tidak tersedia')}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{String(item.status || 'Status belum ada')}</span></div>)}</div> : <p className="text-sm text-slate-400">Belum ada jurnal yang tercatat.</p>}
          </div>
        </article>

        <article className="report-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold text-[#082B62]">Kondisi Sarana dan Prasarana</h2><p className="mt-1 text-xs text-slate-500">Ringkasan inventaris, ruang, dan pemeliharaan.</p></div><Icon name="building" className="h-6 w-6 text-cyan-600" /></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-semibold text-slate-500">Jenis Inventaris</p><p className="mt-1 text-2xl font-extrabold text-[#082B62]">{nilaiSumber('inventaris', getRows('inventaris').length)}</p><p className="mt-1 text-xs text-slate-400">{isReady('inventaris') ? `${formatAngka(totalUnitInventaris)} unit barang` : 'Data belum tersedia'}</p></div>
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-semibold text-slate-500">Ruang dan Fasilitas</p><p className="mt-1 text-2xl font-extrabold text-[#082B62]">{nilaiSumber('ruang', getRows('ruang').length)}</p><p className="mt-1 text-xs text-slate-400">{isReady('ruang') ? `${formatAngka(ruangPerhatian)} perlu perhatian` : 'Data belum tersedia'}</p></div>
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-semibold text-slate-500">Inventaris Perlu Perhatian</p><p className="mt-1 text-2xl font-extrabold text-amber-700">{nilaiSumber('inventaris', inventarisPerhatian)}</p><p className="mt-1 text-xs text-slate-400">Kondisi bukan Baik</p></div>
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-semibold text-slate-500">Pemeliharaan Terbuka</p><p className="mt-1 text-2xl font-extrabold text-rose-700">{nilaiSumber('pemeliharaan', pemeliharaanTerbuka)}</p><p className="mt-1 text-xs text-slate-400">Belum selesai ditangani</p></div>
          </div>
        </article>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-extrabold text-[#082B62]">Kategori Laporan Sekolah</h2><p className="mt-1 text-sm text-slate-500">Pilih kategori untuk melihat rincian dan mencetak laporan sekolah.</p></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {REPORT_CATEGORIES.map((item) => {
            const tone: Record<string, string> = {
              blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700', violet: 'bg-violet-50 text-violet-700',
              amber: 'bg-amber-50 text-amber-700', cyan: 'bg-cyan-50 text-cyan-700', rose: 'bg-rose-50 text-rose-700',
            };
            return (
              <Link key={item.title} to={`${basePath}/laporan/${item.slug}`} className="report-print group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400">
                <div className="flex items-start justify-between gap-3"><div className={`rounded-xl p-3 ${tone[item.tone]}`}><Icon name={item.icon} className="h-5 w-5" /></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Buka Laporan</span></div>
                <h3 className="mt-4 font-extrabold text-[#082B62]">{item.title}</h3>
                <p className="mt-1.5 min-h-10 text-sm leading-relaxed text-slate-500">{item.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-blue-700"><span>Lihat rincian laporan</span><span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
        <div><p className="font-bold">Laporan berbasis data aplikasi</p><p className="mt-1 text-xs text-blue-700">{isAdmin ? 'Anda masuk sebagai Administrator.' : 'Anda masuk sebagai Kepala Sekolah. Halaman ini bersifat pemantauan.'} Data pada halaman ini hanya dibaca dan tidak mengubah data sumber.</p></div>
        <Link to={isAdmin ? '/admin/dashboard' : '/kepsek/dashboard'} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100">Kembali ke Dashboard</Link>
      </div>
    </div>
  );
}
