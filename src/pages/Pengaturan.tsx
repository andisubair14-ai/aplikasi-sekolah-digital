import { useState, useEffect, type FormEvent } from 'react';
import {
  collection,
  doc,
  deleteField,
  onSnapshot,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const URUTAN_JENJANG = ['SD', 'SMP'];

const urutkanJenjang = (items: string[]) =>
  URUTAN_JENJANG.filter((item) => items.includes(item));

type StatusKoneksiWhatsApp = 'not_connected' | 'pending' | 'connected' | 'error';
type StatusVerifikasiWhatsApp = 'not_started' | 'pending' | 'verified' | 'failed';
type StatusTemplateWhatsApp =
  | 'not_submitted'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paused'
  | 'disabled';

const statusKoneksiLabel: Record<StatusKoneksiWhatsApp, string> = {
  not_connected: 'Belum dihubungkan',
  pending: 'Proses penghubungan',
  connected: 'Terhubung',
  error: 'Perlu tindakan',
};

const statusVerifikasiLabel: Record<StatusVerifikasiWhatsApp, string> = {
  not_started: 'Belum diverifikasi',
  pending: 'Menunggu verifikasi',
  verified: 'Terverifikasi',
  failed: 'Verifikasi gagal',
};

const statusTemplateLabel: Record<StatusTemplateWhatsApp, string> = {
  not_submitted: 'Belum diajukan',
  pending: 'Menunggu peninjauan Meta',
  approved: 'Disetujui Meta',
  rejected: 'Ditolak — perlu perbaikan',
  paused: 'Dijeda oleh Meta',
  disabled: 'Dinonaktifkan oleh Meta',
};

const statusKoneksiValid = (nilai: unknown): StatusKoneksiWhatsApp =>
  nilai === 'pending' || nilai === 'connected' || nilai === 'error'
    ? nilai
    : 'not_connected';

const statusVerifikasiValid = (nilai: unknown): StatusVerifikasiWhatsApp =>
  nilai === 'pending' || nilai === 'verified' || nilai === 'failed'
    ? nilai
    : 'not_started';

const statusTemplateValid = (nilai: unknown): StatusTemplateWhatsApp =>
  nilai === 'pending' || nilai === 'approved' || nilai === 'rejected' || nilai === 'paused' || nilai === 'disabled'
    ? nilai
    : 'not_submitted';

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

  // Nomor ini hanya dibaca dari hasil onboarding Meta oleh backend.
  // Admin tidak mengetik nomor secara manual pada halaman ini.
  const [nomorWhatsappTerhubung, setNomorWhatsappTerhubung] = useState('');
  const [nomorWhatsappLama, setNomorWhatsappLama] = useState('');
  const [backendWhatsAppSiap, setBackendWhatsAppSiap] = useState(false);

  // Status ini kelak diperbarui oleh backend setelah menerima respons/webhook Meta.
  // Admin hanya dapat melihat statusnya dari halaman ini.
  const [statusKoneksiWhatsApp, setStatusKoneksiWhatsApp] =
    useState<StatusKoneksiWhatsApp>('not_connected');
  const [statusVerifikasiWhatsApp, setStatusVerifikasiWhatsApp] =
    useState<StatusVerifikasiWhatsApp>('not_started');
  const [statusTemplateWhatsApp, setStatusTemplateWhatsApp] =
    useState<StatusTemplateWhatsApp>('not_submitted');

  // Konfigurasi jenjang sekolah
  const [jenjangSekolah, setJenjangSekolah] = useState<string[]>([]);
  const [jenjangAwal, setJenjangAwal] = useState<string[]>([]);

  useEffect(() => {
    let masihAktif = true;

    const docRef = doc(db, 'pengaturan', 'sekolah');
    const berhentiMendengar = onSnapshot(
      docRef,
      (docSnap) => {
        if (!masihAktif) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          setNamaSekolah(data.namaSekolah || '');
          setNpsn(data.npsn || '');
          setAlamat(data.alamat || '');
          setKepalaSekolah(data.kepalaSekolah || '');
          setWebsite(data.website || '');
          setEmail(data.email || '');

          // Nomor dan status WhatsApp akan diperbarui oleh backend setelah Meta merespons.
          // onSnapshot membuat perubahan dari backend tampil tanpa Admin memuat ulang halaman.
          setNomorWhatsappTerhubung(String(data.whatsappDisplayPhoneNumber || ''));
          setNomorWhatsappLama(String(data.nomorWhatsappSekolah || ''));
          setBackendWhatsAppSiap(data.whatsappBackendReady === true);
          setStatusKoneksiWhatsApp(statusKoneksiValid(data.whatsappKoneksiStatus));
          setStatusVerifikasiWhatsApp(statusVerifikasiValid(data.whatsappVerifikasiNomorStatus));
          setStatusTemplateWhatsApp(statusTemplateValid(data.whatsappTemplateStatus));

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

        setLoading(false);
      },
      (error) => {
        console.error('Gagal mengambil data pengaturan:', error);
        if (masihAktif) {
          alert('Gagal mengambil pengaturan sekolah. Periksa koneksi Firebase.');
          setLoading(false);
        }
      }
    );

    return () => {
      masihAktif = false;
      berhentiMendengar();
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

          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#082B62]">WhatsApp Sekolah</h2>
              <p className="text-sm text-slate-500 mt-1">
                Hubungkan akun WhatsApp Business sekolah melalui halaman resmi Meta. Nomor akan ditampilkan otomatis setelah proses koneksi berhasil.
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-bold mb-1">Cara kerja untuk Admin</p>
              <ol className="list-decimal pl-5 space-y-1 text-xs sm:text-sm">
                <li>Klik tombol Hubungkan dengan Meta.</li>
                <li>Masuk menggunakan akun Meta milik sekolah.</li>
                <li>Pilih atau buat akun WhatsApp Business dan verifikasi nomor sekolah.</li>
                <li>Setelah terhubung, nomor dan status akan tampil otomatis di sini.</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-800">Nomor WhatsApp terhubung</p>
                  <p className="text-xs text-slate-500 mt-1">Nomor ini diisi otomatis berdasarkan hasil pendaftaran Meta.</p>
                </div>
                <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold ${statusKoneksiWhatsApp === 'connected' ? 'bg-emerald-100 text-emerald-700' : statusKoneksiWhatsApp === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                  {statusKoneksiLabel[statusKoneksiWhatsApp]}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-4">
                <p className="text-xs font-semibold text-slate-500">NOMOR RESMI SEKOLAH</p>
                <p className="text-lg font-bold text-slate-800 mt-1">
                  {nomorWhatsappTerhubung || 'Belum ada nomor yang terhubung'}
                </p>
                {nomorWhatsappLama && !nomorWhatsappTerhubung && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-800">
                      Nomor lama {nomorWhatsappLama} berasal dari pengaturan manual versi sebelumnya. Nomor ini bukan nomor yang diverifikasi Meta dan tidak digunakan untuk mengirim pesan.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        const setuju = window.confirm(
                          'Hapus nomor WhatsApp lama dari dokumen pengaturan sekolah? Nomor yang dihapus tidak akan memengaruhi nomor yang kelak terhubung dan dikonfirmasi Meta.'
                        );
                        if (!setuju) return;

                        try {
                          await setDoc(
                            doc(db, 'pengaturan', 'sekolah'),
                            {
                              nomorWhatsappSekolah: deleteField(),
                              updatedAt: new Date().toISOString(),
                            },
                            { merge: true }
                          );
                          alert('Nomor WhatsApp lama berhasil dihapus dari pengaturan.');
                        } catch (error) {
                          console.error('Gagal menghapus nomor WhatsApp lama:', error);
                          alert('Nomor lama belum berhasil dihapus. Periksa koneksi dan izin Firebase.');
                        }
                      }}
                      className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
                    >
                      Hapus nomor lama
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled
                title="Integrasi Meta Embedded Signup belum dikonfigurasi oleh pengembang aplikasi"
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-slate-300 text-slate-600 cursor-not-allowed"
              >
                <span aria-hidden="true">↗</span>
                Hubungkan WhatsApp dengan Meta
              </button>
              <p className="text-xs text-amber-700">
                Tombol ini belum aktif. Pengembang aplikasi perlu menyelesaikan pendaftaran aplikasi Meta, Embedded Signup, persetujuan izin, dan backend terlebih dahulu. Setelah siap, Admin sekolah dapat melakukan proses koneksi sendiri dari tombol ini.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-600">TAHAP 1 · AKUN META</p>
                <p className="text-sm font-semibold text-slate-800 mt-2">{statusKoneksiLabel[statusKoneksiWhatsApp]}</p>
                <p className="text-xs text-slate-600 mt-1">Status diambil dari data koneksi yang diterima backend.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-600">TAHAP 2 · VERIFIKASI NOMOR</p>
                <p className="text-sm font-semibold text-slate-800 mt-2">{statusVerifikasiLabel[statusVerifikasiWhatsApp]}</p>
                <p className="text-xs text-slate-600 mt-1">Nomor harus berhasil diverifikasi dan didaftarkan pada WhatsApp Business Platform.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-600">TAHAP 3 · TEMPLATE PESAN</p>
                <p className="text-sm font-semibold text-slate-800 mt-2">{statusTemplateLabel[statusTemplateWhatsApp]}</p>
                <p className="text-xs text-slate-600 mt-1">Template pemberitahuan Alpa harus disetujui Meta.</p>
              </div>

              <div className={`rounded-xl border p-4 ${backendWhatsAppSiap && statusKoneksiWhatsApp === 'connected' && statusVerifikasiWhatsApp === 'verified' && statusTemplateWhatsApp === 'approved' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-xs font-bold text-slate-600">TAHAP 4 · LAYANAN NOTIFIKASI</p>
                <p className="text-sm font-semibold text-slate-800 mt-2">
                  {backendWhatsAppSiap && statusKoneksiWhatsApp === 'connected' && statusVerifikasiWhatsApp === 'verified' && statusTemplateWhatsApp === 'approved' ? 'Siap digunakan' : 'Belum aktif'}
                </p>
                <p className="text-xs text-slate-600 mt-1">Aktif hanya setelah koneksi, verifikasi, template, dan backend dinyatakan siap.</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <p className="font-bold mb-1">Catatan keamanan</p>
              Jangan memasukkan kata sandi, kode OTP, App Secret, atau access token ke halaman ini. Proses masuk Meta dilakukan pada halaman resmi Meta, sedangkan token dan identitas teknis akun disimpan di backend yang aman. Setiap sekolah menggunakan akun dan metode pembayarannya sendiri.
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
