import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA_kN4FaV3AmjsvWkzxCROQITmFwebwEmY", // <--- GANTI DENGAN KUNCI ASLI DARI FIREBASE ANDA
  authDomain: "aplikasi-sekolah-digital-cd0c9.firebaseapp.com",
  projectId: "aplikasi-sekolah-digital-cd0c9",
  storageBucket: "aplikasi-sekolah-digital-cd0c9.firebasestorage.app",
  messagingSenderId: "174334547289",
  appId: "1:174334547289:web:9344434182d581e290a848",
  measurementId: "G-2SKECWSVPQ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);