import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Mohon isi Email dan Password!');
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      
      setLoading(false);
      localStorage.setItem('userRole', 'admin'); 
      alert('Login Berhasil! Selamat datang.');
      navigate('/dashboard');
    } catch (error: any) {
      setLoading(false);
      alert('Login Gagal: ' + (error.message || 'Terjadi kesalahan sistem'));
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F7FB] font-sans">
      
      {/* ===== Left Side - Image + Branding (Navy Blue Overlay) ===== */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden bg-[#0B1F46]">
        <img
          src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=1932&auto=format&fit=crop"
          alt="School Building"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B1F46]/90 via-[#0B1F46]/95 to-[#155EEF]/80"></div>
        
        <div className="relative z-10 flex flex-col justify-between p-16 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#155EEF] rounded-xl flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-500/30">
              S
            </div>
            <span className="text-xl font-bold tracking-wide">Sekolah Digital</span>
          </div>
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
                Solusi Cerdas <br />
                <span className="text-[#EFF6FF]">Administrasi Sekolah</span>
              </h1>
              <p className="text-blue-100 text-lg leading-relaxed max-w-md opacity-90">
                Platform terpadu untuk mengelola data siswa, guru, absensi, nilai, dan laporan akademik dengan efisien dan aman.
              </p>
            </div>
            <div className="space-y-4 pt-4 border-t border-white/10">
              {["Manajemen data terpusat & real-time", "Laporan otomatis siap unduh", "Keamanan data standar pendidikan"].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#155EEF]/30 flex items-center justify-center text-sm text-[#EFF6FF] border border-blue-400/30">✓</div>
                  <span className="text-blue-50 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-blue-300/60 text-sm font-medium">© 2026 Aplikasi Administrasi Sekolah Digital</p>
        </div>
      </div>

      {/* ===== Right Side - Login Form ===== */}
      <div className="w-full lg:w-[50%] flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-[#155EEF] rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md">S</div>
            <span className="text-xl font-bold text-[#0B1F46]">Sekolah Digital</span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-[#0B1F46] mb-2">Selamat Datang 👋</h2>
            <p className="text-slate-500 font-medium">Silakan masuk ke akun administrator Anda.</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            
            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Masukkan Email"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] transition-all font-medium shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700">Password</label>
                <a href="#" className="text-sm text-[#155EEF] hover:text-blue-800 font-semibold transition-colors">Lupa password?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] transition-all font-medium shadow-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 bg-[#155EEF] hover:bg-blue-700 transition-all duration-200 active:scale-[0.98] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Memproses...' : 'Masuk ke Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}