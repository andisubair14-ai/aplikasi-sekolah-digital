# LAPORAN AUDIT APLIKASI
## Aplikasi Administrasi Sekolah Digital

**Tanggal Audit:** 24 November 2026  
**Auditor:** Senior Full-Stack Developer & Software Architect  
**Repositori:** `C:\Users\ANDIS\Documents\aplikasi-sekolah-digital`  
**Target Arsitektur:** Multi-Tenant dengan Isolasi `schoolId` (Satu Firebase Project untuk Banyak Sekolah)

---

## 1. PEMETAAN STACK DAN ARSITEKTUR

- **Frontend:** React 19, Vite 8, TypeScript 5/7, Tailwind CSS 4, React Router 7.
- **Backend & Cloud:** Firebase Auth (Custom Claims), Cloud Firestore, Cloud Functions v2 (Node.js 22), Firebase App Check, Gemini AI Logic.
- **Tenant Scoping:** Setiap entitas data operasional (siswa, guru, kelas, absensi, jurnal, jadwal, sarpras, pengumuman, modul ajar) memiliki atribut `sekolahId`.
- **Role Hierarchy:**
  1. `platformOwner` (Super Admin): Akses Platform Control, registri seluruh sekolah, persetujuan pendaftaran.
  2. `admin` (Admin Sekolah): Akses dashboard admin, CRUD master data sekolah, akun guru/kepsek, sarpras, pengaturan radius GPS absensi.
  3. `guru`: Akses dashboard guru, modul ajar, jurnal mengajar, pemindaian QR siswa, absensi kehadiran guru berbasis radius GPS.
  4. `kepsek`: Akses dashboard eksekutif, monitoring kehadiran, peninjauan dan persetujuan jurnal mengajar guru, laporan sekolah.

---

## 2. TEMUAN AUDIT KEAMANAN & DATA

1. **Sistem Pendaftaran Sekolah:**
   - **Kondisi Lama:** Pendaftaran disimpan langsung melalui client Firestore tanpa validasi duplikasi NPSN server-side.
   - **Status Sekarang:** Dilengkapi callable `ajukanPendaftaranSekolah` yang memvalidasi NPSN dan status pendaftaran aktif secara terpercaya di backend, serta memisahkan identitas Calon Administrator dari Kepala Sekolah.
2. **Persetujuan & Pembuatan Akun:**
   - **Kondisi Lama:** Kode aktivasi dibuat, namun belum ada opsi kirim ulang (resend) dari UI Super Admin jika email gagal atau tautan kadaluwarsa.
   - **Status Sekarang:** Ditambahkan alur `kirimUlang: true` di Cloud Functions dan tombol "Kirim Ulang Undangan Aktivasi" di Platform Control.
3. **Isolasi Multi-Tenant Firestore:**
   - Rules Firestore telah disiapkan untuk memeriksa `sekolahSayaDoc()` dan `sekolahSayaReq()` pada koleksi operasional.
   - Frontend pages (`DataSiswa`, `DataGuru`, `DataKelas`, `Absensi`, `JurnalMengajar`, dll) menyertakan `sekolahId` dari `userData`.
4. **Privasi Absensi GPS:**
   - Koordinat GPS dan radius sekolah hanya disimpan pada dokumen konfigurasi admin (`pengaturan/sekolah`).
   - Riwayat lokasi dan jejak koordinat real-time guru tidak disimpan ke Firestore, sesuai ketentuan privasi.

---

## 3. STATUS KESIAPAN KOMPILASI
- **Frontend Build:** `npm run build` -> LULUS (705 modul, 0 error).
- **Backend Functions Build:** `cd functions; npm run build` -> LULUS (0 error).
- **Functions Linter:** `cd functions; npm run lint` -> LULUS (0 error).
