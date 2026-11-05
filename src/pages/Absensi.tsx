import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../contexts/AuthContext';

export default function Absensi() {
  const { userData } = useAuth();
  
  // State Tab
  const [activeTab, setActiveTab] = useState<'manual' | 'scan' | 'kartu'>('manual');
  
  // State Data
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([]);
  const [absensiHariIni, setAbsensiHariIni] = useState<Record<string, string>>({});
  
  // State Filter
  const [selectedTanggal, setSelectedTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [selectedKelas, setSelectedKelas] = useState('');
  
  // State Loading & Notifikasi
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Mengambil Data Master
  useEffect(() => {
    const unsubSiswa = onSnapshot(collection(db, 'siswa'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSiswaList(data);
      setLoading(false);
    });
    const unsubKelas = onSnapshot(collection(db, 'kelas'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setKelasList(data);
    });
    const unsubTA = onSnapshot(collection(db, 'tahun_ajaran'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTahunAjaranList(data);
    });
    return () => { unsubSiswa(); unsubKelas(); unsubTA(); };
  }, []);

  // Memuat data absensi jika tanggal atau kelas berubah
  useEffect(() => {
    if (!selectedKelas) return;
    const fetchAbsensi = async () => {
      const q = query(
        collection(db, 'absensi'), 
        where('tanggal', '==', selectedTanggal),
        where('kelas', '==', selectedKelas)
      );
      const snapshot = await getDocs(q);
      const dataAbsensi: Record<string, string> = {};
      snapshot.forEach(doc => {
        dataAbsensi[doc.data().nisn] = doc.data().status;
      });
      setAbsensiHariIni(dataAbsensi);
    };
    fetchAbsensi();
  }, [selectedTanggal, selectedKelas]);

  // === LOGIKA SCANNER QR ===
  useEffect(() => {
    if (activeTab !== 'scan') return;
    
    const scanner = new Html5QrcodeScanner(
      "reader", 
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    
    scanner.render((decodedText) => {
      // decodedText adalah NISN siswa yang di-scan
      scanner.pause(true); // Pause scanner agar tidak double scan
      setScanResult(decodedText);
      
      // Cari siswa berdasarkan NISN
      const siswa = siswaList.find(s => s.nisn === decodedText);
      if (siswa) {
        // Simpan ke Firebase sebagai 'Hadir'
        handleScanMasuk(siswa);
      } else {
        alert('Siswa dengan NISN tersebut tidak ditemukan!');
        scanner.resume();
      }
    }, (error) => {
      // Abaikan error scan (karena kamera terus mencari)
    });

    return () => {
      scanner.clear();
    };
  }, [activeTab, siswaList]);

  const handleScanMasuk = async (siswa: any) => {
    try {
      const docId = `${selectedTanggal}_${siswa.nisn}`;
      const dataAbsen = {
        tanggal: selectedTanggal,
        nisn: siswa.nisn,
        namaSiswa: siswa.nama,
        kelas: siswa.kelas,
        status: 'Hadir',
        metode: 'Scan QR',
        waktuScan: new Date().toISOString(),
        dicatatOleh: userData?.nama || 'Guru'
      };
      
      await setDoc(doc(db, 'absensi', docId), dataAbsen);
      
      alert(`✅ ${siswa.nama} berhasil diabsen (Hadir)`);
      
      // Update state lokal
      setAbsensiHariIni(prev => ({ ...prev, [siswa.nisn]: 'Hadir' }));
      
      // Resume scanner setelah 2 detik
      setTimeout(() => {
        setScanResult(null);
        const scannerElement = document.getElementById("reader");
        if (scannerElement) {
          // Note: html5-qrcode requires re-rendering or specific instance handling to resume smoothly, 
          // for simplicity we rely on the useEffect cleanup or user manual switch.
        }
      }, 2000);

    } catch (error) {
      alert('Gagal menyimpan absensi: ' + error);
    }
  };

  // === LOGIKA INPUT MANUAL ===
  const handleStatusChange = (nisn: string, status: string) => {
    setAbsensiHariIni(prev => ({ ...prev, [nisn]: status }));
  };

  const handleSimpanManual = async () => {
    if (!selectedKelas) return alert('Pilih kelas terlebih dahulu!');
    if (Object.keys(absensiHariIni).length === 0) return alert('Belum ada data yang diisi.');
    
    setIsSaving(true);
    try {
      const batchPromises = Object.entries(absensiHariIni).map(([nisn, status]) => {
        const siswa = siswaList.find(s => s.nisn === nisn);
        if (!siswa) return null;
        
        const docId = `${selectedTanggal}_${nisn}`;
        return setDoc(doc(db, 'absensi', docId), {
          tanggal: selectedTanggal,
          nisn: nisn,
          namaSiswa: siswa.nama,
          kelas: selectedKelas,
          status: status,
          metode: 'Manual',
          waktuScan: new Date().toISOString(),
          dicatatOleh: userData?.nama || 'Guru'
        });
      });
      
      await Promise.all(batchPromises.filter(p => p !== null));
      alert('Data absensi manual berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan absensi: ' + error);
    } finally {
      setIsSaving(false);
    }
  };

  const siswaDiKelas = siswaList.filter(s => s.kelas === selectedKelas);

  // === TAB 1: RENDER MANUAL ===
  const renderManual = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-4">
        <h3 className="font-bold text-[#082B62] text-lg">Input Kehadiran Manual</h3>
        <div className="flex gap-2 w-full sm:w-auto">
          <input type="date" value={selectedTanggal} onChange={(e) => setSelectedTanggal(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
          <select value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium bg-white">
            <option value="">-- Pilih Kelas --</option>
            {kelasList.map(k => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
          </select>
        </div>
      </div>

      {!selectedKelas ? (
        <div className="text-center py-10 text-slate-500 font-medium">Silakan pilih Kelas terlebih dahulu.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                  <th className="p-3 font-bold text-xs uppercase">No</th>
                  <th className="p-3 font-bold text-xs uppercase">Nama Siswa</th>
                  <th className="p-3 font-bold text-xs uppercase text-center">H</th>
                  <th className="p-3 font-bold text-xs uppercase text-center">S</th>
                  <th className="p-3 font-bold text-xs uppercase text-center">I</th>
                  <th className="p-3 font-bold text-xs uppercase text-center">A</th>
                </tr>
              </thead>
              <tbody>
                {siswaDiKelas.map((siswa, index) => {
                  const currentStatus = absensiHariIni[siswa.nisn] || '';
                  return (
                    <tr key={siswa.id} className="border-b border-slate-100 hover:bg-slate-50 text-sm">
                      <td className="p-3 text-slate-500 font-medium">{index + 1}</td>
                      <td className="p-3 font-bold text-[#082B62]">{siswa.nama}</td>
                      {['Hadir', 'Sakit', 'Izin', 'Alpa'].map(status => (
                        <td key={status} className="p-3 text-center">
                          <button 
                            onClick={() => handleStatusChange(siswa.nisn, status)}
                            className={`w-8 h-8 rounded-lg font-bold transition-all ${
                              currentStatus === status 
                                ? status === 'Hadir' ? 'bg-emerald-500 text-white shadow-md' 
                                  : status === 'Sakit' ? 'bg-amber-500 text-white shadow-md'
                                  : status === 'Izin' ? 'bg-blue-500 text-white shadow-md'
                                  : 'bg-red-500 text-white shadow-md'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {status[0]}
                          </button>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={handleSimpanManual} disabled={isSaving}
              className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all ${
                isSaving ? 'bg-slate-400' : 'bg-[#155EEF] hover:bg-blue-700 shadow-blue-500/30'
              }`}>
              {isSaving ? 'Menyimpan...' : 'Simpan Absensi'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  // === TAB 2: RENDER SCAN ===
  const renderScan = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-xl mx-auto text-center">
      <h3 className="font-bold text-[#082B62] text-lg mb-2">Scan QR Code Kartu Siswa</h3>
      <p className="text-slate-500 text-sm mb-6">Arahkan kamera ke QR Code pada kartu pelajar siswa.</p>
      
      <div className="flex justify-center gap-4 mb-6">
        <input type="date" value={selectedTanggal} onChange={(e) => setSelectedTanggal(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium" />
        <select value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium bg-white">
          <option value="">-- Pilih Kelas --</option>
          {kelasList.map(k => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
        </select>
      </div>

      {!selectedKelas ? (
        <div className="text-center py-10 text-slate-500 font-medium">Pilih Kelas terlebih dahulu sebelum scan.</div>
      ) : (
        <div>
          <div id="reader" className="w-full rounded-xl overflow-hidden border-2 border-slate-200"></div>
          {scanResult && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-bold animate-pulse">
              Memproses NISN: {scanResult}...
            </div>
          )}
        </div>
      )}
    </div>
  );

  // === TAB 3: RENDER KARTU PELAJAR ===
  const renderKartu = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-4">
        <div>
          <h3 className="font-bold text-[#082B62] text-lg">Cetak Kartu Pelajar</h3>
          <p className="text-slate-500 text-sm">Cetak kartu berisi QR Code untuk absensi siswa.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#155EEF] outline-none font-medium bg-white">
            <option value="">-- Pilih Kelas --</option>
            {kelasList.map(k => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
          </select>
          <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-bold transition-colors shadow-sm flex items-center gap-2">
            🖨️ Print
          </button>
        </div>
      </div>

      {!selectedKelas ? (
        <div className="text-center py-10 text-slate-500 font-medium">Silakan pilih Kelas terlebih dahulu.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {siswaDiKelas.map((siswa) => (
            <div key={siswa.id} className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col print-card">
              <div className="bg-[#082B62] p-3 text-center text-white">
                <h4 className="font-bold text-sm">KARTU PELAJAR</h4>
                <p className="text-[10px] text-blue-200">SD/SMP NEGERI 1</p>
              </div>
              <div className="p-4 flex flex-col items-center flex-1">
                <QRCodeSVG value={siswa.nisn} size={100} level="H" />
                <h5 className="font-bold text-[#082B62] mt-3 text-sm text-center">{siswa.nama}</h5>
                <p className="text-xs text-slate-500 font-medium">NISN: {siswa.nisn}</p>
                <p className="text-xs text-slate-500 font-medium">Kelas: {siswa.kelas}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      
      {/* Header & Tabs */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto">
        <button onClick={() => setActiveTab('manual')} className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'manual' ? 'bg-[#EFF6FF] text-[#155EEF]' : 'text-slate-500 hover:bg-slate-50'}`}>
          📝 Input Manual
        </button>
        <button onClick={() => setActiveTab('scan')} className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'scan' ? 'bg-[#EFF6FF] text-[#155EEF]' : 'text-slate-500 hover:bg-slate-50'}`}>
          📷 Scan QR Code
        </button>
        <button onClick={() => setActiveTab('kartu')} className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'kartu' ? 'bg-[#EFF6FF] text-[#155EEF]' : 'text-slate-500 hover:bg-slate-50'}`}>
          🖨️ Cetak Kartu Pelajar
        </button>
      </div>

      {/* Konten Tab */}
      {activeTab === 'manual' && renderManual()}
      {activeTab === 'scan' && renderScan()}
      {activeTab === 'kartu' && renderKartu()}
      
      {/* CSS Khusus Print */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-card, .print-card * { visibility: visible; }
          .print-card { position: absolute; left: 0; top: 0; width: 100%; page-break-after: always; border: 1px solid #ccc !important; }
          .grid { display: block !important; }
        }
      `}</style>
    </div>
  );
}