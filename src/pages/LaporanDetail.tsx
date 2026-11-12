import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type Row = Record<string, any> & { id: string };
type Column = { key: string; label: string };
type ReportType = 'data-siswa' | 'kehadiran' | 'pembelajaran' | 'kepegawaian' | 'sarpras' | 'administrasi';
type DataState = { rows: Row[] | null; loading: boolean; error: string };
type ReportConfig = { title: string; description: string; sources: string[]; columns: Column[] };
type SchoolIdentity = { namaSekolah?: string; alamat?: string; npsn?: string; kepalaSekolah?: string };

const CONFIG: Record<ReportType, ReportConfig> = {
  'data-siswa': {
    title: 'Laporan Data Siswa',
    description: 'Rekap peserta didik berdasarkan kelas, tahun ajaran, dan status data siswa.',
    sources: ['siswa', 'kelas'],
    columns: [
      { key: 'no', label: 'No.' }, { key: 'nama', label: 'Nama Siswa' }, { key: 'nisn', label: 'NISN' },
      { key: 'kelas', label: 'Kelas / Rombel' }, { key: 'tahunAjaran', label: 'Tahun Ajaran' },
      { key: 'semester', label: 'Semester' }, { key: 'status', label: 'Status' },
    ],
  },
  kehadiran: {
    title: 'Laporan Kehadiran',
    description: 'Rekap kehadiran siswa dan guru menurut periode yang dipilih.',
    sources: ['absensi', 'absensi_guru'],
    columns: [
      { key: 'no', label: 'No.' }, { key: 'tanggal', label: 'Tanggal' }, { key: 'nama', label: 'Nama' },
      { key: 'identitas', label: 'NISN / NIP' }, { key: 'kelas', label: 'Kelas / Keterangan' },
      { key: 'status', label: 'Status' }, { key: 'waktuMasuk', label: 'Waktu Masuk' },
      { key: 'waktuPulang', label: 'Waktu Pulang' },
    ],
  },
  pembelajaran: {
    title: 'Laporan Pembelajaran',
    description: 'Rekap jurnal mengajar, aktivitas pembelajaran, dan status tindak lanjut.',
    sources: ['jurnal'],
    columns: [
      { key: 'no', label: 'No.' }, { key: 'tanggal', label: 'Tanggal' }, { key: 'namaGuru', label: 'Guru' },
      { key: 'kelas', label: 'Kelas' }, { key: 'mataPelajaran', label: 'Mata Pelajaran' },
      { key: 'jamKe', label: 'Jam Ke' }, { key: 'tema', label: 'Tema / Materi' }, { key: 'status', label: 'Status' },
    ],
  },
  kepegawaian: {
    title: 'Laporan Kepegawaian',
    description: 'Rekap guru dan tenaga kependidikan berdasarkan jabatan, mata pelajaran, serta penugasan.',
    sources: ['guru'],
    columns: [
      { key: 'no', label: 'No.' }, { key: 'nama', label: 'Nama Pegawai' }, { key: 'nip', label: 'NIP' },
      { key: 'nuptk', label: 'NUPTK' }, { key: 'jabatan', label: 'Jabatan' },
      { key: 'mapel', label: 'Mata Pelajaran' }, { key: 'penugasan', label: 'Penugasan Kelas' },
    ],
  },
  sarpras: {
    title: 'Laporan Sarana dan Prasarana',
    description: 'Rekap aset inventaris, kondisi ruang dan fasilitas, serta tindak lanjut pemeliharaan.',
    sources: ['inventaris_sarpras', 'ruang_fasilitas_sarpras', 'pemeliharaan_sarpras'],
    columns: [],
  },
  administrasi: {
    title: 'Laporan Administrasi',
    description: 'Ringkasan pengumuman sekolah, status publikasi, dan tahun ajaran yang tercatat.',
    sources: ['pengumuman_sekolah', 'tahun_ajaran', 'jurnal'],
    columns: [
      { key: 'no', label: 'No.' }, { key: 'judul', label: 'Judul Pengumuman' },
      { key: 'kategori', label: 'Kategori' }, { key: 'prioritas', label: 'Prioritas' },
      { key: 'sasaranLabel', label: 'Sasaran' }, { key: 'status', label: 'Status' },
      { key: 'pembuat', label: 'Dibuat Oleh' }, { key: 'tanggal', label: 'Tanggal Dibuat' },
    ],
  },
};

const LABEL_SARPRAS: Record<string, string> = {
  inventaris: 'Data Inventaris', ruang: 'Ruang dan Fasilitas', pemeliharaan: 'Pemeliharaan dan Perbaikan',
};

const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const currentMonth = () => localDateKey(new Date()).slice(0, 7);
const asText = (value: unknown): string => value === null || value === undefined || value === '' ? '—' : String(value);

function dateValue(value: any): Date | null {
  try {
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  } catch { return null; }
}

function dateLabel(value: any): string {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date) : asText(value);
}

function timeLabel(value: any): string {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date) : asText(value);
}

function Icon({ name }: { name: 'back' | 'print' | 'download' | 'search' | 'calendar' | 'file' | 'users' | 'chart' | 'refresh' }) {
  const common = { className: 'h-5 w-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  switch (name) {
    case 'back': return <svg {...common}><path d="m15 18-6-6 6-6M9 12h12" /></svg>;
    case 'print': return <svg {...common}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6zM18 12h.01" /></svg>;
    case 'download': return <svg {...common}><path d="M12 3v12m-5-5 5 5 5-5M4 20h16" /></svg>;
    case 'search': return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
    case 'calendar': return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case 'file': return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg>;
    case 'users': return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case 'chart': return <svg {...common}><path d="M3 3v18h18M8 15l4-4 3 3 6-7" /></svg>;
    case 'refresh': return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></svg>;
  }
}

export default function LaporanDetail() {
  const { jenis } = useParams<{ jenis: string }>();
  const { userData } = useAuth();
  const reportType = (jenis && jenis in CONFIG ? jenis : 'data-siswa') as ReportType;
  const config = CONFIG[reportType];
  const isAdmin = userData?.role === 'admin';
  const basePath = isAdmin ? '/admin' : '/kepsek';
  const [sources, setSources] = useState<Record<string, DataState>>({});
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [schoolYear, setSchoolYear] = useState('Semua');
  const [attendanceKind, setAttendanceKind] = useState<'Siswa' | 'Guru'>('Siswa');
  const [sarprasKind, setSarprasKind] = useState<'inventaris' | 'ruang' | 'pemeliharaan'>('inventaris');
  const [schoolIdentity, setSchoolIdentity] = useState<SchoolIdentity>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'pengaturan', 'sekolah'), (snapshot) => {
      setSchoolIdentity(snapshot.exists() ? snapshot.data() as SchoolIdentity : {});
    }, (error) => {
      console.warn('Identitas sekolah untuk cetak laporan belum dapat dibaca:', error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setSources(Object.fromEntries(config.sources.map((name) => [name, { rows: null, loading: true, error: '' }])));
    const unsubscribers = config.sources.map((name) => onSnapshot(
      name === 'tahun_ajaran' ? query(collection(db, name), where('status', '==', 'Aktif')) : collection(db, name),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({ ...item.data(), id: item.id })) as Row[];
        setSources((previous) => ({ ...previous, [name]: { rows, loading: false, error: '' } }));
      },
      (error) => {
        console.error(`Gagal membaca koleksi ${name}:`, error);
        setSources((previous) => ({ ...previous, [name]: { rows: null, loading: false, error: 'Data tidak dapat dibaca. Periksa koneksi dan Firestore Rules.' } }));
      }
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [reportType]);

  const rowsFor = (name: string): Row[] => sources[name]?.rows || [];
  const activeSources = reportType === 'sarpras'
    ? [sarprasKind === 'inventaris' ? 'inventaris_sarpras' : sarprasKind === 'ruang' ? 'ruang_fasilitas_sarpras' : 'pemeliharaan_sarpras']
    : reportType === 'kehadiran'
      ? [attendanceKind === 'Siswa' ? 'absensi' : 'absensi_guru']
      : config.sources;
  const loading = activeSources.some((name) => sources[name]?.loading !== false);
  const errors = activeSources.filter((name) => Boolean(sources[name]?.error));
  const kelasRows = rowsFor('kelas');
  const kelasName = (item: Row) => {
    if (item.kelas) return String(item.kelas);
    const found = kelasRows.find((kelas) => kelas.id === item.kelasId);
    return String(found?.namaKelas || 'Belum ditentukan');
  };

  const rawRows = useMemo<Row[]>(() => {
    switch (reportType) {
      case 'data-siswa':
        return rowsFor('siswa').map((item) => ({ ...item, kelasLabel: kelasName(item) }));
      case 'kehadiran':
        return attendanceKind === 'Siswa'
          ? rowsFor('absensi').map((item) => ({ ...item, nama: item.namaSiswa || item.nama || '—', identitas: item.nisn || '—', kelasLabel: item.kelas || item.kelasId || '—', waktuMasuk: timeLabel(item.waktuScan), waktuPulang: '—' }))
          : rowsFor('absensi_guru').map((item) => ({ ...item, nama: item.namaGuru || '—', identitas: item.nip || '—', kelasLabel: item.catatan || '—', waktuMasuk: timeLabel(item.waktuMasuk), waktuPulang: timeLabel(item.waktuPulang) }));
      case 'pembelajaran':
        return rowsFor('jurnal');
      case 'kepegawaian':
        return rowsFor('guru').map((item) => ({ ...item, penugasan: Array.isArray(item.kelasDiampu) ? `${item.kelasDiampu.length} rombel` : '—' }));
      case 'sarpras':
        if (sarprasKind === 'inventaris') return rowsFor('inventaris_sarpras');
        if (sarprasKind === 'ruang') return rowsFor('ruang_fasilitas_sarpras');
        return rowsFor('pemeliharaan_sarpras');
      case 'administrasi':
        return rowsFor('pengumuman_sekolah').map((item) => ({
          ...item,
          sasaranLabel: Array.isArray(item.sasaran) ? item.sasaran.map((role: string) => role === 'kepsek' ? 'Kepala Sekolah' : role === 'guru' ? 'Guru' : role).join(', ') : '—',
          pembuat: item.createdByNama || '—',
          tanggal: dateLabel(item.createdAt),
        }));
      default: return [];
    }
    // rowsFor/kelasName berasal dari snapshot state; reportType dan sumber memicu render ulang.
  }, [reportType, attendanceKind, sarprasKind, sources, kelasRows]);

  const filteredRows = useMemo(() => rawRows.filter((item) => {
    const values = Object.values(item).map((value) => Array.isArray(value) ? value.join(' ') : String(value ?? '')).join(' ').toLowerCase();
    if (search.trim() && !values.includes(search.trim().toLowerCase())) return false;
    if (reportType === 'kehadiran') {
      const date = String(item.tanggal || '');
      if (month && !date.startsWith(month)) return false;
    }
    if (reportType === 'pembelajaran') {
      const date = String(item.tanggal || '');
      if (month && !date.startsWith(month)) return false;
    }
    if (reportType === 'administrasi') {
      const date = dateValue(item.createdAt);
      if (month && (!date || localDateKey(date).slice(0, 7) !== month)) return false;
    }
    if (reportType === 'data-siswa' && schoolYear !== 'Semua' && String(item.tahunAjaran || '') !== schoolYear) return false;
    return true;
  }), [rawRows, search, month, schoolYear, reportType]);

  const columns: Column[] = useMemo(() => {
    if (reportType === 'sarpras') {
      if (sarprasKind === 'inventaris') return [
        { key: 'no', label: 'No.' }, { key: 'kodeInventaris', label: 'Kode' }, { key: 'namaBarang', label: 'Nama Barang' },
        { key: 'kategori', label: 'Kategori' }, { key: 'jumlah', label: 'Jumlah' }, { key: 'satuan', label: 'Satuan' },
        { key: 'kondisi', label: 'Kondisi' }, { key: 'lokasi', label: 'Lokasi' },
      ];
      if (sarprasKind === 'ruang') return [
        { key: 'no', label: 'No.' }, { key: 'kodeRuang', label: 'Kode' }, { key: 'namaRuang', label: 'Nama Ruang' },
        { key: 'jenisRuang', label: 'Jenis Ruang' }, { key: 'lokasiGedung', label: 'Lokasi' },
        { key: 'kapasitas', label: 'Kapasitas' }, { key: 'kondisi', label: 'Kondisi' }, { key: 'statusPenggunaan', label: 'Status' },
      ];
      return [
        { key: 'no', label: 'No.' }, { key: 'kodeLaporan', label: 'Kode Laporan' }, { key: 'namaAset', label: 'Nama Aset' },
        { key: 'jenisAset', label: 'Jenis Aset' }, { key: 'kategoriKerusakan', label: 'Kategori Kerusakan' },
        { key: 'prioritas', label: 'Prioritas' }, { key: 'status', label: 'Status' }, { key: 'tanggalLaporan', label: 'Tanggal' },
        { key: 'biaya', label: 'Biaya (Rp)' },
      ];
    }
    return config.columns;
  }, [reportType, sarprasKind, config]);

  const attendanceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRows.forEach((row) => { const key = String(row.status || 'Tidak diketahui'); counts[key] = (counts[key] || 0) + 1; });
    return counts;
  }, [filteredRows]);

  const stats = useMemo(() => {
    if (reportType === 'data-siswa') return [
      { label: 'Total Siswa', value: filteredRows.length },
      { label: 'Aktif', value: filteredRows.filter((r) => r.status === 'Aktif').length },
      { label: 'Lulus', value: filteredRows.filter((r) => r.status === 'Lulus').length },
      { label: 'Rombel Terdata', value: new Set(filteredRows.map((r) => kelasName(r))).size },
    ];
    if (reportType === 'kehadiran') return [
      { label: attendanceKind === 'Siswa' ? 'Catatan Absensi Siswa' : 'Catatan Absensi Guru', value: filteredRows.length },
      { label: 'Hadir', value: attendanceCounts.Hadir || 0 },
      { label: 'Izin / Sakit', value: (attendanceCounts.Izin || 0) + (attendanceCounts.Sakit || 0) },
      { label: 'Alpa', value: attendanceCounts.Alpa || 0 },
    ];
    if (reportType === 'pembelajaran') return [
      { label: 'Total Jurnal', value: filteredRows.length },
      { label: 'Dikirim', value: filteredRows.filter((r) => r.status === 'Dikirim').length },
      { label: 'Disetujui', value: filteredRows.filter((r) => r.status === 'Disetujui').length },
      { label: 'Perlu Perbaikan', value: filteredRows.filter((r) => r.status === 'Perlu Perbaikan').length },
    ];
    if (reportType === 'kepegawaian') return [
      { label: 'Total Pegawai', value: filteredRows.length },
      { label: 'Guru Mapel', value: filteredRows.filter((r) => String(r.jabatan || '').toLowerCase().includes('guru')).length },
      { label: 'Wali Kelas', value: filteredRows.filter((r) => String(r.jabatan || '').toLowerCase().includes('wali')).length },
      { label: 'Penugasan Tercatat', value: filteredRows.filter((r) => Array.isArray(r.kelasDiampu) && r.kelasDiampu.length > 0).length },
    ];
    if (reportType === 'sarpras') {
      if (sarprasKind === 'inventaris') return [
        { label: 'Jenis Inventaris', value: filteredRows.length },
        { label: 'Total Unit', value: filteredRows.reduce((sum, r) => sum + (Number(r.jumlah) || 0), 0) },
        { label: 'Kondisi Baik', value: filteredRows.filter((r) => r.kondisi === 'Baik').length },
        { label: 'Perlu Perhatian', value: filteredRows.filter((r) => r.kondisi !== 'Baik').length },
      ];
      if (sarprasKind === 'ruang') return [
        { label: 'Total Ruang', value: filteredRows.length },
        { label: 'Kapasitas Total', value: filteredRows.reduce((sum, r) => sum + (Number(r.kapasitas) || 0), 0) },
        { label: 'Kondisi Baik', value: filteredRows.filter((r) => r.kondisi === 'Baik').length },
        { label: 'Perlu Perhatian', value: filteredRows.filter((r) => r.kondisi !== 'Baik').length },
      ];
      return [
        { label: 'Total Laporan', value: filteredRows.length },
        { label: 'Dilaporkan', value: filteredRows.filter((r) => r.status === 'Dilaporkan').length },
        { label: 'Dalam Proses', value: filteredRows.filter((r) => ['Diproses', 'Dalam Proses'].includes(String(r.status))).length },
        { label: 'Selesai', value: filteredRows.filter((r) => r.status === 'Selesai').length },
      ];
    }
    return [
      { label: 'Total Pengumuman', value: filteredRows.length },
      { label: 'Terbit', value: filteredRows.filter((r) => r.status === 'Terbit').length },
      { label: 'Draft', value: filteredRows.filter((r) => r.status === 'Draft').length },
      { label: 'Prioritas Penting', value: filteredRows.filter((r) => r.prioritas === 'Penting').length },
    ];
  }, [reportType, filteredRows, attendanceKind, attendanceCounts, sarprasKind, kelasRows]);

  const schoolYears = useMemo(() => Array.from(new Set(rowsFor('siswa').map((r) => String(r.tahunAjaran || '')).filter(Boolean))).sort().reverse(), [sources.siswa?.rows]);
  const goBackPath = `${basePath}/laporan`;

  const displayValue = (row: Row, key: string): string => {
    if (key === 'no') return '';
    if (key === 'tanggal' || key === 'tanggalLaporan') return dateLabel(row[key]);
    if (key === 'waktuMasuk' || key === 'waktuPulang') return asText(row[key]);
    if (key === 'kelas') return asText(row.kelasLabel || kelasName(row));
    if (key === 'penugasan') return asText(row.penugasan);
    if (key === 'sasaranLabel' || key === 'pembuat') return asText(row[key]);
    if (key === 'biaya') return row.biaya === undefined ? '—' : Number(row.biaya || 0).toLocaleString('id-ID');
    if (Array.isArray(row[key])) return row[key].join(', ');
    return asText(row[key]);
  };

  const handleExportExcel = () => {
    const table = [
      columns.map((column) => column.label),
      ...filteredRows.map((row, index) => columns.map((column) => column.key === 'no' ? index + 1 : displayValue(row, column.key))),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(table);
    worksheet['!cols'] = columns.map((column) => ({ wch: Math.max(12, Math.min(30, column.label.length + 5)) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan');
    XLSX.writeFile(workbook, `${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 text-slate-700">
      <style>{`@media print { @page { size: A4 landscape; margin: 12mm; } body { background:#fff !important; } .no-print { display:none !important; } .report-print { box-shadow:none !important; border-color:#cbd5e1 !important; } .report-table { font-size:9px !important; } .print-only { display:block !important; } .report-hero { background:#fff !important; color:#0f172a !important; box-shadow:none !important; padding:0 0 12px !important; } .report-hero p { color:#334155 !important; } .report-table thead { display:table-header-group; } .report-table tr { break-inside:avoid; } } .print-only { display:none; }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to={goBackPath} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#155EEF]"><Icon name="back" /> Kembali ke Ringkasan Laporan</Link>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">PUSAT LAPORAN SEKOLAH</span>
      </div>

      <div className="print-only mb-5 border-b-2 border-slate-800 pb-3 text-center text-slate-900">
        <h2 className="text-lg font-extrabold uppercase">{schoolIdentity.namaSekolah || 'NAMA SEKOLAH'}</h2>
        <p className="mt-1 text-xs">{schoolIdentity.alamat || 'Alamat sekolah belum diatur'}{schoolIdentity.npsn ? ` · NPSN ${schoolIdentity.npsn}` : ''}</p>
      </div>
      <section className="report-print report-hero rounded-3xl bg-gradient-to-br from-[#082B62] via-[#10458A] to-[#1766C4] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold tracking-[0.16em] text-blue-200">LAPORAN RESMI SEKOLAH</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{config.title}</h1><p className="mt-2 max-w-2xl text-sm text-blue-100">{config.description}</p><p className="mt-3 text-xs text-blue-200">Dicetak: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}</p></div>
          <div className="no-print flex flex-wrap gap-2"><button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-[#10458A] hover:bg-blue-50"><Icon name="print" /> Cetak</button><button onClick={handleExportExcel} disabled={loading || errors.length > 0 || filteredRows.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"><Icon name="download" /> Unduh Excel</button></div>
        </div>
      </section>

      {errors.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Sebagian sumber data tidak dapat dibaca: {errors.join(', ')}. Periksa koneksi dan Firestore Rules. Nilai yang gagal dimuat tidak dihitung sebagai nol.</div>}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((item, index) => <article key={item.label} className="report-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><p className="text-xs font-semibold text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-extrabold text-[#082B62] sm:text-3xl">{loading ? '…' : errors.length > 0 ? '—' : item.value.toLocaleString('id-ID')}</p><span className={`mt-2 inline-block h-1 w-10 rounded-full ${['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500'][index]}`} /></article>)}
      </section>

      <section className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(reportType === 'kehadiran' || reportType === 'pembelajaran' || reportType === 'administrasi') && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Periode Bulan</span><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>}
            {reportType === 'data-siswa' && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Tahun Ajaran</span><select value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="Semua">Semua Tahun Ajaran</option>{schoolYears.map((year) => <option key={year}>{year}</option>)}</select></label>}
            {reportType === 'kehadiran' && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Jenis Kehadiran</span><select value={attendanceKind} onChange={(e) => setAttendanceKind(e.target.value as 'Siswa' | 'Guru')} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>Siswa</option><option>Guru</option></select></label>}
            {reportType === 'sarpras' && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Kategori Sarpras</span><select value={sarprasKind} onChange={(e) => setSarprasKind(e.target.value as typeof sarprasKind)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="inventaris">Data Inventaris</option><option value="ruang">Ruang dan Fasilitas</option><option value="pemeliharaan">Pemeliharaan dan Perbaikan</option></select></label>}
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Pencarian</span><div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari data laporan…" className="w-full border-0 py-2.5 text-sm outline-none" /></div></label>
          </div>
          <button onClick={() => { setSearch(''); setMonth(currentMonth()); setSchoolYear('Semua'); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"><Icon name="refresh" /> Reset Filter</button>
        </div>
      </section>

      {reportType === 'administrasi' && !loading && <section className="grid grid-cols-1 gap-4 md:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-[#082B62]">Status Tahun Ajaran</h2><p className="mt-1 text-xs text-slate-500">Data dari pengaturan tahun ajaran sekolah.</p><p className="mt-4 text-3xl font-extrabold text-[#082B62]">{rowsFor('tahun_ajaran').length.toLocaleString('id-ID')}</p><p className="text-xs text-slate-400">Tahun ajaran aktif</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-[#082B62]">Status Jurnal Mengajar</h2><p className="mt-1 text-xs text-slate-500">Ringkasan administrasi tindak lanjut jurnal.</p><div className="mt-4 flex flex-wrap gap-4 text-sm"><span>Dikirim: <b>{rowsFor('jurnal').filter((r) => r.status === 'Dikirim').length}</b></span><span>Disetujui: <b>{rowsFor('jurnal').filter((r) => r.status === 'Disetujui').length}</b></span><span>Perlu Perbaikan: <b>{rowsFor('jurnal').filter((r) => r.status === 'Perlu Perbaikan').length}</b></span></div></article></section>}

      <section className="report-print overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 sm:p-5"><div><h2 className="font-extrabold text-[#082B62]">Rincian {config.title}</h2><p className="mt-1 text-xs text-slate-500">{loading ? 'Memuat data dari Firestore…' : `${filteredRows.length.toLocaleString('id-ID')} baris data ditampilkan`}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{reportType === 'sarpras' ? LABEL_SARPRAS[sarprasKind] : 'Data tersimpan'}</span></div>
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Sedang mengambil data laporan…</div> : filteredRows.length === 0 ? <div className="p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon name="file" /></div><p className="mt-3 font-bold text-slate-700">{errors.length > 0 ? 'Data laporan belum dapat dibaca' : 'Belum ada data untuk ditampilkan'}</p><p className="mt-1 text-sm text-slate-500">{errors.length > 0 ? 'Periksa koneksi dan hak akses Firestore.' : 'Coba ubah periode atau filter pencarian.'}</p></div> : <div className="overflow-x-auto"><table className="report-table min-w-full border-collapse text-left text-xs sm:text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 font-extrabold">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredRows.map((row, index) => <tr key={row.id} className="hover:bg-slate-50/70">{columns.map((column) => <td key={column.key} className="whitespace-nowrap px-4 py-3 text-slate-700">{column.key === 'no' ? index + 1 : displayValue(row, column.key)}</td>)}</tr>)}</tbody></table></div>}
      </section>

      <div className="print-only mt-10 ml-auto w-64 text-center text-sm text-slate-800">
        <p>Mengetahui,</p><p className="font-semibold">Kepala Sekolah</p><div className="h-16" /><p className="font-bold underline">{schoolIdentity.kepalaSekolah || '........................................'}</p>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900"><div><p className="font-bold">Laporan bersifat baca-saja</p><p className="mt-1 text-xs text-blue-700">Laporan mengambil data dari modul sumber dan tidak mengubah data asli. Pastikan filter periode sesuai sebelum mencetak atau mengunduh.</p></div><Link to={goBackPath} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100">Kembali ke Ringkasan</Link></div>
    </div>
  );
}
