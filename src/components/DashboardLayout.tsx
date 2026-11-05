import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ambil data user asli dari Firebase AuthContext
  const { userData } = useAuth();
  
  // Tentukan base path berdasarkan role
  const basePath = userData?.role === 'admin' ? '/admin' : userData?.role === 'guru' ? '/guru' : '/kepsek';
  const namaUser = userData?.nama || 'Pengguna';
  const emailUser = userData?.email || 'user@sekolah.sch.id';
  const roleLabel = userData?.role === 'admin' ? 'Administrator' : userData?.role === 'guru' ? 'Guru' : 'Kepala Sekolah';

  // Role Check
  const isAdmin = userData?.role === 'admin';
  const isGuru = userData?.role === 'guru';
  const isKepsek = userData?.role === 'kepsek';

  // Tutup dropdown profil jika klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const toggleMenu = (menu: string) => {
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      alert('Gagal logout');
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F7FB] overflow-hidden font-sans">
      
      {/* ===== SIDEBAR PREMIUM (NAVY BLUE) ===== */}
      <aside className={`
        absolute z-50 h-full bg-[#082B62] text-slate-300 flex flex-col transition-all duration-300
        md:relative md:translate-x-0 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'md:w-20' : 'w-64'}
      `}>
        
        {/* Header Sidebar (Logo & Profile) */}
        <div className="pt-6 pb-4 px-4 flex flex-col items-center border-b border-white/10 relative">
          <div className={`flex items-center justify-center gap-3 w-full ${isSidebarCollapsed ? 'flex-col' : ''}`}>
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1 shadow-lg">
              <svg className="w-8 h-8 text-[#155EEF]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3L2 8v2h20V8L12 3zm0 2.18l6.75 3.36H5.25L12 5.18zM4 12v7h2v-5h4v5h2v-7H4zm10 0v7h2v-5h4v5h2v-7h-8zM2 21h20v2H2v-2z"/>
              </svg>
            </div>
            {!isSidebarCollapsed && (
              <div className="text-center mt-2">
                <h1 className="text-white font-bold text-lg leading-tight tracking-wide">Sekolah Digital</h1>
                <p className="text-blue-200 text-xs font-medium">SMP Negeri 1</p>
              </div>
            )}
          </div>

          {/* Profile Mini Sidebar */}
          {!isSidebarCollapsed && (
            <div className="mt-6 flex items-center gap-3 w-full bg-white/5 p-2 rounded-xl border border-white/10">
              <img src={`https://ui-avatars.com/api/?name=${namaUser}&background=155EEF&color=fff&rounded=true`} alt="User" className="w-10 h-10 rounded-full border-2 border-[#155EEF]" />
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{namaUser}</p>
                <p className="text-xs text-[#10B981] flex items-center gap-1 font-medium capitalize">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span> {roleLabel}
                </p>
              </div>
            </div>
          )}

          {/* Tombol Collapse Sidebar (Desktop) */}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute -right-3 top-8 bg-[#155EEF] text-white p-1.5 rounded-full border-2 border-[#082B62] shadow-md hover:bg-blue-600 transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>

        {/* Menu Navigasi */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 custom-scrollbar">
          
          {/* Dashboard */}
          <Link to={`${basePath}/dashboard`} className={`flex items-center gap-4 px-4 py-3 mx-3 rounded-xl font-semibold transition-all ${isActive(`${basePath}/dashboard`) ? 'bg-[#155EEF] text-white shadow-lg shadow-blue-900/50' : 'hover:bg-white/10 hover:text-white'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            {!isSidebarCollapsed && <span>Dashboard</span>}
          </Link>

          {/* ================= MENU ADMIN ================= */}
          {isAdmin && (
            <>
              <div className="mt-2">
                <button onClick={() => toggleMenu('master')} className={`w-full flex items-center justify-between px-4 py-3 mx-3 rounded-xl font-semibold transition-all hover:bg-white/10 hover:text-white`}>
                  <div className="flex items-center gap-4">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                    {!isSidebarCollapsed && <span>Data Master</span>}
                  </div>
                  {!isSidebarCollapsed && <svg className={`w-4 h-4 transition-transform ${openMenus['master'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>}
                </button>
                {openMenus['master'] && !isSidebarCollapsed && (
                  <div className="ml-8 pl-4 border-l border-white/20 mt-1 space-y-1">
                    <Link to={`${basePath}/siswa`} className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(`${basePath}/siswa`) ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Data Siswa</Link>
                    <Link to={`${basePath}/guru`} className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(`${basePath}/guru`) ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Data Guru</Link>
                    <Link to={`${basePath}/kelas`} className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(`${basePath}/kelas`) ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Data Kelas</Link>
                  </div>
                )}
              </div>

              <div className="mt-1">
                <button onClick={() => toggleMenu('akademik')} className={`w-full flex items-center justify-between px-4 py-3 mx-3 rounded-xl font-semibold transition-all hover:bg-white/10 hover:text-white`}>
                  <div className="flex items-center gap-4">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    {!isSidebarCollapsed && <span>Akademik</span>}
                  </div>
                  {!isSidebarCollapsed && <svg className={`w-4 h-4 transition-transform ${openMenus['akademik'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>}
                </button>
                {openMenus['akademik'] && !isSidebarCollapsed && (
                  <div className="ml-8 pl-4 border-l border-white/20 mt-1 space-y-1">
                    <Link to={`${basePath}/absensi`} className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(`${basePath}/absensi`) ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Absensi</Link>
                    <Link to={`${basePath}/jadwal`} className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(`${basePath}/jadwal`) ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Jadwal Pelajaran</Link>
                  </div>
                )}
              </div>

              <div className="mt-1">
                <button onClick={() => toggleMenu('lainnya')} className={`w-full flex items-center justify-between px-4 py-3 mx-3 rounded-xl font-semibold transition-all hover:bg-white/10 hover:text-white`}>
                  <div className="flex items-center gap-4">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                    {!isSidebarCollapsed && <span>Lainnya</span>}
                  </div>
                  {!isSidebarCollapsed && <svg className={`w-4 h-4 transition-transform ${openMenus['lainnya'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>}
                </button>
                {openMenus['lainnya'] && !isSidebarCollapsed && (
                  <div className="ml-8 pl-4 border-l border-white/20 mt-1 space-y-1">
                    <Link to={`${basePath}/sarpras`} className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(`${basePath}/sarpras`) ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Sarpras</Link>
                    <Link to={`${basePath}/pengumuman`} className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(`${basePath}/pengumuman`) ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Pengumuman</Link>
                    <Link to={`${basePath}/pengaturan`} className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive(`${basePath}/pengaturan`) ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Pengaturan</Link>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ================= MENU GURU ================= */}
          {isGuru && (
            <>
              <Link to={`${basePath}/siswa`} className={`flex items-center gap-4 px-4 py-3 mx-3 mt-2 rounded-xl font-semibold transition-all ${isActive(`${basePath}/siswa`) ? 'bg-[#155EEF] text-white shadow-lg shadow-blue-900/50' : 'hover:bg-white/10 hover:text-white'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                {!isSidebarCollapsed && <span>Kelas Diampu</span>}
              </Link>
              <Link to={`${basePath}/absensi`} className={`flex items-center gap-4 px-4 py-3 mx-3 mt-1 rounded-xl font-semibold transition-all ${isActive(`${basePath}/absensi`) ? 'bg-[#155EEF] text-white shadow-lg shadow-blue-900/50' : 'hover:bg-white/10 hover:text-white'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                {!isSidebarCollapsed && <span>Absensi Siswa</span>}
              </Link>
              <Link to={`${basePath}/jadwal`} className={`flex items-center gap-4 px-4 py-3 mx-3 mt-1 rounded-xl font-semibold transition-all ${isActive(`${basePath}/jadwal`) ? 'bg-[#155EEF] text-white shadow-lg shadow-blue-900/50' : 'hover:bg-white/10 hover:text-white'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {!isSidebarCollapsed && <span>Jadwal Mengajar</span>}
              </Link>
            </>
          )}

          {/* ================= MENU KEPALA SEKOLAH ================= */}
          {isKepsek && (
            <>
              <Link to={`${basePath}/monitoring-siswa`} className={`flex items-center gap-4 px-4 py-3 mx-3 mt-2 rounded-xl font-semibold transition-all ${isActive(`${basePath}/monitoring-siswa`) ? 'bg-[#155EEF] text-white shadow-lg shadow-blue-900/50' : 'hover:bg-white/10 hover:text-white'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                {!isSidebarCollapsed && <span>Monitoring Siswa</span>}
              </Link>
              <Link to={`${basePath}/monitoring-guru`} className={`flex items-center gap-4 px-4 py-3 mx-3 mt-1 rounded-xl font-semibold transition-all ${isActive(`${basePath}/monitoring-guru`) ? 'bg-[#155EEF] text-white shadow-lg shadow-blue-900/50' : 'hover:bg-white/10 hover:text-white'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                {!isSidebarCollapsed && <span>Monitoring Guru</span>}
              </Link>
              <Link to={`${basePath}/laporan`} className={`flex items-center gap-4 px-4 py-3 mx-3 mt-1 rounded-xl font-semibold transition-all ${isActive(`${basePath}/laporan`) ? 'bg-[#155EEF] text-white shadow-lg shadow-blue-900/50' : 'hover:bg-white/10 hover:text-white'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {!isSidebarCollapsed && <span>Laporan Sekolah</span>}
              </Link>
            </>
          )}
        </nav>

        {/* Footer Sidebar */}
        {!isSidebarCollapsed && (
          <div className="p-6 mt-auto relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#155EEF]/20 to-transparent"></div>
            <div className="relative z-10 text-center">
              <p className="text-xs text-white font-bold tracking-wider mb-1">Maju Bersama</p>
              <p className="text-[11px] text-blue-200">Menuju Sekolah Digital</p>
            </div>
          </div>
        )}
      </aside>

      {/* OVERLAY MOBILE (Layar gelap saat menu samping terbuka di HP) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* ===== MAIN CONTENT AREA ===== */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        
        {/* HEADER PREMIUM */}
        <header className="h-20 bg-white flex items-center justify-between px-4 sm:px-6 shadow-sm z-30 relative">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h2 className="text-xl font-bold text-[#082B62] hidden sm:block">Sistem Informasi Sekolah</h2>
              <p className="text-xs text-slate-500 hidden sm:block mt-0.5">Kelola data sekolah dengan mudah dan cepat</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Ikon Lonceng Notifikasi */}
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            {/* PROFIL DROPDOWN */}
            <div className="relative" ref={dropdownRef}>
              <div 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 pl-4 border-l border-slate-200 cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-colors select-none"
              >
                <img src={`https://ui-avatars.com/api/?name=${namaUser}&background=155EEF&color=fff&rounded=true`} alt="User" className="w-9 h-9 rounded-full" />
                <div className="hidden md:block text-left">
                  <p className="text-sm font-bold text-[#082B62] leading-tight truncate max-w-[120px]">{namaUser}</p>
                  <p className="text-xs text-slate-500 font-medium capitalize">{roleLabel}</p>
                </div>
                <svg className={`w-4 h-4 text-slate-400 hidden md:block transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>

              {/* Menu Dropdown Profil */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1">
                    <p className="text-sm font-bold text-slate-800">{namaUser}</p>
                    <p className="text-xs text-slate-500">{emailUser}</p>
                  </div>

                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors mt-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* KONTEN HALAMAN (Tempat Dashboard Admin/Guru/Kepsek dimuat) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar relative">
          <Outlet />
        </main>
      </div>

    </div>
  );
}