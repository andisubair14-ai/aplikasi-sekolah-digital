# STATUS FULL APPLICATION FUNCTIONAL TESTING

Diperbarui: 2026-11-23 (sesi lanjutan)
Lokasi: `C:\Users\ANDIS\Documents\aplikasi-sekolah-digital`
Mode: **Firebase Emulator SAJA** — tanpa deploy, tanpa produksi, tanpa email eksternal.

## Status keseluruhan: TERBATAS (pengujian berlangsung, mayoritas alur utama terverifikasi)

| Area | Status | Keterangan singkat |
|---|---|---|
| Emulator + Functions | BERHASIL | 6 emulator aktif; 3 fungsi termuat; sink email lokal aktif |
| Super Admin — pendaftaran & persetujuan | BERHASIL | ID valid `demo-reg-001` → sekolah `SDK-FE4917B8`, 3 undangan, email sink |
| Alur aktivasi 3 akun | BERHASIL | Admin/Guru/Kepsek dibuat, claim benar, 3 login berhasil |
| Admin — data master & absensi | BERHASIL | Tahun ajaran, rombel, siswa, absensi manual terverifikasi di Firestore |
| Guru — jurnal | BERHASIL | Jurnal `Dikirim` + notifikasi ke Kepsek |
| Kepsek — monitoring & persetujuan | BERHASIL | Jurnal `Disetujui` + notifikasi ke Guru |
| Isolasi dua sekolah | BERHASIL | 20/22 matriks sesuai desain; 2 kasus Guru = batas peran, bukan celah |
| Responsivitas | BERHASIL | Desktop/tablet/ponsel tanpa overflow horizontal |
| Build frontend + Functions + lint | BERHASIL | Lolos |
| Menu placeholder Super Admin | TERBATAS | 5 menu belum terhubung Firestore (jujur di UI) |
| QR/GPS/kamera/printer/AI | TERBATAS | Tidak dapat diuji penuh di lingkungan headless |
| Modul Ajar, Penilaian, Sarpras, Pengumuman, Jadwal, impor/ekspor | BELUM DIUJI (aksi) | Halaman terbuka tanpa error; tindakan CRUD belum dijalankan |
| Statistik dashboard Super Admin | GAGAL | Angka 37/562 masih konstanta, bukan data Firestore |

## Perbaikan yang sudah diterapkan (lokal, backup tersedia)

1. `functions/src/index.ts` — email sink emulator (Production tetap Resend).
2. `firestore.rules` — klaim `platformOwner` null-safe; `get` dokumen pengaturan yang belum ada; `sekolahId` pada `hasAll`/`hasOnly` koleksi tenant; guard `resource != null`.
3. `src/components/DashboardLayout.tsx`, `src/pages/Pengaturan.tsx` — payload `pengaturan/sekolah` menyertakan `sekolahId`.
4. `src/pages/DataSiswa.tsx`, `src/pages/DataGuru.tsx` — payload tenant menyertakan `sekolahId`.
5. `src/pages/AbsensiGuru.tsx` — query daftar menyertakan filter `sekolahId`.
6. `src/pages/Absensi.tsx` — fallback `nisn` untuk data lama (TypeError dan `undefined` diperbaiki).

Backup: `backup/2026-11-23_full_app_testing/`.
Bukti screenshot: `testing-evidence/` (45+ PNG).
Rincian lengkap: `FULL_APPLICATION_FUNCTIONAL_TESTING.md`.

## Langkah berikutnya (satu prioritas)
Uji interaksi QR/GPS dengan perangkat nyata bila tersedia, lalu putuskan perbaikan statistik Super Admin dan deploy Rules produksi (butuh izin terpisah).

---

## LANJUTAN 2026-11-23 (sesi kedua) — fitur yang sebelumnya belum diuji

Status keseluruhan lanjutan: **BERHASIL untuk CRUD utama; TERBATAS untuk kamera/AI/ekspor file di headless.**

| Fitur | Status | Bukti nyata |
|---|---|---|
| Modul Ajar (tambah, lihat, ubah, hapus, cetak) | BERHASIL | Dokumen V2 dibuat/diubah/dihapus; `window.print` terpicu saat modul dibuka |
| Penilaian (buat, isi nilai, ubah, rekap, cetak, hapus) | BERHASIL | `penilaian_siswa` + subkoleksi `nilai` terverifikasi; rata-rata 85→90 |
| Sarpras (inventaris, ruang, pemeliharaan, laporan, cetak) | BERHASIL | 3 koleksi sarpras terisi; laporan menghitung data; ubah jumlah 1→3 |
| Pengumuman (buat, terbitkan, ubah, lihat Guru/Kepsek, hapus) | BERHASIL | Status `Terbit` di Firestore; tampil untuk Guru & Kepsek |
| Jadwal (buat, ubah, lihat Guru, hapus) | BERHASIL | Relasi kelas `kelas-a-001` + Guru `guru-a-001` benar |
| Impor Excel valid / kolom salah / duplikat NISN | BERHASIL | 1 siswa+ringkas masuk; file salah ditolak; impor ulang ditolak |
| Ekspor Excel/CSV dari UI headless | TERBATAS | Tombol diklik, tidak ada `Browser.downloadWillBegin` / file terunduh |
| GPS simulasi + QR dinamis Admin | BERHASIL | `pengaturan/sekolah` lat -0.5 lon 119.5; `qr_absensi_guru` token 48 hex |
| Scanner QR Guru (kamera) | TERBATAS | Scanner terbuka, tetapi tidak ada kamera nyata di lingkungan headless |
| Cetak kartu pelajar | TERBATAS | QR kartu render (svg), `window.print` tidak teramati di headless |
| Fitur AI Modul Ajar | TERBATAS | Memanggil Gemini Developer API; tidak dipanggil sesuai batasan lokal |

Perbaikan baru: `instrumenPenilaian` diizinkan di Rules V2; 18 aturan `delete` tidak lagi memanggil `sekolahTidakBerubah()`; payload `sekolahId` ditambahkan di Penilaian (induk & nilai), Jadwal, QR Absensi Guru, dan impor Excel; validasi duplikat NISN ditambahkan. Backup: `backup/2026-11-23_full_app_testing/` (`*.v2/v3/v4.bak`, `PenilaianSiswa.tsx.bak`, `JadwalPelajaran.tsx.bak`, `AbsensiGuru.tsx.v2.bak`). Build frontend + Functions dan lint lulus.
