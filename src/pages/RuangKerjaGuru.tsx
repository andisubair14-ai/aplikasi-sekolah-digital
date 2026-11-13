
import { Link } from 'react-router-dom';

const fiturGuru = [
  {
    nomor: '01',
    judul: 'Modul Ajar',
    deskripsi: 'Susun, kembangkan, simpan, dan cetak modul ajar dengan bantuan AI.',
    ikon: '📘',
    warna: 'from-blue-500 to-blue-700',
    path: 'modul-ajar',
  },
  {
    nomor: '02',
    judul: 'Media Ajar',
    deskripsi: 'Kelola media dan bahan pendukung kegiatan pembelajaran.',
    ikon: '🎨',
    warna: 'from-violet-500 to-violet-700',
    path: 'media-ajar',
  },
  {
    nomor: '03',
    judul: 'Perangkat Pembelajaran',
    deskripsi: 'Kelola perangkat dan dokumen perencanaan pembelajaran.',
    ikon: '📂',
    warna: 'from-emerald-500 to-emerald-700',
    path: 'perangkat-pembelajaran',
  },
  {
    nomor: '04',
    judul: 'Asesmen dan Evaluasi',
    deskripsi: 'Kelola asesmen, evaluasi, dan hasil pembelajaran siswa.',
    ikon: '📝',
    warna: 'from-orange-500 to-orange-700',
    path: 'asesmen-evaluasi',
  },
  {
    nomor: '05',
    judul: 'Bank Soal dan Materi',
    deskripsi: 'Simpan dan kelola kumpulan soal serta materi pembelajaran.',
    ikon: '📚',
    warna: 'from-cyan-500 to-cyan-700',
    path: 'bank-soal',
  },
  {
    nomor: '06',
    judul: 'Jurnal dan Refleksi Guru',
    deskripsi: 'Catat kegiatan pembelajaran dan refleksi kegiatan mengajar.',
    ikon: '📓',
    warna: 'from-rose-500 to-rose-700',
    path: 'jurnal-refleksi',
  },
];

export default function RuangKerjaGuru() {
  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-10">

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#082B62] via-[#12458A] to-[#155EEF] p-6 sm:p-9 text-white shadow-lg">
        <div className="absolute -right-12 -top-16 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute right-20 -bottom-24 w-48 h-48 rounded-full bg-white/10" />

        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-blue-100 text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            RUANG KERJA GURU
          </span>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-4">
            Selamat Datang di Ruang Kerja Guru
          </h1>

          <p className="text-blue-100 text-sm sm:text-base mt-3 leading-relaxed">
            Satu ruang untuk membantu Bapak/Ibu Guru merencanakan,
            melaksanakan, mengevaluasi, dan merefleksikan pembelajaran.
          </p>
        </div>
      </div>

      {/* Judul fitur */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          Fitur Pembelajaran
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Pilih fitur yang ingin Bapak/Ibu gunakan.
        </p>
      </div>

      {/* Daftar fitur */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {fiturGuru.map((fitur) => (
          <Link
            key={fitur.path}
            to={`/guru/ruang-kerja-guru/${fitur.path}`}
            className="group bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${fitur.warna} flex items-center justify-center text-2xl shadow-md`}>
                {fitur.ikon}
              </div>

              <span className="text-xs font-bold text-slate-300">
                {fitur.nomor}
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mt-5 group-hover:text-[#155EEF] transition-colors">
              {fitur.judul}
            </h3>

            <p className="text-sm text-slate-500 mt-2 leading-relaxed min-h-[48px]">
              {fitur.deskripsi}
            </p>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
              <span className="text-sm font-semibold text-[#155EEF]">
                Buka Fitur
              </span>
              <span className="text-[#155EEF] group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Informasi */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
        <span className="text-xl">💡</span>
        <div>
          <h3 className="font-bold text-[#082B62] text-sm">
            Pusat Pengelolaan Pembelajaran
          </h3>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            Gunakan ruang ini untuk membantu pengelolaan kegiatan pembelajaran.
            Fitur akan dikembangkan secara bertahap sesuai kebutuhan guru.
          </p>
        </div>
      </div>

    </div>
  );
}
