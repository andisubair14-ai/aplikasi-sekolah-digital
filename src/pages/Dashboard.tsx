import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Tambahan untuk navigasi tombol aksi
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Dashboard() {
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [period, setPeriod] = useState('7 Hari'); 

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'siswa'), (snapshot) => {
      setTotalSiswa(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

  const attendanceData = [
    { day: "Sen", hadir: 92 }, { day: "Sel", hadir: 94 }, { day: "Rab", hadir: 91 },
    { day: "Kam", hadir: 95 }, { day: "Jum", hadir: 89 }, { day: "Sab", hadir: 93 },
    { day: "Min", hadir: 94.7 },
  ];

  const attendancePie = [
    { name: "Hadir", value: 57 }, { name: "Tidak Hadir", value: 3 },
  ];

  const COLORS = ["#10B981", "#E2E8F0"]; 

  // Data dummy untuk Aktivitas Terbaru
  const activities = [
    { title: "Siswa baru ditambahkan: Ananda Putri", time: "2 menit yang lalu", type: "siswa" },
    { title: "Data kelas berhasil diperbarui: Kelas 7A", time: "5 menit yang lalu", type: "kelas" },
    { title: "Absensi hari ini telah disimpan", time: "10 menit yang lalu", type: "absensi" },
    { title: "Pengumuman baru diterbitkan oleh Admin", time: "1 jam yang lalu", type: "pengumuman" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* ===== BANNER SELAMAT DATANG ===== */}
      <div className="relative bg-[#155EEF] rounded-3xl overflow-hidden shadow-lg flex items-center min-h-[160px]">
        <img
          src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop"
          alt="School Building"
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#155EEF] via-[#155EEF]/80 to-transparent"></div>
        
        <div className="relative z-10 flex items-center gap-6 px-8 sm:px-12 py-6 w-full">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-xl hidden sm:flex flex-shrink-0">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3L2 8v2h20V8L12 3zm0 2.18l6.75 3.36H5.25L12 5.18zM4 12v7h2v-5h4v5h2v-7H4zm10 0v7h2v-5h4v5h2v-7h-8zM2 21h20v2H2v-2z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl text-blue-100 font-medium mb-1">Selamat Datang di</h1>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-wide">Dashboard Utama</h2>
            <p className="text-blue-50 text-sm sm:text-base font-medium">Kelola data sekolah hari ini dengan lebih mudah dan efisien</p>
          </div>
        </div>
      </div>

      {/* ===== 4 KARTU STATISTIK UTAMA ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Kartu 1: Total Siswa */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#155EEF] text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <Link to="/dashboard/siswa" className="w-8 h-8 rounded-full bg-blue-50 text-[#155EEF] flex items-center justify-center group-hover:bg-[#155EEF] group-hover:text-white transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
          </div>
          <p className="text-slate-500 font-semibold text-sm">Total Siswa</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{totalSiswa}</h3>
          <p className="text-xs text-[#10B981] font-bold mt-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            5% dari bulan lalu
          </p>
        </div>

        {/* Kartu 2: Total Guru */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#10B981] text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#10B981] flex items-center justify-center group-hover:bg-[#10B981] group-hover:text-white transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </div>
          </div>
          <p className="text-slate-500 font-semibold text-sm">Total Guru</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">86</h3>
          <p className="text-xs text-[#10B981] font-bold mt-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            2% dari bulan lalu
          </p>
        </div>

        {/* Kartu 3: Hadir Hari Ini */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-50 text-[#8B5CF6] flex items-center justify-center group-hover:bg-[#8B5CF6] group-hover:text-white transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </div>
          </div>
          <p className="text-slate-500 font-semibold text-sm">Hadir Hari Ini</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">94.7%</h3>
          <p className="text-xs text-[#10B981] font-bold mt-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            1.2% dari kemarin
          </p>
        </div>

        {/* Kartu 4: Rombongan Belajar */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <div className="w-8 h-8 rounded-full bg-orange-50 text-[#F59E0B] flex items-center justify-center group-hover:bg-[#F59E0B] group-hover:text-white transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </div>
          </div>
          <p className="text-slate-500 font-semibold text-sm">Rombongan Belajar</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">36</h3>
          <p className="text-xs text-slate-400 font-medium mt-3">Kelas aktif tahun ini</p>
        </div>
      </div>

      {/* ===== BAGIAN GRAFIK ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Grafik Garis */}
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h3 className="font-bold text-[#082B62] text-lg">Tren Kehadiran Minggu Ini</h3>
              <p className="text-sm text-slate-500 mt-1">Persentase kehadiran siswa per hari</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['7 Hari', '30 Hari', '1 Tahun'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${
                    period === p ? 'bg-white text-[#155EEF] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#155EEF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#155EEF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13, fontWeight: 500 }} dy={10} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13, fontWeight: 500 }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#155EEF', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="hadir" stroke="#155EEF" strokeWidth={4} fillOpacity={1} fill="url(#colorHadir)" dot={{ fill: '#155EEF', strokeWidth: 2, r: 4, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grafik Donat */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <div className="mb-2">
            <h3 className="font-bold text-[#082B62] text-lg">Kehadiran Hari Ini</h3>
            <p className="text-sm text-slate-500 mt-1">Perbandingan hadir & tidak hadir</p>
          </div>
          
          <div className="flex-1 relative flex items-center justify-center min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={attendancePie} cx="50%" cy="50%" innerRadius={80} outerRadius={100} paddingAngle={0} dataKey="value" stroke="none" cornerRadius={10}>
                  {attendancePie.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold text-[#082B62]">94.7%</span>
              <span className="text-sm font-semibold text-slate-500 mt-1">Hadir</span>
            </div>
          </div>
          
          <div className="flex justify-center gap-8 mt-4">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
                <span className="text-sm font-bold text-slate-700">Hadir</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">57 Siswa</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                <span className="text-sm font-bold text-slate-700">Tidak Hadir</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">3 Siswa</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== AKTIVITAS TERBARU & AKSI CEPAT ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Aktivitas Terbaru */}
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 text-[#8B5CF6] rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="font-bold text-[#082B62] text-lg">Aktivitas Terbaru</h3>
            </div>
            <button className="text-sm text-[#155EEF] font-bold hover:text-blue-800 flex items-center gap-1 transition-colors">
              Lihat Semua <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </div>
          
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {activities.map((item, idx) => (
              <div key={idx} className="relative flex items-start gap-4">
                {/* Ikon Bulat */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 bg-white border-2 shadow-sm
                  ${item.type === 'siswa' ? 'border-[#155EEF] text-[#155EEF]' : 
                    item.type === 'kelas' ? 'border-[#F59E0B] text-[#F59E0B]' : 
                    item.type === 'absensi' ? 'border-[#10B981] text-[#10B981]' : 'border-[#8B5CF6] text-[#8B5CF6]'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                {/* Teks Aktivitas */}
                <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-sm font-bold text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aksi Cepat */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-amber-50 text-[#F59E0B] rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="font-bold text-[#082B62] text-lg">Aksi Cepat</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Tombol 1: Tambah Siswa */}
            <Link to="/dashboard/siswa" className="flex flex-col items-center justify-center p-5 rounded-2xl bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:border-blue-300 transition-all group">
              <div className="w-10 h-10 bg-white text-[#155EEF] rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <span className="text-xs font-bold text-[#155EEF] text-center">Tambah Siswa</span>
            </Link>

            {/* Tombol 2: Kelola Rombel */}
            <Link to="/dashboard/kelas" className="flex flex-col items-center justify-center p-5 rounded-2xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 hover:border-emerald-300 transition-all group">
              <div className="w-10 h-10 bg-white text-[#10B981] rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <span className="text-xs font-bold text-[#10B981] text-center">Kelola Rombel</span>
            </Link>

            {/* Tombol 3: Upload Excel */}
            <Link to="/dashboard/siswa" className="flex flex-col items-center justify-center p-5 rounded-2xl bg-purple-50 border border-purple-100 hover:bg-purple-100 hover:border-purple-300 transition-all group">
              <div className="w-10 h-10 bg-white text-[#8B5CF6] rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <span className="text-xs font-bold text-[#8B5CF6] text-center">Upload Excel</span>
            </Link>

            {/* Tombol 4: Download Excel */}
            <button onClick={() => alert('Fitur download menyusul di halaman Data Siswa')} className="flex flex-col items-center justify-center p-5 rounded-2xl bg-orange-50 border border-orange-100 hover:bg-orange-100 hover:border-orange-300 transition-all group">
              <div className="w-10 h-10 bg-white text-[#F59E0B] rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </div>
              <span className="text-xs font-bold text-[#F59E0B] text-center">Download Excel</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}