
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react';

import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

import {
  collection,
  doc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';

import { auth, db } from '../lib/firebase';

type RoleType = 'admin' | 'guru' | 'kepsek';
type JenisKelamin = 'Laki-laki' | 'Perempuan' | null;

interface UserData {
  uid: string;
  email: string | null;
  nama: string;
  role: RoleType;
  guruId: string | null;
  jenisKelamin: JenisKelamin;
  aktif: boolean;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true
});

export const AuthProvider = ({
  children
}: {
  children: ReactNode;
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfil: (() => void) | null = null;
    let unsubscribePegawai: (() => void) | null = null;

    let uidYangSedangDipantau: string | null = null;
    let masihTerpasang = true;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (unsubscribeProfil) {
        unsubscribeProfil();
        unsubscribeProfil = null;
      }

      if (unsubscribePegawai) {
        unsubscribePegawai();
        unsubscribePegawai = null;
      }

      uidYangSedangDipantau = currentUser?.uid ?? null;

      setUser(currentUser);
      setUserData(null);
      setLoading(true);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      const profilRef = doc(db, 'users', currentUser.uid);

      unsubscribeProfil = onSnapshot(
        profilRef,
        (docSnap) => {
          if (
            !masihTerpasang ||
            uidYangSedangDipantau !== currentUser.uid
          ) {
            return;
          }

          if (!docSnap.exists()) {
            console.error('Data user tidak ditemukan di database!');
            setUserData(null);
            setLoading(false);
            return;
          }

          const data = docSnap.data();
          const role = data.role as RoleType;

          const guruId =
            typeof data.guruId === 'string' &&
            data.guruId.trim() !== ''
              ? data.guruId
              : null;

          const profilDasar: UserData = {
            uid: currentUser.uid,
            email: currentUser.email,
            nama: typeof data.nama === 'string' ? data.nama : '',
            role,
            guruId,
            jenisKelamin: null,
            aktif: typeof data.aktif === 'boolean' ? data.aktif : true
          };

          if (unsubscribePegawai) {
            unsubscribePegawai();
            unsubscribePegawai = null;
          }

          setUserData(profilDasar);

          // =========================================
          // GURU: Tetap menggunakan guruId seperti sebelumnya
          // =========================================

          if (role === 'guru' && guruId) {
            const guruRef = doc(db, 'guru', guruId);

            unsubscribePegawai = onSnapshot(
              guruRef,
              (guruSnap) => {
                if (
                  !masihTerpasang ||
                  uidYangSedangDipantau !== currentUser.uid
                ) {
                  return;
                }

                const dataGuru = guruSnap.exists()
                  ? guruSnap.data()
                  : null;

                const nilaiJenisKelamin = dataGuru?.jenisKelamin;

                const jenisKelamin: JenisKelamin =
                  nilaiJenisKelamin === 'Laki-laki' ||
                  nilaiJenisKelamin === 'Perempuan'
                    ? nilaiJenisKelamin
                    : null;

                setUserData((sebelumnya) => {
                  if (
                    !sebelumnya ||
                    sebelumnya.uid !== currentUser.uid
                  ) {
                    return sebelumnya;
                  }

                  return {
                    ...sebelumnya,
                    jenisKelamin
                  };
                });

                setLoading(false);
              },
              (error) => {
                console.error(
                  'Gagal membaca data pegawai Guru:',
                  error
                );

                if (
                  masihTerpasang &&
                  uidYangSedangDipantau === currentUser.uid
                ) {
                  setLoading(false);
                }
              }
            );

            return;
          }

          // =========================================
          // KEPSEK: Cari data pegawai berdasarkan jabatan
          // =========================================

          if (role === 'kepsek') {
            const pegawaiKepsekQuery = query(
              collection(db, 'guru'),
              where('jabatan', '==', 'Kepala Sekolah')
            );

            unsubscribePegawai = onSnapshot(
              pegawaiKepsekQuery,
              (pegawaiSnap) => {
                if (
                  !masihTerpasang ||
                  uidYangSedangDipantau !== currentUser.uid
                ) {
                  return;
                }

                // Hanya gunakan data jika ditemukan tepat satu
                // pegawai dengan jabatan Kepala Sekolah.
                if (pegawaiSnap.size !== 1) {
                  console.warn(
                    'Data Kepala Sekolah tidak tunggal. Jenis kelamin tidak dapat ditentukan otomatis.'
                  );

                  setUserData((sebelumnya) => {
                    if (
                      !sebelumnya ||
                      sebelumnya.uid !== currentUser.uid
                    ) {
                      return sebelumnya;
                    }

                    return {
                      ...sebelumnya,
                      jenisKelamin: null
                    };
                  });

                  setLoading(false);
                  return;
                }

                const dataPegawai = pegawaiSnap.docs[0].data();
                const nilaiJenisKelamin = dataPegawai.jenisKelamin;

                const jenisKelamin: JenisKelamin =
                  nilaiJenisKelamin === 'Laki-laki' ||
                  nilaiJenisKelamin === 'Perempuan'
                    ? nilaiJenisKelamin
                    : null;

                setUserData((sebelumnya) => {
                  if (
                    !sebelumnya ||
                    sebelumnya.uid !== currentUser.uid
                  ) {
                    return sebelumnya;
                  }

                  return {
                    ...sebelumnya,
                    jenisKelamin
                  };
                });

                setLoading(false);
              },
              (error) => {
                console.error(
                  'Gagal membaca data pegawai Kepala Sekolah:',
                  error
                );

                if (
                  masihTerpasang &&
                  uidYangSedangDipantau === currentUser.uid
                ) {
                  setLoading(false);
                }
              }
            );

            return;
          }

          // Admin tidak membutuhkan data jenis kelamin.
          setLoading(false);
        },
        (error) => {
          if (
            !masihTerpasang ||
            uidYangSedangDipantau !== currentUser.uid
          ) {
            return;
          }

          console.error('Gagal memantau data pengguna:', error);
          setUserData(null);
          setLoading(false);
        }
      );
    });

    return () => {
      masihTerpasang = false;
      uidYangSedangDipantau = null;

      unsubscribeAuth();

      if (unsubscribeProfil) {
        unsubscribeProfil();
        unsubscribeProfil = null;
      }

      if (unsubscribePegawai) {
        unsubscribePegawai();
        unsubscribePegawai = null;
      }
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, userData, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
