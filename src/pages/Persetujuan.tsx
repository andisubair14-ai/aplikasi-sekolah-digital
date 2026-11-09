import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type JurnalRecord = {
  id: string;
  userId?: string;
  guruId?: string;
  namaGuru?: string;
  tanggal?: string;
  jamKe?: string;
  kelas?: string;
  mataPelajaran?: string;
  tema?: string;
  tujuan?: string;
  kegiatanMedia?: string;
  refleksi?: string;
  status?: string;
  catatanKepsek?: string;
  createdAt?: string;
  tahunAjaran?: string;
  semester?: string;
};

export default function Persetujuan() {
  const { userData } = useAuth();
  const [jurnalList, setJurnalList] = useState<JurnalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('Dikirim');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorData, setErrorData] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'jurnal'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as JurnalRecord[];
        data.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setJurnalList(data);
        setLoading(false);
        setErrorData('');
      },
      (error) => {
        console.error('Gagal memuat jurnal untuk persetujuan:', error);
        setErrorData('Data jurnal belum dapat dimuat. Periksa koneksi dan aturan Firestore.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const prosesJurnal = async (
    jurnalId: string,
    statusBaru: 'Disetujui' | 'Perlu Perbaikan',
    catatanKepsek: string
  ) => {
    const jurnal = jurnalList.find((item) => item.id === jurnalId);
    if (!jurnal) {
      alert('Jurnal tidak ditemukan. Muat ulang halaman lalu coba kembali.');
      return;
    }

    // Jurnal terbaru menggunakan userId; jurnal lama menggunakan guruId yang berisi UID akun.
    const uidGuru = String(jurnal.userId || jurnal.guruId || '').trim();
    if (!uidGuru) {
      alert('Jurnal ini belum memiliki UID akun Guru. Status tidak diubah agar pemberitahuan tidak salah alamat.');
      return;
    }

    if (jurnal.status !== 'Dikirim') {
      alert('Jurnal ini sudah diproses. Muat ulang daftar untuk melihat status terbaru.');
      return;
    }

    const adalahDisetujui = statusBaru === 'Disetujui';
    const judul = adalahDisetujui ? 'Jurnal Mengajar Disetujui' : 'Jurnal Memerlukan Perbaikan';
    const pesan = adalahDisetujui
      ? `Jurnal ${jurnal.tanggal || ''} untuk kelas ${jurnal.kelas || '-'} (${jurnal.mataPelajaran || '-'}) telah disetujui Kepala Sekolah.`
      : `Jurnal ${jurnal.tanggal || ''} untuk kelas ${jurnal.kelas || '-'} (${jurnal.mataPelajaran || '-'}) perlu diperbaiki. Catatan: ${catatanKepsek}`;

    setProcessingId(jurnalId);
    try {
      // Satu batch memastikan perubahan status dan pembuatan notifikasi berhasil bersama.
      const batch = writeBatch(db);
      batch.update(doc(db, 'jurnal', jurnalId), {
        status: statusBaru,
        catatanKepsek,
        diprosesOlehUid: userData?.uid || null,
        diprosesPada: serverTimestamp(),
      });

      const notifRef = doc(collection(db, 'users', uidGuru, 'notifikasi'));
      batch.set(notifRef, {
        judul,
        pesan,
        tipe: adalahDisetujui ? 'jurnal_disetujui' : 'jurnal_revisi',
        dibaca: false,
        dibuatPada: serverTimestamp(),
        tautan: '/guru/jurnal',
        referensiId: jurnalId,
        pengirimUid: userData?.uid || '',
      });

      await batch.commit();
      alert(
        adalahDisetujui
          ? 'Jurnal berhasil disetujui dan pemberitahuan dikirim ke Guru.'
          : 'Permintaan perbaikan berhasil dikirim beserta catatan kepada Guru.'
      );
    } catch (error) {
      console.error('Gagal memproses jurnal atau membuat notifikasi:', error);
      alert('Proses belum berhasil. Pastikan aturan Firestore untuk notifikasi sudah dipasang, lalu coba kembali.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSetujui = async (jurnalId: string) => {
    if (!window.confirm('Setujui jurnal mengajar ini? Guru akan menerima pemberitahuan.')) return;
    await prosesJurnal(jurnalId, 'Disetujui', '');
  };

  const handleRevisi = async (jurnalId: string) => {
    const catatan = window.prompt('Masukkan alasan/catatan untuk perbaikan jurnal ini:');
    if (catatan === null) return;
    if (catatan.trim() === '') {
      alert('Catatan revisi tidak boleh kosong!');
      return;
    }
    await prosesJurnal(jurnalId, 'Perlu Perbaikan', catatan.trim());
  };

  const jurnalTampil = filterStatus === 'Semua'
    ? jurnalList
    : jurnalList.filter((jurnal) => jurnal.status === filterStatus);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Dikirim': return 'bg-blue-100 text-blue-700';
      case 'Disetujui': return 'bg-emerald-100 text-emerald-700';
      case 'Perlu Perbaikan': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const formatTanggal = (tgl?: string) => {
    if (!tgl) return '-';
    const date = new Date(`${tgl}T00:00:00`);
    if (Number.isNaN(date.getTime())) return tgl;
    return date.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-[#082B62]">Persetujuan Jurnal</h1>
        <p className="mt-1 font-medium text-slate-500">Review jurnal mengajar yang dikirim oleh Guru.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-100 bg-white p-4">
          <p className="text-sm text-slate-500">Menunggu pemeriksaan</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{jurnalList.filter((item) => item.status === 'Dikirim').length}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white p-4">
          <p className="text-sm text-slate-500">Disetujui</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{jurnalList.filter((item) => item.status === 'Disetujui').length}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-white p-4">
          <p className="text-sm text-slate-500">Perlu perbaikan</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{jurnalList.filter((item) => item.status === 'Perlu Perbaikan').length}</p>
        </div>
      </div>

      {errorData && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{errorData}</div>}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['Dikirim', 'Disetujui', 'Perlu Perbaikan', 'Semua'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus(status)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-all ${filterStatus === status ? 'bg-[#EFF6FF] text-[#155EEF]' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-sm text-slate-600">
                <th className="p-4 text-xs font-bold uppercase">Guru & Tanggal</th>
                <th className="p-4 text-xs font-bold uppercase">Kelas / Mapel / Jam</th>
                <th className="p-4 text-xs font-bold uppercase">Tema & TP</th>
                <th className="p-4 text-xs font-bold uppercase">Kegiatan & Refleksi</th>
                <th className="p-4 text-xs font-bold uppercase">Status</th>
                <th className="p-4 text-xs font-bold uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center font-medium text-slate-500">Memuat data...</td></tr>
              ) : jurnalTampil.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center font-medium text-slate-500">Tidak ada data jurnal.</td></tr>
              ) : jurnalTampil.map((jurnal) => (
                <tr key={jurnal.id} className="border-b border-slate-100 text-sm transition-colors hover:bg-[#F5F7FB] align-top">
                  <td className="p-4">
                    <p className="font-bold text-[#082B62]">{jurnal.namaGuru || 'Nama Guru tidak tersedia'}</p>
                    <p className="text-xs text-slate-500">{formatTanggal(jurnal.tanggal)}</p>
                    <p className="mt-1 text-xs text-slate-400">{jurnal.tahunAjaran || '-'} · {jurnal.semester || '-'}</p>
                  </td>
                  <td className="p-4 font-medium text-slate-600">
                    <p>{jurnal.kelas || '-'} · {jurnal.mataPelajaran || '-'}</p>
                    <p className="text-xs text-slate-500">Jam ke: {jurnal.jamKe || '-'}</p>
                  </td>
                  <td className="max-w-[220px] whitespace-normal p-4 font-medium text-slate-600">
                    <p className="font-bold">{jurnal.tema || '-'}</p>
                    <p className="mt-1 text-xs text-slate-500">TP: {jurnal.tujuan || '-'}</p>
                  </td>
                  <td className="max-w-[240px] whitespace-normal p-4 font-medium text-slate-600">
                    <p className="mb-1 text-xs text-slate-500">Kegiatan: {jurnal.kegiatanMedia || '-'}</p>
                    <p className="text-xs italic text-slate-500">Refleksi: {jurnal.refleksi || '-'}</p>
                    {jurnal.catatanKepsek && <p className="mt-2 text-xs text-amber-700">Catatan sebelumnya: {jurnal.catatanKepsek}</p>}
                  </td>
                  <td className="p-4">
                    <span className={`rounded-md px-3 py-1 text-xs font-bold ${getStatusBadge(jurnal.status)}`}>{jurnal.status || 'Tidak diketahui'}</span>
                  </td>
                  <td className="p-4">
                    {jurnal.status === 'Dikirim' && (
                      <div className="flex min-w-28 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetujui(jurnal.id)}
                          disabled={processingId === jurnal.id}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {processingId === jurnal.id ? 'Memproses...' : 'Setujui'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevisi(jurnal.id)}
                          disabled={processingId === jurnal.id}
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Revisi
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
