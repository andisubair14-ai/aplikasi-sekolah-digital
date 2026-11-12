import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type KelasRecord = {
  id: string;
  namaKelas?: string;
  jenjang?: string;
  tingkat?: string | number;
  tahunAjaran?: string;
  waliKelasId?: string | null;
  kelasDiampu?: string[];
};

type GuruRecord = {
  id: string;
  nama?: string;
  mapel?: string;
  jabatan?: string;
  kelasDiampu?: string[];
};

type TahunAjaranRecord = {
  id: string;
  tahun?: string;
  semester?: string;
  status?: string;
};

type JadwalRecord = {
  id: string;
  kelasId?: string;
  guruId?: string;
  mataPelajaran?: string;
  tahunAjaran?: string;
  semester?: string;
};

type SiswaRecord = {
  id: string;
  nama?: string;
  nisn?: string;
  kelas?: string;
  kelasId?: string;
  status?: string;
  tahunAjaran?: string;
  semester?: string;
};

type PenilaianRecord = {
  id: string;
  judulPenilaian?: string;
  jenisPenilaian?: string;
  kelasId?: string;
  namaKelas?: string;
  jenjang?: string;
  tingkat?: string;
  guruId?: string;
  userId?: string;
  namaGuru?: string;
  mataPelajaran?: string;
  tanggal?: string;
  tahunAjaran?: string;
  semester?: string;
  nilaiMaksimal?: number;
  keterangan?: string;
  createdAt?: unknown;
};

type NilaiRecord = {
  id: string;
  siswaId?: string;
  namaSiswa?: string;
  kelasId?: string;
  nilai?: number;
  catatan?: string;
  createdAt?: unknown;
};

type FormPenilaian = {
  judulPenilaian: string;
  jenisPenilaian: string;
  kelasId: string;
  mataPelajaran: string;
  tanggal: string;
  tahunAjaran: string;
  semester: string;
  nilaiMaksimal: string;
  keterangan: string;
};

type IsianNilai = { nilai: string; catatan: string };

const JENIS_PENILAIAN = ['Formatif', 'Sumatif', 'Tugas', 'Ulangan', 'Praktik', 'Proyek'];
const HARI_INI = () => {
  const sekarang = new Date();
  const pad = (angka: number) => String(angka).padStart(2, '0');
  return `${sekarang.getFullYear()}-${pad(sekarang.getMonth() + 1)}-${pad(sekarang.getDate())}`;
};
const teks = (value: unknown) => String(value ?? '').trim();
const angkaRomawi = (value?: string | number) => {
  const angka = Number.parseInt(String(value ?? ''), 10);
  const daftar: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX' };
  return daftar[angka] || String(value ?? '-');
};
const formatTanggal = (tanggal?: string) => {
  if (!tanggal) return '-';
  const date = new Date(`${tanggal}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? tanggal
    : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};
const formatTingkatKelas = (kelas: KelasRecord) => {
  const tingkat = kelas.tingkat ? ` · Tingkat ${angkaRomawi(kelas.tingkat)}` : '';
  return `${kelas.namaKelas || 'Rombel'}${kelas.jenjang ? ` (${kelas.jenjang}${tingkat})` : tingkat}`;
};
const buatFormAwal = (tahun?: string, semester?: string): FormPenilaian => ({
  judulPenilaian: '',
  jenisPenilaian: 'Formatif',
  kelasId: '',
  mataPelajaran: '',
  tanggal: HARI_INI(),
  tahunAjaran: tahun || '',
  semester: semester || 'Ganjil',
  nilaiMaksimal: '100',
  keterangan: '',
});

export default function PenilaianSiswa() {
  const { userData } = useAuth();
  const uid = teks(userData?.uid);
  const guruId = teks(userData?.guruId);
  const isGuru = userData?.role === 'guru';

  const [guruProfile, setGuruProfile] = useState<GuruRecord | null>(null);
  const [kelasList, setKelasList] = useState<KelasRecord[]>([]);
  const [tahunList, setTahunList] = useState<TahunAjaranRecord[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalRecord[]>([]);
  const [penilaianList, setPenilaianList] = useState<PenilaianRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorData, setErrorData] = useState('');
  const [pesan, setPesan] = useState('');
  const [kataKunci, setKataKunci] = useState('');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterJenis, setFilterJenis] = useState('Semua');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [form, setForm] = useState<FormPenilaian>(buatFormAwal());
  const [penilaianTerpilih, setPenilaianTerpilih] = useState<PenilaianRecord | null>(null);
  const [siswaList, setSiswaList] = useState<SiswaRecord[]>([]);
  const [nilaiMap, setNilaiMap] = useState<Record<string, IsianNilai>>({});
  const [nilaiTersimpan, setNilaiTersimpan] = useState<Record<string, NilaiRecord>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingNilai, setSavingNilai] = useState(false);

  useEffect(() => {
    if (!isGuru || !uid || !guruId) {
      setLoading(false);
      setErrorData(!isGuru
        ? 'Halaman ini khusus untuk akun Guru.'
        : 'Akun Guru belum terhubung dengan Data Pegawai. Hubungi Admin melalui menu Manajemen Pengguna.');
      return;
    }

    setLoading(true);
    setErrorData('');
    let sumberSiap = 0;
    const tandaiSiap = () => {
      sumberSiap += 1;
      if (sumberSiap >= 5) setLoading(false);
    };

    const unsubGuru = onSnapshot(
      doc(db, 'guru', guruId),
      (snapshot) => {
        setGuruProfile(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as GuruRecord) : null);
        tandaiSiap();
      },
      (error) => {
        console.error('Gagal memuat profil Guru untuk penilaian:', error);
        setErrorData('Profil Guru belum dapat dibaca. Periksa koneksi dan hak akses Firestore.');
        tandaiSiap();
      }
    );

    const unsubKelas = onSnapshot(
      collection(db, 'kelas'),
      (snapshot) => {
        setKelasList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as KelasRecord[]);
        tandaiSiap();
      },
      (error) => {
        console.error('Gagal memuat rombel:', error);
        setErrorData('Data kelas belum dapat dibaca. Periksa koneksi dan Firestore Rules.');
        tandaiSiap();
      }
    );

    const unsubTahun = onSnapshot(
      query(collection(db, 'tahun_ajaran'), where('status', '==', 'Aktif')),
      (snapshot) => {
        setTahunList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TahunAjaranRecord[]);
        tandaiSiap();
      },
      (error) => {
        console.error('Gagal memuat tahun ajaran aktif:', error);
        setErrorData('Tahun ajaran aktif belum dapat dibaca. Periksa Firestore Rules.');
        tandaiSiap();
      }
    );

    const unsubJadwal = onSnapshot(
      query(collection(db, 'jadwal_pelajaran'), where('guruId', '==', guruId)),
      (snapshot) => {
        setJadwalList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as JadwalRecord[]);
        tandaiSiap();
      },
      (error) => {
        console.warn('Jadwal Guru belum dapat dimuat untuk pilihan mata pelajaran:', error);
        setJadwalList([]);
        tandaiSiap();
      }
    );

    const unsubPenilaian = onSnapshot(
      query(collection(db, 'penilaian_siswa'), where('userId', '==', uid)),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as PenilaianRecord[];
        data.sort((a, b) => teks(b.tanggal).localeCompare(teks(a.tanggal)));
        setPenilaianList(data);
        tandaiSiap();
      },
      (error) => {
        console.error('Gagal memuat daftar penilaian:', error);
        setErrorData('Daftar penilaian belum dapat dibaca. Periksa koneksi dan Firestore Rules.');
        tandaiSiap();
      }
    );

    return () => {
      unsubGuru();
      unsubKelas();
      unsubTahun();
      unsubJadwal();
      unsubPenilaian();
    };
  }, [isGuru, uid, guruId]);

  const tahunAktif = useMemo(() => tahunList[0], [tahunList]);
  const labelTahunAktif = teks(tahunAktif?.tahun || tahunAktif?.id);
  const kelasGuru = useMemo(() => {
    const kelasDiampu = Array.isArray(guruProfile?.kelasDiampu) ? guruProfile.kelasDiampu : [];
    const terdaftar = kelasList.filter((kelas) => kelasDiampu.includes(kelas.id) || kelas.waliKelasId === guruId);
    const cocokTahun = terdaftar.filter((kelas) => !labelTahunAktif || !teks(kelas.tahunAjaran) || teks(kelas.tahunAjaran) === '-' || teks(kelas.tahunAjaran) === labelTahunAktif);
    return (cocokTahun.length ? cocokTahun : terdaftar).sort((a, b) => {
      const jenjang = teks(a.jenjang).localeCompare(teks(b.jenjang));
      if (jenjang) return jenjang;
      const tingkat = Number(a.tingkat || 99) - Number(b.tingkat || 99);
      if (tingkat) return tingkat;
      return teks(a.namaKelas).localeCompare(teks(b.namaKelas), 'id', { numeric: true });
    });
  }, [guruProfile, kelasList, guruId, labelTahunAktif]);

  const penilaianTampil = useMemo(() => {
    const cari = kataKunci.trim().toLowerCase();
    return penilaianList.filter((item) => {
      const cocokKelas = filterKelas === 'Semua' || item.kelasId === filterKelas;
      const cocokJenis = filterJenis === 'Semua' || item.jenisPenilaian === filterJenis;
      const cocokKata = !cari || [item.judulPenilaian, item.mataPelajaran, item.namaKelas, item.tahunAjaran]
        .some((value) => teks(value).toLowerCase().includes(cari));
      return cocokKelas && cocokJenis && cocokKata;
    });
  }, [penilaianList, kataKunci, filterKelas, filterJenis]);

  const ringkasan = useMemo(() => ({
    total: penilaianList.length,
    kelas: new Set(penilaianList.map((item) => item.kelasId).filter(Boolean)).size,
    formatif: penilaianList.filter((item) => item.jenisPenilaian === 'Formatif').length,
    sumatif: penilaianList.filter((item) => item.jenisPenilaian === 'Sumatif').length,
  }), [penilaianList]);

  const mataPelajaranKelas = useMemo(() => {
    if (!form.kelasId) return [];
    return Array.from(new Set(
      jadwalList
        .filter((jadwal) => jadwal.kelasId === form.kelasId)
        .map((jadwal) => teks(jadwal.mataPelajaran))
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'id'));
  }, [jadwalList, form.kelasId]);

  const rataRata = useMemo(() => {
    const nilai = Object.values(nilaiMap)
      .map((item) => item.nilai.trim())
      .filter(Boolean)
      .map(Number)
      .filter((item) => Number.isFinite(item));
    return nilai.length ? nilai.reduce((jumlah, item) => jumlah + item, 0) / nilai.length : null;
  }, [nilaiMap]);

  const nilaiTerisi = useMemo(() => Object.values(nilaiMap).filter((item) => item.nilai.trim() !== '').length, [nilaiMap]);

  const bukaFormTambah = () => {
    const kelasPertama = kelasGuru[0];
    const tahun = labelTahunAktif || teks(kelasPertama?.tahunAjaran);
    setForm({
      ...buatFormAwal(tahun, teks(tahunAktif?.semester) || 'Ganjil'),
      kelasId: kelasPertama?.id || '',
      mataPelajaran: teks(guruProfile?.mapel) !== '-' ? teks(guruProfile?.mapel) : '',
    });
    setPesan('');
    setIsFormOpen(true);
  };

  const simpanPenilaian = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uid || !guruId || !guruProfile) return;

    const kelas = kelasGuru.find((item) => item.id === form.kelasId);
    const nilaiMaksimal = Number(form.nilaiMaksimal);
    if (!kelas) {
      alert('Pilih rombel yang memang menjadi penugasan Anda.');
      return;
    }
    if (teks(kelas.tahunAjaran) && teks(kelas.tahunAjaran) !== '-' && teks(kelas.tahunAjaran) !== form.tahunAjaran.trim()) {
      alert(`Rombel ${kelas.namaKelas || ''} tercatat untuk tahun ajaran ${kelas.tahunAjaran}. Sesuaikan tahun ajaran penilaian dengan data rombel.`);
      return;
    }
    if (!form.judulPenilaian.trim() || !form.mataPelajaran.trim() || !form.tahunAjaran.trim() || !form.semester.trim()) {
      alert('Judul, mata pelajaran, tahun ajaran, dan semester wajib diisi.');
      return;
    }
    if (!Number.isFinite(nilaiMaksimal) || nilaiMaksimal <= 0 || nilaiMaksimal > 100) {
      alert('Nilai maksimal harus lebih dari 0 dan tidak boleh melebihi 100.');
      return;
    }

    setIsSavingForm(true);
    setPesan('');
    try {
      const ref = doc(collection(db, 'penilaian_siswa'));
      await setDoc(ref, {
        judulPenilaian: form.judulPenilaian.trim(),
        jenisPenilaian: form.jenisPenilaian,
        kelasId: kelas.id,
        namaKelas: teks(kelas.namaKelas),
        jenjang: teks(kelas.jenjang),
        tingkat: teks(kelas.tingkat),
        guruId,
        userId: uid,
        namaGuru: teks(guruProfile.nama || userData?.nama),
        mataPelajaran: form.mataPelajaran.trim(),
        tanggal: form.tanggal,
        tahunAjaran: form.tahunAjaran.trim(),
        semester: form.semester.trim(),
        nilaiMaksimal,
        keterangan: form.keterangan.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: uid,
        updatedByUid: uid,
      });
      setIsFormOpen(false);
      setPesan('Penilaian berhasil dibuat. Silakan buka penilaian tersebut untuk mengisi nilai siswa.');
    } catch (error) {
      console.error('Gagal membuat penilaian:', error);
      alert('Penilaian belum berhasil disimpan. Periksa koneksi dan Firestore Rules.');
    } finally {
      setIsSavingForm(false);
    }
  };

  const bukaDetailPenilaian = async (item: PenilaianRecord) => {
    if (!item.id || !item.kelasId) return;
    setLoadingDetail(true);
    setPesan('');
    setPenilaianTerpilih(item);
    setSiswaList([]);
    setNilaiMap({});
    setNilaiTersimpan({});
    try {
      const [siswaSnapshot, nilaiSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'siswa_ringkas'), where('kelasId', '==', item.kelasId))),
        getDocs(collection(db, 'penilaian_siswa', item.id, 'nilai')),
      ]);

      const siswa = siswaSnapshot.docs
        .map((siswaDoc) => ({ id: siswaDoc.id, ...siswaDoc.data() }))
        .filter((data) => !['Lulus', 'Pindah Keluar'].includes(teks((data as SiswaRecord).status || 'Aktif')))
        .filter((data) => !teks((data as SiswaRecord).tahunAjaran) || teks((data as SiswaRecord).tahunAjaran) === teks(item.tahunAjaran)) as SiswaRecord[];
      siswa.sort((a, b) => teks(a.nama).localeCompare(teks(b.nama), 'id'));

      const tersimpan: Record<string, NilaiRecord> = {};
      const isian: Record<string, IsianNilai> = {};
      nilaiSnapshot.docs.forEach((nilaiDoc) => {
        const data = { id: nilaiDoc.id, ...nilaiDoc.data() } as NilaiRecord;
        tersimpan[nilaiDoc.id] = data;
      });
      siswa.forEach((siswaItem) => {
        const sebelumnya = tersimpan[siswaItem.id];
        isian[siswaItem.id] = {
          nilai: sebelumnya?.nilai === undefined ? '' : String(sebelumnya.nilai),
          catatan: sebelumnya?.catatan || '',
        };
      });
      setSiswaList(siswa);
      setNilaiTersimpan(tersimpan);
      setNilaiMap(isian);
    } catch (error) {
      console.error('Gagal memuat daftar siswa atau nilai:', error);
      setPesan('Daftar siswa/nilai belum dapat dibaca. Pastikan akun Guru ditugaskan pada rombel ini dan Firestore Rules sudah diperbarui.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const ubahIsianNilai = (siswaId: string, field: keyof IsianNilai, value: string) => {
    setNilaiMap((sebelumnya) => ({
      ...sebelumnya,
      [siswaId]: { ...(sebelumnya[siswaId] || { nilai: '', catatan: '' }), [field]: value },
    }));
  };

  const simpanSemuaNilai = async () => {
    if (!uid || !guruId || !penilaianTerpilih) return;
    const maksimum = Number(penilaianTerpilih.nilaiMaksimal || 100);
    for (const siswa of siswaList) {
      const nilai = teks(nilaiMap[siswa.id]?.nilai);
      if (!nilai) continue;
      const angka = Number(nilai);
      if (!Number.isFinite(angka) || angka < 0 || angka > maksimum) {
        alert(`Nilai ${siswa.nama || 'siswa'} harus berada antara 0 sampai ${maksimum}.`);
        return;
      }
    }

    setSavingNilai(true);
    setPesan('');
    try {
      const operasi: Array<{ siswaId: string; isHapus: boolean; data?: Record<string, unknown> }> = [];
      siswaList.forEach((siswa) => {
        const isian = nilaiMap[siswa.id] || { nilai: '', catatan: '' };
        const angka = isian.nilai.trim() === '' ? null : Number(isian.nilai);
        const sudahAda = Boolean(nilaiTersimpan[siswa.id]);
        if (angka === null) {
          if (sudahAda) operasi.push({ siswaId: siswa.id, isHapus: true });
          return;
        }
        operasi.push({
          siswaId: siswa.id,
          isHapus: false,
          data: {
            siswaId: siswa.id,
            namaSiswa: teks(siswa.nama),
            kelasId: teks(penilaianTerpilih.kelasId),
            nilai: angka,
            catatan: isian.catatan.trim(),
            createdAt: nilaiTersimpan[siswa.id]?.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdByUid: nilaiTersimpan[siswa.id] ? undefined : uid,
            updatedByUid: uid,
          },
        });
      });

      for (let index = 0; index < operasi.length; index += 400) {
        const potongan = operasi.slice(index, index + 400);
        const batch = writeBatch(db);
        potongan.forEach((operasiNilai) => {
          const ref = doc(db, 'penilaian_siswa', penilaianTerpilih.id, 'nilai', operasiNilai.siswaId);
          if (operasiNilai.isHapus) batch.delete(ref);
          else {
            const data = Object.fromEntries(Object.entries(operasiNilai.data || {}).filter(([, value]) => value !== undefined));
            batch.set(ref, data, { merge: true });
          }
        });
        await batch.commit();
      }
      await bukaDetailPenilaian(penilaianTerpilih);
      setPesan('Nilai siswa berhasil disimpan.');
    } catch (error) {
      console.error('Gagal menyimpan nilai siswa:', error);
      alert('Nilai belum berhasil disimpan. Periksa koneksi dan Firestore Rules.');
    } finally {
      setSavingNilai(false);
    }
  };

  const hapusPenilaian = async (item: PenilaianRecord) => {
    if (!item.id) return;
    const yakin = window.confirm(`Hapus penilaian "${item.judulPenilaian || 'tanpa judul'}" beserta seluruh nilai siswanya? Tindakan ini tidak dapat dibatalkan.`);
    if (!yakin) return;
    try {
      const nilaiSnapshot = await getDocs(collection(db, 'penilaian_siswa', item.id, 'nilai'));
      for (let index = 0; index < nilaiSnapshot.docs.length; index += 400) {
        const batch = writeBatch(db);
        nilaiSnapshot.docs.slice(index, index + 400).forEach((nilaiDoc) => batch.delete(nilaiDoc.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'penilaian_siswa', item.id));
      if (penilaianTerpilih?.id === item.id) {
        setPenilaianTerpilih(null);
        setSiswaList([]);
        setNilaiMap({});
        setNilaiTersimpan({});
      }
      setPesan('Penilaian dan nilai siswa terkait berhasil dihapus.');
    } catch (error) {
      console.error('Gagal menghapus penilaian:', error);
      alert('Penilaian belum dapat dihapus. Periksa koneksi dan Firestore Rules.');
    }
  };

  const eksporCSV = () => {
    if (!penilaianTerpilih || siswaList.length === 0) return;
    const baris = [
      ['No', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Jenis Penilaian', 'Nilai', 'Nilai Maksimal', 'Catatan'],
      ...siswaList.map((siswa, index) => [
        String(index + 1), teks(siswa.nama), teks(penilaianTerpilih.namaKelas),
        teks(penilaianTerpilih.mataPelajaran), teks(penilaianTerpilih.jenisPenilaian),
        teks(nilaiMap[siswa.id]?.nilai) || 'Belum dinilai',
        String(penilaianTerpilih.nilaiMaksimal || 100), teks(nilaiMap[siswa.id]?.catatan),
      ]),
    ];
    const csv = `\uFEFF${baris.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nilai_${teks(penilaianTerpilih.namaKelas).replace(/\s+/g, '_')}_${teks(penilaianTerpilih.mataPelajaran).replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const cetakNilai = () => window.print();

  if (!isGuru) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Menu Penilaian Siswa hanya tersedia untuk akun Guru.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <style>{`@media print { body * { visibility: hidden !important; } .nilai-print, .nilai-print * { visibility: visible !important; } .nilai-print { position: absolute; inset: 0; width: 100%; padding: 0 !important; } .no-print { display: none !important; } @page { size: A4 portrait; margin: 12mm; } }`}</style>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#082B62] via-[#10468B] to-[#155EEF] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-blue-100">PENGELOLAAN HASIL BELAJAR</span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Penilaian Siswa</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">Kelola hasil penilaian peserta didik berdasarkan rombel dan mata pelajaran yang Anda ampu.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur-sm">
            <p className="text-xs text-blue-100">Guru pengampu</p>
            <p className="mt-1 font-bold">{guruProfile?.nama || userData?.nama || 'Guru'}</p>
            <p className="mt-1 text-xs text-blue-100">{labelTahunAktif || 'Tahun ajaran belum ditentukan'}</p>
          </div>
        </div>
      </section>

      {pesan && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{pesan}</div>}
      {errorData && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorData}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Penilaian', value: ringkasan.total, icon: '▤', tone: 'text-blue-700 bg-blue-50' },
          { label: 'Rombel Dinilai', value: ringkasan.kelas, icon: '▦', tone: 'text-cyan-700 bg-cyan-50' },
          { label: 'Penilaian Formatif', value: ringkasan.formatif, icon: '✎', tone: 'text-emerald-700 bg-emerald-50' },
          { label: 'Penilaian Sumatif', value: ringkasan.sumatif, icon: '✓', tone: 'text-violet-700 bg-violet-50' },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-500">{card.label}</p><span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${card.tone}`}>{card.icon}</span></div>
            <p className="mt-3 text-3xl font-extrabold tabular-nums text-[#082B62]">{loading ? '…' : card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h2 className="text-lg font-extrabold text-[#082B62]">Daftar Penilaian</h2><p className="mt-1 text-sm text-slate-500">Buat penilaian baru atau buka daftar siswa untuk mengisi dan memperbarui nilai.</p></div>
          <button type="button" onClick={bukaFormTambah} disabled={loading || kelasGuru.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#155EEF] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">＋ Buat Penilaian</button>
        </div>

        {kelasGuru.length === 0 && !loading && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Belum ada rombel yang terhubung ke akun Anda. Admin perlu mengatur penugasan melalui Data Kelas dan Rombel atau Data Pegawai.</div>}

        <div className="no-print mt-5 grid gap-3 md:grid-cols-[1fr_220px_200px]">
          <input value={kataKunci} onChange={(event) => setKataKunci(event.target.value)} placeholder="Cari judul, mata pelajaran, atau kelas..." className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          <select value={filterKelas} onChange={(event) => setFilterKelas(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"><option value="Semua">Semua rombel</option>{kelasGuru.map((kelas) => <option key={kelas.id} value={kelas.id}>{formatTingkatKelas(kelas)}</option>)}</select>
          <select value={filterJenis} onChange={(event) => setFilterJenis(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"><option value="Semua">Semua jenis</option>{JENIS_PENILAIAN.map((jenis) => <option key={jenis}>{jenis}</option>)}</select>
        </div>

        {loading ? <div className="py-12 text-center text-sm text-slate-500">Memuat data penilaian...</div>
          : penilaianTampil.length === 0 ? <div className="py-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">▤</div><p className="mt-3 font-bold text-slate-700">Belum ada penilaian</p><p className="mt-1 text-sm text-slate-500">Gunakan tombol Buat Penilaian untuk memulai pencatatan nilai siswa.</p></div>
          : <div className="mt-4 grid gap-3 lg:grid-cols-2">{penilaianTampil.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{item.jenisPenilaian || 'Penilaian'}</span><h3 className="mt-2 break-words text-base font-extrabold text-[#082B62]">{item.judulPenilaian || 'Tanpa judul'}</h3><p className="mt-1 text-sm font-semibold text-slate-700">{item.mataPelajaran || '-'}</p></div><span className="rounded-xl bg-slate-50 px-3 py-2 text-right text-xs text-slate-500">{formatTanggal(item.tanggal)}<b className="mt-1 block text-slate-700">{item.namaKelas || '-'}</b></span></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><p className="text-xs text-slate-500">{item.tahunAjaran || '-'} · Semester {item.semester || '-'} · Maks. {item.nilaiMaksimal || 100}</p><div className="flex gap-2"><button type="button" onClick={() => void hapusPenilaian(item)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">Hapus</button><button type="button" onClick={() => void bukaDetailPenilaian(item)} className="rounded-lg bg-[#155EEF] px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">Kelola Nilai</button></div></div></article>)}</div>}
      </section>

      {isFormOpen && <div className="no-print fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false); }}><form onSubmit={simpanPenilaian} className="my-auto w-full max-w-2xl space-y-4 rounded-3xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Penilaian baru</p><h2 className="mt-1 text-xl font-extrabold text-[#082B62]">Buat Penilaian Siswa</h2><p className="mt-1 text-sm text-slate-500">Pilih rombel yang tercantum pada penugasan Anda.</p></div><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Tutup">✕</button></div><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm font-semibold text-slate-700 sm:col-span-2">Judul penilaian<input required value={form.judulPenilaian} onChange={(event) => setForm((prev) => ({ ...prev, judulPenilaian: event.target.value }))} placeholder="Contoh: Penilaian Bab 1" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Jenis penilaian<select value={form.jenisPenilaian} onChange={(event) => setForm((prev) => ({ ...prev, jenisPenilaian: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal">{JENIS_PENILAIAN.map((jenis) => <option key={jenis}>{jenis}</option>)}</select></label><label className="space-y-1 text-sm font-semibold text-slate-700">Tanggal<input type="date" required value={form.tanggal} onChange={(event) => setForm((prev) => ({ ...prev, tanggal: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label><label className="space-y-1 text-sm font-semibold text-slate-700 sm:col-span-2">Rombel<select required value={form.kelasId} onChange={(event) => { const kelas = kelasGuru.find((item) => item.id === event.target.value); const mapelDariJadwal = jadwalList.find((jadwal) => jadwal.kelasId === event.target.value)?.mataPelajaran; setForm((prev) => ({ ...prev, kelasId: event.target.value, mataPelajaran: teks(mapelDariJadwal || guruProfile?.mapel) === '-' ? '' : teks(mapelDariJadwal || guruProfile?.mapel), tahunAjaran: teks(kelas?.tahunAjaran) && teks(kelas?.tahunAjaran) !== '-' ? teks(kelas?.tahunAjaran) : (labelTahunAktif || prev.tahunAjaran) })); }} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"><option value="">Pilih rombel</option>{kelasGuru.map((kelas) => <option key={kelas.id} value={kelas.id}>{formatTingkatKelas(kelas)}</option>)}</select></label><label className="space-y-1 text-sm font-semibold text-slate-700 sm:col-span-2">Mata pelajaran<input required list="opsi-mapel-penilaian" value={form.mataPelajaran} onChange={(event) => setForm((prev) => ({ ...prev, mataPelajaran: event.target.value }))} placeholder="Masukkan mata pelajaran" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"/><datalist id="opsi-mapel-penilaian">{mataPelajaranKelas.map((mapel) => <option key={mapel} value={mapel}/>)}</datalist></label><label className="space-y-1 text-sm font-semibold text-slate-700">Tahun ajaran<input required value={form.tahunAjaran} onChange={(event) => setForm((prev) => ({ ...prev, tahunAjaran: event.target.value }))} placeholder="Contoh: 2026/2027" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Semester<input required value={form.semester} onChange={(event) => setForm((prev) => ({ ...prev, semester: event.target.value }))} placeholder="Ganjil / Genap" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label><label className="space-y-1 text-sm font-semibold text-slate-700">Nilai maksimal<input type="number" min="1" max="100" step="1" required value={form.nilaiMaksimal} onChange={(event) => setForm((prev) => ({ ...prev, nilaiMaksimal: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label><label className="space-y-1 text-sm font-semibold text-slate-700 sm:col-span-2">Keterangan (opsional)<textarea value={form.keterangan} onChange={(event) => setForm((prev) => ({ ...prev, keterangan: event.target.value }))} rows={2} placeholder="Materi atau catatan penilaian" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label></div><div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Batal</button><button type="submit" disabled={isSavingForm} className="rounded-xl bg-[#155EEF] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isSavingForm ? 'Menyimpan...' : 'Simpan Penilaian'}</button></div></form></div>}

      {penilaianTerpilih && <section className="nilai-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Input nilai peserta didik</p><h2 className="mt-1 text-xl font-extrabold text-[#082B62]">{penilaianTerpilih.judulPenilaian}</h2><p className="mt-1 text-sm text-slate-600">{penilaianTerpilih.namaKelas} · {penilaianTerpilih.mataPelajaran} · {penilaianTerpilih.jenisPenilaian}</p><p className="mt-1 text-xs text-slate-500">{penilaianTerpilih.tahunAjaran} · Semester {penilaianTerpilih.semester} · {formatTanggal(penilaianTerpilih.tanggal)} · Nilai maksimal {penilaianTerpilih.nilaiMaksimal || 100}</p></div><div className="no-print flex flex-wrap gap-2"><button type="button" onClick={cetakNilai} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Cetak</button><button type="button" onClick={eksporCSV} disabled={siswaList.length === 0} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Ekspor CSV</button><button type="button" onClick={() => setPenilaianTerpilih(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Tutup</button></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-blue-50 p-3"><p className="text-xs text-blue-700">Jumlah siswa</p><p className="mt-1 text-xl font-extrabold text-[#082B62]">{siswaList.length}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Sudah dinilai</p><p className="mt-1 text-xl font-extrabold text-emerald-800">{nilaiTerisi}</p></div><div className="rounded-xl bg-violet-50 p-3"><p className="text-xs text-violet-700">Rata-rata nilai terisi</p><p className="mt-1 text-xl font-extrabold text-violet-800">{rataRata === null ? '-' : rataRata.toFixed(1)}</p></div></div>
        {loadingDetail ? <div className="py-12 text-center text-sm text-slate-500">Memuat daftar siswa dan nilai...</div> : siswaList.length === 0 ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Belum ada siswa aktif yang ditemukan pada rombel dan tahun ajaran penilaian ini. Periksa Data Siswa dan penempatan rombel.</div> : <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">No.</th><th className="px-4 py-3">Nama Siswa</th><th className="px-4 py-3">Nilai</th><th className="px-4 py-3">Catatan</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{siswaList.map((siswa, index) => { const isian = nilaiMap[siswa.id] || { nilai: '', catatan: '' }; const sudahDinilai = isian.nilai.trim() !== ''; return <tr key={siswa.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3"><p className="font-semibold text-slate-800">{siswa.nama || '-'}</p><p className="text-xs text-slate-400">{siswa.nisn ? `NISN ${siswa.nisn}` : ''}</p></td><td className="px-4 py-3"><input aria-label={`Nilai ${siswa.nama || ''}`} type="number" min="0" max={penilaianTerpilih.nilaiMaksimal || 100} step="0.01" value={isian.nilai} onChange={(event) => ubahIsianNilai(siswa.id, 'nilai', event.target.value)} className="w-28 rounded-lg border border-slate-200 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="0–100" /></td><td className="px-4 py-3"><input aria-label={`Catatan ${siswa.nama || ''}`} value={isian.catatan} onChange={(event) => ubahIsianNilai(siswa.id, 'catatan', event.target.value)} className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Catatan opsional" /></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${sudahDinilai ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{sudahDinilai ? 'Sudah dinilai' : 'Belum dinilai'}</span></td></tr>; })}</tbody></table></div>}
        <div className="no-print mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Nilai dapat diperbarui kembali. Kolom kosong akan menghapus nilai sebelumnya untuk siswa tersebut.</p><button type="button" onClick={() => void simpanSemuaNilai()} disabled={savingNilai || loadingDetail || siswaList.length === 0} className="rounded-xl bg-[#155EEF] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingNilai ? 'Menyimpan nilai...' : 'Simpan Semua Nilai'}</button></div>
        <div className="print-only mt-8 hidden text-right text-sm text-slate-700"><p>Mengetahui,</p><p className="mt-16 font-bold">{userData?.nama || 'Guru'}</p></div>
      </section>}

      {!penilaianTerpilih && <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-800"><b>Catatan penggunaan:</b> Buat satu penilaian untuk setiap kegiatan atau materi. Setelah itu buka tombol <b>Kelola Nilai</b> untuk mengisi nilai masing-masing siswa. Nilai disimpan terpisah dari data induk siswa, absensi, dan jurnal mengajar.</div>}
    </div>
  );
}
