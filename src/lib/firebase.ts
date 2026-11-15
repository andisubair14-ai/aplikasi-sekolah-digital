
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
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

// App Check untuk pengembangan lokal.
// index.html harus mengaktifkan FIREBASE_APPCHECK_DEBUG_TOKEN.
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("debug-placeholder"),
  isTokenAutoRefreshEnabled: true,
});

// Firebase Authentication, Firestore, dan Storage
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

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
