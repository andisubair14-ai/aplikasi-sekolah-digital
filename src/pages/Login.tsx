import { useState } from 'react';

export default function Login() {
  // 1. Menyiapkan tempat penyimpanan sementara untuk email dan password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 2. Fungsi yang akan dijalankan saat tombol ditekan
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault(); // Mencegah halaman ter-refresh saat tombol ditekan
    
    // Cek jika ada kolom yang kosong
    if (!email || !password) {
      alert('Mohon isi Email/NIP dan Password terlebih dahulu!');
      return;
    }

    // Menampilkan alert berisi data yang diketik
    alert(`Tombol Masuk Berhasil Diklik!\n\nEmail/NIP: ${email}\nPassword: ${password}\n\n(Nanti ini akan terhubung ke Supabase)`);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      
      {/* ===== Left Side - Image + Branding ===== */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden">
        {/* Background Image */}
        <img
          src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=1932&auto=format&fit=crop"
          alt="School Building"
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 via-emerald-800/85 to-teal-900/90"></div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl font-bold border border-white/30">
              S
            </div>
            <span className="text-lg font-semibold tracking-wide">Sekolah Digital</span>
          </div>

          {/* Main Text */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold leading-tight mb-4">
                Transformasi Digital<br />
                Administrasi Sekolah
              </h1>
              <p className="text-emerald-100 text-lg leading-relaxed max-w-md">
                Satu platform untuk mengelola data guru, siswa, absensi, nilai, dan laporan akademik secara efisien.
              </p>
            </div>

            {/* Feature Points */}
            <div className="space-y-3 pt-2">
              {[
                "Manajemen data terpusat & real-time",
                "Laporan otomatis siap unduh",
                "Keamanan data sesuai standar pendidikan"
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-400/30 flex items-center justify-center text-sm">
                    ✓
                  </div>
                  <span className="text-emerald-50 text-[15px]">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Branding */}
          <p className="text-emerald-200/70 text-sm">
            Digunakan oleh ratusan sekolah di Indonesia
          </p>
        </div>
      </div>

      {/* ===== Right Side - Login Form ===== */}
      <div className="w-full lg:w-[52%] flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md shadow-emerald-200">
              S
            </div>
            <span className="text-lg font-semibold text-slate-800">Sekolah Digital</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-1.5">Selamat Datang 👋</h2>
            <p className="text-slate-500 text-[15px]">
              Masuk ke akun Anda untuk mengakses dashboard
            </p>
          </div>

          {/* 3. Tambahkan onSubmit={handleLogin} pada form */}
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email / NIP */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email / NIP
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                {/* 4. Tambahkan value dan onChange agar data yang diketik tersimpan */}
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contoh: 1987654321 atau email@sekolah.sch.id"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 
                           focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all text-[15px]"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <a href="#" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
                  Lupa password?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                {/* 5. Tambahkan value dan onChange agar data yang diketik tersimpan */}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 
                           focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all text-[15px]"
                  required
                />
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer select-none">
                Ingat saya di perangkat ini
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold 
                         py-3.5 rounded-xl shadow-lg shadow-emerald-200/60 hover:shadow-emerald-300/70 
                         transition-all duration-200 active:scale-[0.98] text-[15px]"
            >
              Masuk ke Dashboard
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-slate-50 text-slate-400">atau</span>
            </div>
          </div>

          {/* Help Text */}
          <p className="text-center text-sm text-slate-500">
            Butuh bantuan?{" "}
            <a href="#" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Hubungi Admin Sekolah
            </a>
          </p>

          {/* Copyright */}
          <p className="mt-10 text-center text-xs text-slate-400">
            © 2026 Aplikasi Administrasi Sekolah Digital
          </p>
        </div>
      </div>
    </div>
  );
}