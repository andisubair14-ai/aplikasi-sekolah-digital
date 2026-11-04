import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardLayout from './components/DashboardLayout';
import DataSiswa from './pages/DataSiswa'; // Import halaman baru

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Halaman Dashboard dan sub-halamannya */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="siswa" element={<DataSiswa />} /> {/* Rute Data Siswa */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;