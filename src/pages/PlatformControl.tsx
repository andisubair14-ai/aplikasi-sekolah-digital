import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../lib/firebase';
import gambarGedungSekolah from '../assets/gedung-sekolah.png';
import gambarPetaIndonesia from '../assets/peta-indonesia.png';
import gambarKarakterSuperAdmin from '../assets/karakter-super-admin.png';
import gambarServerCloud from '../assets/ilustrasi-server-cloud.png';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type IconName =
  | 'dashboard' | 'school' | 'users' | 'check' | 'card' | 'chart'
  | 'file' | 'history' | 'settings' | 'menu' | 'bell' | 'help'
  | 'chevron' | 'plus' | 'layers' | 'calendar' | 'arrow' | 'shield'
  | 'logout' | 'search' | 'clock' | 'trend' | 'map' | 'book';

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
    school: <><path d="m3 10 9-6 9 6" /><path d="M5 10v10h14V10M3 20h18M9 20v-6h6v6" /><path d="M12 4V2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    check: <><path d="m5 12 4 4L19 6" /><rect x="3" y="3" width="18" height="18" rx="4" /></>,
    card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M3 10h18M7 15h3" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 3 6-7" /><path d="M17 6h4v4" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.3 1.7c-1.1 1.1-1.9 1.4-1.9 3M12 17h.01" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 5.5v16.5M8 7h8M8 11h8" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const growthData = [
  { month: 'Jan', schools: 4, target: 5 },
  { month: 'Feb', schools: 7, target: 10 },
  { month: 'Mar', schools: 9, target: 13 },
  { month: 'Apr', schools: 12, target: 15 },
  { month: 'Mei', schools: 15, target: 18 },
  { month: 'Jun', schools: 18, target: 22 },
  { month: 'Jul', schools: 21, target: 25 },
  { month: 'Agt', schools: 24, target: 28 },
  { month: 'Sep', schools: 27, target: 31 },
  { month: 'Okt', schools: 31, target: 34 },
  { month: 'Nov', schools: 37, target: 37 },
];

const subscriptionData = [
  { name: 'Aktif', value: 32, color: '#08B98A' },
  { name: 'Akan Berakhir', value: 3, color: '#1677FF' },
  { name: 'Nonaktif', value: 2, color: '#FF8A21' },
];

const featureData = [
  { name: 'Data Siswa', value: 94, color: '#1677F8' },
  { name: 'Absensi', value: 89, color: '#08B98A' },
  { name: 'Jurnal Mengajar', value: 78, color: '#8B45F5' },
  { name: 'Laporan', value: 72, color: '#F59A23' },
];

const activities = [
  { icon: 'check' as const, color: 'bg-emerald-50 text-emerald-600', title: 'Sekolah baru berhasil disetujui', detail: 'Baru saja · Persetujuan pendaftaran' },
  { icon: 'school' as const, color: 'bg-blue-50 text-blue-600', title: 'Pendaftaran sekolah baru diterima', detail: '27 menit lalu · Menunggu verifikasi' },
  { icon: 'card' as const, color: 'bg-violet-50 text-violet-600', title: 'Pembaruan langganan tercatat', detail: '1 jam lalu · Manajemen langganan' },
  { icon: 'layers' as const, color: 'bg-orange-50 text-orange-600', title: 'Paket langganan diperbarui', detail: '2 jam lalu · Pengaturan paket' },
];

const menuItems: { label: string; icon: IconName; description: string }[] = [
  { label: 'Dashboard', icon: 'dashboard', description: 'Ringkasan kondisi platform secara menyeluruh.' },
  { label: 'Manajemen Sekolah', icon: 'school', description: 'Kelola profil dan status seluruh sekolah.' },
  { label: 'Persetujuan Pendaftaran', icon: 'check', description: 'Tinjau dan verifikasi pendaftaran sekolah.' },
  { label: 'Langganan & Pembayaran', icon: 'card', description: 'Kelola paket, masa aktif, dan pembayaran.' },
  { label: 'Monitoring Penggunaan', icon: 'chart', description: 'Pantau aktivitas dan penggunaan fitur.' },
  { label: 'Laporan & Statistik', icon: 'file', description: 'Lihat ringkasan dan laporan platform.' },
  { label: 'Audit Log', icon: 'history', description: 'Telusuri riwayat aktivitas administrator.' },
  { label: 'Pengaturan Platform', icon: 'settings', description: 'Atur konfigurasi utama platform.' },
];

function MetricCard({
  title, value, change, icon, tone,
}: {
  title: string; value: string; change: string; icon: IconName;
  tone: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const tones = {
    blue: 'from-[#0879F9] to-[#0870E8]',
    green: 'from-[#08B98A] to-[#00A982]',
    purple: 'from-[#7439F2] to-[#A33DF0]',
    orange: 'from-[#FF7900] to-[#FF9D28]',
  };
  return (
    <div className={`relative isolate overflow-hidden rounded-[20px] bg-gradient-to-br ${tones[tone]} p-3 sm:p-5 lg:p-6 min-h-[104px] sm:min-h-[112px] text-white shadow-lg shadow-slate-200/70`}>
      <div className="absolute -right-2 -bottom-5 opacity-[0.13]"><Icon name={icon} className="h-16 w-16 sm:h-24 sm:w-24" /></div>
      <div className="relative flex items-center gap-2 sm:gap-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/20 sm:h-14 sm:w-14">
          <Icon name={icon} className="h-5 w-5 sm:h-7 sm:w-7" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] leading-tight font-semibold text-white/85 sm:text-sm">{title}</p>
          <p className="mt-1 text-2xl font-extrabold leading-none tracking-tight sm:mt-0.5 sm:text-[34px]">{value}</p>
          <p className="mt-1.5 text-[9px] font-bold text-white/90 sm:mt-2 sm:text-[11px]">{change}</p>
        </div>
      </div>
    </div>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-slate-100/90 bg-white p-3 shadow-[0_10px_30px_rgba(20,55,110,0.075)] sm:p-5 lg:p-6 ${className}`}>{children}</section>;
}

function PanelTitle({ icon, children, action }: { icon: IconName; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4 sm:gap-3">
      <h2 className="flex min-w-0 items-center gap-1.5 text-[11px] font-extrabold tracking-tight text-[#102B59] sm:gap-2 sm:text-base">
        <span className="text-[#1268E8]"><Icon name={icon} className="h-4 w-4 sm:h-5 sm:w-5" /></span>
        <span className="truncate">{children}</span>
      </h2>
      {action}
    </div>
  );
}

type SchoolRecord = {
  id: string; namaSekolah: string; npsn: string; jenjang: string; provinsi: string;
  kabupaten: string; alamat: string; email: string; telepon: string;
  latitude: number | null; longitude: number | null;
  status: 'aktif' | 'nonaktif' | 'suspend';
  statusLangganan: 'trial' | 'aktif_berlangganan' | 'kedaluwarsa' | 'belum_diatur';
  tanggalMulaiTrial: string; tanggalBerakhirTrial: string;
  createdAt?: unknown;
};

type TrialMode = 'pertahankan' | 'otomatis' | 'manual';

function getLocalDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateInputValue(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }
  return '';
}

function addDaysToDateInput(dateValue: string, days: number): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function formatTrialDate(value: string): string {
  if (!value) return 'Belum diatur';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getEffectiveSubscriptionStatus(school: SchoolRecord): SchoolRecord['statusLangganan'] {
  if (school.statusLangganan === 'trial' && school.tanggalBerakhirTrial && school.tanggalBerakhirTrial < getLocalDateInputValue()) {
    return 'kedaluwarsa';
  }
  return school.statusLangganan;
}

function getTrialStatusLabel(status: SchoolRecord['statusLangganan']): string {
  if (status === 'trial') return 'Masa Trial';
  if (status === 'aktif_berlangganan') return 'Aktif Berlangganan';
  if (status === 'kedaluwarsa') return 'Kedaluwarsa';
  return 'Belum Diatur';
}

type SchoolMapLocation = {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
};

type RegistrationStatus =
  | 'menunggu_verifikasi'
  | 'perlu_perbaikan'
  | 'ditolak'
  | 'disetujui_menunggu_provisioning'
  | 'selesai';

type SchoolRegistration = {
  id: string;
  namaSekolah: string;
  npsn: string;
  jenjang: string;
  provinsi: string;
  kabupaten: string;
  alamat: string;
  namaAdmin?: string;
  namaKepalaSekolah: string;
  email: string;
  telepon: string;
  status: RegistrationStatus;
  sekolahId?: string;
  emailAktivasi?: {
    status?: string;
    keterangan?: string;
    resendId?: string;
    dikirimPada?: any;
  };
  catatanPendaftar: string;
  catatanAdmin: string;
  createdAt?: any;
};

export default function PlatformControl() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [schoolLocation, setSchoolLocation] = useState<SchoolMapLocation | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [mapInfoOpen, setMapInfoOpen] = useState(false);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolStatusFilter, setSchoolStatusFilter] = useState('semua');
  const [schoolModalOpen, setSchoolModalOpen] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [savingSchool, setSavingSchool] = useState(false);
  const [schoolFormError, setSchoolFormError] = useState('');
  const emptySchoolForm = { namaSekolah: '', npsn: '', jenjang: 'SD', provinsi: '', kabupaten: '', alamat: '', email: '', telepon: '', latitude: '', longitude: '', status: 'aktif' as 'aktif' | 'nonaktif' | 'suspend' };
  const [schoolForm, setSchoolForm] = useState(emptySchoolForm);
  const [trialMode, setTrialMode] = useState<TrialMode>('otomatis');
  const [manualTrialStart, setManualTrialStart] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<SchoolRecord | null>(null);
  const email = auth.currentUser?.email || 'Platform Owner';

  // Data pendaftaran sekolah untuk menu Persetujuan Pendaftaran.
  const [registrations, setRegistrations] = useState<SchoolRegistration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsError, setRegistrationsError] = useState('');
  const [selectedRegistration, setSelectedRegistration] = useState<SchoolRegistration | null>(null);
  const [registrationNote, setRegistrationNote] = useState('');
  const [registrationAction, setRegistrationAction] = useState<'tolak' | 'perbaikan' | null>(null);
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationFilter, setRegistrationFilter] = useState('semua');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'pendaftaran_sekolah'), (snapshot) => {
      const rows = snapshot.docs.map((item) => {
        const data = item.data();
        const allowed: RegistrationStatus[] = [
          'menunggu_verifikasi', 'perlu_perbaikan', 'ditolak',
          'disetujui_menunggu_provisioning', 'selesai',
        ];
        return {
          id: item.id,
          namaSekolah: String(data.namaSekolah || ''),
          npsn: String(data.npsn || ''),
          jenjang: String(data.jenjang || 'SD'),
          provinsi: String(data.provinsi || ''),
          kabupaten: String(data.kabupaten || ''),
          alamat: String(data.alamat || ''),
          namaAdmin: String(data.namaAdmin || data.namaPendaftar || ''),
          namaKepalaSekolah: String(data.namaKepalaSekolah || ''),
          email: String(data.email || ''),
          telepon: String(data.telepon || ''),
          status: (allowed.includes(data.status) ? data.status : 'menunggu_verifikasi') as RegistrationStatus,
          sekolahId: data.sekolahId ? String(data.sekolahId) : undefined,
          emailAktivasi: data.emailAktivasi || undefined,
          catatanPendaftar: String(data.catatanPendaftar || ''),
          catatanAdmin: String(data.catatanAdmin || ''),
          createdAt: data.createdAt,
        };
      });
      rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setRegistrations(rows);
      setRegistrationsLoading(false);
      setRegistrationsError('');
    }, (error) => {
      console.error('Gagal memuat pendaftaran sekolah:', error);
      setRegistrationsLoading(false);
      setRegistrationsError('Data pendaftaran belum dapat dibaca. Periksa Rules Firestore untuk koleksi pendaftaran_sekolah.');
    });
    return unsubscribe;
  }, []);

  const filteredRegistrations = registrations.filter((item) => {
    const term = registrationSearch.trim().toLowerCase();
    const matchesSearch = !term || [
      item.namaSekolah, item.npsn, item.namaKepalaSekolah, item.email, item.kabupaten, item.provinsi,
    ].some((value) => value.toLowerCase().includes(term));
    return matchesSearch && (registrationFilter === 'semua' || item.status === registrationFilter);
  });

  const formatRegistrationDate = (value: any) => {
    const date = value?.toDate?.() || (value instanceof Date ? value : null);
    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
      : 'Waktu belum tersedia';
  };

  const registrationStatusLabel = (status: RegistrationStatus) => ({
    menunggu_verifikasi: 'Menunggu Verifikasi',
    perlu_perbaikan: 'Perlu Perbaikan',
    ditolak: 'Ditolak',
    disetujui_menunggu_provisioning: 'Disetujui · Menunggu Aktivasi',
    selesai: 'Selesai',
  }[status]);

  const saveRegistrationDecision = async (
  registration: SchoolRegistration,
  status: RegistrationStatus,
  note = '',
) => {
  if (savingRegistration) return;

  if ((status === 'ditolak' || status === 'perlu_perbaikan') && !note.trim()) {
    alert(status === 'ditolak'
      ? 'Alasan penolakan wajib diisi.'
      : 'Catatan perbaikan wajib diisi.');
    return;
  }

  if (status === 'disetujui_menunggu_provisioning') {
    const konfirmasi = window.confirm(
      `Setujui pendaftaran ${registration.namaSekolah}?\n\n` +
      'Sistem akan membuat kode sekolah dan menyiapkan tiga undangan aktivasi untuk Admin, Guru, dan Kepala Sekolah.'
    );

    if (!konfirmasi) return;
  }

  setSavingRegistration(true);

  try {
    if (status === 'disetujui_menunggu_provisioning') {
      const prosesPersetujuan = httpsCallable<
        { pendaftaranId: string; kirimUlang?: boolean },
        { success: boolean; sekolahId: string }
      >(functions, 'setujuiPendaftaranSekolah');

      const hasil = await prosesPersetujuan({
        pendaftaranId: registration.id,
      });

      alert(
        `Pendaftaran berhasil diproses!\n\n` +
        `Kode Sekolah: ${hasil.data.sekolahId}\n` +
        'Undangan aktivasi telah dikirim ke email kontak sekolah.'
      );
    } else {
      await updateDoc(doc(db, 'pendaftaran_sekolah', registration.id), {
        status,
        catatanAdmin: note.trim(),
        ditinjauOleh: auth.currentUser?.uid || null,
        ditinjauEmail: auth.currentUser?.email || null,
        ditinjauPada: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    setSelectedRegistration(null);
    setRegistrationAction(null);
    setRegistrationNote('');
  } catch (error) {
    console.error('Gagal memproses keputusan pendaftaran:', error);

    const pesan = error instanceof Error
      ? error.message
      : 'Terjadi kesalahan yang tidak diketahui.';

    alert(`Proses belum berhasil:\n${pesan}`);
  } finally {
    setSavingRegistration(false);
  }
};

const handleKirimUlangAktivasi = async (registration: SchoolRegistration) => {
  if (savingRegistration) return;

  const konfirmasi = window.confirm(
    `Kirim ulang undangan aktivasi untuk ${registration.namaSekolah} (${registration.sekolahId || ''})?\n\n` +
    'Token aktivasi baru akan dibuat dan dikirimkan ke alamat email kontak sekolah.'
  );

  if (!konfirmasi) return;

  setSavingRegistration(true);

  try {
    const prosesPersetujuan = httpsCallable<
      { pendaftaranId: string; kirimUlang?: boolean },
      { success: boolean; sekolahId: string }
    >(functions, 'setujuiPendaftaranSekolah');

    const hasil = await prosesPersetujuan({
      pendaftaranId: registration.id,
      kirimUlang: true,
    });

    alert(
      `Undangan aktivasi berhasil dikirim ulang!\n\n` +
      `Kode Sekolah: ${hasil.data.sekolahId}\n` +
      'Tautan aktivasi baru telah dikirimkan ke email kontak sekolah.'
    );

    setSelectedRegistration(null);
  } catch (error) {
    console.error('Gagal mengirim ulang aktivasi:', error);
    const pesan = error instanceof Error ? error.message : 'Terjadi kesalahan sistem.';
    alert(`Kirim ulang belum berhasil:\n${pesan}`);
  } finally {
    setSavingRegistration(false);
  }
};

  useEffect(() => {
    setSchoolsLoading(true);
    const schoolsQuery = query(collection(db, 'sekolah_platform'), orderBy('namaSekolah', 'asc'));
    const unsubscribe = onSnapshot(schoolsQuery, (snapshot) => {
      const rows = snapshot.docs.map((schoolDoc) => {
        const data = schoolDoc.data();
        const lat = data.latitude === null || data.latitude === undefined || data.latitude === '' ? NaN : Number(data.latitude);
        const lng = data.longitude === null || data.longitude === undefined || data.longitude === '' ? NaN : Number(data.longitude);
        return {
          id: schoolDoc.id,
          namaSekolah: String(data.namaSekolah || ''), npsn: String(data.npsn || ''),
          jenjang: String(data.jenjang || 'SD'), provinsi: String(data.provinsi || ''),
          kabupaten: String(data.kabupaten || ''), alamat: String(data.alamat || ''),
          email: String(data.email || ''), telepon: String(data.telepon || ''),
          latitude: Number.isFinite(lat) ? lat : null, longitude: Number.isFinite(lng) ? lng : null,
          status: (['aktif', 'nonaktif', 'suspend'].includes(data.status) ? data.status : 'nonaktif') as SchoolRecord['status'],
          statusLangganan: (['trial', 'aktif_berlangganan', 'kedaluwarsa'].includes(data.statusLangganan) ? data.statusLangganan : 'belum_diatur') as SchoolRecord['statusLangganan'],
          tanggalMulaiTrial: toDateInputValue(data.tanggalMulaiTrial),
          tanggalBerakhirTrial: toDateInputValue(data.tanggalBerakhirTrial),
          createdAt: data.createdAt,
        };
      });
      setSchools(rows);
      setSchoolsLoading(false);
      setSchoolsError('');
    }, (error) => {
      console.error('Gagal memuat registri sekolah:', error);
      setSchoolsLoading(false);
      setSchoolsError('Data sekolah belum dapat dibaca. Periksa aturan Firestore koleksi sekolah_platform.');
    });
    return unsubscribe;
  }, []);

  const filteredSchools = schools.filter((school) => {
    const term = schoolSearch.trim().toLowerCase();
    const matchesSearch = !term || [school.namaSekolah, school.npsn, school.provinsi, school.kabupaten].some((value) => value.toLowerCase().includes(term));
    const matchesStatus = schoolStatusFilter === 'semua' || school.status === schoolStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const openSchoolForm = (school?: SchoolRecord) => {
    setSchoolFormError('');
    setEditingSchoolId(school?.id || null);
    setSelectedSchool(null);
    setSchoolForm(school ? {
      namaSekolah: school.namaSekolah, npsn: school.npsn, jenjang: school.jenjang,
      provinsi: school.provinsi, kabupaten: school.kabupaten, alamat: school.alamat,
      email: school.email, telepon: school.telepon,
      latitude: school.latitude === null ? '' : String(school.latitude),
      longitude: school.longitude === null ? '' : String(school.longitude), status: school.status,
    } : emptySchoolForm);
    setTrialMode(school ? 'pertahankan' : 'otomatis');
    setManualTrialStart(school?.tanggalMulaiTrial || '');
    setSchoolModalOpen(true);
  };

  const saveSchool = async () => {
    if (!schoolForm.namaSekolah.trim() || !schoolForm.npsn.trim() || !schoolForm.provinsi.trim() || !schoolForm.kabupaten.trim()) {
      setSchoolFormError('Nama sekolah, NPSN, provinsi, dan kabupaten/kota wajib diisi.'); return;
    }
    if (schoolForm.npsn.trim().length !== 8 || !/^\d{8}$/.test(schoolForm.npsn.trim())) {
      setSchoolFormError('NPSN harus terdiri dari 8 angka.'); return;
    }
    const latitude = schoolForm.latitude.trim() ? Number(schoolForm.latitude) : null;
    const longitude = schoolForm.longitude.trim() ? Number(schoolForm.longitude) : null;
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      setSchoolFormError('Isi latitude dan longitude secara berpasangan dengan koordinat yang valid.'); return;
    }
    if (schools.some((school) => school.npsn === schoolForm.npsn.trim() && school.id !== editingSchoolId)) {
      setSchoolFormError('NPSN tersebut sudah terdaftar di registri platform.'); return;
    }
    const trialStart = trialMode === 'otomatis' ? getLocalDateInputValue() : manualTrialStart;
    if (trialMode !== 'pertahankan' && !trialStart) {
      setSchoolFormError('Pilih tanggal mulai trial untuk mode manual.'); return;
    }
    const trialEnd = trialMode === 'pertahankan' ? '' : addDaysToDateInput(trialStart, 30);
    setSavingSchool(true); setSchoolFormError('');
    const payload = {
      namaSekolah: schoolForm.namaSekolah.trim(), npsn: schoolForm.npsn.trim(), jenjang: schoolForm.jenjang,
      provinsi: schoolForm.provinsi.trim(), kabupaten: schoolForm.kabupaten.trim(), alamat: schoolForm.alamat.trim(),
      email: schoolForm.email.trim(), telepon: schoolForm.telepon.trim(), latitude, longitude,
      status: schoolForm.status,
      ...(trialMode !== 'pertahankan' ? {
        statusLangganan: 'trial' as const,
        tanggalMulaiTrial: trialStart,
        tanggalBerakhirTrial: trialEnd,
        durasiTrial: 30,
        metodeMulaiTrial: trialMode,
      } : {}),
      updatedAt: serverTimestamp(),
    };
    try {
      if (editingSchoolId) await updateDoc(doc(db, 'sekolah_platform', editingSchoolId), payload);
      else await addDoc(collection(db, 'sekolah_platform'), { ...payload, createdAt: serverTimestamp() });
      setSchoolModalOpen(false); setSchoolForm(emptySchoolForm); setEditingSchoolId(null);
    } catch (error) {
      console.error('Gagal menyimpan data sekolah:', error);
      setSchoolFormError('Gagal menyimpan. Pastikan Rules Firestore untuk Platform Owner sudah dipasang dan dipublikasikan.');
    } finally { setSavingSchool(false); }
  };

  const updateSchoolStatus = async (school: SchoolRecord, status: SchoolRecord['status']) => {
    const label = status === 'aktif' ? 'mengaktifkan' : status === 'suspend' ? 'menangguhkan' : 'menonaktifkan';
    if (!window.confirm(`Apakah Anda yakin ingin ${label} ${school.namaSekolah}?`)) return;
    try { await updateDoc(doc(db, 'sekolah_platform', school.id), { status, updatedAt: serverTimestamp() }); }
    catch (error) { console.error(error); alert('Status gagal diperbarui. Periksa Rules Firestore.'); }
  };

  useEffect(() => {
    let cancelled = false;

    const loadSchoolLocation = async () => {
      setMapLoading(true);
      setMapError('');
      try {
        // Sumber lokasi yang memang sudah digunakan modul Pengaturan sekolah.
        const schoolSettingsRef = doc(db, 'pengaturan', 'sekolah');
        const schoolSettingsSnap = await getDoc(schoolSettingsRef);

        if (!schoolSettingsSnap.exists()) {
          if (!cancelled) setSchoolLocation(null);
          return;
        }

        const data = schoolSettingsSnap.data();
        const latitude = Number(data.latitudeSekolah);
        const longitude = Number(data.longitudeSekolah);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          if (!cancelled) setSchoolLocation(null);
          return;
        }

        if (!cancelled) {
          setSchoolLocation({
            latitude,
            longitude,
            name: String(data.namaSekolah || data.nama || 'Sekolah terdaftar'),
            address: String(data.alamatSekolah || data.alamat || ''),
          });
        }
      } catch (error) {
        console.error('Gagal membaca lokasi sekolah untuk peta Platform Control:', error);
        if (!cancelled) {
          setSchoolLocation(null);
          setMapError('Lokasi belum dapat dibaca. Periksa izin Firestore untuk Platform Owner.');
        }
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    };

    void loadSchoolLocation();
    return () => { cancelled = true; };
  }, []);

  const trialSchoolsCount = schools.filter((school) => getEffectiveSubscriptionStatus(school) === 'trial').length;

  const activeDescription = useMemo(
    () => menuItems.find((item) => item.label === activeMenu)?.description || '',
    [activeMenu],
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/', { replace: true });
    } catch {
      alert('Gagal keluar dari Platform Control. Silakan coba kembali.');
    }
  };

  const selectMenu = (label: string) => {
    setActiveMenu(label);
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-[#EEF3FF] font-sans text-[#102B59]">
      {mobileOpen && <button aria-label="Tutup menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-[#061B49]/60 backdrop-blur-sm lg:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col overflow-hidden bg-gradient-to-b from-[#062B69] via-[#082B68] to-[#071D50] text-white shadow-2xl transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="relative flex items-center gap-3 border-b border-white/10 px-5 py-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-lg">
            <div className="text-[27px] leading-none">🎓</div>
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold tracking-tight">Sekolah Digital</h1>
            <p className="text-[11px] font-medium text-blue-200">Platform Control</p>
          </div>
        </div>

        <div className="mx-4 mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 text-lg font-black text-white shadow-lg">SA</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Super Admin</p>
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Platform Owner</p>
          </div>
        </div>

        <p className="px-6 pb-2 pt-7 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-300/70">Menu Utama</p>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {menuItems.map((item) => {
            const active = activeMenu === item.label;
            return (
              <button key={item.label} onClick={() => selectMenu(item.label)} className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-semibold transition-all ${active ? 'bg-gradient-to-r from-[#087CFF] to-[#1761E8] text-white shadow-lg shadow-blue-950/30' : 'text-blue-100/85 hover:bg-white/10 hover:text-white'}`}>
                <Icon name={item.icon} className="h-[19px] w-[19px] shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {active && <Icon name="chevron" className="h-4 w-4" />}
              </button>
            );
          })}
        </nav>

        <div className="relative mx-4 mb-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-b from-[#0B4B9B] via-[#082F70] to-[#071D50] p-4">
          <div className="absolute -right-5 -top-7 h-28 w-28 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative mb-3 flex h-24 items-center justify-center overflow-hidden rounded-xl sm:h-[150px]">
            <div className="absolute left-1 top-1 z-10 rounded-full bg-cyan-300/15 px-3 py-1 text-[10px] font-bold text-cyan-100">CLOUD SYSTEM</div>
            <img
              src={gambarServerCloud}
              alt="Ilustrasi server dan cloud Sekolah Digital"
              className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(34,211,238,0.22)]"
            />
          </div>
          <div className="relative border-t border-white/10 pt-3">
            <div className="mb-2 flex items-center gap-2 text-cyan-200"><Icon name="shield" className="h-5 w-5" /><span className="text-xs font-extrabold">Platform Terlindungi</span></div>
            <p className="text-[11px] leading-relaxed text-blue-100/80">Akses khusus pengelola utama Sekolah Digital.</p>
            <div className="mt-3 flex items-center justify-between">
              <div><p className="text-[9px] uppercase tracking-widest text-blue-200/60">SECURE ACCESS</p><p className="text-xs font-bold text-white">Owner Console</p></div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-200"><Icon name="shield" className="h-4 w-4" /></div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[74px] items-center justify-between gap-3 bg-gradient-to-r from-[#073DAD] via-[#1457D8] to-[#6635DB] px-4 text-white shadow-lg shadow-blue-950/10 sm:px-6 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl p-2 hover:bg-white/15 lg:hidden" aria-label="Buka menu"><Icon name="menu" className="h-6 w-6" /></button>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-amber-300"><span className="text-2xl">♛</span></div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold tracking-tight sm:text-xl">Platform Control – Super Admin</h1>
              <p className="hidden text-[10px] text-blue-100/80 sm:block">Pusat kendali Aplikasi Sekolah Digital</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <button className="relative rounded-full p-2 text-white/90 transition hover:bg-white/15" aria-label="Notifikasi"><Icon name="bell" className="h-5 w-5 sm:h-6 sm:w-6" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-blue-600 bg-rose-400" /></button>
            <button className="hidden rounded-full p-2 text-white/90 transition hover:bg-white/15 sm:block" aria-label="Bantuan"><Icon name="help" className="h-6 w-6" /></button>
            <div className="relative">
              <button onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2 rounded-full p-1.5 pr-1 transition hover:bg-white/15 sm:gap-3 sm:pr-2">
                <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-white/60 bg-gradient-to-br from-amber-200 to-orange-400 text-sm font-black text-blue-950">SA</div>
                <span className="hidden text-left sm:block"><span className="block text-xs font-extrabold">Super Admin</span><span className="block text-[10px] text-blue-100">Platform Owner</span></span>
                <span className="hidden text-sm sm:block">⌄</span>
              </button>
              {profileOpen && <div className="absolute right-0 top-14 z-50 w-64 rounded-2xl border border-slate-100 bg-white p-3 text-slate-700 shadow-2xl"><p className="truncate px-2 py-2 text-xs text-slate-500">{email}</p><button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50"><Icon name="logout" className="h-4 w-4" /> Keluar dari Platform</button></div>}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-3 sm:p-5 lg:p-6">
          {activeMenu === 'Dashboard' ? (
            <div className="mx-auto max-w-[1700px] space-y-4 sm:space-y-6">
              <section className="relative isolate flex min-h-[190px] overflow-hidden rounded-[24px] bg-gradient-to-r from-[#0639B5] via-[#0878EA] to-[#28B6E8] shadow-xl shadow-blue-900/10 ring-1 ring-white/60">
                <div className="absolute inset-0 -z-10">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#062F9D] via-[#0866D7] to-[#22A9E7]" />
                  <img
                    src={gambarGedungSekolah}
                    alt=""
                    className="absolute inset-y-0 right-0 h-full w-[72%] object-cover object-center opacity-95 max-sm:w-[62%] max-sm:opacity-65"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#062F9D]/95 via-[#0866D7]/75 to-[#0879D8]/10" />
                  <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full border-[28px] border-white/10" />
                  <div className="absolute right-28 -top-28 h-72 w-72 rounded-full border-[18px] border-cyan-100/10" />
                </div>
                <div className="relative z-10 flex w-full items-center gap-2 px-3 py-4 sm:gap-4 sm:px-8 sm:py-6">
                  <div className="relative flex h-[92px] w-[66px] shrink-0 items-end justify-center sm:h-[168px] sm:w-[190px]">
                    <img
                      src={gambarKarakterSuperAdmin}
                      alt="Karakter 3D Super Admin Sekolah Digital"
                      className="h-full w-full scale-100 object-contain object-bottom drop-shadow-[0_10px_18px_rgba(0,20,80,0.28)] sm:scale-110"
                    />
                  </div>
                  <div className="max-w-2xl">
                    <p className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-cyan-100 sm:mb-2 sm:gap-2 sm:px-3 sm:text-[10px]">Control Center <span className="h-1 w-1 rounded-full bg-emerald-300" /> Online</p>
                    <h2 className="text-base font-extrabold leading-tight tracking-tight text-white sm:text-[32px]">Selamat Datang, Super Admin <span className="text-amber-300">♛</span></h2>
                    <p className="mt-1 max-w-xl text-[10px] leading-snug text-blue-50 sm:mt-2 sm:text-sm sm:leading-relaxed">Pusat kontrol dan pengelolaan seluruh sekolah yang menggunakan Aplikasi Sekolah Digital.</p>
                  </div>
                  <div className="absolute -bottom-12 -right-8 hidden h-56 w-56 rounded-full border-[22px] border-white/10 lg:block" />
                  <div className="absolute right-12 top-7 hidden h-20 w-20 rounded-full bg-cyan-200/15 blur-2xl lg:block" />
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 2xl:grid-cols-4">
                <MetricCard title="Total Sekolah" value="37" change="↗ 12% dari periode lalu" icon="school" tone="blue" />
                <MetricCard title="Total Pengguna" value="562" change="↗ 18% dari periode lalu" icon="users" tone="green" />
                <MetricCard title="Menunggu Persetujuan" value="5" change="Perlu ditinjau" icon="check" tone="purple" />
                <MetricCard title="Sekolah Aktif" value="32" change="↗ 13% dari periode lalu" icon="layers" tone="orange" />
              </section>

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-1 sm:gap-4 2xl:grid-cols-12">
                <Panel className="col-span-2 sm:col-span-1 2xl:col-span-5">
                  <PanelTitle icon="chart" action={<span className="rounded-lg bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">37 Sekolah</span>}>Pertumbuhan Sekolah</PanelTitle>
                  <div className="h-[190px] w-full sm:h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={growthData} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#E8EEF8" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: '#71809A', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#71809A', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E7ECF5', fontSize: 12 }} />
                        <Bar dataKey="schools" name="Sekolah" fill="#1686F2" radius={[5, 5, 0, 0]} barSize={22} />
                        <Line type="monotone" dataKey="target" name="Target" stroke="#873BFF" strokeWidth={3} dot={{ r: 3.5, fill: '#873BFF', strokeWidth: 2, stroke: '#FFFFFF' }} activeDot={{ r: 5 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="col-span-1 2xl:col-span-3">
                  <PanelTitle icon="calendar">Status Langganan</PanelTitle>
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                    <div className="relative h-[112px] w-[112px] shrink-0 sm:h-[178px] sm:w-[178px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={subscriptionData} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="90%" paddingAngle={3} stroke="none">{subscriptionData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip /></PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-extrabold text-[#102B59] sm:text-3xl">37</span><span className="text-[9px] font-semibold text-slate-500 sm:text-[11px]">Sekolah</span></div>
                    </div>
                    <div className="w-full space-y-3">
                      {subscriptionData.map((item) => <div key={item.name} className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-slate-600"><i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />{item.name}</span><b className="text-sm text-[#102B59]">{item.value}</b></div>)}
                    </div>
                  </div>
                </Panel>

                <Panel className="col-span-1 2xl:col-span-4">
                  <PanelTitle icon="history" action={<button onClick={() => selectMenu('Audit Log')} className="text-[11px] font-bold text-blue-600 hover:text-blue-800">Lihat Semua</button>}>Aktivitas Terbaru</PanelTitle>
                  <div className="space-y-2.5 sm:space-y-4">
                    {activities.map((item, index) => <div key={index} className="flex items-start gap-3"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full sm:h-9 sm:w-9 ${item.color}`}><Icon name={item.icon} className="h-4 w-4 sm:h-[17px] sm:w-[17px]" /></span><div className="min-w-0"><p className="text-[10px] font-bold leading-snug text-[#102B59] sm:text-xs">{item.title}</p><p className="mt-1 text-[9px] text-slate-500 sm:text-[10px]">{item.detail}</p></div></div>)}
                  </div>
                </Panel>

                <Panel className="col-span-2 sm:col-span-1 2xl:col-span-5">
                  <PanelTitle icon="map">Distribusi Sekolah per Wilayah</PanelTitle>
                  <div className="relative flex h-[150px] items-center justify-center overflow-hidden rounded-xl bg-white sm:h-[220px]">
                    <div className="relative h-full w-full">
                      <img
                        src={gambarPetaIndonesia}
                        alt="Peta Indonesia untuk distribusi sekolah"
                        className="h-full w-full object-contain"
                      />

                      {schoolLocation && (() => {
                        // Perkiraan proyeksi equirectangular untuk area Indonesia pada ilustrasi.
                        // Posisi memakai koordinat Firestore, bukan titik contoh.
                        const left = ((schoolLocation.longitude - 95) / (141 - 95)) * 100;
                        const top = ((6 - schoolLocation.latitude) / (6 - (-11))) * 100;
                        const withinMap = left >= 0 && left <= 100 && top >= 0 && top <= 100;
                        if (!withinMap) return null;

                        return (
                          <div
                            className="absolute z-10"
                            style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -100%)' }}
                          >
                            <button
                              type="button"
                              onClick={() => setMapInfoOpen((open) => !open)}
                              aria-label={`Lihat lokasi ${schoolLocation.name}`}
                              title={schoolLocation.name}
                              className="relative flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              <span className="h-2 w-2 rounded-full bg-white" />
                              <span className="absolute -bottom-[7px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-emerald-500" />
                            </button>
                          </div>
                        );
                      })()}

                      {mapInfoOpen && schoolLocation && (
                        <div className="absolute left-2 top-2 z-20 max-w-[220px] rounded-xl border border-slate-200 bg-white/95 p-3 text-left shadow-xl backdrop-blur">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-extrabold text-[#102B59]">{schoolLocation.name}</p>
                            <button type="button" onClick={() => setMapInfoOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Tutup detail lokasi">×</button>
                          </div>
                          {schoolLocation.address && <p className="mt-1 text-[10px] leading-relaxed text-slate-600">{schoolLocation.address}</p>}
                          <p className="mt-2 text-[10px] text-slate-500">Koordinat: {schoolLocation.latitude.toFixed(5)}, {schoolLocation.longitude.toFixed(5)}</p>
                          <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">Lokasi tersedia</span>
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-2 right-2 rounded-full border border-white bg-white/90 px-2.5 py-1 text-[9px] font-bold text-blue-700 shadow-sm">
                      {mapLoading ? 'Memuat lokasi…' : schoolLocation ? '1 lokasi sekolah' : 'Lokasi belum tersedia'}
                    </div>
                    {mapError && <div className="absolute inset-x-2 top-2 rounded-lg bg-amber-50/95 px-3 py-2 text-[10px] text-amber-800">{mapError}</div>}
                    {!mapLoading && !mapError && !schoolLocation && (
                      <div className="absolute left-2 top-2 rounded-lg bg-slate-50/95 px-3 py-2 text-[10px] text-slate-600">
                        Koordinat belum diatur pada Pengaturan Sekolah.
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel className="col-span-1 2xl:col-span-3">
                  <PanelTitle icon="chart">Ringkasan Fitur Paling Digunakan</PanelTitle>
                  <div className="space-y-3 pt-1 sm:space-y-4">
                    {featureData.map((item) => <div key={item.name}><div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-700">{item.name}</span><b className="text-[#102B59]">{item.value}%</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 sm:h-2.5"><div className="h-full rounded-full" style={{ width: `${item.value}%`, background: item.color }} /></div></div>)}
                  </div>
                </Panel>

                <Panel className="col-span-1 2xl:col-span-4">
                  <PanelTitle icon="trend">Aksi Cepat</PanelTitle>
                  <div className="space-y-2 sm:space-y-3">
                    <button onClick={() => selectMenu('Manajemen Sekolah')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0879F9] to-[#0757E8] px-2 py-3 text-[11px] font-extrabold text-white sm:gap-3 sm:px-4 sm:py-4 sm:text-sm shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-xl"><Icon name="school" className="h-5 w-5" /><Icon name="plus" className="h-4 w-4" />Tambah Sekolah</button>
                    <button onClick={() => selectMenu('Langganan & Pembayaran')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7139F2] to-[#8C3DEB] px-2 py-3 text-[11px] font-extrabold text-white sm:gap-3 sm:px-4 sm:py-4 sm:text-sm shadow-lg shadow-violet-600/20 transition hover:-translate-y-0.5 hover:shadow-xl"><Icon name="layers" className="h-5 w-5" />Buat Paket Langganan</button>
                  </div>
                </Panel>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[10px] text-slate-400"><span>© 2026 Sekolah Digital · Platform Control</span><span className="flex items-center gap-1.5"><Icon name="shield" className="h-3.5 w-3.5 text-emerald-500" /> Area khusus Platform Owner</span></div>
            </div>
          ) : activeMenu === 'Manajemen Sekolah' ? (
            <div className="mx-auto max-w-[1700px] space-y-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">Platform Control / Data Master</p><h2 className="mt-1 text-2xl font-extrabold text-[#102B59] sm:text-3xl">Manajemen Sekolah</h2><p className="mt-1 text-xs text-slate-500 sm:text-sm">Registri pusat sekolah yang menggunakan Aplikasi Sekolah Digital.</p></div>
                <button onClick={() => openSchoolForm()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0879F9] to-[#0757E8] px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20"><Icon name="plus" className="h-4 w-4"/> Tambah Sekolah</button>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[{label:'Total Sekolah',value:schools.length,icon:'school' as IconName},{label:'Operasional Aktif',value:schools.filter(x=>x.status==='aktif').length,icon:'check' as IconName},{label:'Sedang Trial',value:trialSchoolsCount,icon:'clock' as IconName},{label:'Suspend',value:schools.filter(x=>x.status==='suspend').length,icon:'shield' as IconName}].map((item)=><div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-slate-500 sm:text-xs">{item.label}</span><span className="rounded-xl bg-blue-50 p-2 text-blue-600"><Icon name={item.icon} className="h-4 w-4"/></span></div><p className="mt-2 text-2xl font-extrabold text-[#102B59] sm:text-3xl">{item.value}</p></div>)}
              </div>
              <Panel>
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div><h3 className="text-base font-extrabold text-[#102B59]">Daftar Sekolah</h3><p className="mt-1 text-[11px] text-slate-500">Data dibaca langsung dari koleksi sekolah_platform.</p></div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_170px]">
                    <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)} placeholder="Cari nama, NPSN, wilayah..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"/></div>
                    <select value={schoolStatusFilter} onChange={e=>setSchoolStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-blue-400"><option value="semua">Semua Status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option><option value="suspend">Suspend</option></select>
                  </div>
                </div>
                {schoolsError && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{schoolsError}</div>}
                {schoolsLoading ? <div className="py-12 text-center text-sm text-slate-500">Memuat data sekolah...</div> : filteredSchools.length===0 ? <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="school" className="h-6 w-6"/></div><p className="text-sm font-bold text-slate-700">{schools.length===0?'Belum ada sekolah terdaftar':'Sekolah tidak ditemukan'}</p><p className="mt-1 text-xs text-slate-500">{schools.length===0?'Tambahkan sekolah pertama untuk memulai registri platform.':'Coba ubah kata kunci atau filter status.'}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead><tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400"><th className="px-3 py-3">Sekolah</th><th className="px-3 py-3">NPSN</th><th className="px-3 py-3">Wilayah</th><th className="px-3 py-3">Jenjang</th><th className="px-3 py-3">Operasional</th><th className="px-3 py-3">Trial / Langganan</th><th className="px-3 py-3 text-right">Aksi</th></tr></thead><tbody>{filteredSchools.map(school=><tr key={school.id} className="border-b border-slate-50 hover:bg-blue-50/40"><td className="px-3 py-3"><button onClick={()=>setSelectedSchool(school)} className="text-left font-bold text-[#102B59] hover:text-blue-600">{school.namaSekolah}</button><p className="mt-1 text-[10px] text-slate-400">{school.alamat||'Alamat belum diisi'}</p></td><td className="px-3 py-3 font-mono text-slate-600">{school.npsn}</td><td className="px-3 py-3 text-slate-600">{school.kabupaten}, {school.provinsi}</td><td className="px-3 py-3 text-slate-600">{school.jenjang}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${school.status==='aktif'?'bg-emerald-50 text-emerald-700':school.status==='suspend'?'bg-rose-50 text-rose-700':'bg-slate-100 text-slate-600'}`}>{school.status==='aktif'?'Aktif':school.status==='suspend'?'Suspend':'Nonaktif'}</span></td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getEffectiveSubscriptionStatus(school)==='trial'?'bg-amber-50 text-amber-700':getEffectiveSubscriptionStatus(school)==='aktif_berlangganan'?'bg-emerald-50 text-emerald-700':getEffectiveSubscriptionStatus(school)==='kedaluwarsa'?'bg-rose-50 text-rose-700':'bg-slate-100 text-slate-500'}`}>{getTrialStatusLabel(getEffectiveSubscriptionStatus(school))}</span><p className="mt-1 text-[10px] text-slate-400">{school.tanggalBerakhirTrial ? `Berakhir ${formatTrialDate(school.tanggalBerakhirTrial)}` : 'Tanggal belum diatur'}</p></td><td className="px-3 py-3"><div className="flex justify-end gap-1.5"><button onClick={()=>setSelectedSchool(school)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50">Detail</button><button onClick={()=>openSchoolForm(school)} className="rounded-lg bg-blue-50 px-2.5 py-1.5 font-bold text-blue-700 hover:bg-blue-100">Edit</button><select aria-label={`Ubah status ${school.namaSekolah}`} value={school.status} onChange={e=>updateSchoolStatus(school,e.target.value as SchoolRecord['status'])} className="max-w-[105px] rounded-lg border border-slate-200 px-2 py-1.5 text-[10px]"><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option><option value="suspend">Suspend</option></select></div></td></tr>)}</tbody></table></div>}
                <div className="mt-3 text-[10px] text-slate-400">Menampilkan {filteredSchools.length} dari {schools.length} sekolah.</div>
              </Panel>
              {selectedSchool && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3" onClick={()=>setSelectedSchool(null)}><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Detail Sekolah</p><h3 className="mt-1 text-xl font-extrabold text-[#102B59]">{selectedSchool.namaSekolah}</h3></div><button onClick={()=>setSelectedSchool(null)} className="text-2xl text-slate-400" aria-label="Tutup">×</button></div><div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">{[['NPSN',selectedSchool.npsn],['Jenjang',selectedSchool.jenjang],['Provinsi',selectedSchool.provinsi],['Kabupaten/Kota',selectedSchool.kabupaten],['Alamat',selectedSchool.alamat||'-'],['Email',selectedSchool.email||'-'],['Telepon',selectedSchool.telepon||'-'],['Koordinat',selectedSchool.latitude!==null&&selectedSchool.longitude!==null?`${selectedSchool.latitude}, ${selectedSchool.longitude}`:'Belum diisi'],['Status Operasional',selectedSchool.status==='aktif'?'Aktif':selectedSchool.status==='suspend'?'Suspend':'Nonaktif'],['Status Langganan',getTrialStatusLabel(getEffectiveSubscriptionStatus(selectedSchool))],['Mulai Trial',formatTrialDate(selectedSchool.tanggalMulaiTrial)],['Akhir Trial',formatTrialDate(selectedSchool.tanggalBerakhirTrial)]].map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 break-words font-bold text-slate-700">{value}</p></div>)}</div><div className="mt-4 flex justify-end gap-2"><button onClick={()=>openSchoolForm(selectedSchool)} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">Edit Data</button><button onClick={()=>setSelectedSchool(null)} className="rounded-xl border px-4 py-2 text-xs font-bold text-slate-600">Tutup</button></div></div></div>}
              {schoolModalOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 sm:p-5"><div className="my-auto w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Registri Platform</p><h3 className="text-xl font-extrabold text-[#102B59]">{editingSchoolId?'Edit Sekolah':'Tambah Sekolah'}</h3></div><button onClick={()=>setSchoolModalOpen(false)} className="text-2xl text-slate-400" aria-label="Tutup">×</button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{([{key:'namaSekolah',label:'Nama Sekolah *',placeholder:'Contoh: SD Negeri 1'}, {key:'npsn',label:'NPSN *',placeholder:'8 digit angka'}, {key:'provinsi',label:'Provinsi *',placeholder:'Provinsi'}, {key:'kabupaten',label:'Kabupaten/Kota *',placeholder:'Kabupaten/Kota'}, {key:'alamat',label:'Alamat',placeholder:'Alamat lengkap'}, {key:'email',label:'Email Sekolah',placeholder:'Email'}, {key:'telepon',label:'Nomor Telepon',placeholder:'Nomor telepon'}, {key:'latitude',label:'Latitude',placeholder:'Contoh: -5.1'}, {key:'longitude',label:'Longitude',placeholder:'Contoh: 119.4'}] as const).map(field=><label key={field.key} className="text-[11px] font-bold text-slate-600">{field.label}<input value={schoolForm[field.key]} onChange={e=>setSchoolForm(v=>({...v,[field.key]:e.target.value}))} placeholder={field.placeholder} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"/></label>)}<label className="text-[11px] font-bold text-slate-600">Jenjang<select value={schoolForm.jenjang} onChange={e=>setSchoolForm(v=>({...v,jenjang:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs"><option>SD</option><option>SMP</option><option>SMA</option><option>SMK</option></select></label><label className="text-[11px] font-bold text-slate-600">Status Operasional<select value={schoolForm.status} onChange={e=>setSchoolForm(v=>({...v,status:e.target.value as SchoolRecord['status']}))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs"><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option><option value="suspend">Suspend</option></select></label></div><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4"><div className="flex items-start gap-2"><Icon name="calendar" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/><div><h4 className="text-sm font-extrabold text-amber-900">Pengaturan Masa Trial (Khusus Super Admin)</h4><p className="mt-1 text-[11px] leading-relaxed text-amber-800">Masa trial berlangsung 30 hari. Informasi ini hanya tersedia di Platform Control dan tidak ditampilkan pada dashboard sekolah.</p></div></div><label className="mt-3 block text-[11px] font-bold text-slate-700">Metode mulai trial<select value={trialMode} onChange={e=>setTrialMode(e.target.value as TrialMode)} className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs">{editingSchoolId && <option value="pertahankan">Jangan ubah masa trial saat ini</option>}<option value="otomatis">Otomatis saat data disimpan</option><option value="manual">Tentukan tanggal mulai sendiri</option></select></label>{trialMode==='manual' ? <label className="mt-3 block text-[11px] font-bold text-slate-700">Tanggal mulai trial<input type="date" value={manualTrialStart} onChange={e=>setManualTrialStart(e.target.value)} className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs"/></label> : trialMode==='otomatis' ? <div className="mt-3 rounded-xl bg-white/80 p-3 text-[11px] text-amber-900">Tanggal mulai: saat tombol <b>Simpan Sekolah</b> ditekan. Tanggal berakhir dihitung otomatis 30 hari setelahnya.</div> : <div className="mt-3 rounded-xl bg-white/80 p-3 text-[11px] text-amber-900">Data masa trial yang sudah tersimpan akan dipertahankan. Ubah pilihan jika ingin mengatur ulang masa trial.</div>}{manualTrialStart && trialMode==='manual' && <p className="mt-2 text-[11px] text-amber-800">Perkiraan berakhir: <b>{formatTrialDate(addDaysToDateInput(manualTrialStart,30))}</b></p>}</div>{schoolFormError&&<p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{schoolFormError}</p>}<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={()=>setSchoolModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600">Batal</button><button onClick={saveSchool} disabled={savingSchool} className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60">{savingSchool?'Menyimpan...':'Simpan Sekolah'}</button></div></div></div>}
            </div>
          ) : activeMenu === 'Persetujuan Pendaftaran' ? (
            <div className="mx-auto max-w-[1700px] space-y-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">Platform Control / Verifikasi</p>
                <h2 className="mt-1 text-2xl font-extrabold text-[#102B59] sm:text-3xl">Persetujuan Pendaftaran Sekolah</h2>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">Periksa data sekolah sebelum memberikan keputusan pendaftaran.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                  { label: 'Total Pendaftaran', value: registrations.length },
                  { label: 'Menunggu Verifikasi', value: registrations.filter(x => x.status === 'menunggu_verifikasi').length },
                  { label: 'Perlu Perbaikan', value: registrations.filter(x => x.status === 'perlu_perbaikan').length },
                  { label: 'Disetujui', value: registrations.filter(x => x.status === 'disetujui_menunggu_provisioning' || x.status === 'selesai').length },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                    <p className="text-[10px] font-bold text-slate-500 sm:text-xs">{item.label}</p>
                    <p className="mt-2 text-2xl font-extrabold text-[#102B59] sm:text-3xl">{item.value}</p>
                  </div>
                ))}
              </div>

              <Panel>
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div><h3 className="text-base font-extrabold text-[#102B59]">Daftar Pendaftaran Masuk</h3><p className="mt-1 text-[11px] text-slate-500">Data dipantau langsung dari koleksi pendaftaran_sekolah.</p></div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_220px]">
                    <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={registrationSearch} onChange={e => setRegistrationSearch(e.target.value)} placeholder="Cari sekolah, NPSN, email..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
                    <select value={registrationFilter} onChange={e => setRegistrationFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-blue-400">
                      <option value="semua">Semua Status</option><option value="menunggu_verifikasi">Menunggu Verifikasi</option><option value="perlu_perbaikan">Perlu Perbaikan</option><option value="ditolak">Ditolak</option><option value="disetujui_menunggu_provisioning">Disetujui · Menunggu Aktivasi</option><option value="selesai">Selesai</option>
                    </select>
                  </div>
                </div>
                {registrationsError && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{registrationsError}</div>}
                {registrationsLoading ? <div className="py-12 text-center text-sm text-slate-500">Memuat pendaftaran sekolah...</div> :
                  filteredRegistrations.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="file" className="h-6 w-6" /></div>
                      <p className="text-sm font-bold text-slate-700">{registrations.length === 0 ? 'Belum ada pendaftaran masuk' : 'Pendaftaran tidak ditemukan'}</p>
                      <p className="mt-1 text-xs text-slate-500">{registrations.length === 0 ? 'Pendaftaran dari halaman publik akan muncul di bagian ini.' : 'Ubah kata kunci atau filter status.'}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left text-xs">
                        <thead><tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400"><th className="px-3 py-3">Sekolah</th><th className="px-3 py-3">NPSN</th><th className="px-3 py-3">Kontak Pendaftar</th><th className="px-3 py-3">Tanggal Masuk</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Aksi</th></tr></thead>
                        <tbody>{filteredRegistrations.map(item => (
                          <tr key={item.id} className="border-b border-slate-50 hover:bg-blue-50/40">
                            <td className="px-3 py-3"><p className="font-bold text-[#102B59]">{item.namaSekolah || 'Nama belum diisi'}</p><p className="mt-1 text-[10px] text-slate-400">{item.kabupaten}, {item.provinsi}</p></td>
                            <td className="px-3 py-3 font-mono text-slate-600">{item.npsn || '-'}</td>
                            <td className="px-3 py-3">
                              <p className="font-semibold text-slate-700">{item.namaAdmin || item.namaKepalaSekolah || '-'}</p>
                              <p className="mt-0.5 text-[10px] text-slate-500">{item.email || '-'}</p>
                              {item.namaAdmin && item.namaKepalaSekolah && item.namaAdmin !== item.namaKepalaSekolah && (
                                <p className="text-[10px] text-slate-400">Kepsek: {item.namaKepalaSekolah}</p>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-600">{formatRegistrationDate(item.createdAt)}</td>
                            <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === 'menunggu_verifikasi' ? 'bg-amber-50 text-amber-700' : item.status === 'perlu_perbaikan' ? 'bg-orange-50 text-orange-700' : item.status === 'ditolak' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{registrationStatusLabel(item.status)}</span></td>
                            <td className="px-3 py-3 text-right"><button onClick={() => { setSelectedRegistration(item); setRegistrationNote(item.catatanAdmin || ''); setRegistrationAction(null); }} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-blue-700">Periksa</button></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                <div className="mt-3 text-[10px] text-slate-400">Menampilkan {filteredRegistrations.length} dari {registrations.length} pendaftaran.</div>
              </Panel>

              {selectedRegistration && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5" onClick={() => setSelectedRegistration(null)}>
                  <div className="my-auto w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                      <div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Pemeriksaan Pendaftaran</p><h3 className="mt-1 text-xl font-extrabold text-[#102B59]">{selectedRegistration.namaSekolah}</h3><p className="mt-1 text-xs text-slate-500">Diterima: {formatRegistrationDate(selectedRegistration.createdAt)}</p></div>
                      <button onClick={() => setSelectedRegistration(null)} className="text-2xl text-slate-400" aria-label="Tutup">×</button>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        ['NPSN', selectedRegistration.npsn], ['Jenjang', selectedRegistration.jenjang],
                        ['Provinsi', selectedRegistration.provinsi], ['Kabupaten/Kota', selectedRegistration.kabupaten],
                        ['Alamat Sekolah', selectedRegistration.alamat],
                        ['Calon Administrator', selectedRegistration.namaAdmin || selectedRegistration.namaKepalaSekolah],
                        ['Nama Kepala Sekolah', selectedRegistration.namaKepalaSekolah],
                        ['Email Aktif (Admin)', selectedRegistration.email], ['Nomor WhatsApp', selectedRegistration.telepon],
                      ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 break-words text-xs font-bold text-slate-700">{value || '-'}</p></div>)}
                    </div>
                    {selectedRegistration.catatanPendaftar && <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-700">Catatan dari Pendaftar</p><p className="mt-1 whitespace-pre-wrap text-xs text-blue-900">{selectedRegistration.catatanPendaftar}</p></div>}
                    {selectedRegistration.catatanAdmin && <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-700">Catatan Pemeriksaan Sebelumnya</p><p className="mt-1 whitespace-pre-wrap text-xs text-amber-900">{selectedRegistration.catatanAdmin}</p></div>}
                    {registrationAction && <div className="mt-4 rounded-xl border border-slate-200 p-3"><label className="block text-xs font-bold text-slate-700">{registrationAction === 'tolak' ? 'Alasan penolakan *' : 'Bagian yang perlu diperbaiki *'}<textarea value={registrationNote} onChange={e => setRegistrationNote(e.target.value)} rows={3} placeholder="Tuliskan catatan yang jelas untuk pihak sekolah..." className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-xs font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label></div>}
                    <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
                      <button onClick={() => setSelectedRegistration(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600">Tutup</button>
                      {selectedRegistration.status !== 'ditolak' && selectedRegistration.status !== 'selesai' && selectedRegistration.status !== 'disetujui_menunggu_provisioning' && <>
                        <button disabled={savingRegistration} onClick={() => { setRegistrationAction('perbaikan'); setRegistrationNote(''); }} className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-bold text-orange-700 disabled:opacity-50">Minta Perbaikan</button>
                        <button disabled={savingRegistration} onClick={() => { setRegistrationAction('tolak'); setRegistrationNote(''); }} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50">Tolak</button>
                        <button disabled={savingRegistration} onClick={() => saveRegistrationDecision(selectedRegistration, 'disetujui_menunggu_provisioning')} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{savingRegistration ? 'Menyimpan...' : 'Setujui Pendaftaran'}</button>
                      </>}
                      {registrationAction && <button disabled={savingRegistration || !registrationNote.trim()} onClick={() => saveRegistrationDecision(selectedRegistration, registrationAction === 'tolak' ? 'ditolak' : 'perlu_perbaikan', registrationNote)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{savingRegistration ? 'Menyimpan...' : 'Kirim Keputusan'}</button>}
                    </div>
                    {(selectedRegistration.status === 'disetujui_menunggu_provisioning' || selectedRegistration.status === 'selesai') && (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">Status Aktivasi Sekolah</p>
                            <p className="mt-1 text-sm font-bold text-emerald-950">
                              Kode Sekolah: <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-blue-700">{selectedRegistration.sekolahId || 'Dalam proses'}</span>
                            </p>
                            <p className="mt-1 text-xs text-emerald-800">
                              Email Aktivasi: {selectedRegistration.emailAktivasi?.status === 'terkirim' ? '✓ Berhasil terkirim ke email kontak' : (selectedRegistration.emailAktivasi?.keterangan || 'Tautan aktivasi sudah dibuat')}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={savingRegistration}
                            onClick={() => handleKirimUlangAktivasi(selectedRegistration)}
                            className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                          >
                            {savingRegistration ? 'Memproses...' : 'Kirim Ulang Undangan Aktivasi'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex min-h-[65vh] max-w-4xl items-center justify-center">
              <div className="w-full rounded-[28px] border border-slate-100 bg-white p-8 text-center shadow-[0_12px_40px_rgba(20,55,110,0.07)] sm:p-12">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Icon name={menuItems.find((item) => item.label === activeMenu)?.icon || 'dashboard'} className="h-8 w-8" /></div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-600">Platform Control</p>
                <h2 className="text-2xl font-extrabold text-[#102B59]">{activeMenu}</h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-500">{activeDescription}</p>
                <div className="mx-auto mt-6 max-w-md rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">Tampilan menu ini sudah disiapkan. Tahap berikutnya adalah menghubungkan menu dengan koleksi Firestore dan alur kerja sebenarnya.</div>
                <button onClick={() => selectMenu('Dashboard')} className="mt-7 rounded-xl bg-[#1268E8] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">Kembali ke Dashboard</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
