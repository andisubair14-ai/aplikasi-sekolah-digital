import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import FotoProfilGuru from '../components/FotoProfilGuru';

interface GuruProfile {
  id: string;
  nama?: string;
  nip?: string;
  nuptk?: string;
  mapel?: string;
  jabatan?: string;
  kelasDiampu?: string[];
  noHp?: string;
  alamat?: string;
}

interface KelasProfile {
  id: string;
  namaKelas?: string;
  jenjang?: string;
  tingkat?: number | string;
  tahunAjaran?: string;
  waliKelasId?: string | null;
}

const teks = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : '-';

const angkaRomawi = (value: number | string | undefined): string => {
  const n = Number.parseInt(String(value ?? ''), 10);
  const map: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX',
  };
  return map[n] || (value === undefined || value === null || value === '' ? '-' : String(value));
};

function Ikon({ jenis, className = 'h-5 w-5' }: { jenis: 'user' | 'briefcase' | 'book' | 'phone' | 'map' | 'id' | 'mail' | 'shield' | 'school'; className?: string }) {
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

  switch (jenis) {
    case 'user': return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.5 3-5.3 7-5.3s6.3 1.8 7 5.3"/></svg>;
    case 'briefcase': return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>;
    case 'book': return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M8 7h8"/></svg>;
    case 'phone': return <svg {...common}><path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM10 18h4"/></svg>;
    case 'map': return <svg {...common}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/></svg>;
    case 'id': return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.5 16c.5-1.4 1.3-2 2.5-2s2 .6 2.5 2M13 10h5M13 14h5"/></svg>;
    case 'mail': return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>;
    case 'shield': return <svg {...common}><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/></svg>;
    case 'school': return <svg {...common}><path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-6h6v6M3 20h18"/></svg>;
  }
}

const BATAS_FOTO_DATA_URL = 480000;
const BATAS_FILE_ASLI = 5 * 1024 * 1024;

async function kompresFotoMenjadiDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  const gambar = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      gambar.onload = () => resolve();
      gambar.onerror = () => reject(new Error('File gambar tidak dapat dibaca.'));
      gambar.src = objectUrl;
    });

    const ukuranMaksimal = 512;
    const skala = Math.min(1, ukuranMaksimal / Math.max(gambar.naturalWidth, gambar.naturalHeight));
    const lebar = Math.max(1, Math.round(gambar.naturalWidth * skala));
    const tinggi = Math.max(1, Math.round(gambar.naturalHeight * skala));
    const canvas = document.createElement('canvas');
    canvas.width = lebar;
    canvas.height = tinggi;

    const konteks = canvas.getContext('2d');
    if (!konteks) throw new Error('Browser tidak dapat memproses gambar.');

    konteks.fillStyle = '#FFFFFF';
    konteks.fillRect(0, 0, lebar, tinggi);
    konteks.drawImage(gambar, 0, 0, lebar, tinggi);

    let kualitas = 0.82;
    let hasil = canvas.toDataURL('image/jpeg', kualitas);
    while (hasil.length > BATAS_FOTO_DATA_URL && kualitas > 0.42) {
      kualitas -= 0.07;
      hasil = canvas.toDataURL('image/jpeg', kualitas);
    }

    if (hasil.length > BATAS_FOTO_DATA_URL) {
      throw new Error('Ukuran foto masih terlalu besar setelah dikompres. Pilih foto lain dengan resolusi lebih kecil.');
    }

    return hasil;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function BarisInfo({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: 'user' | 'id' | 'phone' | 'map' | 'mail' | 'briefcase' | 'book';
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:p-4">
      <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-700"><Ikon jenis={icon} className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilGuru() {
  const { user, userData } = useAuth();
  const guruId = userData?.guruId || '';

  const [guru, setGuru] = useState<GuruProfile | null>(null);
  const [kelasList, setKelasList] = useState<KelasProfile[]>([]);
  const [loadingGuru, setLoadingGuru] = useState(true);
  const [loadingKelas, setLoadingKelas] = useState(true);
  const [errorGuru, setErrorGuru] = useState('');
  const [errorKelas, setErrorKelas] = useState('');
  const [fileFoto, setFileFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [sedangMenyimpanFoto, setSedangMenyimpanFoto] = useState(false);
  const [pesanFoto, setPesanFoto] = useState('');
  const [errorFoto, setErrorFoto] = useState('');
  const inputFotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewFoto) return;
    return () => {
      if (previewFoto.startsWith('blob:')) URL.revokeObjectURL(previewFoto);
    };
  }, [previewFoto]);

  useEffect(() => {
    if (!guruId) {
      setGuru(null);
      setLoadingGuru(false);
      setErrorGuru('Akun ini belum ditautkan ke data pegawai. Silakan hubungi Admin sekolah.');
      return;
    }

    setLoadingGuru(true);
    setErrorGuru('');
    const berhenti = onSnapshot(
      doc(db, 'guru', guruId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setGuru(null);
          setErrorGuru('Data pegawai yang terhubung dengan akun ini tidak ditemukan.');
        } else {
          setGuru({ id: snapshot.id, ...snapshot.data() } as GuruProfile);
          setErrorGuru('');
        }
        setLoadingGuru(false);
      },
      (error) => {
        console.error('Gagal membaca profil Guru:', error);
        setErrorGuru('Profil pegawai tidak dapat dibaca. Periksa koneksi dan hak akses Firebase.');
        setLoadingGuru(false);
      }
    );

    return () => berhenti();
  }, [guruId]);

  useEffect(() => {
    setLoadingKelas(true);
    const berhenti = onSnapshot(
      collection(db, 'kelas'),
      (snapshot) => {
        setKelasList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as KelasProfile[]);
        setErrorKelas('');
        setLoadingKelas(false);
      },
      (error) => {
        console.error('Gagal membaca daftar rombel profil Guru:', error);
        setErrorKelas('Daftar rombel belum dapat dimuat. Informasi profil lainnya tetap dapat dilihat.');
        setLoadingKelas(false);
      }
    );

    return () => berhenti();
  }, []);

  const handlePilihFoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPesanFoto('');
    setErrorFoto('');

    const tipeDiizinkan = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tipeDiizinkan.includes(file.type)) {
      setErrorFoto('Format foto harus JPG, PNG, atau WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > BATAS_FILE_ASLI) {
      setErrorFoto('Ukuran foto asli maksimal 5 MB. Foto akan diperkecil otomatis sebelum disimpan.');
      event.target.value = '';
      return;
    }

    setFileFoto(file);
    setPreviewFoto(URL.createObjectURL(file));
  };

  const handleSimpanFoto = async () => {
    if (!user?.uid || userData?.role !== 'guru') {
      setErrorFoto('Akun Guru tidak terdeteksi. Silakan login ulang.');
      return;
    }
    if (!fileFoto) {
      setErrorFoto('Pilih foto terlebih dahulu.');
      return;
    }

    setSedangMenyimpanFoto(true);
    setPesanFoto('');
    setErrorFoto('');

    try {
      const fotoDataUrl = await kompresFotoMenjadiDataUrl(fileFoto);
      await setDoc(doc(db, 'foto_profil_guru', user.uid), {
        fotoDataUrl,
        contentType: 'image/jpeg',
        updatedAt: serverTimestamp(),
      });
      setFileFoto(null);
      setPreviewFoto(null);
      if (inputFotoRef.current) inputFotoRef.current.value = '';
      setPesanFoto('Foto profil berhasil diperbarui. Foto juga akan tampil pada Dashboard Guru dan header aplikasi.');
    } catch (error) {
      console.error('Gagal menyimpan foto profil Guru:', error);
      const kode = (error as { code?: string })?.code;
      setErrorFoto(
        kode === 'permission-denied'
          ? 'Akses penyimpanan foto ditolak. Pastikan aturan Firestore foto_profil_guru sudah ditambahkan dan diterbitkan.'
          : 'Foto belum berhasil disimpan. Periksa koneksi internet dan hak akses Firebase, lalu coba kembali.'
      );
    } finally {
      setSedangMenyimpanFoto(false);
    }
  };

  const handleHapusFoto = async () => {
    if (!user?.uid || userData?.role !== 'guru') return;
    const setuju = window.confirm('Hapus foto profil dan kembali menggunakan inisial nama?');
    if (!setuju) return;

    setSedangMenyimpanFoto(true);
    setPesanFoto('');
    setErrorFoto('');
    try {
      await deleteDoc(doc(db, 'foto_profil_guru', user.uid));
      setFileFoto(null);
      setPreviewFoto(null);
      if (inputFotoRef.current) inputFotoRef.current.value = '';
      setPesanFoto('Foto profil berhasil dihapus.');
    } catch (error) {
      console.error('Gagal menghapus foto profil Guru:', error);
      setErrorFoto('Foto profil belum berhasil dihapus. Periksa hak akses Firestore.');
    } finally {
      setSedangMenyimpanFoto(false);
    }
  };

  const rombelGuru = useMemo(() => {
    if (!guru) return [];
    const kelasDiampu = Array.isArray(guru.kelasDiampu) ? guru.kelasDiampu : [];
    return kelasList
      .filter((kelas) => kelas.waliKelasId === guru.id || kelasDiampu.includes(kelas.id))
      .sort((a, b) => {
        const jenjangA = String(a.jenjang || '');
        const jenjangB = String(b.jenjang || '');
        if (jenjangA !== jenjangB) return jenjangA === 'SD' ? -1 : 1;
        const tingkatA = Number.parseInt(String(a.tingkat || '0'), 10) || 0;
        const tingkatB = Number.parseInt(String(b.tingkat || '0'), 10) || 0;
        if (tingkatA !== tingkatB) return tingkatA - tingkatB;
        return String(a.namaKelas || '').localeCompare(String(b.namaKelas || ''), 'id', { numeric: true });
      });
  }, [guru, kelasList]);

  const namaTampilan = teks(guru?.nama || userData?.nama || 'Nama belum tersedia');
  const roleAktif = userData?.aktif !== false;

  if (loadingGuru && !guru) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        <p className="text-center text-sm text-slate-500">Memuat profil Guru...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <div>
        <p className="text-sm font-semibold text-blue-700">AKUN GURU</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Profil Saya</h1>
        <p className="mt-1 text-sm text-slate-500">Informasi akun dan data kepegawaian yang terhubung dengan login Anda.</p>
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-blue-700 p-5 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-20 right-28 h-48 w-48 rounded-full bg-cyan-300/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <FotoProfilGuru
            uid={user?.uid}
            nama={namaTampilan}
            previewUrl={previewFoto ?? undefined}
            className="h-24 w-24 border-2 border-white/50 shadow-lg sm:h-28 sm:w-28"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">Profil Guru</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${roleAktif ? 'bg-emerald-400/20 text-emerald-100' : 'bg-rose-400/20 text-rose-100'}`}>
                {roleAktif ? 'Akun Aktif' : 'Akun Nonaktif'}
              </span>
            </div>
            <h2 className="mt-3 break-words text-2xl font-bold sm:text-3xl">{namaTampilan}</h2>
            <p className="mt-1 text-sm text-blue-100">{teks(guru?.jabatan)}{guru?.mapel && guru.mapel !== '-' ? ` • ${guru.mapel}` : ''}</p>
            <p className="mt-2 flex items-center gap-2 break-all text-xs text-blue-100/90"><Ikon jenis="mail" className="h-4 w-4 shrink-0" />{user?.email || '-'}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:min-w-40">
            <p className="text-xs text-blue-100">Status akun</p>
            <p className="mt-1 text-lg font-bold">{roleAktif ? 'Terverifikasi' : 'Perlu pemeriksaan'}</p>
            <p className="mt-1 text-xs text-blue-100">Akses berdasarkan peran Guru</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900">Foto Profil</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Pilih foto wajah yang jelas. Foto akan otomatis diperkecil dan ditampilkan pada Profil Saya, Dashboard Guru, serta header aplikasi.
            </p>
            <p className="mt-1 text-xs text-slate-500">Format JPG, PNG, atau WebP. Ukuran file asli maksimal 5 MB.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePilihFoto}
              className="hidden"
              aria-label="Pilih foto profil"
            />
            <button
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              disabled={sedangMenyimpanFoto}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {fileFoto ? 'Pilih Foto Lain' : 'Pilih Foto'}
            </button>
            {fileFoto && (
              <button
                type="button"
                onClick={handleSimpanFoto}
                disabled={sedangMenyimpanFoto}
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sedangMenyimpanFoto ? 'Menyimpan...' : 'Simpan Foto'}
              </button>
            )}
            {!fileFoto && (
              <button
                type="button"
                onClick={handleHapusFoto}
                disabled={sedangMenyimpanFoto}
                className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hapus Foto
              </button>
            )}
          </div>
        </div>
        {pesanFoto && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{pesanFoto}</p>}
        {errorFoto && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{errorFoto}</p>}
      </section>

      {errorGuru && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Informasi profil</p>
          <p className="mt-1">{errorGuru}</p>
        </div>
      )}

      {guru && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Ikon jenis="user" /></div>
              <div>
                <h3 className="font-bold text-slate-900">Identitas dan Kepegawaian</h3>
                <p className="text-xs text-slate-500">Data yang tersimpan pada Data Pegawai sekolah.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <BarisInfo label="Nama Lengkap" value={teks(guru.nama)} icon="user" />
              <BarisInfo label="Jabatan" value={teks(guru.jabatan)} icon="briefcase" />
              <BarisInfo label="NIP" value={teks(guru.nip)} icon="id" />
              <BarisInfo label="NUPTK" value={teks(guru.nuptk)} icon="id" />
              <BarisInfo label="Mata Pelajaran" value={teks(guru.mapel)} icon="book" />
              <BarisInfo label="Nomor HP" value={teks(guru.noHp)} icon="phone" />
              <div className="sm:col-span-2"><BarisInfo label="Alamat" value={teks(guru.alamat)} icon="map" /></div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><Ikon jenis="school" /></div>
                <div>
                  <h3 className="font-bold text-slate-900">Rombel yang Ditugaskan</h3>
                  <p className="text-xs text-slate-500">Berdasarkan penugasan pada Data Kelas & Rombel.</p>
                </div>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">{rombelGuru.length}</span>
            </div>
            {loadingKelas ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Memuat penugasan rombel...</p>
            ) : errorKelas ? (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{errorKelas}</p>
            ) : rombelGuru.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {rombelGuru.map((kelas) => (
                  <div key={kelas.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white font-bold text-blue-800 shadow-sm"><Ikon jenis="school" /></div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{teks(kelas.namaKelas)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{teks(kelas.jenjang)} • Tingkat {angkaRomawi(kelas.tingkat)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Tahun ajaran: {teks(kelas.tahunAjaran)}</p>
                    </div>
                    {kelas.waliKelasId === guru.id && <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Wali Kelas</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <p className="text-sm font-semibold text-slate-700">Belum ada rombel yang ditautkan</p>
                <p className="mt-1 text-xs text-slate-500">Penugasan rombel dapat diperiksa melalui Admin pada menu Data Kelas & Rombel atau Data Pegawai.</p>
              </div>
            )}
          </section>
        </>
      )}

      <section className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5">
        <div className="mt-0.5 rounded-xl bg-white p-2 text-blue-700 shadow-sm"><Ikon jenis="shield" /></div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Perubahan data profil</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">Halaman ini menampilkan data secara baca-saja agar data kepegawaian dan penugasan tetap dikelola dari satu sumber. Untuk koreksi nama, NIP, NUPTK, jabatan, mata pelajaran, nomor HP, atau alamat, silakan hubungi Admin sekolah melalui pengelolaan Data Pegawai.</p>
        </div>
      </section>
    </div>
  );
}
