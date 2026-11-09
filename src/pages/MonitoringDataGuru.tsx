import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type GuruRecord = {
  id: string;
  nama?: string;
  nip?: string;
  nuptk?: string;
  mapel?: string;
  jabatan?: string;
  kelasDiampu?: string[];
  noHp?: string;
  alamat?: string;
};

type KelasRecord = {
  id: string;
  namaKelas?: string;
  jenjang?: string;
  tingkat?: number | string;
  waliKelas?: string;
  waliKelasId?: string | null;
  tahunAjaran?: string;
};

type TahunAjaranRecord = {
  id: string;
  tahun?: string;
  semester?: string;
  status?: string;
};

type SchoolIdentity = {
  namaSekolah?: string;
  npsn?: string;
  alamat?: string;
  kepalaSekolah?: string;
};

const formatTingkat = (value?: number | string) => {
  const roman: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX' };
  const n = Number.parseInt(String(value ?? ''), 10);
  return roman[n] || String(value || '-');
};

const labelKelas = (kelas: KelasRecord) =>
  `${kelas.namaKelas || 'Rombel'} (${kelas.jenjang || '-'}, Tingkat ${formatTingkat(kelas.tingkat)})`;

const jabatanOptions = [
  'Kepala Sekolah',
  'Wakil Kepala Sekolah',
  'Wali Kelas',
  'Guru BK',
  'Guru Mata Pelajaran',
  'Tenaga Kependidikan',
];

export default function MonitoringDataGuru() {
  const { userData } = useAuth();
  const [guruList, setGuruList] = useState<GuruRecord[]>([]);
  const [kelasList, setKelasList] = useState<KelasRecord[]>([]);
  const [tahunList, setTahunList] = useState<TahunAjaranRecord[]>([]);
  const [identitas, setIdentitas] = useState<SchoolIdentity>({});
  const [loadingGuru, setLoadingGuru] = useState(true);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJabatan, setFilterJabatan] = useState('Semua');
  const [filterPenugasan, setFilterPenugasan] = useState('Semua');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [selectedGuru, setSelectedGuru] = useState<GuruRecord | null>(null);

  useEffect(() => {
    const unsubGuru = onSnapshot(
      collection(db, 'guru'),
      (snapshot) => {
        setGuruList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as GuruRecord[]);
        setLoadingGuru(false);
        setError('');
      },
      (err) => {
        console.error('Gagal memuat data pegawai untuk monitoring:', err);
        setError('Data Guru tidak dapat dibaca. Periksa koneksi dan hak akses Firestore.');
        setLoadingGuru(false);
      },
    );

    const unsubKelas = onSnapshot(
      collection(db, 'kelas'),
      (snapshot) => setKelasList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as KelasRecord[]),
      (err) => {
        console.error('Gagal memuat data rombel:', err);
        setError('Data rombel tidak dapat dibaca. Periksa hak akses Firestore.');
      },
    );

    const unsubTahun = onSnapshot(
      query(collection(db, 'tahun_ajaran'), where('status', '==', 'Aktif')),
      (snapshot) => {
        setTahunList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TahunAjaranRecord[]);
        setLoadingMaster(false);
      },
      (err) => {
        console.error('Gagal memuat tahun ajaran:', err);
        setLoadingMaster(false);
      },
    );

    const unsubIdentitas = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      (snapshot) => setIdentitas(snapshot.exists() ? snapshot.data() as SchoolIdentity : {}),
      (err) => console.warn('Identitas sekolah belum dapat dimuat:', err),
    );

    return () => {
      unsubGuru();
      unsubKelas();
      unsubTahun();
      unsubIdentitas();
    };
  }, []);

  const tahunAktif = useMemo(
    () => tahunList.find((item) => String(item.status || '').trim().toLowerCase() === 'aktif') || null,
    [tahunList],
  );

  const kelasTerurut = useMemo(() => [...kelasList].sort((a, b) => {
    const jenjangA = a.jenjang === 'SD' ? 0 : a.jenjang === 'SMP' ? 1 : 2;
    const jenjangB = b.jenjang === 'SD' ? 0 : b.jenjang === 'SMP' ? 1 : 2;
    if (jenjangA !== jenjangB) return jenjangA - jenjangB;
    const tingkatA = Number(a.tingkat || 0);
    const tingkatB = Number(b.tingkat || 0);
    if (tingkatA !== tingkatB) return tingkatA - tingkatB;
    return String(a.namaKelas || '').localeCompare(String(b.namaKelas || ''), 'id', { numeric: true });
  }), [kelasList]);

  const getAssignments = (guru: GuruRecord) => {
    const kelasAktif = tahunAktif?.tahun
      ? kelasTerurut.filter((item) => item.tahunAjaran === tahunAktif.tahun)
      : kelasTerurut;

    const waliResmi = kelasAktif.filter((item) => item.waliKelasId === guru.id);
    const waliLama = kelasAktif.filter((item) => !item.waliKelasId && item.waliKelas && item.waliKelas.trim() === (guru.nama || '').trim());
    const idsAmpu = Array.isArray(guru.kelasDiampu) ? guru.kelasDiampu : [];
    const kelasAmpu = kelasTerurut.filter((item) => idsAmpu.includes(item.id));

    return { waliResmi, waliLama, kelasAmpu };
  };

  const guruDenganInfo = useMemo(() => guruList.map((guru) => {
    const assignments = getAssignments(guru);
    const jumlahRombel = guru.jabatan === 'Wali Kelas'
      ? assignments.waliResmi.length
      : guru.jabatan === 'Guru Mata Pelajaran'
        ? assignments.kelasAmpu.length
        : 0;
    const butuhPenugasan = (guru.jabatan === 'Wali Kelas' && assignments.waliResmi.length === 0)
      || (guru.jabatan === 'Guru Mata Pelajaran' && assignments.kelasAmpu.length === 0);
    const searchClasses = [
      ...assignments.waliResmi.map(labelKelas),
      ...assignments.waliLama.map(labelKelas),
      ...assignments.kelasAmpu.map(labelKelas),
    ].join(' ');
    return { guru, assignments, jumlahRombel, butuhPenugasan, searchClasses };
  }), [guruList, kelasTerurut, tahunAktif?.tahun]);

  const guruTampil = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('id-ID');
    return guruDenganInfo.filter(({ guru, butuhPenugasan, searchClasses }) => {
      const cocokCari = !term || [guru.nama, guru.nip, guru.nuptk, guru.mapel, guru.jabatan, searchClasses]
        .some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(term));
      const cocokJabatan = filterJabatan === 'Semua' || guru.jabatan === filterJabatan;
      const cocokPenugasan = filterPenugasan === 'Semua'
        || (filterPenugasan === 'Sudah ditugaskan' && !butuhPenugasan && ['Wali Kelas', 'Guru Mata Pelajaran'].includes(guru.jabatan || ''))
        || (filterPenugasan === 'Belum ditugaskan' && butuhPenugasan);
      const cocokKelas = filterKelas === 'Semua' || searchClasses.includes(filterKelas);
      return cocokCari && cocokJabatan && cocokPenugasan && cocokKelas;
    }).sort((a, b) => String(a.guru.nama || '').localeCompare(String(b.guru.nama || ''), 'id'));
  }, [guruDenganInfo, searchTerm, filterJabatan, filterPenugasan, filterKelas]);

  const stats = useMemo(() => ({
    total: guruList.length,
    wali: guruList.filter((item) => item.jabatan === 'Wali Kelas').length,
    mapel: guruList.filter((item) => item.jabatan === 'Guru Mata Pelajaran').length,
    tendik: guruList.filter((item) => item.jabatan === 'Tenaga Kependidikan').length,
    pimpinan: guruList.filter((item) => ['Kepala Sekolah', 'Wakil Kepala Sekolah'].includes(item.jabatan || '')).length,
  }), [guruList]);

  const pilihanKelasFilter = useMemo(() => {
    const values = new Map<string, string>();
    guruDenganInfo.forEach(({ assignments }) => {
      [...assignments.waliResmi, ...assignments.kelasAmpu].forEach((kelas) => {
        values.set(kelas.id, labelKelas(kelas));
      });
    });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'id', { numeric: true }));
  }, [guruDenganInfo]);

  const resetFilter = () => {
    setSearchTerm('');
    setFilterJabatan('Semua');
    setFilterPenugasan('Semua');
    setFilterKelas('Semua');
  };

  const handlePrint = () => window.print();

  if (userData?.role !== 'kepsek') {
    return <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 text-sm text-amber-800">Halaman Monitoring Data Guru hanya dapat dibuka oleh Kepala Sekolah.</div>;
  }

  if (loadingGuru || loadingMaster) {
    return <div className="p-10 text-center font-semibold text-slate-500">Memuat data Guru dan penugasan rombel...</div>;
  }

  if (error) {
    return <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <style>{`
        @page { size: A4 landscape; margin: 12mm 14mm; }
        @media print {
          body * { visibility: hidden !important; }
          .monitor-guru-print, .monitor-guru-print * { visibility: visible !important; }
          .monitor-guru-print { display: block !important; position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0 !important; margin: 0 !important; background: white !important; color: #111827 !important; }
          .monitor-guru-screen { display: none !important; }
          .monitor-guru-print table { width: 100%; border-collapse: collapse; font-size: 8pt; }
          .monitor-guru-print th, .monitor-guru-print td { border: 1px solid #64748b; padding: 5px 6px; vertical-align: top; }
          .monitor-guru-print thead { display: table-header-group; }
          .monitor-guru-print tr { break-inside: avoid; page-break-inside: avoid; }
          .monitor-guru-print .print-heading { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #0b2e63; }
          .monitor-guru-print .print-signature { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="monitor-guru-screen space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Pemantauan Sekolah</p>
            <h1 className="mt-1 text-2xl font-extrabold text-[#082B62] sm:text-3xl">Monitoring Data Guru</h1>
            <p className="mt-1 text-sm text-slate-500">Pantau data pendidik, tenaga kependidikan, dan penugasan rombel.</p>
            {tahunAktif && <p className="mt-2 text-xs font-semibold text-blue-700">Periode penugasan aktif: {tahunAktif.tahun} · Semester {tahunAktif.semester || '-'}</p>}
          </div>
          <button onClick={handlePrint} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#082B62] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-900">
            <span aria-hidden="true">▤</span> Cetak Rekap
          </button>
        </div>

        {/* Ringkasan satu baris hanya untuk HP kecil; mulai 640px gunakan layout asli. */}
        <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 sm:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="min-w-[142px] flex-1 snap-start rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold text-blue-700">Total Pegawai</p><p className="mt-1.5 text-2xl font-extrabold tabular-nums text-[#082B62]">{stats.total}</p>
          </div>
          <div className="min-w-[142px] flex-1 snap-start rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold text-indigo-700">Wali Kelas</p><p className="mt-1.5 text-2xl font-extrabold tabular-nums text-indigo-800">{stats.wali}</p>
          </div>
          <div className="min-w-[142px] flex-1 snap-start rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold text-emerald-700">Guru Mata Pelajaran</p><p className="mt-1.5 text-2xl font-extrabold tabular-nums text-emerald-800">{stats.mapel}</p>
          </div>
          <div className="min-w-[142px] flex-1 snap-start rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold text-violet-700">Pimpinan Sekolah</p><p className="mt-1.5 text-2xl font-extrabold tabular-nums text-violet-800">{stats.pimpinan}</p>
          </div>
          <div className="min-w-[142px] flex-1 snap-start rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold text-amber-700">Tenaga Kependidikan</p><p className="mt-1.5 text-2xl font-extrabold tabular-nums text-amber-800">{stats.tendik}</p>
          </div>
        </div>

        <div className="hidden grid-cols-2 gap-3 sm:grid xl:grid-cols-5">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-blue-700">Total Pegawai</p><p className="mt-2 text-3xl font-extrabold tabular-nums text-[#082B62]">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-indigo-700">Wali Kelas</p><p className="mt-2 text-3xl font-extrabold tabular-nums text-indigo-800">{stats.wali}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-emerald-700">Guru Mata Pelajaran</p><p className="mt-2 text-3xl font-extrabold tabular-nums text-emerald-800">{stats.mapel}</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-violet-700">Pimpinan Sekolah</p><p className="mt-2 text-3xl font-extrabold tabular-nums text-violet-800">{stats.pimpinan}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm xl:col-span-1">
            <p className="text-xs font-semibold text-amber-700">Tenaga Kependidikan</p><p className="mt-2 text-3xl font-extrabold tabular-nums text-amber-800">{stats.tendik}</p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <div className="mb-2 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-1">
            <div><h2 className="font-bold text-slate-800">Filter Monitoring</h2><p className="text-xs text-slate-500">Cari dan saring daftar pegawai serta penugasannya.</p></div>
            <button onClick={resetFilter} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 sm:border-0 sm:px-0 sm:py-0 sm:text-sm">Reset Filter</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Cari nama, NIP, NUPTK, mapel..." className="col-span-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:col-span-1" />
            <select value={filterJabatan} onChange={(e) => setFilterJabatan(e.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:px-3 sm:text-sm">
              <option value="Semua">Semua Jabatan</option>{jabatanOptions.map((jabatan) => <option key={jabatan} value={jabatan}>{jabatan}</option>)}
            </select>
            <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:px-3 sm:text-sm">
              <option value="Semua">Semua Rombel</option>{pilihanKelasFilter.map(([id, label]) => <option key={id} value={label}>{label}</option>)}
            </select>
            <select value={filterPenugasan} onChange={(e) => setFilterPenugasan(e.target.value)} className="col-span-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:col-span-1 sm:px-3 sm:text-sm">
              <option value="Semua">Semua Status Penugasan</option><option value="Sudah ditugaskan">Sudah ditugaskan</option><option value="Belum ditugaskan">Belum ditugaskan</option>
            </select>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500 sm:mt-3 sm:text-xs">Status penugasan dihitung dari hubungan ID rombel aktif. Status kepegawaian belum ditampilkan karena field tersebut belum tersedia pada struktur Data Pegawai saat ini.</p>
        </section>

        <section className="space-y-2 sm:space-y-3">
          <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center sm:gap-3"><h2 className="text-sm font-bold leading-snug text-slate-800 sm:text-base sm:leading-normal">Daftar Pendidik dan Tenaga Kependidikan</h2><span className="text-[11px] font-medium text-slate-500 sm:text-xs">{guruTampil.length} dari {guruList.length} pegawai</span></div>

          <div className="grid grid-cols-1 gap-2 sm:gap-3 md:hidden">
            {guruTampil.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Tidak ada pegawai yang sesuai dengan filter.</div> : guruTampil.map(({ guru, assignments, jumlahRombel, butuhPenugasan }) => (
              <article key={guru.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="break-words text-sm font-bold leading-snug text-[#082B62]">{guru.nama || '-'}</h3>
                    <span className="max-w-full rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold leading-snug text-blue-700">{guru.jabatan || 'Jabatan belum diisi'}</span>
                  </div>
                  <p className="mt-1 break-words text-[10px] leading-relaxed text-slate-500">NIP: {guru.nip || '-'} <span className="text-slate-300">·</span> NUPTK: {guru.nuptk || '-'}</p>
                  {guru.mapel && guru.mapel !== '-' && <p className="mt-1 text-[11px] leading-snug text-slate-600"><span className="font-semibold text-slate-700">Mapel:</span> {guru.mapel}</p>}
                  <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                    <p className="text-[10px] font-bold text-slate-600">Penugasan{jumlahRombel > 0 ? ` · ${jumlahRombel} rombel` : ''}</p>
                    {guru.jabatan === 'Wali Kelas' && assignments.waliResmi.length > 0 ? <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-snug text-slate-600">{assignments.waliResmi.map(labelKelas).join(', ')}</p>
                      : guru.jabatan === 'Guru Mata Pelajaran' && assignments.kelasAmpu.length > 0 ? <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-snug text-slate-600">{assignments.kelasAmpu.map(labelKelas).join(', ')}</p>
                        : butuhPenugasan ? <p className="mt-0.5 text-[11px] leading-snug text-amber-700">Belum ada penugasan rombel aktif.</p>
                          : <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Tidak memerlukan penugasan rombel khusus.</p>}
                    {guru.jabatan === 'Wali Kelas' && assignments.waliLama.length > 0 && <p className="mt-1 line-clamp-1 break-words text-[10px] leading-snug text-amber-700">Penugasan lama belum tertaut: {assignments.waliLama.map((item) => item.namaKelas).join(', ')}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedGuru(guru)} className="min-h-10 w-[92px] shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-xs font-bold leading-tight text-blue-700 transition hover:bg-blue-100">Lihat Detail</button>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead><tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600"><th className="p-4">No</th><th className="p-4">Nama / Identitas</th><th className="p-4">Jabatan / Mapel</th><th className="p-4">Penugasan Rombel</th><th className="p-4">Kontak</th><th className="p-4">Detail</th></tr></thead>
                <tbody>
                  {guruTampil.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-sm text-slate-500">Tidak ada pegawai yang sesuai dengan filter.</td></tr> : guruTampil.map(({ guru, assignments, butuhPenugasan }, index) => (
                    <tr key={guru.id} className="border-t border-slate-100 align-top text-sm hover:bg-slate-50/70">
                      <td className="p-4 text-slate-500">{index + 1}</td>
                      <td className="p-4"><p className="font-bold text-[#082B62]">{guru.nama || '-'}</p><p className="mt-1 text-xs text-slate-500">NIP: {guru.nip || '-'}<br/>NUPTK: {guru.nuptk || '-'}</p></td>
                      <td className="p-4"><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{guru.jabatan || 'Belum diisi'}</span>{guru.mapel && guru.mapel !== '-' && <p className="mt-2 text-xs text-slate-600">{guru.mapel}</p>}</td>
                      <td className="max-w-sm p-4 text-xs text-slate-600">{guru.jabatan === 'Wali Kelas' ? assignments.waliResmi.length > 0 ? assignments.waliResmi.map(labelKelas).join(', ') : butuhPenugasan ? <span className="text-amber-700">Belum ditugaskan / belum tertaut</span> : '-'
                        : guru.jabatan === 'Guru Mata Pelajaran' ? assignments.kelasAmpu.length > 0 ? assignments.kelasAmpu.map(labelKelas).join(', ') : <span className="text-amber-700">Belum ditugaskan</span>
                          : <span className="text-slate-400">Tidak memerlukan rombel khusus</span>}{assignments.waliLama.length > 0 && <p className="mt-1 text-amber-700">Data lama belum tertaut: {assignments.waliLama.map((item) => item.namaKelas).join(', ')}</p>}</td>
                      <td className="p-4 text-xs text-slate-600">{guru.noHp || '-'}</td>
                      <td className="p-4"><button onClick={() => setSelectedGuru(guru)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Lihat Detail</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {selectedGuru && (() => {
          const assignments = getAssignments(selectedGuru);
          return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Detail data pegawai">
            <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Detail Pegawai</p><h2 className="mt-1 text-xl font-extrabold text-[#082B62]">{selectedGuru.nama || '-'}</h2><p className="mt-1 text-sm text-slate-500">{selectedGuru.jabatan || '-'}</p></div><button onClick={() => setSelectedGuru(null)} className="min-h-10 min-w-10 rounded-full bg-slate-100 text-lg text-slate-600 hover:bg-slate-200" aria-label="Tutup detail">×</button></div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">NIP</p><p className="mt-1 break-words font-semibold text-slate-800">{selectedGuru.nip || '-'}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">NUPTK</p><p className="mt-1 break-words font-semibold text-slate-800">{selectedGuru.nuptk || '-'}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Mata Pelajaran</p><p className="mt-1 break-words font-semibold text-slate-800">{selectedGuru.mapel || '-'}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Nomor HP</p><p className="mt-1 break-words font-semibold text-slate-800">{selectedGuru.noHp || '-'}</p></div>
                <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><p className="text-xs text-slate-500">Alamat</p><p className="mt-1 whitespace-pre-wrap break-words font-semibold text-slate-800">{selectedGuru.alamat || '-'}</p></div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 sm:col-span-2"><p className="text-sm font-bold text-blue-900">Penugasan Wali Kelas</p>{assignments.waliResmi.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{assignments.waliResmi.map((item) => <li key={item.id}>{labelKelas(item)} · {item.tahunAjaran || '-'}</li>)}</ul> : <p className="mt-1 text-sm text-slate-600">Tidak ada penugasan Wali Kelas resmi pada periode aktif.</p>}{assignments.waliLama.length > 0 && <p className="mt-2 text-xs text-amber-700">Penugasan lama berdasarkan nama belum tertaut: {assignments.waliLama.map((item) => item.namaKelas).join(', ')}.</p>}</div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 sm:col-span-2"><p className="text-sm font-bold text-emerald-900">Rombel Guru Mata Pelajaran</p>{assignments.kelasAmpu.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{assignments.kelasAmpu.map((item) => <li key={item.id}>{labelKelas(item)} · {item.tahunAjaran || '-'}</li>)}</ul> : <p className="mt-1 text-sm text-slate-600">Tidak ada rombel yang tercatat pada daftar kelas diampu.</p>}</div>
              </div>
              <div className="mt-5 flex justify-end"><button onClick={() => setSelectedGuru(null)} className="min-h-11 rounded-xl bg-[#082B62] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-900">Tutup</button></div>
            </div>
          </div>;
        })()}
      </div>

      <div className="monitor-guru-print hidden bg-white text-slate-900">
        <header className="print-heading text-center">
          <h1 className="text-xl font-bold uppercase">{identitas.namaSekolah || 'NAMA SEKOLAH'}</h1>
          {identitas.npsn && <p className="mt-1 text-xs">NPSN: {identitas.npsn}</p>}
          {identitas.alamat && <p className="mt-1 text-xs">{identitas.alamat}</p>}
          <h2 className="mt-4 text-base font-bold underline">REKAP MONITORING DATA GURU DAN TENAGA KEPENDIDIKAN</h2>
          <p className="mt-1 text-xs">Tahun Ajaran Aktif: {tahunAktif?.tahun || 'Belum ditentukan'} · Semester {tahunAktif?.semester || '-'}</p>
          <p className="mt-1 text-xs">Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <div className="mb-3 grid grid-cols-5 gap-2 text-xs">
          <div className="border border-slate-400 p-2"><b>Total Pegawai</b><p className="mt-1 text-lg font-bold">{stats.total}</p></div>
          <div className="border border-slate-400 p-2"><b>Wali Kelas</b><p className="mt-1 text-lg font-bold">{stats.wali}</p></div>
          <div className="border border-slate-400 p-2"><b>Guru Mapel</b><p className="mt-1 text-lg font-bold">{stats.mapel}</p></div>
          <div className="border border-slate-400 p-2"><b>Pimpinan</b><p className="mt-1 text-lg font-bold">{stats.pimpinan}</p></div>
          <div className="border border-slate-400 p-2"><b>Tenaga Kependidikan</b><p className="mt-1 text-lg font-bold">{stats.tendik}</p></div>
        </div>
        <p className="mb-2 text-xs">Filter: {filterJabatan} · {filterKelas === 'Semua' ? 'Semua rombel' : filterKelas} · {filterPenugasan} · Pencarian: {searchTerm || '-'}</p>
        <table>
          <thead><tr><th>No</th><th>Nama Lengkap</th><th>NIP</th><th>NUPTK</th><th>Jabatan</th><th>Mata Pelajaran</th><th>Penugasan Rombel</th><th>Nomor HP</th></tr></thead>
          <tbody>{guruTampil.map(({ guru, assignments }, index) => {
            const penugasan = guru.jabatan === 'Wali Kelas' ? assignments.waliResmi.map(labelKelas) : guru.jabatan === 'Guru Mata Pelajaran' ? assignments.kelasAmpu.map(labelKelas) : [];
            const penugasanText = [...penugasan, ...assignments.waliLama.map((item) => `${labelKelas(item)} (belum tertaut)`)];
            return <tr key={guru.id}><td>{index + 1}</td><td>{guru.nama || '-'}</td><td>{guru.nip || '-'}</td><td>{guru.nuptk || '-'}</td><td>{guru.jabatan || '-'}</td><td>{guru.mapel || '-'}</td><td>{penugasanText.join('; ') || '-'}</td><td>{guru.noHp || '-'}</td></tr>;
          })}</tbody>
        </table>
        <div className="print-signature mt-10 flex justify-end">
          <div className="w-64 text-center text-xs"><p>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p><p className="mt-2">Mengetahui,</p><p>Kepala Sekolah</p><p className="mt-14 font-bold underline">{identitas.kepalaSekolah || '........................................'}</p><p>NIP. ........................................</p></div>
        </div>
      </div>
    </div>
  );
}
