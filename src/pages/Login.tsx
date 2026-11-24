
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  getIdTokenResult,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import gambarSekolah from '../assets/sekolah.png';

export default function Login() {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  
  const navigate = useNavigate();

  // LOGIN FIREBASE - PLATFORM OWNER DAN ROLE SEKOLAH
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      alert('Mohon isi Email dan Password!');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Periksa Custom Claim Platform Owner
      const tokenResult = await getIdTokenResult(
        userCredential.user,
        true
      );

      if (tokenResult.claims.platformOwner === true) {
        navigate('/platform-control', { replace: true });
        return;
      }

      // Login pengguna sekolah tetap menggunakan Firestore
      const docRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const role = docSnap.data().role;

        if (role === 'admin') {
          navigate('/admin/dashboard');
        } else if (role === 'guru') {
          navigate('/guru/dashboard');
        } else if (role === 'kepsek') {
          navigate('/kepsek/dashboard');
        } else {
          alert('Role akun tidak dikenali. Hubungi Admin.');
        }
      } else {
        alert(
          'Akun Anda belum terdaftar di database pengguna. Hubungi Admin.'
        );
      }
    } catch (error: any) {
      alert(
        'Login Gagal: ' +
          (error.message || 'Terjadi kesalahan sistem')
      );
    } finally {
      setLoading(false);
    }
  };

  // LUPA PASSWORD FIREBASE
  const handleResetPassword = async () => {
    if (!email.trim()) {
      alert('Masukkan email terlebih dahulu untuk mengatur ulang password.');
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());

      alert(
        'Link pengaturan ulang password telah dikirim ke email Anda. Silakan periksa kotak masuk.'
      );
    } catch (error: any) {
      alert(
        'Gagal mengirim email: ' +
          (error.message || 'Terjadi kesalahan sistem')
      );
    } finally {
      setResetLoading(false);
    }
  };


    return (
  <div className="min-h-screen w-full flex bg-[#F3F7FF] font-sans overflow-hidden">

      {/* =====================================
          PANEL KIRI - SEKOLAH DIGITAL
      ===================================== */}

      <section className="hidden lg:flex lg:w-[57%] xl:w-[57%] min-h-screen relative overflow-hidden bg-[#063477]">

        {/* Background Sekolah */}
        <img
          src={gambarSekolah}
          alt="Gedung Sekolah Digital"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Overlay - dibuat lebih transparan agar gedung terlihat */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#052A65]/75 via-[#063B7A]/30 to-transparent" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#052D68]/75 via-transparent to-[#063477]/10" />

        {/* Cahaya dekoratif */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />

        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between w-full p-10 xl:p-12 text-white">

          {/* LOGO DAN IDENTITAS */}
          <div className="flex items-center gap-5">

            <div className="w-[68px] h-[68px] bg-white rounded-2xl p-2 shadow-xl flex items-center justify-center shrink-0">
              <img
                src="/tut-wuri-handayani.png"
                alt="Logo Tut Wuri Handayani"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="border-l border-white/50 pl-5">
              <h1 className="text-2xl xl:text-3xl font-extrabold tracking-wide">
                SEKOLAH DIGITAL
              </h1>

              <p className="text-blue-100 text-sm xl:text-base mt-1">
                Sistem Informasi dan Administrasi Sekolah
              </p>
            </div>

          </div>

          {/* KARTU INFORMASI */}
          <div className="max-w-[510px] bg-[#164B83]/65 backdrop-blur-xl border border-white/25 rounded-[26px] p-7 xl:p-8 shadow-2xl">

            <h2 className="text-3xl xl:text-[34px] font-extrabold leading-tight mb-4">
              Solusi Cerdas
              <br />
              <span className="text-blue-100">
                Administrasi Sekolah
              </span>
            </h2>

            <p className="text-blue-50 text-sm xl:text-base leading-relaxed font-medium max-w-[450px]">
              Platform terpadu untuk mengelola data siswa, guru,
              absensi, nilai, dan laporan akademik dengan efisien
              dan aman.
            </p>

            <div className="h-px bg-white/25 my-5" />

            <div className="space-y-4">

              {[
                'Manajemen data terpusat & real-time',
                'Laporan otomatis siap unduh',
                'Keamanan data standar pendidikan',
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">

                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>

                  <span className="text-white font-bold text-sm">
                    {item}
                  </span>

                </div>
              ))}

            </div>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between flex-wrap gap-3 text-blue-100/90 text-xs">

            <p>
              © 2026 Aplikasi Administrasi Sekolah Digital
            </p>

            <p className="tracking-wide">
              Kementerian Pendidikan Dasar dan Menengah
            </p>

          </div>

        </div>
      </section>

      {/* =====================================
          PANEL KANAN - FORM LOGIN
      ===================================== */}

      <section className="relative flex-1 min-h-screen flex items-center justify-center p-5 sm:p-8 lg:p-8 bg-gradient-to-br from-white via-[#F5F8FF] to-[#E4F0FF] overflow-hidden">

        {/* Ornamen gelombang atas */}
        <svg
          className="absolute top-0 right-0 w-full h-52 pointer-events-none"
          viewBox="0 0 600 200"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 0H600V80C480 130 390 20 260 75C140 125 70 95 0 145V0Z"
            fill="#DBEAFE"
            fillOpacity="0.35"
          />
          <path
            d="M180 0C300 100 430 110 600 35"
            stroke="#93C5FD"
            strokeOpacity="0.25"
            strokeWidth="3"
          />
        </svg>

        {/* Ornamen gelombang bawah */}
        <svg
          className="absolute bottom-0 right-0 w-full h-52 pointer-events-none"
          viewBox="0 0 600 200"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 150C150 50 250 210 390 115C480 55 540 80 600 30V200H0V150Z"
            fill="#BFDBFE"
            fillOpacity="0.3"
          />
          <path
            d="M0 175C160 70 260 220 410 130C500 75 550 90 600 55"
            stroke="#93C5FD"
            strokeOpacity="0.3"
            strokeWidth="3"
          />
        </svg>

        {/* Background Mobile */}
        <div className="absolute inset-0 lg:hidden">
          <img
            src={gambarSekolah}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-[#08275B]/85 backdrop-blur-sm" />
        </div>

        {/* KARTU LOGIN */}
        <div className="relative z-10 w-full max-w-[400px] bg-white rounded-[24px] sm:rounded-[28px] p-7 sm:p-8 shadow-[0_20px_55px_rgba(20,60,120,0.13)] border border-blue-100/80">

          {/* Logo Mobile */}
          <div className="lg:hidden flex flex-col items-center mb-7">

            <div className="w-20 h-20 rounded-2xl bg-white p-2 shadow-xl mb-3">
              <img
                src="/tut-wuri-handayani.png"
                alt="Logo Tut Wuri Handayani"
                className="w-full h-full object-contain"
              />
            </div>

            <h1 className="text-xl font-extrabold text-[#12366B]">
              SEKOLAH DIGITAL
            </h1>

            <p className="text-xs text-slate-500 mt-1">
              Sistem Informasi dan Administrasi Sekolah
            </p>

          </div>

          {/* JUDUL */}
          <div className="mb-7">

            <div className="w-10 h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 mb-5" />

            <h2 className="text-[28px] sm:text-[30px] font-extrabold text-[#102D5C] tracking-tight mb-2">
              Selamat Datang 👋
            </h2>

            <p className="text-slate-500 text-sm leading-relaxed">
              Silakan masuk untuk mengakses layanan Sekolah Digital.
            </p>

          </div>

          {/* FORM LOGIN */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* EMAIL */}
            <div>

              <label
                htmlFor="email"
                className="block text-sm font-bold text-[#18345E] mb-2"
              >
                Email
              </label>

              <div className="relative">

                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Masukkan email Anda"
                  autoComplete="username"
                  className="w-full pl-12 pr-4 py-3 bg-[#F3F7FD] border border-[#DCE6F4] rounded-xl text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm"
                  required
                />

              </div>
            </div>

            {/* PASSWORD */}
            <div>

              <div className="flex items-center justify-between mb-2">

                <label
                  htmlFor="password"
                  className="text-sm font-bold text-[#18345E]"
                >
                  Password
                </label>

                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors disabled:opacity-50"
                >
                  {resetLoading ? 'Mengirim...' : 'Lupa password?'}
                </button>

              </div>

              <div className="relative">

                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  autoComplete="current-password"
                  className="w-full pl-12 pr-14 py-3 bg-[#F3F7FD] border border-[#DCE6F4] rounded-xl text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9 7-.2 1-1.2 2.6-2.7 3.8M6.2 6.2C3.8 7.7 2.3 10 2 12c.5 2.5 4 7 10 7 1.2 0 2.3-.2 3.3-.6"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zm10-3a3 3 0 100 6 3 3 0 000-6z"
                      />
                    </svg>
                  )}
                </button>

              </div>
            </div>

            {/* TOMBOL LOGIN */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-3 text-white font-bold text-sm py-3.5 rounded-xl bg-gradient-to-r from-[#0879F9] via-[#155EEF] to-[#123FC2] shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >

              {loading ? (
                <>
                  <svg
                    className="animate-spin w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m-5-4l5-5m0 0l-5-5m5 5H3"
                    />
                  </svg>
                  Masuk ke Dashboard
                </>
              )}

            </button>

            {/* TAUTAN PENDAFTARAN SEKOLAH BARU */}
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-600">
                Sekolah Anda belum terdaftar?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/daftar-sekolah')}
                  className="font-bold text-blue-600 hover:text-blue-800 transition-colors underline underline-offset-2"
                >
                  Daftarkan Sekolah Baru
                </button>
              </p>
            </div>

          </form>

          {/* INFORMASI KEAMANAN */}
          <div className="mt-6">

            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] text-slate-400 font-semibold tracking-wide">
                AKSES PENGGUNA
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#EEF5FF] border border-blue-100 rounded-xl">

              <div className="w-9 h-9 shrink-0 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4"
                  />
                </svg>
              </div>

              <div>
                <p className="text-xs font-bold text-[#18345E]">
                  Akses Aman dan Terpercaya
                </p>

                <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                  Akun disediakan oleh operator sekolah.
                  Hubungi Admin jika mengalami kendala akses.
                </p>
              </div>

            </div>

          </div>

          {/* FOOTER MOBILE */}
          <div className="lg:hidden text-center mt-6">
            <p className="text-xs text-slate-400">
              © 2026 Aplikasi Administrasi Sekolah Digital
            </p>
          </div>

        </div>

      </section>

    </div>
  );
}
