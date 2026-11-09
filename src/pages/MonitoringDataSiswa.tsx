import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type SiswaRecord = {
  id: string;
  nama?: string;
  nisn?: string;
  kelas?: string;
  kelasId?: string;
  tahunAjaran?: string;
  semester?: string;
  status?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  agama?: string;
  namaAyah?: string;
  namaIbu?: string;
  pekerjaanOrtu?: string;
  alamat?: string;
  noHp?: string;
};

type KelasRecord = {
  id: string;
  namaKelas?: string;
  jenjang?: string;
  tingkat?: string | number;
  waliKelas?: string;
  tahunAjaran?: string;
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
  kepalaSekolah?: string;
};

type SiswaDenganKelas = {
  siswa: SiswaRecord;
  kelas: KelasRecord | null;
};

const statusSiswa = ['Aktif', 'Lulus', 'Pindah Keluar', 'Tinggal Kelas', 'Mutasi Masuk'];

const nilai = (value?: string | number | null) => String(value ?? '').trim();

const formatTanggal = (value: string) => {
  if (!value) return '-';
  const tanggal = new Date(`${value}T00:00:00`);
  return Number.isNaN(tanggal.getTime())
    ? value
    : tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

function cocokkanKelas(siswa: SiswaRecord, kelasList: KelasRecord[]): KelasRecord | null {
  if (siswa.kelasId) {
    const berdasarkanId = kelasList.find((kelas) => kelas.id === siswa.kelasId);
    if (berdasarkanId) return berdasarkanId;
  }

  const namaKelas = nilai(siswa.kelas);
  const tahun = nilai(siswa.tahunAjaran);
  if (!namaKelas || namaKelas === '-') return null;

  const kandidat = kelasList.filter((kelas) =>
    nilai(kelas.namaKelas) === namaKelas &&
    (!tahun || tahun === '-' || nilai(kelas.tahunAjaran) === tahun)
  );

  return kandidat.length === 1 ? kandidat[0] : null;
}

export default function MonitoringDataSiswa() {
  const { userData } = useAuth();
  const [siswaList, setSiswaList] = useState<SiswaRecord[]>([]);
  const [kelasList, setKelasList] = useState<KelasRecord[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaranRecord[]>([]);
  const [identitasSekolah, setIdentitasSekolah] = useState<IdentitasSekolah>({});
  const [loading, setLoading] = useState(true);
  const [errorData, setErrorData] = useState('');

  const [kataKunci, setKataKunci] = useState('');
  const [filterJenjang, setFilterJenjang] = useState('Semua');
  const [filterTingkat, setFilterTingkat] = useState('Semua');
  const [filterRombel, setFilterRombel] = useState('Semua');
  const [filterTahun, setFilterTahun] = useState('Semua');
  const [filterSemester, setFilterSemester] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [detailSiswa, setDetailSiswa] = useState<SiswaRecord | null>(null);

  useEffect(() => {
    if (userData?.role !== 'kepsek') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorData('');
    let sumberSiap = 0;
    let masihAktif = true;
    const tandaiSiap = () => {
      sumberSiap += 1;
      if (sumberSiap >= 4 && masihAktif) setLoading(false);
    };

    const unsubscribeSiswa = onSnapshot(
      collection(db, 'siswa'),
      (snapshot) => {
        setSiswaList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as SiswaRecord[]);
        tandaiSiap();
      },
      (error) => {
        console.error('Gagal memuat data siswa untuk monitoring:', error);
        setErrorData('Data siswa tidak dapat dibaca. Periksa koneksi dan hak akses Firestore.');
        tandaiSiap();
      }
    );

    const unsubscribeKelas = onSnapshot(
      collection(db, 'kelas'),
      (snapshot) => {
        setKelasList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as KelasRecord[]);
        tandaiSiap();
      },
      (error) => {
        console.error('Gagal memuat data kelas:', error);
        setErrorData('Data rombel tidak dapat dibaca. Periksa hak akses Firestore.');
        tandaiSiap();
      }
    );

    const unsubscribeTahun = onSnapshot(
      query(collection(db, 'tahun_ajaran'), where('status', '==', 'Aktif')),
      (snapshot) => {
        setTahunAjaranList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TahunAjaranRecord[]);
        tandaiSiap();
      },
      (error) => {
        console.error('Gagal memuat tahun ajaran:', error);
        setErrorData('Data tahun ajaran tidak dapat dibaca.');
        tandaiSiap();
      }
    );

    const unsubscribePengaturan = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      (snapshot) => {
        setIdentitasSekolah(snapshot.exists() ? snapshot.data() as IdentitasSekolah : {});
        tandaiSiap();
      },
      (error) => {
        console.error('Gagal memuat identitas sekolah:', error);
        // Identitas sekolah bersifat pelengkap; halaman monitoring tetap dapat dibuka.
        tandaiSiap();
      }
    );

    return () => {
      masihAktif = false;
      unsubscribeSiswa();
      unsubscribeKelas();
      unsubscribeTahun();
      unsubscribePengaturan();
    };
  }, [userData?.uid, userData?.role]);

  const dataDenganKelas = useMemo<SiswaDenganKelas[]>(() => {
    return siswaList.map((siswa) => ({ siswa, kelas: cocokkanKelas(siswa, kelasList) }));
  }, [siswaList, kelasList]);

  const pilihanJenjang = useMemo(() => {
    return Array.from(new Set(kelasList.map((kelas) => nilai(kelas.jenjang).toUpperCase()).filter(Boolean))).sort();
  }, [kelasList]);

  const pilihanTingkat = useMemo(() => {
    return Array.from(new Set(
      kelasList
        .filter((kelas) => filterJenjang === 'Semua' || nilai(kelas.jenjang).toUpperCase() === filterJenjang)
        .map((kelas) => nilai(kelas.tingkat))
        .filter(Boolean)
    )).sort((a, b) => Number(a) - Number(b));
  }, [kelasList, filterJenjang]);

  const pilihanRombel = useMemo(() => {
    return kelasList
      .filter((kelas) => filterJenjang === 'Semua' || nilai(kelas.jenjang).toUpperCase() === filterJenjang)
      .filter((kelas) => filterTingkat === 'Semua' || nilai(kelas.tingkat) === filterTingkat)
      .filter((kelas) => filterTahun === 'Semua' || nilai(kelas.tahunAjaran) === filterTahun)
      .sort((a, b) => nilai(a.namaKelas).localeCompare(nilai(b.namaKelas), 'id', { numeric: true }));
  }, [kelasList, filterJenjang, filterTingkat, filterTahun]);

  const siswaTampil = useMemo(() => {
    const cari = kataKunci.trim().toLowerCase();
    return dataDenganKelas
      .filter(({ siswa, kelas }) => {
        const cocokCari = !cari ||
          nilai(siswa.nama).toLowerCase().includes(cari) ||
          nilai(siswa.nisn).toLowerCase().includes(cari);
        const cocokJenjang = filterJenjang === 'Semua' || nilai(kelas?.jenjang).toUpperCase() === filterJenjang;
        const cocokTingkat = filterTingkat === 'Semua' || nilai(kelas?.tingkat) === filterTingkat;
        const cocokRombel = filterRombel === 'Semua' || kelas?.id === filterRombel;
        const cocokTahun = filterTahun === 'Semua' || nilai(siswa.tahunAjaran) === filterTahun || (!siswa.tahunAjaran && nilai(kelas?.tahunAjaran) === filterTahun);
        const cocokSemester = filterSemester === 'Semua' || nilai(siswa.semester) === filterSemester;
        const cocokStatus = filterStatus === 'Semua' || nilai(siswa.status || 'Aktif') === filterStatus;
        return cocokCari && cocokJenjang && cocokTingkat && cocokRombel && cocokTahun && cocokSemester && cocokStatus;
      })
      .sort((a, b) => {
        const jenjangA = nilai(a.kelas?.jenjang);
        const jenjangB = nilai(b.kelas?.jenjang);
        if (jenjangA !== jenjangB) return jenjangA.localeCompare(jenjangB);
        const tingkatA = Number(a.kelas?.tingkat || 99);
        const tingkatB = Number(b.kelas?.tingkat || 99);
        if (tingkatA !== tingkatB) return tingkatA - tingkatB;
        const rombelA = nilai(a.kelas?.namaKelas || a.siswa.kelas);
        const rombelB = nilai(b.kelas?.namaKelas || b.siswa.kelas);
        const bedaRombel = rombelA.localeCompare(rombelB, 'id', { numeric: true });
        if (bedaRombel !== 0) return bedaRombel;
        return nilai(a.siswa.nama).localeCompare(nilai(b.siswa.nama), 'id');
      });
  }, [dataDenganKelas, kataKunci, filterJenjang, filterTingkat, filterRombel, filterTahun, filterSemester, filterStatus]);

  const ringkasan = useMemo(() => ({
    total: siswaTampil.length,
    aktif: siswaTampil.filter(({ siswa }) => (siswa.status || 'Aktif') === 'Aktif').length,
    lulus: siswaTampil.filter(({ siswa }) => siswa.status === 'Lulus').length,
    lainnya: siswaTampil.filter(({ siswa }) => !['Aktif', 'Lulus'].includes(siswa.status || 'Aktif')).length,
  }), [siswaTampil]);

  const sebaranRombel = useMemo(() => {
    const jumlah = new Map<string, number>();
    siswaTampil.forEach(({ siswa, kelas }) => {
      const label = kelas?.namaKelas || siswa.kelas || 'Rombel belum dipetakan';
      jumlah.set(label, (jumlah.get(label) || 0) + 1);
    });
    return Array.from(jumlah.entries()).sort((a, b) => a[0].localeCompare(b[0], 'id', { numeric: true }));
  }, [siswaTampil]);

  const deskripsiFilter = [
    filterJenjang !== 'Semua' ? `Jenjang ${filterJenjang}` : '',
    filterTingkat !== 'Semua' ? `Tingkat ${filterTingkat}` : '',
    filterRombel !== 'Semua' ? `Rombel ${kelasList.find((kelas) => kelas.id === filterRombel)?.namaKelas || '-'}` : '',
    filterTahun !== 'Semua' ? `Tahun Ajaran ${filterTahun}` : '',
    filterSemester !== 'Semua' ? `Semester ${filterSemester}` : '',
    filterStatus !== 'Semua' ? `Status ${filterStatus}` : '',
    kataKunci.trim() ? `Pencarian: ${kataKunci.trim()}` : '',
  ].filter(Boolean).join(' | ') || 'Seluruh data siswa';

  const resetFilter = () => {
    setKataKunci('');
    setFilterJenjang('Semua');
    setFilterTingkat('Semua');
    setFilterRombel('Semua');
    setFilterTahun('Semua');
    setFilterSemester('Semua');
    setFilterStatus('Semua');
  };

  if (userData?.role !== 'kepsek') {
    return <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center text-amber-800">Halaman ini hanya tersedia untuk Kepala Sekolah.</div>;
  }

  if (loading) {
    return <div className="p-10 text-center font-semibold text-slate-500">Memuat data siswa sekolah...</div>;
  }

  if (errorData) {
    return <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">{errorData}</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <style>{`
        @media screen and (max-width: 767px) {
          .monitoring-siswa-mobile-list { display: block !important; }
          .monitoring-siswa-desktop-table { display: none !important; }
        }
        @media screen and (min-width: 768px) {
          .monitoring-siswa-mobile-list { display: none !important; }
          .monitoring-siswa-desktop-table { display: block !important; }
        }
        @media print {
          @page { size: A4 landscape; margin: 12mm 14mm; }
          body * { visibility: hidden !important; }
          #monitoring-siswa-print, #monitoring-siswa-print * { visibility: visible !important; }
          html, body, #root, #root > div, main, .overflow-y-auto, .overflow-hidden {
            height: auto !important; max-height: none !important; overflow: visible !important;
          }
          #monitoring-siswa-print {
            display: block !important; position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 0 !important; background: white !important;
          }
          .monitoring-siswa-screen { display: none !important; }
          #monitoring-siswa-print table { width: 100%; border-collapse: collapse; font-size: 9pt; }
          #monitoring-siswa-print thead { display: table-header-group; }
          #monitoring-siswa-print tr { break-inside: avoid; page-break-inside: avoid; }
          #monitoring-siswa-print th, #monitoring-siswa-print td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: left; }
          #monitoring-siswa-print th { background: #eaf0f8 !important; color: #0b2a56 !important; }
          #monitoring-siswa-print .print-signature { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="monitoring-siswa-screen space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#082B62]">Monitoring Data Siswa</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Pemantauan data siswa seluruh jenjang, kelas, dan rombongan belajar.</p>
          </div>
          <button onClick={() => window.print()} className="rounded-xl bg-[#155EEF] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Cetak Rekap</button>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Halaman ini bersifat baca-saja. Kepala Sekolah dapat memantau data siswa dan mencetak rekap, tetapi tidak dapat menambah, mengedit, atau menghapus data.
        </div>

        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
          <div className="min-w-[148px] shrink-0 snap-start rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:min-w-0 sm:p-5"><p className="text-xs font-semibold text-slate-500 sm:text-sm">Siswa sesuai filter</p><p className="mt-2 text-3xl font-extrabold text-[#082B62]">{ringkasan.total}</p></div>
          <div className="min-w-[148px] shrink-0 snap-start rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:min-w-0 sm:p-5"><p className="text-xs font-semibold text-slate-500 sm:text-sm">Siswa Aktif</p><p className="mt-2 text-3xl font-extrabold text-emerald-600">{ringkasan.aktif}</p></div>
          <div className="min-w-[148px] shrink-0 snap-start rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:min-w-0 sm:p-5"><p className="text-xs font-semibold text-slate-500 sm:text-sm">Lulus</p><p className="mt-2 text-3xl font-extrabold text-blue-600">{ringkasan.lulus}</p></div>
          <div className="min-w-[148px] shrink-0 snap-start rounded-2xl border border-amber-100 bg-white p-4 shadow-sm sm:min-w-0 sm:p-5"><p className="text-xs font-semibold text-slate-500 sm:text-sm">Status lainnya</p><p className="mt-2 text-3xl font-extrabold text-amber-600">{ringkasan.lainnya}</p></div>
        </div>

        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><h2 className="font-bold text-[#082B62]">Filter Data Siswa</h2><p className="text-xs text-slate-500">Gunakan filter untuk melihat kelompok data tertentu.</p></div>
            <button onClick={resetFilter} className="min-h-9 shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Reset Filter</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
            <input value={kataKunci} onChange={(e) => setKataKunci(e.target.value)} placeholder="Cari nama siswa atau NISN..." className="col-span-2 min-h-10 min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-1 sm:text-sm" />
            <select value={filterJenjang} onChange={(e) => { setFilterJenjang(e.target.value); setFilterTingkat('Semua'); setFilterRombel('Semua'); }} className="min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:px-3 sm:text-sm"><option value="Semua">Semua Jenjang</option>{pilihanJenjang.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select value={filterTingkat} onChange={(e) => { setFilterTingkat(e.target.value); setFilterRombel('Semua'); }} className="min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:px-3 sm:text-sm"><option value="Semua">Semua Tingkat</option>{pilihanTingkat.map((item) => <option key={item} value={item}>Tingkat {item}</option>)}</select>
            <select value={filterRombel} onChange={(e) => setFilterRombel(e.target.value)} className="min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:px-3 sm:text-sm"><option value="Semua">Semua Rombel</option>{pilihanRombel.map((item) => <option key={item.id} value={item.id}>{item.namaKelas || '-'} — {item.jenjang || ''}</option>)}</select>
            <select value={filterTahun} onChange={(e) => { setFilterTahun(e.target.value); setFilterRombel('Semua'); }} className="min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:px-3 sm:text-sm"><option value="Semua">Semua Tahun Ajaran</option>{Array.from(new Set(tahunAjaranList.map((item) => nilai(item.tahun)).filter(Boolean))).sort().map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} className="min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:px-3 sm:text-sm"><option value="Semua">Semua Semester</option>{Array.from(new Set(tahunAjaranList.map((item) => nilai(item.semester)).filter(Boolean))).map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:px-3 sm:text-sm"><option value="Semua">Semua Status</option>{statusSiswa.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-[#082B62] via-[#12458B] to-[#1D64C8] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-lg">▦</span>
                <div>
                  <h2 className="font-bold tracking-wide">Sebaran Siswa per Rombel</h2>
                  <p className="mt-0.5 text-xs text-blue-100">Komposisi jumlah siswa pada setiap rombongan belajar</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 sm:text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-blue-100">Total dalam tampilan</p>
              <p className="text-2xl font-extrabold tabular-nums">{ringkasan.total} <span className="text-xs font-semibold text-blue-100">siswa</span></p>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            {sebaranRombel.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Belum ada data untuk ditampilkan.</div>
            ) : (
              <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3">
                {sebaranRombel.map(([rombel, jumlah], index) => {
                  const persentase = ringkasan.total > 0 ? Math.round((jumlah / ringkasan.total) * 100) : 0;
                  const lebar = Math.max(persentase, jumlah > 0 ? 3 : 0);
                  return (
                    <div key={rombel} className="group min-w-[205px] max-w-[235px] shrink-0 snap-start rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:min-w-0 sm:max-w-none sm:shrink">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-[#155EEF] ring-1 ring-blue-100">{String(index + 1).padStart(2, '0')}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">{rombel}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">Rombongan belajar</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-2xl font-extrabold leading-none text-[#082B62] tabular-nums">{jumlah}</p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Siswa</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-500">Proporsi siswa</span>
                          <span className="font-bold text-blue-700 tabular-nums">{persentase}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500" style={{ width: `${lebar}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">Jumlah dan persentase mengikuti filter data siswa yang sedang dipilih.</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <h2 className="text-sm font-bold text-[#082B62] sm:text-base">Daftar Siswa</h2>
            <span className="text-[10px] text-slate-500 sm:text-xs">Menampilkan {siswaTampil.length} dari {siswaList.length} siswa</span>
          </div>

          {/* Daftar ringkas khusus HP: tombol detail selalu terlihat di sisi kanan. */}
          <div className="monitoring-siswa-mobile-list divide-y divide-slate-100 md:hidden">
            {siswaTampil.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Tidak ada data siswa yang sesuai dengan filter.
              </div>
            ) : (
              siswaTampil.map(({ siswa, kelas }, index) => {
                const statusSiswaSaatIni = siswa.status || 'Aktif';
                const warnaStatus = statusSiswaSaatIni === 'Aktif'
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                  : statusSiswaSaatIni === 'Lulus'
                    ? 'bg-blue-50 text-blue-700 ring-blue-100'
                    : 'bg-amber-50 text-amber-700 ring-amber-100';

                return (
                  <article key={siswa.id} className="flex items-center gap-2 px-2.5 py-2">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-700">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-[12px] font-bold leading-tight text-[#082B62]">
                          {siswa.nama || '-'}
                        </p>
                        <p className="mt-0.5 break-words text-[10px] leading-tight text-slate-500">
                          NISN: {siswa.nisn || '-'}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-tight text-slate-600">
                          <span className="font-semibold">{kelas?.namaKelas || siswa.kelas || 'Rombel belum dipetakan'}</span>
                          <span className="text-slate-300">•</span>
                          <span>{kelas ? `${kelas.jenjang || '-'} / ${kelas.tingkat || '-'}` : 'Jenjang belum tersedia'}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-tight ring-1 ring-inset ${warnaStatus}`}>
                            {statusSiswaSaatIni}
                          </span>
                          <span className="text-[9px] leading-tight text-slate-400">
                            {siswa.tahunAjaran || kelas?.tahunAjaran || '-'} · {siswa.semester || '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDetailSiswa(siswa)}
                      className="inline-flex h-8 w-[62px] shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-1.5 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100 active:bg-blue-200"
                      aria-label={`Lihat detail ${siswa.nama || 'siswa'}`}
                    >
                      Detail
                    </button>
                  </article>
                );
              })
            )}
          </div>

          {/* Tabel asli dipertahankan utuh untuk iPad dan laptop. */}
          <div className="monitoring-siswa-desktop-table hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <th className="p-3">No</th>
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">NISN</th>
                  <th className="p-3">Jenjang / Tingkat</th>
                  <th className="p-3">Rombel</th>
                  <th className="p-3">Tahun / Semester</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {siswaTampil.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">Tidak ada data siswa yang sesuai dengan filter.</td></tr>
                ) : siswaTampil.map(({ siswa, kelas }, index) => (
                  <tr key={siswa.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-slate-500">{index + 1}</td>
                    <td className="p-3 font-bold text-[#082B62]">{siswa.nama || '-'}</td>
                    <td className="p-3 text-slate-600">{siswa.nisn || '-'}</td>
                    <td className="p-3 text-slate-600">{kelas ? `${kelas.jenjang || '-'} / ${kelas.tingkat || '-'}` : '-'}</td>
                    <td className="p-3 text-slate-700">{kelas?.namaKelas || siswa.kelas || '-'}</td>
                    <td className="p-3 text-slate-600">{siswa.tahunAjaran || kelas?.tahunAjaran || '-'}<span className="block text-xs text-slate-400">{siswa.semester || '-'}</span></td>
                    <td className="p-3"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${((siswa.status || 'Aktif') === 'Aktif') ? 'bg-emerald-100 text-emerald-700' : (siswa.status === 'Lulus' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700')}`}>{siswa.status || 'Aktif'}</span></td>
                    <td className="p-3"><button onClick={() => setDetailSiswa(siswa)} className="font-bold text-blue-700 hover:text-blue-900">Lihat Detail</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {detailSiswa && (
          <div className="monitoring-siswa-screen fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setDetailSiswa(null)}>
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4"><div><h2 className="text-xl font-bold text-[#082B62]">Detail Siswa</h2><p className="mt-1 text-sm text-slate-500">Informasi siswa untuk keperluan monitoring.</p></div><button onClick={() => setDetailSiswa(null)} className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100">Tutup</button></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  ['Nama Lengkap', detailSiswa.nama], ['NISN', detailSiswa.nisn], ['Tempat Lahir', detailSiswa.tempatLahir], ['Tanggal Lahir', detailSiswa.tanggalLahir ? formatTanggal(detailSiswa.tanggalLahir) : '-'], ['Agama', detailSiswa.agama], ['Kelas / Rombel', detailSiswa.kelas], ['Tahun Ajaran', detailSiswa.tahunAjaran], ['Semester', detailSiswa.semester], ['Status', detailSiswa.status || 'Aktif'], ['Nama Ayah', detailSiswa.namaAyah], ['Nama Ibu', detailSiswa.namaIbu], ['Pekerjaan Orang Tua', detailSiswa.pekerjaanOrtu], ['Nomor HP', detailSiswa.noHp], ['Alamat', detailSiswa.alamat]
                ].map(([label, isi]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-800">{isi || '-'}</p></div>)}
              </div>
              <p className="mt-4 text-xs text-slate-400">Data pribadi siswa hanya ditampilkan untuk kebutuhan monitoring Kepala Sekolah.</p>
            </div>
          </div>
        )}
      </div>

      <div id="monitoring-siswa-print" className="hidden bg-white text-slate-900">
        <header className="mb-5 border-b-2 border-slate-800 pb-3 text-center">
          <h1 className="text-xl font-bold uppercase">{identitasSekolah.namaSekolah || 'NAMA SEKOLAH'}</h1>
          {identitasSekolah.npsn && <p className="mt-1 text-sm">NPSN: {identitasSekolah.npsn}</p>}
          {identitasSekolah.alamat && <p className="mt-1 text-sm">{identitasSekolah.alamat}</p>}
          <h2 className="mt-4 text-base font-bold underline">REKAP MONITORING DATA SISWA</h2>
          <p className="mt-1 text-xs">Filter: {deskripsiFilter}</p>
          <p className="mt-1 text-xs">Tanggal cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <div className="mb-3 flex justify-between text-sm"><span><strong>Jumlah siswa:</strong> {siswaTampil.length}</span><span><strong>Aktif:</strong> {ringkasan.aktif} | <strong>Lulus:</strong> {ringkasan.lulus} | <strong>Status lainnya:</strong> {ringkasan.lainnya}</span></div>
        <table className="w-full border-collapse text-xs">
          <thead><tr><th>No</th><th>Nama Siswa</th><th>NISN</th><th>Jenjang</th><th>Tingkat</th><th>Rombel</th><th>Tahun Ajaran</th><th>Semester</th><th>Status</th></tr></thead>
          <tbody>{siswaTampil.map(({ siswa, kelas }, index) => <tr key={siswa.id}><td>{index + 1}</td><td>{siswa.nama || '-'}</td><td>{siswa.nisn || '-'}</td><td>{kelas?.jenjang || '-'}</td><td>{kelas?.tingkat || '-'}</td><td>{kelas?.namaKelas || siswa.kelas || '-'}</td><td>{siswa.tahunAjaran || kelas?.tahunAjaran || '-'}</td><td>{siswa.semester || '-'}</td><td>{siswa.status || 'Aktif'}</td></tr>)}</tbody>
        </table>
        <div className="print-signature mt-12 flex justify-end">
          <div className="w-64 text-center text-sm"><p>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p><p className="mt-1">Mengetahui,</p><p>Kepala Sekolah</p><div className="h-16"/><p className="font-bold underline">{identitasSekolah.kepalaSekolah || '........................................'}</p><p>NIP. ........................................</p></div>
        </div>
      </div>
    </div>
  );
}
