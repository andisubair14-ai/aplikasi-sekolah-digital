import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

export default function DataSiswa() {
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // State untuk Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // State Data Siswa (Profil)
  const [nama, setNama] = useState('');
  const [nisn, setNisn] = useState('');
  const [tempatLahir, setTempatLahir] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [namaAyah, setNamaAyah] = useState('');
  const [namaIbu, setNamaIbu] = useState('');
  const [pekerjaanOrtu, setPekerjaanOrtu] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noHp, setNoHp] = useState('');
  const [agama, setAgama] = useState('Islam');
  
  // State Data Siswa (Akademik & Riwayat)
  const [tahunAjaranId, setTahunAjaranId] = useState(''); 
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [semester, setSemester] = useState('');
  const [kelas, setKelas] = useState('');
  const [status, setStatus] = useState('Aktif');

  // State untuk Filter
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State untuk Modal Download
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadTAId, setDownloadTAId] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pilihanAgama = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'];
  const pilihanStatus = ['Aktif', 'Lulus', 'Pindah Keluar', 'Tinggal Kelas', 'Mutasi Masuk'];

  // Mengambil data dari Firebase
  useEffect(() => {
    const unsubSiswa = onSnapshot(collection(db, 'siswa'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSiswaList(data);
      setLoading(false);
    });

    const unsubKelas = onSnapshot(collection(db, 'kelas'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setKelasList(data);
    });

    const unsubTahun = onSnapshot(collection(db, 'tahun_ajaran'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTahunAjaranList(data);
    });

    return () => { unsubSiswa(); unsubKelas(); unsubTahun(); };
  }, []);

  // === PERBAIKAN 2: LOGIKA PENGURUTAN SISWA (BERDASARKAN KELAS LALU NAMA) ===
  const siswaTampil = siswaList
    .filter(siswa => {
      const matchStatus = filterStatus === 'Semua' || siswa.status === filterStatus;
      const matchSearch = 
        siswa.nama?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        siswa.nisn?.includes(searchTerm);
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      // 1. Cari data kelas untuk masing-masing siswa
      const kelasA = kelasList.find(k => k.namaKelas === a.kelas);
      const kelasB = kelasList.find(k => k.namaKelas === b.kelas);

      // 2. Dapatkan angka tingkat (default 99 jika kelas tidak ditemukan)
      const tingkatA = kelasA ? parseInt(kelasA.tingkat) : 99;
      const tingkatB = kelasB ? parseInt(kelasB.tingkat) : 99;

      // 3. Urutkan berdasarkan Tingkat (1, 2, 3...)
      if (tingkatA !== tingkatB) return tingkatA - tingkatB;

      // 4. Jika Tingkat sama, urutkan berdasarkan Nama Kelas (1A, 1B)
      const namaKelasA = a.kelas || '';
      const namaKelasB = b.kelas || '';
      if (namaKelasA !== namaKelasB) return namaKelasA.localeCompare(namaKelasB);

      // 5. Jika Kelas sama, urutkan berdasarkan Nama Siswa (A-Z)
      return (a.nama || '').localeCompare(b.nama || '');
    });

  // Opsi Kelas Dinamis berdasarkan Tahun Ajaran yang dipilih
  const pilihanKelasDinamis = kelasList.filter(k => k.tahunAjaran === tahunAjaran);

  // === FITUR EXCEL ===
  const handleDownloadTemplate = () => {
    const formatData = [{ 
      "Nama": "Budi Santoso", "NISN": "1234567890", "Tempat Lahir": "Makassar", 
      "Tanggal Lahir": "2015-08-17", "Agama": "Islam", "Nama Ayah": "Joko", 
      "Nama Ibu": "Siti", "Pekerjaan Orang Tua": "Petani", "Alamat": "Jl. Pendidikan No. 1", 
      "Nomor HP": "081234567890", "Tahun Ajaran": "2025/2026", "Semester": "Ganjil", "Kelas": "1A", "Status": "Aktif" 
    }];
    const ws = XLSX.utils.json_to_sheet(formatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Format Siswa");
    XLSX.writeFile(wb, "Format_Upload_Siswa.xlsx");
  };

  // === FITUR DOWNLOAD DATA (DENGAN FILTER & RIWAYAT) ===
  const handleDownloadFiltered = () => {
    let filteredData: any[] = [];
    let fileNameSuffix = "Semua";

    if (downloadTAId) {
      const selectedTA = tahunAjaranList.find(t => t.id === downloadTAId);
      if (!selectedTA) return alert('Tahun ajaran tidak ditemukan.');
      
      fileNameSuffix = `${selectedTA.tahun.replace('/', '-')}_${selectedTA.semester}`;

      siswaList.forEach(siswa => {
        if (siswa.tahunAjaran === selectedTA.tahun && siswa.semester === selectedTA.semester) {
          filteredData.push({
            nama: siswa.nama, nisn: siswa.nisn, tempatLahir: siswa.tempatLahir, 
            tanggalLahir: siswa.tanggalLahir, agama: siswa.agama, namaAyah: siswa.namaAyah, 
            namaIbu: siswa.namaIbu, pekerjaanOrtu: siswa.pekerjaanOrtu, alamat: siswa.alamat, 
            noHp: siswa.noHp, tahunAjaran: siswa.tahunAjaran, semester: siswa.semester, 
            kelas: siswa.kelas, status: siswa.status
          });
        } else if (siswa.riwayat && Array.isArray(siswa.riwayat)) {
          const historyMatch = siswa.riwayat.find((r: any) => 
            r.tahunAjaran === selectedTA.tahun && r.semester === selectedTA.semester
          );
          
          if (historyMatch) {
            filteredData.push({
              nama: siswa.nama, nisn: siswa.nisn, tempatLahir: siswa.tempatLahir, 
              tanggalLahir: siswa.tanggalLahir, agama: siswa.agama, namaAyah: siswa.namaAyah, 
              namaIbu: siswa.namaIbu, pekerjaanOrtu: siswa.pekerjaanOrtu, alamat: siswa.alamat, 
              noHp: siswa.noHp, tahunAjaran: historyMatch.tahunAjaran, semester: historyMatch.semester, 
              kelas: historyMatch.kelas, status: historyMatch.status
            });
          }
        }
      });
    } else {
      filteredData = siswaList;
    }

    if (filteredData.length === 0) {
      alert('Tidak ada data siswa untuk filter yang dipilih.');
      return;
    }

    const dataToExport = filteredData.map(s => ({
      "Nama": s.nama, "NISN": s.nisn, "Tempat Lahir": s.tempatLahir, 
      "Tanggal Lahir": s.tanggalLahir, "Agama": s.agama, "Nama Ayah": s.namaAyah, 
      "Nama Ibu": s.namaIbu, "Pekerjaan Orang Tua": s.pekerjaanOrtu, "Alamat": s.alamat, 
      "Nomor HP": s.noHp, "Tahun Ajaran": s.tahunAjaran, "Semester": s.semester || '-',
      "Kelas": s.kelas, "Status": s.status
    }));
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    XLSX.writeFile(wb, `Data_Siswa_${fileNameSuffix}.xlsx`);
    
    setIsDownloadModalOpen(false);
    setDownloadTAId('');
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
        const siswaRef = collection(db, 'siswa');
        jsonData.forEach((row) => {
          const docRef = doc(siswaRef); 
          batch.set(docRef, {
            nama: row.Nama || '-', nisn: String(row.NISN || '-'), tempatLahir: row['Tempat Lahir'] || '-', 
            tanggalLahir: row['Tanggal Lahir'] || '-', agama: row.Agama || '-', namaAyah: row['Nama Ayah'] || '-', 
            namaIbu: row['Nama Ibu'] || '-', pekerjaanOrtu: row['Pekerjaan Orang Tua'] || '-', alamat: row.Alamat || '-', 
            noHp: String(row['Nomor HP'] || '-'), tahunAjaran: row['Tahun Ajaran'] || '-', 
            semester: row['Semester'] || '-', kelas: String(row.Kelas || '-'), 
            status: row.Status || 'Aktif', riwayat: []
          });
        });
        await batch.commit();
        alert(`Berhasil mengimpor ${jsonData.length} data siswa!`);
      } catch (error) {
        alert('Gagal mengimpor. Pastikan format file sesuai dengan Template.');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOpenTambah = () => {
    setEditId(null); setNama(''); setNisn(''); setTempatLahir(''); setTanggalLahir(''); setNamaAyah(''); setNamaIbu(''); setPekerjaanOrtu(''); setAlamat(''); setNoHp(''); setAgama('Islam'); 
    setTahunAjaranId(''); setTahunAjaran(''); setSemester('');
    setKelas(''); setStatus('Aktif');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (siswa: any) => {
    setEditId(siswa.id); setNama(siswa.nama); setNisn(siswa.nisn); setTempatLahir(siswa.tempatLahir || ''); setTanggalLahir(siswa.tanggalLahir || ''); setAgama(siswa.agama || 'Islam'); setNamaAyah(siswa.namaAyah || ''); setNamaIbu(siswa.namaIbu || ''); setPekerjaanOrtu(siswa.pekerjaanOrtu || ''); setAlamat(siswa.alamat || ''); setNoHp(siswa.noHp || ''); 
    
    const matchedTA = tahunAjaranList.find(t => t.tahun === siswa.tahunAjaran && t.semester === siswa.semester);
    setTahunAjaranId(matchedTA?.id || '');
    setTahunAjaran(siswa.tahunAjaran || ''); 
    setSemester(siswa.semester || '');
    setKelas(siswa.kelas || ''); setStatus(siswa.status || 'Aktif');
    setIsModalOpen(true);
  };

  const handleSimpanSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataBaru = { 
        nama, nisn, tempatLahir, tanggalLahir, agama, namaAyah, namaIbu, pekerjaanOrtu, alamat, noHp, 
        tahunAjaran, semester, kelas, status 
      };
      
      if (editId) {
        const oldSiswa = siswaList.find(s => s.id === editId);
        
        if (oldSiswa && (oldSiswa.tahunAjaran !== tahunAjaran || oldSiswa.semester !== semester || oldSiswa.kelas !== kelas)) {
          const newRiwayat = oldSiswa.riwayat || [];
          
          const isAlreadyInHistory = newRiwayat.some((r: any) => 
            r.tahunAjaran === oldSiswa.tahunAjaran && r.semester === oldSiswa.semester && r.kelas === oldSiswa.kelas
          );

          if (!isAlreadyInHistory && oldSiswa.tahunAjaran) {
            newRiwayat.push({
              tahunAjaran: oldSiswa.tahunAjaran,
              semester: oldSiswa.semester,
              kelas: oldSiswa.kelas,
              status: oldSiswa.status
            });
          }
          dataBaru.riwayat = newRiwayat;
        }
        
        await updateDoc(doc(db, 'siswa', editId), dataBaru);
      } else {
        await addDoc(collection(db, 'siswa'), { ...dataBaru, riwayat: [] });
      }
      setIsModalOpen(false);
    } catch (error) {
      alert('Gagal menyimpan data: ' + error);
    }
  };

  const handleHapus = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data siswa ini?')) {
      try { await deleteDoc(doc(db, 'siswa', id)); } catch (error) { alert('Gagal menghapus data: ' + error); }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aktif': return 'bg-emerald-100 text-emerald-700';
      case 'Lulus': return 'bg-blue-100 text-blue-700';
      case 'Pindah Keluar': return 'bg-amber-100 text-amber-700';
      case 'Tinggal Kelas': return 'bg-orange-100 text-orange-700';
      case 'Mutasi Masuk': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header Halaman */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">Data Siswa</h1>
          <p className="text-slate-500 mt-1 font-medium">Kelola profil dan riwayat akademik siswa.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          
          <button onClick={handleDownloadTemplate} className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-slate-300 shadow-sm">
            Template
          </button>
          
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-[#155EEF] hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-sm text-sm">
            {isUploading ? 'Mengunggah...' : 'Upload Excel'}
          </button>

          <button onClick={() => setIsDownloadModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-sm text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download Data
          </button>
          
          <button onClick={handleOpenTambah} className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-sm text-sm">
            + Tambah Siswa
          </button>
        </div>
      </div>

      {/* FILTER STATUS & PENCARIAN */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex overflow-x-auto pb-2 xl:pb-0 gap-2 scrollbar-hide w-full xl:w-auto">
          {['Semua', 'Aktif', 'Lulus', 'Pindah Keluar', 'Tinggal Kelas'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                filterStatus === status ? 'bg-[#EFF6FF] text-[#155EEF]' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {status === 'Semua' ? 'Semua Siswa' : status}
            </button>
          ))}
        </div>
        
        <div className="flex w-full xl:w-auto gap-2">
          <input 
            type="text" 
            placeholder="Cari Nama atau NISN..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full xl:w-64 px-4 py-2 bg-white border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#155EEF] outline-none font-medium text-sm transition-all"
          />
        </div>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <th className="p-4 font-bold uppercase tracking-wider text-xs">No</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Nama Siswa</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">NISN</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Tahun Ajaran</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Semester</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Kelas</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Status</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500 font-medium">Memuat data...</td></tr>
              ) : siswaTampil.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500 font-medium">Tidak ada data siswa ditemukan.</td></tr>
              ) : (
                siswaTampil.map((siswa, index) => (
                  <tr key={siswa.id} className="border-b border-slate-100 hover:bg-[#F5F7FB] transition-colors text-sm">
                    <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                    <td className="p-4 font-bold text-[#082B62]">{siswa.nama}</td>
                    <td className="p-4 text-slate-600 font-medium">{siswa.nisn}</td>
                    <td className="p-4 text-slate-600 font-medium">{siswa.tahunAjaran || '-'}</td>
                    <td className="p-4 text-slate-600 font-medium">{siswa.semester || '-'}</td>
                    <td className="p-4">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-md text-xs font-bold">
                        {siswa.kelas || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-md text-xs font-bold ${getStatusBadge(siswa.status)}`}>
                        {siswa.status || 'Aktif'}
                      </span>
                    </td>
                    <td className="p-4">
                      <button onClick={() => handleOpenEdit(siswa)} className="text-[#155EEF] hover:text-blue-800 font-bold mr-4 transition-colors">Edit</button>
                      <button onClick={() => handleHapus(siswa.id)} className="text-[#EF4444] hover:text-red-800 font-bold transition-colors">Hapus</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MODAL DOWNLOAD FILTER ===== */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-[#082B62]">Filter Download Data Siswa</h2>
              <button onClick={() => setIsDownloadModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Tahun Ajaran & Semester</label>
                <select 
                  value={downloadTAId} 
                  onChange={(e) => setDownloadTAId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer"
                >
                  <option value="">-- Semua Data Siswa (Tanpa Filter) --</option>
                  {tahunAjaranList.map(t => (
                    <option key={t.id} value={t.id}>{t.tahun} - {t.semester} {t.status === 'Aktif' ? '(Aktif)' : ''}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">Sistem akan mencari data di kolom utama dan di dalam arsip riwayat siswa.</p>
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                <button onClick={() => setIsDownloadModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                <button onClick={handleDownloadFiltered} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md transition-all">
                  Download Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Siswa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0B1F46]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-3xl shadow-2xl my-auto">
            <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-bold text-[#0B1F46]">
                {editId ? 'Edit Data Siswa' : 'Tambah Data Siswa'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSimpanSiswa} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {/* Kolom Kiri: Profil */}
              <div className="space-y-5">
                <h3 className="font-bold text-[#155EEF] border-b pb-1">Profil Siswa</h3>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Lengkap</label>
                  {/* PERBAIKAN 1: bg-white border-slate-300 dan placeholder */}
                  <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} required placeholder="Masukkan nama lengkap"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">NISN</label>
                  <input type="text" value={nisn} onChange={(e) => setNisn(e.target.value)} required placeholder="Masukkan NISN"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Tempat Lahir</label>
                    <input type="text" value={tempatLahir} onChange={(e) => setTempatLahir(e.target.value)} placeholder="Contoh: Bone"
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Tgl Lahir</label>
                    <input type="date" value={tanggalLahir} onChange={(e) => setTanggalLahir(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Agama</label>
                  <select value={agama} onChange={(e) => setAgama(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium cursor-pointer transition-all">
                    {pilihanAgama.map((agm) => <option key={agm} value={agm}>{agm}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nomor HP</label>
                  <input type="text" value={noHp} onChange={(e) => setNoHp(e.target.value)} placeholder="Contoh: 081234567890"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Alamat Lengkap</label>
                  <textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} rows={2} placeholder="Masukkan alamat lengkap"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium resize-none transition-all" />
                </div>
              </div>

              {/* Kolom Kanan: Akademik & Ortu */}
              <div className="space-y-5">
                <h3 className="font-bold text-[#155EEF] border-b pb-1">Data Akademik & Riwayat</h3>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Tahun Ajaran & Semester</label>
                  <select 
                    value={tahunAjaranId} 
                    onChange={(e) => { 
                      const taId = e.target.value;
                      setTahunAjaranId(taId); 
                      const ta = tahunAjaranList.find(t => t.id === taId);
                      if (ta) {
                        setTahunAjaran(ta.tahun);
                        setSemester(ta.semester);
                      } else {
                        setTahunAjaran('');
                        setSemester('');
                      }
                      setKelas(''); 
                    }} 
                    required
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium cursor-pointer transition-all">
                    <option value="">-- Pilih Tahun Ajaran --</option>
                    {tahunAjaranList.map(t => (
                      <option key={t.id} value={t.id}>{t.tahun} - {t.semester} {t.status === 'Aktif' ? '✓' : ''}</option>
                    ))}
                  </select>
                  <p className="text-xs text-emerald-600 mt-1">*Mengubah data ini akan otomatis menyimpan data lama ke arsip riwayat.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Kelas</label>
                  <select value={kelas} onChange={(e) => setKelas(e.target.value)} required
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium cursor-pointer transition-all">
                    <option value="">-- Pilih Kelas --</option>
                    {pilihanKelasDinamis.map(k => (
                      <option key={k.id} value={k.namaKelas}>{k.namaKelas} (Tingkat {k.tingkat})</option>
                    ))}
                  </select>
                  {pilihanKelasDinamis.length === 0 && <p className="text-xs text-red-500 mt-1">Belum ada kelas untuk tahun ajaran ini.</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Status Siswa</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}
                    className={`w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 outline-none font-bold cursor-pointer transition-colors ${getStatusBadge(status)}`}>
                    {pilihanStatus.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <h3 className="font-bold text-[#155EEF] border-b pb-1 mt-6">Data Orang Tua</h3>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Ayah</label>
                  <input type="text" value={namaAyah} onChange={(e) => setNamaAyah(e.target.value)} placeholder="Masukkan nama ayah"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Ibu</label>
                  <input type="text" value={namaIbu} onChange={(e) => setNamaIbu(e.target.value)} placeholder="Masukkan nama ibu"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Pekerjaan Orang Tua</label>
                  <input type="text" value={pekerjaanOrtu} onChange={(e) => setPekerjaanOrtu(e.target.value)} placeholder="Contoh: Petani"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium transition-all" />
                </div>
              </div>

              {/* Tombol Aksi Form */}
              <div className="md:col-span-2 flex justify-end gap-3 mt-4 border-t border-slate-100 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                <button type="submit" className="px-8 py-2.5 bg-[#155EEF] hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all">
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