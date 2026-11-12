import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type Notifikasi = {
  id: string;
  judul?: string;
  pesan?: string;
  tipe?: string;
  dibaca?: boolean;
  dibuatPada?: any;
  tautan?: string;
};

function waktu(value: any): string {
  try {
    const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Waktu tidak tersedia';
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Waktu tidak tersedia';
  }
}

function ikon(tipe?: string) {
  if (tipe === 'jurnal_disetujui') return { simbol: '✓', warna: 'bg-emerald-50 text-emerald-700' };
  if (tipe === 'jurnal_revisi') return { simbol: '↻', warna: 'bg-amber-50 text-amber-700' };
  if (tipe === 'jurnal_dikirim') return { simbol: '▤', warna: 'bg-blue-50 text-blue-700' };
  if (tipe === 'pengumuman') return { simbol: '!', warna: 'bg-violet-50 text-violet-700' };
  return { simbol: 'i', warna: 'bg-slate-100 text-slate-700' };
}

export default function NotificationBell() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Notifikasi[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const uid = userData?.uid;

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const q = query(
      collection(db, 'users', uid, 'notifikasi'),
      orderBy('dibuatPada', 'desc'),
      limit(30)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        setItems(snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Notifikasi[]);
        setLoading(false);
        setError('');
      },
      (err) => {
        console.error('Gagal memuat notifikasi:', err);
        setError('Notifikasi belum dapat dimuat. Periksa koneksi dan aturan akses Firestore.');
        setLoading(false);
      }
    );
  }, [uid]);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const unread = useMemo(
    () => items.filter((item) => item.dibaca !== true).length,
    [items]
  );

  const markRead = async (item: Notifikasi) => {
    if (!uid || item.dibaca === true) return true;
    setSavingId(item.id);
    try {
      await updateDoc(doc(db, 'users', uid, 'notifikasi', item.id), {
        dibaca: true,
        dibacaPada: serverTimestamp(),
      });
      return true;
    } catch (err) {
      console.error('Gagal menandai notifikasi:', err);
      alert('Notifikasi belum dapat ditandai sudah dibaca. Periksa aturan Firestore.');
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const openNotification = async (item: Notifikasi) => {
    if (!await markRead(item)) return;
    setIsOpen(false);
    if (typeof item.tautan === 'string' && item.tautan.startsWith('/') && !item.tautan.startsWith('//')) {
      navigate(item.tautan);
    }
  };

  const markAllRead = async () => {
    if (!uid || unread === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const batch = writeBatch(db);
      items.filter((item) => item.dibaca !== true).forEach((item) => {
        batch.update(doc(db, 'users', uid, 'notifikasi', item.id), {
          dibaca: true,
          dibacaPada: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Gagal menandai semua notifikasi:', err);
      alert('Semua notifikasi belum dapat ditandai. Silakan coba kembali.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative rounded-full p-2 text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
        aria-label={`Notifikasi, ${unread} belum dibaca`}
        aria-expanded={isOpen}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#082B62] bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div role="dialog" aria-label="Daftar pemberitahuan" className="absolute right-0 z-[100] mt-3 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="font-bold text-[#082B62]">Pemberitahuan</h3>
              <p className="mt-0.5 text-xs text-slate-500">{unread} belum dibaca · 30 terbaru</p>
            </div>
            <button type="button" onClick={markAllRead} disabled={unread === 0 || markingAll} className="text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:text-slate-400">
              {markingAll ? 'Memproses...' : 'Tandai semua dibaca'}
            </button>
          </div>
          <div className="max-h-[min(70vh,440px)] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Memuat pemberitahuan...</div>
            ) : error ? (
              <div className="p-5 text-sm text-amber-800">{error}</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">Belum ada pemberitahuan</p>
                <p className="mt-1 text-xs text-slate-500">Informasi yang ditujukan kepada akun Anda akan muncul di sini.</p>
              </div>
            ) : (
              items.map((item) => {
                const mark = ikon(item.tipe);
                const isUnread = item.dibaca !== true;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openNotification(item)}
                    disabled={savingId === item.id}
                    className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 ${isUnread ? 'bg-blue-50/50' : 'bg-white'}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${mark.warna}`}>{mark.simbol}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={`text-sm ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{item.judul || 'Pemberitahuan sekolah'}</span>
                        {isUnread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                      </span>
                      <span className="mt-1 block whitespace-normal text-xs leading-relaxed text-slate-600">{item.pesan || 'Ada informasi baru untuk Anda.'}</span>
                      <span className="mt-1.5 block text-[11px] text-slate-400">{waktu(item.dibuatPada)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-500">Notifikasi hanya terlihat oleh akun penerima.</div>
        </div>
      )}
    </div>
  );
}
