import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type JurnalRecord = {
  id: string;
  userId?: string;
  guruId?: string;
  pegawaiId?: string;
  namaGuru?: string;
  tanggal?: string;
  jamKe?: string;
  kelas?: string;
  kelasId?: string;
  jenjang?: string;
  tingkat?: number | string;
  tahunAjaran?: string;
  semester?: string;
  mataPelajaran?: string;
  tema?: string;
  tujuan?: string;
  kegiatanMedia?: string;
  absensiSiswa?: string;
  refleksi?: string;
  status?: string;
  catatanKepsek?: string;
  createdAt?: string;
  updatedAt?: string;
};

type IdentitasSekolah = {
  namaSekolah?: string;
  npsn?: string;
  alamat?: string;
};

const formatTanggal = (tanggal?: string) => {
  if (!tanggal) return '-';
  const date = new Date(`${tanggal}T00:00:00`);
  if (Number.isNaN(date.getTime())) return tanggal;
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const statusClass = (status?: string) => {
  switch (status) {
    case 'Dikirim':
      return 'bg-blue-100 text-blue-700';
    case 'Disetujui':
      return 'bg-emerald-100 text-emerald-700';
    case 'Perlu Perbaikan':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

const nilai = (value?: string | number | null) => {
  if (value === undefined || value === null || String(value).trim() === '') return '-';
  return String(value);
};

export default function MonitoringPembelajaran() {
  const { userData } = useAuth();
  const [jurnalList, setJurnalList] = useState<JurnalRecord[]>([]);
  const [identitasSekolah, setIdentitasSekolah] = useState<IdentitasSekolah>({});
  const [loading, setLoading] = useState(true);
  const [errorData, setErrorData] = useState('');
  const [kataKunci, setKataKunci] = useState('');
  const [filterGuru, setFilterGuru] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  const [filterTahun, setFilterTahun] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [jurnalTerpilih, setJurnalTerpilih] = useState<JurnalRecord | null>(null);

  useEffect(() => {
    if (userData?.role !== 'kepsek') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorData('');

    const unsubscribeJurnal = onSnapshot(
      collection(db, 'jurnal'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as JurnalRecord[];

        data.sort((a, b) => {
          const tanggalA = `${a.tanggal || ''} ${a.createdAt || ''}`;
          const tanggalB = `${b.tanggal || ''} ${b.createdAt || ''}`;
          return tanggalB.localeCompare(tanggalA);
        });

        setJurnalList(data);
        setLoading(false);
        setErrorData('');
      },
      (error) => {
        console.error('Gagal memuat monitoring jurnal:', error);
        setErrorData('Data jurnal belum dapat dimuat. Periksa koneksi dan aturan akses Firestore.');
        setLoading(false);
      },
    );

    const unsubscribeSekolah = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      (snapshot) => {
        setIdentitasSekolah(snapshot.exists() ? (snapshot.data() as IdentitasSekolah) : {});
      },
      (error) => {
        console.warn('Identitas sekolah belum dapat dimuat:', error);
      },
    );

    return () => {
      unsubscribeJurnal();
      unsubscribeSekolah();
    };
  }, [userData?.role]);

  const daftarGuru = useMemo(
    () => [...new Set(jurnalList.map((item) => item.namaGuru).filter((item): item is string => Boolean(item?.trim())))].sort((a, b) => a.localeCompare(b, 'id')),
    [jurnalList],
  );
  const daftarKelas = useMemo(
    () => [...new Set(jurnalList.map((item) => item.kelas).filter((item): item is string => Boolean(item?.trim())))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true })),
    [jurnalList],
  );
  const daftarMapel = useMemo(
    () => [...new Set(jurnalList.map((item) => item.mataPelajaran).filter((item): item is string => Boolean(item?.trim())))].sort((a, b) => a.localeCompare(b, 'id')),
    [jurnalList],
  );
  const daftarTahun = useMemo(
    () => [...new Set(jurnalList.map((item) => item.tahunAjaran).filter((item): item is string => Boolean(item?.trim())))].sort((a, b) => b.localeCompare(a, 'id', { numeric: true })),
    [jurnalList],
  );
  const daftarSemester = useMemo(
    () => [...new Set(jurnalList.map((item) => item.semester).filter((item): item is string => Boolean(item?.trim())))].sort((a, b) => a.localeCompare(b, 'id')),
    [jurnalList],
  );

  const jurnalTersaring = useMemo(() => {
    const keyword = kataKunci.trim().toLocaleLowerCase('id');
    return jurnalList.filter((item) => {
      const cocokKataKunci = !keyword || [
        item.namaGuru,
        item.kelas,
        item.mataPelajaran,
        item.tema,
        item.tujuan,
      ].some((value) => String(value || '').toLocaleLowerCase('id').includes(keyword));

      return cocokKataKunci
        && (!filterGuru || item.namaGuru === filterGuru)
        && (!filterKelas || item.kelas === filterKelas)
        && (!filterMapel || item.mataPelajaran === filterMapel)
        && (!filterTahun || item.tahunAjaran === filterTahun)
        && (!filterSemester || item.semester === filterSemester)
        && (!filterStatus || item.status === filterStatus);
    });
  }, [jurnalList, kataKunci, filterGuru, filterKelas, filterMapel, filterTahun, filterSemester, filterStatus]);

  const ringkasan = useMemo(() => ({
    total: jurnalList.length,
    dikirim: jurnalList.filter((item) => item.status === 'Dikirim').length,
    disetujui: jurnalList.filter((item) => item.status === 'Disetujui').length,
    revisi: jurnalList.filter((item) => item.status === 'Perlu Perbaikan').length,
  }), [jurnalList]);

  const resetFilter = () => {
    setKataKunci('');
    setFilterGuru('');
    setFilterKelas('');
    setFilterMapel('');
    setFilterTahun('');
    setFilterSemester('');
    setFilterStatus('');
  };

  const filterCetak = [
    kataKunci.trim() ? `Pencarian: ${kataKunci.trim()}` : '',
    filterGuru ? `Guru: ${filterGuru}` : '',
    filterKelas ? `Rombel: ${filterKelas}` : '',
    filterMapel ? `Mata pelajaran: ${filterMapel}` : '',
    filterTahun ? `Tahun ajaran: ${filterTahun}` : '',
    filterSemester ? `Semester: ${filterSemester}` : '',
    filterStatus ? `Status: ${filterStatus}` : '',
  ].filter(Boolean);

  if (userData?.role !== 'kepsek') {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-red-700">Akses tidak tersedia</h1>
        <p className="mt-2 text-sm text-slate-600">Halaman Monitoring Pembelajaran hanya dapat diakses oleh Kepala Sekolah.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-10 text-center font-bold text-slate-500">Memuat data monitoring pembelajaran...</div>;
  }

  return (
    <>
      <style>{`
        .monitoring-print-only { display: none; }
        .monitoring-journal-mobile-list { display: none; }

        /* Perapian khusus HP: tidak mengubah tampilan tablet/iPad dan laptop. */
        @media screen and (max-width: 639px) {
          .monitoring-screen-only {
            gap: 1rem !important;
            padding-bottom: 1rem !important;
          }

          .monitoring-mobile-page-header { gap: 0.75rem !important; }
          .monitoring-mobile-page-header h1 { font-size: 1.25rem !important; line-height: 1.5rem !important; }
          .monitoring-mobile-print-button {
            width: 100% !important;
            min-height: 44px !important;
            justify-content: center !important;
          }

          .monitoring-summary-grid {
            display: flex !important;
            flex-wrap: nowrap !important;
            gap: 0.65rem !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding: 2px 2px 8px !important;
            margin-right: -2px !important;
            scrollbar-width: thin;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }
          .monitoring-summary-grid > div {
            flex: 0 0 44% !important;
            min-width: 145px !important;
            min-height: 88px !important;
            padding: 0.8rem !important;
            border-radius: 16px !important;
            scroll-snap-align: start;
          }
          .monitoring-summary-grid > div p:first-child {
            font-size: 0.7rem !important;
            line-height: 1rem !important;
          }
          .monitoring-summary-grid > div p:last-child {
            font-size: 1.6rem !important;
            line-height: 1.9rem !important;
            margin-top: 0.35rem !important;
          }

          .monitoring-filter-section {
            padding: 0.9rem !important;
            border-radius: 17px !important;
          }
          .monitoring-filter-header {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 0.5rem !important;
            margin-bottom: 0.75rem !important;
          }
          .monitoring-filter-reset {
            flex: 0 0 auto !important;
            min-height: 36px !important;
            padding: 0.35rem 0.6rem !important;
            border: 1px solid #dbeafe !important;
            border-radius: 10px !important;
            background: #eff6ff !important;
          }
          .monitoring-filter-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.55rem !important;
          }
          .monitoring-filter-search { grid-column: 1 / -1 !important; }
          .monitoring-filter-control {
            box-sizing: border-box !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 43px !important;
            padding: 0.55rem 0.6rem !important;
            border-radius: 11px !important;
            font-size: 0.72rem !important;
          }

          .monitoring-journal-section { border-radius: 17px !important; }
          .monitoring-journal-header {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.25rem !important;
            padding: 0.9rem !important;
          }
          .monitoring-journal-header > p { font-size: 0.7rem !important; }
          .monitoring-journal-desktop-table { display: none !important; }
          .monitoring-journal-mobile-list {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 0.65rem !important;
            padding: 0 0.75rem 0.75rem !important;
          }
          /* Baris daftar jurnal: informasi di kiri, tombol detail tetap terlihat di kanan. */
          .monitoring-journal-mobile-card {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 82px !important;
            align-items: center !important;
            column-gap: 0.65rem !important;
            min-width: 0 !important;
            padding: 0.75rem !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 13px !important;
            background: #fff !important;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.045) !important;
          }
          .monitoring-journal-mobile-card .journal-mobile-content {
            min-width: 0 !important;
          }
          .monitoring-journal-mobile-card h3 {
            font-size: 0.84rem !important;
            line-height: 1.15rem !important;
            overflow-wrap: anywhere !important;
          }
          .monitoring-journal-mobile-card .journal-mobile-topline {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 0.35rem !important;
            min-width: 0 !important;
          }
          .monitoring-journal-mobile-card .journal-mobile-status {
            flex: 0 0 auto !important;
            max-width: 105px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .monitoring-journal-mobile-card .journal-mobile-subject {
            min-width: 0 !important;
          }
          .monitoring-journal-mobile-card .journal-mobile-info {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            column-gap: 0.35rem !important;
            row-gap: 0.15rem !important;
            margin-top: 0.35rem !important;
            color: #64748b !important;
            font-size: 0.65rem !important;
            line-height: 0.95rem !important;
          }
          .monitoring-journal-mobile-card .journal-mobile-info span {
            min-width: 0 !important;
            overflow-wrap: anywhere !important;
          }
          .monitoring-journal-mobile-detail {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 82px !important;
            min-width: 82px !important;
            min-height: 42px !important;
            margin: 0 !important;
            padding: 0.4rem 0.35rem !important;
            border: 1px solid #bfdbfe !important;
            border-radius: 10px !important;
            background: #eff6ff !important;
            color: #1d4ed8 !important;
            font-size: 0.68rem !important;
            line-height: 0.9rem !important;
            font-weight: 700 !important;
            text-align: center !important;
            white-space: normal !important;
          }

          .monitoring-detail-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .monitoring-detail-dialog {
            width: 100% !important;
            max-width: none !important;
            max-height: 94dvh !important;
            padding: 1rem !important;
            border-radius: 22px 22px 0 0 !important;
          }
        }

        @page { size: A4 landscape; margin: 12mm 14mm 12mm; }

        @media print {
          html, body, #root {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }

          /* Lepaskan pembatas h-screen, flex, dan overflow dari DashboardLayout. */
          #root > div {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          #root > div > aside,
          #root > div > div > header {
            display: none !important;
          }
          #root > div > div {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          #root main {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden !important; }
          .monitoring-screen-only,
          .monitoring-no-print { display: none !important; }
          .monitoring-print-only,
          .monitoring-print-only * { visibility: visible !important; }
          .monitoring-print-only {
            display: block !important;
            position: static !important;
            box-sizing: border-box !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            color: #111 !important;
            background: #fff !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 7pt !important;
            line-height: 1.2 !important;
          }
          .monitoring-print-heading {
            text-align: center !important;
            border-bottom: 1.5px solid #111 !important;
            padding: 0 0 5px !important;
            margin: 0 0 6px !important;
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }
          .monitoring-print-heading h1 {
            font-size: 13pt !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            margin: 0 0 2px !important;
          }
          .monitoring-print-heading h2 {
            font-size: 10pt !important;
            font-weight: 700 !important;
            margin: 4px 0 2px !important;
          }
          .monitoring-print-heading p { font-size: 7pt !important; margin: 1px 0 !important; }
          .monitoring-print-subtitle {
            font-size: 7pt !important;
            margin: 4px 0 5px !important;
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }
          .monitoring-print-summary {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 4px 0 7px !important;
            font-size: 7pt !important;
            break-after: avoid-page !important;
            page-break-after: avoid !important;
          }
          .monitoring-print-summary td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
          }
          .monitoring-print-summary strong {
            display: block !important;
            font-size: 10pt !important;
            margin-top: 1px !important;
          }
          .monitoring-print-table {
            display: table !important;
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 6.3pt !important;
            line-height: 1.15 !important;
            margin: 0 !important;
          }
          .monitoring-print-table thead { display: table-header-group !important; }
          .monitoring-print-table tfoot { display: table-footer-group !important; }
          .monitoring-print-table tbody { display: table-row-group !important; }
          .monitoring-print-table tr {
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
          }
          .monitoring-print-table th,
          .monitoring-print-table td {
            border: 1px solid #9ca3af !important;
            padding: 3px 4px !important;
            vertical-align: top !important;
            white-space: pre-wrap !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }
          .monitoring-print-table th {
            background: #e9eef5 !important;
            font-weight: 700 !important;
          }
          .monitoring-print-only > p:last-child {
            font-size: 7pt !important;
            margin: 6px 0 0 !important;
          }
        }
      `}</style>

      <div className="monitoring-screen-only mx-auto max-w-[1500px] space-y-6 pb-10">
        <div className="monitoring-mobile-page-header flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center monitoring-no-print">
          <div>
            <h1 className="text-2xl font-bold text-[#082B62]">Monitoring Pembelajaran</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Pantau jurnal mengajar dan aktivitas pembelajaran seluruh Guru.</p>
          </div>
          <button onClick={() => window.print()} className="monitoring-mobile-print-button rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-900">
            Cetak Rekap
          </button>
        </div>

        {errorData && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 monitoring-no-print">{errorData}</div>}

        <div className="monitoring-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Total Jurnal</p>
            <p className="mt-2 text-3xl font-extrabold text-[#082B62]">{ringkasan.total}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-blue-700">Menunggu Persetujuan</p>
            <p className="mt-2 text-3xl font-extrabold text-blue-800">{ringkasan.dikirim}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">Disetujui</p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-800">{ringkasan.disetujui}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-amber-700">Perlu Perbaikan</p>
            <p className="mt-2 text-3xl font-extrabold text-amber-800">{ringkasan.revisi}</p>
          </div>
        </div>

        <section className="monitoring-filter-section rounded-2xl border border-slate-200 bg-white p-5 shadow-sm monitoring-no-print">
          <div className="monitoring-filter-header mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-slate-800">Filter Monitoring</h2>
              <p className="text-xs text-slate-500">Gunakan filter untuk menemukan jurnal tertentu.</p>
            </div>
            <button onClick={resetFilter} className="monitoring-filter-reset text-sm font-bold text-blue-700 hover:text-blue-900">Reset Filter</button>
          </div>
          <div className="monitoring-filter-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <input value={kataKunci} onChange={(event) => setKataKunci(event.target.value)} placeholder="Cari Guru, kelas, tema, TP..." className="monitoring-filter-control monitoring-filter-search rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <select value={filterGuru} onChange={(event) => setFilterGuru(event.target.value)} className="monitoring-filter-control rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
              <option value="">Semua Guru</option>
              {daftarGuru.map((nama) => <option key={nama} value={nama}>{nama}</option>)}
            </select>
            <select value={filterKelas} onChange={(event) => setFilterKelas(event.target.value)} className="monitoring-filter-control rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
              <option value="">Semua Kelas</option>
              {daftarKelas.map((kelas) => <option key={kelas} value={kelas}>{kelas}</option>)}
            </select>
            <select value={filterMapel} onChange={(event) => setFilterMapel(event.target.value)} className="monitoring-filter-control rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
              <option value="">Semua Mata Pelajaran</option>
              {daftarMapel.map((mapel) => <option key={mapel} value={mapel}>{mapel}</option>)}
            </select>
            <select value={filterTahun} onChange={(event) => setFilterTahun(event.target.value)} className="monitoring-filter-control rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
              <option value="">Semua Tahun Ajaran</option>
              {daftarTahun.map((tahun) => <option key={tahun} value={tahun}>{tahun}</option>)}
            </select>
            <select value={filterSemester} onChange={(event) => setFilterSemester(event.target.value)} className="monitoring-filter-control rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
              <option value="">Semua Semester</option>
              {daftarSemester.map((semester) => <option key={semester} value={semester}>{semester}</option>)}
            </select>
            <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="monitoring-filter-control rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
              <option value="">Semua Status</option>
              <option value="Dikirim">Dikirim</option>
              <option value="Disetujui">Disetujui</option>
              <option value="Perlu Perbaikan">Perlu Perbaikan</option>
            </select>
          </div>
        </section>

        <section className="monitoring-journal-section overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="monitoring-journal-header flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-slate-800">Daftar Jurnal Mengajar</h2>
              <p className="text-xs text-slate-500">Data diperbarui otomatis ketika Guru mengirim atau memperbarui jurnal.</p>
            </div>
            <p className="text-sm font-semibold text-slate-600">Menampilkan {jurnalTersaring.length} dari {jurnalList.length} jurnal</p>
          </div>
          <div className="monitoring-journal-mobile-list">
            {jurnalTersaring.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                {jurnalList.length === 0 ? 'Belum ada jurnal yang tercatat.' : 'Tidak ada jurnal yang sesuai dengan filter.'}
              </div>
            ) : jurnalTersaring.map((jurnal, index) => (
              <article key={jurnal.id} className="monitoring-journal-mobile-card">
                <div className="journal-mobile-content">
                  <div className="journal-mobile-topline">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Jurnal {index + 1}</p>
                    <span className={`journal-mobile-status inline-flex shrink-0 rounded-md px-2 py-1 text-[9px] font-bold ${statusClass(jurnal.status)}`}>
                      {nilai(jurnal.status)}
                    </span>
                  </div>

                  <div className="journal-mobile-subject">
                    <h3 className="font-bold text-[#082B62]">{nilai(jurnal.mataPelajaran)}</h3>
                    {jurnal.tema && <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-slate-500">{jurnal.tema}</p>}
                  </div>

                  <div className="journal-mobile-info">
                    <span className="font-semibold text-slate-700">{nilai(jurnal.namaGuru)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatTanggal(jurnal.tanggal)}</span>
                  </div>
                  <div className="journal-mobile-info">
                    <span>Rombel {nilai(jurnal.kelas)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Jam {nilai(jurnal.jamKe)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{nilai(jurnal.tahunAjaran)} / {nilai(jurnal.semester)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setJurnalTerpilih(jurnal)}
                  className="monitoring-journal-mobile-detail"
                  aria-label={`Lihat detail jurnal ${nilai(jurnal.mataPelajaran)} oleh ${nilai(jurnal.namaGuru)}`}
                >
                  Lihat Detail
                </button>
              </article>
            ))}
          </div>

          <div className="monitoring-journal-desktop-table overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <th className="p-4">No.</th>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Nama Guru</th>
                  <th className="p-4">Rombel</th>
                  <th className="p-4">Mata Pelajaran / Tema</th>
                  <th className="p-4">Tahun / Semester</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 monitoring-no-print">Detail</th>
                </tr>
              </thead>
              <tbody>
                {jurnalTersaring.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-sm font-medium text-slate-500">{jurnalList.length === 0 ? 'Belum ada jurnal yang tercatat.' : 'Tidak ada jurnal yang sesuai dengan filter.'}</td></tr>
                ) : jurnalTersaring.map((jurnal, index) => (
                  <tr key={jurnal.id} className="border-b border-slate-100 text-sm hover:bg-slate-50">
                    <td className="p-4 text-slate-500">{index + 1}</td>
                    <td className="p-4 whitespace-nowrap font-medium text-slate-700">{formatTanggal(jurnal.tanggal)}</td>
                    <td className="p-4 font-semibold text-slate-800">{nilai(jurnal.namaGuru)}</td>
                    <td className="p-4 text-slate-700">{nilai(jurnal.kelas)}</td>
                    <td className="p-4 text-slate-700">
                      <span className="font-semibold">{nilai(jurnal.mataPelajaran)}</span>
                      {jurnal.tema && <span className="mt-1 block max-w-[230px] truncate text-xs text-slate-500">{jurnal.tema}</span>}
                    </td>
                    <td className="p-4 text-slate-700">{nilai(jurnal.tahunAjaran)}<span className="block text-xs text-slate-500">{nilai(jurnal.semester)}</span></td>
                    <td className="p-4"><span className={`inline-flex whitespace-nowrap rounded-lg px-3 py-1 text-xs font-bold ${statusClass(jurnal.status)}`}>{nilai(jurnal.status)}</span></td>
                    <td className="p-4 monitoring-no-print"><button onClick={() => setJurnalTerpilih(jurnal)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Lihat Detail</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="monitoring-print-only">
        <header className="monitoring-print-heading">
          <h1>{identitasSekolah.namaSekolah || 'NAMA SEKOLAH'}</h1>
          {identitasSekolah.npsn && <p>NPSN: {identitasSekolah.npsn}</p>}
          {identitasSekolah.alamat && <p>{identitasSekolah.alamat}</p>}
          <h2>REKAP MONITORING PEMBELAJARAN</h2>
          <p>Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>

        <div className="monitoring-print-subtitle">
          <strong>Filter laporan:</strong>{' '}
          {filterCetak.length > 0 ? filterCetak.join(' | ') : 'Semua data jurnal'}
          <br />
          <strong>Data ditampilkan:</strong> {jurnalTersaring.length} dari {jurnalList.length} jurnal
        </div>

        <table className="monitoring-print-summary">
          <tbody>
            <tr>
              <td>Total Jurnal<strong>{jurnalTersaring.length}</strong></td>
              <td>Menunggu Persetujuan<strong>{jurnalTersaring.filter((item) => item.status === 'Dikirim').length}</strong></td>
              <td>Disetujui<strong>{jurnalTersaring.filter((item) => item.status === 'Disetujui').length}</strong></td>
              <td>Perlu Perbaikan<strong>{jurnalTersaring.filter((item) => item.status === 'Perlu Perbaikan').length}</strong></td>
            </tr>
          </tbody>
        </table>

        <table className="monitoring-print-table">
          <colgroup>
            <col style={{ width: '3%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>No.</th>
              <th>Tanggal</th>
              <th>Nama Guru</th>
              <th>Rombel / Jam</th>
              <th>Mata Pelajaran / Tema</th>
              <th>Tujuan Pembelajaran</th>
              <th>Kegiatan Pembelajaran &amp; Media</th>
              <th>Absensi &amp; Refleksi</th>
              <th>Tahun / Semester</th>
              <th>Status / Catatan</th>
            </tr>
          </thead>
          <tbody>
            {jurnalTersaring.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '14px' }}>Tidak ada jurnal yang sesuai dengan filter.</td></tr>
            ) : jurnalTersaring.map((jurnal, index) => (
              <tr key={jurnal.id}>
                <td>{index + 1}</td>
                <td>{formatTanggal(jurnal.tanggal)}</td>
                <td>{nilai(jurnal.namaGuru)}</td>
                <td>{nilai(jurnal.kelas)}<br />Jam: {nilai(jurnal.jamKe)}</td>
                <td><strong>{nilai(jurnal.mataPelajaran)}</strong><br />{nilai(jurnal.tema)}</td>
                <td>{nilai(jurnal.tujuan)}</td>
                <td>{nilai(jurnal.kegiatanMedia)}</td>
                <td><strong>Kehadiran:</strong> {nilai(jurnal.absensiSiswa)}<br /><strong>Refleksi:</strong> {nilai(jurnal.refleksi)}</td>
                <td>{nilai(jurnal.tahunAjaran)}<br />{nilai(jurnal.semester)}</td>
                <td><strong>{nilai(jurnal.status)}</strong>{jurnal.catatanKepsek ? <><br /><strong>Catatan:</strong> {jurnal.catatanKepsek}</> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: '8pt', marginTop: '8px' }}>
          Dokumen ini merupakan rekap pemantauan jurnal pembelajaran berdasarkan data dan filter yang dipilih pada aplikasi.
        </p>
      </section>

      {jurnalTerpilih && (
        <div className="monitoring-detail-overlay fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 monitoring-no-print" onClick={() => setJurnalTerpilih(null)}>
          <div className="monitoring-detail-dialog max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#082B62]">Detail Jurnal Pembelajaran</h2>
                <p className="mt-1 text-sm text-slate-500">Informasi jurnal yang dikirim oleh Guru.</p>
              </div>
              <button onClick={() => setJurnalTerpilih(null)} className="rounded-lg px-3 py-2 font-bold text-slate-500 hover:bg-slate-100" aria-label="Tutup detail">✕</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase text-slate-400">Nama Guru</p><p className="mt-1 font-semibold text-slate-800">{nilai(jurnalTerpilih.namaGuru)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Tanggal</p><p className="mt-1 font-semibold text-slate-800">{formatTanggal(jurnalTerpilih.tanggal)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Rombel</p><p className="mt-1 font-semibold text-slate-800">{nilai(jurnalTerpilih.kelas)} · {nilai(jurnalTerpilih.jenjang)} {nilai(jurnalTerpilih.tingkat)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Jam Pelajaran</p><p className="mt-1 font-semibold text-slate-800">{nilai(jurnalTerpilih.jamKe)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Mata Pelajaran</p><p className="mt-1 font-semibold text-slate-800">{nilai(jurnalTerpilih.mataPelajaran)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Elemen / Bab / Tema</p><p className="mt-1 font-semibold text-slate-800">{nilai(jurnalTerpilih.tema)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Tahun Ajaran / Semester</p><p className="mt-1 font-semibold text-slate-800">{nilai(jurnalTerpilih.tahunAjaran)} / {nilai(jurnalTerpilih.semester)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Status</p><span className={`mt-1 inline-flex rounded-lg px-3 py-1 text-xs font-bold ${statusClass(jurnalTerpilih.status)}`}>{nilai(jurnalTerpilih.status)}</span></div>
            </div>
            <div className="mt-5 space-y-4">
              <div><p className="text-xs font-semibold uppercase text-slate-400">Tujuan Pembelajaran</p><p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{nilai(jurnalTerpilih.tujuan)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Kegiatan Pembelajaran & Media</p><p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{nilai(jurnalTerpilih.kegiatanMedia)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Absensi / Kehadiran Siswa</p><p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{nilai(jurnalTerpilih.absensiSiswa)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-slate-400">Refleksi & Tindak Lanjut</p><p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{nilai(jurnalTerpilih.refleksi)}</p></div>
              {jurnalTerpilih.catatanKepsek && <div><p className="text-xs font-semibold uppercase text-slate-400">Catatan Kepala Sekolah</p><p className="mt-1 whitespace-pre-wrap rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{jurnalTerpilih.catatanKepsek}</p></div>}
            </div>
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4"><button onClick={() => setJurnalTerpilih(null)} className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-900">Tutup</button></div>
          </div>
        </div>
      )}
    </>
  );
}
