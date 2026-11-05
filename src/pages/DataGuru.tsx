import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

export default function DataPegawai() {
  const [guruList, setGuruList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // State untuk Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // State Data Pegawai
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [nuptk, setNuptk] = useState('');
  const [mapel, setMapel] = useState('');
  const [jabatan, setJabatan] = useState('Guru Mata Pelajaran');
  const [noHp, setNoHp] = useState('');
  const [alamat, setAlamat] = useState('');
  
  // State Khusus Wali Kelas
  const [jenjangWali, setJenjangWali] = useState('SD');
  const [kelasWali, setKelasWali] = useState('1');

  // State untuk Pencarian (Filter)
  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pilihanJabatan = [
    'Guru Mata Pelajaran', 
    'Wali Kelas', 
    'Kepala Sekolah', 
    'Wakil Kepala Sekolah', 
    'Guru BK', 
    'Tenaga Kependidikan'
  ];

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'guru'), (snapshot) => {
      const dataGuru = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGuruList(dataGuru);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // === LOGIKA PENGURUTAN (SORTING) ===
  const getRank = (jab: string) => {
    if (jab === 'Kepala Sekolah') return 1;
    if (jab === 'Wakil Kepala Sekolah') return 2;
    if (jab === 'Wali Kelas') return 3;
    if (jab === 'Guru BK') return 4;
    if (jab === 'Guru Mata Pelajaran') return 5;
    return 6; // Tenaga Kependidikan / Lainnya
  };

  const guruTampil = guruList
    .filter(guru => 
      guru.nama?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      guru.nip?.includes(searchTerm) ||
      guru.mapel?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const rankA = getRank(a.jabatan);
      const rankB = getRank(b.jabatan);

      // Jika jabatannya berbeda, urutkan berdasarkan peringkat jabatan
      if (rankA !== rankB) return rankA - rankB;

      // Jika sama-sama Wali Kelas, urutkan berdasarkan Jenjang (SD dulu) lalu Kelas
      if (a.jabatan === 'Wali Kelas' && b.jabatan === 'Wali Kelas') {
        const jenjangA = a.jenjangWali === 'SD' ? 1 : 2;
        const jenjangB = b.jenjangWali === 'SD' ? 1 : 2;
        if (jenjangA !== jenjangB) return jenjangA - jenjangB;
        
        const kelasA = parseInt(a.kelasWali || '0');
        const kelasB = parseInt(b.kelasWali || '0');
        return kelasA - kelasB;
      }

      // Jika jabatan sama dan bukan Wali Kelas, urutkan berdasarkan Nama (A-Z)
      return (a.nama || '').localeCompare(b.nama || '');
    });

  // === FITUR EXCEL (Tetap Sama) ===
  const handleDownloadTemplate = () => {
    const formatData = [{
      "Nama Lengkap": "Budi Santoso, S.Pd.",
      "NIP": "1987654321",
      "NUPTK": "1234567890123456",
      "Mata Pelajaran": "Matematika",
      "Jabatan": "Guru Mata Pelajaran",
      "Jenjang Wali": "", 
      "Kelas Wali": "",
      "Nomor HP": "081234567890",
      "Alamat": "Jl. Pendidikan No. 1"
    }];
    const ws = XLSX.utils.json_to_sheet(formatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Format Pegawai");
    XLSX.writeFile(wb, "Format_Upload_Pegawai.xlsx");
  };

  const handleDownloadData = () => {
    if (guruTampil.length === 0) return alert('Tidak ada data untuk diunduh.');
    
    const dataToExport = guruTampil.map(g => ({
      "Nama Lengkap": g.nama,
      "NIP": g.nip,
      "NUPTK": g.nuptk,
      "Mata Pelajaran": g.mapel,
      "Jabatan": g.jabatan,
      "Jenjang Wali": g.jenjangWali || '-',
      "Kelas Wali": g.kelasWali || '-',
      "Nomor HP": g.noHp,
      "Alamat": g.alamat
    }));
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Pegawai");
    XLSX.writeFile(wb, `Data_Pegawai_Sekolah.xlsx`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) throw new Error('File Excel kosong.');

        const batch = writeBatch(db);
        const guruRef = collection(db, 'guru');

        jsonData.forEach((row) => {
          const docRef = doc(guruRef); 
          batch.set(docRef, {
            nama: row['Nama Lengkap'] || '-',
            nip: String(row.NIP || '-'),
            nuptk: String(row.NUPTK || '-'),
            mapel: row['Mata Pelajaran'] || '-',
            jabatan: row.Jabatan || 'Guru Mata Pelajaran',
            jenjangWali: row['Jenjang Wali'] || null,
            kelasWali: row['Kelas Wali'] || null,
            noHp: String(row['Nomor HP'] || '-'),
            alamat: row.Alamat || '-'
          });
        });

        await batch.commit();
        alert(`Berhasil mengimpor ${jsonData.length} data pegawai!`);
      } catch (error) {
        alert('Gagal mengimpor. Pastikan format file sesuai dengan Template.');
        console.error(error);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOpenTambah = () => {
    setEditId(null);
    setNama(''); setNip(''); setNuptk(''); setMapel(''); 
    setJabatan('Guru Mata Pelajaran'); setNoHp(''); setAlamat('');
    setJenjangWali('SD'); setKelasWali('1');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (guru: any) => {
    setEditId(guru.id);
    setNama(guru.nama); setNip(guru.nip); setNuptk(guru.nuptk); setMapel(guru.mapel); 
    setJabatan(guru.jabatan || 'Guru Mata Pelajaran'); setNoHp(guru.noHp); setAlamat(guru.alamat);
    setJenjangWali(guru.jenjangWali || 'SD');
    setKelasWali(guru.kelasWali || '1');
    setIsModalOpen(true);
  };

  const handleSimpanPegawai = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (jabatan === 'Guru Mata Pelajaran' && !mapel) {
      alert('Mata Pelajaran wajib diisi untuk Guru Mata Pelajaran!');
      return;
    }

    try {
      const dataBaru = {
        nama, nip, nuptk, 
        mapel: (jabatan === 'Wali Kelas' && jenjangWali === 'SD') ? '-' : mapel, 
        jabatan, noHp, alamat,
        jenjangWali: jabatan === 'Wali Kelas' ? jenjangWali : null,
        kelasWali: jabatan === 'Wali Kelas' ? kelasWali : null,
      };
      
      if (editId) {
        await updateDoc(doc(db, 'guru', editId), dataBaru);
      } else {
        await addDoc(collection(db, 'guru'), dataBaru);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert('Gagal menyimpan data: ' + error);
    }
  };

  const handleHapus = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data pegawai ini?')) {
      try {
        await deleteDoc(doc(db, 'guru', id));
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
          <h1 className="text-2xl font-bold text-[#082B62]">Data Pegawai</h1>
          <p className="text-slate-500 mt-1 font-medium">Kelola informasi seluruh pendidik & tenaga kependidikan.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          
          <button onClick={handleDownloadTemplate} className="bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-bold transition-colors text-sm border border-slate-300 shadow-sm">
            Unduh Template
          </button>
          
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-[#155EEF] hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2 text-sm">
            {isUploading ? 'Mengunggah...' : 'Upload Excel'}
          </button>
          
          <button onClick={handleOpenTambah} className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm text-sm">
            + Tambah Pegawai
          </button>
        </div>
      </div>

      {/* PENCARIAN & DOWNLOAD DATA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
        <input 
          type="text" 
          placeholder="Cari Nama, NIP, atau Mata Pelajaran..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-80 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#155EEF] outline-none font-medium text-sm transition-all"
        />
        <button onClick={handleDownloadData} className="bg-[#EFF6FF] hover:bg-blue-100 text-[#155EEF] px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2">
          ⬇ Unduh Data
        </button>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <th className="p-4 font-bold uppercase tracking-wider text-xs">No</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Nama Lengkap</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">NIP / NUPTK</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Jabatan / Tugas</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Kontak</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Memuat data...</td></tr>
            ) : guruTampil.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Tidak ada data pegawai ditemukan.</td></tr>
            ) : (
              guruTampil.map((guru, index) => (
                <tr key={guru.id} className="border-b border-slate-100 hover:bg-[#F5F7FB] transition-colors text-sm">
                  <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                  <td className="p-4 font-bold text-[#082B62]">{guru.nama}</td>
                  <td className="p-4 text-slate-600 font-medium">
                    {guru.nip} <br/> <span className="text-xs text-slate-400">{guru.nuptk}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold inline-block mb-1 ${
                      guru.jabatan === 'Kepala Sekolah' ? 'bg-purple-100 text-purple-700' :
                      guru.jabatan === 'Wali Kelas' ? 'bg-blue-100 text-blue-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {guru.jabatan}
                    </span>
                    {guru.jabatan === 'Wali Kelas' && (
                      <div className="text-xs text-slate-500 font-medium">Wali Kelas {guru.jenjangWali} {guru.kelasWali}</div>
                    )}
                    {guru.mapel && guru.mapel !== '-' && (
                      <div className="text-xs text-slate-500 font-medium mt-1">Mapel: {guru.mapel}</div>
                    )}
                  </td>
                  <td className="p-4 text-slate-600 font-medium">{guru.noHp}</td>
                  <td className="p-4">
                    <button onClick={() => handleOpenEdit(guru)} className="text-[#155EEF] hover:text-blue-800 font-bold mr-4 transition-colors">Edit</button>
                    <button onClick={() => handleHapus(guru.id)} className="text-[#EF4444] hover:text-red-800 font-bold transition-colors">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah/Edit Pegawai */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-[#082B62]">
                {editId ? 'Edit Data Pegawai' : 'Tambah Data Pegawai'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                 ✕
              </button>
            </div>
            
            <form onSubmit={handleSimpanPegawai} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kolom Kiri */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nama Lengkap (dengan Gelar)</label>
                  <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">NIP</label>
                  <input type="text" value={nip} onChange={(e) => setNip(e.target.value)} required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">NUPTK (Opsional)</label>
                  <input type="text" value={nuptk} onChange={(e) => setNuptk(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nomor HP</label>
                  <input type="text" value={noHp} onChange={(e) => setNoHp(e.target.value)} required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
                </div>
              </div>

              {/* Kolom Kanan */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Jabatan</label>
                  <select value={jabatan} onChange={(e) => setJabatan(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer">
                    {pilihanJabatan.map((jab) => <option key={jab} value={jab}>{jab}</option>)}
                  </select>
                </div>

                {jabatan === 'Wali Kelas' && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-[#155EEF] mb-1">Jenjang</label>
                      <select value={jenjangWali} onChange={(e) => { setJenjangWali(e.target.value); setKelasWali('1'); }}
                        className="w-full px-3 py-1.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white text-sm font-medium">
                        <option value="SD">SD</option>
                        <option value="SMP">SMP</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#155EEF] mb-1">Kelas</label>
                      <select value={kelasWali} onChange={(e) => setKelasWali(e.target.value)}
                        className="w-full px-3 py-1.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white text-sm font-medium">
                        {jenjangWali === 'SD' 
                          ? ['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Kelas {k}</option>)
                          : ['7','8','9'].map(k => <option key={k} value={k}>Kelas {k}</option>)
                        }
                      </select>
                    </div>
                  </div>
                )}

                {!(jabatan === 'Wali Kelas' && jenjangWali === 'SD') && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      Mata Pelajaran {jabatan === 'Guru Mata Pelajaran' ? '*' : '(Opsional)'}
                    </label>
                    <input 
                      type="text" value={mapel} onChange={(e) => setMapel(e.target.value)} 
                      required={jabatan === 'Guru Mata Pelajaran'}
                      placeholder={jabatan === 'Guru Mata Pelajaran' ? 'Wajib diisi' : 'Boleh dikosongkan'}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none font-medium transition-colors ${
                        jabatan === 'Guru Mata Pelajaran' && !mapel 
                          ? 'border-red-300 bg-red-50 focus:ring-red-500' 
                          : 'border-slate-300 focus:ring-[#155EEF]'
                      }`} 
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Alamat Lengkap</label>
                  <textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} rows={2}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium resize-none" />
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-4 border-t pt-4">
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