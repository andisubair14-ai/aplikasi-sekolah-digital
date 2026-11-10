import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Konfigurasi Firebase dibaca dari file .env
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Periksa konfigurasi wajib sebelum Firebase dijalankan
const konfigurasiWajib = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
];

for (const namaField of konfigurasiWajib) {
  if (!firebaseConfig[namaField as keyof typeof firebaseConfig]) {
    throw new Error(
      `Konfigurasi Firebase ${namaField} belum tersedia. Periksa file .env`
    );
  }
}

// Firebase utama
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);