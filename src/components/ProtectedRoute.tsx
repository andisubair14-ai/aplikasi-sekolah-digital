import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles: ('admin' | 'guru' | 'kepsek')[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, userData, loading } = useAuth();

  // Jika masih memuat data, tampilkan layar kosong/loading
  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-[#F5F7FB] text-[#155EEF] font-bold">Memuat data...</div>;
  }

  // Jika belum login, lempar ke halaman Login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Jika role tidak sesuai, lempar ke dashboard yang sesuai dengan role-nya
  if (userData && !allowedRoles.includes(userData.role)) {
    if (userData.role === 'guru') return <Navigate to="/guru/dashboard" replace />;
    if (userData.role === 'kepsek') return <Navigate to="/kepsek/dashboard" replace />;
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Jika lolos semua pengecekan, tampilkan halamannya (Outlet)
  return <Outlet />;
}