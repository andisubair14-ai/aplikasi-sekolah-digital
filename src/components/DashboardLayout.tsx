import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

type RoleType = 'admin' | 'guru' | 'kepsek';

export default function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [role, setRole] = useState<RoleType>('admin');
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  
  // State untuk Dropdown Profil & Modal Edit
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState({ name: 'Andi Subair, S.Pd., M.M.', email: 'admin@sekolah.sch.id' });
  const [tempProfile, setTempProfile] = useState({ name: '', email: '' });
  
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Default profile based on role
  const defaultProfiles = {
    admin: { name: 'Andi Subair, S.Pd., M.M.', email: 'admin@sekolah.sch.id' },
    guru: { name: 'Budi Santoso, S.Pd.', email: 'guru@sekolah.sch.id' },
    kepsek: { name: 'Hj. Siti Aminah, M.Pd.', email: 'kepsek@sekolah.sch.id' }
  };

  // Muat data user dari localStorage saat pertama kali dimuat
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') as RoleType;
    const activeRole = savedRole || 'admin';
    setRole(activeRole);

    const savedProfile = localStorage.getItem(`profile_${activeRole}`);
    if (savedProfile) {
      setProfileData(JSON.parse(savedProfile));
    } else {
      setProfileData(defaultProfiles[activeRole]);
    }
  }, []);

  // Tutup dropdown jika klik di luar area
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

  // Fungsi Ganti Peran
  const handleRoleChange = (newRole: RoleType) => {
    localStorage.setItem('userRole', newRole);
    setRole(newRole);
    
    // Ambil profil dari role baru
    const savedProfile = localStorage.getItem(`profile_${newRole}`);
    if (savedProfile) {
      setProfileData(JSON.parse(savedProfile));
    } else {
      setProfileData(defaultProfiles[newRole]);
    }
    setIsProfileOpen(false);
    navigate('/dashboard'); // Redirect ke dashboard agar menu ter-refresh
  };

  // Fungsi Simpan Profil
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(`profile_${role}`, JSON.stringify(tempProfile));
    setProfileData(tempProfile);
    setIsEditProfileOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-[#F5F7FB] overflow-hidden font-sans">
      
      {/* ===== SIDEBAR ===== */}
      <aside className={`
        absolute z-50 h-full bg-[#082B62] text-slate-300 flex flex-col transition-all duration-300
        md:relative md:translate-x-0 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'md:w-20' : 'w-64'}
      `}>
        
        {/* Header Sidebar */}
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
              <img src={`https://ui-avatars.com/api/?name=${profileData.name}&background=155EEF&color=fff&rounded=true`} alt="User" className="w-10 h-10 rounded-full border-2 border-[#155EEF]" />
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{profileData.name}</p>
                <p className="text-xs text-[#10B981] flex items-center gap-1 font-medium capitalize">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span> {role === 'kepsek' ? 'Kepala Sekolah' : role}
                </p>
              </div>
            </div>
          )}

          {/* Toggle Collapse Button */}
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
          <Link to="/dashboard" className={`flex items-center gap-4 px-4 py-3 mx-3 rounded-xl font-semibold transition-all ${isActive('/dashboard') ? 'bg-[#155EEF] text-white shadow-lg shadow-blue-900/50' : 'hover:bg-white/10 hover:text-white'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            {!isSidebarCollapsed && <span>Dashboard</span>}
          </Link>

          {/* DATA MASTER (Hanya Admin) */}
          {(role === 'admin') && (
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
                  <Link to="/dashboard/siswa" className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard/siswa') ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Data Siswa</Link>
                  <Link to="/dashboard/guru" className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard/guru') ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Data Guru</Link>
                  <Link to="/dashboard/kelas" className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard/kelas') ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Data Kelas</Link>
                </div>
              )}
            </div>
          )}

          {/* AKADEMIK (Admin, Guru, Kepsek) */}
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
                <Link to="/dashboard/absensi" className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard/absensi') ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Absensi</Link>
                <Link to="/dashboard/jadwal" className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard/jadwal') ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Jadwal Pelajaran</Link>
              </div>
            )}
          </div>

          {/* LAINNYA (Hanya Admin) */}
          {(role === 'admin' || role === 'kepsek') && (
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
                  <Link to="/dashboard/sarpras" className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard/sarpras') ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Sarpras</Link>
                  <Link to="/dashboard/pengumuman" className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard/pengumuman') ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Pengumuman</Link>
                  {role === 'admin' && (
                    <Link to="/dashboard/pengaturan" className={`block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard/pengaturan') ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>Pengaturan</Link>
                  )}
                </div>
              )}
            </div>
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

      {/* OVERLAY MOBILE */}
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
            {/* Notification Bell */}
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            {/* PROFILE DROPDOWN (AKTIF) */}
            <div className="relative" ref={dropdownRef}>
              <div 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 pl-4 border-l border-slate-200 cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-colors select-none"
              >
                <img src={`https://ui-avatars.com/api/?name=${profileData.name}&background=155EEF&color=fff&rounded=true`} alt="User" className="w-9 h-9 rounded-full" />
                <div className="hidden md:block text-left">
                  <p className="text-sm font-bold text-[#082B62] leading-tight truncate max-w-[120px]">{profileData.name}</p>
                  <p className="text-xs text-slate-500 font-medium capitalize">{role === 'kepsek' ? 'Kepala Sekolah' : role}</p>
                </div>
                <svg className={`w-4 h-4 text-slate-400 hidden md:block transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>

              {/* Dropdown Menu Items */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                  {/* Info User */}
                  <div className="px-4 py-3 border-b border-slate-100 mb-1">
                    <p className="text-sm font-bold text-slate-800">{profileData.name}</p>
                    <p className="text-xs text-slate-500">{profileData.email}</p>
                  </div>

                  <button 
                    onClick={() => {
                      setTempProfile(profileData);
                      setIsEditProfileOpen(true);
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Edit Profil Saya
                  </button>

                  <div className="h-px bg-slate-100 my-1"></div>
                  <p className="px-4 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Simulasi Ganti Peran</p>
                  
                  <button onClick={() => handleRoleChange('admin')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${role === 'admin' ? 'text-[#155EEF] font-bold bg-blue-50' : 'text-slate-600'}`}>
                    Administrator {role === 'admin' && '✓'}
                  </button>
                  <button onClick={() => handleRoleChange('guru')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${role === 'guru' ? 'text-[#155EEF] font-bold bg-blue-50' : 'text-slate-600'}`}>
                    Guru Pengampu {role === 'guru' && '✓'}
                  </button>
                  <button onClick={() => handleRoleChange('kepsek')} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${role === 'kepsek' ? 'text-[#155EEF] font-bold bg-blue-50' : 'text-slate-600'}`}>
                    Kepala Sekolah {role === 'kepsek' && '✓'}
                  </button>
                  
                  <div className="h-px bg-slate-100 my-1"></div>

                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* KONTEN HALAMAN */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar relative">
          <Outlet />
        </main>
      </div>

      {/* MODAL EDIT PROFIL */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold text-[#082B62] mb-6">Edit Profil Anda</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={tempProfile.name} 
                  onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})} 
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
                <input 
                  type="email" 
                  value={tempProfile.email} 
                  onChange={(e) => setTempProfile({...tempProfile, email: e.target.value})} 
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" 
                />
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditProfileOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2.5 bg-[#155EEF] hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]">Simpan Profil</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}