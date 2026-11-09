import { useEffect, useState, type FormEvent } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

type TahunAjaranRecord = {
  id: string;
  tahun?: string;
  semester?: string;
  status?: string;
};

export default function TahunAjaran() {
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaranRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // State untuk Form Tambah/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tahun, setTahun] = useState('');
  const [semester, setSemester] = useState('Ganjil');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'tahun_ajaran'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as TahunAjaranRecord[];

        // Urutkan tahun terbaru terlebih dahulu; Semester Genap di atas Ganjil.
        data.sort((a, b) => {
          const urutTahun = String(b.tahun || '').localeCompare(String(a.tahun || ''), 'id', { numeric: true });
          if (urutTahun !== 0) return urutTahun;
          const urutSemester = (b.semester === 'Genap' ? 2 : 1) - (a.semester === 'Genap' ? 2 : 1);
          return urutSemester;
        });

        setTahunAjaranList(data);
        setErrorMessage('');
        setLoading(false);
      },
      (error) => {
        console.error('Gagal memuat tahun ajaran:', error);
        setErrorMessage('Data tahun ajaran belum dapat dimuat. Periksa koneksi dan aturan akses Firebase.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleOpenTambah = () => {
    setEditId(null);
    setTahun('');
    setSemester('Ganjil');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: TahunAjaranRecord) => {
    setEditId(item.id);
    setTahun(item.tahun || '');
    setSemester(item.semester || 'Ganjil');
    setIsModalOpen(true);
  };

  const handleSimpan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tahunBersih = tahun.trim();

    if (!tahunBersih) {
      alert('Tahun Ajaran wajib diisi.');
      return;
    }

    const duplikat = tahunAjaranList.some((item) =>
      item.id !== editId &&
      String(item.tahun || '').trim().toLowerCase() === tahunBersih.toLowerCase() &&
      String(item.semester || '').trim().toLowerCase() === semester.toLowerCase()
    );

    if (duplikat) {
      alert(`Tahun Pelajaran ${tahunBersih} Semester ${semester} sudah terdaftar.`);
      return;
    }

    setIsSaving(true);
    try {
      if (editId) {
        // Status aktif tidak diubah saat Admin hanya mengedit nama periode.
        await updateDoc(doc(db, 'tahun_ajaran', editId), {
          tahun: tahunBersih,
          semester,
        });
      } else {
        // Periode baru disimpan sebagai tidak aktif; Admin mengaktifkannya melalui centang di tabel.
        await addDoc(collection(db, 'tahun_ajaran'), {
          tahun: tahunBersih,
          semester,
          status: 'Tidak Aktif',
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Gagal menyimpan tahun ajaran:', error);
      alert('Gagal menyimpan data tahun ajaran. Periksa koneksi dan hak akses Firebase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUbahPeriodeAktif = async (item: TahunAjaranRecord) => {
    if (updatingStatusId) return;

    const sedangAktif = item.status === 'Aktif';
    const statusBaru = sedangAktif ? 'Tidak Aktif' : 'Aktif';

    const pesanKonfirmasi = sedangAktif
      ? `Nonaktifkan Tahun Pelajaran ${item.tahun} Semester ${item.semester}? Setelah dinonaktifkan, Guru dan Kepala Sekolah tidak memiliki periode berjalan sampai Admin mengaktifkan periode lain.`
      : `Aktifkan Tahun Pelajaran ${item.tahun} Semester ${item.semester}? Periode aktif sebelumnya akan otomatis menjadi tidak aktif. Dashboard Guru dan Kepala Sekolah akan mengikuti periode ini.`;

    if (!window.confirm(pesanKonfirmasi)) return;

    setUpdatingStatusId(item.id);
    try {
      const batch = writeBatch(db);
      const perubahanStatus = new Map<string, string>();

      // Pastikan tidak ada lebih dari satu periode aktif.
      tahunAjaranList.forEach((periode) => {
        if (periode.status === 'Aktif') {
          perubahanStatus.set(periode.id, 'Tidak Aktif');
        }
      });

      if (statusBaru === 'Aktif') {
        perubahanStatus.set(item.id, 'Aktif');
      }

      perubahanStatus.forEach((statusPeriode, idPeriode) => {
        batch.update(doc(db, 'tahun_ajaran', idPeriode), { status: statusPeriode });
      });

      await batch.commit();
    } catch (error) {
      console.error('Gagal mengubah periode aktif:', error);
      alert('Perubahan periode aktif gagal disimpan. Periksa koneksi dan aturan Firestore.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleHapus = async (item: TahunAjaranRecord) => {
    if (item.status === 'Aktif') {
      alert('Nonaktifkan periode ini terlebih dahulu sebelum menghapusnya.');
      return;
    }

    const lanjut = window.confirm(
      `Hapus daftar Tahun Pelajaran ${item.tahun} Semester ${item.semester}? Data historis pada koleksi lain tidak ikut terhapus, tetapi periode ini tidak lagi muncul dalam daftar arsip.`
    );
    if (!lanjut) return;

    try {
      await deleteDoc(doc(db, 'tahun_ajaran', item.id));
    } catch (error) {
      console.error('Gagal menghapus tahun ajaran:', error);
      alert('Gagal menghapus data tahun ajaran. Periksa koneksi dan hak akses Firebase.');
    }
  };

  const jumlahAktif = tahunAjaranList.filter((item) => item.status === 'Aktif').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">Tahun Ajaran</h1>
          <p className="text-slate-500 mt-1 font-medium">Atur tahun pelajaran dan semester yang sedang berjalan.</p>
        </div>
        <button
          onClick={handleOpenTambah}
          className="bg-[#10B981] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-sm text-sm"
        >
          + Tambah Tahun Ajaran
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {errorMessage}
        </div>
      )}

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
              tahunAjaranList.map((item, index) => {
                const aktif = item.status === 'Aktif';
                const sedangDiproses = updatingStatusId === item.id;
                return (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-[#F5F7FB] transition-colors text-sm">
                    <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                    <td className="p-4 font-bold text-[#082B62]">{item.tahun || '-'}</td>
                    <td className="p-4 text-slate-600 font-medium">{item.semester || '-'}</td>
                    <td className="p-4">
                      <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={aktif}
                          disabled={Boolean(updatingStatusId)}
                          onChange={() => handleUbahPeriodeAktif(item)}
                          aria-label={`Aktifkan Tahun Pelajaran ${item.tahun} Semester ${item.semester}`}
                          className="h-5 w-5 rounded border-slate-300 accent-emerald-600 cursor-pointer disabled:cursor-wait"
                        />
                        <span className={`px-3 py-1 rounded-md text-xs font-bold border ${
                          aktif
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {sedangDiproses ? 'Memproses...' : aktif ? 'Aktif' : 'Tidak Aktif'}
                        </span>
                      </label>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="text-[#155EEF] hover:text-blue-800 font-bold mr-4 transition-colors"
                      >Edit</button>
                      <button
                        onClick={() => handleHapus(item)}
                        disabled={sedangDiproses}
                        className="text-[#EF4444] hover:text-red-800 font-bold transition-colors disabled:opacity-40"
                      >Hapus</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <p className="font-bold">Periode yang berjalan: {jumlahAktif === 1 ? '1 periode aktif' : jumlahAktif === 0 ? 'Belum ada periode aktif' : `${jumlahAktif} periode aktif`}</p>
        <p className="mt-1 text-xs text-blue-700">Centang satu periode untuk menjadikannya aktif. Periode aktif sebelumnya otomatis dinonaktifkan. Guru dan Kepala Sekolah selalu mengikuti periode yang aktif.</p>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-[#082B62]">
                {editId ? 'Edit Tahun Ajaran' : 'Tambah Tahun Ajaran'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">✕</button>
            </div>

            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tahun Ajaran</label>
                <input
                  type="text"
                  value={tahun}
                  onChange={(event) => setTahun(event.target.value)}
                  required
                  placeholder="Contoh: 2026/2027"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Semester</label>
                <select
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155EEF] outline-none bg-white font-medium cursor-pointer"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
                Periode baru akan tersimpan sebagai Tidak Aktif. Untuk mulai digunakan, centang periode tersebut pada tabel Tahun Ajaran.
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-[#155EEF] hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-60">
                  {isSaving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
