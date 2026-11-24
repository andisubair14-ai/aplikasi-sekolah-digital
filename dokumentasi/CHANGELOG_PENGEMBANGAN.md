# CHANGELOG PENGEMBANGAN
## Aplikasi Administrasi Sekolah Digital

Semua catatan pembaruan, perbaikan, dan refactoring didokumentasikan di sini.

---

## [2026-11-24] - Audit Verifikasi Lanjutan & Pengujian Integrasi Emulator

### Ditambahkan (Added)
- **Skrip Uji Integrasi Nyata Terhadap Emulator (`scripts/test-registration-integration.mjs`):**
  - 39 assertions pengujian end-to-end: autentikasi token Super Admin/Normal, pengajuan permohonan via callable `ajukanPendaftaranSekolah`, pencegahan duplikasi NPSN aktif (`ALREADY_EXISTS`), penolakan persetujuan pengguna tidak berwenang (`PERMISSION_DENIED`), persetujuan Super Admin dengan pembuatan `schoolId` unik, ekstraksi token dari `email_sink`, penolakan token palsu/password pendek, aktivasi akun Admin dengan Custom Claims & 30-hari trial, penolakan token reuse (`FAILED_PRECONDITION`), serta fitur kirim ulang aktivasi.
- **Skrip Uji Isolasi Multi-Tenant Firestore (`scripts/test-tenant-isolation.mjs`):**
  - 8 assertions pengujian penegakan keamanan: Admin Sekolah A diizinkan membaca data sekolahnya sendiri (HTTP 200), namun DITOLAK saat mencoba membaca atau memodifikasi data siswa, guru, rombel Sekolah B (HTTP 403 PERMISSION_DENIED), serta ditolak saat mengakses registri platform.

### Diperbaiki (Fixed)
- **Koneksi Functions di Halaman Aktivasi (`src/pages/AktivasiAkunSekolah.tsx`):**
  - Memperbaiki bug inisialisasi mandiri `getFunctions(auth.app, 'us-central1')` menjadi import terpusat `functions` dari `src/lib/firebase.ts`. Memastikan halaman aktivasi terhubung ke Functions Emulator saat mode emulator aktif.

### Diverifikasi (Verified)
- Total 81 pengujian otomatis (34 logika unit + 39 integrasi emulator + 8 isolasi multi-tenant) lulus 100% (0 error).
- Frontend production build (`npm run build`) lulus dalam 2.55s.
- Functions compilation (`npm run build`) dan linting (`npm run lint`) lulus dengan 0 warning/error.
- Emulator daemon task dihentikan secara bersih tanpa meninggalkan proses yatim.

---

## [2026-11-24] - Penyempurnaan Sistem Pendaftaran Sekolah & Security Hardening
- Implementasi callable `ajukanPendaftaranSekolah` dengan deduplikasi NPSN server-side.
- Dukungan identitas Calon Administrator Sekolah pada form pendaftaran dan database.
- Fitur kirim ulang undangan aktivasi di Platform Control.
- Tautan navigasi pendaftaran sekolah baru di `Login.tsx`.

---

## [2026-11-23] - Pengujian Fungsional Penuh & Scoping Multi-Tenant
- Verifikasi CRUD Modul Ajar V2, Penilaian Siswa, Sarpras, Pengumuman, dan Jadwal Pelajaran.
- Sinkronisasi payload `sekolahId` pada operasional tenant.
- Penambahan saklar emulator terpusat (`VITE_USE_FIREBASE_EMULATOR`).
