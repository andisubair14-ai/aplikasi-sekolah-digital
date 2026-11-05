import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Pengaturan() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State Data Sekolah
  const [namaSekolah, setNamaSekolah] = useState('');
  const [npsn, setNpsn] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kepalaSekolah, setKepalaSekolah] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');

  // Mengambil data pengaturan saat halaman dimuat
  useEffect(() => {
    const fetchPengaturan = async () => {
      try {
        const docRef = doc(db, 'pengaturan', 'sekolah');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setNamaSekolah(data.namaSekolah || '');
          setNpsn(data.npsn || '');
          setAlamat(data.alamat || '');
          setKepalaSekolah(data.kepalaSekolah || '');
          setWebsite(data.website || '');
          setEmail(data.email || '');
        }
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPengaturan();
  }, []);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Menyimpan data ke Firestore dengan ID 'sekolah'
      await setDoc(doc(db, 'pengaturan', 'sekolah'), {
        namaSekolah,
        npsn,
        alamat,
        kepalaSekolah,
        website,
        email,
        updatedAt: new Date().toISOString()
      });
      alert('Pengaturan sekolah berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan pengaturan: ' + error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center font-bold text-slate-500">Memuat pengaturan...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      
      <div>
        <h1 className="text-2xl font-bold text-[#082B62]">Pengaturan Sekolah</h1>
        <p className="text-slate-500 mt-1 font-medium">Ubah identitas sekolah yang akan tampil di seluruh aplikasi.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleSimpan} className="space-y-5">
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nama Sekolah</label>
            <input type="text" value={namaSekolah} onChange={(e) => setNamaSekolah(e.target.value)} required
              placeholder="Contoh: SD Inpres 12/79 Lappabosse"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">NPSN</label>
              <input type="text" value={npsn} onChange={(e) => setNpsn(e.target.value)} required
                placeholder="Contoh: 40312345"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nama Kepala Sekolah</label>
              <input type="text" value={kepalaSekolah} onChange={(e) => setKepalaSekolah(e.target.value)} required
                placeholder="Contoh: Hj. Siti Aminah, M.Pd."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Alamat Lengkap</label>
            <textarea value={alamat} onChange={(e) => setAlamat(e.target.value)} required rows={2}
              placeholder="Contoh: Jl. Pendidikan No. 1, Kec. Lappabosse, Kab. Bone"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium resize-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Website (Opsional)</label>
              <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
                placeholder="Contoh: www.sekolah.sch.id"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email Sekolah</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Contoh: admin@sekolah.sch.id"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" disabled={isSaving}
              className={`px-6 py-2.5 text-white font-bold rounded-xl shadow-md transition-all ${
                isSaving ? 'bg-slate-400' : 'bg-[#155EEF] hover:bg-blue-700 shadow-blue-500/30'
              }`}>
              {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}