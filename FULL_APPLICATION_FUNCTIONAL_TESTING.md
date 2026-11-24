# FULL APPLICATION FUNCTIONAL TESTING — Laporan Akhir

Tanggal: 2026-11-23
Proyek: `C:\Users\ANDIS\Documents\aplikasi-sekolah-digital`
Lingkungan: **Firebase Emulator lokal** (Auth 9099, Firestore 8080, Functions 5001, Storage 9199, UI 4000, Hub 4400) + Vite `dev:emulator` pada 5173 + Chrome headless CDP + Desktop Preview Hermes.
Batasan dipatuhi: **tidak ada deploy, tidak ada penulisan produksi, tidak ada perubahan Custom Claims produksi, tidak ada perubahan Rules produksi, tidak ada email eksternal, tidak ada backup/perubahan Git yang dihapus.**

---

## A. Ringkasan untuk pemilik (Bahasa Indonesia sederhana)

- Aplikasi dijalankan sungguhan di emulator dan dioperasikan lewat UI, bukan hanya dilihat.
- Alur utama berhasil: **pendaftaran sekolah → persetujuan → aktivasi 3 akun → login 3 peran → operasi harian**.
- Operasi harian yang dibuktikan: tahun ajaran, rombel, siswa, absensi manual, jurnal Guru, persetujuan jurnal Kepala Sekolah.
- Tujuh masalah nyata ditemukan dan diperbaiki di lokal. Semua perbaikan dibackup dan diuji ulang.
- Beberapa menu masih placeholder dan beberapa fitur tidak bisa diuji penuh di lingkungan tanpa kamera/GPS/printer. Ini dilaporkan jujur, tidak diberi indikator hijau.
- Status akhir: **TERBATAS** — alur inti BERHASIL, sebagian fitur lanjutan BELUM DIUJI untuk tindakan nyata.

## B. Apa yang dikerjakan

### B.1 Kesiapan pengujian
- Emulator dijalankan dari export `emulator-data` (tanpa seed ulang; data lama dipertahankan).
- Verifikasi Hub `http://127.0.0.1:4400/emulators` dan port: semua emulator aktif.
- Functions termuat: `kirimKonfirmasiPendaftaran`, `setujuiPendaftaranSekolah`, `aktifkanAkunSekolah` (masalah timeout discovery lama tidak berulang).
- Flag `VITE_USE_FIREBASE_EMULATOR=true` dikonfirmasi di `.env.emulator`; frontend tidak pernah diarahkan ke produksi.

### B.2 Email sink lokal (pengganti email eksternal)
Kode Functions memanggil Resend dengan kunci yang tampak nyata. Tombol persetujuan **tidak** ditekan sebelum sink siap.
Ditambahkan `kirimEmail()` di `functions/src/index.ts`: saat `FUNCTIONS_EMULATOR === "true"`, isi email ditulis ke koleksi `email_sink` (lokal), produksi tetap memakai Resend seperti sebelumnya. Log emulator membuktikan: `[email] Sink lokal emulator aktif: email TIDAK dikirim ke layanan eksternal.`

### B.3 Matriks hasil pengujian

Status: **BERHASIL** = tindakan nyata + bukti; **GAGAL** = cacat/angka salah; **TERBATAS** = tersedia tetapi tidak dapat diverifikasi penuh; **BELUM DIUJI** = belum dijalankan.

| ID | Fitur / tindakan | Peran | Status | Bukti |
|---|---|---|---|---|
| SA-01 | Login Super Admin → `/platform-control` | Super Admin | BERHASIL | `SA-01-login.png` |
| SA-02 | Statistik dashboard (Total Sekolah 37, Pengguna 562) | Super Admin | GAGAL | `SA-02-dashboard-mock.png`; `PlatformControl.tsx:709-710` konstanta |
| SA-03 | Pencarian "Demo Dua" → 1 dari 3 sekolah | Super Admin | BERHASIL | `SA-03-cari-sekolah.png` |
| SA-04 | Buka detail pendaftaran NPSN 40000004 (ID valid) | Super Admin | BERHASIL | `SA-04-modal-valid.png` |
| SA-05 + SA-05V | Setujui `demo-reg-001` → status `selesai`, sekolah `SDK-FE4917B8`, 3 undangan, email sink 1 | Super Admin | BERHASIL | `SA-05-setujui-hasil.png`; probe Firestore |
| SA-06..SA-10 | Langganan, Monitoring Penggunaan, Laporan, Audit Log, Pengaturan Platform | Super Admin | TERBATAS | `SA-06-placeholder.png` dst.; teks jujur "Tampilan menu ini sudah disiapkan" |
| PU-01 | Form kosong ditolak | Publik | BERHASIL | `PU-01-validasi-kosong.png` |
| PU-02 | NPSN "123" ditolak: "8 digit angka" | Publik | BERHASIL | `PU-02-npsn-invalid.png` |
| PU-03 | Pendaftaran NPSN 50000005 → dokumen `menunggu_verifikasi`, email konfirmasi masuk sink | Publik | BERHASIL | `PU-03-pendaftaran-berhasil.png`; probe Firestore |
| AKT-ADMIN/GURU/KEPSEK | Aktivasi 3 akun dari token email sink | Publik | BERHASIL | `AKT-guru.png`, `AKT-kepsek.png`, probe Auth |
| AKT-CORRECTION | Token dipakai ulang (400), tidak dikenal (404), kedaluwarsa (504), password beda — semua ditolak | Publik | BERHASIL | `AKT-reuse.png`, `AKT-invalid.png`, `AKT-expired.png`, `AKT-mismatch.png` |
| LOGIN-BARU-* | Login 3 akun hasil aktivasi ke dashboard sesuai peran | Admin/Guru/Kepsek | BERHASIL | `LOGIN-BARU-admin.png`, `-guru.png`, `-kepsek.png` |
| ADM-01 | Simpan pengaturan awal jenjang SD (setelah perbaikan payload) | Admin | BERHASIL | `ADM-01-setup-jenjang.png`; `pengaturan/sekolah.sekolahId=SDK-DEMO0001` |
| ADM-02/03 | Buat dan aktifkan Tahun Ajaran 2026/2027 Ganjil | Admin | BERHASIL | `ADM-02-tahun-ajaran.png`, `ADM-03-tahun-aktif.png` |
| ADM-05/07 | Tambah rombel + edit rombel lama (tahun ajaran & wali kelas) | Admin | BERHASIL | `ADM-05-rombel-baru.png`, `ADM-07-edit-kelas-hasil.png` |
| ADM-06 | Tambah Siswa "Siswa Uji Otomatis" dengan rombel valid | Admin | BERHASIL | `ADM-06-siswa-baru.png`; `siswa` + `siswa_ringkas` memiliki `sekolahId` |
| ADM-09V | Absensi manual 2 siswa (Hadir, Sakit) | Admin | BERHASIL | `ADM-09-absensi-simpan-ulang.png`; 2 dokumen `absensi` terverifikasi |
| GUR-01 | Buat Jurnal Mengajar, status `Dikirim`, notifikasi ke Kepsek | Guru | BERHASIL | `GUR-01-jurnal-baru.png`; `users/kepsek-a-001/notifikasi` = 1 |
| KPS-01/02 | Login Kepsek, monitoring, setujui jurnal → `Disetujui`, notifikasi ke Guru | Kepsek | BERHASIL | `KPS-01-dashboard.png`, `KPS-02-jurnal-disetujui.png`; prob Firestore |
| ISO-* | Isolasi 2 sekolah: akses tenant lain ditolak, query tanpa filter ditolak | Semua | BERHASIL | 20/22 sesuai desain; 2 kasus Guru = batas peran (`siswa` hanya Admin/Kepsek) |
| RESP-* | Desktop 1440, tablet 768, ponsel 390 — tanpa overflow | Admin | BERHASIL | 6 screenshot `RESP-*.png` |
| Build | `npm run build`, `functions tsc`, `functions eslint` | — | BERHASIL | Output tanpa error (hanya peringatan chunk >500 kB) |
| Lainnya | Modul Ajar, Penilaian, Sarpras, Pengumuman, Jadwal, QR/GPS/kamera/print, impor/ekspor, AI | — | BELUM DIUJI / TERBATAS | Halaman terbuka tanpa error console; tindakan belum dijalankan |

## C. Diuji dan diverifikasi

- **Firestore, bukan hanya UI:** status pendaftaran, dokumen sekolah baru, 3 undangan, 3 akun Auth + Custom Claims, `pengaturan/sekolah`, tahun ajaran, rombel, siswa, absensi, jurnal dan notifikasi dibaca kembali dengan firebase-admin/REST.
- **Kasus negatif:** password salah, token dipakai ulang/tidak dikenal/kedaluwarsa, NPSN invalid, akses lintas tenant, query tanpa filter — semuanya ditolak sesuai aturan.
- **Console:** halaman yang diuji tidak menghasilkan error JS setelah perbaikan. HTTP 400/404/504 pada kasus negatif adalah respons yang diharapkan.
- **Bukti visual:** 102 screenshot di `testing-evidence/`.
- **Desktop Preview:** aplikasi nyata dibuka di panel preview Hermes (`http://localhost:5173`); status tidak ditandai hijau tanpa hasil uji.

## D. Masalah ditemukan dan perbaikan nyata

| # | Masalah | Dampak | Perbaikan (file) | Verifikasi |
|---|---|---|---|---|
| 1 | Functions memanggil Resend eksternal; tidak ada sink lokal | Persetujuan akan mengirim email sungguhan | `functions/src/index.ts` — sink `email_sink` hanya di emulator | Log sink aktif; 2 email tersimpan lokal; 0 email eksternal |
| 2 | `request.auth.token.platformOwner` error saat klaim tidak ada | Dashboard Admin/Kepsek/Guru terblokir "Konfigurasi sekolah belum dapat dibaca" | `firestore.rules` — `.get('platformOwner', false)` | Dashboard terbuka, error console hilang |
| 3 | Rule `get` memanggil `sekolahSayaDoc()` pada dokumen yang belum ada | `pengaturan/sekolah` kosong tidak bisa dibaca | `firestore.rules` — guard `!exists(...)` | Setup jenjang berhasil |
| 4 | `hasAll`/`hasOnly` tidak memuat `sekolahId` sementara `sekolahSayaReq()` mewajibkannya | Create siswa/guru/absensi/jurnal mustahil | `firestore.rules` — `sekolahId` ditambahkan ke 28 daftar + 4 daftar notifikasi | Siswa, absensi, jurnal tersimpan |
| 5 | Payload `pengaturan`, `siswa`, `siswa_ringkas`, `guru` tanpa `sekolahId` | PERMISSION_DENIED saat create | `DashboardLayout.tsx`, `Pengaturan.tsx`, `DataSiswa.tsx`, `DataGuru.tsx` | Dokumen memiliki `sekolahId` benar |
| 6 | Query Absensi Guru tanpa filter `sekolahId` | Rule list error 403 | `AbsensiGuru.tsx` — filter + dependency | Error console hilang |
| 7 | `nisn` siswa lama kosong → `.trim()` TypeError dan `undefined` ditulis Firestore | Simpan absensi gagal | `Absensi.tsx` — fallback ke ID siswa, normalisasi kunci | 2 dokumen absensi tersimpan |

Backup sebelum perubahan: `backup/2026-11-23_full_app_testing/` (berisi `index.ts.bak`, `firestore.rules.bak`, `.v2.bak`, `DashboardLayout.tsx.bak`, `Pengaturan.tsx.bak`, `DataSiswa.tsx.bak`, `DataGuru.tsx.bak`, `JurnalMengajar.tsx.bak`, `AbsensiGuru.tsx.bak`, `Absensi.tsx.bak`).

## E. Belum selesai / memerlukan keputusan pemilik

1. **Statistik Super Admin masih mock** (`PlatformControl.tsx:709-710` dan sekitarnya: 37 sekolah, 562 pengguna, grafik, aktivitas). Diperlukan keputusan: apakah dihitung dari `sekolah_platform`/`users` atau tetap disebut contoh. Tidak saya ubah tanpa arahan karena menyangkut tampilan eksekutif.
2. **Lima menu Super Admin masih placeholder** (Langganan & Pembayaran, Monitoring Penggunaan, Laporan & Statistik, Audit Log, Pengaturan Platform). UI sudah jujur; butuh keputusan prioritas implementasi.
3. **Kamera, GPS, printer, AI, App Check, email sungguhan** tidak dapat diverifikasi di emulator/headless. Perlu uji pada perangkat dan konfigurasi produksi terpisah dengan izin.
4. **CRUD lanjutan belum dijalankan** untuk Modul Ajar, Penilaian, Sarpras, Pengumuman, Jadwal, ekspor/impor Excel. Halaman terbuka tanpa error; ini bukan bukti fungsi.
5. **Rules produksi belum disentuh.** Perbaikan Rules di atas hanya lokal/emulator. Deploy rules + backfill `sekolahId` data lama memerlukan persetujuan terpisah.
6. **Data seed lack `siswa_ringkas`** untuk siswa lama Guru; Guru hanya dapat membaca ringkas rombel binaan. Ini temuan data uji, bukan celah isolasi.

## F. Langkah berikutnya (SATU prioritas)

Jalankan pengujian tindakan nyata CRUD pada **Modul Ajar, Penilaian, Sarpras, Pengumuman, dan Jadwal** dengan akun Guru/Admin, lalu verifikasi hasilnya di Firestore — setelah itu baru dibahas perbaikan statistik Super Admin dan deploy Rules produksi (butuh izin terpisah).

---

## G. Lanjutan pengujian fitur yang sebelumnya BELUM DIUJI (sesi kedua)

Semua tindakan di bawah dijalankan lewat UI (Chrome CDP + Desktop Preview) pada emulator dengan data dummy, lalu dibaca kembali dari Firestore.

### G.1 Modul Ajar (Guru) — BERHASIL
- Form V2 diisi lengkap; dokumen tersimpan dengan `versiStruktur: 2`, `sekolahId: SDK-DEMO0001`, `userId: guru-a-001`.
- Awalnya ditolak Rules karena `instrumenPenilaian` tidak termasuk `hasOnly`; Rules diperbaiki (backup `firestore.rules.v3.bak`).
- Lihat daftar → Buka → Ubah judul → tersimpan di Firestore → Cetak (`window.print` terpicu saat modul dibuka) → Hapus.
- Hapus awalnya gagal karena 18 aturan `delete` memanggil `sekolahTidakBerubah()` yang membaca `request.resource` (null saat delete). Rules diperbaiki (backup `firestore.rules.v4.bak`); hapus terverifikasi (`modul_ajar` kembali 0).

### G.2 Penilaian (Guru) — BERHASIL
- Buat penilaian awalnya ditolak: payload tanpa `sekolahId`. Ditambahkan di dokumen induk dan subkoleksi `nilai` (backup `PenilaianSiswa.tsx.bak`).
- Nilai siswa diisi 85 → terverifikasi di `penilaian_siswa/{id}/nilai/{siswaId}` dengan `sekolahId`; diubah menjadi 90 dan terbaca lagi di Firestore.
- Rekap menampilkan "Sudah dinilai 1, rata-rata 85.0"; cetak memanggil `window.print`; ekspor CSV diklik (file tidak teramati di headless); hapus penilaian menghapus induk + nilai.

### G.3 Sarpras (Admin) — BERHASIL
- Inventaris, ruang/fasilitas, dan pemeliharaan dibuat lewat UI; ketiga koleksi Firestore terisi dengan `sekolahId`.
- Pemeliharaan merujuk ke aset inventaris yang tersimpan (`INV-...`).
- Ubah inventaris jumlah 1→3 terverifikasi di Firestore; laporan sarpras menghitung data; tombol Cetak Laporan memanggil `window.print`.

### G.4 Pengumuman — BERHASIL
- Buat pengumuman, ubah status menjadi `Terbit` (Firestore), tampil untuk Guru dan Kepsek, lalu dihapus (koleksi kembali 0).

### G.5 Jadwal Pelajaran — BERHASIL
- Buat jadwal awalnya ditolak karena payload tanpa `sekolahId`; ditambahkan (backup `JadwalPelajaran.tsx.bak`).
- Tersimpan dengan relasi `kelasId: kelas-a-001`, `guruId: guru-a-001`, `mataPelajaran`, `hari`, `jamMulai/jamSelesai`.
- Ubah mapel menjadi "IPA Uji" terverifikasi; Guru melihat jadwal penugasannya; hapus berhasil.

### G.6 Ekspor/impor — BERHASIL (impor) / TERBATAS (ekspor)
- Template dan format kolom diidentifikasi dari kode (`DataSiswa.tsx:893-917`).
- Impor XLSX valid: 1 siswa + `siswa_ringkas` masuk, dialog "Berhasil mengimpor 1 data siswa beserta data ringkasnya".
- Impor XLSX salah kolom: ditolak ("Kelas ... tidak ditemukan secara unik"), jumlah siswa tidak berubah.
- Impor ulang file yang sama awalnya membuat duplikat; ditambahkan validasi NISN duplikat (backup sebelumnya tersedia), sehingga impor ulang kini ditolak dan jumlah tetap.
- Ekspor (Template/Download Data/Ekspor CSV) tombolnya berfungsi, tetapi Chrome headless tidak menghasilkan event `Browser.downloadWillBegin` maupun file → TERBATAS, bukan klaim berhasil.

### G.7 QR / GPS / kamera / printer / AI — BERHASIL sebagian, TERBATAS sisanya
- GPS: `navigator.geolocation` disimulasikan; tombol "Ambil Lokasi dari GPS" dan "Simpan Pengaturan" berhasil; `pengaturan/sekolah` memiliki lat `-0.5`, lon `119.5`, radius `100`.
- QR dinamis Admin: awalnya ditolak karena payload tanpa `sekolahId`; perbaikan `AbsensiGuru.tsx.v2.bak` → dokumen `pengaturan/qr_absensi_guru` ada dengan token 48 karakter heksadesimal, `expiresAt`, dan `sekolahId`.
- Scanner QR Guru terbuka, tetapi lingkungan headless tidak memiliki kamera → tidak ada pemindaian nyata (**TERBATAS**).
- Cetak kartu pelajar: QR kartu ter-render (banyak SVG), tetapi `window.print` tidak teramati (**TERBATAS**).
- Fitur "Buat Modul dengan AI" memanggil Gemini Developer API (layanan eksternal) → **TIDAK dipanggil** sesuai batasan (**TERBATAS**).

### G.8 Perbaikan tambahan dan verifikasi akhir
- `firestore.rules`: `instrumenPenilaian` diizinkan; 18 aturan delete diperbaiki; backup `.v3.bak` dan `.v4.bak`.
- Frontend: `PenilaianSiswa.tsx`, `JadwalPelajaran.tsx`, `AbsensiGuru.tsx`, `DataSiswa.tsx` (impor + deduplikasi NISN) — backup di `backup/2026-11-23_full_app_testing/`.
- `npm run build`, `functions tsc`, `functions eslint` **lulus** setelah perubahan.
- Tidak ada produksi, deploy, email eksternal, atau perubahan Git lama yang disentuh.

---

### Catatan administratif
- Git: perubahan lama yang belum di-commit **tidak dihapus dan tidak di-commit**. File baru yang ditambahkan: `STATUS_FULL_APPLICATION_TESTING.md`, `FULL_APPLICATION_FUNCTIONAL_TESTING.md`, `testing-evidence/`, `backup/2026-11-23_full_app_testing/`.
- Semua skrip probe berada di scratch Hermes (`%TMPDIR%`), bukan di proyek.
- Emulator, Vite, dan Chrome headless dihentikan pada akhir sesi.
