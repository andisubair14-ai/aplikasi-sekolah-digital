import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react';

import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type RoleType = 'admin' | 'guru' | 'kepsek';

interface UserData {
  uid: string;
  email: string | null;
  nama: string;
  role: RoleType;
  guruId: string | null;
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfil: (() => void) | null = null;
    let uidYangSedangDipantau: string | null = null;
    let masihTerpasang = true;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // Hentikan listener profil sebelumnya saat akun berubah atau logout.
      if (unsubscribeProfil) {
        unsubscribeProfil();
        unsubscribeProfil = null;
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

      // Pantau profil dan status akun secara real-time.
      unsubscribeProfil = onSnapshot(
        profilRef,
        (docSnap) => {
          // Abaikan respons lama jika pengguna sudah berganti akun.
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

          setUserData({
            uid: currentUser.uid,
            email: currentUser.email,
            nama: typeof data.nama === 'string' ? data.nama : '',
            role,
            guruId: typeof data.guruId === 'string' ? data.guruId : null,
            // Akun lama tanpa field "aktif" tetap dianggap aktif.
            aktif: typeof data.aktif === 'boolean' ? data.aktif : true
          });

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
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
