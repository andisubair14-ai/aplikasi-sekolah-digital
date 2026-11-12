import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type KondisiBarang = 'Baik' | 'Rusak Ringan' | 'Rusak Berat';

type InventarisItem = {
  id: string;
  kodeInventaris: string;
  namaBarang: string;
  kategori: string;
  merkTipe: string;
  jumlah: number;
  satuan: string;
  kondisi: KondisiBarang;
  tahunPerolehan: string;
  sumberDana: string;
  lokasi: string;
  keterangan: string;
};

type FormState = {
  namaBarang: string;
  kategori: string;
  merkTipe: string;
  jumlah: string;
  satuan: string;
  kondisi: KondisiBarang;
  tahunPerolehan: string;
  sumberDana: string;
  lokasi: string;
  keterangan: string;
};

const FORM_AWAL: FormState = {
  namaBarang: '',
  kategori: 'Mebel',
  merkTipe: '',
  jumlah: '1',
  satuan: 'Unit',
  kondisi: 'Baik',
  tahunPerolehan: String(new Date().getFullYear()),
  sumberDana: '',
  lokasi: '',
  keterangan: '',
};

const KATEGORI = [
  'Elektronik',
  'Mebel',
  'Alat Pembelajaran',
  'Peralatan Kantor',
  'Olahraga',
  'Kebersihan',
  'Peralatan',
  'Lainnya',
];

function Icon({ name, className = 'h-5 w-5' }: { name: 'back' | 'plus' | 'search' | 'box' | 'edit' | 'trash' | 'close' | 'save' | 'refresh'; className?: string }) {
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
    case 'back': return <svg {...common}><path d="m15 18-6-6 6-6M9 12h12" /></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'search': return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
    case 'box': return <svg {...common}><path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" /><path d="m3.8 7.7 8.2 4.4 8.2-4.4M12 12.1V21" /></svg>;
    case 'edit': return <svg {...common}><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /></svg>;
    case 'trash': return <svg {...common}><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>;
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'save': return <svg {...common}><path d="M5 3h12l4 4v14H3V3h2ZM7 3v6h10V3M7 21v-8h10v8" /></svg>;
    case 'refresh': return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></svg>;
    default: return null;
  }
}


export default function DataInventaris() {
  const { userData } = useAuth();
  const [items, setItems] = useState<InventarisItem[]>([]);
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
    const unsubscribe = onSnapshot(
      collection(db, 'inventaris_sarpras'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as InventarisItem));
        data.sort((a, b) => a.namaBarang.localeCompare(b.namaBarang, 'id'));
        setItems(data);
        setLoading(false);
        setLoadError('');
      },
      (error) => {
        console.error('Gagal membaca data inventaris:', error);
        setLoadError('Data inventaris belum dapat dibaca. Periksa koneksi dan aturan akses Firestore.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('id');
    return items.filter((item) => {
      const cocokKata = !keyword || [item.kodeInventaris, item.namaBarang, item.kategori, item.lokasi]
        .some((value) => String(value || '').toLocaleLowerCase('id').includes(keyword));
      const cocokKondisi = filterKondisi === 'Semua Kondisi' || item.kondisi === filterKondisi;
      return cocokKata && cocokKondisi;
    });
  }, [items, search, filterKondisi]);

  const totalUnit = items.reduce((total, item) => total + (Number(item.jumlah) || 0), 0);
  const totalBaik = items.filter((item) => item.kondisi === 'Baik').length;
  const totalPerluPerhatian = items.filter((item) => item.kondisi !== 'Baik').length;

  const bukaFormTambah = () => {
    setEditingId(null);
    setForm(FORM_AWAL);
    setActionError('');
    setSuccessMessage('');
    setIsModalOpen(true);
  };

  const bukaFormEdit = (item: InventarisItem) => {
    setEditingId(item.id);
    setForm({
      namaBarang: item.namaBarang || '',
      kategori: item.kategori || 'Lainnya',
      merkTipe: item.merkTipe || '',
      jumlah: String(item.jumlah ?? 1),
      satuan: item.satuan || 'Unit',
      kondisi: item.kondisi || 'Baik',
      tahunPerolehan: item.tahunPerolehan || String(new Date().getFullYear()),
      sumberDana: item.sumberDana || '',
      lokasi: item.lokasi || '',
      keterangan: item.keterangan || '',
    });
    setActionError('');
    setSuccessMessage('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    setSuccessMessage('');

    const jumlah = Number(form.jumlah);
    const tahun = Number(form.tahunPerolehan);
    const tahunMaksimal = new Date().getFullYear() + 1;

    if (!form.namaBarang.trim() || !form.lokasi.trim()) {
      setActionError('Nama barang dan lokasi penempatan wajib diisi.');
      return;
    }
    if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 999999) {
      setActionError('Jumlah barang harus berupa bilangan bulat minimal 1.');
      return;
    }
    if (!Number.isInteger(tahun) || tahun < 1900 || tahun > tahunMaksimal) {
      setActionError(`Tahun perolehan harus antara 1900 dan ${tahunMaksimal}.`);
      return;
    }

    setIsSaving(true);
    const uid = userData?.uid || '';
    const dataSimpan = {
      namaBarang: form.namaBarang.trim(),
      kategori: form.kategori,
      merkTipe: form.merkTipe.trim(),
      jumlah,
      satuan: form.satuan,
      kondisi: form.kondisi,
      tahunPerolehan: String(tahun),
      sumberDana: form.sumberDana.trim(),
      lokasi: form.lokasi.trim(),
      keterangan: form.keterangan.trim(),
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
    };

    try {
      if (editingId) {
        await setDoc(doc(db, 'inventaris_sarpras', editingId), dataSimpan, { merge: true });
        setSuccessMessage('Data inventaris berhasil diperbarui.');
      } else {
        const newDoc = doc(collection(db, 'inventaris_sarpras'));
        await setDoc(newDoc, {
          ...dataSimpan,
          kodeInventaris: `INV-${tahun}-${newDoc.id.slice(0, 8).toUpperCase()}`,
          createdAt: serverTimestamp(),
          createdByUid: uid,
        });
        setSuccessMessage('Barang berhasil ditambahkan ke data inventaris.');
      }
      setIsModalOpen(false);
      setEditingId(null);
      setForm(FORM_AWAL);
    } catch (error) {
      console.error('Gagal menyimpan inventaris:', error);
      setActionError('Data gagal disimpan. Periksa koneksi dan aturan akses Firestore, lalu coba kembali.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHapus = async (item: InventarisItem) => {
    const yakin = window.confirm(`Hapus data "${item.namaBarang}" (${item.kodeInventaris})? Tindakan ini tidak dapat dibatalkan.`);
    if (!yakin) return;

    setActionError('');
    setSuccessMessage('');
    try {
      await deleteDoc(doc(db, 'inventaris_sarpras', item.id));
      setSuccessMessage(`Data ${item.namaBarang} berhasil dihapus.`);
    } catch (error) {
      console.error('Gagal menghapus inventaris:', error);
      setActionError('Data gagal dihapus. Periksa hak akses Firestore dan coba kembali.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/sarpras" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-[#155EEF]">
          <Icon name="back" className="h-4 w-4" /> Kembali ke Ringkasan Sarpras
        </Link>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">MODUL 01 · INVENTARIS</span>
      </div>

      <section className="flex flex-col justify-between gap-5 rounded-3xl bg-gradient-to-br from-[#082B62] via-[#124A91] to-[#1767C7] p-6 text-white shadow-lg sm:flex-row sm:items-center sm:p-8">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-blue-200">PENGELOLAAN ASET SEKOLAH</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Data Inventaris</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100">Catat dan pantau barang milik sekolah, mulai dari jumlah, kondisi, tahun perolehan, sumber dana, hingga lokasi penempatan.</p>
        </div>
        <button onClick={bukaFormTambah} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#0B3978] shadow-md transition hover:bg-blue-50">
          <Icon name="plus" className="h-5 w-5" /> Tambah Barang
        </button>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Jenis Barang</p>
          <p className="mt-2 text-3xl font-extrabold text-[#082B62]">{items.length}</p>
          <p className="mt-1 text-xs text-slate-400">Jumlah catatan inventaris</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Unit</p>
          <p className="mt-2 text-3xl font-extrabold text-[#082B62]">{totalUnit.toLocaleString('id-ID')}</p>
          <p className="mt-1 text-xs text-slate-400">Akumulasi jumlah seluruh barang</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Perlu Perhatian</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-600">{totalPerluPerhatian}</p>
          <p className="mt-1 text-xs text-slate-400">Barang rusak ringan atau rusak berat · {totalBaik} jenis dalam kondisi baik</p>
        </article>
      </section>

      {(successMessage || actionError || loadError) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${actionError || loadError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`} role="status">
          {actionError || loadError || successMessage}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#082B62]">Daftar Barang Inventaris</h2>
            <p className="mt-1 text-sm text-slate-500">Data tersimpan langsung pada basis data sekolah.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:w-72">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, kode, kategori, lokasi..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <select value={filterKondisi} onChange={(event) => setFilterKondisi(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
              <option>Semua Kondisi</option>
              <option>Baik</option>
              <option>Rusak Ringan</option>
              <option>Rusak Berat</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 p-12 text-sm font-semibold text-slate-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /> Memuat data inventaris...</div>
        ) : loadError ? (
          <div className="p-10 text-center text-sm text-slate-500">Daftar inventaris belum dapat ditampilkan.</div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon name="box" className="h-8 w-8" /></div>
            <h3 className="mt-4 text-base font-extrabold text-slate-800">{items.length === 0 ? 'Belum ada barang inventaris' : 'Data tidak ditemukan'}</h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">{items.length === 0 ? 'Mulai pendataan dengan menekan tombol Tambah Barang. Kode inventaris akan dibuat otomatis oleh sistem.' : 'Ubah kata kunci pencarian atau filter kondisi barang.'}</p>
            {items.length === 0 && <button onClick={bukaFormTambah} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#155EEF] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /> Tambah Barang Pertama</button>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-bold">Kode / Nama Barang</th>
                    <th className="px-4 py-3 font-bold">Kategori</th>
                    <th className="px-4 py-3 text-center font-bold">Jumlah</th>
                    <th className="px-4 py-3 font-bold">Kondisi</th>
                    <th className="px-4 py-3 font-bold">Lokasi</th>
                    <th className="px-4 py-3 font-bold">Tahun</th>
                    <th className="px-5 py-3 text-right font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-800">{item.namaBarang}</p>
                        <p className="mt-1 text-xs font-semibold text-blue-700">{item.kodeInventaris}</p>
                        {item.merkTipe && <p className="mt-1 text-xs text-slate-400">{item.merkTipe}</p>}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{item.kategori}</td>
                      <td className="px-4 py-4 text-center font-bold text-slate-700">{Number(item.jumlah).toLocaleString('id-ID')} <span className="font-normal text-slate-400">{item.satuan}</span></td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.kondisi === 'Baik' ? 'bg-emerald-50 text-emerald-700' : item.kondisi === 'Rusak Ringan' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{item.kondisi}</span></td>
                      <td className="px-4 py-4 text-slate-600">{item.lokasi}</td>
                      <td className="px-4 py-4 text-slate-600">{item.tahunPerolehan}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => bukaFormEdit(item)} title="Ubah data" aria-label={`Ubah ${item.namaBarang}`} className="rounded-lg border border-blue-100 p-2 text-blue-700 transition hover:bg-blue-50"><Icon name="edit" className="h-4 w-4" /></button>
                          <button onClick={() => handleHapus(item)} title="Hapus data" aria-label={`Hapus ${item.namaBarang}`} className="rounded-lg border border-red-100 p-2 text-red-600 transition hover:bg-red-50"><Icon name="trash" className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Menampilkan {filteredItems.length} dari {items.length} catatan inventaris · Diperbarui secara langsung</div>
          </>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setIsModalOpen(false); }}>
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="form-inventaris-title">
            <div className="flex items-center justify-between gap-3 bg-[#082B62] px-5 py-4 text-white sm:px-6">
              <div>
                <h2 id="form-inventaris-title" className="text-lg font-extrabold">{editingId ? 'Ubah Data Barang' : 'Tambah Barang Inventaris'}</h2>
                <p className="mt-1 text-xs text-blue-200">Lengkapi informasi barang milik sekolah.</p>
              </div>
              <button type="button" onClick={() => !isSaving && setIsModalOpen(false)} disabled={isSaving} className="rounded-lg p-2 text-blue-100 transition hover:bg-white/10 disabled:opacity-50" aria-label="Tutup formulir"><Icon name="close" /></button>
            </div>

            <form onSubmit={handleSubmit} className="max-h-[calc(100vh-150px)] space-y-5 overflow-y-auto p-5 sm:p-6">
              {actionError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Nama Barang <span className="text-red-500">*</span></span><input required maxLength={120} value={form.namaBarang} onChange={(event) => setForm({ ...form, namaBarang: event.target.value })} placeholder="Contoh: Laptop Administrasi" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
                <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Kategori</span><select value={form.kategori} onChange={(event) => setForm({ ...form, kategori: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">{KATEGORI.map((kategori) => <option key={kategori}>{kategori}</option>)}</select></label>
                <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Merek / Tipe</span><input maxLength={100} value={form.merkTipe} onChange={(event) => setForm({ ...form, merkTipe: event.target.value })} placeholder="Opsional" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
                <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Jumlah <span className="text-red-500">*</span></span><input type="number" min="1" max="999999" step="1" required value={form.jumlah} onChange={(event) => setForm({ ...form, jumlah: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
                <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Satuan</span><select value={form.satuan} onChange={(event) => setForm({ ...form, satuan: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"><option>Unit</option><option>Buah</option><option>Set</option><option>Pasang</option><option>Eksemplar</option><option>Meter</option><option>Lainnya</option></select></label>
                <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Kondisi Barang</span><select value={form.kondisi} onChange={(event) => setForm({ ...form, kondisi: event.target.value as KondisiBarang })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"><option>Baik</option><option>Rusak Ringan</option><option>Rusak Berat</option></select></label>
                <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Tahun Perolehan <span className="text-red-500">*</span></span><input type="number" min="1900" max={new Date().getFullYear() + 1} required value={form.tahunPerolehan} onChange={(event) => setForm({ ...form, tahunPerolehan: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
                <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Sumber Dana</span><input maxLength={100} value={form.sumberDana} onChange={(event) => setForm({ ...form, sumberDana: event.target.value })} placeholder="Contoh: BOS / APBD / Hibah" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
                <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Lokasi Penempatan <span className="text-red-500">*</span></span><input required maxLength={120} value={form.lokasi} onChange={(event) => setForm({ ...form, lokasi: event.target.value })} placeholder="Contoh: Ruang Kepala Sekolah" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
                <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Keterangan</span><textarea rows={3} maxLength={500} value={form.keterangan} onChange={(event) => setForm({ ...form, keterangan: event.target.value })} placeholder="Catatan tambahan (opsional)" className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
              </div>

              {!editingId && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">Kode inventaris akan dibuat otomatis setelah data disimpan. Sistem tidak menggunakan QR inventaris.</div>}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" disabled={isSaving} onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Batal</button>
                <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#155EEF] px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><Icon name="save" className="h-4 w-4" />{isSaving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Barang'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
