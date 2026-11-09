import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { db, firebaseConfig } from '../lib/firebase';

type RoleType = 'admin' | 'guru' | 'kepsek';

type UserRecord = {
  id: string;
  email?: string;
  nama?: string;
  role?: RoleType;
  guruId?: string | null;
  aktif?: boolean;
};

type GuruRecord = {
  id: string;
  nama?: string;
  jabatan?: string;
};

const PILIHAN_ROLE: { value: RoleType; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'guru', label: 'Guru' },
  { value: 'kepsek', label: 'Kepala Sekolah' },
];

const labelRole = (role?: string) =>
  PILIHAN_ROLE.find((item) => item.value === role)?.label || 'Tidak diketahui';

const badgeRole = (role?: string) => {
  switch (role) {
    case 'admin':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'guru':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'kepsek':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

export default function ManajemenPengguna() {
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [guruList, setGuruList] = useState<GuruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorData, setErrorData] = useState('');

  const [kataKunci, setKataKunci] = useState('');
  const [filterRole, setFilterRole] = useState<'semua' | RoleType>('semua');

  // Form tambah akun
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lihatPassword, setLihatPassword] = useState(false);
  const [nama, setNama] = useState('');
  const [role, setRole] = useState<RoleType>('guru');
  const [guruId, setGuruId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form edit akun
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editNama, setEditNama] = useState('');
  const [editRole, setEditRole] = useState<RoleType>('guru');
  const [editGuruId, setEditGuruId] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let usersLoaded = false;
    let guruLoaded = false;

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as UserRecord[];
        setUsersList(data);
        usersLoaded = true;
        setLoading(!(usersLoaded && guruLoaded));
        setErrorData('');
      },
      (error) => {
        console.error('Gagal mengambil akun pengguna:', error);
        setErrorData('Data akun tidak dapat dimuat. Periksa koneksi dan aturan akses Firebase.');
        setLoading(false);
      }
    );

    const unsubGuru = onSnapshot(
      collection(db, 'guru'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as GuruRecord[];
        setGuruList(data);
        guruLoaded = true;
        setLoading(!(usersLoaded && guruLoaded));
      },
      (error) => {
        console.error('Gagal mengambil data pegawai:', error);
        setErrorData('Data pegawai tidak dapat dimuat. Hubungan akun Guru belum dapat diperiksa.');
        guruLoaded = true;
        setLoading(!(usersLoaded && guruLoaded));
      }
    );

    return () => {
      unsubUsers();
      unsubGuru();
    };
  }, []);

  // Akun lama tanpa field aktif tetap dianggap aktif.
  const jumlahAdminAktif = usersList.filter(
    (user) => user.role === 'admin' && user.aktif !== false
  ).length;

  const usersTampil = useMemo(() => {
    const needle = kataKunci.trim().toLowerCase();
    return usersList
      .filter((user) => filterRole === 'semua' || user.role === filterRole)
      .filter((user) => {
        if (!needle) return true;
        return `${user.nama || ''} ${user.email || ''}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
  }, [usersList, kataKunci, filterRole]);

  const getGuru = (id?: string | null) => guruList.find((guru) => guru.id === id);

  const guruSudahTerhubung = (id: string, kecualiUserId?: string | null) =>
    usersList.some(
      (user) => user.role === 'guru' && user.guruId === id && user.id !== kecualiUserId
    );

  const resetFormTambah = () => {
    setEmail('');
    setPassword('');
    setLihatPassword(false);
    setNama('');
    setRole('guru');
    setGuruId('');
  };

  const handleOpenTambah = () => {
    resetFormTambah();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserRecord) => {
    setEditId(user.id);
    setEditEmail(user.email || '');
    setEditNama(user.nama || '');
    setEditRole((user.role || 'guru') as RoleType);
    setEditGuruId(user.guruId || '');
    setIsEditModalOpen(true);
  };

  const handleSimpanUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailBersih = email.trim().toLowerCase();
    const namaBersih = nama.trim();

    if (!namaBersih || !emailBersih) {
      alert('Nama dan email harus diisi.');
      return;
    }
    if (password.length < 6) {
      alert('Password awal minimal 6 karakter.');
      return;
    }
    if (role === 'guru') {
      if (!guruId || !getGuru(guruId)) {
        alert('Pilih data pegawai yang akan dihubungkan dengan akun Guru.');
        return;
      }
      if (guruSudahTerhubung(guruId)) {
        alert('Pegawai tersebut sudah memiliki akun login. Satu data pegawai hanya boleh dihubungkan dengan satu akun Guru.');
        return;
      }
    }

    setIsSaving(true);
    let secondaryApp: FirebaseApp | null = null;
    let akunBaru: ReturnType<typeof getAuth>['currentUser'] = null;
    let profilTersimpan = false;

    try {
      // Aplikasi Firebase sekunder menjaga sesi Admin utama agar tidak terganti.
      const namaAppSementara = `Secondary-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, namaAppSementara);
      const secondaryAuth = getAuth(secondaryApp);
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        emailBersih,
        password
      );
      akunBaru = credential.user;

      await setDoc(doc(db, 'users', credential.user.uid), {
        email: emailBersih,
        nama: namaBersih,
        role,
        guruId: role === 'guru' ? guruId : null,
        aktif: true,
        dibuatPada: new Date().toISOString(),
      });
      profilTersimpan = true;

      setIsModalOpen(false);
      resetFormTambah();
      alert('Akun berhasil dibuat. Sampaikan email dan password awal kepada pemilik akun melalui jalur yang aman, lalu minta pengguna mengganti password setelah login.');
    } catch (error: any) {
      // Jika akun Auth terbuat tetapi profil Firestore gagal dibuat, coba batalkan akun baru.
      if (akunBaru && !profilTersimpan) {
        try {
          await deleteUser(akunBaru);
        } catch (rollbackError) {
          console.error('Pembersihan akun Auth sementara gagal:', rollbackError);
        }
      }

      if (error?.code === 'auth/email-already-in-use') {
        alert('Email tersebut sudah digunakan oleh akun lain. Gunakan email berbeda.');
      } else if (error?.code === 'auth/invalid-email') {
        alert('Format email tidak valid.');
      } else if (error?.code === 'auth/weak-password') {
        alert('Password terlalu lemah. Gunakan minimal 6 karakter.');
      } else {
        console.error('Gagal membuat akun:', error);
        alert(`Gagal membuat akun. ${error?.message || 'Periksa koneksi Firebase.'}`);
      }
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (cleanupError) {
          console.warn('Aplikasi Firebase sekunder tidak dapat ditutup:', cleanupError);
        }
      }
      setIsSaving(false);
    }
  };

  const handleUpdateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editId) return;

    const namaBersih = editNama.trim();
    if (!namaBersih) {
      alert('Nama pengguna harus diisi.');
      return;
    }

    const userLama = usersList.find((user) => user.id === editId);
    if (!userLama) {
      alert('Akun yang akan diedit tidak ditemukan. Muat ulang halaman dan coba kembali.');
      return;
    }

    if (userLama.role === 'admin' && userLama.aktif !== false && editRole !== 'admin' && jumlahAdminAktif <= 1) {
      alert('Perubahan ditolak. Sekolah harus memiliki minimal satu akun Administrator.');
      return;
    }

    if (editRole === 'guru') {
      if (!editGuruId || !getGuru(editGuruId)) {
        alert('Pilih data pegawai yang akan dihubungkan dengan akun Guru.');
        return;
      }
      if (guruSudahTerhubung(editGuruId, editId)) {
        alert('Pegawai tersebut sudah terhubung dengan akun Guru lain.');
        return;
      }
    }

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', editId), {
        nama: namaBersih,
        role: editRole,
        guruId: editRole === 'guru' ? editGuruId : null,
        diperbaruiPada: new Date().toISOString(),
      });
      setIsEditModalOpen(false);
      alert('Data pengguna berhasil diperbarui.');
    } catch (error) {
      console.error('Gagal memperbarui data pengguna:', error);
      alert('Gagal memperbarui data pengguna. Periksa koneksi dan aturan akses Firebase.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKirimResetPassword = async (user: UserRecord) => {
    if (!user.email) {
      alert('Akun ini tidak memiliki alamat email.');
      return;
    }
    if (!window.confirm(`Kirim email pengaturan ulang password ke ${user.email}?`)) return;

    setResettingId(user.id);
    try {
      await sendPasswordResetEmail(getAuth(), user.email);
      alert(`Email pengaturan ulang password telah diminta untuk ${user.email}. Minta pengguna memeriksa kotak masuk dan folder spam.`);
    } catch (error: any) {
      console.error('Gagal mengirim email reset password:', error);
      if (error?.code === 'auth/user-not-found') {
        alert('Akun Firebase Authentication tidak ditemukan untuk email tersebut.');
      } else {
        alert(`Email reset password belum dapat dikirim. ${error?.message || 'Periksa konfigurasi Firebase Authentication.'}`);
      }
    } finally {
      setResettingId(null);
    }
  };

  const handleToggleAktif = async (user: UserRecord) => {
    const sedangAktif = user.aktif !== false;
    const aktifBerikutnya = !sedangAktif;
    const uidSaatIni = getAuth().currentUser?.uid;

    if (!aktifBerikutnya && user.id === uidSaatIni) {
      alert('Anda tidak dapat menonaktifkan akun yang sedang Anda gunakan.');
      return;
    }

    if (
      !aktifBerikutnya &&
      user.role === 'admin' &&
      sedangAktif &&
      jumlahAdminAktif <= 1
    ) {
      alert('Akun tidak dapat dinonaktifkan karena sekolah harus memiliki minimal satu Administrator aktif.');
      return;
    }

    const namaPengguna = user.nama || user.email || 'pengguna ini';
    const tindakan = aktifBerikutnya ? 'mengaktifkan' : 'menonaktifkan';
    const konfirmasi = window.confirm(
      `Apakah Anda yakin ingin ${tindakan} akun ${namaPengguna}?\n\n${
        aktifBerikutnya
          ? 'Pengguna akan dapat kembali mengakses aplikasi.'
          : 'Pengguna akan kehilangan akses ke halaman aplikasi dan data Firestore. Data pegawai, absensi, dan jurnal tetap tersimpan.'
      }`
    );
    if (!konfirmasi) return;

    setStatusUpdatingId(user.id);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        aktif: aktifBerikutnya,
        statusAkunDiperbaruiPada: new Date().toISOString(),
      });
      alert(
        aktifBerikutnya
          ? `Akun ${namaPengguna} berhasil diaktifkan kembali.`
          : `Akun ${namaPengguna} berhasil dinonaktifkan dari aplikasi.`
      );
    } catch (error) {
      console.error('Gagal mengubah status akun:', error);
      alert('Status akun belum berhasil diubah. Pastikan Anda login sebagai Admin aktif dan aturan Firestore sudah terpasang.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleHapusProfil = async (user: UserRecord) => {
    const currentUid = getAuth().currentUser?.uid;
    if (user.id === currentUid) {
      alert('Anda tidak dapat menghapus profil akun yang sedang digunakan untuk login.');
      return;
    }
    if (user.role === 'admin' && user.aktif !== false && jumlahAdminAktif <= 1) {
      alert('Profil tidak dapat dihapus karena ini adalah satu-satunya Administrator.');
      return;
    }

    const konfirmasi = window.confirm(
      `Hapus profil akses aplikasi untuk ${user.nama || user.email || 'pengguna ini'}?\n\nTindakan ini menghapus dokumen profil di Firestore. Akun Firebase Authentication tidak ikut dihapus oleh halaman ini dan perlu dinonaktifkan/dihapus melalui backend Admin SDK sebelum aplikasi digunakan secara produksi. Lanjutkan?`
    );
    if (!konfirmasi) return;

    setDeletingId(user.id);
    try {
      await deleteDoc(doc(db, 'users', user.id));
      alert('Profil akses aplikasi berhasil dihapus. Catatan: akun Firebase Authentication masih perlu ditangani melalui backend Admin SDK.');
    } catch (error) {
      console.error('Gagal menghapus profil pengguna:', error);
      alert('Gagal menghapus profil pengguna. Periksa koneksi dan aturan akses Firebase.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082B62]">Manajemen Pengguna</h1>
          <p className="mt-1 font-medium text-slate-500">
            Kelola akun login dan hak akses Administrator, Guru, serta Kepala Sekolah.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenTambah}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          + Buat Akun Baru
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Administrator</p>
          <p className="mt-1 text-2xl font-bold text-purple-700">{usersList.filter((user) => user.role === 'admin').length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Guru</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{usersList.filter((user) => user.role === 'guru').length}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Kepala Sekolah</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{usersList.filter((user) => user.role === 'kepsek').length}</p>
        </div>
      </div>

      {errorData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {errorData}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-[#082B62]">Daftar Akun Pengguna</h2>
            <p className="mt-1 text-xs text-slate-500">Total {usersList.length} akun terdaftar · Menampilkan {usersTampil.length} akun</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <input
              type="search"
              value={kataKunci}
              onChange={(event) => setKataKunci(event.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
            />
            <select
              value={filterRole}
              onChange={(event) => setFilterRole(event.target.value as 'semua' | RoleType)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="semua">Semua Peran</option>
              {PILIHAN_ROLE.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="p-4 font-bold">No.</th>
                <th className="p-4 font-bold">Nama Lengkap</th>
                <th className="p-4 font-bold">Email Login</th>
                <th className="p-4 font-bold">Peran</th>
                <th className="p-4 font-bold">Data Pegawai</th>
                <th className="p-4 font-bold">Status Akun</th>
                <th className="p-4 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-500">Memuat data pengguna...</td></tr>
              ) : usersTampil.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center">
                    <p className="font-semibold text-slate-600">Tidak ada akun yang cocok.</p>
                    <p className="mt-1 text-sm text-slate-400">Ubah kata kunci pencarian atau filter peran.</p>
                  </td>
                </tr>
              ) : (
                usersTampil.map((user, index) => {
                  const linkedGuru = getGuru(user.guruId);
                  return (
                    <tr key={user.id} className="border-b border-slate-100 text-sm transition-colors hover:bg-slate-50">
                      <td className="p-4 text-slate-500">{index + 1}</td>
                      <td className="p-4 font-bold text-[#082B62]">{user.nama || 'Tanpa nama'}</td>
                      <td className="p-4 text-slate-600">{user.email || '-'}</td>
                      <td className="p-4">
                        <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-bold ${badgeRole(user.role)}`}>
                          {labelRole(user.role)}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">
                        {user.role === 'guru' ? (linkedGuru?.nama || 'Belum terhubung') : '-'}
                      </td>
                      <td className="p-4">
                        {user.aktif === false ? (
                          <span className="inline-flex rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Nonaktif</span>
                        ) : (
                          <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Aktif</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <button
                            type="button"
                            onClick={() => handleToggleAktif(user)}
                            disabled={statusUpdatingId === user.id || deletingId === user.id}
                            className={`font-bold disabled:cursor-not-allowed disabled:opacity-50 ${user.aktif === false ? 'text-emerald-700 hover:text-emerald-900' : 'text-amber-700 hover:text-amber-900'}`}
                          >
                            {statusUpdatingId === user.id
                              ? 'Memproses...'
                              : user.aktif === false
                                ? 'Aktifkan'
                                : 'Nonaktifkan'}
                          </button>
                          <button type="button" onClick={() => handleOpenEdit(user)} className="font-bold text-blue-700 hover:text-blue-900">Edit</button>
                          <button
                            type="button"
                            onClick={() => handleKirimResetPassword(user)}
                            disabled={resettingId === user.id || !user.email}
                            className="font-bold text-emerald-700 hover:text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {resettingId === user.id ? 'Mengirim...' : 'Reset Password'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHapusProfil(user)}
                            disabled={deletingId === user.id || statusUpdatingId === user.id}
                            className="font-bold text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === user.id ? 'Menghapus...' : 'Hapus Profil'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-bold">Catatan pengelolaan akun</p>
        <p className="mt-1 text-blue-800">
          Reset Password mengirim tautan ke email pengguna. Nonaktifkan membatasi akses aplikasi dan Firestore melalui status profil akun; akun masih tercatat di Firebase Authentication. Hapus Profil hanya menghapus data profil Firestore, bukan akun Authentication. Minimal satu Administrator aktif harus tetap tersedia.
        </p>
      </div>

      {/* Modal tambah akun */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="my-6 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#082B62]">Buat Akun Baru</h2>
                <p className="mt-1 text-xs text-slate-500">Buat kredensial login dan tentukan hak akses pengguna.</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSimpanUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Nama Lengkap</label>
                <input value={nama} onChange={(event) => setNama(event.target.value)} required maxLength={100} placeholder="Masukkan nama pengguna" className="w-full rounded-xl border border-slate-300 px-4 py-2.5 font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Email untuk Login</label>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="Contoh: guru@sekolah.sch.id" className="w-full rounded-xl border border-slate-300 px-4 py-2.5 font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Password Awal</label>
                <div className="flex gap-2">
                  <input type={lihatPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" placeholder="Minimal 6 karakter" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  <button type="button" onClick={() => setLihatPassword((value) => !value)} className="rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">{lihatPassword ? 'Sembunyikan' : 'Lihat'}</button>
                </div>
                <p className="mt-1 text-xs text-slate-500">Gunakan password awal yang kuat dan sampaikan secara pribadi. Minta pengguna menggantinya setelah masuk.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Peran Pengguna</label>
                <select value={role} onChange={(event) => { setRole(event.target.value as RoleType); setGuruId(''); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  {PILIHAN_ROLE.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              {role === 'guru' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <label className="mb-1 block text-sm font-bold text-emerald-800">Hubungkan dengan Data Pegawai</label>
                  <select value={guruId} onChange={(event) => setGuruId(event.target.value)} required className="w-full rounded-xl border border-emerald-300 bg-white px-4 py-2.5 font-medium outline-none focus:border-emerald-500">
                    <option value="">-- Pilih Data Pegawai --</option>
                    {guruList.map((guru) => (
                      <option key={guru.id} value={guru.id} disabled={guruSudahTerhubung(guru.id)}>
                        {guru.nama || 'Tanpa nama'} ({guru.jabatan || 'Pegawai'}){guruSudahTerhubung(guru.id) ? ' — sudah memiliki akun' : ''}
                      </option>
                    ))}
                  </select>
                  {guruList.length === 0 && <p className="mt-2 text-xs text-amber-700">Belum ada Data Pegawai. Tambahkan pegawai terlebih dahulu melalui menu Data Pegawai.</p>}
                </div>
              )}
              <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={isSaving} className="rounded-xl bg-[#155EEF] px-6 py-2.5 font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSaving ? 'Membuat Akun...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edit akun */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="my-6 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#082B62]">Edit Data Pengguna</h2>
                <p className="mt-1 text-xs text-slate-500">Perbarui identitas dan hak akses akun.</p>
              </div>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Nama Lengkap</label>
                <input value={editNama} onChange={(event) => setEditNama(event.target.value)} required maxLength={100} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Email Login</label>
                <input type="email" value={editEmail} disabled className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 font-medium text-slate-500" />
                <p className="mt-1 text-xs text-slate-500">Email login tidak diubah dari halaman ini. Gunakan proses perubahan email Firebase yang terverifikasi bila diperlukan.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Peran Pengguna</label>
                <select value={editRole} onChange={(event) => { setEditRole(event.target.value as RoleType); setEditGuruId(''); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  {PILIHAN_ROLE.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              {editRole === 'guru' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <label className="mb-1 block text-sm font-bold text-emerald-800">Hubungkan dengan Data Pegawai</label>
                  <select value={editGuruId} onChange={(event) => setEditGuruId(event.target.value)} required className="w-full rounded-xl border border-emerald-300 bg-white px-4 py-2.5 font-medium outline-none focus:border-emerald-500">
                    <option value="">-- Pilih Data Pegawai --</option>
                    {guruList.map((guru) => (
                      <option key={guru.id} value={guru.id} disabled={guruSudahTerhubung(guru.id, editId)}>
                        {guru.nama || 'Tanpa nama'} ({guru.jabatan || 'Pegawai'}){guruSudahTerhubung(guru.id, editId) ? ' — sudah memiliki akun' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="rounded-xl px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={isUpdating} className="rounded-xl bg-[#155EEF] px-6 py-2.5 font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
