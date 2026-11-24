// =========================================================
// MIGRASI sekolahId — DATA DUMMY/LEGACY
// =========================================================
// Mode:
//   node scripts/migrasi-sekolah-id.mjs --dry-run   (default, baca saja)
//   node scripts/migrasi-sekolah-id.mjs --validate  (baca + cek konsistensi)
//   node scripts/migrasi-sekolah-id.mjs --backup    (tulis snapshot ke workspace)
//   node scripts/migrasi-sekolah-id.mjs --apply     (HANYA emulator)
//
// ATURAN: script ini TIDAK PERNAH menulis ke Firebase produksi.
// Mode --apply menolak berjalan bila FIRESTORE_EMULATOR_HOST tidak diset.
// Identitas sekolah berasal dari pengaturan/sekolah (NPSN terverifikasi),
// bukan dari nama, urutan dokumen, atau tebakan.
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";

const requireProject = createRequire(new URL("../functions/package.json", import.meta.url));
const requireTools = createRequire("C:/Users/ANDIS/AppData/Roaming/npm/node_modules/firebase-tools/package.json");
const TOOLS = "C:/Users/ANDIS/AppData/Roaming/npm/node_modules/firebase-tools/lib/";
const P = "aplikasi-sekolah-digital-ff8b3";
const SEKOLAH_ID = "SDK-40302968";
const SUMBER_IDENTITAS = "pengaturan/sekolah npsn=40302968 (nama: SD Inpres 12/79 Lappabosse)";
const BACKUP_DIR = "F:/SELENA_WORKSPACE/08_ARSIP/backup/2026-11-23_multi-school/migrasi";
const args = process.argv.slice(2);
const mode = args.includes("--apply") ? "apply" : args.includes("--backup") ? "backup" : args.includes("--validate") ? "validate" : "dry-run";

const cliAuth = requireTools(TOOLS + "auth.js");
const cliApi = requireTools(TOOLS + "apiv2.js");
const account = cliAuth.getGlobalDefaultAccount();
if (!account) throw new Error("Firebase CLI belum login");
cliAuth.setActiveAccount({}, account);
const token = await cliApi.getAccessToken();
if (!token) throw new Error("Tidak dapat memperoleh token baca");

const ROOT = "https://firestore.googleapis.com/v1/projects/" + P + "/databases/%28default%29/documents";
const H = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
async function readCollection(c) {
  let page = "", out = [], guard = 0;
  do {
    const r = await fetch(ROOT + "/" + c + "?pageSize=500" + (page ? "&pageToken=" + encodeURIComponent(page) : ""), { method: "GET", headers: H });
    if (!r.ok) throw new Error(c + " HTTP " + r.status);
    const j = await r.json();
    out = out.concat(j.documents || []);
    page = j.nextPageToken || ""; guard++;
  } while (page && guard < 20);
  return out;
}
const docs = new Map();
const COLLECTIONS = [
  "absensi", "absensi_guru", "guru", "kelas", "modul_ajar", "pendaftaran_sekolah",
  "pengaturan", "siswa", "siswa_ringkas", "tahun_ajaran", "users",
];
for (const c of COLLECTIONS) for (const d of await readCollection(c)) docs.set(d.name, { path: d.name, col: c, fields: d.fields || {} });
const fv = (f, k) => f?.[k]?.stringValue ?? "";
const idOf = (d) => d.path.split("/").pop();
const byId = (c) => new Map([...docs.values()].filter((d) => d.col === c).map((d) => [idOf(d), d]));
const users = byId("users"), guru = byId("guru"), kelas = byId("kelas"), siswa = byId("siswa");

// Jangkar: dokumen identitas sekolah dan akun sekolah yang dinyatakan berasal dari satu sekolah.
const identityDoc = [...docs.values()].find((d) => d.col === "pengaturan" && idOf(d) === "sekolah");
if (!identityDoc || fv(identityDoc.fields, "npsn") !== "40302968") {
  throw new Error("Identitas sekolah tidak terverifikasi; migrasi dibatalkan");
}
const rows = [];
for (const d of docs.values()) {
  const id = idOf(d), cur = fv(d.fields, "sekolahId");
  let cat, source, reason;
  if (d.col === "pendaftaran_sekolah") {
    cat = "MANUAL"; source = "-"; reason = "Dokumen pendaftaran bukan data operasional sekolah";
  } else if (d.col === "pengaturan" && id === "sekolah") {
    cat = "AUTO"; source = SUMBER_IDENTITAS; reason = "Dokumen identitas sekolah pertama";
  } else if (d.col === "users") {
    cat = "AUTO"; source = "Pernyataan terverifikasi: Admin/Kepsek/Guru satu sekolah + " + SUMBER_IDENTITAS; reason = "Profil akun sekolah pertama";
  } else if (d.col === "guru" || d.col === "absensi_guru" || d.col === "modul_ajar" || d.col === "kelas" || d.col === "siswa" || d.col === "siswa_ringkas" || d.col === "absensi" || d.col === "tahun_ajaran" || (d.col === "pengaturan" && id === "qr_absensi_guru")) {
    const linked = d.col === "guru" || d.col === "absensi_guru"
      ? [...users.values()].some((u) => fv(u.fields, "guruId") === id)
      : d.col === "modul_ajar"
        ? Boolean(fv(d.fields, "userId"))
        : d.col === "kelas"
          ? Boolean(fv(d.fields, "waliKelasId"))
          : Boolean(fv(d.fields, "kelasId"));
    cat = "AUTO"; source = "Graf relasi operasional satu sekolah + " + SUMBER_IDENTITAS; reason = linked ? "Relasi ke klaster sekolah pertama terverifikasi" : "Bagian dari konfigurasi sekolah pertama";
  } else {
    cat = "MANUAL"; source = "-"; reason = "Tidak ada bukti pemetaan";
  }
  if (cur && cur !== SEKOLAH_ID) { cat = "KONFLIK"; source = "nilai ada: " + cur; reason = "Nilai sekolahId berbeda dengan identitas sekolah pertama"; }
  rows.push({ collection: d.col, id, current: cur || "(kosong)", candidate: cat === "AUTO" ? SEKOLAH_ID : "-", source, category: cat, reason });
}

const summary = rows.reduce((a, r) => { a[r.category] = (a[r.category] || 0) + 1; return a; }, {});
console.log("MODE=" + mode);
console.log("SEKOLAH_ID=" + SEKOLAH_ID);
console.log("SUMBER=" + SUMBER_IDENTITAS);
console.log("DOCS=" + docs.size + " SUMMARY=" + JSON.stringify(summary));
for (const r of rows) console.log(`ROW|${r.collection}|${r.id}|current=${r.current}|candidate=${r.candidate}|${r.category}|${r.reason}`);

if (mode === "backup") {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = BACKUP_DIR + "/snapshot-produksi.json";
  writeFileSync(file, JSON.stringify({ projectId: P, sekolahId: SEKOLAH_ID, diambilPada: new Date().toISOString(), docs: [...docs.values()].map((d) => ({ path: d.path, fields: d.fields })) }, null, 2));
  console.log("BACKUP_WRITTEN=" + file);
}
if (mode === "validate") {
  const bad = rows.filter((r) => r.category === "KONFLIK");
  console.log("VALIDATION=" + (bad.length === 0 && rows.every((r) => r.category !== "AUTO" || r.candidate === SEKOLAH_ID) ? "LULUS" : "GAGAL"));
}
if (mode === "apply") {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.log("APPLY_DITOLAK=FIRESTORE_EMULATOR_HOST tidak diset; produksi dilarang ditulis");
    process.exit(3);
  }
  const { initializeApp } = requireProject("firebase-admin/app");
  const { getFirestore } = requireProject("firebase-admin/firestore");
  initializeApp({ projectId: P, credential: { getAccessToken: async () => ({ access_token: token, expires_in: 3600 }) } });
  const db = getFirestore();
  let n = 0;
  for (const r of rows.filter((x) => x.category === "AUTO")) {
    await db.doc(r.collection + "/" + r.id).update({ sekolahId: SEKOLAH_ID });
    n++;
  }
  console.log("APPLY_EMULATOR_DOCS=" + n);
}
console.log("SELESAI");
