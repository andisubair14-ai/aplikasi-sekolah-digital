import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function TahunAjaran() {
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // State Data Tahun Ajaran
  const [tahun, setTahun] = useState('');
  const [semester, setSemester] = useState('Ganjil');
  const [status, setStatus] = useState('Tidak Aktif');

  // Mengambil data dari Firebase
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tahun_ajaran'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Urutkan dari tahun terbaru ke terlama
      data.sort((a: any, b: any) => (b.tahun || '').localeCompare(a.tahun || ''));
      setTahunAjaranList(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenTambah = () => {
    setEditId(null);
    setTahun(''); 
    setSemester('Ganjil'); 
    setStatus('Tidak Aktif');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditId(item.id);
    setTahun(item.tahun); 
    setSemester(item.semester); 
    setStatus(item.status);
    setIsModalOpen(true);
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tahun) {
      alert('Tahun Ajaran wajib diisi!');
      return;
    }

    try {
      // LOGIKA PENTING: Jika statusnya 'Aktif', matikan semua status aktif lainnya
      if (status === 'Aktif') {
        const batch = writeBatch(db);
        tahunAjaranList.forEach(item => {
          if (item.id !== editId && item.status === 'Aktif') {
            batch.update(doc(db, 'tahun_ajaran', item.id), { status: 'Tidak Aktif' });
          }
        });
        await batch.commit();
      }

      const dataBaru = { tahun, semester, status };
      
      if (editId) {
        await updateDoc(doc(db, 'tahun_ajaran', editId), dataBaru);
      } else {
        await addDoc(collection(db, 'tahun_ajaran'), dataBaru);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert('Gagal menyimpan data: ' + error);
    }
  };

  const handleHapus = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data tahun ajaran ini?')) {
      try {
        await deleteDoc(doc(db, 'tahun_ajaran', id));
      } catch (error) {
        alert('Gagal menghapus data: ' + error);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header Halaman */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">Tahun Ajaran</h1>
          <p className="text-slate-500 mt-1 font-medium">Atur tahun ajaran dan semester aktif sekolah.</p>
        </div>
        
        <button onClick={handleOpenTambah} className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-sm text-sm">
          + Tambah Tahun Ajaran
        </button>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <th className="p-4 font-bold uppercase tracking-wider text-xs">No</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Tahun Ajaran</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Semester</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Status</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">Memuat data...</td></tr>
            ) : tahunAjaranList.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">Belum ada data tahun ajaran.</td></tr>
            ) : (
              tahunAjaranList.map((item, index) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-[#F5F7FB] transition-colors text-sm">
                  <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                  <td className="p-4 font-bold text-[#082B62]">{item.tahun}</td>
                  <td className="p-4 text-slate-600 font-medium">{item.semester}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                      item.status === 'Aktif' 
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => handleOpenEdit(item)} className="text-[#155EEF] hover:text-blue-800 font-bold mr-4 transition-colors">Edit</button>
                    <button onClick={() => handleHapus(item.id)} className="text-[#EF4444] hover:text-red-800 font-bold transition-colors">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-[#082B62]">
                {editId ? 'Edit Tahun Ajaran' : 'Tambah Tahun Ajaran'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                 ✕
              </button>
            </div>
            
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tahun Ajaran</label>
                <input 
                  type="text" 
                  value={tahun} 
                  onChange={(e) => setTahun(e.target.value)} 
                  required 
                  placeholder="Contoh: 2025/2026"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Semester</label>
                <select 
                  value={semester} 
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none bg-white font-bold cursor-pointer transition-colors ${
                    status === 'Aktif' ? 'text-emerald-700 border-emerald-300 focus:ring-emerald-500' : 'text-slate-600 border-slate-300 focus:ring-[#155EEF]'
                  }`}
                >
                  <option value="Tidak Aktif">Tidak Aktif</option>
                  <option value="Aktif">Aktif</option>
                </select>
                {status === 'Aktif' && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">
                    *Tahun ajaran lain yang sedang aktif akan otomatis dinonaktifkan.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2.5 bg-[#155EEF] hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all">
                  {editId ? 'Simpan Perubahan' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}