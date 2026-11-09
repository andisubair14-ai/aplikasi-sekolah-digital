import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type RombelRecord = {
  id: string;
  namaKelas?: string;
  jenjang?: string;
  tingkat?: number | string;
  waliKelas?: string | null;
  waliKelasId?: string | null;
  tahunAjaran?: string;
  urutanRombel?: number;
};

type GuruRecord = {
  id: string;
  nama?: string;
  jabatan?: string;
};

type TahunAjaranRecord = {
  id: string;
  tahun?: string;
  semester?: string;
  status?: string;
};

type RombelDenganWali = RombelRecord & {
  namaWali: string;
  waliTerisi: boolean;
};

const teks = (value: unknown) => String(value ?? '').trim();

const tingkatAngka = (value: unknown): number => {
  const raw = teks(value).toUpperCase().replace(/^TINGKAT\s*/, '');
  const romawi: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6,
    VII: 7, VIII: 8, IX: 9
  };
  return romawi[raw] ?? (Number.parseInt(raw, 10) || 0);
};

const tingkatRomawi = (value: unknown): string => {
  const angka = tingkatAngka(value);
  const romawi: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX'
  };
  return romawi[angka] || teks(value) || '-';
};

export default function MonitoringDataRombel() {
  const { userData } = useAuth();
  const [rombelList, setRombelList] = useState<RombelRecord[]>([]);
  const [guruList, setGuruList] = useState<GuruRecord[]>([]);
  const [tahunList, setTahunList] = useState<TahunAjaranRecord[]>([]);
  const [jenjangSekolah, setJenjangSekolah] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorData, setErrorData] = useState('');

  const [kataKunci, setKataKunci] = useState('');
  const [filterTahun, setFilterTahun] = useState('Aktif');
  const [filterJenjang, setFilterJenjang] = useState('Semua');
  const [filterTingkat, setFilterTingkat] = useState('Semua');
  const [filterWali, setFilterWali] = useState('Semua');
  const [detailRombel, setDetailRombel] = useState<RombelDenganWali | null>(null);

  useEffect(() => {
    if (userData?.role !== 'kepsek') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorData('');
    const siap: Record<string, boolean> = {
      rombel: false,
      guru: false,
      tahun: false,
      pengaturan: false
    };
    let masihAktif = true;

    const tandaiSiap = (key: string) => {
      siap[key] = true;
      if (masihAktif && Object.values(siap).every(Boolean)) setLoading(false);
    };

    const tanganiError = (label: string, key: string) => (error: Error) => {
      console.error(`Gagal memuat ${label} untuk monitoring rombel:`, error);
      if (masihAktif) {
        setErrorData((sebelumnya) => sebelumnya || `Data ${label} tidak dapat dimuat. Periksa koneksi dan hak akses Firestore.`);
        tandaiSiap(key);
      }
    };

    const berhenti = [
      onSnapshot(
        collection(db, 'kelas'),
        (snapshot) => {
          if (!masihAktif) return;
          setRombelList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RombelRecord[]);
          tandaiSiap('rombel');
        },
        tanganiError('rombel', 'rombel')
      ),
      onSnapshot(
        collection(db, 'guru'),
        (snapshot) => {
          if (!masihAktif) return;
          setGuruList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as GuruRecord[]);
          tandaiSiap('guru');
        },
        tanganiError('data guru', 'guru')
      ),
      onSnapshot(
        query(collection(db, 'tahun_ajaran'), where('status', '==', 'Aktif')),
        (snapshot) => {
          if (!masihAktif) return;
          setTahunList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as TahunAjaranRecord[]);
          tandaiSiap('tahun');
        },
        tanganiError('tahun ajaran', 'tahun')
      ),
      onSnapshot(
        doc(db, 'pengaturan', 'sekolah'),
        (snapshot) => {
          if (!masihAktif) return;
          const data = snapshot.exists() ? snapshot.data() : {};
          const daftar = Array.isArray(data.jenjangSekolah)
            ? ['SD', 'SMP'].filter((item) => data.jenjangSekolah.includes(item))
            : [];
          setJenjangSekolah(daftar);
          tandaiSiap('pengaturan');
        },
        tanganiError('pengaturan sekolah', 'pengaturan')
      )
    ];

    return () => {
      masihAktif = false;
      berhenti.forEach((unsubscribe) => unsubscribe());
    };
  }, [userData?.uid, userData?.role]);

  const tahunAktif = tahunList.find((item) => item.status === 'Aktif')?.tahun || '';

  const rombelDenganWali = useMemo<RombelDenganWali[]>(() => {
    const guruById = new Map(guruList.map((guru) => [guru.id, teks(guru.nama)]));
    return rombelList.map((rombel) => {
      const waliDariId = rombel.waliKelasId ? guruById.get(rombel.waliKelasId) : '';
      const waliLegacy = teks(rombel.waliKelas);
      const namaWali = waliDariId || (waliLegacy && waliLegacy !== '-' ? waliLegacy : 'Belum ditentukan');
      return {
        ...rombel,
        jenjang: teks(rombel.jenjang).toUpperCase(),
        namaWali,
        waliTerisi: Boolean(waliDariId || (waliLegacy && waliLegacy !== '-'))
      };
    });
  }, [rombelList, guruList]);

  const pilihanJenjang = useMemo(() => {
    const sumber = rombelDenganWali
      .map((item) => teks(item.jenjang).toUpperCase())
      .filter((item) => item && (jenjangSekolah.length === 0 || jenjangSekolah.includes(item)));
    return Array.from(new Set(sumber)).sort();
  }, [rombelDenganWali, jenjangSekolah]);

  const pilihanTingkat = useMemo(() => {
    return Array.from(new Set(
      rombelDenganWali
        .filter((item) => filterJenjang === 'Semua' || item.jenjang === filterJenjang)
        .map((item) => tingkatAngka(item.tingkat))
        .filter((item) => item > 0)
    )).sort((a, b) => a - b);
  }, [rombelDenganWali, filterJenjang]);

  const rombelTampil = useMemo(() => {
    const cari = kataKunci.trim().toLocaleLowerCase('id-ID');
    return rombelDenganWali
      .filter((item) => {
        const cocokJenjang = filterJenjang === 'Semua' || item.jenjang === filterJenjang;
        const cocokTingkat = filterTingkat === 'Semua' || tingkatAngka(item.tingkat) === Number(filterTingkat);
        const cocokWali = filterWali === 'Semua' || (filterWali === 'Terisi' ? item.waliTerisi : !item.waliTerisi);
        const cocokTahun = filterTahun === 'Semua'
          || (filterTahun === 'Aktif' ? (!tahunAktif || teks(item.tahunAjaran) === tahunAktif) : teks(item.tahunAjaran) === filterTahun);
        const cocokCari = !cari || [item.namaKelas, item.namaWali, item.tahunAjaran, item.jenjang, item.tingkat]
          .some((nilai) => teks(nilai).toLocaleLowerCase('id-ID').includes(cari));
        return cocokJenjang && cocokTingkat && cocokWali && cocokTahun && cocokCari;
      })
      .sort((a, b) => {
        const tahun = teks(b.tahunAjaran).localeCompare(teks(a.tahunAjaran));
        if (tahun !== 0) return tahun;
        const jenjang = teks(a.jenjang).localeCompare(teks(b.jenjang));
        if (jenjang !== 0) return jenjang;
        const tingkat = tingkatAngka(a.tingkat) - tingkatAngka(b.tingkat);
        if (tingkat !== 0) return tingkat;
        return teks(a.namaKelas).localeCompare(teks(b.namaKelas), 'id', { numeric: true });
      });
  }, [rombelDenganWali, kataKunci, filterTahun, filterJenjang, filterTingkat, filterWali, tahunAktif]);

  const ringkasan = useMemo(() => ({
    total: rombelTampil.length,
    waliTerisi: rombelTampil.filter((item) => item.waliTerisi).length,
    waliKosong: rombelTampil.filter((item) => !item.waliTerisi).length,
    sd: rombelTampil.filter((item) => item.jenjang === 'SD').length,
    smp: rombelTampil.filter((item) => item.jenjang === 'SMP').length
  }), [rombelTampil]);

  const resetFilter = () => {
    setKataKunci('');
    setFilterTahun('Aktif');
    setFilterJenjang('Semua');
    setFilterTingkat('Semua');
    setFilterWali('Semua');
  };

  if (userData?.role !== 'kepsek') {
    return <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center text-amber-800">Halaman ini hanya tersedia untuk Kepala Sekolah.</div>;
  }

  if (loading) {
    return <div className="p-10 text-center font-semibold text-slate-500">Memuat data rombongan belajar...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">Monitoring Data Rombel</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Pemantauan rombongan belajar, jenjang, tingkat, tahun ajaran, dan wali kelas.</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
          Tahun Ajaran Aktif: {tahunAktif || 'Belum ditentukan'}
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800 sm:text-sm">
        Halaman ini bersifat baca-saja. Kepala Sekolah dapat memantau data rombel dan penugasan wali kelas, sedangkan perubahan data dilakukan melalui menu Data Kelas & Rombel oleh Admin.
      </div>

      {errorData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:text-sm">{errorData} Sebagian informasi mungkin belum tampil.</div>
      )}

      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
        <div className="min-w-[142px] shrink-0 snap-start rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:min-w-0 sm:p-4">
          <p className="text-[11px] font-semibold text-slate-500 sm:text-xs">Total Rombel</p>
          <p className="mt-1 text-2xl font-extrabold text-[#082B62] sm:text-3xl">{ringkasan.total}</p>
        </div>
        <div className="min-w-[142px] shrink-0 snap-start rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm sm:min-w-0 sm:p-4">
          <p className="text-[11px] font-semibold text-slate-500 sm:text-xs">Wali Kelas Terisi</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600 sm:text-3xl">{ringkasan.waliTerisi}</p>
        </div>
        <div className="min-w-[142px] shrink-0 snap-start rounded-2xl border border-amber-100 bg-white p-3 shadow-sm sm:min-w-0 sm:p-4">
          <p className="text-[11px] font-semibold text-slate-500 sm:text-xs">Belum Ada Wali</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600 sm:text-3xl">{ringkasan.waliKosong}</p>
        </div>
        <div className="min-w-[142px] shrink-0 snap-start rounded-2xl border border-blue-100 bg-white p-3 shadow-sm sm:min-w-0 sm:p-4">
          <p className="text-[11px] font-semibold text-slate-500 sm:text-xs">SD / SMP</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-700 sm:text-3xl">{ringkasan.sd} / {ringkasan.smp}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#082B62] sm:text-base">Filter Data Rombel</h2>
            <p className="text-[11px] text-slate-500 sm:text-xs">Pilih kelompok data yang ingin dipantau.</p>
          </div>
          <button onClick={resetFilter} className="min-h-9 shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 sm:text-xs">Reset</button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-5">
          <input
            value={kataKunci}
            onChange={(event) => setKataKunci(event.target.value)}
            placeholder="Cari rombel atau wali kelas..."
            className="col-span-2 min-h-10 min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-2 sm:text-sm xl:col-span-1"
          />
          <select value={filterTahun} onChange={(event) => setFilterTahun(event.target.value)} className="min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs sm:px-3 sm:text-sm">
            <option value="Aktif">Tahun Aktif {tahunAktif ? `(${tahunAktif})` : ''}</option>
            <option value="Semua">Semua Tahun</option>
            {tahunList.filter((item) => teks(item.tahun) && teks(item.tahun) !== tahunAktif).map((item) => <option key={item.id} value={item.tahun}>{item.tahun}</option>)}
          </select>
          <select value={filterJenjang} onChange={(event) => { setFilterJenjang(event.target.value); setFilterTingkat('Semua'); }} className="min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs sm:px-3 sm:text-sm">
            <option value="Semua">Semua Jenjang</option>
            {pilihanJenjang.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={filterTingkat} onChange={(event) => setFilterTingkat(event.target.value)} className="min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs sm:px-3 sm:text-sm">
            <option value="Semua">Semua Tingkat</option>
            {pilihanTingkat.map((item) => <option key={item} value={String(item)}>Tingkat {tingkatRomawi(item)}</option>)}
          </select>
          <select value={filterWali} onChange={(event) => setFilterWali(event.target.value)} className="col-span-2 min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs sm:col-span-2 sm:text-sm xl:col-span-1">
            <option value="Semua">Semua Status Wali</option>
            <option value="Terisi">Wali Kelas Terisi</option>
            <option value="Kosong">Belum Ada Wali</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div>
            <h2 className="text-sm font-bold text-[#082B62] sm:text-base">Daftar Rombongan Belajar</h2>
            <p className="text-[11px] text-slate-500 sm:text-xs">Menampilkan {rombelTampil.length} dari {rombelList.length} rombel.</p>
          </div>
          <span className="text-[11px] font-medium text-slate-500 sm:text-xs">{filterTahun === 'Aktif' ? `Tahun aktif ${tahunAktif || '(belum ditentukan)'}` : filterTahun === 'Semua' ? 'Seluruh tahun ajaran' : filterTahun}</span>
        </div>

        {/* Tampilan HP: baris ringkas dengan tombol detail tetap terlihat di kanan. */}
        <div className="space-y-2 p-2 md:hidden">
          {rombelTampil.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-xs text-slate-500">Tidak ada rombel yang sesuai dengan filter.</div>
          ) : rombelTampil.map((rombel, index) => (
            <div key={rombel.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-white px-2.5 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[10px] font-extrabold text-blue-700">{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-xs font-extrabold text-[#082B62]">{rombel.namaKelas || '-'}</p>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${rombel.jenjang === 'SD' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>{rombel.jenjang || '-'}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">Tingkat {tingkatRomawi(rombel.tingkat)} · {rombel.tahunAjaran || '-'}</p>
                <p className="truncate text-[10px] text-slate-600">Wali: {rombel.namaWali}</p>
              </div>
              <button onClick={() => setDetailRombel(rombel)} className="min-h-8 w-[66px] shrink-0 rounded-lg bg-blue-50 px-2 text-[10px] font-bold text-blue-700 hover:bg-blue-100">Detail</button>
            </div>
          ))}
        </div>

        {/* Tampilan tablet/laptop: tabel penuh seperti pola halaman monitoring lainnya. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                <th className="p-3">No</th>
                <th className="p-3">Tahun Ajaran</th>
                <th className="p-3">Jenjang</th>
                <th className="p-3">Tingkat</th>
                <th className="p-3">Nama Rombel</th>
                <th className="p-3">Wali Kelas</th>
                <th className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rombelTampil.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">Tidak ada rombel yang sesuai dengan filter.</td></tr>
              ) : rombelTampil.map((rombel, index) => (
                <tr key={rombel.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 text-slate-500">{index + 1}</td>
                  <td className="p-3 text-slate-600">{rombel.tahunAjaran || '-'}</td>
                  <td className="p-3"><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${rombel.jenjang === 'SD' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{rombel.jenjang || '-'}</span></td>
                  <td className="p-3 text-slate-600">{tingkatRomawi(rombel.tingkat)}</td>
                  <td className="p-3 font-bold text-[#082B62]">{rombel.namaKelas || '-'}</td>
                  <td className="p-3 text-slate-600">{rombel.namaWali}</td>
                  <td className="p-3"><button onClick={() => setDetailRombel(rombel)} className="font-bold text-blue-700 hover:text-blue-900">Lihat Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detailRombel && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-3 sm:p-4" onClick={() => setDetailRombel(null)}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#082B62] sm:text-xl">Detail Rombel</h2>
                <p className="mt-0.5 text-xs text-slate-500">Informasi rombongan belajar untuk monitoring.</p>
              </div>
              <button onClick={() => setDetailRombel(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">Tutup</button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              {[
                ['Nama Rombel', detailRombel.namaKelas || '-'],
                ['Jenjang', detailRombel.jenjang || '-'],
                ['Tingkat', tingkatRomawi(detailRombel.tingkat)],
                ['Tahun Ajaran', detailRombel.tahunAjaran || '-'],
                ['Wali Kelas', detailRombel.namaWali],
                ['Urutan Rombel', detailRombel.urutanRombel ? String(detailRombel.urutanRombel) : '-']
              ].map(([label, isi]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-800">{isi}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-slate-400">Halaman ini hanya menampilkan data. Perubahan rombel dan penugasan wali kelas dilakukan melalui menu Data Kelas & Rombel oleh Admin.</p>
          </div>
        </div>
      )}
    </div>
  );
}
