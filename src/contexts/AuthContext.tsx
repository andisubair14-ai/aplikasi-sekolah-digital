import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth'; // <-- Cara paling aman untuk TypeScript
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type RoleType = 'admin' | 'guru' | 'kepsek';

interface UserData {
  uid: string;
  email: string | null;
  nama: string;
  role: RoleType;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true });

// Ubah React.ReactNode menjadi ReactNode
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData({
            uid: currentUser.uid,
            email: currentUser.email,
            nama: data.nama,
            role: data.role as RoleType,
          });
        } else {
          console.error("Data user tidak ditemukan di database!");
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);