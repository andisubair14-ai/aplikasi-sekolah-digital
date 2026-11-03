import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";

export default function Dashboard() {
  // Data contoh untuk grafik
  const attendanceData = [
    { day: "Sen", hadir: 92 },
    { day: "Sel", hadir: 94 },
    { day: "Rab", hadir: 91 },
    { day: "Kam", hadir: 95 },
    { day: "Jum", hadir: 89 },
    { day: "Sab", hadir: 0 },
  ];

  const studentByGrade = [
    { name: "X", jumlah: 412 },
    { name: "XI", jumlah: 398 },
    { name: "XII", jumlah: 438 },
  ];

  const attendancePie = [
    { name: "Hadir", value: 1182 },
    { name: "Tidak Hadir", value: 66 },
  ];

  const COLORS = ["#059669", "#e2e8f0"];

  return (
    <div className="space-y-7">
      
      {/* Welcome */}
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Utama</h2>
        <p className="text-slate-500 mt-1">Ringkasan data sekolah hari ini • Selasa, 3 November 2026</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-7">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Siswa</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">1.248</p>
              <p className="text-xs text-emerald-600 mt-2 font-medium">↑ 3.2% dari bulan lalu</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Guru</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">86</p>
              <p className="text-xs text-slate-400 mt-2">Tetap dari bulan lalu</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Hadir Hari Ini</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">94.7%</p>
              <p className="text-xs text-emerald-600 mt-2 font-medium">1.182 dari 1.248 siswa</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Rombongan Belajar</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">36</p>
              <p className="text-xs text-slate-400 mt-2">Kelas aktif tahun ini</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Charts Section ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-7">
        {/* Line Chart - Kehadiran */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-slate-800">Tren Kehadiran Minggu Ini</h3>
              <p className="text-sm text-slate-500 mt-0.5">Persentase kehadiran siswa per hari</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13 }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13 }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="hadir" stroke="#059669" strokeWidth={3} dot={{ fill: '#059669', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart - Hadir vs Tidak */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-slate-800">Kehadiran Hari Ini</h3>
            <p className="text-sm text-slate-500 mt-0.5">Perbandingan hadir & tidak hadir</p>
          </div>
          <div className="h-52 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={attendancePie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {attendancePie.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-600"></div><span className="text-sm text-slate-600">Hadir (94.7%)</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-200"></div><span className="text-sm text-slate-600">Tidak Hadir</span></div>
          </div>
        </div>
      </div>

      {/* Bar Chart - Siswa per Tingkat */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-7">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-slate-800">Jumlah Siswa per Tingkat</h3>
            <p className="text-sm text-slate-500 mt-0.5">Distribusi siswa aktif tahun pelajaran 2025/2026</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={studentByGrade} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13 }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="jumlah" fill="#059669" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent Activity */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-800">Aktivitas Terbaru</h3>
            <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">Lihat Semua</button>
          </div>
          <div className="space-y-4">
            {[
              { title: "Absensi kelas X IPA 1 telah diinput", time: "10 menit yang lalu", type: "absensi" },
              { title: "Data siswa baru ditambahkan: Andi Pratama", time: "1 jam yang lalu", type: "siswa" },
              { title: "Laporan bulanan Oktober berhasil di-generate", time: "3 jam yang lalu", type: "laporan" },
              { title: "Guru baru terdaftar: Siti Aminah, S.Pd", time: "Kemarin", type: "guru" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                  ${item.type === 'absensi' ? 'bg-emerald-50 text-emerald-600' : 
                    item.type === 'siswa' ? 'bg-blue-50 text-blue-600' : 
                    item.type === 'guru' ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-600'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-5">Aksi Cepat</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left group">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4v16m8-8H4" /></svg>
              </div>
              <div><p className="text-sm font-medium text-slate-800">Tambah Siswa</p><p className="text-xs text-slate-400">Input data siswa baru</p></div>
            </button>
            <button className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <div><p className="text-sm font-medium text-slate-800">Input Absensi</p><p className="text-xs text-slate-400">Catat kehadiran hari ini</p></div>
            </button>
            <button className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-left group">
              <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center group-hover:bg-violet-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div><p className="text-sm font-medium text-slate-800">Generate Laporan</p><p className="text-xs text-slate-400">Buat laporan bulanan</p></div>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}