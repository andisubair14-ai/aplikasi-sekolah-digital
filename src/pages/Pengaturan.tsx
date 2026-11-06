import { useState, useEffect, type FormEvent } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const URUTAN_JENJANG = ['SD', 'SMP'];

const urutkanJenjang = (items: string[]) =>
  URUTAN_JENJANG.filter((item) => items.includes(item));

export default function Pengaturan() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Identitas sekolah
  const [namaSekolah, setNamaSekolah] = useState('');
  const [npsn, setNpsn] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kepalaSekolah, setKepalaSekolah] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');

  // Konfigurasi jenjang sekolah
  const [jenjangSekolah, setJenjangSekolah] = useState<string[]>([]);
  const [jenjangAwal, setJenjangAwal] = useState<string[]>([]);

  useEffect(() => {
    let masihAktif = true;

    const fetchPengaturan = async () => {
      try {
        const docRef = doc(db, 'pengaturan', 'sekolah');
        const docSnap = await getDoc(docRef);

        if (!masihAktif) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          setNamaSekolah(data.namaSekolah || '');
          setNpsn(data.npsn || '');
          setAlamat(data.alamat || '');
          setKepalaSekolah(data.kepalaSekolah || '');
          setWebsite(data.website || '');
          setEmail(data.email || '');

          const konfigurasi = Array.isArray(data.jenjangSekolah)
            ? urutkanJenjang(
                data.jenjangSekolah.filter(
                  (item: unknown) => item === 'SD' || item === 'SMP'
                )
              )
            : [];

          setJenjangSekolah(konfigurasi);
          setJenjangAwal(konfigurasi);
        }
      } catch (error) {
        console.error('Gagal mengambil data pengaturan:', error);
        alert('Gagal mengambil pengaturan sekolah. Periksa koneksi Firebase.');
      } finally {
        if (masihAktif) setLoading(false);
      }
    };

    fetchPengaturan();

    return () => {
      masihAktif = false;
    };
  }, []);

  const toggleJenjang = (nilai: string) => {
    setJenjangSekolah((sebelumnya) => {
      const berikutnya = sebelumnya.includes(nilai)
        ? sebelumnya.filter((item) => item !== nilai)
        : [...sebelumnya, nilai];

      return urutkanJenjang(berikutnya);
    });
  };

  const handleSimpan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (jenjangSekolah.length === 0) {
      alert('Pilih minimal satu jenjang pendidikan: SD, SMP, atau keduanya.');
      return;
    }

    const konfigurasiBerubah =
      JSON.stringify(urutkanJenjang(jenjangSekolah)) !==
      JSON.stringify(urutkanJenjang(jenjangAwal));

    setIsSaving(true);

    try {
      if (konfigurasiBerubah) {
        const konfirmasi = window.confirm(
          'Anda mengubah konfigurasi jenjang sekolah. Sistem akan memeriksa data rombel yang sudah tersimpan. Rombel yang berada di luar jenjang pilihan akan menyebabkan perubahan ditolak agar data tidak tersembunyi atau terabaikan. Lanjutkan pemeriksaan?'
        );

        if (!konfirmasi) return;

        const snapshotKelas = await getDocs(collection(db, 'kelas'));
        const kelasTidakValid: string[] = [];
        const kelasDiLuarPilihan: string[] = [];

        snapshotKelas.docs.forEach((item) => {
          const data = item.data();
          const jenjang = String(data.jenjang || '').toUpperCase();
          const namaRombel = String(data.namaKelas || item.id);

          if (jenjang !== 'SD' && jenjang !== 'SMP') {
            kelasTidakValid.push(namaRombel);
          } else if (!jenjangSekolah.includes(jenjang)) {
            kelasDiLuarPilihan.push(`${namaRombel} (${jenjang})`);
          }
        });

        if (kelasTidakValid.length > 0) {
          alert(
            `Perubahan ditolak. Ada ${kelasTidakValid.length} rombel yang belum memiliki jenjang SD/SMP yang valid. Perbaiki data pada menu Data Kelas & Rombel terlebih dahulu.`
          );
          return;
        }

        if (kelasDiLuarPilihan.length > 0) {
          alert(
            `Perubahan ditolak agar data lama tidak tersembunyi. Rombel berikut berada di luar jenjang pilihan: ${kelasDiLuarPilihan.slice(0, 10).join(', ')}. Pilih jenjang Gabungan atau selesaikan penataan data rombel terlebih dahulu.`
          );
          return;
        }
      }

      // merge:true menjaga field lain pada dokumen pengaturan/sekolah.
      await setDoc(
        doc(db, 'pengaturan', 'sekolah'),
        {
          namaSekolah,
          npsn,
          alamat,
          kepalaSekolah,
          website,
          email,
          jenjangSekolah: urutkanJenjang(jenjangSekolah),
          updatedAt: new Date().toISOString(),
          konfigurasiJenjangUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setJenjangAwal(urutkanJenjang(jenjangSekolah));
      alert('Pengaturan sekolah berhasil disimpan.');
    } catch (error) {
      console.error('Gagal menyimpan pengaturan:', error);
      alert('Gagal menyimpan pengaturan: ' + error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center font-bold text-slate-500">
        Memuat pengaturan...
      </div>
    );
  }

  const labelJenjang = jenjangSekolah.length === 2
    ? 'SD dan SMP (Gabungan)'
    : jenjangSekolah[0] || 'Belum dipilih';

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold text-[#082B62]">Pengaturan Sekolah</h1>
        <p className="text-slate-500 mt-1 font-medium">
          Atur identitas dan jenjang pendidikan yang dikelola sekolah.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleSimpan} className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-[#082B62]">Identitas Sekolah</h2>
            <p className="text-xs text-slate-500 mt-1">Informasi ini akan ditampilkan di bagian aplikasi yang menggunakan identitas sekolah.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nama Sekolah</label>
            <input
              type="text"
              value={namaSekolah}
              onChange={(e) => setNamaSekolah(e.target.value)}
              required
              placeholder="Contoh: SD Inpres 12/79 Lappabosse"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">NPSN</label>
              <input
                type="text"
                value={npsn}
                onChange={(e) => setNpsn(e.target.value)}
                required
                placeholder="Contoh: 40312345"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nama Kepala Sekolah</label>
              <input
                type="text"
                value={kepalaSekolah}
                onChange={(e) => setKepalaSekolah(e.target.value)}
                required
                placeholder="Contoh: Hj. Siti Aminah, M.Pd."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Alamat Lengkap</label>
            <textarea
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              required
              rows={2}
              placeholder="Contoh: Jl. Pendidikan No. 1, Kecamatan, Kabupaten"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Website (Opsional)</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Contoh: www.sekolah.sch.id"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email Sekolah</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Contoh: admin@sekolah.sch.id"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#082B62]">Konfigurasi Jenjang Pendidikan</h2>
              <p className="text-sm text-slate-500 mt-1">Pilih jenjang yang dikelola oleh sekolah ini. Anda dapat memilih satu atau keduanya.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${jenjangSekolah.includes('SD') ? 'border-[#155EEF] bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                <input
                  type="checkbox"
                  checked={jenjangSekolah.includes('SD')}
                  onChange={() => toggleJenjang('SD')}
                  className="mt-1 accent-blue-600"
                />
                <span>
                  <span className="block font-bold text-[#082B62]">Sekolah Dasar (SD)</span>
                  <span className="block text-xs text-slate-500 mt-1">Tingkat I sampai VI</span>
                </span>
              </label>

              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${jenjangSekolah.includes('SMP') ? 'border-[#155EEF] bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                <input
                  type="checkbox"
                  checked={jenjangSekolah.includes('SMP')}
                  onChange={() => toggleJenjang('SMP')}
                  className="mt-1 accent-blue-600"
                />
                <span>
                  <span className="block font-bold text-[#082B62]">Sekolah Menengah Pertama (SMP)</span>
                  <span className="block text-xs text-slate-500 mt-1">Tingkat VII sampai IX</span>
                </span>
              </label>
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm font-bold text-blue-800">Konfigurasi saat ini: {labelJenjang}</p>
              <p className="text-xs text-blue-700 mt-1">Jika kedua pilihan dicentang, aplikasi akan disiapkan untuk sekolah gabungan SD dan SMP.</p>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
              Ketika konfigurasi jenjang diubah, sistem memeriksa data pada koleksi Data Kelas & Rombel. Jika masih ada rombel dari jenjang yang tidak dipilih atau data jenjang rombel belum valid, perubahan ditolak agar data yang sudah ada tidak tersembunyi.
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className={`px-6 py-2.5 text-white font-bold rounded-xl shadow-md transition-all ${isSaving ? 'bg-slate-400' : 'bg-[#155EEF] hover:bg-blue-700 shadow-blue-500/30'}`}
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
