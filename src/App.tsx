import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import GuruDashboard from './pages/GuruDashboard';
import KepsekDashboard from './pages/KepsekDashboard';
import DashboardLayout from './components/DashboardLayout';
import DataSiswa from './pages/DataSiswa';
import ProtectedRoute from './components/ProtectedRoute';

const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200">
    <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
    <p className="text-slate-500 mt-2">Halaman ini sedang dalam tahap pengembangan.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* ===== RUTE ADMIN (Memanggil AdminDashboard) ===== */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} /> 
            <Route path="siswa" element={<DataSiswa />} />
            <Route path="guru" element={<Placeholder title="Data Guru" />} />
            <Route path="kelas" element={<Placeholder title="Data Kelas" />} />
            <Route path="absensi" element={<Placeholder title="Absensi" />} />
            <Route path="jadwal" element={<Placeholder title="Jadwal Pelajaran" />} />
            <Route path="sarpras" element={<Placeholder title="Sarpras" />} />
            <Route path="pengumuman" element={<Placeholder title="Pengumuman" />} />
            <Route path="pengaturan" element={<Placeholder title="Pengaturan" />} />
          </Route>
        </Route>

        {/* ===== RUTE GURU (Memanggil GuruDashboard) ===== */}
        <Route element={<ProtectedRoute allowedRoles={['guru']} />}>
          <Route path="/guru" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/guru/dashboard" replace />} />
            <Route path="dashboard" element={<GuruDashboard />} />
            <Route path="siswa" element={<DataSiswa />} />
            <Route path="absensi" element={<Placeholder title="Absensi Guru" />} />
            <Route path="jadwal" element={<Placeholder title="Jadwal Mengajar" />} />
            <Route path="pengumuman" element={<Placeholder title="Pengumuman" />} />
          </Route>
        </Route>

        {/* ===== RUTE KEPSEK (Memanggil KepsekDashboard) ===== */}
        <Route element={<ProtectedRoute allowedRoles={['kepsek']} />}>
          <Route path="/kepsek" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/kepsek/dashboard" replace />} />
            <Route path="dashboard" element={<KepsekDashboard />} />
            <Route path="monitoring-siswa" element={<Placeholder title="Monitoring Siswa" />} />
            <Route path="monitoring-guru" element={<Placeholder title="Monitoring Guru" />} />
            <Route path="laporan" element={<Placeholder title="Laporan Sekolah" />} />
            <Route path="pengumuman" element={<Placeholder title="Pengumuman" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;