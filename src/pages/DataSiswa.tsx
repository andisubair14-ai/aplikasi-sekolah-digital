import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function DataSiswa() {
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nama, setNama] = useState('');
  const [nisn, setNisn] = useState('');
  const [kelas, setKelas] = useState('');

  // Mengambil data dari Firebase secara real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'siswa'), (snapshot) => {
      const dataSiswa = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSiswaList(dataSiswa);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fungsi untuk menyimpan data baru
  const handleTambahSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'siswa'), {
        nama: nama,
        nisn: nisn,
        kelas: kelas
      });
      setIsModalOpen(false); // Tutup modal
      setNama(''); setNisn(''); setKelas(''); // Reset form
    } catch (error) {
      alert('Gagal menambah data: ' + error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Siswa</h1>
          <p className="text-slate-500 mt-1">Kelola informasi seluruh siswa di sekolah.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          + Tambah Siswa
        </button>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <th className="p-4 font-semibold">No</th>
              <th className="p-4 font-semibold">Nama Siswa</th>
              <th className="p-4 font-semibold">NISN</th>
              <th className="p-4 font-semibold">Kelas</th>
              <th className="p-4 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">Memuat data...</td></tr>
            ) : siswaList.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">Belum ada data siswa.</td></tr>
            ) : (
              siswaList.map((siswa, index) => (
                <tr key={siswa.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-600">{index + 1}</td>
                  <td className="p-4 font-medium text-slate-800">{siswa.nama}</td>
                  <td className="p-4 text-slate-600">{siswa.nisn}</td>
                  <td className="p-4 text-slate-600">{siswa.kelas}</td>
                  <td className="p-4">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Edit</button>
                    <button className="text-red-600 hover:text-red-800 text-sm font-medium">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah Siswa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Tambah Data Siswa</h2>
            <form onSubmit={handleTambahSiswa} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">NISN</label>
                <input type="text" value={nisn} onChange={(e) => setNisn(e.target.value)} required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kelas</label>
                <input type="text" value={kelas} onChange={(e) => setKelas(e.target.value)} required placeholder="Contoh: 1A"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">Simpan Data</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}