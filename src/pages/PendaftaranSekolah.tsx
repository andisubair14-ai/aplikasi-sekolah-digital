import { useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ilustrasiSekolah from '../assets/ilustrasi-hero-sekolah.png';
import ilustrasiTim from '../assets/ilustrasi-tim-sekolah.png';

type IconName = 'user' | 'file' | 'shield' | 'mail' | 'school' | 'pin' | 'map' | 'check' | 'send' | 'arrow' | 'whatsapp' | 'info' | 'book';

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  const paths: Record<IconName, ReactNode> = {
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/></>,
    school: <><path d="m3 10 9-6 9 6"/><path d="M5 10v10h14V10M3 20h18M9 20v-6h6v6"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    whatsapp: <><path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.6A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M8.5 8.5c.5 2.5 2.5 4.5 5 5l1.2-1.2 2 1c-.2 1.3-1.2 2-2.5 2-3.5-.5-6.5-3.5-7-7 0-1.3.7-2.3 2-2.5l1 2Z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 5.5v16.5M8 7h8M8 11h8"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const provinces = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Bangka Belitung','Bengkulu','Lampung','DKI Jakarta','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Banten','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Sulawesi Tengah','Sulawesi Selatan','Sulawesi Tenggara','Gorontalo','Sulawesi Barat','Maluku','Maluku Utara','Papua','Papua Barat','Papua Selatan','Papua Tengah','Papua Pegunungan','Papua Barat Daya'];

function Field({ label, required = true, children, className = '' }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return <label className={`block min-w-0 ${className}`}><span className="mb-2 block text-[13px] font-bold text-slate-800">{label}{required && <span className="ml-1 text-red-500">*</span>}</span>{children}</label>;
}

const inputClass = 'h-[43px] w-full rounded-[9px] border border-slate-300 bg-white px-3.5 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const selectClass = `${inputClass} cursor-pointer`;

export default function PendaftaranSekolah() {
  const navigate = useNavigate();
  const [provinsi, setProvinsi] = useState('');
  const [jenjang, setJenjang] = useState('');
  const [setuju, setSetuju] = useState(false);
  const [pesan, setPesan] = useState('');
  const [tipePesan, setTipePesan] = useState<'sukses' | 'error' | 'info'>('info');
  const [form, setForm] = useState({ namaSekolah: '', npsn: '', kabupaten: '', alamat: '', namaKepalaSekolah: '', whatsapp: '', email: '' });
  const [sedangMengirim, setSedangMengirim] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const npsnValid = useMemo(() => /^\d{8}$/.test(form.npsn), [form.npsn]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sedangMengirim) return;

    if (!npsnValid) {
      setTipePesan('error');
      setPesan('NPSN harus terdiri dari 8 digit angka.');
      return;
    }

    if (!provinsi || !jenjang || !setuju) {
      setTipePesan('error');
      setPesan('Lengkapi seluruh data wajib dan centang pernyataan sebelum mengirim.');
      return;
    }

    setSedangMengirim(true);
    setPesan('');

    try {
      await addDoc(collection(db, 'pendaftaran_sekolah'), {
        namaSekolah: form.namaSekolah.trim(),
        npsn: form.npsn.trim(),
        jenjang,
        provinsi,
        kabupaten: form.kabupaten.trim(),
        alamat: form.alamat.trim(),
        namaKepalaSekolah: form.namaKepalaSekolah.trim(),
        telepon: form.whatsapp.trim(),
        email: form.email.trim().toLowerCase(),
        catatanPendaftar: '',
        catatanAdmin: '',
        status: 'menunggu_verifikasi',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTipePesan('sukses');
      setPesan('Pendaftaran sekolah berhasil dikirim. Data Anda telah kami terima dan sedang menunggu verifikasi oleh Super Admin. Informasi selanjutnya akan disampaikan melalui email aktif yang Anda cantumkan.');
      setForm({ namaSekolah: '', npsn: '', kabupaten: '', alamat: '', namaKepalaSekolah: '', whatsapp: '', email: '' });
      setProvinsi('');
      setJenjang('');
      setSetuju(false);
    } catch (error: unknown) {
      console.error('Gagal mengirim pendaftaran sekolah:', error);
      const firebaseCode = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';

      let pesanError = 'Pendaftaran belum berhasil dikirim. Periksa koneksi internet lalu coba kembali.';
      if (firebaseCode === 'permission-denied') {
        pesanError = 'Pengiriman ditolak oleh Firestore Rules. Pastikan aturan pendaftaran_sekolah sudah dipublikasikan dan data formulir sesuai ketentuan.';
      } else if (firebaseCode === 'unavailable' || firebaseCode === 'network-request-failed') {
        pesanError = 'Koneksi ke server sedang bermasalah. Periksa internet lalu coba kembali.';
      }

      setTipePesan('error');
      setPesan(pesanError);
    } finally {
      setSedangMengirim(false);
    }
  }

  return <div className="min-h-screen bg-[#eef5ff] font-sans text-[#101d49]">
    <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/95 shadow-[0_2px_12px_rgba(18,55,105,.06)] backdrop-blur">
      <div className="mx-auto flex h-[70px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-14">
        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2.5 text-left">
          <span className="relative flex h-11 w-12 items-end justify-center text-blue-600"><svg viewBox="0 0 52 46" className="h-11 w-12" fill="none"><path d="M4 15 26 25 48 15v23L26 29 4 38V15Z" fill="#1684ed"/><path d="M9 17 26 25 43 17v16L26 26 9 33V17Z" fill="white"/><path d="M16 8 26 2l10 6v7H16V8Z" fill="#10214d"/><path d="M20 14v5l6 4 6-4v-5" stroke="#1684ed" strokeWidth="2"/></svg></span>
          <span className="text-[17px] font-extrabold leading-[1.05] tracking-tight text-slate-900">Aplikasi<br/>Sekolah Digital</span>
        </button>
        <nav className="hidden items-center gap-9 text-[13px] font-semibold text-slate-800 md:flex">
          <a href="#beranda" className="transition hover:text-blue-600">Beranda</a><a href="#fitur" className="transition hover:text-blue-600">Fitur</a><a href="#alur" className="transition hover:text-blue-600">Alur Pendaftaran</a><a href="#bantuan" className="transition hover:text-blue-600">Bantuan</a>
        </nav>
        <button type="button" onClick={() => navigate('/')} className="flex h-10 items-center gap-2 rounded-xl bg-[#0758cb] px-5 text-[13px] font-bold text-white shadow-[0_5px_12px_rgba(0,86,205,.2)] transition hover:bg-blue-700"><Icon name="user" className="h-4 w-4"/>Masuk</button>
      </div>
    </header>

    <main>
      <section id="beranda" className="relative overflow-hidden bg-gradient-to-r from-[#d7efff] via-[#eaf7ff] to-[#d7edff]">
        <div className="mx-auto grid min-h-[250px] max-w-[1440px] items-center gap-3 px-4 sm:px-8 lg:grid-cols-[34%_1fr] lg:px-0">
          <div className="order-2 flex h-[190px] items-end justify-center overflow-hidden lg:order-1 lg:h-[250px]"><img src={ilustrasiSekolah} alt="Ilustrasi gedung sekolah" className="h-full w-full object-contain object-bottom"/></div>
          <div className="order-1 z-10 py-7 text-center lg:order-2 lg:py-0 lg:pl-3 lg:text-left">
            <span className="inline-flex rounded-xl bg-white/90 px-4 py-1.5 text-[13px] font-bold text-blue-700 shadow-sm">Pendaftaran Sekolah Online</span>
            <h1 className="mt-3 text-[30px] font-black leading-[1.13] tracking-tight text-[#101d49] sm:text-[36px]">Bergabung dengan<br className="hidden sm:block"/> Aplikasi Sekolah Digital</h1>
            <p className="mx-auto mt-3 max-w-[650px] text-[14px] leading-relaxed text-slate-800 lg:mx-0">Solusi pengelolaan sekolah yang lebih mudah, terintegrasi,<br className="hidden lg:block"/> dan mendukung transformasi digital pendidikan.</p>
          </div>
        </div>
      </section>

      <section id="alur" className="mx-auto max-w-[1320px] px-4 pt-5 sm:px-7 lg:px-10">
        <div className="grid items-center gap-4 rounded-2xl border border-blue-100 bg-white px-5 py-5 shadow-[0_5px_16px_rgba(32,77,130,.12)] md:grid-cols-[1.05fr_1fr_1.15fr_1.15fr] md:gap-3 md:px-8">
          <h2 className="text-[16px] font-extrabold leading-snug text-slate-900">Alur Pendaftaran<br/>Sekolah</h2>
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[16px] font-extrabold text-white">1</span><Icon name="file" className="h-8 w-8 shrink-0 text-slate-700"/><span className="text-[13px] font-bold leading-snug text-slate-800">Isi Formulir<br/>Pendaftaran</span><Icon name="arrow" className="ml-auto hidden h-6 w-6 text-slate-500 lg:block"/></div>
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[16px] font-extrabold text-white">2</span><Icon name="shield" className="h-8 w-8 shrink-0 text-green-600"/><span className="text-[13px] font-bold leading-snug text-slate-800">Verifikasi Data<br/>Secara Manual</span><Icon name="arrow" className="ml-auto hidden h-6 w-6 text-slate-500 lg:block"/></div>
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[16px] font-extrabold text-white">3</span><Icon name="mail" className="h-8 w-8 shrink-0 text-[#174b8e]"/><span className="text-[13px] font-bold leading-snug text-slate-800">Terima Email<br/>Persetujuan & Aktivasi Akun</span></div>
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-[1320px] px-4 pb-8 pt-6 sm:px-7 lg:px-10">
        <div className="grid gap-5 rounded-[22px] border border-blue-100 bg-white p-4 shadow-[0_7px_22px_rgba(32,77,130,.13)] lg:grid-cols-[32%_1fr] lg:gap-7 lg:p-5">
          <aside className="relative overflow-hidden rounded-xl bg-gradient-to-b from-[#eaf5ff] via-[#f2f8ff] to-[#e4f2ff] px-6 pb-9 pt-7 lg:min-h-[755px]">
            <div className="pointer-events-none absolute -bottom-8 -left-5 h-24 w-[115%] rounded-[50%] bg-[#c5e5ff]"/><div className="pointer-events-none absolute -bottom-12 left-20 h-24 w-[90%] rounded-[50%] bg-[#a9d8ff]"/>
            <div className="relative mx-auto flex h-[250px] max-w-[330px] items-center justify-center"><img src={ilustrasiTim} alt="Ilustrasi tim pendidik menggunakan teknologi" className="max-h-full w-full object-contain"/></div>
            <h2 className="relative mt-3 text-[23px] font-black leading-tight tracking-tight text-[#102052]">Daftarkan Sekolah Anda<br/>Sekarang</h2>
            <ul className="relative mt-5 space-y-4 text-[14px] font-medium leading-snug text-slate-900">
              {['Pendaftaran gratis','Proses persetujuan manual','Dapatkan 3 akun awal (Admin, Guru, dan Kepala Sekolah)','Nikmati layanan pengelolaan sekolah secara lengkap'].map(item => <li key={item} className="flex items-start gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#20b56b] text-white shadow-sm"><Icon name="check" className="h-4 w-4"/></span><span>{item}</span></li>)}
            </ul>
          </aside>

          <div className="min-w-0 px-1 py-2 sm:px-3 lg:px-1 lg:py-2">
            <div className="mb-5 flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e2f1ff] text-blue-600"><Icon name="file" className="h-7 w-7"/></span><div><h2 className="text-[23px] font-black leading-tight tracking-tight text-[#101d49]">Formulir Pendaftaran Sekolah</h2><p className="mt-1 text-[13px] leading-relaxed text-slate-600">Isi data sekolah dengan lengkap dan sesuai. Pastikan email dan nomor WhatsApp aktif untuk menerima informasi persetujuan.</p></div></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <div className="mb-3 flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#dcedff] to-[#e8f4ff] px-3 py-2 text-[16px] font-extrabold text-[#10275f]"><Icon name="school" className="h-5 w-5 text-blue-600"/>Data Sekolah</div>
                <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-[1.25fr_0.95fr_0.95fr]">
                  <Field label="Nama Sekolah"><input className={inputClass} required value={form.namaSekolah} onChange={e => update('namaSekolah', e.target.value)} placeholder="Contoh: SD Negeri 1 Harapan"/></Field>
                  <Field label="NPSN"><input className={inputClass} required inputMode="numeric" maxLength={8} value={form.npsn} onChange={e => update('npsn', e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Contoh: 12345678"/><span className="mt-1 block text-[11px] text-slate-500">8 digit angka</span></Field>
                  <Field label="Jenjang"><select className={selectClass} required value={jenjang} onChange={e => setJenjang(e.target.value)}><option value="">Pilih jenjang</option>{['PAUD','TK','SD','SMP','SMA','SMK','SLB','Lainnya'].map(x => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Provinsi"><select className={selectClass} required value={provinsi} onChange={e => {setProvinsi(e.target.value); update('kabupaten','')}}><option value="">Pilih provinsi</option>{provinces.map(x => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Kabupaten/Kota" className="sm:col-span-1"><input className={inputClass} required value={form.kabupaten} onChange={e => update('kabupaten', e.target.value)} placeholder="Masukkan kabupaten/kota"/></Field>
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#dcedff] to-[#e8f4ff] px-3 py-2 text-[16px] font-extrabold text-[#10275f]"><Icon name="pin" className="h-5 w-5 text-blue-600"/>Alamat Sekolah</div>
                <Field label="Alamat Lengkap"><textarea required rows={2} value={form.alamat} onChange={e => update('alamat', e.target.value)} placeholder="Jl. Pendidikan No. 10, Desa ..., Kecamatan ..." className="min-h-[70px] w-full resize-y rounded-[9px] border border-slate-300 bg-white px-3.5 py-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></Field>
              </div>
              <div>
                <div className="mb-3 flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#dcedff] to-[#e8f4ff] px-3 py-2 text-[16px] font-extrabold text-[#10275f]"><Icon name="user" className="h-5 w-5 text-blue-600"/>Data Kontak & Penanggung Jawab</div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Nama Kepala Sekolah" className="sm:col-span-2"><input className={inputClass} required value={form.namaKepalaSekolah} onChange={e => update('namaKepalaSekolah', e.target.value)} placeholder="Contoh: Drs. Budi Santoso"/></Field>
                  <Field label="Nomor WhatsApp"><div className="relative"><span className="absolute inset-y-0 left-0 flex w-11 items-center justify-center border-r border-slate-200 text-slate-700"><Icon name="whatsapp" className="h-5 w-5"/></span><input className={`${inputClass} pl-[55px]`} required type="tel" inputMode="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="Contoh: 081234567890"/></div></Field>
                  <Field label="Email Aktif"><div className="relative"><span className="absolute inset-y-0 left-0 flex w-11 items-center justify-center border-r border-slate-200 text-slate-700"><Icon name="mail" className="h-5 w-5"/></span><input className={`${inputClass} pl-[55px]`} required type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="Contoh: sekolah@domain.com"/></div></Field>
                </div>
              </div>
              <div className="rounded-xl border border-green-100 bg-gradient-to-r from-[#edf9ee] to-[#f1fbf0] p-4 text-[12px] leading-relaxed text-slate-800">
                <div className="flex items-start gap-3"><Icon name="info" className="mt-0.5 h-6 w-6 shrink-0 text-green-600"/><div><h3 className="mb-1 text-[14px] font-extrabold text-slate-900">Penting untuk Diketahui:</h3><ul className="list-disc space-y-0.5 pl-4"><li>Persetujuan pendaftaran dilakukan secara manual.</li><li>Jika disetujui, Anda akan menerima email berisi 3 akun awal (Admin, Guru, dan Kepala Sekolah) serta panduan aktivasi.</li><li>Informasi penggunaan layanan akan disampaikan setelah akun diaktifkan.</li></ul></div></div>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-slate-800"><input type="checkbox" required checked={setuju} onChange={e => setSetuju(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 accent-blue-600"/><span>Saya menyatakan bahwa data yang diisi adalah benar dan dapat dipertanggungjawabkan.<span className="ml-1 text-red-500">*</span></span></label>
              {pesan && (
                <div
                  role={tipePesan === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${
                    tipePesan === 'sukses'
                      ? 'border-green-200 bg-green-50 text-green-900'
                      : tipePesan === 'error'
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : 'border-blue-200 bg-blue-50 text-blue-900'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    <Icon name={tipePesan === 'sukses' ? 'check' : 'info'} className="h-5 w-5" />
                  </span>
                  <div>
                    {tipePesan === 'sukses' && <p className="mb-1 font-extrabold">Pendaftaran Berhasil Dikirim!</p>}
                    {tipePesan === 'error' && <p className="mb-1 font-extrabold">Pendaftaran Belum Berhasil</p>}
                    <p>{pesan}</p>
                    {tipePesan === 'sukses' && <p className="mt-2 font-bold">Status: Menunggu Verifikasi</p>}
                  </div>
                </div>
              )}
              <div className="flex flex-col-reverse justify-center gap-3 pb-1 sm:flex-row sm:pt-1">
                <button type="button" onClick={() => {setForm({namaSekolah:'',npsn:'',kabupaten:'',alamat:'',namaKepalaSekolah:'',whatsapp:'',email:''});setProvinsi('');setJenjang('');setSetuju(false);setPesan('');setTipePesan('info')}} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 text-[14px] font-bold text-slate-800 shadow-sm transition hover:bg-slate-50">← Batal</button>
                <button type="submit" disabled={!setuju || sedangMengirim} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0758cb] px-8 text-[14px] font-bold text-white shadow-[0_5px_12px_rgba(0,86,205,.2)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Icon name="send" className="h-4 w-4"/>{sedangMengirim ? 'Mengirim Pendaftaran...' : 'Kirim Pendaftaran'}</button>
              </div>
              {!npsnValid && form.npsn.length > 0 && <p className="text-center text-[11px] text-amber-700">NPSN harus terdiri dari 8 digit angka.</p>}
            </form>
          </div>
        </div>
      </section>
    </main>
    <footer id="bantuan" className="border-t border-blue-100 bg-white px-5 py-5 text-center text-[12px] text-slate-500">© {new Date().getFullYear()} Aplikasi Sekolah Digital. Mendukung transformasi digital pendidikan Indonesia.</footer>
  </div>;
}
