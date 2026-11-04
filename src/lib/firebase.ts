import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // <-- Baris ini wajib ada

const firebaseConfig = {
  // --- PASTE KUNCI ASLI ANDA DARI FIREBASE DI SINI ---
  apiKey: "AIzaSyA_kN4FaV3AmjsvWkzxCROQITmFwebwEmY",
  authDomain: "aplikasi-sekolah-digital-cd0c9.firebaseapp.com",
  projectId: "aplikasi-sekolah-digital-cd0c9",
  storageBucket: "aplikasi-sekolah-digital-cd0c9.firebasestorage.app",
  messagingSenderId: "174334547289",
  appId: "1:174334547289:web:9344434182d581e290a848",
  measurementId: "G-2SKECWSVPQ"
};

const app = initializeApp(firebaseConfig);

// --- BARIS INI YANG HILANG SEBELUMNYA ---
export const auth = getAuth(app);