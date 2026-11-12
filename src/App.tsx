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
import TahunAjaran from './pages/TahunAjaran';
import ManajemenPengguna from './pages/ManajemenPengguna';
import Absensi from './pages/Absensi';
import AbsensiGuru from './pages/AbsensiGuru';
import JurnalMengajar from './pages/JurnalMengajar';
import Persetujuan from './pages/Persetujuan';
import Pengaturan from './pages/Pengaturan';
import MonitoringDataSiswa from './pages/MonitoringDataSiswa';
import MonitoringDataGuru from './pages/MonitoringDataGuru';
import MonitoringPembelajaran from './pages/MonitoringPembelajaran';
import MonitoringDataRombel from './pages/MonitoringDataRombel';
import MonitoringKehadiran from './pages/MonitoringKehadiran';
import SarprasDashboard from './pages/SarprasDashboard';
import DataInventaris from './pages/DataInventaris';
import RuangFasilitas from './pages/RuangFasilitas';
import PemeliharaanPerbaikan from './pages/PemeliharaanPerbaikan';
import LaporanSarpras from './pages/LaporanSarpras';
import Pengumuman from './pages/Pengumuman';
import LaporanSekolah from './pages/LaporanSekolah';
import LaporanDetail from './pages/LaporanDetail';
import JadwalPelajaran from './pages/JadwalPelajaran';
import PenilaianSiswa from './pages/PenilaianSiswa';
import RekapKehadiran from './pages/RekapKehadiran';
import ProfilGuru from './pages/ProfilGuru';
import ProfilKepsek from './pages/ProfilKepsek';

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

        {/* RUTE ADMIN */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="siswa" element={<DataSiswa />} />
            <Route path="guru" element={<DataGuru />} />
            <Route path="kelas" element={<DataKelas />} />
            <Route path="tahun-ajaran" element={<TahunAjaran />} />
            <Route path="absensi" element={<Absensi />} />
            <Route path="absensi-guru" element={<AbsensiGuru />} />
            <Route path="jadwal" element={<JadwalPelajaran />} />
            <Route path="sarpras" element={<SarprasDashboard />} />
            <Route path="sarpras/inventaris" element={<DataInventaris />} />
            <Route path="sarpras/ruang-fasilitas" element={<RuangFasilitas />} />
            <Route path="sarpras/pemeliharaan" element={<PemeliharaanPerbaikan />} />
            <Route path="sarpras/laporan" element={<LaporanSarpras />} />
            <Route path="pengumuman" element={<Pengumuman />} />
            <Route path="manajemen-pengguna" element={<ManajemenPengguna />} />
            <Route path="laporan" element={<LaporanSekolah />} />
            <Route path="laporan/:jenis" element={<LaporanDetail />} />
            <Route path="pengaturan" element={<Pengaturan />} />
          </Route>
        </Route>

        {/* RUTE GURU */}
        <Route element={<ProtectedRoute allowedRoles={['guru']} />}>
          <Route path="/guru" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/guru/dashboard" replace />} />
            <Route path="dashboard" element={<GuruDashboard />} />
            <Route path="kelas-diampu" element={<Placeholder title="Kelas yang Diampu" />} />
            <Route path="siswa" element={<DataSiswa />} />
            <Route path="absensi" element={<Absensi />} />
            <Route path="absensi-guru" element={<AbsensiGuru />} />
            <Route path="jurnal" element={<JurnalMengajar />} />
            <Route path="jadwal" element={<JadwalPelajaran />} />
            <Route path="penilaian" element={<PenilaianSiswa />} />
            <Route path="rekap-kehadiran" element={<RekapKehadiran />} />
            <Route path="pengumuman" element={<Pengumuman />} />
            <Route path="profil" element={<ProfilGuru />} />
          </Route>
        </Route>

        {/* RUTE KEPALA SEKOLAH */}
        <Route element={<ProtectedRoute allowedRoles={['kepsek']} />}>
          <Route path="/kepsek" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/kepsek/dashboard" replace />} />
            <Route path="dashboard" element={<KepsekDashboard />} />
            <Route path="monitoring-siswa" element={<MonitoringDataSiswa />} />
            <Route path="monitoring-guru" element={<MonitoringDataGuru />} />
            <Route path="monitoring-rombel" element={<MonitoringDataRombel />} />
            <Route path="monitoring-kehadiran" element={<MonitoringKehadiran />} />
            <Route path="monitoring-absensi-guru" element={<AbsensiGuru />} />
            <Route path="monitoring-pembelajaran" element={<MonitoringPembelajaran />} />
            <Route path="monitoring-penilaian" element={<Placeholder title="Monitoring Penilaian" />} />
            <Route path="laporan" element={<LaporanSekolah />} />
            <Route path="laporan/:jenis" element={<LaporanDetail />} />
            <Route path="persetujuan" element={<Persetujuan />} />
            <Route path="pengumuman" element={<Pengumuman />} />
            <Route path="profil" element={<ProfilKepsek />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
