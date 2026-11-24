# DAFTAR BUG DAN PERBAIKAN
## Aplikasi Administrasi Sekolah Digital

Dokumen ini melacak bug, celah keamanan, dan perbaikan yang telah diterapkan.

---

| ID Bug | Deskripsi Masalah | Penyebab Teknis | Solusi / Perbaikan | Status |
|---|---|---|---|---|
| BUG-001 | NPSN duplikat dapat diajukan berulang kali dari formulir pendaftaran publik | Klien tidak memiliki hak akses baca ke `sekolah_platform` dan `pendaftaran_sekolah`, sehingga cek duplikasi di browser tidak dapat dilakukan. | Dibuat callable HTTPS `ajukanPendaftaranSekolah` di backend Admin SDK yang memeriksa keunikan NPSN sebelum membuat dokumen. | **SELESAI** |
| BUG-002 | Identitas pendaftar/calon admin sekolah bercampur dengan Kepala Sekolah | Form lama hanya meminta "Nama Kepala Sekolah", mengabaikan operator/admin sekolah yang sebenarnya mendaftar. | Menambahkan field `namaAdmin` pada form, rules, backend callable, dan Platform Control. | **SELESAI** |
| BUG-003 | Rules Firestore menolak dokumen pendaftaran yang memiliki namaAdmin | Fungsi `pendaftaranSekolahValid` memiliki `hasOnly` ketat tanpa `namaAdmin` dan `namaPendaftar`. | Menambahkan `namaAdmin` dan `namaPendaftar` ke daftar `hasOnly` dan menambahkan validasi tipe/panjang di `firestore.rules`. | **SELESAI** |
| BUG-004 | Tidak ada cara mengirim ulang undangan aktivasi jika email gagal atau link kadaluwarsa | Callable `setujuiPendaftaranSekolah` menolak pemrosesan jika status sudah `selesai`. | Ditambahkan parameter `kirimUlang: true` yang membatalkan token lama yang belum dipakai dan membuat token baru yang valid. | **SELESAI** |
| BUG-005 | Instance Functions di `PlatformControl.tsx` tidak mewarisi konfigurasi emulator | Menggunakan `getFunctions(auth.app)` langsung tanpa emulator host yang disetel di `firebase.ts`. | Mengubah import ke instance terpusat `functions` dari `../lib/firebase`. | **SELESAI** |
| BUG-006 | Teks usang pada modal permohonan disetujui di Platform Control | Sisa teks placeholder dari tahap awal pengembangan sebelum callable terhubung. | Mengganti teks usang dengan panel status aktivasi aktif, kode sekolah, dan tombol kirim ulang. | **SELESAI** |
| BUG-007 | Calon sekolah tidak menemukan pintu masuk pendaftaran dari halaman Login | Tidak ada tautan pendaftaran di `Login.tsx`. | Menambahkan tautan *"Daftarkan Sekolah Baru"* di footer form login. | **SELESAI** |
| BUG-008 | Instance Functions di `AktivasiAkunSekolah.tsx` terputus dari Functions Emulator | Menggunakan pemanggilan mandiri `getFunctions(auth.app, 'us-central1')` yang tidak terhubung dengan `connectFunctionsEmulator`. | Mengubah import menjadi instance terpusat `functions` dari `../lib/firebase`. | **SELESAI** |
