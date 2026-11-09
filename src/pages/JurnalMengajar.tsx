import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type GuruRecord = {
  id: string;
  nama?: string;
  nip?: string;
  nuptk?: string;
  jabatan?: string;
  mapel?: string;
  kelasDiampu?: string[];
};

type KelasRecord = {
  id: string;
  namaKelas?: string;
  jenjang?: string;
  tingkat?: number | string;
  tahunAjaran?: string;
  waliKelasId?: string | null;
};

type TahunAjaranRecord = {
  id: string;
  tahun?: string;
  semester?: string;
  status?: string;
};

type IdentitasSekolah = {
  namaSekolah?: string;
  npsn?: string;
  alamat?: string;
  email?: string;
  website?: string;
  kepalaSekolah?: string;
};

type JurnalRecord = {
  id: string;
  userId?: string;
  // Field guruId lama tetap berisi UID Firebase Auth agar riwayat lama tetap terbaca.
  guruId?: string;
  pegawaiId?: string | null;
  namaGuru?: string;
  tanggal?: string;
  jamKe?: string;
  kelas?: string;
  kelasId?: string;
  jenjang?: string;
  tingkat?: number | string;
  tahunAjaran?: string;
  semester?: string;
  mataPelajaran?: string;
  tema?: string;
  tujuan?: string;
  kegiatanMedia?: string;
  absensiSiswa?: string;
  refleksi?: string;
  status?: string;
  catatanKepsek?: string;
  createdAt?: string;
  updatedAt?: string;
};

const tanggalLokalHariIni = () => {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, '0');
  const hari = String(sekarang.getDate()).padStart(2, '0');
  return `${tahun}-${bulan}-${hari}`;
};

const formatTanggal = (tanggal?: string) => {
  if (!tanggal) return '-';
  const date = new Date(`${tanggal}T00:00:00`);
  if (Number.isNaN(date.getTime())) return tanggal;
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const getStatusBadge = (status?: string) => {
  switch (status) {
    case 'Dikirim':
      return 'bg-blue-100 text-blue-700';
    case 'Disetujui':
      return 'bg-emerald-100 text-emerald-700';
    case 'Perlu Perbaikan':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

export default function JurnalMengajar() {
  const { userData } = useAuth();

  const [guruProfile, setGuruProfile] = useState<GuruRecord | null>(null);
  const [kelasList, setKelasList] = useState<KelasRecord[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaranRecord[]>([]);
  const [jurnalList, setJurnalList] = useState<JurnalRecord[]>([]);
  const [identitasSekolah, setIdentitasSekolah] = useState<IdentitasSekolah>({});
  const [loading, setLoading] = useState(true);
  const [errorData, setErrorData] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [tanggal, setTanggal] = useState(tanggalLokalHariIni());
  const [jamKe, setJamKe] = useState('');
  const [kelasId, setKelasId] = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [tema, setTema] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [kegiatanMedia, setKegiatanMedia] = useState('');
  const [absensiSiswa, setAbsensiSiswa] = useState('');
  const [refleksi, setRefleksi] = useState('');

  const tahunAktif = useMemo(
    () => tahunAjaranList.find((item) => String(item.status || '').trim().toLowerCase() === 'aktif') || null,
    [tahunAjaranList]
  );

  // Guru hanya melihat rombel yang benar-benar ditugaskan pada tahun ajaran aktif.
  // Guru Mata Pelajaran: guru.kelasDiampu berisi ID dokumen kelas.
  // Wali Kelas: kelas.waliKelasId berisi ID dokumen pegawai pada koleksi guru.
  const kelasTersedia = useMemo(() => {
    if (!guruProfile || !tahunAktif?.tahun) return [];

    const kelasDiampu = Array.isArray(guruProfile.kelasDiampu)
      ? guruProfile.kelasDiampu
      : [];

    return kelasList
      .filter((kelas) => {
        if (kelas.tahunAjaran !== tahunAktif.tahun) return false;
        return kelas.waliKelasId === guruProfile.id || kelasDiampu.includes(kelas.id);
      })
      .sort((a, b) => {
        const tingkatA = Number(a.tingkat || 0);
        const tingkatB = Number(b.tingkat || 0);
        if (tingkatA !== tingkatB) return tingkatA - tingkatB;
        return String(a.namaKelas || '').localeCompare(String(b.namaKelas || ''), 'id', { numeric: true });
      });
  }, [guruProfile, kelasList, tahunAktif]);

  const kelasTerpilih = useMemo(
    () => kelasTersedia.find((item) => item.id === kelasId) || null,
    [kelasTersedia, kelasId]
  );

  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }

    if (userData.role !== 'guru') {
      setErrorData('Halaman ini ditujukan untuk Guru. Monitoring jurnal seluruh Guru tersedia melalui menu Monitoring Kepala Sekolah.');
      setLoading(false);
      return;
    }

    if (!userData.guruId) {
      setErrorData('Akun Guru belum terhubung dengan Data Pegawai. Hubungi Admin untuk menghubungkan akun melalui menu Manajemen Pengguna.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorData('');

    let guruLoaded = false;
    let kelasLoaded = false;
    let tahunLoaded = false;
    let jurnalLoaded = false;

    const perbaruiLoading = () => {
      setLoading(!(guruLoaded && kelasLoaded && tahunLoaded && jurnalLoaded));
    };

    const unsubGuru = onSnapshot(
      doc(db, 'guru', userData.guruId),
      (snapshot) => {
        setGuruProfile(snapshot.exists()
          ? ({ id: snapshot.id, ...snapshot.data() } as GuruRecord)
          : null);
        guruLoaded = true;
        perbaruiLoading();
      },
      (error) => {
        console.error('Gagal memuat profil pegawai:', error);
        setErrorData('Data Pegawai belum dapat dibaca. Periksa koneksi dan aturan Firestore.');
        guruLoaded = true;
        perbaruiLoading();
      }
    );

    const unsubKelas = onSnapshot(
      collection(db, 'kelas'),
      (snapshot) => {
        setKelasList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as KelasRecord[]);
        kelasLoaded = true;
        perbaruiLoading();
      },
      (error) => {
        console.error('Gagal memuat rombel:', error);
        setErrorData('Data rombel belum dapat dibaca. Periksa koneksi dan aturan Firestore.');
        kelasLoaded = true;
        perbaruiLoading();
      }
    );

    const unsubTahun = onSnapshot(
      query(collection(db, 'tahun_ajaran'), where('status', '==', 'Aktif')),
      (snapshot) => {
        setTahunAjaranList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TahunAjaranRecord[]);
        tahunLoaded = true;
        perbaruiLoading();
      },
      (error) => {
        console.error('Gagal memuat tahun ajaran:', error);
        setErrorData('Data tahun ajaran belum dapat dibaca. Periksa koneksi dan aturan Firestore.');
        tahunLoaded = true;
        perbaruiLoading();
      }
    );

    // guruId lama tetap memakai UID akun agar jurnal yang sudah ada tetap muncul.
    const qJurnal = query(collection(db, 'jurnal'), where('guruId', '==', userData.uid));
    const unsubSekolah = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      (snapshot) => {
        setIdentitasSekolah(snapshot.exists() ? (snapshot.data() as IdentitasSekolah) : {});
      },
      (error) => {
        console.warn('Identitas sekolah belum dapat dimuat untuk cetak jurnal:', error);
      }
    );

    const unsubJurnal = onSnapshot(
      qJurnal,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as JurnalRecord[];
        data.sort((a, b) => {
          const tanggalA = `${a.tanggal || ''} ${a.createdAt || ''}`;
          const tanggalB = `${b.tanggal || ''} ${b.createdAt || ''}`;
          return tanggalB.localeCompare(tanggalA);
        });
        setJurnalList(data);
        jurnalLoaded = true;
        perbaruiLoading();
      },
      (error) => {
        console.error('Gagal memuat jurnal:', error);
        setErrorData('Riwayat jurnal belum dapat dibaca. Periksa koneksi dan aturan Firestore.');
        jurnalLoaded = true;
        perbaruiLoading();
      }
    );

    return () => {
      unsubGuru();
      unsubKelas();
      unsubTahun();
      unsubJurnal();
      unsubSekolah();
    };
  }, [userData?.uid, userData?.guruId, userData?.role]);

  const resetForm = () => {
    setEditId(null);
    setTanggal(tanggalLokalHariIni());
    setJamKe('');
    setKelasId('');
    setMataPelajaran(guruProfile?.mapel && guruProfile.mapel !== '-' ? guruProfile.mapel : '');
    setTema('');
    setTujuan('');
    setKegiatanMedia('');
    setAbsensiSiswa('');
    setRefleksi('');
  };

  const handleOpenTambah = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const cariKelasUntukJurnal = (jurnal: JurnalRecord) => {
    if (jurnal.kelasId) {
      return kelasTersedia.find((item) => item.id === jurnal.kelasId) || null;
    }
    return kelasTersedia.find((item) =>
      item.namaKelas === jurnal.kelas &&
      (!jurnal.tahunAjaran || item.tahunAjaran === jurnal.tahunAjaran)
    ) || null;
  };

  const handleOpenEdit = (jurnal: JurnalRecord) => {
    if (jurnal.status === 'Disetujui') {
      alert('Jurnal yang sudah disetujui tidak dapat diedit.');
      return;
    }

    const kelasJurnal = cariKelasUntukJurnal(jurnal);
    if (!kelasJurnal) {
      alert('Rombel pada jurnal ini tidak termasuk penugasan aktif Anda. Jurnal lama tetap dapat dilihat dan dicetak, tetapi pengeditan memerlukan penugasan rombel yang sesuai.');
      return;
    }

    setEditId(jurnal.id);
    setTanggal(jurnal.tanggal || tanggalLokalHariIni());
    setJamKe(jurnal.jamKe || '');
    setKelasId(kelasJurnal.id);
    setMataPelajaran(jurnal.mataPelajaran || '');
    setTema(jurnal.tema || '');
    setTujuan(jurnal.tujuan || '');
    setKegiatanMedia(jurnal.kegiatanMedia || '');
    setAbsensiSiswa(jurnal.absensiSiswa || '');
    setRefleksi(jurnal.refleksi || '');
    setIsModalOpen(true);
  };

  const handleSimpan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userData?.uid || !userData.guruId || !guruProfile) {
      alert('Profil Guru belum siap. Hubungi Admin untuk memeriksa hubungan akun dengan Data Pegawai.');
      return;
    }

    if (!tahunAktif?.tahun || !tahunAktif.semester) {
      alert('Belum ada Tahun Ajaran dan Semester berstatus Aktif. Atur terlebih dahulu melalui menu Tahun Ajaran.');
      return;
    }

    if (!kelasTerpilih) {
      alert('Pilih rombel yang menjadi penugasan Anda pada tahun ajaran aktif.');
      return;
    }

    if (!jamKe.trim() || !mataPelajaran.trim() || !tema.trim() || !tujuan.trim() || !kegiatanMedia.trim()) {
      alert('Lengkapi tanggal, jam pelajaran, mata pelajaran, tema, tujuan pembelajaran, dan kegiatan pembelajaran.');
      return;
    }

    if (editId) {
      const jurnalLama = jurnalList.find((item) => item.id === editId);
      if (!jurnalLama || (jurnalLama.guruId !== userData.uid && jurnalLama.userId !== userData.uid)) {
        alert('Jurnal ini bukan milik akun Anda atau tidak dapat ditemukan.');
        return;
      }
      if (jurnalLama.status === 'Disetujui') {
        alert('Jurnal yang sudah disetujui tidak dapat diedit.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const sekarang = new Date().toISOString();
      const dataJurnal = {
        // userId = UID akun Firebase; pegawaiId = ID dokumen pada koleksi guru.
        userId: userData.uid,
        pegawaiId: userData.guruId,
        // Pertahankan guruId berisi UID untuk kompatibilitas dengan jurnal lama.
        guruId: userData.uid,
        namaGuru: guruProfile.nama || userData.nama,
        tanggal,
        jamKe: jamKe.trim(),
        kelasId: kelasTerpilih.id,
        kelas: kelasTerpilih.namaKelas || '',
        jenjang: kelasTerpilih.jenjang || '',
        tingkat: kelasTerpilih.tingkat ?? '',
        tahunAjaran: tahunAktif.tahun,
        semester: tahunAktif.semester,
        mataPelajaran: mataPelajaran.trim(),
        tema: tema.trim(),
        tujuan: tujuan.trim(),
        kegiatanMedia: kegiatanMedia.trim(),
        absensiSiswa: absensiSiswa.trim(),
        refleksi: refleksi.trim(),
        status: 'Dikirim',
        catatanKepsek: '',
        updatedAt: sekarang,
      };

      // Cari akun Kepala Sekolah aktif agar setiap pengiriman jurnal dapat
      // membuat pemberitahuan pada lonceng penerima. Jika daftar penerima
      // gagal dibaca, jurnal tetap disimpan dan pengguna diberi peringatan.
      let uidKepalaSekolah: string[] = [];
      let gagalMemuatPenerima = false;

      try {
        const akunKepsekSnapshot = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'kepsek'))
        );

        uidKepalaSekolah = akunKepsekSnapshot.docs
          .filter((akun) => akun.data().aktif !== false)
          .map((akun) => akun.id)
          .filter((uid) => uid !== userData.uid);
      } catch (errorPenerima) {
        console.error('Gagal memuat akun Kepala Sekolah untuk notifikasi:', errorPenerima);
        gagalMemuatPenerima = true;
      }

      // Simpan jurnal dan seluruh notifikasi dalam satu batch.
      // Dengan demikian, bila notifikasi ditolak oleh Rules, jurnal tidak
      // akan tersimpan dalam status Dikirim tanpa proses yang utuh.
      const batch = writeBatch(db);
      const jurnalRef = editId
        ? doc(db, 'jurnal', editId)
        : doc(collection(db, 'jurnal'));

      if (editId) {
        batch.update(jurnalRef, dataJurnal);
      } else {
        batch.set(jurnalRef, {
          ...dataJurnal,
          createdAt: sekarang,
        });
      }

      uidKepalaSekolah.forEach((uidKepsek) => {
        const notifikasiRef = doc(collection(db, 'users', uidKepsek, 'notifikasi'));
        batch.set(notifikasiRef, {
          judul: 'Jurnal Baru Menunggu Persetujuan',
          pesan: `${guruProfile.nama || userData.nama || 'Guru'} mengirim jurnal ${tanggal} untuk kelas ${kelasTerpilih.namaKelas || '-'} (${mataPelajaran.trim()}). Mohon lakukan pemeriksaan.`,
          tipe: 'jurnal_dikirim',
          dibaca: false,
          dibuatPada: serverTimestamp(),
          tautan: '/kepsek/persetujuan',
          referensiId: jurnalRef.id,
          pengirimUid: userData.uid,
        });
      });

      await batch.commit();

      setIsModalOpen(false);
      resetForm();

      if (gagalMemuatPenerima) {
        alert('Jurnal berhasil disimpan dan dikirim, tetapi daftar akun Kepala Sekolah tidak dapat dibaca sehingga pemberitahuan belum dibuat. Periksa Firestore Rules.');
      } else if (uidKepalaSekolah.length === 0) {
        alert('Jurnal berhasil disimpan dan dikirim, tetapi tidak ditemukan akun Kepala Sekolah aktif sebagai penerima pemberitahuan. Periksa akun pada Manajemen Pengguna.');
      } else {
        alert(
          editId
            ? `Jurnal berhasil diperbarui dan dikirim kembali. Pemberitahuan dikirim ke ${uidKepalaSekolah.length} akun Kepala Sekolah.`
            : `Jurnal berhasil disimpan dan dikirim. Pemberitahuan dikirim ke ${uidKepalaSekolah.length} akun Kepala Sekolah.`
        );
      }
    } catch (error) {
      console.error('Gagal menyimpan jurnal:', error);
      alert('Gagal menyimpan jurnal. Periksa koneksi dan aturan akses Firebase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHapus = async (jurnal: JurnalRecord) => {
    if (userData?.role !== 'guru' || !userData.uid) {
      alert('Hanya akun Guru yang dapat menghapus jurnal miliknya sendiri.');
      return;
    }

    const milikAkunGuru = jurnal.userId === userData.uid || jurnal.guruId === userData.uid;
    if (!milikAkunGuru) {
      alert('Jurnal ini bukan milik akun Anda. Penghapusan ditolak.');
      return;
    }

    if (!['Dikirim', 'Perlu Perbaikan'].includes(jurnal.status || '')) {
      alert('Hanya jurnal berstatus Dikirim atau Perlu Perbaikan yang dapat dihapus. Jurnal Disetujui tetap menjadi arsip.');
      return;
    }

    const yakin = window.confirm(
      `Hapus jurnal ${jurnal.mataPelajaran || ''} tanggal ${formatTanggal(jurnal.tanggal)}?\n\n` +
      'Jurnal yang dihapus tidak dapat dipulihkan. Pemberitahuan pengiriman terkait juga akan dihapus dari lonceng Kepala Sekolah.'
    );
    if (!yakin) return;

    setDeletingId(jurnal.id);
    try {
      // Ambil akun Kepala Sekolah dan bersihkan notifikasi pengiriman jurnal
      // yang sama agar tidak meninggalkan pemberitahuan yang mengarah ke jurnal terhapus.
      const akunKepsekSnapshot = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'kepsek'))
      );

      const batch = writeBatch(db);
      let jumlahNotifikasiDihapus = 0;

      for (const akunKepsek of akunKepsekSnapshot.docs) {
        const qNotifikasiTerkait = query(
          collection(db, 'users', akunKepsek.id, 'notifikasi'),
          where('referensiId', '==', jurnal.id),
          where('pengirimUid', '==', userData.uid),
          where('tipe', '==', 'jurnal_dikirim')
        );
        const notifikasiSnapshot = await getDocs(qNotifikasiTerkait);
        notifikasiSnapshot.docs.forEach((notifikasi) => {
          batch.delete(notifikasi.ref);
          jumlahNotifikasiDihapus += 1;
        });
      }

      // Batas maksimum Firestore WriteBatch adalah 500 operasi.
      if (jumlahNotifikasiDihapus + 1 > 500) {
        throw new Error('Jumlah notifikasi terkait melebihi batas operasi batch Firestore.');
      }

      batch.delete(doc(db, 'jurnal', jurnal.id));
      await batch.commit();

      alert('Jurnal berhasil dihapus.' + (jumlahNotifikasiDihapus > 0
        ? ` ${jumlahNotifikasiDihapus} pemberitahuan terkait juga dibersihkan dari lonceng Kepala Sekolah.`
        : ''));
    } catch (error) {
      console.error('Gagal menghapus jurnal:', error);
      alert('Jurnal belum berhasil dihapus. Pastikan Rules terbaru sudah dipublikasikan dan jurnal masih berstatus Dikirim atau Perlu Perbaikan.');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrint = () => window.print();

  if (loading) {
    return <div className="p-10 text-center font-bold text-slate-500">Memuat jurnal dan penugasan Anda...</div>;
  }

  if (userData?.role !== 'guru') {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#082B62]">Jurnal Mengajar</h1>
        <p className="mt-2 text-sm text-slate-600">{errorData || 'Halaman ini digunakan Guru untuk mengisi jurnal pribadi. Kepala Sekolah memantau jurnal melalui menu Monitoring Pembelajaran.'}</p>
      </div>
    );
  }

  if (errorData && !guruProfile) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-amber-800">Jurnal Mengajar belum siap</h1>
        <p className="mt-2 text-sm text-slate-600">{errorData}</p>
      </div>
    );
  }

  const tidakAdaTahunAktif = !tahunAktif;
  const tidakAdaRombel = kelasTersedia.length === 0;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important; padding: 0 !important; }
          html, body, #root, .flex, main, .overflow-y-auto { margin: 0 !important; padding: 0 !important; overflow: visible !important; height: auto !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[1400px] space-y-6 pb-10">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-[#082B62]">Jurnal Mengajar</h1>
            <p className="mt-1 font-medium text-slate-500">Catat kegiatan pembelajaran harian Anda.</p>
            {tahunAktif && (
              <p className="mt-2 text-xs font-semibold text-blue-700">
                Tahun ajaran aktif: {tahunAktif.tahun} — Semester {tahunAktif.semester}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-900">
              Cetak PDF / Print
            </button>
            <button onClick={handleOpenTambah} disabled={tidakAdaTahunAktif || tidakAdaRombel} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              + Tambah Jurnal
            </button>
          </div>
        </div>

        {errorData && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 print:hidden">{errorData}</div>
        )}

        {tidakAdaTahunAktif && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 print:hidden">
            Belum ada tahun ajaran berstatus Aktif. Atur tahun ajaran dan semester aktif melalui menu Tahun Ajaran terlebih dahulu.
          </div>
        )}

        {!tidakAdaTahunAktif && tidakAdaRombel && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 print:hidden">
            Belum ada rombel yang ditugaskan kepada Anda pada tahun ajaran {tahunAktif?.tahun}. Silakan hubungi Admin untuk memeriksa penugasan di menu Data Kelas & Rombel atau Data Pegawai.
          </div>
        )}

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 print:hidden">
          <p className="font-bold">Penugasan Anda</p>
          <p className="mt-1 text-blue-800">
            {guruProfile?.nama || userData?.nama} · {guruProfile?.jabatan || 'Guru'} · {kelasTersedia.length} rombel aktif
          </p>
          <p className="mt-1 text-xs text-blue-700">Pilihan kelas pada formulir hanya menampilkan rombel yang ditugaskan kepada Anda untuk tahun ajaran aktif.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto print:hidden">
          <table className="w-full border-collapse text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-sm text-slate-600">
                <th className="p-4 text-xs font-bold uppercase tracking-wider">No</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Hari / Tanggal</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Rombel</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Jam Ke-</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Mata Pelajaran / Tema</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Tujuan Pembelajaran</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Kegiatan & Media</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Tahun / Semester</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {jurnalList.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center font-medium text-slate-500">Belum ada jurnal yang dibuat. Klik Tambah Jurnal untuk mulai mencatat pembelajaran.</td></tr>
              ) : jurnalList.map((jurnal, index) => {
                const dapatDiedit = jurnal.status !== 'Disetujui' && Boolean(cariKelasUntukJurnal(jurnal));
                return (
                  <tr key={jurnal.id} className="border-b border-slate-100 text-sm transition-colors hover:bg-[#F5F7FB]">
                    <td className="p-4 font-medium text-slate-500">{index + 1}</td>
                    <td className="p-4 font-bold text-[#082B62]">{formatTanggal(jurnal.tanggal)}</td>
                    <td className="p-4 font-semibold text-slate-700">{jurnal.kelas || '-'}</td>
                    <td className="p-4 text-slate-600">{jurnal.jamKe || '-'}</td>
                    <td className="p-4 text-slate-600">
                      <span className="font-bold">{jurnal.mataPelajaran || '-'}</span>
                      {jurnal.tema && <span className="block text-xs text-slate-500">{jurnal.tema}</span>}
                    </td>
                    <td className="max-w-[220px] truncate p-4 text-slate-600" title={jurnal.tujuan}>{jurnal.tujuan || '-'}</td>
                    <td className="max-w-[220px] truncate p-4 text-slate-600" title={jurnal.kegiatanMedia}>{jurnal.kegiatanMedia || '-'}</td>
                    <td className="p-4 text-slate-600">{jurnal.tahunAjaran || '-'}<span className="block text-xs text-slate-500">{jurnal.semester || '-'}</span></td>
                    <td className="p-4">
                      <span className={`inline-flex rounded-md px-3 py-1 text-xs font-bold ${getStatusBadge(jurnal.status)}`}>{jurnal.status || 'Belum diketahui'}</span>
                      {jurnal.catatanKepsek && <p className="mt-1 max-w-[180px] whitespace-normal text-xs italic text-red-500">Catatan: {jurnal.catatanKepsek}</p>}
                    </td>
                    <td className="p-4">
                      {jurnal.status === 'Disetujui' ? (
                        <span className="text-xs font-bold text-emerald-600">✓ Arsip Disetujui</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          {dapatDiedit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(jurnal)}
                              className="font-bold text-blue-700 transition-colors hover:text-blue-900"
                            >
                              Edit
                            </button>
                          )}
                          {['Dikirim', 'Perlu Perbaikan'].includes(jurnal.status || '') &&
                            (jurnal.userId === userData?.uid || jurnal.guruId === userData?.uid) && (
                              <button
                                type="button"
                                onClick={() => handleHapus(jurnal)}
                                disabled={deletingId === jurnal.id}
                                className="font-bold text-red-600 transition-colors hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingId === jurnal.id ? 'Menghapus...' : 'Hapus'}
                              </button>
                            )}
                          {!dapatDiedit && !['Dikirim', 'Perlu Perbaikan'].includes(jurnal.status || '') && (
                            <span className="text-xs text-slate-400" title="Status jurnal tidak mengizinkan penghapusan">Arsip</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="print-area hidden bg-white font-serif text-black print:block">
          <div className="mb-6 border-b-4 border-double border-black pb-4 text-center">
            <h1 className="text-2xl font-extrabold uppercase">{identitasSekolah.namaSekolah || 'NAMA SEKOLAH'}</h1>
            {identitasSekolah.npsn && <p className="mt-1 text-sm">NPSN: {identitasSekolah.npsn}</p>}
            {identitasSekolah.alamat && <p className="mt-1 text-sm">{identitasSekolah.alamat}</p>}
            {(identitasSekolah.email || identitasSekolah.website) && (
              <p className="text-sm">{[identitasSekolah.email, identitasSekolah.website].filter(Boolean).join(' | ')}</p>
            )}
            <h2 className="mt-4 text-xl font-bold underline">JURNAL HARIAN GURU</h2>
          </div>
          <div className="mb-4 text-sm">
            <p><strong>Nama Guru:</strong> {guruProfile?.nama || userData?.nama || '-'}</p>
            <p><strong>NIP / NUPTK:</strong> {guruProfile?.nip || guruProfile?.nuptk || '-'}</p>
          </div>
          <table className="mb-8 w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-2">No</th>
                <th className="border border-black p-2">Tanggal</th>
                <th className="border border-black p-2">Rombel</th>
                <th className="border border-black p-2">Jam</th>
                <th className="border border-black p-2">Tahun / Semester</th>
                <th className="border border-black p-2">Mata Pelajaran / Tema</th>
                <th className="border border-black p-2">Tujuan Pembelajaran</th>
                <th className="border border-black p-2">Kegiatan & Media</th>
                <th className="border border-black p-2">Absensi</th>
                <th className="border border-black p-2">Refleksi</th>
                <th className="border border-black p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {jurnalList.map((jurnal, index) => (
                <tr key={jurnal.id}>
                  <td className="border border-black p-2 text-center align-top">{index + 1}</td>
                  <td className="border border-black p-2 align-top">{formatTanggal(jurnal.tanggal)}</td>
                  <td className="border border-black p-2 align-top">{jurnal.kelas || '-'}</td>
                  <td className="border border-black p-2 text-center align-top">{jurnal.jamKe || '-'}</td>
                  <td className="border border-black p-2 align-top">{jurnal.tahunAjaran || '-'} / {jurnal.semester || '-'}</td>
                  <td className="border border-black p-2 align-top">{jurnal.mataPelajaran || '-'}<br/>{jurnal.tema || ''}</td>
                  <td className="border border-black p-2 align-top">{jurnal.tujuan || '-'}</td>
                  <td className="border border-black p-2 align-top">{jurnal.kegiatanMedia || '-'}</td>
                  <td className="border border-black p-2 align-top">{jurnal.absensiSiswa || '-'}</td>
                  <td className="border border-black p-2 align-top">{jurnal.refleksi || '-'}</td>
                  <td className="border border-black p-2 align-top">{jurnal.status || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-12 flex justify-between text-sm">
            <div className="w-64 text-center">
              <p>Mengetahui,</p>
              <p className="mb-20">Kepala Sekolah</p>
              <p className="font-bold underline">{identitasSekolah.kepalaSekolah || '..............................................'}</p>
              <p>NIP. ............................................</p>
            </div>
            <div className="w-64 text-center">
              <p>Tanggal cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="mb-20">Guru Mata Pelajaran</p>
              <p className="font-bold underline">{guruProfile?.nama || userData?.nama || '..............................................'}</p>
              <p>NIP. {guruProfile?.nip || '-'}</p>
            </div>
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 print:hidden">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-[#082B62]">{editId ? 'Edit Jurnal Mengajar' : 'Buat Jurnal Mengajar'}</h2>
                  <p className="mt-1 text-xs text-slate-500">Isi kegiatan pembelajaran sesuai rombel yang ditugaskan kepada Anda.</p>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-100">✕</button>
              </div>

              <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="font-bold">Periode aktif</p>
                <p>{tahunAktif?.tahun} — Semester {tahunAktif?.semester}</p>
              </div>

              <form onSubmit={handleSimpan} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Tanggal</label>
                  <input type="date" value={tanggal} onChange={(event) => setTanggal(event.target.value)} required className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#155EEF]" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Jam Ke-</label>
                  <input type="text" value={jamKe} onChange={(event) => setJamKe(event.target.value)} required placeholder="Contoh: 1–3" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#155EEF]" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Rombel</label>
                  <select value={kelasId} onChange={(event) => setKelasId(event.target.value)} required className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#155EEF]">
                    <option value="">-- Pilih Rombel yang Ditugaskan --</option>
                    {kelasTersedia.map((item) => <option key={item.id} value={item.id}>{item.namaKelas} — {item.jenjang || ''} Tingkat {item.tingkat ?? ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Mata Pelajaran</label>
                  <input type="text" value={mataPelajaran} onChange={(event) => setMataPelajaran(event.target.value)} required placeholder="Contoh: Matematika" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#155EEF]" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-bold text-slate-700">Elemen / Bab / Tema</label>
                  <input type="text" value={tema} onChange={(event) => setTema(event.target.value)} required placeholder="Contoh: Bab 3 — Lihat Sekitar" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#155EEF]" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-bold text-slate-700">Tujuan Pembelajaran (TP)</label>
                  <textarea value={tujuan} onChange={(event) => setTujuan(event.target.value)} required rows={2} placeholder="Tuliskan tujuan pembelajaran yang ingin dicapai." className="w-full resize-none rounded-lg border border-slate-300 px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#155EEF]" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-bold text-slate-700">Kegiatan Pembelajaran & Media</label>
                  <textarea value={kegiatanMedia} onChange={(event) => setKegiatanMedia(event.target.value)} required rows={3} placeholder="Tuliskan kegiatan pembelajaran dan media yang digunakan." className="w-full resize-none rounded-lg border border-slate-300 px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#155EEF]" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Absensi / Kehadiran Siswa</label>
                  <input type="text" value={absensiSiswa} onChange={(event) => setAbsensiSiswa(event.target.value)} placeholder="Contoh: Hadir 28, Sakit 2" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#155EEF]" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">Refleksi & Tindak Lanjut</label>
                  <textarea value={refleksi} onChange={(event) => setRefleksi(event.target.value)} rows={2} placeholder="Catatan refleksi pembelajaran." className="w-full resize-none rounded-lg border border-slate-300 px-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-[#155EEF]" />
                </div>
                <div className="mt-4 flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-4 sm:flex-row md:col-span-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl px-5 py-2.5 font-bold text-slate-600 transition-colors hover:bg-slate-100">Batal</button>
                  <button type="submit" disabled={isSaving || !kelasTerpilih} className="rounded-xl bg-[#155EEF] px-6 py-2.5 font-bold text-white shadow-md transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSaving ? 'Menyimpan...' : 'Simpan Jurnal'}
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
