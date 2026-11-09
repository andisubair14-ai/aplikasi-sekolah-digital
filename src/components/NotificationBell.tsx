import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type NotificationRecord = {
  id: string;
  judul?: string;
  pesan?: string;
  tipe?: string;
  dibaca?: boolean;
  dibuatPada?: any;
  tautan?: string;
  referensiId?: string;
};

const waktuNotifikasi = (value: any): string => {
  try {
    const date = value?.toDate
      ? value.toDate()
      : value instanceof Date
        ? value
        : value
          ? new Date(value)
          : null;

    if (!date || Number.isNaN(date.getTime())) return 'Waktu tidak tersedia';

    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Waktu tidak tersedia';
  }
};

const ikonNotifikasi = (tipe?: string) => {
  switch (tipe) {
    case 'jurnal_disetujui':
      return { simbol: '✓', warna: 'bg-emerald-50 text-emerald-700' };
    case 'jurnal_revisi':
      return { simbol: '↻', warna: 'bg-amber-50 text-amber-700' };
    case 'jurnal_dikirim':
      return { simbol: '▤', warna: 'bg-blue-50 text-blue-700' };
    case 'pengumuman':
      return { simbol: '!', warna: 'bg-violet-50 text-violet-700' };
    default:
      return { simbol: 'i', warna: 'bg-slate-100 text-slate-700' };
  }
};

export default function NotificationBell() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [notifikasi, setNotifikasi] = useState<NotificationRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userData?.uid) {
      setNotifikasi([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const q = query(
      collection(db, 'users', userData.uid, 'notifikasi'),
      orderBy('dibuatPada', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as NotificationRecord[];
        setNotifikasi(data);
        setLoading(false);
        setError('');
      },
      (snapshotError) => {
        console.error('Gagal memuat notifikasi:', snapshotError);
        setError('Notifikasi belum dapat dimuat. Periksa aturan akses Firestore.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userData?.uid]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const jumlahBelumDibaca = useMemo(
    () => notifikasi.filter((item) => item.dibaca !== true).length,
    [notifikasi]
  );

  const tandaiDibaca = async (item: NotificationRecord) => {
    if (!userData?.uid || item.dibaca === true) return;

    setUpdatingId(item.id);
    try {
      await updateDoc(doc(db, 'users', userData.uid, 'notifikasi', item.id), {
        dibaca: true,
        dibacaPada: serverTimestamp(),
      });
    } catch (updateError) {
      console.error('Gagal menandai notifikasi:', updateError);
      alert('Notifikasi belum dapat ditandai sudah dibaca. Periksa aturan Firestore.');
    } finally {
      setUpdatingId(null);
    }
  };

  const bukaNotifikasi = async (item: NotificationRecord) => {
    await tandaiDibaca(item);
    setIsOpen(false);

    const tujuan = typeof item.tautan === 'string' && item.tautan.startsWith('/')
      ? item.tautan
      : null;
    if (tujuan) navigate(tujuan);
  };

  const tandaiSemuaDibaca = async () => {
    if (!userData?.uid || jumlahBelumDibaca === 0) return;

    setIsMarkingAll(true);
    try {
      const batch = writeBatch(db);
      notifikasi
        .filter((item) => item.dibaca !== true)
        .forEach((item) => {
          batch.update(doc(db, 'users', userData.uid, 'notifikasi', item.id), {
            dibaca: true,
            dibacaPada: serverTimestamp(),
          });
        });
      await batch.commit();
    } catch (updateError) {
      console.error('Gagal menandai semua notifikasi:', updateError);
      alert('Semua notifikasi belum dapat ditandai. Silakan coba kembali.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative rounded-full p-2 text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
        aria-label={`Notifikasi, ${jumlahBelumDibaca} belum dibaca`}
        aria-expanded={isOpen}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {jumlahBelumDibaca > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#082B62] bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {jumlahBelumDibaca > 99 ? '99+' : jumlahBelumDibaca}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-[100] mt-3 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="font-bold text-[#082B62]">Pemberitahuan</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {jumlahBelumDibaca} belum dibaca · 30 terbaru
              </p>
            </div>
            <button
              type="button"
              onClick={tandaiSemuaDibaca}
              disabled={jumlahBelumDibaca === 0 || isMarkingAll}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isMarkingAll ? 'Memproses...' : 'Tandai semua dibaca'}
            </button>
          </div>

          <div className="max-h-[min(70vh,440px)] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Memuat pemberitahuan...</div>
            ) : error ? (
              <div className="p-5 text-sm text-amber-800">{error}</div>
            ) : notifikasi.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-12 0v3.2a2 2 0 01-.6 1.4L4 17h16M9 17v1a3 3 0 006 0v-1" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">Belum ada pemberitahuan</p>
                <p className="mt-1 text-xs text-slate-500">Informasi penting akan muncul di sini.</p>
              </div>
            ) : (
              notifikasi.map((item) => {
                const ikon = ikonNotifikasi(item.tipe);
                const belumDibaca = item.dibaca !== true;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => bukaNotifikasi(item)}
                    disabled={updatingId === item.id}
                    className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 ${belumDibaca ? 'bg-blue-50/50' : 'bg-white'}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${ikon.warna}`}>
                      {ikon.simbol}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={`text-sm ${belumDibaca ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                          {item.judul || 'Pemberitahuan sekolah'}
                        </span>
                        {belumDibaca && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                      </span>
                      <span className="mt-1 block whitespace-normal text-xs leading-relaxed text-slate-600">
                        {item.pesan || 'Ada informasi baru untuk Anda.'}
                      </span>
                      <span className="mt-1.5 block text-[11px] text-slate-400">
                        {waktuNotifikasi(item.dibuatPada)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-500">
            Notifikasi hanya terlihat oleh akun penerima.
          </div>
        </div>
      )}
    </div>
  );
}
