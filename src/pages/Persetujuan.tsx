import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Persetujuan() {
  const [jurnalList, setJurnalList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('Dikirim');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'jurnal'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setJurnalList(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSetujui = async (id: string) => {
    if (window.confirm('Setujui jurnal mengajar ini?')) {
      try {
        await updateDoc(doc(db, 'jurnal', id), { status: 'Disetujui', catatanKepsek: '' });
      } catch (error) { alert('Gagal menyetujui: ' + error); }
    }
  };

  const handleRevisi = async (id: string) => {
    const catatan = window.prompt('Masukkan alasan/catatan untuk perbaikan jurnal ini:');
    if (catatan === null) return;
    if (catatan.trim() === '') return alert('Catatan revisi tidak boleh kosong!');
    try {
      await updateDoc(doc(db, 'jurnal', id), { status: 'Perlu Perbaikan', catatanKepsek: catatan });
    } catch (error) { alert('Gagal meminta revisi: ' + error); }
  };

  const jurnalTampil = filterStatus === 'Semua' ? jurnalList : jurnalList.filter(j => j.status === filterStatus);

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
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      
      <div>
        <h1 className="text-2xl font-bold text-[#082B62]">Persetujuan Jurnal</h1>
        <p className="text-slate-500 mt-1 font-medium">Review jurnal mengajar yang dikirim oleh Guru.</p>
      </div>

      {/* Filter */}
      <div className="flex overflow-x-auto pb-2 gap-2">
        {['Dikirim', 'Disetujui', 'Perlu Perbaikan', 'Semua'].map((status) => (
          <button key={status} onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
              filterStatus === status ? 'bg-[#EFF6FF] text-[#155EEF]' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
            }`}>
            {status}
          </button>
        ))}
      </div>

      {/* Tabel Review */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <th className="p-4 font-bold uppercase text-xs">Guru & Tanggal</th>
              <th className="p-4 font-bold uppercase text-xs">Kelas / Mapel / Jam</th>
              <th className="p-4 font-bold uppercase text-xs">Tema & TP</th>
              <th className="p-4 font-bold uppercase text-xs">Kegiatan & Refleksi</th>
              <th className="p-4 font-bold uppercase text-xs">Status</th>
              <th className="p-4 font-bold uppercase text-xs">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Memuat data...</td></tr>
            ) : jurnalTampil.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Tidak ada data jurnal.</td></tr>
            ) : (
              jurnalTampil.map((jurnal) => (
                <tr key={jurnal.id} className="border-b border-slate-100 hover:bg-[#F5F7FB] transition-colors text-sm align-top">
                  <td className="p-4">
                    <p className="font-bold text-[#082B62]">{jurnal.namaGuru}</p>
                    <p className="text-xs text-slate-500">{formatTanggal(jurnal.tanggal)}</p>
                  </td>
                  <td className="p-4 text-slate-600 font-medium">
                    <p>{jurnal.kelas} - {jurnal.mataPelajaran}</p>
                    <p className="text-xs text-slate-500">Jam ke: {jurnal.jamKe}</p>
                  </td>
                  <td className="p-4 text-slate-600 font-medium max-w-[200px] whitespace-normal">
                    <p className="font-bold">{jurnal.tema}</p>
                    <p className="text-xs mt-1 text-slate-500">TP: {jurnal.tujuan}</p>
                  </td>
                  <td className="p-4 text-slate-600 font-medium max-w-[200px] whitespace-normal">
                    <p className="text-xs text-slate-500 mb-1">Kegiatan: {jurnal.kegiatanMedia}</p>
                    <p className="text-xs text-slate-500 italic">Refleksi: {jurnal.refleksi || '-'}</p>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold ${getStatusBadge(jurnal.status)}`}>
                      {jurnal.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {jurnal.status === 'Dikirim' && (
                      <div className="flex flex-col gap-2">
                        <button onClick={() => handleSetujui(jurnal.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-colors">Setujui</button>
                        <button onClick={() => handleRevisi(jurnal.id)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-colors">Revisi</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}