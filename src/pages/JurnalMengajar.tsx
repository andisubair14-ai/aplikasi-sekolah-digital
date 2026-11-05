import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function JurnalMengajar() {
  const { userData } = useAuth();
  const [jurnalList, setJurnalList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // State Data Jurnal
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamKe, setJamKe] = useState('');
  const [kelas, setKelas] = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [tema, setTema] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [kegiatanMedia, setKegiatanMedia] = useState('');
  const [absensiSiswa, setAbsensiSiswa] = useState('');
  const [refleksi, setRefleksi] = useState('');

  // Fungsi Print Bawaan Browser
  const handlePrint = () => {
    window.print();
  };

  // Mengambil data Jurnal dan Kelas
  useEffect(() => {
    if (!userData) return;
    const q = query(collection(db, 'jurnal'), where('guruId', '==', userData.uid));
    const unsubJurnal = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setJurnalList(data);
      setLoading(false);
    });

    const unsubKelas = onSnapshot(collection(db, 'kelas'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setKelasList(data);
    });
    return () => { unsubJurnal(); unsubKelas(); };
  }, [userData]);

  const handleOpenTambah = () => {
    setEditId(null); setTanggal(new Date().toISOString().split('T')[0]);
    setJamKe(''); setKelas(''); setMataPelajaran(''); setTema(''); 
    setTujuan(''); setKegiatanMedia(''); setAbsensiSiswa(''); setRefleksi('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (jurnal: any) => {
    setEditId(jurnal.id);
    setTanggal(jurnal.tanggal); setJamKe(jurnal.jamKe || ''); setKelas(jurnal.kelas);
    setMataPelajaran(jurnal.mataPelajaran); setTema(jurnal.tema || '');
    setTujuan(jurnal.tujuan || ''); setKegiatanMedia(jurnal.kegiatanMedia || '');
    setAbsensiSiswa(jurnal.absensiSiswa || ''); setRefleksi(jurnal.refleksi || '');
    setIsModalOpen(true);
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      const dataJurnal = {
        guruId: userData.uid, namaGuru: userData.nama,
        tanggal, jamKe, kelas, mataPelajaran, tema, tujuan, kegiatanMedia, absensiSiswa, refleksi,
        status: 'Dikirim', 
        catatanKepsek: '', 
        updatedAt: new Date().toISOString()
      };

      if (editId) {
        await updateDoc(doc(db, 'jurnal', editId), dataJurnal);
      } else {
        await addDoc(collection(db, 'jurnal'), { ...dataJurnal, createdAt: new Date().toISOString() });
      }
      setIsModalOpen(false);
    } catch (error) {
      alert('Gagal menyimpan jurnal: ' + error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Dikirim': return 'bg-blue-100 text-blue-700';
      case 'Disetujui': return 'bg-emerald-100 text-emerald-700';
      case 'Perlu Perbaikan': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const formatTanggal = (tgl: string) => {
    const date = new Date(tgl);
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <>
      {/* CSS KHUSUS PRINT - SUDAH DIPERBAIKI AGAR TIDAK ADA RUANG KOSONG DI ATAS */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          
          /* Menarik area cetak mentok ke pojok kiri atas */
          .print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            margin: 0 !important; 
            padding: 0 !important;
          }
          
          /* Menghapus padding bawaan dari layout dashboard */
          html, body, #root, .flex, main, .overflow-y-auto {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }
        }
      `}</style>

      <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-[#082B62]">Jurnal Mengajar</h1>
            <p className="text-slate-500 mt-1 font-medium">Catat kegiatan pembelajaran harian Anda.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-sm text-sm flex items-center gap-2">
              🖨️ Cetak PDF / Print
            </button>
            <button onClick={handleOpenTambah} className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-sm text-sm">
              + Tambah Jurnal
            </button>
          </div>
        </div>

        {/* Tabel Jurnal */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto print:hidden">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <th className="p-4 font-bold uppercase tracking-wider text-xs">No</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Hari / Tanggal</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Jam Ke-</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Elemen / Bab / Tema</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Tujuan Pembelajaran</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Kegiatan & Media</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Status</th>
                <th className="p-4 font-bold uppercase tracking-wider text-xs">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500 font-medium">Memuat data...</td></tr>
              ) : jurnalList.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500 font-medium">Belum ada jurnal yang dibuat.</td></tr>
              ) : (
                jurnalList.map((jurnal, index) => (
                  <tr key={jurnal.id} className="border-b border-slate-100 hover:bg-[#F5F7FB] transition-colors text-sm">
                    <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                    <td className="p-4 font-bold text-[#082B62]">{formatTanggal(jurnal.tanggal)}</td>
                    <td className="p-4 text-slate-600 font-medium">{jurnal.jamKe}</td>
                    <td className="p-4 text-slate-600 font-medium">
                      <span className="font-bold">{jurnal.mataPelajaran}</span><br/>
                      <span className="text-xs text-slate-500">{jurnal.tema}</span>
                    </td>
                    <td className="p-4 text-slate-600 font-medium truncate max-w-[200px]" title={jurnal.tujuan}>{jurnal.tujuan}</td>
                    <td className="p-4 text-slate-600 font-medium truncate max-w-[200px]" title={jurnal.kegiatanMedia}>{jurnal.kegiatanMedia}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-md text-xs font-bold ${getStatusBadge(jurnal.status)}`}>
                        {jurnal.status}
                      </span>
                      {jurnal.catatanKepsek && (
                        <p className="text-xs text-red-500 mt-1 italic">Catatan: {jurnal.catatanKepsek}</p>
                      )}
                    </td>
                    <td className="p-4">
                      {jurnal.status !== 'Disetujui' ? (
                        <button onClick={() => handleOpenEdit(jurnal)} className="text-[#155EEF] hover:text-blue-800 font-bold transition-colors">Edit</button>
                      ) : (
                        <span className="text-xs text-emerald-600 font-bold">✓ Selesai</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ===================================================================== */}
        {/* AREA CETAK */}
        {/* ===================================================================== */}
        <div className="print-area hidden print:block bg-white text-black font-serif w-full">
          
          <div className="text-center border-b-4 border-double border-black pb-4 mb-6">
            <h2 className="text-xl font-bold uppercase">Pemerintah Daerah</h2>
            <h1 className="text-3xl font-extrabold uppercase">SMP NEGERI 1</h1>
            <p className="text-sm mt-1">Jl. Pendidikan No. 1, Kecamatan, Kabupaten, Kode Pos</p>
            <p className="text-sm">Email: admin@sekolah.sch.id | Website: www.sekolah.sch.id</p>
          </div>

          <div className="text-center mb-6">
            <h3 className="text-xl font-bold underline mb-1">JURNAL HARIAN GURU</h3>
            <p className="text-sm">Tahun Pelajaran 2025/2026</p>
          </div>

          <div className="mb-4 text-sm">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="w-32 font-semibold">Nama Guru</td>
                  <td className="w-4">:</td>
                  <td>{userData?.nama || '-'}</td>
                </tr>
                <tr>
                  <td className="font-semibold">NIP / NUPTK</td>
                  <td>:</td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>

          <table className="w-full border-collapse border border-black text-xs mb-8">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-2 w-10 text-center">No</th>
                <th className="border border-black p-2 w-24">Hari/Tanggal</th>
                <th className="border border-black p-2 w-16 text-center">Jam Ke-</th>
                <th className="border border-black p-2 w-32">Elemen/Bab/Tema</th>
                <th className="border border-black p-2 w-40">Tujuan Pembelajaran (TP)</th>
                <th className="border border-black p-2 w-40">Kegiatan Pembelajaran & Media</th>
                <th className="border border-black p-2 w-28">Absensi / Kehadiran</th>
                <th className="border border-black p-2 w-32">Refleksi & Tindak Lanjut</th>
              </tr>
            </thead>
            <tbody>
              {jurnalList.map((jurnal, index) => (
                <tr key={jurnal.id}>
                  <td className="border border-black p-2 text-center align-top">{index + 1}</td>
                  <td className="border border-black p-2 align-top">{formatTanggal(jurnal.tanggal)}</td>
                  <td className="border border-black p-2 text-center align-top">{jurnal.jamKe}</td>
                  <td className="border border-black p-2 align-top">
                    <span className="font-bold">{jurnal.mataPelajaran}</span><br/>
                    {jurnal.tema}
                  </td>
                  <td className="border border-black p-2 align-top">{jurnal.tujuan}</td>
                  <td className="border border-black p-2 align-top">{jurnal.kegiatanMedia}</td>
                  <td className="border border-black p-2 align-top">{jurnal.absensiSiswa || '-'}</td>
                  <td className="border border-black p-2 align-top">{jurnal.refleksi || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-12 flex justify-between text-sm">
            <div className="text-center w-64">
              <p>Mengetahui,</p>
              <p className="mb-20">Kepala Sekolah</p>
              <p className="font-bold underline">..............................................</p>
              <p>NIP. ............................................</p>
            </div>

            <div className="text-center w-64">
              <p>Kabupaten, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="mb-20">Guru Mata Pelajaran</p>
              <p className="font-bold underline">{userData?.nama || '..............................................'}</p>
              <p>NIP. ............................................</p>
            </div>
          </div>

        </div>
        {/* ================= AKHIR AREA CETAK ================= */}

        {/* Modal Form Jurnal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 print:hidden">
            <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-xl font-bold text-[#082B62]">
                  {editId ? 'Edit Jurnal Mengajar' : 'Buat Jurnal Mengajar'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              
              <form onSubmit={handleSimpan} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal</label>
                  <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Jam Ke-</label>
                  <input type="text" value={jamKe} onChange={(e) => setJamKe(e.target.value)} required placeholder="Contoh: 1 - 3"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Kelas</label>
                  <select value={kelas} onChange={(e) => setKelas(e.target.value)} required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer">
                    <option value="">-- Pilih Kelas --</option>
                    {kelasList.map(k => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                  <input type="text" value={mataPelajaran} onChange={(e) => setMataPelajaran(e.target.value)} required placeholder="Contoh: Matematika"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Elemen / Bab / Tema</label>
                  <input type="text" value={tema} onChange={(e) => setTema(e.target.value)} required placeholder="Contoh: Bab 3 - Lihat Sekitar"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tujuan Pembelajaran (TP)</label>
                  <textarea value={tujuan} onChange={(e) => setTujuan(e.target.value)} required rows={2} placeholder="Contoh: Peserta didik mampu mengidentifikasi rambu lalu lintas..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium resize-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Kegiatan Pembelajaran & Media</label>
                  <textarea value={kegiatanMedia} onChange={(e) => setKegiatanMedia(e.target.value)} required rows={3} placeholder="Contoh: Diskusi kelompok. Media: Kartu gambar rambu."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Absensi / Kehadiran Siswa</label>
                  <input type="text" value={absensiSiswa} onChange={(e) => setAbsensiSiswa(e.target.value)} placeholder="Contoh: Hadir 28, Sakit 2"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Refleksi & Tindak Lanjut Guru</label>
                  <textarea value={refleksi} onChange={(e) => setRefleksi(e.target.value)} rows={2} placeholder="Contoh: 80% siswa paham, 5 siswa remedial."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium resize-none" />
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 mt-4 border-t pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                  <button type="submit" className="px-6 py-2.5 bg-[#155EEF] hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all">
                    Simpan Jurnal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}