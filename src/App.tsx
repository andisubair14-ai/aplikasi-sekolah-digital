import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardLayout from './components/DashboardLayout';
import DataSiswa from './pages/DataSiswa';

// Halaman Sementara untuk menu yang belum dibuat
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
        
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="siswa" element={<DataSiswa />} />
          
          {/* Rute Sementara */}
          <Route path="guru" element={<Placeholder title="Data Guru" />} />
          <Route path="kelas" element={<Placeholder title="Data Kelas" />} />
          <Route path="absensi" element={<Placeholder title="Absensi" />} />
          <Route path="jadwal" element={<Placeholder title="Jadwal Pelajaran" />} />
          <Route path="sarpras" element={<Placeholder title="Sarana & Prasarana" />} />
          <Route path="pengumuman" element={<Placeholder title="Pengumuman" />} />
          <Route path="pengaturan" element={<Placeholder title="Pengaturan" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;