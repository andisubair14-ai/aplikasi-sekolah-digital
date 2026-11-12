import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

type RingkasanData = { inventaris: number; ruangan: number; perluPerbaikan: number; pemeliharaan: number };

function Icon({ name, className = 'h-6 w-6' }: { name: 'box' | 'building' | 'wrench' | 'clipboard' | 'arrow' | 'info' | 'layers'; className?: string }) {
  const common = { className, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', 'aria-hidden': true as const };
  switch (name) {
    case 'box': return <svg {...common}><path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" /><path d="m3.8 7.7 8.2 4.4 8.2-4.4M12 12.1V21M8 5.1l8.2 4.4" /></svg>;
    case 'building': return <svg {...common}><path d="M3 21h18M5 21V5l7-2 7 2v16M9 8h1m4 0h1M9 12h1m4 0h1M9 16h1m4 0h1M11 21v-3h2v3" /></svg>;
    case 'wrench': return <svg {...common}><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3.5 17.5a2.1 2.1 0 0 0 3 3l4.8-4.8a5 5 0 0 0 6.4-6.4l-3 3-3.3-3.3 3.3-2.7Z" /></svg>;
    case 'clipboard': return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 4.5ZM8.5 10h7M8.5 14h7M8.5 18h4" /></svg>;
    case 'arrow': return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
    case 'info': return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>;
    case 'layers': return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg>;
    default: return null;
  }
}

const MODUL = [
  { nomor: '01', judul: 'Data Inventaris', deskripsi: 'Catat barang sekolah, kode inventaris otomatis, jumlah, kondisi, tahun perolehan, sumber dana, dan lokasi penempatan.', icon: 'box' as const, accent: 'bg-blue-50 text-blue-700 border-blue-100', path: '/admin/sarpras/inventaris', action: 'Masuk ke Data Inventaris' },
  { nomor: '02', judul: 'Ruang dan Fasilitas', deskripsi: 'Kelola ruang kelas, ruang guru, kantor, perpustakaan, toilet, laboratorium, dan fasilitas pendukung sekolah.', icon: 'building' as const, accent: 'bg-cyan-50 text-cyan-700 border-cyan-100', path: '/admin/sarpras/ruang-fasilitas', action: 'Kelola Ruang dan Fasilitas' },
  { nomor: '03', judul: 'Pemeliharaan dan Perbaikan', deskripsi: 'Catat kerusakan, tindak lanjut perbaikan, biaya pemeliharaan, dan riwayat penanganan aset.', icon: 'wrench' as const, accent: 'bg-amber-50 text-amber-700 border-amber-100', path: '/admin/sarpras/pemeliharaan', action: 'Kelola Pemeliharaan' },
  { nomor: '04', judul: 'Laporan Sarpras', deskripsi: 'Rekap inventaris, kondisi barang, data ruangan, dan laporan pemeliharaan untuk dicetak atau diekspor.', icon: 'clipboard' as const, accent: 'bg-violet-50 text-violet-700 border-violet-100', path: '/admin/sarpras/laporan', action: 'Buka Laporan Sarpras' },
];

export default function SarprasDashboard() {
  const [ringkasan, setRingkasan] = useState<RingkasanData>({ inventaris: 0, ruangan: 0, perluPerbaikan: 0, pemeliharaan: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let inventories: Array<{ kondisi?: string }> = [];
    let rooms: Array<{ kondisi?: string }> = [];
    let maintenance: Array<{ status?: string }> = [];
    const update = () => {
      setRingkasan({
        inventaris: inventories.length,
        ruangan: rooms.length,
        perluPerbaikan: inventories.filter((item) => item.kondisi && item.kondisi !== 'Baik').length + rooms.filter((item) => item.kondisi && item.kondisi !== 'Baik').length,
        pemeliharaan: maintenance.length,
      });
    };
    let ready = 0;
    const markReady = () => { ready += 1; if (ready >= 3) setLoading(false); };
    const unsubInventory = onSnapshot(collection(db, 'inventaris_sarpras'), (snapshot) => { inventories = snapshot.docs.map((item) => item.data() as { kondisi?: string }); update(); markReady(); setLoadError(''); }, (error) => { console.error('Gagal membaca ringkasan inventaris:', error); setLoadError('Sebagian ringkasan belum dapat dimuat. Periksa aturan akses Firestore.'); markReady(); });
    const unsubRooms = onSnapshot(collection(db, 'ruang_fasilitas_sarpras'), (snapshot) => { rooms = snapshot.docs.map((item) => item.data() as { kondisi?: string }); update(); markReady(); }, (error) => { console.error('Gagal membaca ringkasan ruang:', error); setLoadError('Sebagian ringkasan belum dapat dimuat. Periksa aturan akses Firestore.'); markReady(); });
    const unsubMaintenance = onSnapshot(collection(db, 'pemeliharaan_sarpras'), (snapshot) => { maintenance = snapshot.docs.map((item) => item.data() as { status?: string }); update(); markReady(); }, (error) => { console.error('Gagal membaca ringkasan pemeliharaan:', error); setLoadError('Sebagian ringkasan belum dapat dimuat. Periksa aturan akses Firestore.'); markReady(); });
    return () => { unsubInventory(); unsubRooms(); unsubMaintenance(); };
  }, []);

  const tanggalHariIni = useMemo(() => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()), []);
  const cards = [
    { label: 'Total Inventaris', value: loading ? '…' : ringkasan.inventaris.toLocaleString('id-ID'), note: 'Jenis barang yang telah didata', icon: 'box' as const, tone: 'blue' },
    { label: 'Ruang dan Fasilitas', value: loading ? '…' : ringkasan.ruangan.toLocaleString('id-ID'), note: 'Ruang dan fasilitas terdata', icon: 'building' as const, tone: 'cyan' },
    { label: 'Perlu Perbaikan', value: loading ? '…' : ringkasan.perluPerbaikan.toLocaleString('id-ID'), note: 'Barang atau ruang bukan kondisi baik', icon: 'wrench' as const, tone: 'amber' },
    { label: 'Laporan Pemeliharaan', value: loading ? '…' : ringkasan.pemeliharaan.toLocaleString('id-ID'), note: 'Catatan pemeliharaan tersimpan', icon: 'clipboard' as const, tone: 'violet' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#082B62] via-[#124A91] to-[#1767C7] p-6 text-white shadow-lg sm:p-8"><div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5" /><div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-white/5" /><div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-2xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50"><Icon name="layers" className="h-4 w-4" /> MODUL PENGELOLAAN ASET SEKOLAH</div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Sarana dan Prasarana</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100 sm:text-base">Kelola inventaris, ruang, fasilitas, serta pemeliharaan sekolah dalam satu tempat yang tertata.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm lg:min-w-52"><p className="text-xs font-medium text-blue-100">Hari ini</p><p className="mt-1 text-sm font-bold capitalize text-white">{tanggalHariIni}</p></div></div></section>
      <section className="space-y-3"><div><h2 className="text-lg font-extrabold text-[#082B62]">Ringkasan Sarpras</h2><p className="mt-1 text-sm text-slate-500">Angka diperbarui otomatis mengikuti data yang tersimpan di Firebase.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((item) => { const color = item.tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100' : item.tone === 'cyan' ? 'bg-cyan-50 text-cyan-700 border-cyan-100' : item.tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-violet-50 text-violet-700 border-violet-100'; return <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500">{item.label}</p><p className="mt-3 text-3xl font-extrabold tracking-tight text-[#082B62]">{item.value}</p></div><div className={`rounded-xl border p-3 ${color}`}><Icon name={item.icon} className="h-6 w-6" /></div></div><p className="mt-3 text-xs text-slate-400">{item.note}</p></article>; })}</div>{loadError && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</p>}</section>
      <section className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5"><div className="mt-0.5 shrink-0 text-blue-700"><Icon name="info" className="h-5 w-5" /></div><div><h3 className="text-sm font-bold text-blue-900">Pengelolaan Sarpras Terintegrasi</h3><p className="mt-1 text-sm leading-relaxed text-blue-800">Data inventaris, ruang, dan pemeliharaan saling terhubung. Laporan Sarpras mengambil data langsung dari ketiga modul sehingga tidak perlu pendataan ulang.</p></div></section>
      <section className="space-y-3"><div><h2 className="text-lg font-extrabold text-[#082B62]">Pengelolaan Sarana dan Prasarana</h2><p className="mt-1 text-sm text-slate-500">Pilih modul yang ingin dikelola. Seluruh menu berikut sudah aktif.</p></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{MODUL.map((item) => <Link key={item.nomor} to={item.path} className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 sm:p-6"><div className="flex items-start gap-4"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${item.accent}`}><Icon name={item.icon} className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-extrabold tracking-widest text-slate-400">MODUL {item.nomor}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Aktif · Buka modul</span></div><h3 className="mt-2 text-base font-extrabold text-[#082B62]">{item.judul}</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">{item.deskripsi}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-blue-700">{item.action}<Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></div></div></Link>)}</div></section>
      <footer className="flex flex-col gap-1 border-t border-slate-200 pt-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>Modul Sarana dan Prasarana · Administrasi Sekolah Digital</span><span>Pengelolaan aset sekolah yang lebih tertib dan terarah</span></footer>
    </div>
  );
}
