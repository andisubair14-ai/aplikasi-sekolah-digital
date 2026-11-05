import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import GuruDashboard from './pages/GuruDashboard';
import KepsekDashboard from './pages/KepsekDashboard';
import DashboardLayout from './components/DashboardLayout';
import DataSiswa from './pages/DataSiswa';
import ProtectedRoute from './components/ProtectedRoute';
import DataGuru from './pages/DataGuru';
import DataKelas from './pages/DataKelas'; 
import TahunAjaran from './pages/TahunAjaran'; // <-- 1. IMPORT BARU

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

        {/* ===== RUTE KHUSUS ADMIN ===== */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            
            {/* Data Master */}
            <Route path="siswa" element={<DataSiswa />} />
            <Route path="guru" element={<DataGuru />} />
            <Route path="kelas" element={<DataKelas />} /> 
            <Route path="tahun-ajaran" element={<TahunAjaran />} /> {/* <-- 2. RUTE BARU */}
            
            {/* Akademik */}
            <Route path="absensi" element={<Placeholder title="Absensi" />} />
            <Route path="jadwal" element={<Placeholder title="Jadwal Pelajaran" />} />
            
            {/* Lainnya */}
            <Route path="sarpras" element={<Placeholder title="Sarana Prasarana" />} />
            <Route path="pengumuman" element={<Placeholder title="Pengumuman" />} />
            <Route path="manajemen-pengguna" element={<Placeholder title="Manajemen Pengguna" />} />
            <Route path="laporan" element={<Placeholder title="Laporan" />} />
            <Route path="pengaturan" element={<Placeholder title="Pengaturan" />} />
          </Route>
        </Route>

        {/* ===== RUTE KHUSUS GURU ===== */}
        <Route element={<ProtectedRoute allowedRoles={['guru']} />}>
          <Route path="/guru" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/guru/dashboard" replace />} />
            <Route path="dashboard" element={<GuruDashboard />} />
            
            <Route path="kelas-diampu" element={<Placeholder title="Kelas yang Diampu" />} />
            <Route path="siswa" element={<DataSiswa />} />
            
            <Route path="absensi" element={<Placeholder title="Absensi Siswa" />} />
            <Route path="jurnal" element={<Placeholder title="Jurnal Mengajar" />} />
            <Route path="jadwal" element={<Placeholder title="Jadwal Mengajar" />} />
            <Route path="penilaian" element={<Placeholder title="Penilaian Siswa" />} />
            <Route path="rekap-kehadiran" element={<Placeholder title="Rekap Kehadiran" />} />
            
            <Route path="pengumuman" element={<Placeholder title="Pengumuman" />} />
            <Route path="profil" element={<Placeholder title="Profil Saya" />} />
          </Route>
        </Route>

        {/* ===== RUTE KHUSUS KEPALA SEKOLAH ===== */}
        <Route element={<ProtectedRoute allowedRoles={['kepsek']} />}>
          <Route path="/kepsek" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/kepsek/dashboard" replace />} />
            <Route path="dashboard" element={<KepsekDashboard />} />
            
            <Route path="monitoring-siswa" element={<Placeholder title="Monitoring Data Siswa" />} />
            <Route path="monitoring-guru" element={<Placeholder title="Monitoring Data Guru" />} />
            <Route path="monitoring-rombel" element={<Placeholder title="Monitoring Rombongan Belajar" />} />
            <Route path="monitoring-kehadiran" element={<Placeholder title="Monitoring Kehadiran" />} />
            <Route path="monitoring-pembelajaran" element={<Placeholder title="Monitoring Pembelajaran" />} />
            <Route path="monitoring-penilaian" element={<Placeholder title="Monitoring Penilaian" />} />
            
            <Route path="laporan" element={<Placeholder title="Laporan Sekolah" />} />
            <Route path="persetujuan" element={<Placeholder title="Persetujuan & Verifikasi" />} />
            <Route path="pengumuman" element={<Placeholder title="Pengumuman" />} />
            <Route path="profil" element={<Placeholder title="Profil Saya" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;