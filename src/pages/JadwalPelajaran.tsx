import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type Hari = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

type JadwalRecord = {
  id: string;
  kelasId: string;
  namaKelas: string;
  jenjang: string;
  guruId: string;
  namaGuru: string;
  mataPelajaran: string;
  hari: Hari;
  jamMulai: string;
  jamSelesai: string;
  ruang: string;
  tahunAjaran: string;
  semester: string;
  keterangan: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdByUid?: string;
  updatedByUid?: string;
};

type KelasRecord = {
  id: string;
  namaKelas?: string;
  jenjang?: string;
  tingkat?: number | string;
  tahunAjaran?: string;
  semester?: string;
  waliKelasId?: string;
};

type GuruRecord = {
  id: string;
  nama?: string;
  nip?: string;
  mapel?: string;
  jabatan?: string;
  kelasDiampu?: string[];
};

type TahunRecord = {
  id: string;
  tahun?: string;
  semester?: string;
  status?: string;
};

type FormJadwal = {
  kelasId: string;
  guruId: string;
  mataPelajaran: string;
  hari: Hari;
  jamMulai: string;
  jamSelesai: string;
  ruang: string;
  tahunAjaran: string;
  semester: string;
  keterangan: string;
};

const HARI: Hari[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const FORM_KOSONG: FormJadwal = {
  kelasId: '', guruId: '', mataPelajaran: '', hari: 'Senin',
  jamMulai: '07:00', jamSelesai: '08:00', ruang: '',
  tahunAjaran: '', semester: 'Ganjil', keterangan: '',
};

const teks = (value: unknown) => String(value ?? '').trim();
const jamValid = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const bentrokWaktu = (awalA: string, akhirA: string, awalB: string, akhirB: string) =>
  awalA < akhirB && awalB < akhirA;
const kelasLabel = (kelas: KelasRecord) =>
  `${kelas.namaKelas || 'Rombel'}${kelas.jenjang ? ` · ${kelas.jenjang}` : ''}`;

export default function JadwalPelajaran() {
  const { userData } = useAuth();
  const role = teks(userData?.role);
  const uid = teks(userData?.uid);
  const guruIdLogin = teks(userData?.guruId);
  const isAdmin = role === 'admin';
  const isGuru = role === 'guru';

  const [jadwalList, setJadwalList] = useState<JadwalRecord[]>([]);
  const [kelasList, setKelasList] = useState<KelasRecord[]>([]);
  const [guruList, setGuruList] = useState<GuruRecord[]>([]);
  const [tahunList, setTahunList] = useState<TahunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [errorData, setErrorData] = useState('');
  const [search, setSearch] = useState('');
  const [filterHari, setFilterHari] = useState('Semua');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterTahun, setFilterTahun] = useState('Semua');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormJadwal>(FORM_KOSONG);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setErrorData('Sesi pengguna tidak ditemukan. Silakan login kembali.');
      return;
    }

    if (isGuru && !guruIdLogin) {
      setLoading(false);
      setErrorData('Akun Guru belum terhubung dengan Data Pegawai. Hubungi Administrator untuk menghubungkan akun melalui Manajemen Pengguna.');
      return;
    }

    setLoading(true);
    setErrorData('');

    const jadwalQuery = isGuru
      ? query(collection(db, 'jadwal_pelajaran'), where('guruId', '==', guruIdLogin))
      : collection(db, 'jadwal_pelajaran');

    const unsubJadwal = onSnapshot(
      jadwalQuery,
      (snapshot) => {
        const hasil = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as JadwalRecord[];
        hasil.sort((a, b) => HARI.indexOf(a.hari) - HARI.indexOf(b.hari) || a.jamMulai.localeCompare(b.jamMulai));
        setJadwalList(hasil);
        setLoading(false);
        setErrorData('');
      },
      (error) => {
        console.error('Gagal memuat jadwal pelajaran:', error);
        setErrorData('Jadwal belum dapat dimuat. Periksa koneksi Firebase dan Firestore Rules.');
        setLoading(false);
      },
    );

    let unsubKelas: (() => void) | undefined;
    let unsubGuru: (() => void) | undefined;
    let unsubTahun: (() => void) | undefined;

    if (isAdmin) {
      let masterSiap = 0;
      const masterSelesai = () => {
        masterSiap += 1;
        if (masterSiap >= 3) setLoadingMaster(false);
      };
      unsubKelas = onSnapshot(collection(db, 'kelas'), (snapshot) => {
        setKelasList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as KelasRecord[]);
        masterSelesai();
      }, (error) => {
        console.error('Gagal memuat rombel:', error);
        setErrorData('Data rombel tidak dapat dibaca. Periksa Firestore Rules.');
        masterSelesai();
      });
      unsubGuru = onSnapshot(collection(db, 'guru'), (snapshot) => {
        setGuruList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as GuruRecord[]);
        masterSelesai();
      }, (error) => {
        console.error('Gagal memuat guru:', error);
        setErrorData('Data Guru tidak dapat dibaca. Periksa Firestore Rules.');
        masterSelesai();
      });
      unsubTahun = onSnapshot(collection(db, 'tahun_ajaran'), (snapshot) => {
        setTahunList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TahunRecord[]);
        masterSelesai();
      }, (error) => {
        console.error('Gagal memuat tahun ajaran:', error);
        setErrorData('Data Tahun Ajaran tidak dapat dibaca. Periksa Firestore Rules.');
        masterSelesai();
      });
    } else {
      setLoadingMaster(false);
    }

    return () => {
      unsubJadwal();
      unsubKelas?.();
      unsubGuru?.();
      unsubTahun?.();
    };
  }, [uid, isAdmin, isGuru, guruIdLogin]);

  const tahunAktif = useMemo(() => tahunList.find((item) => item.status === 'Aktif'), [tahunList]);
  const opsiTahun = useMemo(() => {
    const dariMaster = tahunList.map((item) => teks(item.tahun || item.id)).filter(Boolean);
    const dariKelas = kelasList.map((item) => teks(item.tahunAjaran)).filter((item) => item && item !== '-');
    return [...new Set([...dariMaster, ...dariKelas])].sort((a, b) => b.localeCompare(a));
  }, [tahunList, kelasList]);

  const jadwalTampil = useMemo(() => {
    const kata = search.toLowerCase();
    return jadwalList.filter((item) => {
      const cocokCari = !kata || [item.namaKelas, item.namaGuru, item.mataPelajaran, item.ruang].some((v) => teks(v).toLowerCase().includes(kata));
      const cocokHari = filterHari === 'Semua' || item.hari === filterHari;
      const cocokKelas = filterKelas === 'Semua' || item.kelasId === filterKelas;
      const cocokTahun = filterTahun === 'Semua' || item.tahunAjaran === filterTahun;
      return cocokCari && cocokHari && cocokKelas && cocokTahun;
    });
  }, [jadwalList, search, filterHari, filterKelas, filterTahun]);

  const jumlahHariAktif = useMemo(() => new Set(jadwalList.map((item) => item.hari)).size, [jadwalList]);
  const jumlahGuru = useMemo(() => new Set(jadwalList.map((item) => item.guruId)).size, [jadwalList]);
  const jumlahKelas = useMemo(() => new Set(jadwalList.map((item) => item.kelasId)).size, [jadwalList]);

  const bukaTambah = () => {
    setEditId(null);
    setForm({
      ...FORM_KOSONG,
      tahunAjaran: teks(tahunAktif?.tahun || tahunAktif?.id || opsiTahun[0]),
      semester: teks(tahunAktif?.semester || 'Ganjil') || 'Ganjil',
    });
    setModalOpen(true);
  };

  const bukaEdit = (jadwal: JadwalRecord) => {
    setEditId(jadwal.id);
    setForm({
      kelasId: jadwal.kelasId,
      guruId: jadwal.guruId,
      mataPelajaran: jadwal.mataPelajaran,
      hari: jadwal.hari,
      jamMulai: jadwal.jamMulai,
      jamSelesai: jadwal.jamSelesai,
      ruang: jadwal.ruang || '',
      tahunAjaran: jadwal.tahunAjaran,
      semester: jadwal.semester,
      keterangan: jadwal.keterangan || '',
    });
    setModalOpen(true);
  };

  const simpanJadwal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin || !uid) return;

    const kelas = kelasList.find((item) => item.id === form.kelasId);
    const guru = guruList.find((item) => item.id === form.guruId);
    if (!kelas || !guru) {
      alert('Pilih rombel dan Guru yang valid.');
      return;
    }
    if (!form.mataPelajaran.trim() || !form.tahunAjaran.trim() || !form.semester.trim()) {
      alert('Mata pelajaran, tahun ajaran, dan semester wajib diisi.');
      return;
    }
    if (teks(kelas.tahunAjaran) && teks(kelas.tahunAjaran) !== '-' && teks(kelas.tahunAjaran) !== form.tahunAjaran) {
      alert(`Rombel ${kelas.namaKelas || ''} tercatat untuk tahun ajaran ${kelas.tahunAjaran}. Sesuaikan pilihan tahun ajaran jadwal.`);
      return;
    }
    if (!jamValid(form.jamMulai) || !jamValid(form.jamSelesai) || form.jamMulai >= form.jamSelesai) {
      alert('Periksa jam mulai dan jam selesai. Jam selesai harus lebih akhir daripada jam mulai.');
      return;
    }

    const bentrok = jadwalList.find((item) =>
      item.id !== editId && item.hari === form.hari && item.tahunAjaran === form.tahunAjaran &&
      item.semester === form.semester && bentrokWaktu(form.jamMulai, form.jamSelesai, item.jamMulai, item.jamSelesai) &&
      (item.kelasId === form.kelasId || item.guruId === form.guruId || (form.ruang.trim() && teks(item.ruang).toLowerCase() === form.ruang.trim().toLowerCase()))
    );
    if (bentrok) {
      const sebab = bentrok.kelasId === form.kelasId ? 'rombel' : bentrok.guruId === form.guruId ? 'Guru' : 'ruang';
      alert(`Jadwal bentrok: ${sebab} tersebut sudah memiliki jadwal pada ${bentrok.hari}, ${bentrok.jamMulai}–${bentrok.jamSelesai}.`);
      return;
    }

    const namaKelas = teks(kelas.namaKelas) || kelas.id;
    const dataJadwal = {
      kelasId: kelas.id,
      namaKelas,
      jenjang: teks(kelas.jenjang),
      guruId: guru.id,
      namaGuru: teks(guru.nama) || 'Guru',
      mataPelajaran: form.mataPelajaran.trim(),
      hari: form.hari,
      jamMulai: form.jamMulai,
      jamSelesai: form.jamSelesai,
      ruang: form.ruang.trim(),
      tahunAjaran: form.tahunAjaran.trim(),
      semester: form.semester.trim(),
      keterangan: form.keterangan.trim(),
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
    };

    setIsSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, 'jadwal_pelajaran', editId), dataJadwal);
        alert('Jadwal pelajaran berhasil diperbarui.');
      } else {
        const ref = doc(collection(db, 'jadwal_pelajaran'));
        await setDoc(ref, {
          ...dataJadwal,
          createdAt: serverTimestamp(),
          createdByUid: uid,
        });
        alert('Jadwal pelajaran berhasil ditambahkan.');
      }
      setModalOpen(false);
      setEditId(null);
    } catch (error) {
      console.error('Gagal menyimpan jadwal:', error);
      alert('Jadwal belum berhasil disimpan. Periksa koneksi dan Firestore Rules.');
    } finally {
      setIsSaving(false);
    }
  };

  const hapusJadwal = async (jadwal: JadwalRecord) => {
    if (!isAdmin) return;
    if (!window.confirm(`Hapus jadwal ${jadwal.mataPelajaran} kelas ${jadwal.namaKelas} pada hari ${jadwal.hari}?`)) return;
    try {
      await deleteDoc(doc(db, 'jadwal_pelajaran', jadwal.id));
      alert('Jadwal berhasil dihapus.');
    } catch (error) {
      console.error('Gagal menghapus jadwal:', error);
      alert('Jadwal belum dapat dihapus. Periksa koneksi dan Firestore Rules.');
    }
  };

  const eksporCSV = () => {
    const rows = [
      ['Hari', 'Jam Mulai', 'Jam Selesai', 'Mata Pelajaran', 'Kelas', 'Guru', 'Ruang', 'Tahun Ajaran', 'Semester'],
      ...jadwalTampil.map((item) => [item.hari, item.jamMulai, item.jamSelesai, item.mataPelajaran, item.namaKelas, item.namaGuru, item.ruang, item.tahunAjaran, item.semester]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Jadwal_Pelajaran_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const judulHalaman = isGuru ? 'Jadwal Mengajar Saya' : 'Jadwal Pelajaran Sekolah';

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .jadwal-print, .jadwal-print * { visibility: visible !important; }
          .jadwal-print { position: absolute; inset: 0; width: 100%; padding: 18px; background: white; color: #111827; }
          .jadwal-no-print { display: none !important; }
          .jadwal-print-only { display: block !important; }
        }
      `}</style>

      <section className="rounded-3xl bg-gradient-to-r from-[#082B62] via-[#10468B] to-[#1766B8] p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide">
              <span>▦</span> AKADEMIK · PENGELOLAAN WAKTU BELAJAR
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">{judulHalaman}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              {isGuru ? 'Lihat jadwal mengajar Anda berdasarkan penugasan yang dicatat sekolah.' : 'Atur pembagian waktu pelajaran, rombel, dan penugasan Guru dalam satu kalender sekolah.'}
            </p>
          </div>
          {isAdmin && <button onClick={bukaTambah} className="jadwal-no-print rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#0B3A78] shadow hover:bg-blue-50">+ Tambah Jadwal</button>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Jadwal', value: jadwalList.length, hint: 'Catatan jadwal tersimpan', icon: '▦' },
          { label: 'Hari Terjadwal', value: jumlahHariAktif, hint: 'Hari sekolah memiliki jadwal', icon: '◷' },
          { label: 'Guru Terlibat', value: jumlahGuru, hint: 'Guru dalam jadwal', icon: '♙' },
          { label: 'Rombel Terjadwal', value: jumlahKelas, hint: 'Kelas memiliki jadwal', icon: '⌂' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{item.label}</p><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700">{item.icon}</span></div>
            <p className="mt-3 text-3xl font-extrabold text-[#082B62]">{item.value}</p>
            <p className="mt-1 text-xs text-slate-400">{item.hint}</p>
          </div>
        ))}
      </section>

      {errorData && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorData}</div>}

      <section className="jadwal-no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-bold text-[#082B62]">Daftar Jadwal</h2><p className="mt-1 text-xs text-slate-500">{isGuru ? 'Jadwal yang ditugaskan kepada akun Anda.' : 'Kelola jadwal berdasarkan hari, rombel, dan tahun ajaran.'}</p></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={eksporCSV} disabled={!jadwalTampil.length} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">Ekspor CSV</button>
            <button onClick={() => window.print()} disabled={!jadwalTampil.length} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-40">Cetak Jadwal</button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari mapel, Guru, kelas, ruang..." className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
          <select value={filterHari} onChange={(e) => setFilterHari(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="Semua">Semua Hari</option>{HARI.map((hari) => <option key={hari}>{hari}</option>)}</select>
          {isAdmin && <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="Semua">Semua Rombel</option>{kelasList.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelasLabel(kelas)}</option>)}</select>}
          {isAdmin && <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="Semua">Semua Tahun Ajaran</option>{opsiTahun.map((tahun) => <option key={tahun}>{tahun}</option>)}</select>}
        </div>
      </section>

      <section className="jadwal-print overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden border-b border-slate-200 p-6 text-center jadwal-print-only">
          <h2 className="text-lg font-bold uppercase">JADWAL PELAJARAN SEKOLAH</h2>
          <p className="mt-1 text-sm">{filterTahun === 'Semua' ? 'Seluruh Tahun Ajaran' : filterTahun}</p>
          <p className="mt-1 text-xs">Dicetak: {new Date().toLocaleDateString('id-ID')}</p>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-[#082B62]">Jadwal Mingguan</h2><p className="mt-1 text-xs text-slate-500">{jadwalTampil.length} jadwal ditampilkan</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{filterHari === 'Semua' ? 'Semua Hari' : filterHari}</span></div>
        {loading || (isAdmin && loadingMaster) ? <div className="p-12 text-center text-sm text-slate-500">Memuat data jadwal...</div> : jadwalTampil.length === 0 ? <div className="p-12 text-center"><div className="text-4xl text-slate-300">▦</div><p className="mt-3 font-bold text-slate-700">Belum ada jadwal yang sesuai</p><p className="mt-1 text-sm text-slate-500">{isAdmin ? 'Tambahkan jadwal pertama atau sesuaikan filter pencarian.' : 'Belum ada penugasan jadwal untuk akun Anda.'}</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Hari</th><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Mata Pelajaran</th><th className="px-4 py-3">Kelas</th><th className="px-4 py-3">Guru</th><th className="px-4 py-3">Ruang</th><th className="px-4 py-3">Tahun Ajaran</th>{isAdmin && <th className="px-4 py-3">Aksi</th>}</tr></thead>
              <tbody className="divide-y divide-slate-100">{jadwalTampil.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-[#082B62]">{item.hari}</td><td className="whitespace-nowrap px-4 py-3 tabular-nums">{item.jamMulai}–{item.jamSelesai}</td><td className="px-4 py-3 font-semibold text-slate-800">{item.mataPelajaran}</td><td className="px-4 py-3">{item.namaKelas}</td><td className="px-4 py-3">{item.namaGuru}</td><td className="px-4 py-3">{item.ruang || '-'}</td><td className="px-4 py-3">{item.tahunAjaran}<span className="block text-xs text-slate-400">Semester {item.semester}</span></td>{isAdmin && <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => bukaEdit(item)} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700">Ubah</button><button onClick={() => hapusJadwal(item)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700">Hapus</button></div></td>}</tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="hidden jadwal-print-only mt-10 px-6 pb-8 text-right text-sm"><p>Mengetahui,</p><p className="mt-1 font-semibold">Kepala Sekolah</p><div className="h-16"/><p className="font-bold underline">........................................</p></div>
      </section>

      {isGuru && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Jadwal ini bersifat baca-saja. Perubahan jadwal dilakukan oleh Administrator sekolah.</div>}

      {modalOpen && isAdmin && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-extrabold text-[#082B62]">{editId ? 'Ubah Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran'}</h2><p className="mt-1 text-xs text-slate-500">Pilih rombel dan Guru dari data master sekolah.</p></div><button onClick={() => setModalOpen(false)} className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup">✕</button></div>
            <form onSubmit={simpanJadwal} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-slate-700">Rombel<select required value={form.kelasId} onChange={(e) => setForm((prev) => ({ ...prev, kelasId: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"><option value="">Pilih rombel</option>{kelasList.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelasLabel(kelas)}</option>)}</select></label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">Guru pengampu<select required value={form.guruId} onChange={(e) => { const guru = guruList.find((item) => item.id === e.target.value); setForm((prev) => ({ ...prev, guruId: e.target.value, mataPelajaran: prev.mataPelajaran || (guru?.mapel && guru.mapel !== '-' ? guru.mapel : '') })); }} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"><option value="">Pilih Guru</option>{guruList.filter((guru) => guru.jabatan !== 'Tenaga Kependidikan').map((guru) => <option key={guru.id} value={guru.id}>{guru.nama || guru.id}{guru.jabatan ? ` · ${guru.jabatan}` : ''}</option>)}</select></label>
              <label className="space-y-1 text-sm font-semibold text-slate-700 sm:col-span-2">Mata pelajaran<input required value={form.mataPelajaran} onChange={(e) => setForm((prev) => ({ ...prev, mataPelajaran: e.target.value }))} placeholder="Contoh: Matematika" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/></label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">Hari<select value={form.hari} onChange={(e) => setForm((prev) => ({ ...prev, hari: e.target.value as Hari }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal">{HARI.map((hari) => <option key={hari}>{hari}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-sm font-semibold text-slate-700">Jam mulai<input type="time" required value={form.jamMulai} onChange={(e) => setForm((prev) => ({ ...prev, jamMulai: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/></label><label className="space-y-1 text-sm font-semibold text-slate-700">Jam selesai<input type="time" required value={form.jamSelesai} onChange={(e) => setForm((prev) => ({ ...prev, jamSelesai: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/></label></div>
              <label className="space-y-1 text-sm font-semibold text-slate-700">Tahun ajaran<select required value={form.tahunAjaran} onChange={(e) => setForm((prev) => ({ ...prev, tahunAjaran: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"><option value="">Pilih tahun ajaran</option>{opsiTahun.map((tahun) => <option key={tahun}>{tahun}</option>)}</select></label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">Semester<input required value={form.semester} onChange={(e) => setForm((prev) => ({ ...prev, semester: e.target.value }))} placeholder="Ganjil / Genap" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/></label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">Ruang (opsional)<input value={form.ruang} onChange={(e) => setForm((prev) => ({ ...prev, ruang: e.target.value }))} placeholder="Contoh: Ruang 3A" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/></label>
              <label className="space-y-1 text-sm font-semibold text-slate-700 sm:col-span-2">Keterangan (opsional)<textarea rows={2} value={form.keterangan} onChange={(e) => setForm((prev) => ({ ...prev, keterangan: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/></label>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800 sm:col-span-2">Sistem akan menolak jadwal yang bertabrakan pada rombel, Guru, atau ruang yang sama di hari, tahun ajaran, dan semester yang sama.</div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Batal</button><button type="submit" disabled={isSaving} className="rounded-xl bg-[#155EEF] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isSaving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Jadwal'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
