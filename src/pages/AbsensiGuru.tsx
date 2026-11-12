import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type StatusGuru = 'Hadir' | 'Izin' | 'Sakit' | 'Dinas Luar' | 'Alpa';

interface GuruRecord {
  id: string;
  nama?: string;
  nip?: string;
  jabatan?: string;
  noHp?: string;
}

interface AbsensiGuruRecord {
  id: string;
  tanggal: string;
  guruId: string;
  namaGuru: string;
  nip: string;
  status: StatusGuru;
  waktuMasuk: any;
  waktuPulang: any;
  catatan: string;
  dicatatOlehUid: string;
  createdAt: any;
  updatedAt: any;
  qrToken?: string;
  qrTokenPulang?: string;
}

const PREFIX_QR_GURU = 'SEKOLAH-DIGITAL|ABSENSI-GURU|';
// QR dibuat saat Admin menekan tombol. Durasi 7 jam 55 menit memberi toleransi selisih jam perangkat dan server.
const MASA_BERLAKU_QR_MS = 7 * 60 * 60 * 1000 + 55 * 60 * 1000;
const AKURASI_GPS_MAKSIMAL_METER = 50;
const ZONA_WAKTU_VALID = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'];

const buatTokenQr = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const pad = (value: number) => String(value).padStart(2, '0');

const tanggalLokal = (date = new Date(), zonaWaktu = 'Asia/Makassar') => {
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaWaktu,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const nilai = Object.fromEntries(bagian.map((item) => [item.type, item.value]));
  return `${nilai.year}-${pad(Number(nilai.month))}-${pad(Number(nilai.day))}`;
};

const bulanSekarang = (zonaWaktu = 'Asia/Makassar') => tanggalLokal(new Date(), zonaWaktu).slice(0, 7);

const batasBulan = (bulan: string) => {
  const [tahun, bulanAngka] = bulan.split('-').map(Number);
  const hariTerakhir = new Date(tahun, bulanAngka, 0).getDate();
  return {
    awal: `${bulan}-01`,
    akhir: `${bulan}-${pad(hariTerakhir)}`,
  };
};

const formatJam = (value?: any, zonaWaktu = 'Asia/Makassar') => {
  if (!value) return '-';
  if (typeof value === 'string' && value === '') return '-';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('id-ID', {
    timeZone: zonaWaktu,
    hour: '2-digit',
    minute: '2-digit',
  });
};

const hitungJarakMeter = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radiusBumi = 6371000;
  const keRad = (nilai: number) => (nilai * Math.PI) / 180;
  const dLat = keRad(lat2 - lat1);
  const dLon = keRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(keRad(lat1)) * Math.cos(keRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radiusBumi * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

type HasilVerifikasiLokasi =
  | { ok: true; tanggal: string }
  | { ok: false; pesan: string };

/**
 * Memeriksa GPS perangkat secara sementara. Koordinat perangkat tidak pernah
 * dikirim atau disimpan ke Firestore.
 */
const verifikasiLokasiGuru = async (): Promise<HasilVerifikasiLokasi> => {
  let pengaturan;
  try {
    const snapshot = await getDoc(doc(db, 'pengaturan', 'sekolah'));
    if (!snapshot.exists()) {
      return { ok: false, pesan: 'Pengaturan sekolah belum tersedia. Hubungi Administrator.' };
    }
    pengaturan = snapshot.data();
  } catch (error) {
    console.error('Gagal membaca pengaturan lokasi sekolah:', error);
    return { ok: false, pesan: 'Pengaturan lokasi sekolah tidak dapat dibaca. Periksa koneksi internet.' };
  }

  const latitudeSekolah = Number(pengaturan.latitudeSekolah);
  const longitudeSekolah = Number(pengaturan.longitudeSekolah);
  const radiusPresensi = Number(pengaturan.radiusPresensiMeter);
  const zonaWaktu = ZONA_WAKTU_VALID.includes(pengaturan.zonaWaktu)
    ? pengaturan.zonaWaktu
    : 'Asia/Makassar';

  if (
    pengaturan.latitudeSekolah == null ||
    pengaturan.longitudeSekolah == null ||
    !Number.isFinite(latitudeSekolah) ||
    latitudeSekolah < -90 || latitudeSekolah > 90 ||
    !Number.isFinite(longitudeSekolah) ||
    longitudeSekolah < -180 || longitudeSekolah > 180
  ) {
    return { ok: false, pesan: 'Lokasi sekolah belum diatur dengan benar. Hubungi Administrator.' };
  }

  if (!Number.isFinite(radiusPresensi) || radiusPresensi < 10 || radiusPresensi > 1000) {
    return { ok: false, pesan: 'Radius presensi sekolah belum valid. Hubungi Administrator.' };
  }

  if (!navigator.geolocation) {
    return { ok: false, pesan: 'Perangkat atau browser tidak mendukung GPS.' };
  }

  let posisi: GeolocationPosition;
  try {
    posisi = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    });
  } catch (error) {
    const kode = (error as GeolocationPositionError)?.code;
    if (kode === 1) {
      return { ok: false, pesan: 'AKSES LOKASI DITOLAK. Aktifkan izin lokasi untuk aplikasi ini.' };
    }
    if (kode === 2) {
      return { ok: false, pesan: 'LOKASI TIDAK TERSEDIA. Aktifkan GPS dan coba kembali.' };
    }
    return { ok: false, pesan: 'GPS belum memberikan respons. Periksa koneksi dan coba kembali.' };
  }

  if (!Number.isFinite(posisi.coords.accuracy) || posisi.coords.accuracy > AKURASI_GPS_MAKSIMAL_METER) {
    return {
      ok: false,
      pesan: `AKURASI GPS BELUM CUKUP (±${Math.round(posisi.coords.accuracy || 0)} meter). Coba kembali di area terbuka.`,
    };
  }

  const jarak = hitungJarakMeter(
    latitudeSekolah,
    longitudeSekolah,
    posisi.coords.latitude,
    posisi.coords.longitude
  );

  if (jarak > radiusPresensi) {
    return {
      ok: false,
      pesan: `ABSENSI DITOLAK. Perangkat berada sekitar ${Math.round(jarak)} meter dari titik sekolah, sedangkan radius yang diizinkan ${radiusPresensi} meter.`,
    };
  }

  return { ok: true, tanggal: tanggalLokal(new Date(), zonaWaktu) };
};

const formatTanggal = (value: string) => {
  if (!value) return '-';
  const [tahun, bulan, hari] = value.split('-').map(Number);
  return new Date(tahun, bulan - 1, hari).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
};

const kelasStatus = (status?: string) => {
  switch (status) {
    case 'Hadir': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Izin': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Sakit': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Dinas Luar': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'Alpa': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const idDokumen = (tanggal: string, guruId: string) => `${tanggal}_${guruId}`;

export default function AbsensiGuru() {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const isGuru = userData?.role === 'guru';
  const isKepsek = userData?.role === 'kepsek';
  const bolehMemantau = isAdmin || isKepsek;
  const guruIdSaya = typeof userData?.guruId === 'string' ? userData.guruId : '';
  const uidSaya = userData?.uid || '';

  const [bulan, setBulan] = useState(bulanSekarang());
  const [namaSekolah, setNamaSekolah] = useState('');
  const [alamatSekolah, setAlamatSekolah] = useState('');
  const [kepalaSekolah, setKepalaSekolah] = useState('');
  const [zonaWaktuSekolah, setZonaWaktuSekolah] = useState('Asia/Makassar');
  const [lokasiSekolahSiap, setLokasiSekolahSiap] = useState(false);
  const pengaturanPertamaRef = useRef(true);
  const [printMode, setPrintMode] = useState<'poster' | null>(null);
  const [guruProfile, setGuruProfile] = useState<GuruRecord | null>(null);
  const [daftarGuru, setDaftarGuru] = useState<GuruRecord[]>([]);
  const [daftarAbsensi, setDaftarAbsensi] = useState<AbsensiGuruRecord[]>([]);
  const [loadingProfil, setLoadingProfil] = useState(isGuru);
  const [loadingData, setLoadingData] = useState(true);
  const [errorData, setErrorData] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [guruManualId, setGuruManualId] = useState('');
  const [tanggalManual, setTanggalManual] = useState(tanggalLokal());
  const [statusManual, setStatusManual] = useState<Exclude<StatusGuru, 'Hadir'>>('Izin');
  const [catatanManual, setCatatanManual] = useState('');

  const [tokenQrAdmin, setTokenQrAdmin] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);

  const [modeScan, setModeScan] = useState<'masuk' | 'pulang' | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [errorScan, setErrorScan] = useState('');
  const scanLockRef = useRef(false);

  const rentangBulan = useMemo(() => batasBulan(bulan), [bulan]);
  const tanggalHariIni = tanggalLokal(new Date(), zonaWaktuSekolah);

  // Identitas dan zona waktu sekolah dipakai pada tampilan serta tanggal rekap.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        const zona = ZONA_WAKTU_VALID.includes(data.zonaWaktu)
          ? data.zonaWaktu
          : 'Asia/Makassar';
        setNamaSekolah(String(data.namaSekolah || ''));
        setAlamatSekolah(String(data.alamat || ''));
        setKepalaSekolah(String(data.kepalaSekolah || ''));
        const latSekolah = Number(data.latitudeSekolah);
        const longSekolah = Number(data.longitudeSekolah);
        const radiusSekolah = Number(data.radiusPresensiMeter);
        setLokasiSekolahSiap(
          data.latitudeSekolah != null && data.longitudeSekolah != null &&
          Number.isFinite(latSekolah) && latSekolah >= -90 && latSekolah <= 90 &&
          Number.isFinite(longSekolah) && longSekolah >= -180 && longSekolah <= 180 &&
          Number.isFinite(radiusSekolah) && radiusSekolah >= 10 && radiusSekolah <= 1000
        );
        setZonaWaktuSekolah(zona);

        if (pengaturanPertamaRef.current) {
          setBulan(bulanSekarang(zona));
          setTanggalManual(tanggalLokal(new Date(), zona));
          pengaturanPertamaRef.current = false;
        }
      },
      (error) => {
        console.error('Gagal membaca identitas dan zona waktu sekolah:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Poster dicetak terpisah dari laporan bulanan.
  useEffect(() => {
    if (printMode !== 'poster') return;
    const selesaiCetak = () => setPrintMode(null);
    window.addEventListener('afterprint', selesaiCetak);
    const timer = window.setTimeout(() => window.print(), 250);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', selesaiCetak);
    };
  }, [printMode]);

  useEffect(() => {
    if (!isGuru) {
      setGuruProfile(null);
      setLoadingProfil(false);
      return;
    }
    if (!guruIdSaya) {
      setGuruProfile(null);
      setLoadingProfil(false);
      return;
    }

    let masihAktif = true;
    setLoadingProfil(true);
    getDoc(doc(db, 'guru', guruIdSaya))
      .then((snapshot) => {
        if (!masihAktif) return;
        if (snapshot.exists()) {
          setGuruProfile({ id: snapshot.id, ...snapshot.data() } as GuruRecord);
        } else {
          setGuruProfile(null);
          setErrorData('Data pegawai yang terhubung dengan akun Guru ini tidak ditemukan.');
        }
      })
      .catch((error) => {
        console.error('Gagal memuat profil Guru:', error);
        if (masihAktif) setErrorData('Profil Guru tidak dapat dibaca dari Firebase.');
      })
      .finally(() => {
        if (masihAktif) setLoadingProfil(false);
      });

    return () => { masihAktif = false; };
  }, [isGuru, guruIdSaya]);

  useEffect(() => {
    if (isGuru && !guruIdSaya) {
      setDaftarAbsensi([]);
      setLoadingData(false);
      return;
    }
    if (!bolehMemantau && !isGuru) {
      setDaftarAbsensi([]);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setErrorData('');
    const sumber = collection(db, 'absensi_guru');
    const q = isGuru
      ? query(sumber, where('guruId', '==', guruIdSaya))
      : query(
          sumber,
          where('tanggal', '>=', rentangBulan.awal),
          where('tanggal', '<=', rentangBulan.akhir)
        );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AbsensiGuruRecord[];
        setDaftarAbsensi(records);
        setLoadingData(false);
      },
      (error) => {
        console.error('Gagal membaca absensi guru:', error);
        setErrorData('Data Absensi Guru belum dapat dibaca. Periksa aturan akses Firestore.');
        setLoadingData(false);
      }
    );

    return () => unsubscribe();
  }, [isGuru, guruIdSaya, bolehMemantau, rentangBulan.awal, rentangBulan.akhir]);

  // Admin hanya memantau QR yang aktif. QR tidak dibuat atau diganti otomatis.
  useEffect(() => {
    if (!isAdmin) {
      setTokenQrAdmin('');
      setQrExpiresAt(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'pengaturan', 'qr_absensi_guru'),
      (snapshot) => {
        if (!snapshot.exists()) {
          setTokenQrAdmin('');
          setQrExpiresAt(null);
          return;
        }

        const data = snapshot.data();
        const expiresAt = data.expiresAt?.toDate?.() as Date | undefined;
        if (typeof data.token === 'string' && expiresAt && expiresAt.getTime() > Date.now()) {
          setTokenQrAdmin(data.token);
          setQrExpiresAt(expiresAt);
          setQrError('');
        } else {
          setTokenQrAdmin('');
          setQrExpiresAt(expiresAt || null);
        }
      },
      (error) => {
        console.error('Gagal membaca QR Absensi Guru:', error);
        setQrError('QR tidak dapat dibaca. Periksa izin Admin pada Firestore.');
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  const handleBuatQrBaru = async () => {
    if (!isAdmin || !uidSaya || qrGenerating) return;
    setQrGenerating(true);
    setQrError('');

    const token = buatTokenQr();
    // Masa berlaku 7 jam 55 menit; aturan Firestore membatasi maksimum 8 jam.
    const waktuKedaluwarsa = new Date(Date.now() + MASA_BERLAKU_QR_MS);

    try {
      await setDoc(
        doc(db, 'pengaturan', 'qr_absensi_guru'),
        {
          token,
          expiresAt: Timestamp.fromDate(waktuKedaluwarsa),
          generatedAt: serverTimestamp(),
          generatedByUid: uidSaya,
        },
        { merge: true }
      );
      setQrError('');
    } catch (error) {
      console.error('Gagal membuat QR baru:', error);
      setQrError('QR baru gagal dibuat. Periksa koneksi dan aturan Firestore.');
    } finally {
      setQrGenerating(false);
    }
  };

  useEffect(() => {
    if (!qrExpiresAt) {
      setQrSecondsLeft(0);
      return;
    }
    const hitungSisa = () => {
      setQrSecondsLeft(Math.max(0, Math.ceil((qrExpiresAt.getTime() - Date.now()) / 1000)));
    };
    hitungSisa();
    const interval = window.setInterval(hitungSisa, 1000);
    return () => window.clearInterval(interval);
  }, [qrExpiresAt]);

  useEffect(() => {
    if (!bolehMemantau) {
      setDaftarGuru([]);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'guru'),
      (snapshot) => {
        const records = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as GuruRecord[];
        records.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
        setDaftarGuru(records);
        setGuruManualId((current) => current || records[0]?.id || '');
      },
      (error) => {
        console.error('Gagal membaca daftar Guru:', error);
        setErrorData('Daftar pegawai tidak dapat dibaca.');
      }
    );

    return () => unsubscribe();
  }, [bolehMemantau]);

  const recordsBulan = useMemo(
    () => daftarAbsensi
      .filter((item) => item.tanggal >= rentangBulan.awal && item.tanggal <= rentangBulan.akhir)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (a.namaGuru || '').localeCompare(b.namaGuru || '', 'id')),
    [daftarAbsensi, rentangBulan.awal, rentangBulan.akhir]
  );

  const recordHariIni = useMemo(
    () => daftarAbsensi.find((item) => item.tanggal === tanggalHariIni && item.guruId === guruIdSaya) || null,
    [daftarAbsensi, guruIdSaya, tanggalHariIni]
  );

  const rekapGuru = useMemo(() => daftarGuru.map((guru) => {
    const milikGuru = recordsBulan.filter((item) => item.guruId === guru.id);
    return {
      ...guru,
      hadir: milikGuru.filter((item) => item.status === 'Hadir').length,
      izin: milikGuru.filter((item) => item.status === 'Izin').length,
      sakit: milikGuru.filter((item) => item.status === 'Sakit').length,
      dinas: milikGuru.filter((item) => item.status === 'Dinas Luar').length,
      alpa: milikGuru.filter((item) => item.status === 'Alpa').length,
      tercatat: milikGuru.length,
    };
  }), [daftarGuru, recordsBulan]);

  const totalHadir = recordsBulan.filter((item) => item.status === 'Hadir').length;
  const totalIzin = recordsBulan.filter((item) => item.status === 'Izin').length;
  const totalSakit = recordsBulan.filter((item) => item.status === 'Sakit').length;
  const totalDinas = recordsBulan.filter((item) => item.status === 'Dinas Luar').length;
  const totalAlpa = recordsBulan.filter((item) => item.status === 'Alpa').length;
  const labelPeriodeCetak = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: zonaWaktuSekolah,
  }).format(new Date(`${bulan}-01T12:00:00`)).toLocaleUpperCase('id-ID');
  const lokasiPengesahan = alamatSekolah.split(',')[0]?.trim() || 'Tempat';
  const tanggalPengesahan = new Date().toLocaleDateString('id-ID', {
    timeZone: zonaWaktuSekolah,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handlePresensiMasuk = useCallback(async (qrToken: string) => {
    if (!guruProfile || !guruIdSaya || !uidSaya) {
      alert('Akun Guru belum terhubung dengan Data Pegawai.');
      return;
    }
    if (recordHariIni) {
      alert('Presensi hari ini sudah ada.');
      return;
    }
    if (!qrToken) {
      alert('QR tidak valid.');
      return;
    }

    setIsSaving(true);
    try {
      const hasilLokasi = await verifikasiLokasiGuru();
      if (!hasilLokasi.ok) {
        alert(hasilLokasi.pesan);
        return;
      }

      const tanggalPresensi = hasilLokasi.tanggal;
      const ref = doc(db, 'absensi_guru', idDokumen(tanggalPresensi, guruIdSaya));
      await setDoc(ref, {
        tanggal: tanggalPresensi,
        guruId: guruIdSaya,
        namaGuru: guruProfile.nama || userData?.nama || 'Guru',
        nip: guruProfile.nip || '',
        status: 'Hadir',
        waktuMasuk: serverTimestamp(),
        waktuPulang: '',
        catatan: '',
        dicatatOlehUid: uidSaya,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        qrToken,
      });
      alert('Presensi masuk berhasil dicatat. Lokasi berada dalam radius sekolah.');
    } catch (error) {
      console.error('Gagal presensi masuk:', error);
      alert('Presensi masuk gagal. QR mungkin sudah kedaluwarsa atau data belum dapat disimpan.');
    } finally {
      setIsSaving(false);
    }
  }, [guruProfile, guruIdSaya, uidSaya, recordHariIni, userData?.nama]);

  const handlePresensiPulang = useCallback(async (qrToken: string) => {
    if (!recordHariIni || !guruIdSaya || !uidSaya) return;
    if (!recordHariIni.waktuMasuk || recordHariIni.waktuPulang) return;
    if (!qrToken) {
      alert('QR tidak valid.');
      return;
    }

    setIsSaving(true);
    try {
      const hasilLokasi = await verifikasiLokasiGuru();
      if (!hasilLokasi.ok) {
        alert(hasilLokasi.pesan);
        return;
      }

      await updateDoc(doc(db, 'absensi_guru', recordHariIni.id), {
        waktuPulang: serverTimestamp(),
        updatedAt: serverTimestamp(),
        qrTokenPulang: qrToken,
      });
      alert('Presensi pulang berhasil dicatat. Lokasi berada dalam radius sekolah.');
    } catch (error) {
      console.error('Gagal presensi pulang:', error);
      alert('Presensi pulang gagal. QR mungkin sudah kedaluwarsa atau data belum dapat disimpan.');
    } finally {
      setIsSaving(false);
    }
  }, [recordHariIni, guruIdSaya, uidSaya]);

  const handleQrTerbaca = useCallback((teksQr: string) => {
    if (!modeScan || scanLockRef.current) return;
    if (!teksQr.startsWith(PREFIX_QR_GURU)) {
      setErrorScan('QR tidak dikenali.');
      return;
    }
    const token = teksQr.slice(PREFIX_QR_GURU.length).trim();
    if (!/^[a-f0-9]{48}$/i.test(token)) {
      setErrorScan('Format QR tidak valid.');
      return;
    }

    scanLockRef.current = true;
    setScanBusy(true);
    setErrorScan('');
    const modeSaatIni = modeScan;
    setModeScan(null);

    void (async () => {
      try {
        if (modeSaatIni === 'masuk') {
          await handlePresensiMasuk(token);
        } else {
          await handlePresensiPulang(token);
        }
      } finally {
        scanLockRef.current = false;
        setScanBusy(false);
      }
    })();
  }, [modeScan, handlePresensiMasuk, handlePresensiPulang]);

  useEffect(() => {
    if (!isGuru || !modeScan) return;
    let scanner: Html5QrcodeScanner | null = null;
    const timer = window.setTimeout(() => {
      const target = document.getElementById('reader-absensi-guru');
      if (!target) return;
      scanner = new Html5QrcodeScanner(
        'reader-absensi-guru',
        { fps: 10, qrbox: { width: 230, height: 230 }, rememberLastUsedCamera: true },
        false
      );
      scanner.render(
        (decodedText) => handleQrTerbaca(decodedText),
        () => { }
      );
    }, 100);

    return () => {
      window.clearTimeout(timer);
      if (scanner) {
        void scanner.clear().catch((error) => {
          console.warn('Scanner QR berhenti:', error);
        });
      }
    };
  }, [isGuru, modeScan, handleQrTerbaca]);

  // ⬅️ REVISI: Tidak menggunakan deleteField(), gunakan string kosong ''
  const handleSimpanStatusManual = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) return;
    const guruDipilih = daftarGuru.find((item) => item.id === guruManualId);
    if (!guruDipilih || !tanggalManual) {
      alert('Pilih Guru dan tanggal.');
      return;
    }

    setIsSaving(true);
    const docRef = doc(db, 'absensi_guru', idDokumen(tanggalManual, guruDipilih.id));

    try {
      const docSnap = await getDoc(docRef);

      const dataToSave: Record<string, any> = {
        tanggal: tanggalManual,
        guruId: guruDipilih.id,
        namaGuru: guruDipilih.nama || 'Guru',
        nip: guruDipilih.nip || '',
        status: statusManual,
        catatan: catatanManual.trim(),
        dicatatOlehUid: uidSaya,
        updatedAt: serverTimestamp(),
        // Bersihkan field waktu & token dengan string kosong
        waktuMasuk: '',
        waktuPulang: '',
        qrToken: '',
        qrTokenPulang: '',
      };

      // createdAt hanya untuk dokumen baru. Jika sudah ada, createdAt
      // tidak disentuh agar tetap menjadi jejak waktu asli.
      if (!docSnap.exists()) {
        dataToSave.createdAt = serverTimestamp();
      }

      await setDoc(docRef, dataToSave, { merge: true });

      setCatatanManual('');
      alert(`Status ${statusManual} untuk ${guruDipilih.nama || 'Guru'} berhasil disimpan.`);
    } catch (error) {
      console.error('Gagal menyimpan status manual:', error);
      alert('Status kehadiran gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isGuru && loadingProfil) {
    return <div className="p-8 text-center font-semibold text-slate-500">Memuat profil Guru...</div>;
  }
  if (isGuru && !guruIdSaya) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#082B62]">Presensi Guru belum siap</h1>
        <p className="mt-2 text-sm text-slate-600">Akun Guru belum terhubung dengan Data Pegawai.</p>
      </div>
    );
  }
  if (isGuru && !guruProfile) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#082B62]">Data Pegawai tidak ditemukan</h1>
        <p className="mt-2 text-sm text-slate-600">{errorData || 'Profil Guru tidak ditemukan.'}</p>
      </div>
    );
  }
  if (!isGuru && !bolehMemantau) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Akses tidak tersedia.</div>;
  }

  return (
    <div className={`absensi-guru-page mx-auto max-w-7xl space-y-6 pb-10 ${isGuru ? 'absensi-guru-page--teacher' : 'absensi-guru-page--monitor'} ${printMode === 'poster' ? 'poster-mode-active' : ''}`}>
      <div className="page-heading flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#155EEF]">KEHADIRAN PEGAWAI</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#082B62] sm:text-3xl">
            {isGuru ? 'Presensi Saya' : 'Absensi Guru'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isGuru
              ? 'Catat waktu masuk dan pulang melalui akun Guru Anda.'
              : 'Pantau, kelola, dan cetak rekap kehadiran seluruh Guru.'}
          </p>
        </div>
        <div className={`page-month-filter flex flex-wrap items-center gap-2 no-print ${isGuru ? 'page-month-filter--teacher' : ''}`}>
          <label htmlFor="bulan-absensi-guru" className="text-sm font-semibold text-slate-600">Bulan rekap</label>
          <input
            id="bulan-absensi-guru"
            type="month"
            value={bulan}
            onChange={(event) => setBulan(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#155EEF] focus:ring-2 focus:ring-blue-100"
          />
          {bolehMemantau && (
            <button onClick={() => window.print()} className="rounded-xl bg-[#082B62] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#155EEF]">
              Cetak Rekap Bulanan
            </button>
          )}
        </div>
      </div>

      {errorData && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorData}</div>
      )}

      {isGuru && guruProfile && (
        <>
          <div className="guru-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="guru-profile-card rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nama Pegawai</p>
              <h2 className="mt-1 text-xl font-extrabold text-[#082B62]">{guruProfile.nama || userData?.nama || 'Guru'}</h2>
              <p className="mt-1 text-sm text-slate-500">NIP: {guruProfile.nip || '-'}</p>
              <p className="mt-1 text-sm text-slate-500">Jabatan: {guruProfile.jabatan || '-'}</p>
            </div>
            <div className="guru-date-card rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Tanggal Hari Ini</p>
              <p className="mt-2 text-lg font-extrabold text-emerald-900">{formatTanggal(tanggalHariIni)}</p>
              <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${kelasStatus(recordHariIni?.status)}`}>
                {recordHariIni?.status || 'Belum Presensi'}
              </span>
            </div>
          </div>

          <div className="guru-attendance-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-[#082B62]">Presensi Hari Ini</h2>
                <p className="mt-1 text-sm text-slate-500">Waktu dicatat otomatis oleh server Firebase (tidak dapat dimanipulasi).</p>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${kelasStatus(recordHariIni?.status)}`}>
                {recordHariIni?.status || 'Belum Presensi'}
              </span>
            </div>
            <div className="guru-time-grid grid grid-cols-1 gap-4 py-5 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">Waktu Masuk</p>
                <p className="mt-1 text-2xl font-extrabold text-[#082B62]">{formatJam(recordHariIni?.waktuMasuk, zonaWaktuSekolah)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">Waktu Pulang</p>
                <p className="mt-1 text-2xl font-extrabold text-[#082B62]">{formatJam(recordHariIni?.waktuPulang, zonaWaktuSekolah)}</p>
              </div>
            </div>
            <div className="guru-action-buttons flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => { setErrorScan(''); setModeScan('masuk'); }}
                disabled={isSaving || scanBusy || Boolean(recordHariIni) || loadingData}
                className="flex-1 rounded-xl bg-emerald-600 px-5 py-3 font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {scanBusy && modeScan === 'masuk' ? 'Memproses...' : '▦ Scan QR — Presensi Masuk'}
              </button>
              <button
                type="button"
                onClick={() => { setErrorScan(''); setModeScan('pulang'); }}
                disabled={isSaving || scanBusy || !recordHariIni?.waktuMasuk || Boolean(recordHariIni?.waktuPulang) || recordHariIni?.status !== 'Hadir'}
                className="flex-1 rounded-xl bg-[#155EEF] px-5 py-3 font-extrabold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                ↗ Scan QR — Presensi Pulang
              </button>
            </div>

            {modeScan && (
              <div className="guru-scanner-panel mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-extrabold text-[#082B62]">
                      {modeScan === 'masuk' ? 'Pindai QR untuk Presensi Masuk' : 'Pindai QR untuk Presensi Pulang'}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">Arahkan kamera HP ke QR dinamis yang sedang ditampilkan Admin di sekolah.</p>
                  </div>
                  <button type="button" onClick={() => setModeScan(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Tutup Kamera</button>
                </div>
                <div id="reader-absensi-guru" className="mx-auto max-w-md overflow-hidden rounded-xl bg-white" />
                {errorScan && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorScan}</p>}
                <p className="mt-3 text-xs text-slate-500">Kamera memerlukan izin akses. Untuk penggunaan melalui internet, aplikasi harus dibuka menggunakan HTTPS.</p>
              </div>
            )}

            <p className="mt-3 text-xs leading-relaxed text-slate-500">Presensi masuk dan pulang memerlukan QR dinamis dari Admin serta lokasi GPS dalam radius sekolah. Pemeriksaan GPS hanya berlangsung saat presensi; koordinat perangkat tidak disimpan ke Firestore. Setiap Guru hanya dapat mencatat satu kali masuk dan satu kali pulang per hari.</p>
          </div>

          <div className="guru-history-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold text-[#082B62]">Riwayat Presensi Bulan Ini</h2>
            <p className="mt-1 text-sm text-slate-500">{bulan}</p>
            {loadingData ? (
              <p className="py-8 text-center text-sm text-slate-500">Memuat riwayat presensi...</p>
            ) : recordsBulan.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Belum ada catatan presensi pada bulan ini.</p>
            ) : (
              <>
              <div className="guru-history-mobile mt-4 space-y-3">
                {recordsBulan.map((item) => (
                  <article key={`mobile-${item.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[#082B62]">{formatTanggal(item.tanggal)}</p>
                        <p className="mt-1 text-xs text-slate-500">Catatan kehadiran</p>
                      </div>
                      <span className={`shrink-0 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${kelasStatus(item.status)}`}>{item.status}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white p-2.5">
                        <p className="text-[11px] font-semibold text-slate-500">Masuk</p>
                        <p className="mt-1 text-sm font-extrabold text-[#082B62]">{formatJam(item.waktuMasuk, zonaWaktuSekolah)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5">
                        <p className="text-[11px] font-semibold text-slate-500">Pulang</p>
                        <p className="mt-1 text-sm font-extrabold text-[#082B62]">{formatJam(item.waktuPulang, zonaWaktuSekolah)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="guru-history-desktop mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="p-3">Tanggal</th><th className="p-3">Status</th><th className="p-3">Masuk</th><th className="p-3">Pulang</th></tr>
                  </thead>
                  <tbody>
                    {recordsBulan.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="p-3 font-semibold text-slate-700">{formatTanggal(item.tanggal)}</td>
                        <td className="p-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${kelasStatus(item.status)}`}>{item.status}</span></td>
                        <td className="p-3 text-slate-600">{formatJam(item.waktuMasuk, zonaWaktuSekolah)}</td>
                        <td className="p-3 text-slate-600">{formatJam(item.waktuPulang, zonaWaktuSekolah)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </>
      )}

      {bolehMemantau && (
        <div className={`space-y-5 print-area ${printMode === 'poster' ? 'report-hidden-for-poster' : ''}`}>
          <div className="print-only-header">
            <p className="print-report-kicker">APLIKASI ADMINISTRASI SEKOLAH DIGITAL</p>
            <h1>{namaSekolah || 'Identitas Sekolah'}</h1>
            {alamatSekolah && <p className="print-school-address">{alamatSekolah}</p>}
            <div className="print-header-divider" />
            <h2>REKAP KEHADIRAN GURU</h2>
            <p className="print-period-label">PERIODE: {labelPeriodeCetak}</p>
          </div>
          {isAdmin && (
            <section className="admin-qr-panel no-print rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="admin-qr-layout flex flex-col gap-5 md:flex-row md:items-center">
                <div className="admin-qr-content flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#155EEF]">QR DINAMIS SEKOLAH</p>
                  <h2 className="mt-1 text-xl font-extrabold text-[#082B62]">Kode Presensi Guru</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Tampilkan QR ini di layar sekolah. Guru memindainya melalui menu Presensi Saya. QR hanya berubah ketika Admin menekan tombol buat QR baru dan berlaku maksimal 8 jam.</p>
                  {qrError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{qrError}</p>}
                  {!qrError && (
                    <p className="mt-3 text-sm font-semibold text-slate-600">
                      {qrGenerating ? 'Sedang membuat QR...' : qrSecondsLeft > 0 ? `QR aktif — kedaluwarsa dalam ${Math.floor(qrSecondsLeft / 3600)} jam ${Math.floor((qrSecondsLeft % 3600) / 60)} menit` : 'Belum ada QR aktif. Admin perlu membuat QR baru.'}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">Jangan menggunakan tangkapan layar QR lama. Guru harus memindai kode yang sedang tampil.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleBuatQrBaru}
                      disabled={qrGenerating || !lokasiSekolahSiap}
                      className="rounded-xl bg-[#155EEF] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {qrGenerating ? 'Membuat QR...' : !lokasiSekolahSiap ? 'Atur Lokasi Sekolah Dahulu' : tokenQrAdmin && qrSecondsLeft > 0 ? 'Buat QR Baru' : 'Buat QR Presensi'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintMode('poster')}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#082B62] hover:bg-slate-50"
                    >
                      Cetak Poster QR
                    </button>
                  </div>
                  {!lokasiSekolahSiap && (
                    <p className="mt-2 text-xs font-semibold text-amber-700">Simpan koordinat dan radius pada menu Pengaturan Sekolah sebelum membuat QR presensi.</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">Cetak poster setelah aplikasi dipublikasikan menggunakan alamat HTTPS resmi, bukan localhost.</p>
                </div>
                <div className="admin-qr-display flex min-h-[250px] min-w-[250px] items-center justify-center rounded-2xl border border-blue-100 bg-slate-50 p-4">
                  {tokenQrAdmin && qrSecondsLeft > 0 ? (
                    <div className="admin-qr-display-inner rounded-2xl bg-white p-3 text-center shadow-sm">
                      <QRCodeSVG className="admin-dynamic-qr" value={`${PREFIX_QR_GURU}${tokenQrAdmin}`} size={210} level="H" includeMargin />
                      <p className="mt-2 text-xs font-extrabold tracking-wide text-[#082B62]">SCAN ABSENSI GURU</p>
                      <p className="mt-1 text-[10px] text-slate-500">Gunakan QR yang sedang aktif</p>
                    </div>
                  ) : (
                    <div className="text-center text-sm font-semibold text-slate-400">
                      <div className="mx-auto mb-2 text-3xl">▦</div>
                      QR belum aktif
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          <div className="monthly-stat-cards grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Hadir', value: totalHadir, tone: 'text-emerald-700 border-emerald-100' },
              { label: 'Izin', value: totalIzin, tone: 'text-blue-700 border-blue-100' },
              { label: 'Sakit', value: totalSakit, tone: 'text-amber-700 border-amber-100' },
              { label: 'Dinas Luar', value: totalDinas, tone: 'text-violet-700 border-violet-100' },
              { label: 'Alpa', value: totalAlpa, tone: 'text-red-700 border-red-100' },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border bg-white p-4 shadow-sm ${item.tone}`}>
                <p className="text-xs font-bold">{item.label}</p>
                <p className="mt-1 text-2xl font-extrabold">{item.value}</p>
                <p className="text-[11px] text-slate-400">catatan bulan ini</p>
              </div>
            ))}
          </div>

          {isAdmin && (
            <form onSubmit={handleSimpanStatusManual} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm no-print">
              <div className="mb-4">
                <h2 className="text-lg font-extrabold text-[#082B62]">Input Status Izin / Ketidakhadiran</h2>
                <p className="mt-1 text-sm text-slate-500">Admin dapat mencatat Izin, Sakit, Dinas Luar, atau Alpa apabila Guru belum melakukan presensi mandiri.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-semibold text-slate-600">Nama Guru
                  <select value={guruManualId} onChange={(event) => setGuruManualId(event.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5">
                    <option value="">Pilih Guru</option>
                    {daftarGuru.map((item) => <option key={item.id} value={item.id}>{item.nama || item.id}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-600">Tanggal
                  <input type="date" value={tanggalManual} onChange={(event) => setTanggalManual(event.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 p-2.5" />
                </label>
                <label className="text-sm font-semibold text-slate-600">Status
                  <select value={statusManual} onChange={(event) => setStatusManual(event.target.value as Exclude<StatusGuru, 'Hadir'>)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5">
                    <option value="Izin">Izin</option><option value="Sakit">Sakit</option><option value="Dinas Luar">Dinas Luar</option><option value="Alpa">Alpa</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-600">Catatan
                  <input value={catatanManual} onChange={(event) => setCatatanManual(event.target.value)} placeholder="Opsional" maxLength={250} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5" />
                </label>
              </div>
              <button type="submit" disabled={isSaving || !guruManualId || daftarGuru.length === 0} className="mt-4 rounded-xl bg-[#155EEF] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {isSaving ? 'Menyimpan...' : 'Simpan Status'}
              </button>
            </form>
          )}

          <div className="print-report-section rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="print-section-heading text-lg font-extrabold text-[#082B62]"><span className="print-only-letter">A. </span>Rekap Kehadiran Bulanan per Guru</h2>
                <p className="print-screen-meta mt-1 text-sm text-slate-500">Periode {bulan}. Status tanpa catatan ditampilkan sebagai belum tercatat, bukan otomatis Alpa.</p>
              </div>
              <p className="print-screen-meta text-xs text-slate-500">Jumlah Guru: {daftarGuru.length}</p>
            </div>
            {loadingData ? (
              <p className="py-8 text-center text-sm text-slate-500">Memuat rekap kehadiran...</p>
            ) : daftarGuru.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Belum ada Data Pegawai.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr><th className="p-3">No</th><th className="p-3">Nama Guru</th><th className="p-3">NIP</th><th className="p-3 text-center">Hadir</th><th className="p-3 text-center">Izin</th><th className="p-3 text-center">Sakit</th><th className="p-3 text-center">Dinas</th><th className="p-3 text-center">Alpa</th><th className="p-3 text-center">Tercatat</th></tr>
                  </thead>
                  <tbody>
                    {rekapGuru.map((item, index) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="p-3 text-slate-500">{index + 1}</td>
                        <td className="p-3 font-bold text-[#082B62]">{item.nama || '-'}</td>
                        <td className="p-3 text-slate-500">{item.nip || '-'}</td>
                        <td className="p-3 text-center font-bold text-emerald-700">{item.hadir}</td>
                        <td className="p-3 text-center text-blue-700">{item.izin}</td>
                        <td className="p-3 text-center text-amber-700">{item.sakit}</td>
                        <td className="p-3 text-center text-violet-700">{item.dinas}</td>
                        <td className="p-3 text-center text-red-700">{item.alpa}</td>
                        <td className="p-3 text-center font-bold text-slate-700">{item.tercatat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="print-report-section print-details-section rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="print-section-heading text-lg font-extrabold text-[#082B62]"><span className="print-only-letter">B. </span>Rincian Catatan Kehadiran</h2>
            {loadingData ? (
              <p className="py-8 text-center text-sm text-slate-500">Memuat catatan...</p>
            ) : recordsBulan.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Belum ada catatan kehadiran pada periode ini.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="print-only-cell p-3">No</th><th className="p-3">Tanggal</th><th className="p-3">Nama Guru</th><th className="p-3">NIP</th><th className="p-3">Status</th><th className="p-3">Masuk</th><th className="p-3">Pulang</th><th className="p-3">Catatan</th></tr>
                  </thead>
                  <tbody>
                    {recordsBulan.map((item, index) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="print-only-cell p-3 text-center">{index + 1}</td>
                        <td className="p-3 whitespace-nowrap text-slate-600">{formatTanggal(item.tanggal)}</td>
                        <td className="p-3 font-semibold text-[#082B62]">{item.namaGuru || '-'}</td>
                        <td className="p-3 text-slate-500">{item.nip || '-'}</td>
                        <td className="p-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${kelasStatus(item.status)}`}>{item.status}</span></td>
                        <td className="p-3 text-slate-600">{formatJam(item.waktuMasuk, zonaWaktuSekolah)}</td>
                        <td className="p-3 text-slate-600">{formatJam(item.waktuPulang, zonaWaktuSekolah)}</td>
                        <td className="p-3 text-slate-500">{item.catatan || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="print-signature">
            <p>{`${lokasiPengesahan}, ${tanggalPengesahan}`}</p>
            <p className="print-signature-role">Kepala Sekolah</p>
            <div className="signature-space" />
            <p className="signature-name">{kepalaSekolah || '........................................'}</p>
          </div>
        </div>
      )}

      {printMode === 'poster' && (
        <section className="poster-print-area poster-print-active">
          <div className="poster-frame">
            <p className="poster-kicker">APLIKASI ADMINISTRASI SEKOLAH DIGITAL</p>
            <h1>{namaSekolah || 'PRESENSI GURU'}</h1>
            <p className="poster-subtitle">Sistem Kehadiran Guru Terintegrasi</p>
            <div className="poster-divider" />
            <h2>AKSES PRESENSI GURU</h2>
            <p className="poster-instruction">Pindai kode QR untuk membuka halaman aplikasi sekolah.</p>
            <div className="poster-code">
              <QRCodeSVG className="poster-qr-code" value={window.location.origin} size={230} level="H" includeMargin />
            </div>
            <p className="poster-url">{window.location.origin}</p>
            <div className="poster-steps">
              <p><strong>LANGKAH PRESENSI</strong></p>
              <p>1. Pindai QR Code menggunakan kamera HP.</p>
              <p>2. Masuk menggunakan akun Guru masing-masing.</p>
              <p>3. Buka menu Presensi Guru.</p>
              <p>4. Pindai QR dinamis yang ditampilkan Admin untuk presensi masuk atau pulang.</p>
            </div>
            <p className="poster-note">QR poster hanya membuka halaman aplikasi, bukan mencatat kehadiran. Presensi masuk dan pulang tetap menggunakan QR dinamis yang dibuat Admin. Cetak dan pasang poster setelah aplikasi menggunakan alamat HTTPS resmi.</p>
          </div>
        </section>
      )}

      <style>{`
        .print-only-header,
        .print-only-letter,
        .print-only-cell,
        .poster-print-area,
        .print-signature,
        .guru-history-mobile { display: none; }

        .admin-qr-panel {
          background: linear-gradient(135deg, #ffffff 0%, #f5f8ff 100%);
          border-color: #dbeafe;
        }
        .admin-qr-display {
          width: 270px;
          min-width: 270px;
          min-height: 270px;
          background: radial-gradient(circle at top, #eff6ff 0%, #f8fafc 70%);
        }
        .admin-qr-display-inner {
          border: 1px solid #e2e8f0;
        }
        .admin-dynamic-qr { display: block; max-width: 100%; height: auto; }

        @media (max-width: 640px) {
          .absensi-guru-page--teacher {
            width: 100%;
            max-width: none;
            padding: 0 12px 22px;
            margin: 0;
            gap: 14px;
          }
          .absensi-guru-page--teacher .page-heading {
            gap: 12px;
          }
          .absensi-guru-page--teacher .page-heading h1 {
            font-size: 25px;
            line-height: 1.15;
          }
          .absensi-guru-page--teacher .page-heading > div:first-child > p:first-child {
            font-size: 10px;
            letter-spacing: .08em;
          }
          .page-month-filter--teacher {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            background: #fff;
          }
          .page-month-filter--teacher label {
            font-size: 12px;
            white-space: nowrap;
          }
          .page-month-filter--teacher input {
            width: 100%;
            min-width: 0;
          }
          .guru-summary-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 11px !important;
          }
          .guru-profile-card,
          .guru-date-card {
            grid-column: 1 / -1 !important;
            padding: 15px !important;
            border-radius: 17px !important;
          }
          .guru-profile-card h2 {
            font-size: 19px !important;
            line-height: 1.25;
            overflow-wrap: anywhere;
          }
          .guru-date-card {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            column-gap: 10px;
          }
          .guru-date-card > p:first-child {
            grid-column: 1 / -1;
          }
          .guru-date-card > p:nth-child(2) {
            margin-top: 5px !important;
            font-size: 17px !important;
          }
          .guru-date-card > span {
            margin-top: 5px !important;
          }
          .guru-attendance-card,
          .guru-history-panel {
            padding: 15px !important;
            border-radius: 18px !important;
          }
          .guru-attendance-card h2,
          .guru-history-panel h2 {
            font-size: 17px !important;
          }
          .guru-attendance-card > div:first-child p {
            font-size: 12px;
            line-height: 1.5;
          }
          .guru-time-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 9px !important;
            padding-top: 15px !important;
            padding-bottom: 15px !important;
          }
          .guru-time-grid > div {
            min-width: 0;
            padding: 11px !important;
          }
          .guru-time-grid > div p:first-child {
            font-size: 11px !important;
          }
          .guru-time-grid > div p:last-child {
            font-size: 21px !important;
            overflow-wrap: anywhere;
          }
          .guru-action-buttons {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 9px !important;
          }
          .guru-action-buttons button {
            min-height: 48px;
            width: 100%;
            padding: 12px 13px !important;
            border-radius: 13px !important;
            font-size: 13px;
            line-height: 1.35;
          }
          .guru-scanner-panel {
            padding: 12px !important;
          }
          .guru-scanner-panel #reader-absensi-guru {
            width: 100%;
            max-width: 100%;
          }
          .guru-scanner-panel #reader-absensi-guru video {
            width: 100% !important;
            height: auto !important;
            object-fit: cover;
          }
          .guru-history-desktop { display: none !important; }
          .guru-history-mobile {
            display: grid !important;
            gap: 10px;
          }
          .guru-history-mobile article {
            border-radius: 13px;
          }
          .guru-history-mobile article > div:first-child {
            align-items: center;
          }
          .guru-history-mobile article p {
            overflow-wrap: anywhere;
          }
          .admin-qr-layout {
            flex-direction: column;
            align-items: stretch;
          }
          .admin-qr-display {
            width: 100%;
            min-width: 0;
            min-height: 0;
            padding: 12px !important;
          }
          .admin-dynamic-qr {
            width: min(210px, 68vw);
            height: auto;
          }
        }

        @media print {
          @page report {
            size: A4 landscape;
            margin: 10mm;
          }
          @page poster {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body, #root {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }
          body * { visibility: hidden !important; }
          .absensi-guru-page {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .absensi-guru-page > *:not(.print-area) {
            display: none !important;
          }
          .print-area,
          .print-area * {
            visibility: visible !important;
          }
          .print-area {
            page: report;
            display: block !important;
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .report-hidden-for-poster { display: none !important; }
          .print-only-header {
            display: block !important;
            visibility: visible !important;
            margin: 0 0 7mm !important;
            padding: 0 0 4mm !important;
            border-bottom: 2px solid #082B62;
            text-align: center;
            break-after: avoid;
            page-break-after: avoid;
          }
          .print-only-header * { visibility: visible !important; }
          .print-report-kicker {
            margin: 0 0 1.5mm !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
            letter-spacing: 1.2pt;
            font-weight: 800 !important;
            color: #155EEF !important;
          }
          .print-only-header h1 {
            margin: 0 !important;
            font-size: 18pt !important;
            line-height: 1.2 !important;
            font-weight: 800 !important;
            color: #082B62 !important;
          }
          .print-only-header .print-school-address {
            margin: 1.5mm 0 0 !important;
            font-size: 9pt !important;
            line-height: 1.3 !important;
            font-weight: 500 !important;
            color: #334155 !important;
          }
          .print-header-divider {
            width: 100%;
            height: 0;
            margin: 3mm 0 2.5mm;
            border-top: 1px solid #082B62;
          }
          .print-only-header h2 {
            margin: 0 !important;
            font-size: 16pt !important;
            line-height: 1.2 !important;
            font-weight: 900 !important;
            letter-spacing: .3pt;
            color: #0f172a !important;
          }
          .print-only-header .print-period-label {
            display: inline-block;
            margin: 2mm 0 0 !important;
            padding: 1.5mm 8mm !important;
            border-radius: 20mm;
            background: #e8f2ff !important;
            color: #082B62 !important;
            font-size: 10pt !important;
            line-height: 1.2 !important;
            font-weight: 800 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-area .no-print { display: none !important; }
          .monthly-stat-cards { display: none !important; }
          .print-screen-meta { display: none !important; }
          .print-only-letter { display: inline !important; }
          .print-only-cell { display: table-cell !important; }
          .print-report-section {
            margin: 0 0 6mm !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            break-inside: auto;
            page-break-inside: auto;
          }
          .print-report-section > div:first-child {
            margin: 0 0 2.5mm !important;
          }
          .print-section-heading {
            margin: 0 0 2mm !important;
            color: #0f172a !important;
            font-size: 11.5pt !important;
            line-height: 1.25 !important;
            font-weight: 800 !important;
            break-after: avoid;
            page-break-after: avoid;
          }
          .print-details-section .print-section-heading { margin-bottom: 2.5mm !important; }
          .print-details-section td span {
            background: transparent !important;
            color: #1e293b !important;
            border: 0 !important;
            border-radius: 0 !important;
            padding: 0 !important;
            font-weight: 500 !important;
          }
          .print-area .rounded-2xl,
          .print-area .rounded-xl {
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .print-area .overflow-x-auto {
            overflow: visible !important;
            width: 100% !important;
          }
          .print-area table {
            display: table !important;
            width: 100% !important;
            min-width: 0 !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
            font-size: 8.2pt !important;
          }
          .print-area thead { display: table-header-group !important; }
          .print-area tfoot { display: table-footer-group !important; }
          .print-area th,
          .print-area td {
            border: 1px solid #94a3b8 !important;
            padding: 2.1mm 1.8mm !important;
            font-size: 8pt !important;
            line-height: 1.25 !important;
            color: #1e293b !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            vertical-align: middle !important;
          }
          .print-area th {
            background: #e8f2ff !important;
            color: #082B62 !important;
            font-weight: 800 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-area tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-area .print-signature {
            display: block !important;
            visibility: visible !important;
            width: 72mm;
            margin: 8mm 3mm 0 auto !important;
            text-align: center;
            font-size: 9pt;
            line-height: 1.45;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-area .print-signature * { visibility: visible !important; }
          .print-signature-role { margin-top: 1mm; }
          .signature-space { height: 20mm; }
          .signature-name {
            font-weight: 700;
            text-decoration: underline;
          }
          .no-print { display: none !important; }

          .poster-print-area,
          .poster-print-area * {
            visibility: visible !important;
          }
          .poster-print-area {
            page: poster;
            display: none !important;
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }
          .poster-frame {
            box-sizing: border-box;
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            padding: 10mm;
            border: 2.5px solid #082B62;
            border-radius: 5mm;
            text-align: center;
            color: #082B62;
            background: #fff !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .poster-kicker {
            margin: 0;
            font-size: 8.5pt;
            font-weight: 900;
            letter-spacing: 1.5px;
            color: #155EEF;
          }
          .poster-frame h1 {
            margin-top: 5mm;
            font-size: 23pt;
            line-height: 1.15;
            font-weight: 900;
            overflow-wrap: anywhere;
          }
          .poster-subtitle {
            margin-top: 2mm;
            font-size: 10pt;
            color: #475569;
          }
          .poster-divider {
            width: 24mm;
            height: 1.2mm;
            margin: 5mm auto;
            border-radius: 5mm;
            background: #155EEF;
          }
          .poster-frame h2 {
            margin-top: 0;
            font-size: 17pt;
            font-weight: 900;
          }
          .poster-instruction {
            margin-top: 2mm;
            font-size: 9.5pt;
            color: #475569;
          }
          .poster-code {
            display: flex;
            justify-content: center;
            margin: 5mm auto 3mm;
            padding: 3mm;
          }
          .poster-qr-code {
            display: block;
            width: 58mm !important;
            height: 58mm !important;
            max-width: 100%;
          }
          .poster-url {
            margin-top: 1mm;
            font-size: 9pt;
            font-weight: 800;
            overflow-wrap: anywhere;
          }
          .poster-steps {
            margin: 5mm auto 0;
            max-width: 145mm;
            padding: 4mm 6mm;
            border: 1px solid #dbeafe;
            border-radius: 3mm;
            background: #f8fbff !important;
            text-align: left;
            font-size: 9pt;
            line-height: 1.5;
          }
          .poster-note {
            margin-top: 4mm;
            padding: 3mm;
            border: 1px solid #cbd5e1;
            border-radius: 2mm;
            font-size: 7.5pt;
            line-height: 1.35;
            color: #475569;
          }
        }

        @media print {
          .poster-mode-active .poster-print-area,
          .poster-print-area.poster-print-active {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}