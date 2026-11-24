// ========================================================
// TEST ISOLASI MULTI-TENANT (FIRESTORE RULES)
// Memverifikasi bahwa akun Admin/Guru Sekolah A (SDK-DEMO0001)
// DITOLAK saat mencoba membaca/mengubah data Sekolah B (SDK-DEMO0002)
// ========================================================

const AUTH_HOST = "127.0.0.1:9099";
const FIRESTORE_HOST = "127.0.0.1:8080";
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

async function firestoreGet(collection, docId, token) {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function firestorePatch(collection, docId, fields, token) {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function run() {
  console.log("=== MEMULAI PENGUJIAN ISOLASI DATA MULTI-TENANT (FIRESTORE) ===");

  // 1. Dapatkan token Admin Sekolah A dan Admin Sekolah B
  const tokenAdminA = await getAuthToken("admin@demo1.test", "DummyAdminA123!");
  const tokenAdminB = await getAuthToken("admin@demo2.test", "DummyAdminB123!");
  assert(Boolean(tokenAdminA), "Admin Sekolah A berhasil login");
  assert(Boolean(tokenAdminB), "Admin Sekolah B berhasil login");

  // 2. Akses Data Sendiri: Admin A membaca Siswa Sekolah A (siswa-a-001)
  console.log("\n1. Menguji Akses Data Sekolah Sendiri (Authorized):");
  const readOwn = await firestoreGet("siswa", "siswa-a-001", tokenAdminA);
  assert(readOwn.status === 200, "Admin Sekolah A diizinkan membaca data siswa sekolahnya sendiri (HTTP 200)");

  // 3. Akses Antarsekolah: Admin A mencoba membaca Siswa Sekolah B (siswa-b-001)
  console.log("\n2. Menguji Isolasi Data Antarsekolah (Cross-School Access Denied):");
  const readOther = await firestoreGet("siswa", "siswa-b-001", tokenAdminA);
  assert(readOther.status === 403, "Admin Sekolah A DITOLAK membaca data siswa Sekolah B (HTTP 403 PERMISSION_DENIED)");

  // 4. Akses Antarsekolah: Admin A mencoba membaca Guru Sekolah B (guru-b-001)
  const readOtherTeacher = await firestoreGet("guru", "guru-b-001", tokenAdminA);
  assert(readOtherTeacher.status === 403, "Admin Sekolah A DITOLAK membaca data guru Sekolah B (HTTP 403 PERMISSION_DENIED)");

  // 5. Akses Antarsekolah: Admin A mencoba membaca Kelas Sekolah B (kelas-b-001)
  const readOtherClass = await firestoreGet("kelas", "kelas-b-001", tokenAdminA);
  assert(readOtherClass.status === 403, "Admin Sekolah A DITOLAK membaca data rombel Sekolah B (HTTP 403 PERMISSION_DENIED)");

  // 6. Upaya Modifikasi Antarsekolah: Admin A mencoba mengubah data Siswa Sekolah B
  console.log("\n3. Menguji Upaya Manipulasi Data Antarsekolah:");
  const patchOther = await firestorePatch(
    "siswa",
    "siswa-b-001",
    {
      nama: { stringValue: "Hacked Siswa B" },
      sekolahId: { stringValue: "SDK-DEMO0002" },
    },
    tokenAdminA
  );
  assert(patchOther.status === 403, "Admin Sekolah A DITOLAK memodifikasi data siswa Sekolah B (HTTP 403 PERMISSION_DENIED)");

  // 7. Upaya Akses Registri Platform oleh Admin Sekolah
  console.log("\n4. Menguji Proteksi Registri Platform (sekolah_platform):");
  const readRegistryAsAdmin = await firestoreGet("sekolah_platform", "SDK-DEMO0001", tokenAdminA);
  assert(
    readRegistryAsAdmin.status === 403,
    "Admin Sekolah DITOLAK mengakses langsung koleksi sekolah_platform (Hanya Super Admin/platformOwner)"
  );

  // --------------------------------------------------------
  // KESIMPULAN
  // --------------------------------------------------------
  console.log("\n========================================================");
  console.log(`TOTAL UJI ISOLASI: ${totalTests} | LULUS: ${passedTests} | GAGAL: ${failedTests}`);
  if (failedTests === 0) {
    console.log("SEMUA PENGUJIAN ISOLASI DATA MULTI-TENANT BERHASIL!");
  } else {
    console.error("TERDAPAT PENGUJIAN ISOLASI YANG GAGAL.");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Kesalahan pengujian isolasi:", err);
  process.exit(1);
});
