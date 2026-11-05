import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

export default function GuruDashboard() {
  const { userData } = useAuth();
  const namaGuru = userData?.nama || 'Bapak/Ibu Guru';
  const [period, setPeriod] = useState('7 Hari'); 

  const attendanceData = [
    { day: "Sen", hadir: 95 }, { day: "Sel", hadir: 98 }, { day: "Rab", hadir: 92 },
    { day: "Kam", hadir: 100 }, { day: "Jum", hadir: 90 }, { day: "Sab", hadir: 0 }, { day: "Min", hadir: 0 },
  ];

  const attendancePie = [{ name: "Hadir", value: 120 }, { name: "Tidak Hadir", value: 5 }];
  const COLORS = ["#10B981", "#E2E8F0"]; 

  return (
    // PERUBAHAN: Menggunakan w-full agar memenuhi layar
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="relative bg-[#155EEF] rounded-3xl overflow-hidden shadow-lg flex items-center min-h-[160px]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#155EEF] via-[#155EEF]/80 to-transparent"></div>
        <div className="relative z-10 flex items-center gap-6 px-8 sm:px-12 py-6 w-full">
          <div>
            <h1 className="text-xl sm:text-2xl text-blue-100 font-medium mb-1">Selamat Datang,</h1>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-wide">{namaGuru}</h2>
            <p className="text-blue-50 text-sm sm:text-base font-medium">Semoga hari mengajar Anda menyenangkan dan penuh berkah hari ini.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-[#155EEF] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Kelas Diampu</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">4</h3>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-[#10B981] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Total Siswa Diampu</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">125</h3>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Absensi Belum Diisi</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">2</h3>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shadow-lg mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
          <p className="text-slate-500 font-semibold text-sm">Jurnal Terisi</p>
          <h3 className="text-4xl font-extrabold text-[#082B62] mt-1">18</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-[#082B62] text-lg">Tren Kehadiran Kelas Anda</h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="colorGuru" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#155EEF" stopOpacity={0.3}/><stop offset="95%" stopColor="#155EEF" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} dy={10} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 13 }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Area type="monotone" dataKey="hadir" stroke="#155EEF" strokeWidth={4} fillOpacity={1} fill="url(#colorGuru)" dot={{ fill: '#155EEF', strokeWidth: 2, r: 4, stroke: '#fff' }} />
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
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-3xl font-extrabold text-[#082B62]">96%</span><span className="text-sm font-semibold text-slate-500 mt-1">Hadir</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}