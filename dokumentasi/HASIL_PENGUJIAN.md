# HASIL PENGUJIAN APLIKASI
## Aplikasi Administrasi Sekolah Digital

**Tanggal Pengujian:** 24 November 2026  
**Target Pengujian:** Sistem Pendaftaran Sekolah, Validasi Duplikasi, RBAC, Isolasi Multi-Tenant, dan Build Integritas  
**Lingkungan:** Node.js v22 + Vite 8 + Firebase Emulator Suite (Auth 9099, Firestore 8080, Functions 5001, Storage 9199)

---

## 1. PENGUJIAN INTEGRASI PENDAFTARAN SEKOLAH TERHADAP FIREBASE EMULATOR (`scripts/test-registration-integration.mjs`)

Pengujian dilakukan secara nyata melalui pemanggilan jaringan HTTP Callable dan REST API ke emulator aktif:

```text
=== MEMULAI PENGUJIAN INTEGRASI PENDAFTARAN SEKOLAH (EMULATOR) ===

1. Autentikasi Pengguna Uji di Auth Emulator:
  [PASS] Super Admin berhasil login dan memperoleh idToken
  [PASS] User Admin Sekolah Demo 1 berhasil login dan memperoleh idToken

2. Menguji Pengajuan Pendaftaran Sekolah Baru (Callable: ajukanPendaftaranSekolah):
  [PASS] Pendaftaran berhasil terkirim (HTTP 200)
  [PASS] Respon callable menyatakan success: true
  [PASS] ID pendaftaran diperoleh: zZ2Bm3TIThOPCNyreMZo
  [PASS] Dokumen pendaftaran tersimpan di koleksi pendaftaran_sekolah
  [PASS] Status awal permohonan adalah 'menunggu_verifikasi'
  [PASS] Field namaAdmin tersimpan dengan benar

3. Menguji Pencegahan Pendaftaran NPSN Ganda:
  [PASS] Pengajuan kedua dengan NPSN yang sama ditolak (HTTP 4xx)
  [PASS] Error code ALREADY_EXISTS terdeteksi untuk NPSN duplikat

4. Menguji Otorisasi Persetujuan Pendaftaran (Callable: setujuiPendaftaranSekolah):
  [PASS] Pengguna anonim ditolak menyetujui pendaftaran (HTTP 401/403)
  [PASS] Pengguna tanpa klaim platformOwner ditolak (PERMISSION_DENIED)
  [PASS] Super Admin berhasil menyetujui pendaftaran (HTTP 200)
  [PASS] schoolId unik terbuat: SDK-25F30999
  [PASS] Dokumen sekolah baru dibuat di koleksi sekolah_platform
  [PASS] Status awal sekolah adalah 'nonaktif' (menunggu aktivasi admin)
  [PASS] NPSN sekolah sesuai pendaftaran
  [PASS] Status pendaftaran berubah menjadi 'selesai'

5. Menguji Aktivasi Akun Admin Sekolah (Callable: aktifkanAkunSekolah):
  [PASS] Undangan aktivasi role admin ditemukan di Firestore
  [PASS] Status awal undangan adalah 'menunggu'
  [PASS] Email aktivasi masuk ke koleksi email_sink emulator
  [PASS] Token aktivasi 64-karakter hex berhasil diekstrak dari email
  [PASS] Token palsu ditolak (HTTP 4xx)
  [PASS] Password kurang dari 10 karakter ditolak
  [PASS] Aktivasi akun Admin berhasil diproses (HTTP 200)
  [PASS] Akun terkonfirmasi dengan role 'admin'
  [PASS] Akun terikat ke sekolahId 'SDK-25F30999'
  [PASS] Pengguna berhasil dibuat di Auth Emulator
  [PASS] Custom claims memuat role: 'admin'
  [PASS] Custom claims memuat sekolahId: 'SDK-25F30999'
  [PASS] Status sekolah berubah menjadi 'aktif'
  [PASS] Status langganan berubah menjadi 'trial'
  [PASS] tanggalMulaiTrial terisi
  [PASS] tanggalBerakhirTrial terisi

6. Menguji Pencegahan Token Digunakan Dua Kali:
  [PASS] Penggunaan ulang token aktivasi ditolak (HTTP 4xx)
  [PASS] Pesan penolakan menegaskan token sudah digunakan

7. Menguji Kirim Ulang Undangan Aktivasi (Option: kirimUlang):
  [PASS] Kirim ulang undangan aktivasi oleh Super Admin berhasil (HTTP 200)
  [PASS] Kode sekolah tetap dipertahankan
  [PASS] Token aktivasi baru diterbitkan untuk role yang belum diaktifkan

========================================================
TOTAL UJI INTEGRASI: 39 | LULUS: 39 | GAGAL: 0
SEMUA PENGUJIAN INTEGRASI ALUR PENDAFTARAN & AKTIVASI BERHASIL!
```

---

## 2. PENGUJIAN ISOLASI DATA MULTI-TENANT FIRESTORE (`scripts/test-tenant-isolation.mjs`)

Memverifikasi penegakan aturan keamanan Firestore (`firestore.rules`) antarsekolah:

```text
=== MEMULAI PENGUJIAN ISOLASI DATA MULTI-TENANT (FIRESTORE) ===
  [PASS] Admin Sekolah A berhasil login
  [PASS] Admin Sekolah B berhasil login

1. Menguji Akses Data Sekolah Sendiri (Authorized):
  [PASS] Admin Sekolah A diizinkan membaca data siswa sekolahnya sendiri (HTTP 200)

2. Menguji Isolasi Data Antarsekolah (Cross-School Access Denied):
  [PASS] Admin Sekolah A DITOLAK membaca data siswa Sekolah B (HTTP 403 PERMISSION_DENIED)
  [PASS] Admin Sekolah A DITOLAK membaca data guru Sekolah B (HTTP 403 PERMISSION_DENIED)
  [PASS] Admin Sekolah A DITOLAK membaca data rombel Sekolah B (HTTP 403 PERMISSION_DENIED)

3. Menguji Upaya Manipulasi Data Antarsekolah:
  [PASS] Admin Sekolah A DITOLAK memodifikasi data siswa Sekolah B (HTTP 403 PERMISSION_DENIED)

4. Menguji Proteksi Registri Platform (sekolah_platform):
  [PASS] Admin Sekolah DITOLAK mengakses langsung koleksi sekolah_platform (Hanya Super Admin/platformOwner)

========================================================
TOTAL UJI ISOLASI: 8 | LULUS: 8 | GAGAL: 0
SEMUA PENGUJIAN ISOLASI DATA MULTI-TENANT BERHASIL!
```

---

## 3. PENGUJIAN LOGIKA SISTEM PENDAFTARAN SEKOLAH (`scripts/test-registration.mjs`)

```text
=== MEMULAI PENGUJIAN SISTEM PENDAFTARAN SEKOLAH ===

1. Menguji Validasi Input Pendaftaran:
  [PASS] NPSN 8 digit angka diterima
  [PASS] NPSN 7 digit ditolak
  [PASS] NPSN 9 digit ditolak
  [PASS] NPSN alfanumerik ditolak
  [PASS] NPSN kosong ditolak
  [PASS] Format email sekolah resmi diterima
  [PASS] Format email gmail diterima
  [PASS] Email tanpa @ ditolak
  [PASS] Email tanpa domain ditolak
  [PASS] Jenjang SD terdaftar
  [PASS] Jenjang SMP terdaftar
  [PASS] Jenjang di luar daftar ditolak

2. Menguji Identitas Calon Administrator & Kepala Sekolah:
  [PASS] Data admin & kepsek lengkap valid
  [PASS] Nama admin kosong ditolak
  [PASS] Nama kepsek kosong ditolak

3. Menguji Logika Pencegahan Duplikasi:
  [PASS] Duplikasi dengan sekolah aktif berhasil dicegah
  [PASS] Duplikasi dengan permohonan menunggu_verifikasi berhasil dicegah
  [PASS] Duplikasi dengan permohonan disetujui berhasil dicegah
  [PASS] NPSN dari permohonan ditolak diizinkan daftar ulang
  [PASS] NPSN baru yang belum pernah terdaftar diizinkan

4. Menguji Format schoolId dan Keamanan Token:
  [PASS] schoolId1 berformat SDK-XXXXXXXX (SDK-31DAE285)
  [PASS] schoolId2 berformat SDK-XXXXXXXX (SDK-3E1F9BBE)
  [PASS] Setiap pemanggilan menghasilkan schoolId yang unik
  [PASS] Token aktivasi memiliki panjang 64 heksadesimal (64 chars)
  [PASS] Hash SHA-256 token memiliki panjang 64 heksadesimal
  [PASS] Token asli tidak disimpan dalam plain text
  [PASS] Hash bersifat deterministik dan konsisten

5. Menguji Batasan Hak Akses dan Role:
  [PASS] Super Admin memiliki hak platformOwner
  [PASS] Admin sekolah memiliki role admin dan sekolahId
  [PASS] Guru memiliki role guru dan sekolahId
  [PASS] Kepala Sekolah memiliki role kepsek dan sekolahId
  [PASS] Role sembarangan dari klien ditolak

6. Menguji Alur Aktivasi dan Trial Sekolah:
  [PASS] Masa uji coba ditetapkan 30 hari
  [PASS] Tanggal berakhir (2026-12-24) lebih besar dari tanggal mulai (2026-11-24)

========================================================
TOTAL UJI: 34 | LULUS: 34 | GAGAL: 0
SEMUA PENGUJIAN LOGIKA SISTEM PENDAFTARAN SEKOLAH BERHASIL!
```

---

## 4. REKAPITULASI KESELURUHAN PENGUJIAN

| Kategori Pengujian | Jumlah Assertion | Lulus | Gagal | Status |
|---|---|---|---|---|
| Uji Integrasi Pendaftaran & Aktivasi (Emulator) | 39 | 39 | 0 | **100% LULUS** |
| Uji Isolasi Multi-Tenant Firestore | 8 | 8 | 0 | **100% LULUS** |
| Uji Logika Bisnis & Validasi Unit | 34 | 34 | 0 | **100% LULUS** |
| Frontend Production Build (`npm run build`) | — | — | — | **LULUS (2.55s)** |
| Functions TypeScript Build (`functions tsc`) | — | — | — | **LULUS** |
| Functions Linter (`functions eslint`) | — | — | — | **LULUS (0 error)** |
| **TOTAL KESELURUHAN** | **81** | **81** | **0** | **100% LULUS** |
