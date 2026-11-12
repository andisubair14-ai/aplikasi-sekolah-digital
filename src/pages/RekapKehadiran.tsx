import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type StatusAbsensi = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';

interface Kelas {
  id: string;
  namaKelas: string;
  jenjang: string;
  tingkat: number | string;
  tahunAjaran: string;
  waliKelasId?: string | null;
}

interface Siswa {
  id: string;
  nama: string;
  nisn: string;
  kelasId?: string;
  tahunAjaran?: string;
  status?: string;
}

interface TahunAjaran {
  id: string;
  tahun: string;
  semester: string;
  status: string;
}

interface GuruProfile {
  id: string;
  nama: string;
  jabatan: string;
  kelasDiampu?: string[];
}

interface AttendanceRecord {
  nisn: string;
  namaSiswa?: string;
  tanggal: string;
  kelasId: string;
  status: StatusAbsensi;
}

interface RekapBaris {
  siswa: Siswa;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  tercatat: number;
  persentase: number;
}

const pad = (value: number) => String(value).padStart(2, '0');

const bulanSekarang = () => {
  const sekarang = new Date();
  return `${sekarang.getFullYear()}-${pad(sekarang.getMonth() + 1)}`;
};

const angkaRomawi = (value: number | string) => {
  const number = Number.parseInt(String(value), 10);
  const map: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX',
  };
  return map[number] || String(value || '-');
};

const siswaMasihAktif = (siswa: Siswa) =>
  !['Lulus', 'Pindah Keluar'].includes(String(siswa.status || 'Aktif'));

const labelBulan = (value: string) => {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const [tahun, bulan] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(tahun, bulan - 1, 1));
};

const csvCell = (value: string | number) => {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

function pesanError(error: unknown) {
  const item = error as { code?: string; message?: string };
  if (item?.code === 'permission-denied') {
    return 'Akses data ditolak oleh Firestore. Pastikan akun Guru ditautkan ke Data Pegawai dan rombel yang dipilih memang menjadi tugasnya.';
  }
  if (item?.code === 'failed-precondition') {
    return 'Firestore memerlukan indeks untuk pencarian rekap ini. Buka tautan pembuatan indeks yang muncul pada Console browser, lalu buat indeks yang diminta.';
  }
  return item?.message || 'Data rekap kehadiran gagal dimuat. Periksa koneksi Firebase.';
}

export default function RekapKehadiran() {
  const { userData } = useAuth();

  const [guruProfile, setGuruProfile] = useState<GuruProfile | null>(null);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaran[]>([]);
  const [jenjangSekolah, setJenjangSekolah] = useState<string[]>([]);
  const [namaSekolah, setNamaSekolah] = useState('Sekolah Digital');
  const [npsnSekolah, setNpsnSekolah] = useState('');

  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [selectedBulan, setSelectedBulan] = useState(bulanSekarang());
  const [pencarian, setPencarian] = useState('');

  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [absensiList, setAbsensiList] = useState<AttendanceRecord[]>([]);
  const [loadingProfil, setLoadingProfil] = useState(true);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [loadingRekap, setLoadingRekap] = useState(false);
  const [errorHalaman, setErrorHalaman] = useState('');

  // Profil Guru terhubung melalui users/{uid}.guruId ke guru/{guruId}.
  useEffect(() => {
    let masihAktif = true;

    if (!userData?.guruId) {
      setGuruProfile(null);
      setErrorHalaman('Akun Guru belum terhubung dengan Data Pegawai. Hubungi Admin untuk menghubungkan akun melalui Manajemen Pengguna.');
      setLoadingProfil(false);
      return () => { masihAktif = false; };
    }

    setLoadingProfil(true);
    getDoc(doc(db, 'guru', userData.guruId))
      .then((snapshot) => {
        if (!masihAktif) return;
        if (!snapshot.exists()) {
          setGuruProfile(null);
          setErrorHalaman('Data Pegawai yang terhubung dengan akun Guru tidak ditemukan.');
        } else {
          setGuruProfile({ id: snapshot.id, ...snapshot.data() } as GuruProfile);
          setErrorHalaman('');
        }
      })
      .catch((error: unknown) => {
        if (!masihAktif) return;
        setGuruProfile(null);
        setErrorHalaman(pesanError(error));
      })
      .finally(() => {
        if (masihAktif) setLoadingProfil(false);
      });

    return () => { masihAktif = false; };
  }, [userData?.guruId]);

  // Data kelas, tahun ajaran aktif, dan konfigurasi jenjang dibaca dari sumber resmi aplikasi.
  useEffect(() => {
    let kelasReady = false;
    let tahunReady = false;
    let pengaturanReady = false;

    const cekSelesai = () => {
      if (kelasReady && tahunReady && pengaturanReady) setLoadingMaster(false);
    };

    const unsubKelas = onSnapshot(
      collection(db, 'kelas'),
      (snapshot) => {
        setKelasList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Kelas[]);
        kelasReady = true;
        cekSelesai();
      },
      (error) => {
        setErrorHalaman(pesanError(error));
        kelasReady = true;
        cekSelesai();
      }
    );

    const unsubTahun = onSnapshot(
      collection(db, 'tahun_ajaran'),
      (snapshot) => {
        setTahunAjaranList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TahunAjaran[]);
        tahunReady = true;
        cekSelesai();
      },
      (error) => {
        setErrorHalaman(pesanError(error));
        tahunReady = true;
        cekSelesai();
      }
    );

    const unsubPengaturan = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setNamaSekolah(data.namaSekolah || 'Sekolah Digital');
        setNpsnSekolah(data.npsn || '');
        const tersedia = Array.isArray(data.jenjangSekolah)
          ? ['SD', 'SMP'].filter((item) => data.jenjangSekolah.includes(item))
          : [];
        setJenjangSekolah(tersedia);
        pengaturanReady = true;
        cekSelesai();
      },
      (error) => {
        setErrorHalaman(pesanError(error));
        pengaturanReady = true;
        cekSelesai();
      }
    );

    return () => {
      unsubKelas();
      unsubTahun();
      unsubPengaturan();
    };
  }, []);

  const tahunAktif = useMemo(
    () => tahunAjaranList.find((item) => item.status === 'Aktif') || null,
    [tahunAjaranList]
  );

  const kelasTersedia = useMemo(() => {
    if (!tahunAktif || jenjangSekolah.length === 0 || !guruProfile) return [];

    const kelasTahunIni = kelasList.filter((item) =>
      item.tahunAjaran === tahunAktif.tahun
      && jenjangSekolah.includes(String(item.jenjang || '').toUpperCase())
    );

    if (guruProfile.jabatan === 'Guru Mata Pelajaran') {
      const idKelas = Array.isArray(guruProfile.kelasDiampu) ? guruProfile.kelasDiampu : [];
      return kelasTahunIni
        .filter((item) => idKelas.includes(item.id))
        .sort((a, b) => (a.namaKelas || '').localeCompare(b.namaKelas || '', 'id', { numeric: true }));
    }

    if (guruProfile.jabatan === 'Wali Kelas') {
      return kelasTahunIni
        .filter((item) => item.waliKelasId === guruProfile.id)
        .sort((a, b) => (a.namaKelas || '').localeCompare(b.namaKelas || '', 'id', { numeric: true }));
    }

    return [];
  }, [kelasList, tahunAktif, jenjangSekolah, guruProfile]);

  const kelasTerpilih = useMemo(
    () => kelasTersedia.find((item) => item.id === selectedKelasId) || kelasTersedia[0] || null,
    [kelasTersedia, selectedKelasId]
  );

  // Baca satu rombel terpilih saja agar query tunduk pada batas akses Guru di Firestore Rules.
  useEffect(() => {
    let masihAktif = true;

    if (loadingProfil || loadingMaster) return () => { masihAktif = false; };

    if (!kelasTerpilih || !/^\d{4}-\d{2}$/.test(selectedBulan)) {
      setSiswaList([]);
      setAbsensiList([]);
      setLoadingRekap(false);
      return () => { masihAktif = false; };
    }

    const [tahun, bulan] = selectedBulan.split('-').map(Number);
    const tanggalMulai = `${selectedBulan}-01`;
    const tanggalAkhir = `${tahun + (bulan === 12 ? 1 : 0)}-${pad(bulan === 12 ? 1 : bulan + 1)}-01`;

    setLoadingRekap(true);
    setErrorHalaman('');

    const siswaQuery = query(
      collection(db, 'siswa_ringkas'),
      where('kelasId', '==', kelasTerpilih.id)
    );
    const absensiQuery = query(
      collection(db, 'absensi'),
      where('kelasId', '==', kelasTerpilih.id),
      where('tanggal', '>=', tanggalMulai),
      where('tanggal', '<', tanggalAkhir)
    );

    Promise.all([getDocs(siswaQuery), getDocs(absensiQuery)])
      .then(([siswaSnapshot, absensiSnapshot]) => {
        if (!masihAktif) return;
        const siswa = siswaSnapshot.docs
          .map((item) => ({ id: item.id, ...item.data() })) as Siswa[];
        setSiswaList(siswa.filter(siswaMasihAktif).sort((a, b) =>
          (a.nama || '').localeCompare(b.nama || '', 'id')
        ));
        setAbsensiList(absensiSnapshot.docs.map((item) => item.data()) as AttendanceRecord[]);
      })
      .catch((error: unknown) => {
        if (!masihAktif) return;
        setSiswaList([]);
        setAbsensiList([]);
        setErrorHalaman(pesanError(error));
      })
      .finally(() => {
        if (masihAktif) setLoadingRekap(false);
      });

    return () => { masihAktif = false; };
  }, [kelasTerpilih?.id, selectedBulan, loadingProfil, loadingMaster]);

  const rekapBaris = useMemo<RekapBaris[]>(() => {
    const absensiPerSiswa = new Map<string, AttendanceRecord[]>();
    absensiList.forEach((item) => {
      const nisn = String(item.nisn || '');
      if (!nisn) return;
      const daftar = absensiPerSiswa.get(nisn) || [];
      daftar.push(item);
      absensiPerSiswa.set(nisn, daftar);
    });

    return siswaList.map((siswa) => {
      const daftar = absensiPerSiswa.get(String(siswa.nisn || '')) || [];
      const hitung = (status: StatusAbsensi) => daftar.filter((item) => item.status === status).length;
      const hadir = hitung('Hadir');
      const sakit = hitung('Sakit');
      const izin = hitung('Izin');
      const alpa = hitung('Alpa');
      const tercatat = hadir + sakit + izin + alpa;
      const persentase = tercatat > 0 ? Math.round((hadir / tercatat) * 1000) / 10 : 0;
      return { siswa, hadir, sakit, izin, alpa, tercatat, persentase };
    });
  }, [siswaList, absensiList]);

  const barisTampil = useMemo(() => {
    const teks = pencarian.trim().toLocaleLowerCase('id');
    if (!teks) return rekapBaris;
    return rekapBaris.filter((item) =>
      String(item.siswa.nama || '').toLocaleLowerCase('id').includes(teks)
      || String(item.siswa.nisn || '').toLocaleLowerCase('id').includes(teks)
    );
  }, [rekapBaris, pencarian]);

  const ringkasan = useMemo(() => rekapBaris.reduce((hasil, item) => ({
    totalSiswa: hasil.totalSiswa + 1,
    hadir: hasil.hadir + item.hadir,
    sakit: hasil.sakit + item.sakit,
    izin: hasil.izin + item.izin,
    alpa: hasil.alpa + item.alpa,
    siswaTercatat: hasil.siswaTercatat + (item.tercatat > 0 ? 1 : 0),
  }), {
    totalSiswa: 0,
    hadir: 0,
    sakit: 0,
    izin: 0,
    alpa: 0,
    siswaTercatat: 0,
  }), [rekapBaris]);

  const unduhCSV = () => {
    if (!kelasTerpilih || rekapBaris.length === 0) return;
    const judul = [
      [csvCell('REKAP KEHADIRAN SISWA')],
      [csvCell(namaSekolah)],
      [csvCell(`NPSN: ${npsnSekolah || '-'}`)],
      [csvCell(`Kelas: ${kelasTerpilih.namaKelas}`)],
      [csvCell(`Tahun Ajaran: ${tahunAktif?.tahun || '-'}`)],
      [csvCell(`Periode: ${labelBulan(selectedBulan)}`)],
      [],
    ];
    const header = ['No', 'Nama Siswa', 'NISN', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Hari Tercatat', 'Persentase Hadir'];
    const data = rekapBaris.map((item, index) => [
      index + 1,
      item.siswa.nama || '-',
      item.siswa.nisn || '-',
      item.hadir,
      item.sakit,
      item.izin,
      item.alpa,
      item.tercatat,
      `${item.persentase.toLocaleString('id-ID')}%`,
    ]);
    const csv = [...judul, header.map(csvCell), ...data.map((row) => row.map(csvCell))]
      .map((row) => row.join(';'))
      .join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rekap-Kehadiran-${kelasTerpilih.namaKelas}-${selectedBulan}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const totalCatatan = ringkasan.hadir + ringkasan.sakit + ringkasan.izin + ringkasan.alpa;
  const persentaseHadir = totalCatatan > 0
    ? Math.round((ringkasan.hadir / totalCatatan) * 1000) / 10
    : 0;

  if (loadingProfil || loadingMaster) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">
        Memuat data kelas dan profil Guru...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Akademik · Kehadiran</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Rekap Kehadiran Siswa</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Ringkasan kehadiran bulanan siswa pada rombel yang menjadi tugas Anda.</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button
            type="button"
            onClick={unduhCSV}
            disabled={!kelasTerpilih || rekapBaris.length === 0 || loadingRekap}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-800 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">↓</span> Unduh CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!kelasTerpilih || rekapBaris.length === 0 || loadingRekap}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">⎙</span> Cetak Rekap
          </button>
        </div>
      </div>

      {errorHalaman && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-bold">Data belum dapat ditampilkan</p>
          <p className="mt-1 break-words">{errorHalaman}</p>
        </div>
      )}

      {!guruProfile && !errorHalaman && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Profil Guru belum tersedia.</div>
      )}

      {guruProfile && kelasTersedia.length === 0 && !errorHalaman && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-bold">Belum ada rombel yang dapat direkap.</p>
          <p className="mt-1">Periksa Tahun Ajaran Aktif, jenjang sekolah, serta penugasan kelas pada Data Pegawai.</p>
        </div>
      )}

      {kelasTerpilih && (
        <>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Pilih Rombel</span>
              <select
                value={kelasTerpilih.id}
                onChange={(event) => setSelectedKelasId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {kelasTersedia.map((kelas) => (
                  <option key={kelas.id} value={kelas.id}>{kelas.namaKelas} — {kelas.jenjang}, Tingkat {angkaRomawi(kelas.tingkat)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Bulan Rekap</span>
              <input
                type="month"
                value={selectedBulan}
                onChange={(event) => setSelectedBulan(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Total Siswa</p>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{ringkasan.totalSiswa}</p>
              <p className="mt-1 text-xs text-slate-400">{ringkasan.siswaTercatat} siswa memiliki catatan</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-xs font-semibold text-emerald-700">Hadir</p>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-800">{ringkasan.hadir}</p>
              <p className="mt-1 text-xs text-emerald-700">{persentaseHadir.toLocaleString('id-ID')}% dari catatan</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
              <p className="text-xs font-semibold text-amber-700">Sakit</p>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-800">{ringkasan.sakit}</p>
              <p className="mt-1 text-xs text-amber-700">Catatan kehadiran</p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
              <p className="text-xs font-semibold text-sky-700">Izin</p>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-sky-800">{ringkasan.izin}</p>
              <p className="mt-1 text-xs text-sky-700">Catatan kehadiran</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
              <p className="text-xs font-semibold text-rose-700">Alpa</p>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-rose-800">{ringkasan.alpa}</p>
              <p className="mt-1 text-xs text-rose-700">Catatan kehadiran</p>
            </div>
          </div>

          <section id="rekap-print-area" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Daftar Rekap Bulanan</h2>
                <p className="mt-1 text-sm text-slate-500">{kelasTerpilih.namaKelas} · {labelBulan(selectedBulan)} · Tahun Ajaran {tahunAktif?.tahun || '-'}</p>
              </div>
              <label className="no-print block w-full sm:max-w-xs">
                <span className="sr-only">Cari nama atau NISN siswa</span>
                <input
                  type="search"
                  value={pencarian}
                  onChange={(event) => setPencarian(event.target.value)}
                  placeholder="Cari nama atau NISN siswa..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="hidden border-b border-slate-200 px-5 py-4 text-center print:block">
              <h2 className="text-xl font-bold">{namaSekolah}</h2>
              <p className="text-sm">REKAP KEHADIRAN SISWA</p>
              <p className="text-sm">{kelasTerpilih.namaKelas} · {labelBulan(selectedBulan)} · Tahun Ajaran {tahunAktif?.tahun || '-'}</p>
              <p className="text-xs">NPSN: {npsnSekolah || '-'}</p>
            </div>

            {loadingRekap ? (
              <div className="p-10 text-center text-sm text-slate-500">Memuat data rekap kehadiran...</div>
            ) : rekapBaris.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500">▤</div>
                <p className="mt-3 font-bold text-slate-800">Belum ada data siswa pada rombel ini</p>
                <p className="mt-1 text-sm text-slate-500">Periksa Data Siswa Ringkas dan penempatan kelas.</p>
              </div>
            ) : barisTampil.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Tidak ada siswa yang cocok dengan pencarian.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[820px] w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-center font-bold">No.</th>
                      <th className="px-4 py-3 font-bold">Nama Siswa</th>
                      <th className="px-3 py-3 text-center font-bold">Hadir</th>
                      <th className="px-3 py-3 text-center font-bold">Sakit</th>
                      <th className="px-3 py-3 text-center font-bold">Izin</th>
                      <th className="px-3 py-3 text-center font-bold">Alpa</th>
                      <th className="px-3 py-3 text-center font-bold">Hari Tercatat</th>
                      <th className="px-4 py-3 text-right font-bold">% Hadir*</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {barisTampil.map((item, index) => (
                      <tr key={item.siswa.id} className="hover:bg-blue-50/40">
                        <td className="px-4 py-3 text-center tabular-nums text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{item.siswa.nama || '-'}</p>
                          <p className="mt-0.5 text-xs text-slate-400">NISN: {item.siswa.nisn || '-'}</p>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold tabular-nums text-emerald-700">{item.hadir}</td>
                        <td className="px-3 py-3 text-center font-semibold tabular-nums text-amber-700">{item.sakit}</td>
                        <td className="px-3 py-3 text-center font-semibold tabular-nums text-sky-700">{item.izin}</td>
                        <td className="px-3 py-3 text-center font-semibold tabular-nums text-rose-700">{item.alpa}</td>
                        <td className="px-3 py-3 text-center tabular-nums text-slate-700">{item.tercatat}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800">{item.persentase.toLocaleString('id-ID')}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs leading-relaxed text-slate-500">
              * Persentase dihitung dari jumlah Hadir dibandingkan seluruh catatan kehadiran yang sudah tersimpan (Hadir, Sakit, Izin, dan Alpa). Hari tanpa catatan tidak otomatis dianggap Alpa.
            </div>
            <div className="hidden px-5 pt-12 print:block">
              <div className="ml-auto w-64 text-center text-sm">
                <p>Mengetahui,</p>
                <p className="font-semibold">Kepala Sekolah</p>
                <div className="h-16" />
                <p className="font-bold underline">( .................................... )</p>
                <p>NIP. ....................................</p>
              </div>
            </div>
          </section>
        </>
      )}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body * { visibility: hidden !important; }
          #rekap-print-area, #rekap-print-area * { visibility: visible !important; }
          #rekap-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          #rekap-print-area table { min-width: 0 !important; width: 100% !important; }
          #rekap-print-area th, #rekap-print-area td { padding: 6px 8px !important; }
          #rekap-print-area tr { break-inside: avoid !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
