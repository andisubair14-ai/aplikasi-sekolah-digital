import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type Role = 'admin' | 'guru' | 'kepsek';
type StatusPengumuman = 'Draft' | 'Terbit' | 'Arsip';
type Prioritas = 'Normal' | 'Penting';
type Kategori = 'Akademik' | 'Kegiatan' | 'Kepegawaian' | 'Informasi' | 'Umum';

type PengumumanRecord = {
  id: string;
  judul: string;
  kategori: Kategori;
  isi: string;
  prioritas: Prioritas;
  sasaran: Role[];
  status: StatusPengumuman;
  tautanLampiran: string;
  sematkan: boolean;
  createdAt?: any;
  updatedAt?: any;
  createdByUid: string;
  createdByNama: string;
  updatedByUid: string;
  updatedByNama: string;
};

type FormState = {
  judul: string;
  kategori: Kategori;
  isi: string;
  prioritas: Prioritas;
  sasaran: Role[];
  status: StatusPengumuman;
  tautanLampiran: string;
  sematkan: boolean;
};

const FORM_AWAL: FormState = {
  judul: '',
  kategori: 'Informasi',
  isi: '',
  prioritas: 'Normal',
  sasaran: ['guru', 'kepsek'],
  status: 'Draft',
  tautanLampiran: '',
  sematkan: false,
};

const formatTanggal = (value: any): string => {
  try {
    const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Tanggal tidak tersedia';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
  } catch {
    return 'Tanggal tidak tersedia';
  }
};

const waktuUrut = (value: any): number => {
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const statusClass = (status: StatusPengumuman) => {
  if (status === 'Terbit') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Arsip') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

export default function Pengumuman() {
  const { userData } = useAuth();
  const role = (userData?.role || 'guru') as Role;
  const uid = String(userData?.uid || '');
  const namaPengguna = String(userData?.nama || 'Pengguna');
  const isAdmin = role === 'admin';
  const canManage = isAdmin || role === 'kepsek';

  const [data, setData] = useState<PengumumanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorData, setErrorData] = useState('');
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<PengumumanRecord | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_AWAL);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorData('');
    const ref = collection(db, 'pengumuman_sekolah');
    const q = isAdmin || role === 'kepsek'
      ? query(ref)
      : query(ref, where('status', '==', 'Terbit'), where('sasaran', 'array-contains', 'guru'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as PengumumanRecord[];
      records.sort((a, b) => {
        if (Boolean(a.sematkan) !== Boolean(b.sematkan)) return a.sematkan ? -1 : 1;
        return waktuUrut(b.createdAt) - waktuUrut(a.createdAt);
      });
      setData(records);
      setLoading(false);
      setErrorData('');
    }, (error) => {
      console.error('Gagal memuat pengumuman:', error);
      setErrorData('Pengumuman belum dapat dimuat. Periksa koneksi internet dan Firestore Rules.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin, role]);

  const dataTampil = useMemo(() => data.filter((item) => {
    const cocokCari = `${item.judul} ${item.isi} ${item.kategori}`.toLowerCase().includes(search.toLowerCase());
    const cocokKategori = filterKategori === 'Semua' || item.kategori === filterKategori;
    const cocokStatus = !canManage || filterStatus === 'Semua' || item.status === filterStatus;
    return cocokCari && cocokKategori && cocokStatus;
  }), [data, search, filterKategori, filterStatus, canManage]);

  const totalTerbit = data.filter((item) => item.status === 'Terbit').length;
  const totalDraft = data.filter((item) => item.status === 'Draft').length;
  const totalPenting = data.filter((item) => item.prioritas === 'Penting' && item.status === 'Terbit').length;

  const bukaTambah = () => {
    setEditId(null);
    setForm(FORM_AWAL);
    setModalOpen(true);
  };

  const bukaEdit = (item: PengumumanRecord) => {
    setEditId(item.id);
    setForm({
      judul: item.judul || '',
      kategori: item.kategori || 'Informasi',
      isi: item.isi || '',
      prioritas: item.prioritas || 'Normal',
      sasaran: Array.isArray(item.sasaran) ? item.sasaran : ['guru', 'kepsek'],
      status: item.status || 'Draft',
      tautanLampiran: item.tautanLampiran || '',
      sematkan: Boolean(item.sematkan),
    });
    setDetail(null);
    setModalOpen(true);
  };

  const ubahSasaran = (target: Role, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      sasaran: checked
        ? [...new Set([...prev.sasaran, target])]
        : prev.sasaran.filter((item) => item !== target),
    }));
  };

  const simpanPengumuman = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || !uid) return;
    if (!form.judul.trim() || !form.isi.trim()) {
      alert('Judul dan isi pengumuman wajib diisi.');
      return;
    }
    if (form.sasaran.length === 0) {
      alert('Pilih minimal satu sasaran pengumuman.');
      return;
    }
    if (form.tautanLampiran.trim()) {
      try {
        const parsed = new URL(form.tautanLampiran.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL tidak valid');
      } catch {
        alert('Tautan lampiran harus berupa alamat URL yang diawali http:// atau https://.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        judul: form.judul.trim(),
        kategori: form.kategori,
        isi: form.isi.trim(),
        prioritas: form.prioritas,
        sasaran: form.sasaran,
        status: form.status,
        tautanLampiran: form.tautanLampiran.trim(),
        sematkan: isAdmin ? form.sematkan : false,
        updatedAt: serverTimestamp(),
        updatedByUid: uid,
        updatedByNama: namaPengguna,
      };

      if (editId) {
        await updateDoc(doc(db, 'pengumuman_sekolah', editId), payload);
      } else {
        await addDoc(collection(db, 'pengumuman_sekolah'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdByUid: uid,
          createdByNama: namaPengguna,
        });
      }
      setModalOpen(false);
      setEditId(null);
      setForm(FORM_AWAL);
    } catch (error) {
      console.error('Gagal menyimpan pengumuman:', error);
      alert('Pengumuman gagal disimpan. Periksa Firestore Rules dan koneksi Firebase.');
    } finally {
      setSaving(false);
    }
  };

  const hapusPengumuman = async (item: PengumumanRecord) => {
    if (!isAdmin) return;
    if (!window.confirm(`Hapus pengumuman "${item.judul}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setProcessingId(item.id);
    try {
      await deleteDoc(doc(db, 'pengumuman_sekolah', item.id));
      if (detail?.id === item.id) setDetail(null);
    } catch (error) {
      console.error('Gagal menghapus pengumuman:', error);
      alert('Pengumuman gagal dihapus. Periksa hak akses Firestore.');
    } finally {
      setProcessingId(null);
    }
  };

  const ubahSematan = async (item: PengumumanRecord) => {
    if (!isAdmin) return;
    setProcessingId(item.id);
    try {
      await updateDoc(doc(db, 'pengumuman_sekolah', item.id), {
        sematkan: !item.sematkan,
        updatedAt: serverTimestamp(),
        updatedByUid: uid,
        updatedByNama: namaPengguna,
      });
    } catch (error) {
      console.error('Gagal mengubah sematan:', error);
      alert('Status sematan gagal diperbarui.');
    } finally {
      setProcessingId(null);
    }
  };

  const bolehEdit = (item: PengumumanRecord) => isAdmin || (role === 'kepsek' && item.createdByUid === uid);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#082B62] via-[#10458A] to-[#1767C8] p-6 sm:p-8 text-white shadow-lg">
        <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5" />
        <div className="absolute right-28 -bottom-28 h-64 w-64 rounded-full bg-white/5" />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-blue-100">
              <span>▣</span> PUSAT INFORMASI SEKOLAH
            </span>
            <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight">Pengumuman Sekolah</h1>
            <p className="mt-2 max-w-xl text-sm sm:text-base leading-relaxed text-blue-100">
              Informasi resmi, agenda, dan pemberitahuan sekolah dalam satu tempat yang mudah diakses.
            </p>
          </div>
          {canManage && (
            <button onClick={bukaTambah} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#0B3976] shadow-lg transition hover:bg-blue-50">
              <span className="text-xl leading-none">+</span> Buat Pengumuman
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Total Pengumuman</p><span className="rounded-xl bg-blue-50 p-2 text-lg">▤</span></div>
          <p className="mt-3 text-3xl font-extrabold text-[#082B62]">{data.length}</p><p className="mt-1 text-xs text-slate-400">Data sesuai hak akses akun</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Telah Diterbitkan</p><span className="rounded-xl bg-emerald-50 p-2 text-lg">✓</span></div>
          <p className="mt-3 text-3xl font-extrabold text-emerald-700">{totalTerbit}</p><p className="mt-1 text-xs text-slate-400">Pengumuman berstatus terbit</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Draft</p><span className="rounded-xl bg-amber-50 p-2 text-lg">✎</span></div>
          <p className="mt-3 text-3xl font-extrabold text-amber-700">{canManage ? totalDraft : '—'}</p><p className="mt-1 text-xs text-slate-400">Belum dipublikasikan</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">Pengumuman Penting</p><span className="rounded-xl bg-rose-50 p-2 text-lg">!</span></div>
          <p className="mt-3 text-3xl font-extrabold text-rose-700">{totalPenting}</p><p className="mt-1 text-xs text-slate-400">Prioritas penting yang diterbitkan</p>
        </div>
      </section>

      {errorData && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorData}</div>}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-extrabold text-[#082B62]">Daftar Pengumuman</h2><p className="mt-1 text-sm text-slate-500">Temukan informasi dan pemberitahuan terbaru dari sekolah.</p></div>
          <span className="text-xs font-semibold text-slate-400">{dataTampil.length} pengumuman ditampilkan</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_210px_190px]">
          <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul atau isi pengumuman..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
          <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"><option>Semua</option>{(['Akademik', 'Kegiatan', 'Kepegawaian', 'Informasi', 'Umum'] as Kategori[]).map((item) => <option key={item}>{item}</option>)}</select>
          {canManage && <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"><option>Semua</option><option>Draft</option><option>Terbit</option><option>Arsip</option></select>}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500">Memuat pengumuman...</div>
        ) : dataTampil.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">▤</div>
            <h3 className="mt-4 font-bold text-slate-800">Belum ada pengumuman</h3>
            <p className="mt-1 text-sm text-slate-500">{search ? 'Tidak ditemukan pengumuman yang sesuai dengan pencarian.' : 'Pengumuman yang tersedia akan muncul di halaman ini.'}</p>
            {canManage && !search && <button onClick={bukaTambah} className="mt-4 rounded-lg bg-[#155EEF] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Buat Pengumuman Pertama</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {dataTampil.map((item) => (
              <article key={item.id} className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.prioritas === 'Penting' && item.status === 'Terbit' ? 'border-rose-200' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{item.kategori}</span>
                  {canManage && <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(item.status)}`}>{item.status}</span>}
                  {item.prioritas === 'Penting' && <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Penting</span>}
                  {item.sematkan && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">📌 Disematkan</span>}
                </div>
                <h3 className="mt-4 text-lg font-extrabold leading-snug text-[#082B62]">{item.judul}</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 line-clamp-3">{item.isi}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="text-xs text-slate-400"><p>{formatTanggal(item.createdAt)}</p><p className="mt-1">Oleh: {item.createdByNama || 'Administrator'}</p></div>
                  <button onClick={() => setDetail(item)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50">Baca Selengkapnya</button>
                </div>
                {canManage && (bolehEdit(item) || isAdmin) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bolehEdit(item) && <button onClick={() => bukaEdit(item)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">Ubah</button>}
                    {isAdmin && <button disabled={processingId === item.id} onClick={() => ubahSematan(item)} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100">{item.sematkan ? 'Lepas Sematan' : 'Sematkan'}</button>}
                    {isAdmin && <button disabled={processingId === item.id} onClick={() => hapusPengumuman(item)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">Hapus</button>}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div><h2 className="text-lg font-extrabold text-[#082B62]">{editId ? 'Ubah Pengumuman' : 'Buat Pengumuman'}</h2><p className="mt-1 text-xs text-slate-500">Lengkapi informasi yang akan disampaikan kepada warga sekolah.</p></div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg px-3 py-2 text-xl text-slate-400 hover:bg-slate-100" aria-label="Tutup">×</button>
            </div>
            <form onSubmit={simpanPengumuman} className="max-h-[75vh] space-y-4 overflow-y-auto p-5 sm:p-6">
              <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Judul Pengumuman *</label><input required maxLength={150} value={form.judul} onChange={(e) => setForm((p) => ({ ...p, judul: e.target.value }))} placeholder="Contoh: Pemberitahuan Rapat Guru" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Kategori</label><select value={form.kategori} onChange={(e) => setForm((p) => ({ ...p, kategori: e.target.value as Kategori }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Akademik</option><option>Kegiatan</option><option>Kepegawaian</option><option>Informasi</option><option>Umum</option></select></div>
                <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Prioritas</label><select value={form.prioritas} onChange={(e) => setForm((p) => ({ ...p, prioritas: e.target.value as Prioritas }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Normal</option><option>Penting</option></select></div>
              </div>
              <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Isi Pengumuman *</label><textarea required rows={7} value={form.isi} onChange={(e) => setForm((p) => ({ ...p, isi: e.target.value }))} placeholder="Tuliskan isi pengumuman secara jelas dan lengkap..." className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
              <div><label className="mb-2 block text-sm font-bold text-slate-700">Sasaran Pengumuman *</label><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={form.sasaran.includes('guru')} onChange={(e) => ubahSasaran('guru', e.target.checked)} className="h-4 w-4 accent-blue-600" /> Guru</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={form.sasaran.includes('kepsek')} onChange={(e) => ubahSasaran('kepsek', e.target.checked)} className="h-4 w-4 accent-blue-600" /> Kepala Sekolah</label>
              </div><p className="mt-1.5 text-xs text-slate-400">Pilih satu atau keduanya. Admin tetap dapat melihat seluruh pengumuman.</p></div>
              <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Tautan Lampiran (Opsional)</label><input type="url" value={form.tautanLampiran} onChange={(e) => setForm((p) => ({ ...p, tautanLampiran: e.target.value }))} placeholder="https://..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400" /><p className="mt-1 text-xs text-slate-400">Untuk tahap ini gunakan tautan file yang sudah tersedia secara online. Unggah file langsung akan ditambahkan pada pengembangan berikutnya.</p></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="mb-1.5 block text-sm font-bold text-slate-700">Status</label><select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as StatusPengumuman }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Draft</option><option>Terbit</option><option>Arsip</option></select></div>
                {isAdmin && <label className="flex cursor-pointer items-center gap-2 self-end rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800"><input type="checkbox" checked={form.sematkan} onChange={(e) => setForm((p) => ({ ...p, sematkan: e.target.checked }))} className="h-4 w-4 accent-amber-600" /> Sematkan di bagian atas</label>}
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button><button type="submit" disabled={saving} className="rounded-xl bg-[#155EEF] px-5 py-3 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Pengumuman'}</button></div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{detail.kategori}</span>{detail.prioritas === 'Penting' && <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Penting</span>}</div><button onClick={() => setDetail(null)} className="rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-slate-100" aria-label="Tutup">×</button></div>
            <div className="p-5 sm:p-7"><h2 className="text-2xl font-extrabold leading-tight text-[#082B62]">{detail.judul}</h2><p className="mt-2 text-xs text-slate-400">{formatTanggal(detail.createdAt)} · Oleh {detail.createdByNama || 'Administrator'}</p><div className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{detail.isi}</div>{detail.tautanLampiran && <a href={detail.tautanLampiran} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100">↗ Buka Lampiran</a>}</div>
            {bolehEdit(detail) && <div className="flex justify-end gap-2 border-t border-slate-100 p-4"><button onClick={() => bukaEdit(detail)} className="rounded-xl bg-[#155EEF] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Ubah Pengumuman</button></div>}
          </div>
        </div>
      )}
    </div>
  );
}
