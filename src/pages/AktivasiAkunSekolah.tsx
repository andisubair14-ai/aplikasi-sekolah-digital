import { useMemo, useState, type FormEvent } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

type ActivationRequest = {
  token: string;
  nama: string;
  email: string;
  password: string;
};
type ActivationResponse = {
  success: boolean;
  role: 'admin' | 'guru' | 'kepsek';
  sekolahId: string;
  kodeAkun: string;
  message: string;
};

// Menggunakan instance functions terpusat dari ../lib/firebase
// sehingga secara konsisten mengikuti mode emulator atau online.
const activateAccount = httpsCallable<
  ActivationRequest,
  ActivationResponse
>(
  functions,
  'aktifkanAkunSekolah',
);
const roleLabel: Record<ActivationResponse['role'], string> = {
  admin: 'Administrator Sekolah',
  guru: 'Guru',
  kepsek: 'Kepala Sekolah',
};

export default function AktivasiAkunSekolah() {
  const token = useMemo(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    return params.get('token')?.trim() ?? '';
  }, []);

  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');
  const [lihatPassword, setLihatPassword] = useState(false);
  const [sedangMemproses, setSedangMemproses] = useState(false);
  const [pesanError, setPesanError] = useState('');
  const [hasil, setHasil] = useState<ActivationResponse | null>(null);

  const passwordValid = password.length >= 10;
  const passwordSama = password === konfirmasiPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPesanError('');

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setPesanError('Tautan aktivasi tidak valid. Pastikan Anda membuka tautan lengkap dari email.');
      return;
    }
    if (nama.trim().length < 2) {
      setPesanError('Masukkan nama lengkap minimal 2 karakter.');
      return;
    }
    if (!passwordValid) {
      setPesanError('Kata sandi minimal 10 karakter.');
      return;
    }
    if (!passwordSama) {
      setPesanError('Konfirmasi kata sandi belum sama.');
      return;
    }

    setSedangMemproses(true);
    try {
      const response = await activateAccount({
        token,
        nama: nama.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setHasil(response.data);
      // Hapus token dari address bar setelah aktivasi berhasil.
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      setPassword('');
      setKonfirmasiPassword('');
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      const code = firebaseError.code ?? '';
      const messages: Record<string, string> = {
        'functions/not-found': 'Tautan aktivasi tidak ditemukan atau sudah tidak berlaku.',
        'functions/deadline-exceeded': 'Tautan aktivasi sudah kedaluwarsa. Hubungi administrator sekolah.',
        'functions/failed-precondition': 'Tautan sudah digunakan atau sedang diproses. Silakan coba beberapa saat lagi.',
        'functions/already-exists': 'Email ini sudah terdaftar. Gunakan email pribadi lain.',
        'functions/invalid-argument': 'Data yang dimasukkan belum valid. Periksa kembali formulir.',
        'functions/unavailable': 'Layanan sedang tidak tersedia. Coba kembali nanti.',
      };
      setPesanError(messages[code] ?? 'Aktivasi belum berhasil. Periksa koneksi internet dan coba kembali.');
    } finally {
      setSedangMemproses(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef4ff] px-4 py-10">
      <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-indigo-200/50 blur-3xl" />

      <section className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white bg-white shadow-[0_24px_80px_rgba(30,64,125,.14)]">
        <div className="bg-gradient-to-r from-[#123c8c] via-[#1762c5] to-[#4b65d5] px-7 py-8 text-white sm:px-10">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-2xl">🔐</div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-100">Aplikasi Sekolah Digital</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Aktivasi Akun Sekolah</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-blue-100">Lengkapi identitas dan buat kata sandi pribadi untuk mengaktifkan akun Anda.</p>
        </div>

        <div className="px-7 py-8 sm:px-10">
          {hasil ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</div>
              <h2 className="mt-5 text-2xl font-extrabold text-slate-900">Aktivasi Berhasil!</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Akun {roleLabel[hasil.role]} Anda sudah dibuat. Silakan masuk menggunakan email dan kata sandi yang baru dibuat.</p>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
                <p className="text-slate-500">Kode akun</p>
                <p className="mt-1 break-all font-bold text-slate-900">{hasil.kodeAkun}</p>
                <p className="mt-4 text-slate-500">ID sekolah</p>
                <p className="mt-1 font-bold text-slate-900">{hasil.sekolahId}</p>
              </div>
              <a href="/" className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-bold text-white transition hover:bg-blue-800">Masuk ke Aplikasi</a>
            </div>
          ) : !/^[a-f0-9]{64}$/i.test(token) ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
              <div className="text-3xl">⚠️</div>
              <h2 className="mt-3 font-bold text-amber-900">Tautan Aktivasi Tidak Valid</h2>
              <p className="mt-2 text-sm leading-relaxed text-amber-800">Token aktivasi tidak ditemukan. Silakan buka tautan aktivasi lengkap yang dikirim ke email Anda.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="nama-aktivasi" className="mb-2 block text-sm font-bold text-slate-800">Nama lengkap</label>
                <input id="nama-aktivasi" autoComplete="name" required minLength={2} maxLength={120} value={nama} onChange={(event) => setNama(event.target.value)} placeholder="Masukkan nama lengkap" className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </div>

              <div>
                <label htmlFor="email-aktivasi" className="mb-2 block text-sm font-bold text-slate-800">Email pribadi untuk login</label>
                <input id="email-aktivasi" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                <p className="mt-1.5 text-xs text-slate-500">Gunakan email pribadi yang belum terdaftar di aplikasi.</p>
              </div>

              <div>
                <label htmlFor="password-aktivasi" className="mb-2 block text-sm font-bold text-slate-800">Buat kata sandi</label>
                <div className="relative">
                  <input id="password-aktivasi" type={lihatPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 10 karakter" className="h-12 w-full rounded-xl border border-slate-300 px-4 pr-20 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                  <button type="button" onClick={() => setLihatPassword((value) => !value)} className="absolute inset-y-0 right-3 text-xs font-bold text-blue-700">{lihatPassword ? 'Sembunyikan' : 'Lihat'}</button>
                </div>
              </div>

              <div>
                <label htmlFor="konfirmasi-password" className="mb-2 block text-sm font-bold text-slate-800">Konfirmasi kata sandi</label>
                <input id="konfirmasi-password" type={lihatPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={10} value={konfirmasiPassword} onChange={(event) => setKonfirmasiPassword(event.target.value)} placeholder="Ulangi kata sandi" className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                {konfirmasiPassword && !passwordSama && <p className="mt-1.5 text-xs text-red-600">Kata sandi belum sama.</p>}
              </div>

              {pesanError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">{pesanError}</div>}

              <button type="submit" disabled={sedangMemproses || !passwordValid || !passwordSama} className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-5 text-sm font-extrabold text-white shadow-lg shadow-blue-900/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                {sedangMemproses ? 'Memproses aktivasi...' : 'Aktifkan Akun Saya'}
              </button>
              <p className="text-center text-xs leading-relaxed text-slate-500">Jangan bagikan tautan aktivasi atau kata sandi kepada siapa pun.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
