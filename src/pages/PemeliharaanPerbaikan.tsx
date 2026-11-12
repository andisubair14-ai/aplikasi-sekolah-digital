import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type StatusPemeliharaan = 'Dilaporkan' | 'Dijadwalkan' | 'Dalam Proses' | 'Selesai' | 'Tidak Dapat Diperbaiki';
type Prioritas = 'Rendah' | 'Sedang' | 'Tinggi' | 'Darurat';
type AssetOption = { id: string; label: string; kind: 'Inventaris' | 'Ruang/Fasilitas'; nama: string; lokasi: string };
type PemeliharaanItem = {
  id: string; kodeLaporan: string; jenisAset: string; assetId: string; namaAset: string; lokasi: string;
  kategoriKerusakan: string; uraian: string; prioritas: Prioritas; status: StatusPemeliharaan;
  tanggalLaporan: string; biaya: number; tindakan: string; pelaksana: string; tanggalSelesai: string; catatan: string;
};
type FormState = Omit<PemeliharaanItem, 'id' | 'kodeLaporan'>;

const STATUS_OPTIONS: StatusPemeliharaan[] = ['Dilaporkan', 'Dijadwalkan', 'Dalam Proses', 'Selesai', 'Tidak Dapat Diperbaiki'];
const FORM_AWAL: FormState = {
  jenisAset: 'Inventaris', assetId: '', namaAset: '', lokasi: '', kategoriKerusakan: 'Kerusakan umum', uraian: '',
  prioritas: 'Sedang', status: 'Dilaporkan', tanggalLaporan: new Date().toISOString().slice(0, 10),
  biaya: 0, tindakan: '', pelaksana: '', tanggalSelesai: '', catatan: '',
};

function Icon({ name, className = 'h-5 w-5' }: { name: 'back' | 'plus' | 'search' | 'wrench' | 'edit' | 'trash' | 'close' | 'save'; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  switch (name) {
    case 'back': return <svg {...common}><path d="m15 18-6-6 6-6M9 12h12" /></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'search': return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
    case 'wrench': return <svg {...common}><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3.5 17.5a2.1 2.1 0 0 0 3 3l4.8-4.8a5 5 0 0 0 6.4-6.4l-3 3-3.3-3.3 3.3-2.7Z" /></svg>;
    case 'edit': return <svg {...common}><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /></svg>;
    case 'trash': return <svg {...common}><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>;
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'save': return <svg {...common}><path d="M5 3h12l4 4v14H3V3h2ZM7 3v6h10V3M7 21v-8h10v8" /></svg>;
    default: return null;
  }
}

function formatTanggal(value?: string) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export default function PemeliharaanPerbaikan() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const [items, setItems] = useState<PemeliharaanItem[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua Status');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_AWAL);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const unsubscribeItems = onSnapshot(collection(db, 'pemeliharaan_sarpras'), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as PemeliharaanItem));
      data.sort((a, b) => (b.tanggalLaporan || '').localeCompare(a.tanggalLaporan || ''));
      setItems(data); setLoading(false); setLoadError('');
    }, (error) => { console.error('Gagal membaca pemeliharaan:', error); setLoadError('Data pemeliharaan belum dapat dibaca. Periksa aturan akses Firestore.'); setLoading(false); });

    const unsubscribeInventory = onSnapshot(collection(db, 'inventaris_sarpras'), (snapshot) => {
      const inventory = snapshot.docs.map((item) => {
        const data = item.data();
        return { id: item.id, label: `${data.namaBarang || 'Barang'} · ${data.kodeInventaris || item.id}`, kind: 'Inventaris' as const, nama: String(data.namaBarang || ''), lokasi: String(data.lokasi || '') };
      });
      setAssets((previous) => [...inventory, ...previous.filter((asset) => asset.kind === 'Ruang/Fasilitas')]);
    }, (error) => console.error('Gagal membaca referensi inventaris:', error));

    const unsubscribeRooms = onSnapshot(collection(db, 'ruang_fasilitas_sarpras'), (snapshot) => {
      const rooms = snapshot.docs.map((item) => {
        const data = item.data();
        return { id: item.id, label: `${data.namaRuang || 'Ruang'} · ${data.kodeRuang || item.id}`, kind: 'Ruang/Fasilitas' as const, nama: String(data.namaRuang || ''), lokasi: String(data.lokasiGedung || '') };
      });
      setAssets((previous) => [...previous.filter((asset) => asset.kind === 'Inventaris'), ...rooms]);
    }, (error) => console.error('Gagal membaca referensi ruang:', error));

    return () => { unsubscribeItems(); unsubscribeInventory(); unsubscribeRooms(); };
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('id');
    return items.filter((item) => {
      const matchSearch = !keyword || [item.kodeLaporan, item.namaAset, item.lokasi, item.kategoriKerusakan, item.uraian]
        .some((value) => String(value || '').toLocaleLowerCase('id').includes(keyword));
      return matchSearch && (filterStatus === 'Semua Status' || item.status === filterStatus);
    });
  }, [items, search, filterStatus]);

  const pendingCount = items.filter((item) => !['Selesai', 'Tidak Dapat Diperbaiki'].includes(item.status)).length;
  const finishedCount = items.filter((item) => item.status === 'Selesai').length;
  const totalBiaya = items.reduce((sum, item) => sum + (Number(item.biaya) || 0), 0);

  const openAdd = () => { setEditingId(null); setForm(FORM_AWAL); setActionError(''); setSuccessMessage(''); setIsModalOpen(true); };
  const openEdit = (item: PemeliharaanItem) => {
    setEditingId(item.id);
    setForm({ jenisAset: item.jenisAset || 'Inventaris', assetId: item.assetId || '', namaAset: item.namaAset || '', lokasi: item.lokasi || '', kategoriKerusakan: item.kategoriKerusakan || 'Kerusakan umum', uraian: item.uraian || '', prioritas: item.prioritas || 'Sedang', status: item.status || 'Dilaporkan', tanggalLaporan: item.tanggalLaporan || FORM_AWAL.tanggalLaporan, biaya: Number(item.biaya) || 0, tindakan: item.tindakan || '', pelaksana: item.pelaksana || '', tanggalSelesai: item.tanggalSelesai || '', catatan: item.catatan || '' });
    setActionError(''); setSuccessMessage(''); setIsModalOpen(true);
  };

  const pilihAset = (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId && item.kind === form.jenisAset);
    setForm((current) => ({ ...current, assetId, namaAset: asset?.nama || current.namaAset, lokasi: asset?.lokasi || current.lokasi }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setActionError(''); setSuccessMessage('');
    if (!isAdmin) return;
    if (!form.namaAset.trim() || !form.uraian.trim() || !form.tanggalLaporan) { setActionError('Nama aset, uraian kerusakan, dan tanggal laporan wajib diisi.'); return; }
    const biaya = Number(form.biaya);
    if (!Number.isFinite(biaya) || biaya < 0 || biaya > 1000000000000) { setActionError('Biaya harus berupa angka nol atau lebih.'); return; }
    if (form.tanggalSelesai && form.tanggalSelesai < form.tanggalLaporan) { setActionError('Tanggal selesai tidak boleh lebih awal dari tanggal laporan.'); return; }
    setIsSaving(true);
    const uid = userData?.uid || '';
    const payload = {
      jenisAset: form.jenisAset, assetId: form.assetId, namaAset: form.namaAset.trim(), lokasi: form.lokasi.trim(),
      kategoriKerusakan: form.kategoriKerusakan, uraian: form.uraian.trim(), prioritas: form.prioritas, status: form.status,
      tanggalLaporan: form.tanggalLaporan, biaya, tindakan: form.tindakan.trim(), pelaksana: form.pelaksana.trim(),
      tanggalSelesai: form.tanggalSelesai, catatan: form.catatan.trim(), updatedAt: serverTimestamp(), updatedByUid: uid,
    };
    try {
      if (editingId) {
        await setDoc(doc(db, 'pemeliharaan_sarpras', editingId), payload, { merge: true });
        setSuccessMessage('Catatan pemeliharaan berhasil diperbarui.');
      } else {
        const newDoc = doc(collection(db, 'pemeliharaan_sarpras'));
        await setDoc(newDoc, { ...payload, kodeLaporan: `PM-${new Date().getFullYear()}-${newDoc.id.slice(0, 8).toUpperCase()}`, createdAt: serverTimestamp(), createdByUid: uid });
        setSuccessMessage('Laporan pemeliharaan berhasil dicatat.');
      }
      setIsModalOpen(false); setEditingId(null); setForm(FORM_AWAL);
    } catch (error) { console.error('Gagal menyimpan pemeliharaan:', error); setActionError('Data gagal disimpan. Periksa koneksi dan aturan akses Firestore.'); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (item: PemeliharaanItem) => {
    if (!isAdmin || !window.confirm(`Hapus laporan ${item.kodeLaporan} untuk ${item.namaAset}?`)) return;
    try { await deleteDoc(doc(db, 'pemeliharaan_sarpras', item.id)); setSuccessMessage(`Laporan ${item.kodeLaporan} berhasil dihapus.`); }
    catch (error) { console.error('Gagal menghapus laporan:', error); setActionError('Laporan gagal dihapus. Periksa hak akses Firestore.'); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/admin/sarpras" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#155EEF]"><Icon name="back" className="h-4 w-4" /> Kembali ke Ringkasan Sarpras</Link><span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">MODUL 03 · PEMELIHARAAN</span></div>
      <section className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-br from-[#082B62] via-[#124A91] to-[#1767C7] p-6 text-white shadow-lg sm:flex-row sm:items-center sm:p-8"><div><p className="text-xs font-bold tracking-[0.16em] text-blue-200">PENGENDALIAN KONDISI ASET SEKOLAH</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Pemeliharaan dan Perbaikan</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">Catat kerusakan, tentukan prioritas, pantau tindak lanjut, dan simpan riwayat biaya perbaikan aset sekolah.</p></div>{isAdmin && <button onClick={openAdd} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#124A91] shadow hover:bg-blue-50"><Icon name="plus" /> Catat Pemeliharaan</button>}</section>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[{ label: 'Perlu Tindak Lanjut', value: pendingCount, note: 'Belum selesai ditangani' }, { label: 'Selesai Ditangani', value: finishedCount, note: 'Laporan dengan status selesai' }, { label: 'Total Biaya Tercatat', value: `Rp ${totalBiaya.toLocaleString('id-ID')}`, note: 'Akumulasi biaya yang dicatat' }].map((card) => <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-extrabold text-[#082B62]">{card.value}</p><p className="mt-1 text-xs text-slate-400">{card.note}</p></article>)}</section>
      {successMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{successMessage}</div>}{actionError && !isModalOpen && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-extrabold text-[#082B62]">Riwayat Pemeliharaan</h2><p className="mt-1 text-sm text-slate-500">Pantau laporan dan tindak lanjut perbaikan aset.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari aset atau laporan..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 sm:w-64" /></div><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option>Semua Status</option>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></div></div>
        {loading ? <div className="p-12 text-center text-sm text-slate-500">Memuat riwayat pemeliharaan...</div> : loadError ? <div className="p-8 text-center text-sm text-red-600">{loadError}</div> : filteredItems.length === 0 ? <div className="p-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Icon name="wrench" className="h-7 w-7" /></div><h3 className="mt-4 font-bold text-slate-800">Belum ada catatan pemeliharaan</h3><p className="mt-1 text-sm text-slate-500">Catat laporan kerusakan atau kegiatan perawatan pertama.</p>{isAdmin && <button onClick={openAdd} className="mt-4 rounded-xl bg-[#155EEF] px-4 py-2.5 text-sm font-bold text-white">Catat Pemeliharaan</button>}</div> : <><div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-bold">Kode / Aset</th><th className="px-4 py-3 font-bold">Tanggal</th><th className="px-4 py-3 font-bold">Uraian</th><th className="px-4 py-3 font-bold">Prioritas</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Biaya</th>{isAdmin && <th className="px-5 py-3 text-right font-bold">Aksi</th>}</tr></thead><tbody className="divide-y divide-slate-100">{filteredItems.map((item) => <tr key={item.id} className="hover:bg-slate-50/80"><td className="px-5 py-4"><p className="font-bold text-slate-800">{item.namaAset}</p><p className="mt-1 text-xs font-semibold text-amber-700">{item.kodeLaporan}</p><p className="mt-1 text-xs text-slate-400">{item.lokasi || item.jenisAset}</p></td><td className="px-4 py-4 text-slate-600">{formatTanggal(item.tanggalLaporan)}</td><td className="max-w-xs px-4 py-4"><p className="font-medium text-slate-700">{item.kategoriKerusakan}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.uraian}</p></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.prioritas === 'Darurat' || item.prioritas === 'Tinggi' ? 'bg-red-50 text-red-700' : item.prioritas === 'Sedang' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{item.prioritas}</span></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === 'Selesai' ? 'bg-emerald-50 text-emerald-700' : item.status === 'Dalam Proses' ? 'bg-blue-50 text-blue-700' : item.status === 'Tidak Dapat Diperbaiki' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span></td><td className="px-4 py-4 font-semibold text-slate-700">{Number(item.biaya) ? `Rp ${Number(item.biaya).toLocaleString('id-ID')}` : '—'}</td>{isAdmin && <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEdit(item)} title="Ubah laporan" className="rounded-lg border border-blue-100 p-2 text-blue-700 hover:bg-blue-50"><Icon name="edit" className="h-4 w-4" /></button><button onClick={() => handleDelete(item)} title="Hapus laporan" className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"><Icon name="trash" className="h-4 w-4" /></button></div></td>}</tr>)}</tbody></table></div><div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Menampilkan {filteredItems.length} dari {items.length} catatan pemeliharaan.</div></>}
      </section>
      {isModalOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSaving) setIsModalOpen(false); }}><div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between bg-[#082B62] px-5 py-4 text-white sm:px-6"><div><h2 className="text-lg font-extrabold">{editingId ? 'Ubah Catatan Pemeliharaan' : 'Catat Pemeliharaan / Kerusakan'}</h2><p className="mt-1 text-xs text-blue-200">Catat informasi aset dan tindak lanjutnya.</p></div><button onClick={() => !isSaving && setIsModalOpen(false)} disabled={isSaving} className="rounded-lg p-2 hover:bg-white/10" aria-label="Tutup"><Icon name="close" /></button></div>
        <form onSubmit={handleSubmit} className="max-h-[calc(100vh-150px)] space-y-4 overflow-y-auto p-5 sm:p-6">{actionError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Jenis Aset</span><select value={form.jenisAset} onChange={(e) => setForm({ ...form, jenisAset: e.target.value, assetId: '' })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"><option>Inventaris</option><option>Ruang/Fasilitas</option><option>Umum</option></select></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Pilih Data Aset (opsional)</span><select value={form.assetId} onChange={(e) => pilihAset(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"><option value="">Pilih dari data tersimpan</option>{assets.filter((asset) => asset.kind === form.jenisAset).map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Nama Aset / Ruang *</span><input required maxLength={120} value={form.namaAset} onChange={(e) => setForm({ ...form, namaAset: e.target.value })} placeholder="Nama barang atau ruang" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Lokasi</span><input maxLength={120} value={form.lokasi} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} placeholder="Lokasi aset" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Kategori Kerusakan</span><select value={form.kategoriKerusakan} onChange={(e) => setForm({ ...form, kategoriKerusakan: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm">{['Kerusakan umum', 'Listrik', 'Air dan sanitasi', 'Bangunan', 'Perabot', 'Elektronik', 'Peralatan pembelajaran', 'Kebersihan', 'Lainnya'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Tanggal Laporan *</span><input required type="date" value={form.tanggalLaporan} onChange={(e) => setForm({ ...form, tanggalLaporan: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Uraian Kerusakan / Kebutuhan Perawatan *</span><textarea required rows={3} maxLength={1000} value={form.uraian} onChange={(e) => setForm({ ...form, uraian: e.target.value })} placeholder="Jelaskan kondisi yang ditemukan dan tindakan yang dibutuhkan..." className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Prioritas</span><select value={form.prioritas} onChange={(e) => setForm({ ...form, prioritas: e.target.value as Prioritas })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"><option>Rendah</option><option>Sedang</option><option>Tinggi</option><option>Darurat</option></select></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Status Penanganan</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusPemeliharaan })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm">{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Biaya (Rp)</span><input type="number" min="0" max="1000000000000" step="1" value={form.biaya} onChange={(e) => setForm({ ...form, biaya: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Pelaksana / Penyedia Jasa</span><input maxLength={120} value={form.pelaksana} onChange={(e) => setForm({ ...form, pelaksana: e.target.value })} placeholder="Nama petugas / teknisi" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Tindakan Perbaikan / Pemeliharaan</span><textarea rows={2} maxLength={1000} value={form.tindakan} onChange={(e) => setForm({ ...form, tindakan: e.target.value })} placeholder="Catat tindakan yang dilakukan atau direncanakan..." className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Tanggal Selesai</span><input type="date" value={form.tanggalSelesai} min={form.tanggalLaporan} onChange={(e) => setForm({ ...form, tanggalSelesai: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Catatan Tambahan</span><input maxLength={500} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="Opsional" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
        </div><div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">Data aset yang dipilih akan mengisi nama dan lokasi secara otomatis. Anda tetap dapat menyesuaikannya sebelum menyimpan.</div><div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" disabled={isSaving} onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600">Batal</button><button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#155EEF] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"><Icon name="save" className="h-4 w-4" />{isSaving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Laporan'}</button></div></form>
      </div></div>}
    </div>
  );
}
