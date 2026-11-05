import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

export default function DataKelas() {
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([]); // State Baru
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // State untuk Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // State Data Kelas
  const [namaKelas, setNamaKelas] = useState('');
  const [jenjang, setJenjang] = useState('SD');
  const [tingkat, setTingkat] = useState('1');
  const [waliKelas, setWaliKelas] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState(''); // State Baru

  // State untuk Pencarian (Filter)
  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === FUNGSI KONVERSI ANGKA KE ROMAWI ===
  const toRoman = (num: number | string) => {
    const n = parseInt(String(num));
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
    return roman[n] || n;
  };

  // Mengambil data Kelas, Guru, dan Tahun Ajaran dari Firebase
  useEffect(() => {
    const unsubKelas = onSnapshot(collection(db, 'kelas'), (snapshot) => {
      const dataKelas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setKelasList(dataKelas);
      setLoading(false);
    });

    const unsubGuru = onSnapshot(collection(db, 'guru'), (snapshot) => {
      const dataGuru = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGuruList(dataGuru);
    });

    // Mengambil data Tahun Ajaran
    const unsubTahun = onSnapshot(collection(db, 'tahun_ajaran'), (snapshot) => {
      const dataTahun = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTahunAjaranList(dataTahun);
    });

    return () => { unsubKelas(); unsubGuru(); unsubTahun(); };
  }, []);

  // === LOGIKA PENGURUTAN (SORTING) ===
  const kelasTampil = kelasList
    .filter(kelas => 
      kelas.namaKelas?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      kelas.waliKelas?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kelas.tahunAjaran?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Urutkan berdasarkan Tahun Ajaran terbaru
      const tahunA = a.tahunAjaran || '';
      const tahunB = b.tahunAjaran || '';
      if (tahunA !== tahunB) return tahunB.localeCompare(tahunA);

      const jenjangA = a.jenjang === 'SD' ? 1 : 2;
      const jenjangB = b.jenjang === 'SD' ? 1 : 2;
      if (jenjangA !== jenjangB) return jenjangA - jenjangB;

      const tingkatA = parseInt(a.tingkat || '0');
      const tingkatB = parseInt(b.tingkat || '0');
      if (tingkatA !== tingkatB) return tingkatA - tingkatB;

      return (a.namaKelas || '').localeCompare(b.namaKelas || '');
    });

  // === FITUR EXCEL ===
  const handleDownloadTemplate = () => {
    const formatData = [{
      "Nama Kelas": "1A",
      "Jenjang": "SD",
      "Tingkat": "1",
      "Wali Kelas": "Budi Santoso, S.Pd.",
      "Tahun Ajaran": "2025/2026"
    }];
    const ws = XLSX.utils.json_to_sheet(formatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Format Kelas");
    XLSX.writeFile(wb, "Format_Upload_Kelas.xlsx");
  };

  const handleDownloadData = () => {
    if (kelasTampil.length === 0) return alert('Tidak ada data untuk diunduh.');
    
    const dataToExport = kelasTampil.map(k => ({
      "Nama Kelas": k.namaKelas,
      "Jenjang": k.jenjang,
      "Tingkat": k.tingkat,
      "Wali Kelas": k.waliKelas,
      "Tahun Ajaran": k.tahunAjaran
    }));
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Kelas");
    XLSX.writeFile(wb, `Data_Kelas_Sekolah.xlsx`);
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
        const kelasRef = collection(db, 'kelas');

        jsonData.forEach((row) => {
          const docRef = doc(kelasRef); 
          batch.set(docRef, {
            namaKelas: row['Nama Kelas'] || '-',
            jenjang: row.Jenjang || 'SD',
            tingkat: String(row.Tingkat || '1'),
            waliKelas: row['Wali Kelas'] || '-',
            tahunAjaran: row['Tahun Ajaran'] || '-'
          });
        });

        await batch.commit();
        alert(`Berhasil mengimpor ${jsonData.length} data kelas!`);
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
    setNamaKelas(''); setJenjang('SD'); setTingkat('1'); setWaliKelas('');
    // Secara otomatis pilih tahun ajaran yang sedang aktif
    const tahunAktif = tahunAjaranList.find(t => t.status === 'Aktif');
    setTahunAjaran(tahunAktif ? tahunAktif.tahun : '');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (kelas: any) => {
    setEditId(kelas.id);
    setNamaKelas(kelas.namaKelas); setJenjang(kelas.jenjang); setTingkat(kelas.tingkat); setWaliKelas(kelas.waliKelas);
    setTahunAjaran(kelas.tahunAjaran || '');
    setIsModalOpen(true);
  };

  const handleSimpanKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tahunAjaran) {
      alert('Silakan pilih Tahun Ajaran terlebih dahulu!');
      return;
    }

    try {
      const dataBaru = {
        namaKelas, jenjang, tingkat, waliKelas: waliKelas || '-', tahunAjaran
      };
      
      if (editId) {
        await updateDoc(doc(db, 'kelas', editId), dataBaru);
      } else {
        await addDoc(collection(db, 'kelas'), dataBaru);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert('Gagal menyimpan data: ' + error);
    }
  };

  const handleHapus = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data kelas ini?')) {
      try {
        await deleteDoc(doc(db, 'kelas', id));
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
          <h1 className="text-2xl font-bold text-[#082B62]">Data Kelas & Rombel</h1>
          <p className="text-slate-500 mt-1 font-medium">Kelola informasi seluruh kelas di sekolah.</p>
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
            + Tambah Kelas
          </button>
        </div>
      </div>

      {/* PENCARIAN & DOWNLOAD DATA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
        <input 
          type="text" 
          placeholder="Cari Kelas, Wali, atau Tahun..." 
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
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Tahun Ajaran</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Nama Kelas</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Jenjang</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Tingkat</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Wali Kelas</th>
              <th className="p-4 font-bold uppercase tracking-wider text-xs">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-medium">Memuat data...</td></tr>
            ) : kelasTampil.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-medium">Tidak ada data kelas ditemukan.</td></tr>
            ) : (
              kelasTampil.map((kelas, index) => (
                <tr key={kelas.id} className="border-b border-slate-100 hover:bg-[#F5F7FB] transition-colors text-sm">
                  <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                  <td className="p-4">
                    <span className="bg-blue-50 text-[#155EEF] px-3 py-1 rounded-md text-xs font-bold">
                      {kelas.tahunAjaran || '-'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-[#082B62]">{kelas.namaKelas}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                      kelas.jenjang === 'SD' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {kelas.jenjang}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 font-medium">Tingkat {toRoman(kelas.tingkat)}</td>
                  <td className="p-4 text-slate-600 font-medium">{kelas.waliKelas}</td>
                  <td className="p-4">
                    <button onClick={() => handleOpenEdit(kelas)} className="text-[#155EEF] hover:text-blue-800 font-bold mr-4 transition-colors">Edit</button>
                    <button onClick={() => handleHapus(kelas.id)} className="text-[#EF4444] hover:text-red-800 font-bold transition-colors">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah/Edit Kelas */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-[#082B62]">
                {editId ? 'Edit Data Kelas' : 'Tambah Data Kelas'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                 ✕
              </button>
            </div>
            
            <form onSubmit={handleSimpanKelas} className="space-y-4">
              {/* TAHUN AJARAN DROPDOWN */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tahun Ajaran</label>
                <select value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)} required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer">
                  <option value="">-- Pilih Tahun Ajaran --</option>
                  {tahunAjaranList.map((tahun) => (
                    <option key={tahun.id} value={tahun.tahun}>
                      {tahun.tahun} ({tahun.semester}) {tahun.status === 'Aktif' ? '✓ Aktif' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Kelas</label>
                <input type="text" value={namaKelas} onChange={(e) => setNamaKelas(e.target.value)} required placeholder="Contoh: 1A, 7B"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Jenjang</label>
                  <select value={jenjang} onChange={(e) => { setJenjang(e.target.value); setTingkat('1'); }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer">
                    <option value="SD">SD</option>
                    <option value="SMP">SMP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tingkat</label>
                  <select value={tingkat} onChange={(e) => setTingkat(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer">
                    {jenjang === 'SD' 
                      ? ['1','2','3','4','5','6'].map(k => <option key={k} value={k}>Tingkat {toRoman(k)}</option>)
                      : ['7','8','9'].map(k => <option key={k} value={k}>Tingkat {toRoman(k)}</option>)
                    }
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Wali Kelas (Pilih dari Data Pegawai)</label>
                <select value={waliKelas} onChange={(e) => setWaliKelas(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer">
                  <option value="">-- Belum Ditentukan --</option>
                  {guruList.map((guru) => (
                    <option key={guru.id} value={guru.nama}>{guru.nama} ({guru.jabatan})</option>
                  ))}
                </select>
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