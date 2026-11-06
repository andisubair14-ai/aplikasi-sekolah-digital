
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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

  // 1. Menunggu proses pemeriksaan login dan data pengguna.
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F5F7FB] text-[#155EEF] font-bold">
        Memuat data...
      </div>
    );
  }

  // 2. Jika belum login, arahkan ke halaman Login.
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 3. Jika login berhasil tetapi profil pengguna tidak ditemukan,
  // jangan izinkan pengguna masuk ke halaman yang dilindungi.
  if (!userData) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F5F7FB] p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-3">
            Data Akun Tidak Ditemukan
          </h1>

          <p className="text-slate-600 text-sm leading-relaxed">
            Anda berhasil login, tetapi data profil pengguna tidak ditemukan
            atau tidak dapat dibaca. Silakan hubungi Administrator Sekolah
            untuk memeriksa akun Anda.
          </p>
        </div>
      </div>
    );
  }

  // 4. Pastikan peran pengguna sesuai dengan halaman yang diakses.
  if (!allowedRoles.includes(userData.role)) {
    const tujuanDashboard =
      dashboardByRole[userData.role] || '/';

    return <Navigate to={tujuanDashboard} replace />;
  }

  // 5. Jika seluruh pemeriksaan berhasil, tampilkan halaman.
  return <Outlet />;
}
