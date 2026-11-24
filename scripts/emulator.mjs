// =========================================
// LAUNCHER FIREBASE EMULATOR (LOKAL)
// =========================================
// Menjalankan Emulator Suite dengan Java yang sudah ada di komputer
// (JAVA_HOME, mis. C:\Java\jdk-21.0.13+9) tanpa perlu mengubah PATH
// sistem. Data emulator disimpan di ./emulator-data dan TIDAK pernah
// menyentuh Firebase online/produksi.
//
// Pemakaian: npm run emulator
// (hentikan dengan Ctrl+C; data diekspor otomatis saat berhenti)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "emulator-data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// Longgarkan timeout discovery fungsi (default 10 detik terlalu ketat
// pada mesin ini; modul butuh ~4-5 detik untuk termuat). Satuan: detik.
process.env.FUNCTIONS_DISCOVERY_TIMEOUT = process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "60";

// Pastikan Java bisa ditemukan oleh firebase-tools.
const javaHome = process.env.JAVA_HOME;
if (javaHome) {
  const javaBin = path.join(javaHome, "bin");
  const javaExe = path.join(javaBin, process.platform === "win32" ? "java.exe" : "java");
  if (!existsSync(javaExe)) {
    console.error(`Java tidak ditemukan di ${javaExe}. Periksa JAVA_HOME.`);
    process.exit(1);
  }
  process.env.PATH = javaBin + path.delimiter + process.env.PATH;
} else {
  console.warn("JAVA_HOME belum diset; mengandalkan java pada PATH.");
}

// Build functions dulu agar lib/index.js selalu sesuai src terbaru.
console.log("Membangun functions (tsc)...");
const build = spawnSync("npm", ["--prefix", "functions", "run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) {
  console.error("Build functions gagal. Emulator tidak dijalankan.");
  process.exit(build.status ?? 1);
}

const punyaDataTersimpan = existsSync(path.join(dataDir, "firebase-export-metadata.json"));
const args = ["emulators:start", "--export-on-exit", dataDir];
if (punyaDataTersimpan) args.push("--import", dataDir);

console.log("Menjalankan Firebase Emulator Suite...");
console.log("UI emulator: http://127.0.0.1:4000");
const child = spawn("firebase", args, { cwd: root, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
