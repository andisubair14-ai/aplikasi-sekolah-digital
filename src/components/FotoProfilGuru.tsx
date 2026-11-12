import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface FotoProfilGuruProps {
  uid?: string | null;
  nama?: string | null;
  className?: string;
  previewUrl?: string | null;
}

/**
 * Menampilkan foto dari koleksi foto_profil_guru/{uid}.
 * Listener real-time membuat foto yang baru diganti langsung tampil
 * di halaman Profil, Dashboard Guru, dan header aplikasi.
 */
export default function FotoProfilGuru({
  uid,
  nama,
  className = 'h-20 w-20',
  previewUrl,
}: FotoProfilGuruProps) {
  const [fotoTersimpan, setFotoTersimpan] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setFotoTersimpan(null);
      return;
    }

    const berhenti = onSnapshot(
      doc(db, 'foto_profil_guru', uid),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : null;
        const foto = data?.fotoDataUrl;
        setFotoTersimpan(typeof foto === 'string' && foto.startsWith('data:image/jpeg;base64,') ? foto : null);
      },
      (error) => {
        console.warn('Foto profil Guru belum dapat dibaca:', error);
        setFotoTersimpan(null);
      }
    );

    return () => berhenti();
  }, [uid]);

  const namaAman = (nama || 'Guru').trim();
  const inisial = namaAman
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((bagian) => bagian.charAt(0))
    .join('')
    .toUpperCase() || 'G';
  const fotoAktif = previewUrl !== undefined ? previewUrl : fotoTersimpan;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-extrabold shadow-sm ${className}`}
      aria-label={`Foto profil ${namaAman}`}
    >
      {fotoAktif ? (
        <img
          src={fotoAktif}
          alt={`Foto profil ${namaAman}`}
          className="h-full w-full object-cover"
          onError={() => setFotoTersimpan(null)}
        />
      ) : (
        <span className="select-none">{inisial}</span>
      )}
    </div>
  );
}
