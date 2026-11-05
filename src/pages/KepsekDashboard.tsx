import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

export default function KepsekDashboard() {
  const { userData } = useAuth();
  const namaKepsek = userData?.nama || 'Kepala Sekolah';
  const [period, setPeriod] = useState('7 Hari'); 

  const attendanceData = [
    { day: "Sen", hadir: 90 }, { day: "Sel", hadir: 92 }, { day: "Rab", hadir: 88 },
    { day: "Kam", hadir: 94 }, { day: "Jum", hadir: 85 }, { day: "Sab", hadir: 0 }, { day: "Min", hadir: 0 },
  ];

  const attendancePie = [{ name: "Hadir", value: 1100 }, { name: "Tidak Hadir", value: 148 }];
  const COLORS = ["#10B981", "#E2E8F0"]; 

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="relative bg-[#082B62] rounded-3xl overflow-hidden shadow-lg flex items-center min-h-[160px]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#082B62] via-[#082B62]/90 to-[#155EEF]/50"></div>
        <div className="relative z-10 flex items-center gap-6 px-8 sm:px-12 py-6 w-full">
          <div>
            <h1 className="text-xl sm:text-2xl text-blue-100 font-medium mb-1">Executive Dashboard</h1>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-wide">Selamat Datang, {namaKepsek}</h2>
            <p className="text-blue-50 text-sm sm:text-base font-medium">Ringkasan performa dan monitoring sekolah hari ini.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-[#155EEF] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Total Siswa</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">1.248</h3>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-[#10B981] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Total Guru</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">86</h3>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Kehadiran</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">94.7%</h3>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Laporan Menunggu</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">12</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-[#082B62] text-lg">Tren Kehadiran Sekolah</h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="colorKepsek" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#155EEF" stopOpacity={0.3}/><stop offset="95%" stopColor="#155EEF" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} dy={10} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Area type="monotone" dataKey="hadir" stroke="#155EEF" strokeWidth={4} fillOpacity={1} fill="url(#colorKepsek)" dot={{ fill: '#155EEF', strokeWidth: 2, r: 4, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <h3 className="font-bold text-[#082B62] text-lg">Kehadiran Sekolah</h3>
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