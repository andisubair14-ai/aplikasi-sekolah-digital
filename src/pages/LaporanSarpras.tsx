import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

type InventarisRow = { id: string; kodeInventaris: string; namaBarang: string; kategori: string; jumlah: number; satuan: string; kondisi: string; tahunPerolehan: string; lokasi: string; createdAt?: unknown };
type RuangRow = { id: string; kodeRuang: string; namaRuang: string; jenisRuang: string; lokasiGedung: string; kapasitas: number; kondisi: string; statusPenggunaan: string; createdAt?: unknown };
type PemeliharaanRow = { id: string; kodeLaporan: string; namaAset: string; jenisAset: string; lokasi: string; kategoriKerusakan: string; prioritas: string; status: string; tanggalLaporan: string; biaya: number; createdAt?: unknown };
type KategoriLaporan = 'Semua' | 'Inventaris' | 'Ruang dan Fasilitas' | 'Pemeliharaan';

function getYear(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 4);
  if (value instanceof Date) return String(value.getFullYear());
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear());
  }
  return '';
}

function csvValue(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function Icon({ name, className = 'h-5 w-5' }: { name: 'back' | 'download' | 'print' | 'file' | 'box' | 'building' | 'wrench'; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  switch (name) {
    case 'back': return <svg {...common}><path d="m15 18-6-6 6-6M9 12h12" /></svg>;
    case 'download': return <svg {...common}><path d="M12 3v12m-5-5 5 5 5-5M4 19v2h16v-2" /></svg>;
    case 'print': return <svg {...common}><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" /></svg>;
    case 'file': return <svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h8" /></svg>;
    case 'box': return <svg {...common}><path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" /><path d="m3.8 7.7 8.2 4.4 8.2-4.4M12 12.1V21" /></svg>;
    case 'building': return <svg {...common}><path d="M3 21h18M5 21V5l7-2 7 2v16M9 8h1m4 0h1M9 12h1m4 0h1M9 16h1m4 0h1M11 21v-3h2v3" /></svg>;
    case 'wrench': return <svg {...common}><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3.5 17.5a2.1 2.1 0 0 0 3 3l4.8-4.8a5 5 0 0 0 6.4-6.4l-3 3-3.3-3.3 3.3-2.7Z" /></svg>;
    default: return null;
  }
}

export default function LaporanSarpras() {
  const [inventaris, setInventaris] = useState<InventarisRow[]>([]);
  const [ruangan, setRuangan] = useState<RuangRow[]>([]);
  const [pemeliharaan, setPemeliharaan] = useState<PemeliharaanRow[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [kategori, setKategori] = useState<KategoriLaporan>('Semua');
  const [tahun, setTahun] = useState('Semua Tahun');
  const [search, setSearch] = useState('');
  const [exportMessage, setExportMessage] = useState('');

  useEffect(() => {
    const unsubInventory = onSnapshot(collection(db, 'inventaris_sarpras'), (snapshot) => {
      setInventaris(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as InventarisRow)));
      setLoadingInventory(false);
    }, (error) => { console.error('Gagal memuat laporan inventaris:', error); setErrors((old) => [...old.filter((x) => !x.startsWith('Inventaris:')), 'Inventaris: data tidak dapat dibaca. Periksa aturan Firestore.']); setLoadingInventory(false); });
    const unsubRooms = onSnapshot(collection(db, 'ruang_fasilitas_sarpras'), (snapshot) => {
      setRuangan(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as RuangRow)));
      setLoadingRooms(false);
    }, (error) => { console.error('Gagal memuat laporan ruang:', error); setErrors((old) => [...old.filter((x) => !x.startsWith('Ruang:')), 'Ruang: data tidak dapat dibaca. Periksa aturan Firestore.']); setLoadingRooms(false); });
    const unsubMaintenance = onSnapshot(collection(db, 'pemeliharaan_sarpras'), (snapshot) => {
      setPemeliharaan(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as PemeliharaanRow)));
      setLoadingMaintenance(false);
    }, (error) => { console.error('Gagal memuat laporan pemeliharaan:', error); setErrors((old) => [...old.filter((x) => !x.startsWith('Pemeliharaan:')), 'Pemeliharaan: data tidak dapat dibaca. Periksa aturan Firestore.']); setLoadingMaintenance(false); });
    return () => { unsubInventory(); unsubRooms(); unsubMaintenance(); };
  }, []);

  const loading = loadingInventory || loadingRooms || loadingMaintenance;
  const tahunOptions = useMemo(() => {
    const values = new Set<string>();
    inventaris.forEach((item) => { if (item.tahunPerolehan) values.add(String(item.tahunPerolehan).slice(0, 4)); });
    ruangan.forEach((item) => { const value = getYear(item.createdAt); if (value) values.add(value); });
    pemeliharaan.forEach((item) => { const value = item.tanggalLaporan?.slice(0, 4) || getYear(item.createdAt); if (value) values.add(value); });
    return [...values].filter((value) => /^\d{4}$/.test(value)).sort((a, b) => b.localeCompare(a));
  }, [inventaris, ruangan, pemeliharaan]);

  const inventarisFiltered = useMemo(() => inventaris.filter((item) => {
    const keyword = search.trim().toLocaleLowerCase('id');
    const cocokKata = !keyword || [item.kodeInventaris, item.namaBarang, item.kategori, item.lokasi].some((value) => String(value || '').toLocaleLowerCase('id').includes(keyword));
    return cocokKata && (tahun === 'Semua Tahun' || String(item.tahunPerolehan || getYear(item.createdAt)) === tahun);
  }), [inventaris, search, tahun]);
  const ruanganFiltered = useMemo(() => ruangan.filter((item) => {
    const keyword = search.trim().toLocaleLowerCase('id');
    const cocokKata = !keyword || [item.kodeRuang, item.namaRuang, item.jenisRuang, item.lokasiGedung].some((value) => String(value || '').toLocaleLowerCase('id').includes(keyword));
    return cocokKata && (tahun === 'Semua Tahun' || getYear(item.createdAt) === tahun);
  }), [ruangan, search, tahun]);
  const maintenanceFiltered = useMemo(() => pemeliharaan.filter((item) => {
    const keyword = search.trim().toLocaleLowerCase('id');
    const cocokKata = !keyword || [item.kodeLaporan, item.namaAset, item.lokasi, item.kategoriKerusakan, item.status].some((value) => String(value || '').toLocaleLowerCase('id').includes(keyword));
    return cocokKata && (tahun === 'Semua Tahun' || String(item.tanggalLaporan || getYear(item.createdAt)).slice(0, 4) === tahun);
  }), [pemeliharaan, search, tahun]);

  const totalUnit = inventarisFiltered.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
  const perluPerhatian = inventarisFiltered.filter((item) => item.kondisi !== 'Baik').length;
  const roomsAttention = ruanganFiltered.filter((item) => item.kondisi !== 'Baik').length;
  const maintenancePending = maintenanceFiltered.filter((item) => !['Selesai', 'Tidak Dapat Diperbaiki'].includes(item.status)).length;
  const totalBiaya = maintenanceFiltered.reduce((sum, item) => sum + (Number(item.biaya) || 0), 0);

  const exportCSV = () => {
    const rows: unknown[][] = [];
    if (kategori === 'Semua' || kategori === 'Inventaris') {
      rows.push(['LAPORAN DATA INVENTARIS'], ['Kode', 'Nama Barang', 'Kategori', 'Jumlah', 'Satuan', 'Kondisi', 'Tahun Perolehan', 'Lokasi']);
      inventarisFiltered.forEach((item) => rows.push([item.kodeInventaris, item.namaBarang, item.kategori, item.jumlah, item.satuan, item.kondisi, item.tahunPerolehan, item.lokasi]));
      rows.push([]);
    }
    if (kategori === 'Semua' || kategori === 'Ruang dan Fasilitas') {
      rows.push(['LAPORAN RUANG DAN FASILITAS'], ['Kode', 'Nama Ruang', 'Jenis Ruang', 'Lokasi', 'Kapasitas', 'Kondisi', 'Status Penggunaan']);
      ruanganFiltered.forEach((item) => rows.push([item.kodeRuang, item.namaRuang, item.jenisRuang, item.lokasiGedung, item.kapasitas, item.kondisi, item.statusPenggunaan]));
      rows.push([]);
    }
    if (kategori === 'Semua' || kategori === 'Pemeliharaan') {
      rows.push(['LAPORAN PEMELIHARAAN DAN PERBAIKAN'], ['Kode Laporan', 'Nama Aset', 'Jenis Aset', 'Lokasi', 'Kategori Kerusakan', 'Prioritas', 'Status', 'Tanggal Laporan', 'Biaya']);
      maintenanceFiltered.forEach((item) => rows.push([item.kodeLaporan, item.namaAset, item.jenisAset, item.lokasi, item.kategoriKerusakan, item.prioritas, item.status, item.tanggalLaporan, item.biaya]));
    }
    const content = '\uFEFF' + rows.map((row) => row.map(csvValue).join(';')).join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `Laporan_Sarpras_${tahun === 'Semua Tahun' ? 'Semua_Tahun' : tahun}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    setExportMessage('File CSV berhasil disiapkan untuk diunduh.');
  };

  const jumlahBaris = (kategori === 'Inventaris' ? inventarisFiltered.length : kategori === 'Ruang dan Fasilitas' ? ruanganFiltered.length : kategori === 'Pemeliharaan' ? maintenanceFiltered.length : inventarisFiltered.length + ruanganFiltered.length + maintenanceFiltered.length);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <style>{`@media print { @page { size: A4 landscape; margin: 12mm; } body { background: #fff !important; } .no-print { display: none !important; } .print-card { box-shadow: none !important; border: 1px solid #cbd5e1 !important; break-inside: avoid; } .print-table { font-size: 9pt !important; } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3"><Link to="/admin/sarpras" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#155EEF]"><Icon name="back" className="h-4 w-4" /> Kembali ke Ringkasan Sarpras</Link><span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">MODUL 04 · LAPORAN SARPRAS</span></div>
      <section className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-br from-[#082B62] via-[#124A91] to-[#1767C7] p-6 text-white shadow-lg sm:flex-row sm:items-center sm:p-8"><div><p className="text-xs font-bold tracking-[0.16em] text-blue-200">MONITORING ASET DAN FASILITAS SEKOLAH</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Laporan Sarpras</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">Rekap data inventaris, ruang dan fasilitas, serta pemeliharaan berdasarkan data yang tersimpan di Firestore.</p></div><div className="no-print flex flex-wrap gap-2"><button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#124A91] hover:bg-blue-50"><Icon name="print" /> Cetak Laporan</button><button onClick={exportCSV} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-extrabold text-white hover:bg-white/20"><Icon name="download" /> Ekspor CSV</button></div></section>
      <div className="hidden print:block"><h2 className="text-xl font-extrabold text-[#082B62]">LAPORAN SARANA DAN PRASARANA SEKOLAH</h2><p className="mt-1 text-sm text-slate-600">Periode: {tahun} · Dicetak: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}</p></div>
      <section className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_260px]"><label><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Jenis Laporan</span><select value={kategori} onChange={(e) => setKategori(e.target.value as KategoriLaporan)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"><option>Semua</option><option>Inventaris</option><option>Ruang dan Fasilitas</option><option>Pemeliharaan</option></select></label><label><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Tahun</span><select value={tahun} onChange={(e) => setTahun(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"><option>Semua Tahun</option>{tahunOptions.map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Pencarian</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kode, atau lokasi..." className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400" /></label></div></section>
      {exportMessage && <div className="no-print rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{exportMessage}</div>}
      {errors.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Mengumpulkan data laporan dari Firebase...</div> : <>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
          { label: 'Jenis Inventaris', value: inventarisFiltered.length, note: `${totalUnit.toLocaleString('id-ID')} unit tercatat`, icon: 'box' as const },
          { label: 'Ruang dan Fasilitas', value: ruanganFiltered.length, note: `${roomsAttention} ruang perlu perhatian`, icon: 'building' as const },
          { label: 'Perlu Tindak Lanjut', value: maintenancePending, note: 'Laporan pemeliharaan aktif', icon: 'wrench' as const },
          { label: 'Biaya Pemeliharaan', value: `Rp ${totalBiaya.toLocaleString('id-ID')}`, note: `${maintenanceFiltered.length} catatan pemeliharaan`, icon: 'file' as const },
        ].map((card) => <article key={card.label} className="print-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-500">{card.label}</p><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon name={card.icon} /></span></div><p className="mt-3 text-2xl font-extrabold text-[#082B62]">{card.value}</p><p className="mt-1 text-xs text-slate-400">{card.note}</p></article>)}</section>
        <div className="space-y-5">
          {(kategori === 'Semua' || kategori === 'Inventaris') && <section className="print-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold text-[#082B62]">A. Rekap Data Inventaris</h2><p className="mt-1 text-xs text-slate-500">{inventarisFiltered.length} jenis barang · {totalUnit.toLocaleString('id-ID')} unit · {perluPerhatian} jenis barang perlu perhatian</p></div><div className="overflow-x-auto"><table className="print-table min-w-[760px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">No.</th><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Nama Barang</th><th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Jumlah</th><th className="px-4 py-3">Kondisi</th><th className="px-4 py-3">Tahun</th><th className="px-4 py-3">Lokasi</th></tr></thead><tbody className="divide-y divide-slate-100">{inventarisFiltered.map((item, index) => <tr key={item.id}><td className="px-4 py-3">{index + 1}</td><td className="px-4 py-3 font-semibold text-blue-700">{item.kodeInventaris}</td><td className="px-4 py-3 font-medium text-slate-800">{item.namaBarang}</td><td className="px-4 py-3">{item.kategori}</td><td className="px-4 py-3">{item.jumlah} {item.satuan}</td><td className="px-4 py-3">{item.kondisi}</td><td className="px-4 py-3">{item.tahunPerolehan}</td><td className="px-4 py-3">{item.lokasi}</td></tr>)}</tbody></table></div>{inventarisFiltered.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">Belum ada data inventaris pada filter ini.</p>}</section>}
          {(kategori === 'Semua' || kategori === 'Ruang dan Fasilitas') && <section className="print-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold text-[#082B62]">B. Rekap Ruang dan Fasilitas</h2><p className="mt-1 text-xs text-slate-500">{ruanganFiltered.length} ruang dan fasilitas · {roomsAttention} perlu perhatian</p></div><div className="overflow-x-auto"><table className="print-table min-w-[700px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">No.</th><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Nama Ruang</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Lokasi</th><th className="px-4 py-3">Kapasitas</th><th className="px-4 py-3">Kondisi</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{ruanganFiltered.map((item, index) => <tr key={item.id}><td className="px-4 py-3">{index + 1}</td><td className="px-4 py-3 font-semibold text-cyan-700">{item.kodeRuang}</td><td className="px-4 py-3 font-medium text-slate-800">{item.namaRuang}</td><td className="px-4 py-3">{item.jenisRuang}</td><td className="px-4 py-3">{item.lokasiGedung}</td><td className="px-4 py-3">{item.kapasitas || '—'}</td><td className="px-4 py-3">{item.kondisi}</td><td className="px-4 py-3">{item.statusPenggunaan}</td></tr>)}</tbody></table></div>{ruanganFiltered.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">Belum ada data ruang pada filter ini.</p>}</section>}
          {(kategori === 'Semua' || kategori === 'Pemeliharaan') && <section className="print-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold text-[#082B62]">C. Rekap Pemeliharaan dan Perbaikan</h2><p className="mt-1 text-xs text-slate-500">{maintenanceFiltered.length} laporan · {maintenancePending} perlu tindak lanjut · total biaya Rp {totalBiaya.toLocaleString('id-ID')}</p></div><div className="overflow-x-auto"><table className="print-table min-w-[780px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">No.</th><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Aset</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Prioritas</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Biaya</th></tr></thead><tbody className="divide-y divide-slate-100">{maintenanceFiltered.map((item, index) => <tr key={item.id}><td className="px-4 py-3">{index + 1}</td><td className="px-4 py-3 font-semibold text-amber-700">{item.kodeLaporan}</td><td className="px-4 py-3"><p className="font-medium text-slate-800">{item.namaAset}</p><p className="text-xs text-slate-500">{item.lokasi}</p></td><td className="px-4 py-3">{item.tanggalLaporan}</td><td className="px-4 py-3">{item.prioritas}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3">{Number(item.biaya) ? `Rp ${Number(item.biaya).toLocaleString('id-ID')}` : '—'}</td></tr>)}</tbody></table></div>{maintenanceFiltered.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">Belum ada data pemeliharaan pada filter ini.</p>}</section>}
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Jumlah baris data sesuai filter: {jumlahBaris.toLocaleString('id-ID')}</span><span>Sumber: Data Inventaris, Ruang dan Fasilitas, serta Pemeliharaan Sarpras.</span></div>
      </>}
    </div>
  );
}
