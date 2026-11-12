
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import FotoProfilKepsek from '../components/FotoProfilKepsek';

interface SekolahProfile {
  namaSekolah?: string;
  jenjangSekolah?: string[];
  alamatSekolah?: string;
  teleponSekolah?: string;
  emailSekolah?: string;
  kepalaSekolah?: string;
  namaKepalaSekolah?: string;
  nipKepalaSekolah?: string;
}

const BATAS_FOTO_DATA_URL = 480000;
const BATAS_FILE_ASLI = 5 * 1024 * 1024;

const tampilkan = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '-';
};

async function kompresFoto(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  const gambar = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      gambar.onload = () => resolve();
      gambar.onerror = () => reject(new Error('File gambar tidak dapat dibaca.'));
      gambar.src = objectUrl;
    });

    const ukuranMaksimal = 512;
    const skala = Math.min(
      1,
      ukuranMaksimal / Math.max(gambar.naturalWidth, gambar.naturalHeight)
    );

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
      throw new Error('Ukuran foto masih terlalu besar setelah dikompres.');
    }

    return hasil;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function Ikon({
  jenis,
  className = 'h-5 w-5',
}: {
  jenis: 'user' | 'mail' | 'school' | 'id' | 'phone' | 'map' | 'shield' | 'book';
  className?: string;
}) {
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
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.5 3-5.3 7-5.3s6.3 1.8 7 5.3" /></svg>;
    case 'mail':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
    case 'school':
      return <svg {...common}><path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-6h6v6M3 20h18" /></svg>;
    case 'id':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M5.5 16c.5-1.4 1.3-2 2.5-2s2 .6 2.5 2M13 10h5M13 14h5" /></svg>;
    case 'phone':
      return <svg {...common}><path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM10 18h4" /></svg>;
    case 'map':
      return <svg {...common}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" /></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="m9 12 2 2 4-4" /></svg>;
    case 'book':
      return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" /><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M8 7h8" /></svg>;
  }
}

function KartuInfo({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: 'user' | 'mail' | 'school' | 'id' | 'phone' | 'map' | 'shield' | 'book';
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:p-4">
      <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-700">
        <Ikon jenis={icon} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilKepsek() {
  const { user, userData } = useAuth();
  const [sekolah, setSekolah] = useState<SekolahProfile | null>(null);
  const [loadingSekolah, setLoadingSekolah] = useState(true);
  const [errorSekolah, setErrorSekolah] = useState('');

  const [fileFoto, setFileFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  const [pesanFoto, setPesanFoto] = useState('');
  const [errorFoto, setErrorFoto] = useState('');
  const inputFotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const berhenti = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      (snapshot) => {
        setSekolah(snapshot.exists() ? (snapshot.data() as SekolahProfile) : null);
        setErrorSekolah('');
        setLoadingSekolah(false);
      },
      (error) => {
        console.error('Gagal membaca identitas sekolah:', error);
        setErrorSekolah('Identitas sekolah belum dapat dimuat. Periksa koneksi dan hak akses Firestore.');
        setLoadingSekolah(false);
      }
    );

    return () => berhenti();
  }, []);

  useEffect(() => {
    if (!previewFoto) return;

    return () => {
      if (previewFoto.startsWith('blob:')) {
        URL.revokeObjectURL(previewFoto);
      }
    };
  }, [previewFoto]);

  const nama = tampilkan(userData?.nama);
  const email = tampilkan(user?.email || userData?.email);
  const aktif = userData?.aktif !== false;

  const jenjang = Array.isArray(sekolah?.jenjangSekolah)
    ? sekolah.jenjangSekolah.filter((item) => item === 'SD' || item === 'SMP').join(' / ')
    : '-';

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
      setErrorFoto('Ukuran foto asli maksimal 5 MB.');
      event.target.value = '';
      return;
    }

    setFileFoto(file);
    setPreviewFoto(URL.createObjectURL(file));
  };

  const handleSimpanFoto = async () => {
    if (!user?.uid || userData?.role !== 'kepsek') {
      setErrorFoto('Akun Kepala Sekolah tidak terdeteksi. Silakan login ulang.');
      return;
    }

    if (!fileFoto) {
      setErrorFoto('Pilih foto terlebih dahulu.');
      return;
    }

    setSedangMenyimpan(true);
    setPesanFoto('');
    setErrorFoto('');

    try {
      const fotoDataUrl = await kompresFoto(fileFoto);

      await setDoc(doc(db, 'foto_profil_kepsek', user.uid), {
        fotoDataUrl,
        contentType: 'image/jpeg',
        updatedAt: serverTimestamp(),
      });

      setFileFoto(null);
      setPreviewFoto(null);

      if (inputFotoRef.current) inputFotoRef.current.value = '';

      setPesanFoto('Foto profil Kepala Sekolah berhasil diperbarui.');
    } catch (error) {
      console.error('Gagal menyimpan foto profil Kepsek:', error);
      const kode = (error as { code?: string })?.code;

      setErrorFoto(
        kode === 'permission-denied'
          ? 'Akses penyimpanan foto ditolak. Pastikan Firestore Rules foto_profil_kepsek sudah diterbitkan.'
          : 'Foto belum berhasil disimpan. Periksa koneksi internet dan coba kembali.'
      );
    } finally {
      setSedangMenyimpan(false);
    }
  };

  const handleHapusFoto = async () => {
    if (!user?.uid || userData?.role !== 'kepsek') return;

    if (!window.confirm('Apakah Anda yakin ingin menghapus foto profil?')) return;

    setSedangMenyimpan(true);
    setPesanFoto('');
    setErrorFoto('');

    try {
      await deleteDoc(doc(db, 'foto_profil_kepsek', user.uid));

      setFileFoto(null);
      setPreviewFoto(null);

      if (inputFotoRef.current) inputFotoRef.current.value = '';

      setPesanFoto('Foto profil berhasil dihapus.');
    } catch (error) {
      console.error('Gagal menghapus foto profil Kepsek:', error);
      setErrorFoto('Foto belum berhasil dihapus. Periksa hak akses Firestore.');
    } finally {
      setSedangMenyimpan(false);
    }
  };

  if (!user || userData?.role !== 'kepsek') {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Halaman ini hanya dapat diakses oleh akun Kepala Sekolah. Silakan login menggunakan akun yang sesuai.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <div>
        <p className="text-sm font-semibold tracking-wide text-blue-700">AKUN KEPALA SEKOLAH</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Profil Saya</h1>
        <p className="mt-1 text-sm text-slate-500">
          Informasi akun Kepala Sekolah dan identitas sekolah yang terhubung dengan aplikasi.
        </p>
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-20 right-28 h-48 w-48 rounded-full bg-cyan-300/10 blur-2xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <FotoProfilKepsek
            uid={user.uid}
            nama={nama === '-' ? 'Kepala Sekolah' : nama}
            previewUrl={previewFoto}
            className="h-24 w-24 border-2 border-white/40 text-3xl font-extrabold text-white shadow-lg sm:h-28 sm:w-28"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                Profil Kepala Sekolah
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${aktif ? 'bg-emerald-400/20 text-emerald-100' : 'bg-rose-400/20 text-rose-100'}`}>
                {aktif ? 'Akun Aktif' : 'Akun Nonaktif'}
              </span>
            </div>

            <h2 className="mt-3 break-words text-2xl font-bold sm:text-3xl">{nama}</h2>
            <p className="mt-1 text-sm text-blue-100">Kepala Sekolah</p>
            <p className="mt-2 flex items-center gap-2 break-all text-xs text-blue-100/90">
              <Ikon jenis="mail" className="h-4 w-4 shrink-0" />
              {email}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:min-w-40">
            <p className="text-xs text-blue-100">Hak akses</p>
            <p className="mt-1 text-lg font-bold">Kepala Sekolah</p>
            <p className="mt-1 text-xs text-blue-100">Monitoring dan pengelolaan sesuai peran</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900">Foto Profil</h3>
            <p className="mt-1 text-sm text-slate-600">
              Foto akan tampil pada Profil Saya dan bagian avatar aplikasi.
            </p>
            <p className="mt-1 text-xs text-slate-500">Format JPG, PNG, atau WebP. Ukuran maksimal 5 MB.</p>
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
              disabled={sedangMenyimpan}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
            >
              {fileFoto ? 'Pilih Foto Lain' : 'Pilih Foto'}
            </button>

            {fileFoto ? (
              <button
                type="button"
                onClick={handleSimpanFoto}
                disabled={sedangMenyimpan}
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {sedangMenyimpan ? 'Menyimpan...' : 'Simpan Foto'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleHapusFoto}
                disabled={sedangMenyimpan}
                className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                Hapus Foto
              </button>
            )}
          </div>
        </div>

        {pesanFoto && (
          <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {pesanFoto}
          </p>
        )}

        {errorFoto && (
          <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errorFoto}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Ikon jenis="user" /></div>
          <div>
            <h3 className="font-bold text-slate-900">Informasi Akun</h3>
            <p className="text-xs text-slate-500">Data diambil dari akun yang sedang digunakan untuk masuk.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <KartuInfo label="Nama Lengkap" value={nama} icon="user" />
          <KartuInfo label="Email Login" value={email} icon="mail" />
          <KartuInfo label="Peran Pengguna" value="Kepala Sekolah" icon="shield" />
          <KartuInfo label="Status Akun" value={aktif ? 'Aktif' : 'Nonaktif'} icon="id" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><Ikon jenis="school" /></div>
          <div>
            <h3 className="font-bold text-slate-900">Identitas Sekolah</h3>
            <p className="text-xs text-slate-500">Informasi yang tersedia pada Pengaturan Sekolah.</p>
          </div>
        </div>

        {loadingSekolah ? (
          <div className="space-y-3">
            <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : errorSekolah ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {errorSekolah}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <KartuInfo label="Nama Sekolah" value={tampilkan(sekolah?.namaSekolah)} icon="school" />
            <KartuInfo label="Jenjang Pendidikan" value={jenjang || '-'} icon="book" />
            <KartuInfo label="Nama Kepala Sekolah pada Pengaturan" value={tampilkan(sekolah?.namaKepalaSekolah || sekolah?.kepalaSekolah)} icon="user" />
            <KartuInfo label="NIP Kepala Sekolah pada Pengaturan" value={tampilkan(sekolah?.nipKepalaSekolah)} icon="id" />
            <KartuInfo label="Telepon Sekolah" value={tampilkan(sekolah?.teleponSekolah)} icon="phone" />
            <KartuInfo label="Email Sekolah" value={tampilkan(sekolah?.emailSekolah)} icon="mail" />
            <div className="sm:col-span-2">
              <KartuInfo label="Alamat Sekolah" value={tampilkan(sekolah?.alamatSekolah)} icon="map" />
            </div>
          </div>
        )}

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Kolom yang belum diisi pada Pengaturan Sekolah akan ditampilkan sebagai tanda '-'. Halaman ini tidak mengubah identitas sekolah.
        </p>
      </section>

      <section className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5">
        <div className="mt-0.5 rounded-xl bg-white p-2 text-blue-700 shadow-sm"><Ikon jenis="shield" /></div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Keamanan dan perubahan data</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Data akun dibaca dari users/{'{uid}'} melalui AuthContext, sedangkan identitas sekolah dibaca dari pengaturan/sekolah. Foto profil disimpan terpisah berdasarkan UID akun Kepala Sekolah.
          </p>
        </div>
      </section>
    </div>
  );
}
