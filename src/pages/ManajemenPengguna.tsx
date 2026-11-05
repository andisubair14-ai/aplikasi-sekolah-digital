import { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../lib/firebase';

export default function ManajemenPengguna() {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Form Tambah
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [role, setRole] = useState('guru');
  const [guruId, setGuruId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // State untuk Form Edit (BARU)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editNama, setEditNama] = useState('');
  const [editRole, setEditRole] = useState('guru');
  const [editGuruId, setEditGuruId] = useState('');

  const pilihanRole = [
    { value: 'admin', label: 'Administrator' },
    { value: 'guru', label: 'Guru' },
    { value: 'kepsek', label: 'Kepala Sekolah' }
  ];

  // Mengambil data Users dan Guru dari Firebase
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsersList(data);
      setLoading(false);
    });

    const unsubGuru = onSnapshot(collection(db, 'guru'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGuruList(data);
    });

    return () => { unsubUsers(); unsubGuru(); };
  }, []);

  const handleOpenTambah = () => {
    setEmail(''); setPassword(''); setNama(''); setRole('guru'); setGuruId('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditId(user.id);
    setEditEmail(user.email);
    setEditNama(user.nama);
    setEditRole(user.role);
    setEditGuruId(user.guruId || '');
    setIsEditModalOpen(true);
  };

  const handleSimpanUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUserId = userCredential.user.uid;

      const userData = {
        email: email,
        nama: nama,
        role: role,
        guruId: role === 'guru' ? guruId : null 
      };

      await setDoc(doc(db, 'users', newUserId), userData);
      await deleteApp(secondaryApp);

      alert('Akun berhasil dibuat!');
      setIsModalOpen(false);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        alert('Email tersebut sudah terdaftar di sistem!');
      } else {
        alert('Gagal membuat akun: ' + error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // FUNGSI SIMPAN EDIT (BARU)
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;

    try {
      const updatedData = {
        nama: editNama,
        role: editRole,
        guruId: editRole === 'guru' ? editGuruId : null
      };

      await updateDoc(doc(db, 'users', editId), updatedData);
      alert('Data pengguna berhasil diperbarui!');
      setIsEditModalOpen(false);
    } catch (error) {
      alert('Gagal memperbarui data: ' + error);
    }
  };

  const handleHapusUser = async (id: string, emailUser: string) => {
    if (window.confirm(`Hapus akses login untuk ${emailUser}? (Catatan: Akun di Firebase Auth mungkin masih tersisa, harap hapus manual di Firebase Console)`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (error) {
        alert('Gagal menghapus akses: ' + error);
      }
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'guru': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'kepsek': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header Halaman */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">Manajemen Pengguna</h1>
          <p className="text-slate-500 mt-1 font-medium">Kelola hak akses login untuk Admin, Guru, dan Kepala Sekolah.</p>
        </div>
        
        <button onClick={handleOpenTambah} className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-sm text-sm">
          + Buat Akun Baru
        </button>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <th className="p-4 font-bold uppercase tracking-wider text-xs">No</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Nama Lengkap</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Email Login</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Peran (Role)</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Terhubung ke Pegawai</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Memuat data...</td></tr>
            ) : usersList.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Belum ada data pengguna.</td></tr>
            ) : (
              usersList.map((user, index) => {
                const linkedGuru = guruList.find(g => g.id === user.guruId);
                return (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-[#F5F7FB] transition-colors text-sm">
                    <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                    <td className="p-4 font-bold text-[#082B62]">{user.nama}</td>
                    <td className="p-4 text-slate-600 font-medium">{user.email}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-md text-xs font-bold border ${getRoleBadge(user.role)}`}>
                        {user.role === 'kepsek' ? 'Kepala Sekolah' : user.role === 'admin' ? 'Administrator' : 'Guru'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 font-medium">
                      {user.role === 'guru' ? (linkedGuru ? linkedGuru.nama : 'Tidak terhubung') : '-'}
                    </td>
                    <td className="p-4">
                      {/* TOMBOL EDIT BARU */}
                      <button onClick={() => handleOpenEdit(user)} className="text-[#155EEF] hover:text-blue-800 font-bold mr-4 transition-colors">Edit</button>
                      <button onClick={() => handleHapusUser(user.id, user.email)} className="text-[#EF4444] hover:text-red-800 font-bold transition-colors">Hapus Akses</button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ===== MODAL TAMBAH USER ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-[#082B62]">Buat Akun Baru</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleSimpanUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} required placeholder="Masukkan nama pengguna"
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email (Untuk Login)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Contoh: budi@sekolah.com"
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Password Awal</label>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Minimal 6 karakter" minLength={6}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Peran (Role)</label>
                <select value={role} onChange={(e) => { setRole(e.target.value); setGuruId(''); }}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium cursor-pointer">
                  {pilihanRole.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {role === 'guru' && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <label className="block text-sm font-bold text-emerald-700 mb-1">Hubungkan ke Data Pegawai</label>
                  <select value={guruId} onChange={(e) => setGuruId(e.target.value)} required
                    className="w-full px-4 py-2 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer">
                    <option value="">-- Pilih Data Guru --</option>
                    {guruList.map(g => <option key={g.id} value={g.id}>{g.nama} ({g.jabatan})</option>)}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className={`px-6 py-2.5 text-white font-bold rounded-lg shadow-md transition-all ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#155EEF] hover:bg-blue-700'}`}>
                  {isSaving ? 'Membuat Akun...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL EDIT USER (BARU) ===== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-[#082B62]">Edit Data Pengguna</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input type="text" value={editNama} onChange={(e) => setEditNama(e.target.value)} required
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email Login (Tidak dapat diubah)</label>
                <input type="email" value={editEmail} disabled
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-500 font-medium cursor-not-allowed" />
                <p className="text-xs text-red-500 mt-1">*Untuk mengganti email, hapus akun ini dan buat akun baru.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Peran (Role)</label>
                <select value={editRole} onChange={(e) => { setEditRole(e.target.value); setEditGuruId(''); }}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium cursor-pointer">
                  {pilihanRole.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {editRole === 'guru' && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <label className="block text-sm font-bold text-emerald-700 mb-1">Hubungkan ke Data Pegawai</label>
                  <select value={editGuruId} onChange={(e) => setEditGuruId(e.target.value)} required
                    className="w-full px-4 py-2 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer">
                    <option value="">-- Pilih Data Guru --</option>
                    {guruList.map(g => <option key={g.id} value={g.id}>{g.nama} ({g.jabatan})</option>)}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2.5 bg-[#155EEF] hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all">
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}