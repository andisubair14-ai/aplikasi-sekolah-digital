import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

export default function DataSiswa() {
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
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
  const [kelas, setKelas] = useState('1A');

  const [filterTingkat, setFilterTingkat] = useState('Semua');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pilihanKelas = [];
  for (let i = 1; i <= 9; i++) {
    for (const rombel of ['A', 'B', 'C', 'D', 'E']) {
      pilihanKelas.push(`${i}${rombel}`);
    }
  }

  const pilihanAgama = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'];

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'siswa'), (snapshot) => {
      const dataSiswa = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSiswaList(dataSiswa);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const siswaTampil = filterTingkat === 'Semua' 
    ? siswaList 
    : siswaList.filter(siswa => String(siswa.kelas).startsWith(filterTingkat));

  const handleDownloadTemplate = () => {
    const formatData = [{ "Nama": "Budi Santoso", "NISN": "1234567890", "Tempat Lahir": "Makassar", "Tanggal Lahir": "2015-08-17", "Agama": "Islam", "Nama Ayah": "Joko", "Nama Ibu": "Siti", "Pekerjaan Orang Tua": "Petani", "Alamat": "Jl. Pendidikan No. 1", "Nomor HP": "081234567890", "Kelas": "1A" }];
    const ws = XLSX.utils.json_to_sheet(formatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Format Siswa");
    XLSX.writeFile(wb, "Format_Upload_Siswa.xlsx");
  };

  const handleDownloadData = () => {
    if (siswaTampil.length === 0) return alert('Tidak ada data untuk diunduh.');
    const dataToExport = siswaTampil.map(s => ({
      "Nama": s.nama, "NISN": s.nisn, "Tempat Lahir": s.tempatLahir, "Tanggal Lahir": s.tanggalLahir, "Agama": s.agama, "Nama Ayah": s.namaAyah, "Nama Ibu": s.namaIbu, "Pekerjaan Orang Tua": s.pekerjaanOrtu, "Alamat": s.alamat, "Nomor HP": s.noHp, "Kelas": s.kelas
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    XLSX.writeFile(wb, `Data_Siswa_${filterTingkat === 'Semua' ? 'Semua' : 'Kelas_'+filterTingkat}.xlsx`);
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
            nama: row.Nama || '-', nisn: String(row.NISN || '-'), tempatLahir: row['Tempat Lahir'] || '-', tanggalLahir: row['Tanggal Lahir'] || '-', agama: row.Agama || '-', namaAyah: row['Nama Ayah'] || '-', namaIbu: row['Nama Ibu'] || '-', pekerjaanOrtu: row['Pekerjaan Orang Tua'] || '-', alamat: row.Alamat || '-', noHp: String(row['Nomor HP'] || '-'), kelas: String(row.Kelas || '-')
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
    setEditId(null); setNama(''); setNisn(''); setTempatLahir(''); setTanggalLahir(''); setNamaAyah(''); setNamaIbu(''); setPekerjaanOrtu(''); setAlamat(''); setNoHp(''); setAgama('Islam'); setKelas('1A');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (siswa: any) => {
    setEditId(siswa.id); setNama(siswa.nama); setNisn(siswa.nisn); setTempatLahir(siswa.tempatLahir || ''); setTanggalLahir(siswa.tanggalLahir || ''); setAgama(siswa.agama || 'Islam'); setNamaAyah(siswa.namaAyah || ''); setNamaIbu(siswa.namaIbu || ''); setPekerjaanOrtu(siswa.pekerjaanOrtu || ''); setAlamat(siswa.alamat || ''); setNoHp(siswa.noHp || ''); setKelas(siswa.kelas || '1A');
    setIsModalOpen(true);
  };

  const handleSimpanSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataBaru = { nama, nisn, tempatLahir, tanggalLahir, agama, namaAyah, namaIbu, pekerjaanOrtu, alamat, noHp, kelas };
      if (editId) await updateDoc(doc(db, 'siswa', editId), dataBaru);
      else await addDoc(collection(db, 'siswa'), dataBaru);
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header Halaman */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B1F46]">Data Siswa</h1>
          <p className="text-slate-500 mt-1 font-medium">Kelola informasi seluruh siswa di sekolah.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          
          <button onClick={handleDownloadTemplate} className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-semibold transition-colors text-sm border border-slate-300 shadow-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Template
          </button>
          
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-[#155EEF] hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-sm flex items-center gap-2 text-sm">
            {isUploading ? 'Mengunggah...' : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Upload Excel</>}
          </button>
          
          <button onClick={handleOpenTambah} className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-sm text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg> Tambah Manual
          </button>
        </div>
      </div>

      {/* FILTER & DOWNLOAD DATA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex overflow-x-auto pb-2 sm:pb-0 gap-2 scrollbar-hide w-full sm:w-auto px-2">
          {['Semua', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((tingkat) => (
            <button
              key={tingkat}
              onClick={() => setFilterTingkat(tingkat)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                filterTingkat === tingkat ? 'bg-[#EFF6FF] text-[#155EEF]' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tingkat === 'Semua' ? 'Semua Kelas' : `Kelas ${tingkat}`}
            </button>
          ))}
        </div>
        <button onClick={handleDownloadData} className="bg-[#EFF6FF] hover:bg-blue-100 text-[#155EEF] px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap mr-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Unduh Data
        </button>
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
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Kelas</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Tempat, Tgl Lahir</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Agama</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Orang Tua (Ayah/Ibu)</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Pekerjaan Ortu</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Alamat</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">No. HP</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="p-8 text-center text-slate-500 font-medium">Memuat data...</td></tr>
              ) : siswaTampil.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-slate-500 font-medium">Tidak ada data siswa untuk filter ini.</td></tr>
              ) : (
                siswaTampil.map((siswa, index) => (
                  <tr key={siswa.id} className="border-b border-slate-100 hover:bg-[#F5F7FB] transition-colors text-sm">
                    <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                    <td className="p-4 font-bold text-[#0B1F46]">{siswa.nama}</td>
                    <td className="p-4 text-slate-600 font-medium">{siswa.nisn}</td>
                    <td className="p-4">
                      <span className="bg-[#EFF6FF] text-[#155EEF] px-3 py-1 rounded-md text-xs font-bold">
                        {siswa.kelas}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 font-medium">{siswa.tempatLahir}, {siswa.tanggalLahir}</td>
                    <td className="p-4 text-slate-600 font-medium">{siswa.agama}</td>
                    <td className="p-4 text-slate-600 font-medium">{siswa.namaAyah} / {siswa.namaIbu}</td>
                    <td className="p-4 text-slate-600 font-medium">{siswa.pekerjaanOrtu}</td>
                    <td className="p-4 text-slate-600 font-medium truncate max-w-[150px]" title={siswa.alamat}>{siswa.alamat}</td>
                    <td className="p-4 text-slate-600 font-medium">{siswa.noHp}</td>
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
              {/* Kolom Kiri */}
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Lengkap</label>
                  <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">NISN</label>
                  <input type="text" value={nisn} onChange={(e) => setNisn(e.target.value)} required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Tempat Lahir</label>
                    <input type="text" value={tempatLahir} onChange={(e) => setTempatLahir(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Tgl Lahir</label>
                    <input type="date" value={tanggalLahir} onChange={(e) => setTanggalLahir(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Agama</label>
                    <select value={agama} onChange={(e) => setAgama(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium cursor-pointer">
                      {pilihanAgama.map((agm) => <option key={agm} value={agm}>{agm}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Kelas</label>
                    <select value={kelas} onChange={(e) => setKelas(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium cursor-pointer">
                      {pilihanKelas.map((kls) => <option key={kls} value={kls}>{kls}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan */}
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Ayah</label>
                  <input type="text" value={namaAyah} onChange={(e) => setNamaAyah(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Ibu</label>
                  <input type="text" value={namaIbu} onChange={(e) => setNamaIbu(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Pekerjaan Orang Tua</label>
                  <input type="text" value={pekerjaanOrtu} onChange={(e) => setPekerjaanOrtu(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nomor HP</label>
                  <input type="text" value={noHp} onChange={(e) => setNoHp(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Alamat Lengkap</label>
                  <textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-[#155EEF]/10 focus:border-[#155EEF] outline-none transition-all font-medium resize-none" />
                </div>
              </div>

              {/* Tombol Aksi Form */}
              <div className="md:col-span-2 flex justify-end gap-3 mt-4 border-t border-slate-100 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                <button type="submit" className="px-8 py-2.5 bg-[#155EEF] hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]">
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