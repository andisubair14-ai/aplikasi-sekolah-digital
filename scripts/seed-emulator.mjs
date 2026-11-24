// =========================================
// SEED DATA DUMMY — KHUSUS FIREBASE EMULATOR
// =========================================
// Skrip ini HANYA menulis ke emulator lokal (127.0.0.1). Ia menolak
// berjalan bila emulator tidak hidup, sehingga tidak mungkin menyentuh
// data produksi. Semua akun/nilai di bawah adalah DATA DUMMY untuk
// pengujian, bukan kredensial sungguhan.
//
// Pemakaian: jalankan `npm run emulator` dulu, lalu `npm run seed:emulator`.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
// firebase-admin tersedia di functions/node_modules; muat dari sana
// agar tidak perlu dependensi ganda di root proyek.
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");

const FIRESTORE_HOST = "127.0.0.1:8080";
const AUTH_HOST = "127.0.0.1:9099";
// Project ID sama dengan frontend; seluruh trafik dipaksa ke emulator
// melalui environment variable di bawah (bukan ke Firebase online).
const PROJECT_ID = "aplikasi-sekolah-digital-ff8b3";

async function emulatorHidup(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

const firestoreSiap = await emulatorHidup(`http://${FIRESTORE_HOST}/`);
const authSiap = await emulatorHidup(`http://${AUTH_HOST}/`);
if (!firestoreSiap || !authSiap) {
  console.error(
    "Emulator belum hidup. Jalankan dulu: npm run emulator\n" +
      "Seed dibatalkan agar tidak ada risiko menulis ke produksi."
  );
  process.exit(1);
}

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const sekarang = Date.now();
const tujuhHari = 7 * 24 * 60 * 60 * 1000;

// -----------------------------------------
// 1. Akun dummy (Auth Emulator + users/{uid})
// -----------------------------------------
// Kata sandi dummy tercantum di sini hanya untuk pengujian lokal.
const akunDummy = [
  { uid: "super-admin-001", email: "superadmin@dummy.test", password: "DummySuperAdmin123!", nama: "Super Admin Demo", claims: { platformOwner: true }, profil: null },
  { uid: "admin-a-001", email: "admin@demo1.test", password: "DummyAdminA123!", nama: "Admin Demo Satu", claims: { role: "admin", sekolahId: "SDK-DEMO0001" }, profil: { role: "admin", sekolahId: "SDK-DEMO0001", guruId: null } },
  { uid: "guru-a-001", email: "guru@demo1.test", password: "DummyGuruA123!", nama: "Guru Demo Satu", claims: { role: "guru", sekolahId: "SDK-DEMO0001" }, profil: { role: "guru", sekolahId: "SDK-DEMO0001", guruId: "guru-a-001" } },
  { uid: "kepsek-a-001", email: "kepsek@demo1.test", password: "DummyKepsekA123!", nama: "Kepsek Demo Satu", claims: { role: "kepsek", sekolahId: "SDK-DEMO0001" }, profil: { role: "kepsek", sekolahId: "SDK-DEMO0001", guruId: null } },
  { uid: "admin-b-001", email: "admin@demo2.test", password: "DummyAdminB123!", nama: "Admin Demo Dua", claims: { role: "admin", sekolahId: "SDK-DEMO0002" }, profil: { role: "admin", sekolahId: "SDK-DEMO0002", guruId: null } },
  { uid: "guru-b-001", email: "guru@demo2.test", password: "DummyGuruB123!", nama: "Guru Demo Dua", claims: { role: "guru", sekolahId: "SDK-DEMO0002" }, profil: { role: "guru", sekolahId: "SDK-DEMO0002", guruId: "guru-b-001" } },
  { uid: "kepsek-b-001", email: "kepsek@demo2.test", password: "DummyKepsekB123!", nama: "Kepsek Demo Dua", claims: { role: "kepsek", sekolahId: "SDK-DEMO0002" }, profil: { role: "kepsek", sekolahId: "SDK-DEMO0002", guruId: null } },
];

for (const akun of akunDummy) {
  try {
    await auth.createUser({ uid: akun.uid, email: akun.email, password: akun.password, displayName: akun.nama, emailVerified: true });
  } catch (error) {
    if (error.code === "auth/uid-already-exists" || error.code === "auth/email-already-exists") {
      await auth.updateUser(akun.uid, { password: akun.password, displayName: akun.nama, emailVerified: true });
    } else {
      throw error;
    }
  }
  await auth.setCustomUserClaims(akun.uid, akun.claims);
  if (akun.profil) {
    await db.collection("users").doc(akun.uid).set({
      uid: akun.uid,
      email: akun.email,
      nama: akun.nama,
      role: akun.profil.role,
      sekolahId: akun.profil.sekolahId,
      kodeAkun: `${akun.profil.sekolahId}-${akun.profil.role}`,
      guruId: akun.profil.guruId,
      aktif: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

// -----------------------------------------
// 2. Registri sekolah dummy (sekolah_platform)
// -----------------------------------------
const sekolahDummy = [
  { sekolahId: "SDK-DEMO0001", namaSekolah: "SD Negeri Demo Satu", npsn: "10000001", jenjang: "SD", status: "aktif", statusLangganan: "trial", trial: true },
  { sekolahId: "SDK-DEMO0002", namaSekolah: "SMP Negeri Demo Dua", npsn: "20000002", jenjang: "SMP", status: "aktif", statusLangganan: "trial", trial: true },
  { sekolahId: "SDK-DEMO0003", namaSekolah: "SD Demo Tiga (uji aktivasi)", npsn: "30000003", jenjang: "SD", status: "nonaktif", statusLangganan: "belum_diatur", trial: false },
];
for (const s of sekolahDummy) {
  const mulai = s.trial ? Timestamp.fromMillis(sekarang - 2 * 24 * 60 * 60 * 1000) : null;
  const berakhir = s.trial ? Timestamp.fromMillis(sekarang + 28 * 24 * 60 * 60 * 1000) : null;
  await db.collection("sekolah_platform").doc(s.sekolahId).set({
    sekolahId: s.sekolahId,
    namaSekolah: s.namaSekolah,
    npsn: s.npsn,
    jenjang: s.jenjang,
    provinsi: "Sulawesi Tengah",
    kabupaten: "Kota Demo",
    alamat: "Jl. Demo No. 1",
    email: `kontak@${s.sekolahId.toLowerCase().replace(/[^a-z0-9]/g, "")}.test`,
    telepon: "081234567890",
    namaKepalaSekolah: `Kepsek ${s.namaSekolah}`,
    status: s.status,
    statusLangganan: s.statusLangganan,
    tanggalMulaiTrial: mulai,
    tanggalBerakhirTrial: berakhir,
    jumlahAkunAwal: 3,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// -----------------------------------------
// 3. Data operasional dummy (2 sekolah, untuk uji isolasi)
// -----------------------------------------
const guruOperasional = [
  { id: "guru-a-001", sekolahId: "SDK-DEMO0001", nama: "Guru Demo Satu", jenisKelamin: "Laki-laki", jabatan: "Guru", kelasDiampu: ["kelas-a-001"] },
  { id: "guru-a-002", sekolahId: "SDK-DEMO0001", nama: "Kepsek Demo Satu", jenisKelamin: "Perempuan", jabatan: "Kepala Sekolah", kelasDiampu: [] },
  { id: "guru-b-001", sekolahId: "SDK-DEMO0002", nama: "Guru Demo Dua", jenisKelamin: "Perempuan", jabatan: "Guru", kelasDiampu: ["kelas-b-001"] },
  { id: "guru-b-002", sekolahId: "SDK-DEMO0002", nama: "Kepsek Demo Dua", jenisKelamin: "Laki-laki", jabatan: "Kepala Sekolah", kelasDiampu: [] },
];
for (const g of guruOperasional) {
  await db.collection("guru").doc(g.id).set({ ...g, createdAt: FieldValue.serverTimestamp() }, { merge: true });
}
const kelasDummy = [
  { id: "kelas-a-001", sekolahId: "SDK-DEMO0001", namaKelas: "Kelas 5A", waliKelasId: "guru-a-001", jenjang: "SD" },
  { id: "kelas-b-001", sekolahId: "SDK-DEMO0002", namaKelas: "Kelas 7B", waliKelasId: "guru-b-001", jenjang: "SMP" },
];
for (const k of kelasDummy) {
  await db.collection("kelas").doc(k.id).set({ ...k, createdAt: FieldValue.serverTimestamp() }, { merge: true });
}
const siswaDummy = [
  { id: "siswa-a-001", sekolahId: "SDK-DEMO0001", nama: "Siswa Demo A1", kelasId: "kelas-a-001", jenisKelamin: "Laki-laki" },
  { id: "siswa-a-002", sekolahId: "SDK-DEMO0001", nama: "Siswa Demo A2", kelasId: "kelas-a-001", jenisKelamin: "Perempuan" },
  { id: "siswa-b-001", sekolahId: "SDK-DEMO0002", nama: "Siswa Demo B1", kelasId: "kelas-b-001", jenisKelamin: "Laki-laki" },
];
for (const s of siswaDummy) {
  await db.collection("siswa").doc(s.id).set({ ...s, createdAt: FieldValue.serverTimestamp() }, { merge: true });
}

// -----------------------------------------
// 4. Pendaftaran dummy (untuk alur persetujuan)
// -----------------------------------------
await db.collection("pendaftaran_sekolah").doc("demo-reg-001").set({
  namaSekolah: "SD Demo Baru (menunggu verifikasi)",
  npsn: "40000004",
  jenjang: "SD",
  provinsi: "Sulawesi Tengah",
  kabupaten: "Kota Demo",
  alamat: "Jl. Demo Baru No. 4",
  namaAdmin: "Admin Calon Demo Baru",
  namaKepalaSekolah: "Kepsek Demo Baru",
  telepon: "081234567891",
  email: "pendaftar@dummy.test",
  catatanPendaftar: "",
  catatanAdmin: "",
  status: "menunggu_verifikasi",
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

await db.collection("pendaftaran_sekolah").doc("demo-reg-003").set({
  namaSekolah: "SD Demo Tiga (uji aktivasi)",
  npsn: "30000003",
  jenjang: "SD",
  provinsi: "Sulawesi Tengah",
  kabupaten: "Kota Demo",
  alamat: "Jl. Demo No. 3",
  namaAdmin: "Admin Calon Demo Tiga",
  namaKepalaSekolah: "Kepsek Demo Tiga",
  telepon: "081234567893",
  email: "kontak3@dummy.test",
  catatanPendaftar: "",
  catatanAdmin: "Disetujui untuk pengujian aktivasi.",
  status: "disetujui_menunggu_provisioning",
  sekolahId: "SDK-DEMO0003",
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

// -----------------------------------------
// 5. Undangan aktivasi dummy (token diketahui, tanpa Resend)
// -----------------------------------------
// Token dummy 64 karakter heksadesimal. Nilai lengkap ada di skrip ini;
// jangan gunakan pola ini untuk undangan sungguhan.
const undanganDummy = [
  { token: "1".repeat(64), role: "admin", status: "menunggu", expiresAt: Timestamp.fromMillis(sekarang + tujuhHari) },
  { token: "2".repeat(64), role: "guru", status: "menunggu", expiresAt: Timestamp.fromMillis(sekarang + tujuhHari) },
  { token: "3".repeat(64), role: "kepsek", status: "menunggu", expiresAt: Timestamp.fromMillis(sekarang + tujuhHari) },
  { token: "4".repeat(64), role: "guru", status: "menunggu", expiresAt: Timestamp.fromMillis(sekarang - 24 * 60 * 60 * 1000) }, // kedaluwarsa
  { token: "5".repeat(64), role: "kepsek", status: "digunakan", expiresAt: Timestamp.fromMillis(sekarang + tujuhHari), uid: "dummy-sudah-dipakai" }, // sudah dipakai
];
for (const u of undanganDummy) {
  await db.collection("aktivasi_akun").doc(hashToken(u.token)).set({
    sekolahId: "SDK-DEMO0003",
    pendaftaranId: "demo-reg-003",
    role: u.role,
    kodeAkun: `SDK-DEMO0003-${u.role}`,
    status: u.status,
    expiresAt: u.expiresAt,
    ...(u.uid ? { uid: u.uid } : {}),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// -----------------------------------------
// Ringkasan (tanpa mencetak kata sandi/token ke log)
// -----------------------------------------
console.log("\nSeed emulator selesai. Ringkasan:");
console.log("- Super Admin: superadmin@dummy.test (claim platformOwner)");
console.log("- Sekolah A (SDK-DEMO0001): admin@demo1.test, guru@demo1.test, kepsek@demo1.test");
console.log("- Sekolah B (SDK-DEMO0002): admin@demo2.test, guru@demo2.test, kepsek@demo2.test");
console.log("- Pendaftaran uji: demo-reg-001 (menunggu_verifikasi)");
console.log("- Undangan aktivasi SDK-DEMO0003: admin/guru/kepsek (token 1/2/3.repeat(64)),");
console.log("  token kedaluwarsa (4.repeat(64)), token sudah dipakai (5.repeat(64)).");
console.log("Kata sandi dummy dan token lengkap: lihat scripts/seed-emulator.mjs");
console.log("URL aktivasi contoh: http://localhost:5173/aktivasi-akun#token=<token>");
