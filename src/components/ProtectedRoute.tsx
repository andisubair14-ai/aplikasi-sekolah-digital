import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';

type RoleType = 'admin' | 'guru' | 'kepsek';

interface ProtectedRouteProps {
  allowedRoles: RoleType[];
}

const dashboardByRole: Record<RoleType, string> = {
  admin: '/admin/dashboard',
  guru: '/guru/dashboard',
  kepsek: '/kepsek/dashboard'
};

export default function ProtectedRoute({
  allowedRoles
}: ProtectedRouteProps) {
  const { user, userData, loading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const handleKeluar = async () => {
    setIsSigningOut(true);
    setSignOutError('');

    try {
      await signOut(auth);
      // AuthContext akan mendeteksi logout dan aplikasi kembali ke halaman login.
    } catch (error) {
      console.error('Gagal keluar dari akun:', error);
      setSignOutError('Tidak dapat keluar saat ini. Silakan coba kembali.');
    } finally {
      setIsSigningOut(false);
    }
  };

  // Menunggu pemeriksaan Firebase Authentication dan profil Firestore.
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F5F7FB] text-[#155EEF] font-bold">
        Memeriksa status akun...
      </div>
    );
  }

  // Jika belum login, arahkan ke halaman login.
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Jika profil tidak ditemukan atau tidak dapat dibaca, jangan izinkan akses.
  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB] p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-2xl">
            !
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-3">
            Data Akun Tidak Ditemukan
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Anda berhasil login, tetapi profil pengguna tidak ditemukan atau tidak dapat dibaca.
            Silakan hubungi Administrator Sekolah untuk memeriksa akun Anda.
          </p>
          {signOutError && (
            <p className="text-sm text-red-600 mb-4">{signOutError}</p>
          )}
          <button
            type="button"
            onClick={handleKeluar}
            disabled={isSigningOut}
            className="w-full rounded-xl bg-[#155EEF] px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? 'Sedang keluar...' : 'Keluar'}
          </button>
        </div>
      </div>
    );
  }

  // Akun lama yang belum memiliki field aktif dianggap aktif oleh AuthContext.
  // Jika aktif === false, blokir seluruh halaman yang dilindungi.
  if (userData.aktif === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB] p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-red-600 mb-3">
            Akun Dinonaktifkan
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed mb-2">
            Maaf, akses akun Anda ke Aplikasi Administrasi Sekolah Digital sedang dinonaktifkan oleh Administrator Sekolah.
          </p>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Silakan hubungi Administrator Sekolah jika Anda merasa penonaktifan ini merupakan kekeliruan.
          </p>
          {signOutError && (
            <p className="text-sm text-red-600 mb-4">{signOutError}</p>
          )}
          <button
            type="button"
            onClick={handleKeluar}
            disabled={isSigningOut}
            className="w-full rounded-xl bg-[#155EEF] px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? 'Sedang keluar...' : 'Keluar dari Akun'}
          </button>
        </div>
      </div>
    );
  }

  // Pastikan peran pengguna sesuai dengan halaman yang diakses.
  if (!allowedRoles.includes(userData.role)) {
    const tujuanDashboard = dashboardByRole[userData.role] || '/';
    return <Navigate to={tujuanDashboard} replace />;
  }

  // Jika seluruh pemeriksaan berhasil, tampilkan halaman.
  return <Outlet />;
}
