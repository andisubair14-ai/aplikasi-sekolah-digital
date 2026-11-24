
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "firebase/app-check";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  ThinkingLevel,
} from "firebase/ai";

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

// Periksa konfigurasi wajib
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

// Inisialisasi Firebase utama
const app = initializeApp(firebaseConfig);

// App Check hanya aktif pada produksi.
export const appCheck = import.meta.env.PROD
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(
        import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY
      ),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

// Firebase Authentication, Firestore, Storage, dan Functions
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

// =========================================
// MODE EMULATOR — OPSIONAL DAN EKSPLISIT
// =========================================
// Default aplikasi adalah Firebase Online. Emulator HANYA aktif bila
// VITE_USE_FIREBASE_EMULATOR=true disetel dengan sengaja (file
// .env.emulator, dibaca oleh `npm run dev:emulator`).
// Jangan memakai import.meta.env.DEV sebagai penentu koneksi emulator.
// Semua koneksi emulator dilakukan sekali di sini, sebelum service
// Firebase dipakai oleh halaman mana pun. Instance functions yang
// sama (app + region us-central1) juga dipakai halaman aktivasi dan
// Platform Control, sehingga tidak ada koneksi ganda.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  console.info("[Firebase] Mode EMULATOR aktif (lokal, bukan produksi).");
}

// Firebase AI Logic menggunakan Gemini Developer API
export const ai = getAI(app, {
  backend: new GoogleAIBackend(),
});

// Model Gemini untuk Modul Ajar
export const model = getGenerativeModel(ai, {
  model: "gemini-3.5-flash-lite",
  generationConfig: {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.MEDIUM,
    },
  },
});
