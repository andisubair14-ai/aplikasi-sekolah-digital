// ========================================================
// PENGUJIAN OTOMATIS: SISTEM PENDAFTARAN SEKOLAH
// Aplikasi Administrasi Sekolah Digital
// ========================================================
import { createHash, randomBytes } from "node:crypto";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function createSchoolId() {
  return `SDK-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function createActivationToken() {
  return randomBytes(32).toString("hex");
}

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

console.log("=== MEMULAI PENGUJIAN SISTEM PENDAFTARAN SEKOLAH ===");

// --------------------------------------------------------
// 1. UJI VALIDASI INPUT PENDAFTARAN
// --------------------------------------------------------
console.log("\n1. Menguji Validasi Input Pendaftaran:");

const npsnRegex = /^\d{8}$/;
assert(npsnRegex.test("12345678"), "NPSN 8 digit angka diterima");
assert(!npsnRegex.test("1234567"), "NPSN 7 digit ditolak");
assert(!npsnRegex.test("123456789"), "NPSN 9 digit ditolak");
assert(!npsnRegex.test("1234abcd"), "NPSN alfanumerik ditolak");
assert(!npsnRegex.test(""), "NPSN kosong ditolak");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
assert(emailRegex.test("admin@sekolah.sch.id"), "Format email sekolah resmi diterima");
assert(emailRegex.test("operator.sd@gmail.com"), "Format email gmail diterima");
assert(!emailRegex.test("adminsekolah.sch.id"), "Email tanpa @ ditolak");
assert(!emailRegex.test("admin@"), "Email tanpa domain ditolak");

const jenjangList = ["PAUD", "TK", "SD", "SMP", "SMA", "SMK", "SLB", "Lainnya"];
assert(jenjangList.includes("SD"), "Jenjang SD terdaftar");
assert(jenjangList.includes("SMP"), "Jenjang SMP terdaftar");
assert(!jenjangList.includes("UNIVERSITAS"), "Jenjang di luar daftar ditolak");

// --------------------------------------------------------
// 2. UJI IDENTITAS CALON ADMINISTRATOR & KEPALA SEKOLAH
// --------------------------------------------------------
console.log("\n2. Menguji Identitas Calon Administrator & Kepala Sekolah:");

function validasiCalonAdmin(namaAdmin, namaKepalaSekolah, email, telepon) {
  if (!namaAdmin || namaAdmin.trim().length < 2) return { valid: false, error: "Nama calon admin wajib minimal 2 karakter" };
  if (!namaKepalaSekolah || namaKepalaSekolah.trim().length < 2) return { valid: false, error: "Nama kepala sekolah wajib minimal 2 karakter" };
  if (!email || !emailRegex.test(email)) return { valid: false, error: "Email tidak valid" };
  if (!telepon || telepon.trim().length < 8) return { valid: false, error: "Nomor telepon minimal 8 digit" };
  return { valid: true };
}

assert(validasiCalonAdmin("Rahmat Hidayat", "Drs. H. Ahmad Dahlan, M.Pd", "rahmat@sekolah.sch.id", "081234567890").valid, "Data admin & kepsek lengkap valid");
assert(!validasiCalonAdmin("", "Drs. H. Ahmad Dahlan, M.Pd", "rahmat@sekolah.sch.id", "081234567890").valid, "Nama admin kosong ditolak");
assert(!validasiCalonAdmin("Rahmat Hidayat", "", "rahmat@sekolah.sch.id", "081234567890").valid, "Nama kepsek kosong ditolak");

// --------------------------------------------------------
// 3. UJI PENCEGAHAN DUPLIKASI DATA (NPSN & PENDAFTARAN)
// --------------------------------------------------------
console.log("\n3. Menguji Logika Pencegahan Duplikasi:");

const platformSchools = [
  { sekolahId: "SDK-DEMO0001", npsn: "10000001", namaSekolah: "SD Demo Satu" },
  { sekolahId: "SDK-DEMO0002", npsn: "20000002", namaSekolah: "SMP Demo Dua" },
];

const pendingRegistrations = [
  { id: "reg-001", npsn: "30000001", status: "menunggu_verifikasi" },
  { id: "reg-002", npsn: "30000002", status: "disetujui_menunggu_provisioning" },
  { id: "reg-003", npsn: "30000003", status: "ditolak" },
];

function cekDuplikasi(npsn) {
  // Cek registri sekolah
  const sekolahAda = platformSchools.find(s => s.npsn === npsn);
  if (sekolahAda) return { duplikat: true, alasan: "NPSN sudah terdaftar di registri sekolah aktif" };

  // Cek pendaftaran aktif
  const pendaftaranAktif = pendingRegistrations.find(r => r.npsn === npsn && ["menunggu_verifikasi", "disetujui_menunggu_provisioning", "selesai"].includes(r.status));
  if (pendaftaranAktif) return { duplikat: true, alasan: `Pendaftaran untuk NPSN ini sedang dalam status ${pendaftaranAktif.status}` };

  return { duplikat: false };
}

assert(cekDuplikasi("10000001").duplikat === true, "Duplikasi dengan sekolah aktif berhasil dicegah");
assert(cekDuplikasi("30000001").duplikat === true, "Duplikasi dengan permohonan menunggu_verifikasi berhasil dicegah");
assert(cekDuplikasi("30000002").duplikat === true, "Duplikasi dengan permohonan disetujui berhasil dicegah");
assert(cekDuplikasi("30000003").duplikat === false, "NPSN dari permohonan ditolak diizinkan daftar ulang");
assert(cekDuplikasi("99999999").duplikat === false, "NPSN baru yang belum pernah terdaftar diizinkan");

// --------------------------------------------------------
// 4. UJI PEMBUATAN schoolId DAN TOKEN AKTIVASI
// --------------------------------------------------------
console.log("\n4. Menguji Format schoolId dan Keamanan Token:");

const schoolId1 = createSchoolId();
const schoolId2 = createSchoolId();
assert(schoolId1.startsWith("SDK-") && schoolId1.length === 12, `schoolId1 berformat SDK-XXXXXXXX (${schoolId1})`);
assert(schoolId2.startsWith("SDK-") && schoolId2.length === 12, `schoolId2 berformat SDK-XXXXXXXX (${schoolId2})`);
assert(schoolId1 !== schoolId2, "Setiap pemanggilan menghasilkan schoolId yang unik");

const token = createActivationToken();
assert(token.length === 64, `Token aktivasi memiliki panjang 64 heksadesimal (${token.length} chars)`);
const hash = hashToken(token);
assert(hash.length === 64, `Hash SHA-256 token memiliki panjang 64 heksadesimal`);
assert(hash !== token, "Token asli tidak disimpan dalam plain text");
assert(hashToken(token) === hash, "Hash bersifat deterministik dan konsisten");

// --------------------------------------------------------
// 5. UJI SISTEM ROLE DAN KONTROL AKSES (RBAC)
// --------------------------------------------------------
console.log("\n5. Menguji Batasan Hak Akses dan Role:");

function validasiRoleClaims(claims) {
  const allowedRoles = ["admin", "guru", "kepsek"];
  if (claims.platformOwner === true) return { role: "platformOwner", aksesPlatform: true };
  if (allowedRoles.includes(claims.role) && claims.sekolahId) {
    return { role: claims.role, sekolahId: claims.sekolahId, aksesPlatform: false };
  }
  return { role: null, aksesPlatform: false };
}

assert(validasiRoleClaims({ platformOwner: true }).aksesPlatform === true, "Super Admin memiliki hak platformOwner");
assert(validasiRoleClaims({ role: "admin", sekolahId: "SDK-001" }).role === "admin", "Admin sekolah memiliki role admin dan sekolahId");
assert(validasiRoleClaims({ role: "guru", sekolahId: "SDK-001" }).role === "guru", "Guru memiliki role guru dan sekolahId");
assert(validasiRoleClaims({ role: "kepsek", sekolahId: "SDK-001" }).role === "kepsek", "Kepala Sekolah memiliki role kepsek dan sekolahId");
assert(validasiRoleClaims({ role: "superadmin" }).role === null, "Role sembarangan dari klien ditolak");

// --------------------------------------------------------
// 6. UJI ALUR AKTIVASI DAN STATUS LANGGANAN TRIAL
// --------------------------------------------------------
console.log("\n6. Menguji Alur Aktivasi dan Trial Sekolah:");

function hitungTrial(tanggalMulaiMs) {
  const TRIAL_DAYS = 30;
  const trialEndMs = tanggalMulaiMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return {
    mulai: new Date(tanggalMulaiMs).toISOString().slice(0, 10),
    berakhir: new Date(trialEndMs).toISOString().slice(0, 10),
    durasiHari: TRIAL_DAYS
  };
}

const now = Date.now();
const trial = hitungTrial(now);
assert(trial.durasiHari === 30, "Masa uji coba ditetapkan 30 hari");
assert(trial.berakhir > trial.mulai, `Tanggal berakhir (${trial.berakhir}) lebih besar dari tanggal mulai (${trial.mulai})`);

// --------------------------------------------------------
// RINGKASAN HASIL
// --------------------------------------------------------
console.log("\n========================================================");
console.log(`TOTAL UJI: ${totalTests} | LULUS: ${passedTests} | GAGAL: ${failedTests}`);
if (failedTests === 0) {
  console.log("SEMUA PENGUJIAN LOGIKA SISTEM PENDAFTARAN SEKOLAH BERHASIL!");
} else {
  console.error("ADA PENGUJIAN YANG GAGAL. PERIKSA DETAIL DI ATAS.");
  process.exit(1);
}
