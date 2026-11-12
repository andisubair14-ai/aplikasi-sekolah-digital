import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type KondisiRuang = 'Baik' | 'Perlu Perhatian' | 'Rusak';
type StatusRuang = 'Aktif' | 'Tidak Aktif';
type RuangItem = {
  id: string;
  kodeRuang: string;
  namaRuang: string;
  jenisRuang: string;
  lokasiGedung: string;
  kapasitas: number;
  luas: number;
  kondisi: KondisiRuang;
  statusPenggunaan: StatusRuang;
  fasilitas: string;
  penanggungJawab: string;
  keterangan: string;
};
type FormState = Omit<RuangItem, 'id' | 'kodeRuang'>;

const JENIS_RUANG = ['Ruang Kelas', 'Ruang Kepala Sekolah', 'Ruang Guru', 'Tata Usaha', 'Perpustakaan', 'Laboratorium', 'UKS', 'Toilet', 'Gudang', 'Aula', 'Mushola', 'Ruang Lainnya'];
const FORM_AWAL: FormState = {
  namaRuang: '', jenisRuang: 'Ruang Kelas', lokasiGedung: '', kapasitas: 0, luas: 0,
  kondisi: 'Baik', statusPenggunaan: 'Aktif', fasilitas: '', penanggungJawab: '', keterangan: '',
};

function Icon({ name, className = 'h-5 w-5' }: { name: 'back' | 'plus' | 'search' | 'building' | 'edit' | 'trash' | 'close' | 'save'; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  switch (name) {
    case 'back': return <svg {...common}><path d="m15 18-6-6 6-6M9 12h12" /></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'search': return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
    case 'building': return <svg {...common}><path d="M3 21h18M5 21V5l7-2 7 2v16M9 8h1m4 0h1M9 12h1m4 0h1M9 16h1m4 0h1M11 21v-3h2v3" /></svg>;
    case 'edit': return <svg {...common}><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /></svg>;
    case 'trash': return <svg {...common}><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>;
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'save': return <svg {...common}><path d="M5 3h12l4 4v14H3V3h2ZM7 3v6h10V3M7 21v-8h10v8" /></svg>;
    default: return null;
  }
}

export default function RuangFasilitas() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const [items, setItems] = useState<RuangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filterKondisi, setFilterKondisi] = useState('Semua Kondisi');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_AWAL);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'ruang_fasilitas_sarpras'), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as RuangItem));
      data.sort((a, b) => a.namaRuang.localeCompare(b.namaRuang, 'id'));
      setItems(data); setLoading(false); setLoadError('');
    }, (error) => {
      console.error('Gagal membaca data ruang dan fasilitas:', error);
      setLoadError('Data ruang dan fasilitas belum dapat dibaca. Periksa koneksi dan aturan akses Firestore.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('id');
    return items.filter((item) => {
      const cocokKata = !keyword || [item.kodeRuang, item.namaRuang, item.jenisRuang, item.lokasiGedung, item.penanggungJawab]
        .some((value) => String(value || '').toLocaleLowerCase('id').includes(keyword));
      return cocokKata && (filterKondisi === 'Semua Kondisi' || item.kondisi === filterKondisi);
    });
  }, [items, search, filterKondisi]);

  const totalKapasitas = items.reduce((sum, item) => sum + (Number(item.kapasitas) || 0), 0);
  const totalPerluPerhatian = items.filter((item) => item.kondisi !== 'Baik').length;

  const bukaTambah = () => { setEditingId(null); setForm(FORM_AWAL); setActionError(''); setSuccessMessage(''); setIsModalOpen(true); };
  const bukaEdit = (item: RuangItem) => {
    setEditingId(item.id);
    setForm({
      namaRuang: item.namaRuang || '', jenisRuang: item.jenisRuang || 'Ruang Lainnya', lokasiGedung: item.lokasiGedung || '',
      kapasitas: Number(item.kapasitas) || 0, luas: Number(item.luas) || 0, kondisi: item.kondisi || 'Baik',
      statusPenggunaan: item.statusPenggunaan || 'Aktif', fasilitas: item.fasilitas || '',
      penanggungJawab: item.penanggungJawab || '', keterangan: item.keterangan || '',
    });
    setActionError(''); setSuccessMessage(''); setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setActionError(''); setSuccessMessage('');
    if (!isAdmin) return;
    const kapasitas = Number(form.kapasitas); const luas = Number(form.luas);
    if (!form.namaRuang.trim() || !form.lokasiGedung.trim()) { setActionError('Nama ruang dan lokasi gedung wajib diisi.'); return; }
    if (!Number.isInteger(kapasitas) || kapasitas < 0 || kapasitas > 10000) { setActionError('Kapasitas harus berupa bilangan bulat 0–10.000.'); return; }
    if (!Number.isFinite(luas) || luas < 0 || luas > 100000) { setActionError('Luas ruang harus berupa angka yang valid.'); return; }
    setIsSaving(true);
    const uid = userData?.uid || '';
    const payload = {
      namaRuang: form.namaRuang.trim(), jenisRuang: form.jenisRuang, lokasiGedung: form.lokasiGedung.trim(),
      kapasitas, luas, kondisi: form.kondisi, statusPenggunaan: form.statusPenggunaan,
      fasilitas: form.fasilitas.trim(), penanggungJawab: form.penanggungJawab.trim(), keterangan: form.keterangan.trim(),
      updatedAt: serverTimestamp(), updatedByUid: uid,
    };
    try {
      if (editingId) {
        await setDoc(doc(db, 'ruang_fasilitas_sarpras', editingId), payload, { merge: true });
        setSuccessMessage('Data ruang dan fasilitas berhasil diperbarui.');
      } else {
        const newDoc = doc(collection(db, 'ruang_fasilitas_sarpras'));
        await setDoc(newDoc, { ...payload, kodeRuang: `RNG-${new Date().getFullYear()}-${newDoc.id.slice(0, 8).toUpperCase()}`, createdAt: serverTimestamp(), createdByUid: uid });
        setSuccessMessage('Ruang dan fasilitas berhasil ditambahkan.');
      }
      setIsModalOpen(false); setEditingId(null); setForm(FORM_AWAL);
    } catch (error) {
      console.error('Gagal menyimpan ruang:', error);
      setActionError('Data gagal disimpan. Periksa koneksi dan aturan akses Firestore.');
    } finally { setIsSaving(false); }
  };

  const handleHapus = async (item: RuangItem) => {
    if (!isAdmin || !window.confirm(`Hapus data ruang "${item.namaRuang}"?`)) return;
    try { await deleteDoc(doc(db, 'ruang_fasilitas_sarpras', item.id)); setSuccessMessage(`Data ${item.namaRuang} berhasil dihapus.`); }
    catch (error) { console.error('Gagal menghapus ruang:', error); setActionError('Data gagal dihapus. Periksa hak akses Firestore.'); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/sarpras" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#155EEF]"><Icon name="back" className="h-4 w-4" /> Kembali ke Ringkasan Sarpras</Link>
        <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">MODUL 02 · RUANG DAN FASILITAS</span>
      </div>
      <section className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-br from-[#082B62] via-[#124A91] to-[#1767C7] p-6 text-white shadow-lg sm:flex-row sm:items-center sm:p-8">
        <div><p className="text-xs font-bold tracking-[0.16em] text-blue-200">PENGELOLAAN SARANA SEKOLAH</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Ruang dan Fasilitas</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">Pendataan ruang, kapasitas, kondisi, kelengkapan fasilitas, dan penanggung jawab setiap ruang sekolah.</p></div>
        {isAdmin && <button onClick={bukaTambah} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#124A91] shadow transition hover:bg-blue-50"><Icon name="plus" /> Tambah Ruang</button>}
      </section>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[{ label: 'Total Ruang', value: items.length, note: 'Ruang dan fasilitas terdata' }, { label: 'Total Kapasitas', value: totalKapasitas.toLocaleString('id-ID'), note: 'Perkiraan daya tampung' }, { label: 'Perlu Perhatian', value: totalPerluPerhatian, note: 'Kondisi bukan kategori baik' }].map((card) => <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{card.label}</p><p className="mt-2 text-3xl font-extrabold text-[#082B62]">{card.value}</p><p className="mt-1 text-xs text-slate-400">{card.note}</p></article>)}
      </section>
      {successMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{successMessage}</div>}
      {actionError && !isModalOpen && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-extrabold text-[#082B62]">Daftar Ruang dan Fasilitas</h2><p className="mt-1 text-sm text-slate-500">Data tersimpan dan diperbarui langsung dari Firebase.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari ruang atau lokasi..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 sm:w-64" /></div><select value={filterKondisi} onChange={(e) => setFilterKondisi(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"><option>Semua Kondisi</option><option>Baik</option><option>Perlu Perhatian</option><option>Rusak</option></select></div></div>
        {loading ? <div className="p-12 text-center text-sm text-slate-500">Memuat data ruang dan fasilitas...</div> : loadError ? <div className="p-8 text-center text-sm text-red-600">{loadError}</div> : filteredItems.length === 0 ? <div className="p-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700"><Icon name="building" className="h-7 w-7" /></div><h3 className="mt-4 font-bold text-slate-800">Belum ada data ruang</h3><p className="mt-1 text-sm text-slate-500">{search || filterKondisi !== 'Semua Kondisi' ? 'Tidak ada data yang cocok dengan pencarian.' : 'Mulai dengan menambahkan ruang atau fasilitas sekolah.'}</p>{isAdmin && !search && filterKondisi === 'Semua Kondisi' && <button onClick={bukaTambah} className="mt-4 rounded-xl bg-[#155EEF] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Tambah Ruang Pertama</button>}</div> : <>
          <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-bold">Nama Ruang</th><th className="px-4 py-3 font-bold">Jenis</th><th className="px-4 py-3 font-bold">Lokasi</th><th className="px-4 py-3 text-center font-bold">Kapasitas</th><th className="px-4 py-3 font-bold">Kondisi</th><th className="px-4 py-3 font-bold">Status</th>{isAdmin && <th className="px-5 py-3 text-right font-bold">Aksi</th>}</tr></thead><tbody className="divide-y divide-slate-100">{filteredItems.map((item) => <tr key={item.id} className="hover:bg-slate-50/80"><td className="px-5 py-4"><p className="font-bold text-slate-800">{item.namaRuang}</p><p className="mt-1 text-xs font-semibold text-cyan-700">{item.kodeRuang}</p><p className="mt-1 text-xs text-slate-400">{item.luas ? `${item.luas} m²` : 'Luas belum dicatat'}</p></td><td className="px-4 py-4 text-slate-600">{item.jenisRuang}</td><td className="px-4 py-4 text-slate-600">{item.lokasiGedung}</td><td className="px-4 py-4 text-center font-bold text-slate-700">{item.kapasitas || '—'} orang</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.kondisi === 'Baik' ? 'bg-emerald-50 text-emerald-700' : item.kondisi === 'Perlu Perhatian' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{item.kondisi}</span></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.statusPenggunaan === 'Aktif' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{item.statusPenggunaan}</span></td>{isAdmin && <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => bukaEdit(item)} title="Ubah data" className="rounded-lg border border-blue-100 p-2 text-blue-700 hover:bg-blue-50"><Icon name="edit" className="h-4 w-4" /></button><button onClick={() => handleHapus(item)} title="Hapus data" className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"><Icon name="trash" className="h-4 w-4" /></button></div></td>}</tr>)}</tbody></table></div>
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Menampilkan {filteredItems.length} dari {items.length} ruang dan fasilitas.</div>
        </>}
      </section>
      {isModalOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSaving) setIsModalOpen(false); }}><div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between bg-[#082B62] px-5 py-4 text-white sm:px-6"><div><h2 className="text-lg font-extrabold">{editingId ? 'Ubah Data Ruang' : 'Tambah Ruang dan Fasilitas'}</h2><p className="mt-1 text-xs text-blue-200">Lengkapi informasi ruang sekolah.</p></div><button onClick={() => !isSaving && setIsModalOpen(false)} disabled={isSaving} className="rounded-lg p-2 hover:bg-white/10" aria-label="Tutup"><Icon name="close" /></button></div>
        <form onSubmit={handleSubmit} className="max-h-[calc(100vh-150px)] space-y-4 overflow-y-auto p-5 sm:p-6">{actionError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Nama Ruang *</span><input required maxLength={120} value={form.namaRuang} onChange={(e) => setForm({ ...form, namaRuang: e.target.value })} placeholder="Contoh: Ruang Kelas V" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Jenis Ruang</span><select value={form.jenisRuang} onChange={(e) => setForm({ ...form, jenisRuang: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm">{JENIS_RUANG.map((jenis) => <option key={jenis}>{jenis}</option>)}</select></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Lokasi / Gedung *</span><input required maxLength={120} value={form.lokasiGedung} onChange={(e) => setForm({ ...form, lokasiGedung: e.target.value })} placeholder="Contoh: Gedung A, Lantai 1" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Kapasitas (orang)</span><input type="number" min="0" max="10000" step="1" value={form.kapasitas} onChange={(e) => setForm({ ...form, kapasitas: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Luas Ruang (m²)</span><input type="number" min="0" max="100000" step="0.01" value={form.luas} onChange={(e) => setForm({ ...form, luas: Number(e.target.value) })} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Kondisi</span><select value={form.kondisi} onChange={(e) => setForm({ ...form, kondisi: e.target.value as KondisiRuang })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"><option>Baik</option><option>Perlu Perhatian</option><option>Rusak</option></select></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Status Penggunaan</span><select value={form.statusPenggunaan} onChange={(e) => setForm({ ...form, statusPenggunaan: e.target.value as StatusRuang })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"><option>Aktif</option><option>Tidak Aktif</option></select></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Penanggung Jawab</span><input maxLength={120} value={form.penanggungJawab} onChange={(e) => setForm({ ...form, penanggungJawab: e.target.value })} placeholder="Nama petugas / guru" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Fasilitas yang Tersedia</span><input maxLength={500} value={form.fasilitas} onChange={(e) => setForm({ ...form, fasilitas: e.target.value })} placeholder="Meja, kursi, papan tulis, kipas..." className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Keterangan</span><textarea rows={3} maxLength={500} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Catatan tambahan (opsional)" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" /></label>
        </div><div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" disabled={isSaving} onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600">Batal</button><button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#155EEF] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"><Icon name="save" className="h-4 w-4" />{isSaving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Ruang'}</button></div></form>
      </div></div>}
    </div>
  );
}
