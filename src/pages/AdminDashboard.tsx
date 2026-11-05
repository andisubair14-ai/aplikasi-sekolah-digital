import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function AdminDashboard() {
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

  const attendancePie = [{ name: "Hadir", value: 57 }, { name: "Tidak Hadir", value: 3 }];
  const COLORS = ["#10B981", "#E2E8F0"]; 

  return (
    // PERUBAHAN: Menggunakan w-full agar memenuhi layar
   <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      
      {/* BANNER ADMIN (BIRU) */}
      <div className="relative bg-[#155EEF] rounded-3xl overflow-hidden shadow-lg flex items-center min-h-[160px]">
        <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop" alt="School" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#155EEF] via-[#155EEF]/80 to-transparent"></div>
        <div className="relative z-10 flex items-center gap-6 px-8 sm:px-12 py-6 w-full">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-xl hidden sm:flex flex-shrink-0">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L2 8v2h20V8L12 3zm0 2.18l6.75 3.36H5.25L12 5.18zM4 12v7h2v-5h4v5h2v-7H4zm10 0v7h2v-5h4v5h2v-7h-8zM2 21h20v2H2v-2z"/></svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl text-blue-100 font-medium mb-1">Selamat Datang di</h1>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-wide">Dashboard Admin</h2>
            <p className="text-blue-50 text-sm sm:text-base font-medium">Kelola data sekolah hari ini dengan lebih mudah dan efisien</p>
          </div>
        </div>
      </div>

      {/* 4 KARTU STATISTIK ADMIN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10"></div>
          <div className="w-12 h-12 rounded-xl bg-[#155EEF] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Total Siswa</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">{totalSiswa}</h3>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10"></div>
          <div className="w-12 h-12 rounded-xl bg-[#10B981] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Total Guru</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">86</h3>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -z-10"></div>
          <div className="w-12 h-12 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Hadir Hari Ini</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">94.7%</h3>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -z-10"></div>
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Rombongan Belajar</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">36</h3>
        </div>
      </div>

      {/* GRAFIK ADMIN */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-[#082B62] text-lg">Tren Kehadiran Minggu Ini</h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="colorAdm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#155EEF" stopOpacity={0.3}/><stop offset="95%" stopColor="#155EEF" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} dy={10} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Area type="monotone" dataKey="hadir" stroke="#155EEF" strokeWidth={4} fillOpacity={1} fill="url(#colorAdm)" dot={{ fill: '#155EEF', strokeWidth: 2, r: 4, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <h3 className="font-bold text-[#082B62] text-lg">Kehadiran Hari Ini</h3>
          <div className="flex-1 relative flex items-center justify-center min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={attendancePie} cx="50%" cy="50%" innerRadius={80} outerRadius={100} paddingAngle={0} dataKey="value" stroke="none" cornerRadius={10}>{attendancePie.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index]} />)}</Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-3xl font-extrabold text-[#082B62]">94.7%</span><span className="text-sm font-semibold text-slate-500 mt-1">Hadir</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}