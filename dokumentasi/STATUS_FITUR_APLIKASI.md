# STATUS FITUR APLIKASI
## Aplikasi Administrasi Sekolah Digital

Diperbarui: 24 November 2026 (Sesi Audit Verifikasi Lanjutan)

Status menggunakan label:
- **SIAP PRODUKSI**: Fitur selesai diimplementasikan, divalidasi, dan diuji integrasi secara nyata.
- **BERFUNGSI (LOKAL/EMULATOR)**: Fitur berfungsi penuh di lingkungan lokal/emulator; menunggu konfigurasi kunci eksternal untuk online.
- **TERBATAS**: Berfungsi dasar namun memiliki ketergantungan perangkat keras (kamera fisik/printer) di lingkungan server/headless.

---

## DAFTAR 21 FITUR UTAMA

| No | Fitur | Status | Keterangan & Hak Akses |
|---|---|---|---|
| 1 | Login dan Autentikasi | **SIAP PRODUKSI** | Firebase Auth + Custom Claims (`platformOwner`, `role`, `sekolahId`). Tautan pendaftaran sekolah terintegrasi di halaman login. |
| 2 | Dashboard Admin | **SIAP PRODUKSI** | Tema biru, ringkasan data siswa, guru, kelas, tahun ajaran aktif. |
| 3 | Dashboard Guru | **SIAP PRODUKSI** | Tema hijau, ringkasan kelas diampu, jadwal, jurnal, modul ajar. |
| 4 | Dashboard Kepsek | **SIAP PRODUKSI** | Tema navy/eksekutif, monitoring kehadiran, persetujuan jurnal mengajar. |
| 5 | Data Siswa | **SIAP PRODUKSI** | CRUD siswa, filter kelas/rombel, impor Excel dengan deduplikasi NISN. Isolasi `sekolahId` terverifikasi (HTTP 403 saat diakses sekolah lain). |
| 6 | Data Guru | **SIAP PRODUKSI** | CRUD guru, penetapan NIP, jabatan, kelas diampu, foto profil. Isolasi `sekolahId` terverifikasi. |
| 7 | Data Kelas / Rombel | **SIAP PRODUKSI** | CRUD rombel, penetapan wali kelas, tahun ajaran terkait. Isolasi `sekolahId` terverifikasi. |
| 8 | Tahun Ajaran | **SIAP PRODUKSI** | Pengelolaan tahun ajaran aktif, semester ganjil/genap. |
| 9 | Manajemen Pengguna | **SIAP PRODUKSI** | Admin sekolah mengelola akun guru, kepala sekolah, reset akses. |
| 10 | Absensi Guru | **BERFUNGSI (LOKAL/EMULATOR)** | Barcode QR dinamis + validasi koordinat & radius GPS sekolah tanpa menyimpan jejak GPS pribadi ke database. |
| 11 | Absensi Siswa | **BERFUNGSI (LOKAL/EMULATOR)** | Pemindaian barcode QR kartu pelajar siswa oleh guru per tanggal & kelas. |
| 12 | Cetak Kartu QR Siswa | **TERBATAS** | Komponen barcode QR ter-render; pencetakan fisik bergantung dialog cetak browser. |
| 13 | Rekap Kehadiran | **SIAP PRODUKSI** | Rekap kehadiran harian/bulanan siswa dan guru, filter tanggal & status. |
| 14 | Jurnal Mengajar | **SIAP PRODUKSI** | Guru mengisi jurnal, kirim ke Kepsek; Kepsek mereview & menyetujui/revisi dengan notifikasi real-time. |
| 15 | Persetujuan | **SIAP PRODUKSI** | Menu Kepala Sekolah untuk menyetujui jurnal mengajar dan usulan administrasi. |
| 16 | Notifikasi | **SIAP PRODUKSI** | Notifikasi bel real-time di header dashboard untuk jurnal baru dan persetujuan. |
| 17 | Pengaturan Sekolah | **SIAP PRODUKSI** | Pengaturan identitas sekolah, koordinat latitude/longitude, dan radius toleransi absensi guru. |
| 18 | Monitoring Sekolah | **SIAP PRODUKSI** | Monitoring siswa, guru, rombel, pembelajaran, dan kehadiran untuk Kepala Sekolah. |
| 19 | Modul Ajar | **BERFUNGSI (LOKAL/EMULATOR)** | Modul Ajar V2 tersimpan di Firestore; pembuatan modul otomatis berbasis Gemini AI Logic siap online dengan API Key. |
| 20 | Pengumuman | **SIAP PRODUKSI** | Admin membuat & menerbitkan pengumuman sekolah; tampil di dashboard Guru dan Kepsek. |
| 21 | Laporan Sekolah | **SIAP PRODUKSI** | Laporan sarana prasarana, statistik pembelajaran, dan data rekapitulasi sekolah. |

---

## SISTEM PENDAFTARAN & PLATFORM OWNER (SUPER ADMIN)

| Fitur Khusus | Status | Keterangan & Bukti Uji |
|---|---|---|
| Pendaftaran Sekolah Online | **SIAP PRODUKSI** | `/daftar-sekolah`, validasi input, pencegahan duplikasi NPSN di backend teruji di emulator (HTTP 4xx `ALREADY_EXISTS`). |
| Persetujuan Pendaftaran | **SIAP PRODUKSI** | Platform Control, otorisasi Super Admin teruji (pengguna lain ditolak HTTP 403 `PERMISSION_DENIED`), pembuatan `schoolId` unik terverifikasi. |
| Kirim Ulang Aktivasi | **SIAP PRODUKSI** | Opsi `kirimUlang` menerbitkan token baru dan membatalkan token lama yang belum digunakan, terverifikasi di emulator. |
| Aktivasi Akun Sekolah | **SIAP PRODUKSI** | `/aktivasi-akun#token=...`, pembuatan akun Auth via Admin SDK, Custom Claims `{ role: 'admin', sekolahId }`, masa trial 30 hari, pencegahan token reuse teruji (`FAILED_PRECONDITION`). |
| Isolasi Multi-Tenant Firestore | **SIAP PRODUKSI** | Terverifikasi: Admin Sekolah A ditolak membaca/mengubah data Sekolah B (HTTP 403). |
