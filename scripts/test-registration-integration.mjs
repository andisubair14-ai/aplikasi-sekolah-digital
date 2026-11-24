// ========================================================
// INTEGRATION TEST: SISTEM PENDAFTARAN SEKOLAH
// Menjalankan uji integrasi nyata terhadap Firebase Emulator:
// Auth (9099), Firestore (8080), Functions (5001)
// ========================================================
import { createRequire } from "node:module";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const FIRESTORE_HOST = "127.0.0.1:8080";
const AUTH_HOST = "127.0.0.1:9099";
const FUNCTIONS_HOST = "http://127.0.0.1:5001/aplikasi-sekolah-digital-ff8b3/us-central1";
const PROJECT_ID = "aplikasi-sekolah-digital-ff8b3";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

async function checkEmulatorRunning() {
  try {
    const res = await fetch(`http://${AUTH_HOST}/`, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function callFunction(name, data, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${FUNCTIONS_HOST}/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function getAuthToken(email, password) {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  return data.idToken || null;
}

async function run() {
  console.log("=== MEMULAI PENGUJIAN INTEGRASI PENDAFTARAN SEKOLAH (EMULATOR) ===");

  const isRunning = await checkEmulatorRunning();
  if (!isRunning) {
    console.error("Firebase Emulator belum berjalan.");
    console.error("Jalankan `npm run emulator` di terminal lain sebelum menjalankan skrip ini.");
    process.exit(1);
  }

  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

  const app = initializeApp({ projectId: PROJECT_ID });
  const adminAuth = getAuth(app);
  const db = getFirestore(app);

  // 1. Dapatkan Token Super Admin dan Normal User
  console.log("\n1. Autentikasi Pengguna Uji di Auth Emulator:");
  const superAdminToken = await getAuthToken("superadmin@dummy.test", "DummySuperAdmin123!");
  assert(Boolean(superAdminToken), "Super Admin berhasil login dan memperoleh idToken");

  const normalUserToken = await getAuthToken("admin@demo1.test", "DummyAdminA123!");
  assert(Boolean(normalUserToken), "User Admin Sekolah Demo 1 berhasil login dan memperoleh idToken");

  // 2. Uji Pendaftaran Sekolah Baru (Tanpa Login / Publik)
  console.log("\n2. Menguji Pengajuan Pendaftaran Sekolah Baru (Callable: ajukanPendaftaranSekolah):");
  const testNpsn = "88880001";
  const regPayload = {
    namaSekolah: "SD Bintang Harapan",
    npsn: testNpsn,
    jenjang: "SD",
    provinsi: "Sulawesi Selatan",
    kabupaten: "Kota Makassar",
    alamat: "Jl. Pendidikan No. 45",
    namaAdmin: "Siti Rahmawati, S.Kom",
    namaKepalaSekolah: "Drs. H. Mappanyukki, M.Pd",
    telepon: "081299887766",
    email: "admin.bintang@dummy.test",
    catatanPendaftar: "Mohon diproses untuk pengujian sistem.",
  };

  const regRes = await callFunction("ajukanPendaftaranSekolah", regPayload);
  assert(regRes.status === 200, `Pendaftaran berhasil terkirim (HTTP 200)`);
  assert(regRes.body.result?.success === true, "Respon callable menyatakan success: true");
  const pendaftaranId = regRes.body.result?.pendaftaranId;
  assert(Boolean(pendaftaranId), `ID pendaftaran diperoleh: ${pendaftaranId}`);

  // Verifikasi dokumen di Firestore
  const docSnap = await db.collection("pendaftaran_sekolah").doc(pendaftaranId).get();
  assert(docSnap.exists, "Dokumen pendaftaran tersimpan di koleksi pendaftaran_sekolah");
  assert(docSnap.data()?.status === "menunggu_verifikasi", "Status awal permohonan adalah 'menunggu_verifikasi'");
  assert(docSnap.data()?.namaAdmin === "Siti Rahmawati, S.Kom", "Field namaAdmin tersimpan dengan benar");

  // 3. Uji Pencegahan Duplikasi NPSN
  console.log("\n3. Menguji Pencegahan Pendaftaran NPSN Ganda:");
  const dupRes = await callFunction("ajukanPendaftaranSekolah", regPayload);
  assert(dupRes.status >= 400, "Pengajuan kedua dengan NPSN yang sama ditolak (HTTP 4xx)");
  assert(
    dupRes.body.error?.status === "ALREADY_EXISTS" || dupRes.body.error?.message?.includes("sudah"),
    "Error code ALREADY_EXISTS terdeteksi untuk NPSN duplikat"
  );

  // 4. Uji Batasan Hak Akses: Persetujuan Pendaftaran
  console.log("\n4. Menguji Otorisasi Persetujuan Pendaftaran (Callable: setujuiPendaftaranSekolah):");

  // A. Percobaan persetujuan oleh pengguna anonim
  const anonApproval = await callFunction("setujuiPendaftaranSekolah", { pendaftaranId });
  assert(anonApproval.status === 401 || anonApproval.status === 403, "Pengguna anonim ditolak menyetujui pendaftaran (HTTP 401/403)");

  // B. Percobaan persetujuan oleh pengguna normal (bukan platformOwner)
  const userApproval = await callFunction("setujuiPendaftaranSekolah", { pendaftaranId }, normalUserToken);
  assert(userApproval.status === 403 || userApproval.body.error?.status === "PERMISSION_DENIED", "Pengguna tanpa klaim platformOwner ditolak (PERMISSION_DENIED)");

  // C. Persetujuan oleh Super Admin (platformOwner: true)
  const adminApproval = await callFunction("setujuiPendaftaranSekolah", { pendaftaranId }, superAdminToken);
  assert(adminApproval.status === 200, "Super Admin berhasil menyetujui pendaftaran (HTTP 200)");
  const schoolId = adminApproval.body.result?.sekolahId;
  assert(Boolean(schoolId) && schoolId.startsWith("SDK-"), `schoolId unik terbuat: ${schoolId}`);

  // Verifikasi data registri sekolah
  const schoolDoc = await db.collection("sekolah_platform").doc(schoolId).get();
  assert(schoolDoc.exists, "Dokumen sekolah baru dibuat di koleksi sekolah_platform");
  assert(schoolDoc.data()?.status === "nonaktif", "Status awal sekolah adalah 'nonaktif' (menunggu aktivasi admin)");
  assert(schoolDoc.data()?.npsn === testNpsn, "NPSN sekolah sesuai pendaftaran");

  // Verifikasi pendaftaran_sekolah status berubah
  const updatedReg = await db.collection("pendaftaran_sekolah").doc(pendaftaranId).get();
  assert(
    updatedReg.data()?.status === "selesai" || updatedReg.data()?.status === "disetujui_menunggu_provisioning",
    `Status pendaftaran berubah menjadi '${updatedReg.data()?.status}'`
  );

  // 5. Uji Pengambilan Token Undangan dan Aktivasi Akun
  console.log("\n5. Menguji Aktivasi Akun Admin Sekolah (Callable: aktifkanAkunSekolah):");

  // Cari undangan untuk role admin di koleksi aktivasi_akun
  const invitesSnap = await db.collection("aktivasi_akun")
    .where("pendaftaranId", "==", pendaftaranId)
    .where("role", "==", "admin")
    .get();

  assert(!invitesSnap.empty, "Undangan aktivasi role admin ditemukan di Firestore");
  const inviteDoc = invitesSnap.docs[0];
  const inviteData = inviteDoc.data();
  assert(inviteData.status === "menunggu", "Status awal undangan adalah 'menunggu'");

  // Ambil token dari email_sink emulator
  const emailSinkSnap = await db.collection("email_sink")
    .where("to", "array-contains", "admin.bintang@dummy.test")
    .get();

  assert(!emailSinkSnap.empty, "Email aktivasi masuk ke koleksi email_sink emulator");
  const emailContent = emailSinkSnap.docs[0].data()?.html || "";
  const tokenMatch = emailContent.match(/#token=([a-f0-9]{64})/i);
  assert(Boolean(tokenMatch), "Token aktivasi 64-karakter hex berhasil diekstrak dari email");
  const tokenAktivasi = tokenMatch ? tokenMatch[1] : null;

  // A. Uji token palsu/rusak
  const fakeRes = await callFunction("aktifkanAkunSekolah", {
    token: "a".repeat(64),
    nama: "Admin Tester",
    email: "tester@dummy.test",
    password: "Password123!",
  });
  assert(fakeRes.status >= 400, "Token palsu ditolak (HTTP 4xx)");

  // B. Uji password terlalu pendek (<10 karakter)
  const shortPassRes = await callFunction("aktifkanAkunSekolah", {
    token: tokenAktivasi,
    nama: "Siti Rahmawati",
    email: "siti.rahma@dummy.test",
    password: "123",
  });
  assert(shortPassRes.status >= 400, "Password kurang dari 10 karakter ditolak");

  // C. Aktivasi berhasil dengan token valid
  const actRes = await callFunction("aktifkanAkunSekolah", {
    token: tokenAktivasi,
    nama: "Siti Rahmawati",
    email: "siti.rahma@dummy.test",
    password: "PasswordSiti123!",
  });
  assert(actRes.status === 200, "Aktivasi akun Admin berhasil diproses (HTTP 200)");
  assert(actRes.body.result?.role === "admin", "Akun terkonfirmasi dengan role 'admin'");
  assert(actRes.body.result?.sekolahId === schoolId, `Akun terikat ke sekolahId '${schoolId}'`);

  // Verifikasi akun Auth di Auth Emulator
  const newAdminUser = await adminAuth.getUserByEmail("siti.rahma@dummy.test");
  assert(Boolean(newAdminUser), "Pengguna berhasil dibuat di Auth Emulator");
  assert(newAdminUser.customClaims?.role === "admin", "Custom claims memuat role: 'admin'");
  assert(newAdminUser.customClaims?.sekolahId === schoolId, `Custom claims memuat sekolahId: '${schoolId}'`);

  // Verifikasi aktivasi sekolah di sekolah_platform
  const activeSchoolDoc = await db.collection("sekolah_platform").doc(schoolId).get();
  assert(activeSchoolDoc.data()?.status === "aktif", "Status sekolah berubah menjadi 'aktif'");
  assert(activeSchoolDoc.data()?.statusLangganan === "trial", "Status langganan berubah menjadi 'trial'");
  assert(Boolean(activeSchoolDoc.data()?.tanggalMulaiTrial), "tanggalMulaiTrial terisi");
  assert(Boolean(activeSchoolDoc.data()?.tanggalBerakhirTrial), "tanggalBerakhirTrial terisi");

  // 6. Uji Pencegahan Penggunaan Ulang Token (One-Time Use)
  console.log("\n6. Menguji Pencegahan Token Digunakan Dua Kali:");
  const reuseRes = await callFunction("aktifkanAkunSekolah", {
    token: tokenAktivasi,
    nama: "Hacker Percobaan",
    email: "hacker@dummy.test",
    password: "PasswordHacker123!",
  });
  assert(reuseRes.status >= 400, "Penggunaan ulang token aktivasi ditolak (HTTP 4xx)");
  assert(
    reuseRes.body.error?.status === "FAILED_PRECONDITION" || reuseRes.body.error?.message?.includes("digunakan"),
    "Pesan penolakan menegaskan token sudah digunakan"
  );

  // 7. Uji Kirim Ulang Undangan Aktivasi (Resend)
  console.log("\n7. Menguji Kirim Ulang Undangan Aktivasi (Option: kirimUlang):");
  const resendApproval = await callFunction("setujuiPendaftaranSekolah", { pendaftaranId, kirimUlang: true }, superAdminToken);
  assert(resendApproval.status === 200, "Kirim ulang undangan aktivasi oleh Super Admin berhasil (HTTP 200)");
  assert(resendApproval.body.result?.sekolahId === schoolId, "Kode sekolah tetap dipertahankan");

  // Verifikasi token lama role guru/kepsek yang menunggu dibatalkan dan dibuatkan yang baru
  const newInvitesSnap = await db.collection("aktivasi_akun")
    .where("pendaftaranId", "==", pendaftaranId)
    .where("status", "==", "menunggu")
    .get();
  assert(newInvitesSnap.docs.length >= 2, "Token aktivasi baru diterbitkan untuk role yang belum diaktifkan");

  // --------------------------------------------------------
  // KESIMPULAN
  // --------------------------------------------------------
  console.log("\n========================================================");
  console.log(`TOTAL UJI INTEGRASI: ${totalTests} | LULUS: ${passedTests} | GAGAL: ${failedTests}`);
  if (failedTests === 0) {
    console.log("SEMUA PENGUJIAN INTEGRASI ALUR PENDAFTARAN & AKTIVASI BERHASIL!");
  } else {
    console.error("TERDAPAT PENGUJIAN INTEGRASI YANG GAGAL.");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Kesalahan pengujian integrasi:", err);
  process.exit(1);
});
