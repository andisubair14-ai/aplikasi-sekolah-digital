import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type StatusAbsensi = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
type StatusFilter = 'Semua' | StatusAbsensi | 'Belum diisi';

type KelasRecord = {
  id: string;
  namaKelas?: string;
  jenjang?: string;
  tingkat?: number | string;
  tahunAjaran?: string;
  waliKelas?: string;
  waliKelasId?: string | null;
};

type SiswaRecord = {
  id: string;
  nama?: string;
  nisn?: string;
  kelas?: string;
  kelasId?: string;
  tahunAjaran?: string;
  status?: string;
};

type TahunRecord = {
  id: string;
  tahun?: string;
  semester?: string;
  status?: string;
};

type GuruRecord = { id: string; nama?: string };

type AbsensiRecord = {
  id: string;
  tanggal?: string;
  nisn?: string;
  namaSiswa?: string;
  kelas?: string;
  kelasId?: string;
  jenjang?: string;
  tingkat?: number | string;
  tahunAjaran?: string;
  status?: StatusAbsensi;
  metode?: string;
  dicatatOleh?: string;
};

type RingkasanRombel = {
  kelas: KelasRecord;
  siswa: SiswaRecord[];
  statusByNisn: Map<string, StatusAbsensi>;
  total: number;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  belum: number;
  persentase: number;
};

const tanggalLokal = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const nilai = (value: unknown) => String(value ?? '').trim();

const angkaRomawi = (value: number | string | undefined) => {
  const number = Number.parseInt(String(value ?? ''), 10);
  const map: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX' };
  return map[number] || String(value ?? '-');
};

const siswaMasihAktif = (siswa: SiswaRecord) =>
  !['Lulus', 'Pindah Keluar'].includes(nilai(siswa.status || 'Aktif'));

const formatTanggal = (tanggal: string) => {
  if (!tanggal) return '-';
  const date = new Date(`${tanggal}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? tanggal
    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const kelasCocokUntukSiswa = (siswa: SiswaRecord, kelas: KelasRecord) => {
  if (!siswaMasihAktif(siswa)) return false;
  const tahunCocok = !siswa.tahunAjaran || siswa.tahunAjaran === kelas.tahunAjaran;
  const cocokKelas = siswa.kelasId
    ? siswa.kelasId === kelas.id
    : nilai(siswa.kelas) === nilai(kelas.namaKelas) && tahunCocok;
  return cocokKelas && tahunCocok;
};

const recordCocokUntukKelas = (record: AbsensiRecord, kelas: KelasRecord) => {
  if (record.kelasId) return record.kelasId === kelas.id;
  return nilai(record.kelas) === nilai(kelas.namaKelas)
    && (!record.tahunAjaran || record.tahunAjaran === kelas.tahunAjaran)
    && (!record.jenjang || record.jenjang === kelas.jenjang)
    && (!record.tingkat || String(record.tingkat) === String(kelas.tingkat));
};

const statusBadge = (status: StatusAbsensi | 'Belum diisi') => {
  if (status === 'Hadir') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Sakit') return 'bg-amber-100 text-amber-800';
  if (status === 'Izin') return 'bg-blue-100 text-blue-700';
  if (status === 'Alpa') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
};

export default function MonitoringKehadiran() {
  const { userData } = useAuth();
  const [kelasList, setKelasList] = useState<KelasRecord[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaRecord[]>([]);
  const [tahunList, setTahunList] = useState<TahunRecord[]>([]);
  const [guruList, setGuruList] = useState<GuruRecord[]>([]);
  const [absensiList, setAbsensiList] = useState<AbsensiRecord[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [loadingAbsensi, setLoadingAbsensi] = useState(true);
  const [errorData, setErrorData] = useState('');

  const [selectedTanggal, setSelectedTanggal] = useState(tanggalLokal());
  const [filterTahun, setFilterTahun] = useState('__AKTIF__');
  const [filterJenjang, setFilterJenjang] = useState('Semua');
  const [filterTingkat, setFilterTingkat] = useState('Semua');
  const [filterRombel, setFilterRombel] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('Semua');
  const [kataKunci, setKataKunci] = useState('');
  const [detailKelasId, setDetailKelasId] = useState<string | null>(null);

  useEffect(() => {
    let kelasReady = false;
    let siswaReady = false;
    let tahunReady = false;
    let guruReady = false;
    let masihAktif = true;
    const cekSelesai = () => {
      if (masihAktif && kelasReady && siswaReady && tahunReady && guruReady) setLoadingMaster(false);
    };
    const tanganiError = (label: string) => (error: Error) => {
      console.error(`Gagal membaca ${label} untuk monitoring kehadiran:`, error);
      setErrorData(`Data ${label} tidak dapat dibaca. Periksa koneksi dan hak akses Firebase.`);
      if (label === 'rombel') kelasReady = true;
      if (label === 'siswa') siswaReady = true;
      if (label === 'tahun ajaran') tahunReady = true;
      if (label === 'guru') guruReady = true;
      cekSelesai();
    };

    const unsubscribers = [
      onSnapshot(collection(db, 'kelas'), (snapshot) => {
        setKelasList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as KelasRecord[]);
        kelasReady = true; cekSelesai();
      }, tanganiError('rombel')),
      onSnapshot(collection(db, 'siswa'), (snapshot) => {
        setSiswaList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as SiswaRecord[]);
        siswaReady = true; cekSelesai();
      }, tanganiError('siswa')),
      onSnapshot(query(collection(db, 'tahun_ajaran'), where('status', '==', 'Aktif')), (snapshot) => {
        setTahunList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TahunRecord[]);
        tahunReady = true; cekSelesai();
      }, tanganiError('tahun ajaran')),
      onSnapshot(collection(db, 'guru'), (snapshot) => {
        setGuruList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as GuruRecord[]);
        guruReady = true; cekSelesai();
      }, tanganiError('guru')),
    ];

    return () => {
      masihAktif = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  useEffect(() => {
    if (!selectedTanggal) {
      setAbsensiList([]);
      setLoadingAbsensi(false);
      return;
    }
    setLoadingAbsensi(true);
    const q = query(collection(db, 'absensi'), where('tanggal', '==', selectedTanggal));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAbsensiList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as AbsensiRecord[]);
      setLoadingAbsensi(false);
    }, (error) => {
      console.error('Gagal membaca absensi tanggal terpilih:', error);
      setErrorData('Catatan absensi tidak dapat dibaca. Periksa koneksi dan hak akses Firebase.');
      setAbsensiList([]);
      setLoadingAbsensi(false);
    });
    return () => unsubscribe();
  }, [selectedTanggal]);

  const tahunAktif = useMemo(() => tahunList.find((item) => item.status === 'Aktif')?.tahun || '', [tahunList]);
  const tahunEfektif = filterTahun === '__AKTIF__' ? tahunAktif : filterTahun === '__SEMUA__' ? '' : filterTahun;

  const pilihanJenjang = useMemo(() => Array.from(new Set(
    kelasList
      .filter((kelas) => !tahunEfektif || kelas.tahunAjaran === tahunEfektif)
      .map((kelas) => nilai(kelas.jenjang).toUpperCase())
      .filter(Boolean)
  )).sort(), [kelasList, tahunEfektif]);

  const pilihanTingkat = useMemo(() => Array.from(new Set(
    kelasList
      .filter((kelas) => !tahunEfektif || kelas.tahunAjaran === tahunEfektif)
      .filter((kelas) => filterJenjang === 'Semua' || nilai(kelas.jenjang).toUpperCase() === filterJenjang)
      .map((kelas) => nilai(kelas.tingkat))
      .filter(Boolean)
  )).sort((a, b) => Number(a) - Number(b)), [kelasList, tahunEfektif, filterJenjang]);

  const ringkasanSemuaRombel = useMemo<RingkasanRombel[]>(() => {
    return kelasList
      .filter((kelas) => !tahunEfektif || kelas.tahunAjaran === tahunEfektif)
      .filter((kelas) => filterJenjang === 'Semua' || nilai(kelas.jenjang).toUpperCase() === filterJenjang)
      .filter((kelas) => filterTingkat === 'Semua' || nilai(kelas.tingkat) === filterTingkat)
      .map((kelas) => {
        const siswa = siswaList.filter((item) => kelasCocokUntukSiswa(item, kelas));
        const nisnAktif = new Set(siswa.map((item) => nilai(item.nisn)).filter(Boolean));
        const catatan = absensiList.filter((record) => recordCocokUntukKelas(record, kelas) && nisnAktif.has(nilai(record.nisn)));
        const statusByNisn = new Map<string, StatusAbsensi>();
        catatan.forEach((record) => {
          if (record.nisn && ['Hadir', 'Sakit', 'Izin', 'Alpa'].includes(String(record.status))) {
            statusByNisn.set(record.nisn, record.status as StatusAbsensi);
          }
        });
        const statuses = Array.from(statusByNisn.values());
        const total = siswa.length;
        const hadir = statuses.filter((status) => status === 'Hadir').length;
        const sakit = statuses.filter((status) => status === 'Sakit').length;
        const izin = statuses.filter((status) => status === 'Izin').length;
        const alpa = statuses.filter((status) => status === 'Alpa').length;
        const tercatat = hadir + sakit + izin + alpa;
        return {
          kelas, siswa, statusByNisn, total, hadir, sakit, izin, alpa,
          belum: Math.max(0, total - tercatat),
          persentase: total > 0 ? Math.round((hadir / total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => {
        const jenjangCompare = nilai(a.kelas.jenjang).localeCompare(nilai(b.kelas.jenjang));
        if (jenjangCompare) return jenjangCompare;
        const tingkatCompare = Number(a.kelas.tingkat) - Number(b.kelas.tingkat);
        if (tingkatCompare) return tingkatCompare;
        return nilai(a.kelas.namaKelas).localeCompare(nilai(b.kelas.namaKelas), 'id', { numeric: true });
      });
  }, [kelasList, siswaList, absensiList, tahunEfektif, filterJenjang, filterTingkat]);

  const ringkasanTampil = useMemo(() => ringkasanSemuaRombel
    .filter((item) => filterRombel === 'Semua' || item.kelas.id === filterRombel)
    .filter((item) => {
      if (filterStatus === 'Semua') return true;
      if (filterStatus === 'Belum diisi') return item.belum > 0;
      return item[filterStatus.toLowerCase() as 'hadir' | 'sakit' | 'izin' | 'alpa'] > 0;
    })
    .filter((item) => {
      const cari = kataKunci.trim().toLocaleLowerCase('id-ID');
      if (!cari) return true;
      const wali = item.kelas.waliKelasId
        ? guruList.find((guru) => guru.id === item.kelas.waliKelasId)?.nama
        : item.kelas.waliKelas;
      return [item.kelas.namaKelas, item.kelas.jenjang, item.kelas.tingkat, wali]
        .some((value) => nilai(value).toLocaleLowerCase('id-ID').includes(cari));
    }), [ringkasanSemuaRombel, filterRombel, filterStatus, kataKunci, guruList]);

  const totalRingkasan = useMemo(() => ringkasanTampil.reduce((hasil, item) => ({
    total: hasil.total + item.total,
    hadir: hasil.hadir + item.hadir,
    sakit: hasil.sakit + item.sakit,
    izin: hasil.izin + item.izin,
    alpa: hasil.alpa + item.alpa,
    belum: hasil.belum + item.belum,
  }), { total: 0, hadir: 0, sakit: 0, izin: 0, alpa: 0, belum: 0 }), [ringkasanTampil]);

  const detailRombel = ringkasanSemuaRombel.find((item) => item.kelas.id === detailKelasId) || null;
  const namaWali = (kelas: KelasRecord) => kelas.waliKelasId
    ? guruList.find((guru) => guru.id === kelas.waliKelasId)?.nama || 'Guru tidak ditemukan'
    : kelas.waliKelas || '-';

  const resetFilter = () => {
    setFilterTahun('__AKTIF__');
    setFilterJenjang('Semua');
    setFilterTingkat('Semua');
    setFilterRombel('Semua');
    setFilterStatus('Semua');
    setKataKunci('');
  };

  if (userData?.role !== 'kepsek') {
    return <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center text-amber-800">Halaman ini hanya tersedia untuk Kepala Sekolah.</div>;
  }

  if (loadingMaster) {
    return <div className="p-10 text-center font-semibold text-slate-500">Memuat data monitoring kehadiran...</div>;
  }

  const statusSiswa = (nisn?: string): StatusAbsensi | 'Belum diisi' =>
    (nisn && detailRombel?.statusByNisn.get(nisn)) || 'Belum diisi';

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm 14mm; }
          body * { visibility: hidden !important; }
          #monitoring-kehadiran-print, #monitoring-kehadiran-print * { visibility: visible !important; }
          html, body, #root, #root > div, main, .overflow-y-auto, .overflow-hidden { height: auto !important; max-height: none !important; overflow: visible !important; }
          #monitoring-kehadiran-print { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          .monitoring-kehadiran-screen { display: none !important; }
          #monitoring-kehadiran-print table { width: 100%; border-collapse: collapse; font-size: 9pt; }
          #monitoring-kehadiran-print thead { display: table-header-group; }
          #monitoring-kehadiran-print tr { break-inside: avoid; page-break-inside: avoid; }
          #monitoring-kehadiran-print th, #monitoring-kehadiran-print td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: left; }
          #monitoring-kehadiran-print th { background: #eaf0f8 !important; color: #0b2a56 !important; }
        }
      `}</style>

      <div className="monitoring-kehadiran-screen space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#082B62]">Monitoring Kehadiran Siswa</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Pantau catatan kehadiran siswa seluruh rombongan belajar.</p>
          </div>
          <button onClick={() => window.print()} disabled={ringkasanTampil.length === 0} className="rounded-xl bg-[#155EEF] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Cetak Rekap</button>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800 sm:text-sm">
          Monitoring ini bersifat baca-saja. Jumlah belum diisi dihitung dari siswa aktif yang terdaftar pada rombel untuk tanggal yang dipilih.
        </div>

        {errorData && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorData}</div>}

        <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div><h2 className="font-bold text-[#082B62]">Filter Kehadiran</h2><p className="text-xs text-slate-500">Pilih tanggal dan kelompok rombel yang ingin dipantau.</p></div>
            <button onClick={resetFilter} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Reset</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
            <label className="col-span-2 min-w-0 sm:col-span-1"><span className="mb-1 block text-[11px] font-semibold text-slate-500">Tanggal</span><input type="date" value={selectedTanggal} onChange={(event) => setSelectedTanggal(event.target.value)} className="min-h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 text-xs sm:text-sm" /></label>
            <label className="min-w-0"><span className="mb-1 block text-[11px] font-semibold text-slate-500">Tahun Ajaran</span><select value={filterTahun} onChange={(event) => { setFilterTahun(event.target.value); setFilterJenjang('Semua'); setFilterTingkat('Semua'); setFilterRombel('Semua'); }} className="min-h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-xs sm:text-sm"><option value="__AKTIF__">Tahun Aktif</option><option value="__SEMUA__">Semua Tahun</option>{tahunList.filter((item) => item.tahun).map((item) => <option key={item.id} value={item.tahun}>{item.tahun}{item.status === 'Aktif' ? ' (Aktif)' : ''}</option>)}</select></label>
            <label className="min-w-0"><span className="mb-1 block text-[11px] font-semibold text-slate-500">Jenjang</span><select value={filterJenjang} onChange={(event) => { setFilterJenjang(event.target.value); setFilterTingkat('Semua'); setFilterRombel('Semua'); }} className="min-h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-xs sm:text-sm"><option value="Semua">Semua Jenjang</option>{pilihanJenjang.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="min-w-0"><span className="mb-1 block text-[11px] font-semibold text-slate-500">Tingkat</span><select value={filterTingkat} onChange={(event) => { setFilterTingkat(event.target.value); setFilterRombel('Semua'); }} className="min-h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-xs sm:text-sm"><option value="Semua">Semua Tingkat</option>{pilihanTingkat.map((item) => <option key={item} value={item}>Tingkat {angkaRomawi(item)}</option>)}</select></label>
            <label className="col-span-2 min-w-0 sm:col-span-1"><span className="mb-1 block text-[11px] font-semibold text-slate-500">Rombel</span><select value={filterRombel} onChange={(event) => setFilterRombel(event.target.value)} className="min-h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-xs sm:text-sm"><option value="Semua">Semua Rombel</option>{ringkasanSemuaRombel.map((item) => <option key={item.kelas.id} value={item.kelas.id}>{item.kelas.namaKelas} — {item.kelas.jenjang}</option>)}</select></label>
            <label className="min-w-0"><span className="mb-1 block text-[11px] font-semibold text-slate-500">Status</span><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as StatusFilter)} className="min-h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-xs sm:text-sm"><option>Semua</option><option>Hadir</option><option>Sakit</option><option>Izin</option><option>Alpa</option><option>Belum diisi</option></select></label>
            <label className="col-span-2 min-w-0 sm:col-span-2 xl:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-500">Cari rombel atau wali kelas</span><input value={kataKunci} onChange={(event) => setKataKunci(event.target.value)} placeholder="Ketik nama rombel atau wali kelas..." className="min-h-10 w-full min-w-0 rounded-xl border border-slate-300 px-3 text-xs sm:text-sm" /></label>
          </div>
        </section>

        <div className="flex items-center justify-between gap-2">
          <div><h2 className="font-bold text-[#082B62]">Ringkasan Kehadiran</h2><p className="text-xs text-slate-500">{formatTanggal(selectedTanggal)} · {ringkasanTampil.length} rombel</p></div>
          {loadingAbsensi && <span className="text-xs font-semibold text-blue-600">Memuat catatan...</span>}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4"><p className="text-[11px] font-semibold text-slate-500 sm:text-xs">Total Siswa Aktif</p><p className="mt-1 text-2xl font-extrabold text-[#082B62] tabular-nums">{totalRingkasan.total}</p></div>
          <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4"><p className="text-[11px] font-semibold text-emerald-700 sm:text-xs">Hadir</p><p className="mt-1 text-2xl font-extrabold text-emerald-600 tabular-nums">{totalRingkasan.hadir}</p></div>
          <div className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm sm:p-4"><p className="text-[11px] font-semibold text-amber-700 sm:text-xs">Sakit / Izin</p><p className="mt-1 text-2xl font-extrabold text-amber-600 tabular-nums">{totalRingkasan.sakit + totalRingkasan.izin}</p><p className="text-[10px] text-slate-400">Sakit {totalRingkasan.sakit} · Izin {totalRingkasan.izin}</p></div>
          <div className="rounded-xl border border-red-100 bg-white p-3 shadow-sm sm:p-4"><p className="text-[11px] font-semibold text-red-700 sm:text-xs">Alpa</p><p className="mt-1 text-2xl font-extrabold text-red-600 tabular-nums">{totalRingkasan.alpa}</p></div>
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:col-span-1 sm:p-4"><p className="text-[11px] font-semibold text-slate-500 sm:text-xs">Belum Diisi</p><p className="mt-1 text-2xl font-extrabold text-slate-700 tabular-nums">{totalRingkasan.belum}</p></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4"><div><h2 className="font-bold text-[#082B62]">Rekap per Rombel</h2><p className="text-xs text-slate-500">Pilih Detail untuk melihat status setiap siswa.</p></div><span className="text-xs font-semibold text-slate-500">{ringkasanTampil.length} rombel</span></div>

          <div className="divide-y divide-slate-100 md:hidden">
            {ringkasanTampil.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Tidak ada data rombel yang sesuai dengan filter.</p> : ringkasanTampil.map((item, index) => (
              <div key={item.kelas.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-bold text-blue-700">{index + 1}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-[#082B62]">{item.kelas.namaKelas || '-'}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.kelas.jenjang || '-'} · Tingkat {angkaRomawi(item.kelas.tingkat)} · {item.kelas.tahunAjaran || '-'}</p><p className="truncate text-[11px] text-slate-500">Wali: {namaWali(item.kelas)}</p></div>
                  </div>
                  <button onClick={() => setDetailKelasId(item.kelas.id)} className="min-h-8 shrink-0 rounded-lg bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100">Detail</button>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                  <div className="rounded-lg bg-emerald-50 px-1.5 py-2"><p className="text-[10px] text-emerald-700">Hadir</p><p className="text-sm font-extrabold text-emerald-700">{item.hadir}</p></div>
                  <div className="rounded-lg bg-amber-50 px-1.5 py-2"><p className="text-[10px] text-amber-700">Sakit/Izin</p><p className="text-sm font-extrabold text-amber-700">{item.sakit + item.izin}</p></div>
                  <div className="rounded-lg bg-red-50 px-1.5 py-2"><p className="text-[10px] text-red-700">Alpa</p><p className="text-sm font-extrabold text-red-700">{item.alpa}</p></div>
                  <div className="rounded-lg bg-slate-50 px-1.5 py-2"><p className="text-[10px] text-slate-600">Belum</p><p className="text-sm font-extrabold text-slate-700">{item.belum}</p></div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>Total {item.total} siswa</span><span className="font-bold text-blue-700">{item.persentase}% hadir</span></div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.persentase}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600"><th className="p-3">No</th><th className="p-3">Rombel / Wali Kelas</th><th className="p-3">Jenjang / Tingkat</th><th className="p-3 text-center">Total</th><th className="p-3 text-center">Hadir</th><th className="p-3 text-center">Sakit</th><th className="p-3 text-center">Izin</th><th className="p-3 text-center">Alpa</th><th className="p-3 text-center">Belum</th><th className="p-3 text-center">Hadir %</th><th className="p-3">Detail</th></tr></thead>
              <tbody>{ringkasanTampil.length === 0 ? <tr><td colSpan={11} className="p-8 text-center text-slate-500">Tidak ada data rombel yang sesuai dengan filter.</td></tr> : ringkasanTampil.map((item, index) => <tr key={item.kelas.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-3 text-slate-500">{index + 1}</td><td className="p-3"><p className="font-bold text-[#082B62]">{item.kelas.namaKelas || '-'}</p><p className="text-xs text-slate-500">{namaWali(item.kelas)}</p></td><td className="p-3 text-slate-600">{item.kelas.jenjang || '-'} / {angkaRomawi(item.kelas.tingkat)}</td><td className="p-3 text-center font-semibold">{item.total}</td><td className="p-3 text-center font-bold text-emerald-700">{item.hadir}</td><td className="p-3 text-center text-amber-700">{item.sakit}</td><td className="p-3 text-center text-blue-700">{item.izin}</td><td className="p-3 text-center text-red-700">{item.alpa}</td><td className="p-3 text-center text-slate-700">{item.belum}</td><td className="p-3 text-center font-bold text-blue-700">{item.persentase}%</td><td className="p-3"><button onClick={() => setDetailKelasId(item.kelas.id)} className="font-bold text-blue-700 hover:text-blue-900">Lihat Detail</button></td></tr>)}</tbody>
            </table>
          </div>
        </section>

        {detailRombel && (
          <div className="monitoring-kehadiran-screen fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-3 sm:p-4" onClick={() => setDetailKelasId(null)}>
            <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div className="min-w-0"><h2 className="text-lg font-bold text-[#082B62]">Detail Kehadiran Rombel {detailRombel.kelas.namaKelas}</h2><p className="mt-1 text-xs text-slate-500">{detailRombel.kelas.jenjang} · Tingkat {angkaRomawi(detailRombel.kelas.tingkat)} · {formatTanggal(selectedTanggal)}</p><p className="mt-0.5 truncate text-xs text-slate-500">Wali Kelas: {namaWali(detailRombel.kelas)}</p></div><button onClick={() => setDetailKelasId(null)} className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">Tutup</button></div>
              <div className="grid grid-cols-4 gap-2 border-b border-slate-100 p-3 sm:p-4"><div className="rounded-lg bg-emerald-50 p-2 text-center"><p className="text-[10px] text-emerald-700">Hadir</p><p className="text-lg font-extrabold text-emerald-700">{detailRombel.hadir}</p></div><div className="rounded-lg bg-amber-50 p-2 text-center"><p className="text-[10px] text-amber-700">Sakit</p><p className="text-lg font-extrabold text-amber-700">{detailRombel.sakit}</p></div><div className="rounded-lg bg-blue-50 p-2 text-center"><p className="text-[10px] text-blue-700">Izin</p><p className="text-lg font-extrabold text-blue-700">{detailRombel.izin}</p></div><div className="rounded-lg bg-red-50 p-2 text-center"><p className="text-[10px] text-red-700">Alpa</p><p className="text-lg font-extrabold text-red-700">{detailRombel.alpa}</p></div></div>
              <div className="max-h-[55vh] overflow-y-auto p-3 sm:p-4">
                {detailRombel.siswa.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Belum ada siswa aktif pada rombel ini.</p> : <div className="space-y-2">{detailRombel.siswa.map((siswa, index) => {
                  const status = statusSiswa(siswa.nisn);
                  return <div key={siswa.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5"><div className="flex min-w-0 items-center gap-2.5"><span className="w-5 shrink-0 text-[11px] text-slate-400">{index + 1}.</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{siswa.nama || '-'}</p><p className="text-[11px] text-slate-500">NISN: {siswa.nisn || '-'}</p></div></div><span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${statusBadge(status)}`}>{status}</span></div>;
                })}</div>}
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">Total {detailRombel.total} siswa · {detailRombel.belum} belum diisi · {detailRombel.persentase}% hadir</div>
            </div>
          </div>
        )}
      </div>

      <div id="monitoring-kehadiran-print" className="hidden bg-white text-slate-900">
        <header className="mb-5 border-b-2 border-slate-800 pb-3 text-center"><h1 className="text-xl font-bold uppercase">REKAP MONITORING KEHADIRAN SISWA</h1><p className="mt-1 text-sm">Tanggal: {formatTanggal(selectedTanggal)}</p><p className="mt-1 text-xs">Tahun Ajaran: {tahunEfektif || 'Semua Tahun'}</p></header>
        <div className="mb-3 flex justify-between text-sm"><span><strong>Jumlah rombel:</strong> {ringkasanTampil.length}</span><span><strong>Total siswa:</strong> {totalRingkasan.total} | <strong>Hadir:</strong> {totalRingkasan.hadir} | <strong>Sakit:</strong> {totalRingkasan.sakit} | <strong>Izin:</strong> {totalRingkasan.izin} | <strong>Alpa:</strong> {totalRingkasan.alpa} | <strong>Belum:</strong> {totalRingkasan.belum}</span></div>
        <table><thead><tr><th>No</th><th>Rombel</th><th>Jenjang</th><th>Tingkat</th><th>Wali Kelas</th><th>Total</th><th>Hadir</th><th>Sakit</th><th>Izin</th><th>Alpa</th><th>Belum</th><th>Hadir %</th></tr></thead><tbody>{ringkasanTampil.map((item, index) => <tr key={item.kelas.id}><td>{index + 1}</td><td>{item.kelas.namaKelas || '-'}</td><td>{item.kelas.jenjang || '-'}</td><td>{angkaRomawi(item.kelas.tingkat)}</td><td>{namaWali(item.kelas)}</td><td>{item.total}</td><td>{item.hadir}</td><td>{item.sakit}</td><td>{item.izin}</td><td>{item.alpa}</td><td>{item.belum}</td><td>{item.persentase}%</td></tr>)}</tbody></table>
        <p className="mt-3 text-xs">Catatan: Belum diisi dihitung dari siswa aktif yang terdaftar pada rombel untuk tanggal yang dipilih.</p>
        <div className="mt-12 flex justify-end"><div className="w-64 text-center text-sm"><p>{formatTanggal(tanggalLokal())}</p><p className="mt-1">Mengetahui,</p><p>Kepala Sekolah</p><div className="h-16" /><p className="font-bold underline">........................................</p><p>NIP. ........................................</p></div></div>
      </div>
    </div>
  );
}
