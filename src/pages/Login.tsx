import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import gambarSekolah from '../assets/sekolah.jpg'; 

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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const docRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(docRef);
      
      setLoading(false);
      
      if (docSnap.exists()) {
        const role = docSnap.data().role;
        if (role === 'admin') navigate('/admin/dashboard');
        else if (role === 'guru') navigate('/guru/dashboard');
        else if (role === 'kepsek') navigate('/kepsek/dashboard');
        else navigate('/');
      } else {
        alert('Akun Anda belum terdaftar di database pengguna. Hubungi Admin.');
      }
    } catch (error: any) {
      setLoading(false);
      alert('Login Gagal: ' + (error.message || 'Terjadi kesalahan sistem'));
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F7FB] font-sans relative overflow-hidden">
      
      {/* ===== 1. SISI KIRI (HANYA TAMPIL DI LAPTOP/DESKTOP) ===== */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden bg-[#0B1F46]">
        <img
          src={gambarSekolah}
          alt="School Building"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B1F46] via-[#0B1F46]/90 to-transparent"></div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 lg:p-16 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#155EEF] rounded-xl flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-500/50">S</div>
            <span className="text-xl font-bold tracking-wide drop-shadow-md">Sekolah Digital</span>
          </div>
          
          <div className="space-y-6 bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4 drop-shadow-lg">
                Solusi Cerdas <br />
                <span className="text-[#EFF6FF]">Administrasi Sekolah</span>
              </h1>
              <p className="text-blue-50 text-base lg:text-lg leading-relaxed max-w-md font-medium drop-shadow">
                Platform terpadu untuk mengelola data siswa, guru, absensi, nilai, dan laporan akademik dengan efisien dan aman.
              </p>
            </div>
            
            <div className="space-y-4 pt-6 border-t border-white/20">
              {["Manajemen data terpusat & real-time", "Laporan otomatis siap unduh", "Keamanan data standar pendidikan"].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center text-sm text-white shadow-lg shadow-emerald-500/50">✓</div>
                  <span className="text-blue-50 font-bold text-sm lg:text-base">{item}</span>
                </div>
              ))}
            </div>
          </div>
          
          <p className="text-blue-200/80 text-sm font-medium drop-shadow-md">© 2026 Aplikasi Administrasi Sekolah Digital</p>
        </div>
      </div>

      {/* ===== 2. LATAR BELAKANG GAMBAR (HANYA TAMPIL DI HP/TABLET) ===== */}
      <div className="absolute inset-0 lg:hidden z-0">
        <img 
          src={gambarSekolah} 
          alt="School Building" 
          className="w-full h-full object-cover" 
        />
        {/* Lapisan Biru Gelap agar tulisan form tetap terbaca */}
        <div className="absolute inset-0 bg-[#0B1F46]/85 backdrop-blur-sm"></div>
      </div>

      {/* ===== 3. SISI KANAN (FORMULIR LOGIN) ===== */}
      <div className="w-full lg:w-[50%] flex items-center justify-center p-4 sm:p-8 relative z-10">
        
        {/* Kotak Form: Transparan di Desktop, Efek Kaca (Glassmorphism) di HP/Tablet */}
        <div className="w-full max-w-[420px] bg-white/10 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.3)] lg:shadow-none border border-white/20 lg:border-none">
          
          {/* Logo untuk Tampilan HP/Tablet */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-[#155EEF] rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-500/50 mb-4">
              S
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Sekolah Digital</h1>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-white lg:text-[#0B1F46] mb-2 drop-shadow-md lg:drop-shadow-none">Selamat Datang 👋</h2>
            <p className="text-blue-100 lg:text-slate-500 font-medium drop-shadow-sm lg:drop-shadow-none">Silakan masuk ke akun Anda.</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            
            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-white lg:text-slate-700 mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Masukkan Email"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-transparent lg:border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#155EEF]/30 lg:focus:ring-[#155EEF]/10 focus:border-[#155EEF] transition-all font-medium shadow-lg lg:shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-white lg:text-slate-700">Password</label>
                <a href="#" className="text-sm text-blue-200 lg:text-[#155EEF] hover:text-white lg:hover:text-blue-800 font-semibold transition-colors">Lupa password?</a>
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
                  className="w-full pl-12 pr-4 py-3 bg-white border border-transparent lg:border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#155EEF]/30 lg:focus:ring-[#155EEF]/10 focus:border-[#155EEF] transition-all font-medium shadow-lg lg:shadow-sm"
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

          {/* Footer Khusus HP/Tablet */}
          <p className="lg:hidden text-center text-xs text-blue-200/60 font-medium mt-8">© 2026 Aplikasi Administrasi Sekolah Digital</p>
        </div>
      </div>
    </div>
  );
}