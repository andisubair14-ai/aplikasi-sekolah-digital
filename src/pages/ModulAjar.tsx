import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query,
  serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { buatModulDenganAI } from '../utils/geminiModulAjar';
import { useAuth } from '../contexts/AuthContext';
import { adaptModulAjarToV2, buatModulAjarKosongV2 } from '../utils/modulAjarAdapter';
import type { ModulAjarV2 } from '../types/modulAjar';

type R = Record<string, any>;
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';
const label = 'mb-1.5 block text-sm font-semibold text-slate-700';
const uid = () => `item-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

type TextFieldProps = {
  title: string;
  value: string | number | null | undefined;
  change: (value: string) => void;
  area?: boolean;
  wide?: boolean;
};

function TextField({ title, value, change, area = false, wide = false }: TextFieldProps) {
  return <div className={wide ? 'md:col-span-2' : ''}>
    <label className={label}>{title}</label>
    {area
      ? <textarea rows={3} className={input} value={value ?? ''} onChange={e => change(e.target.value)} placeholder={`Tuliskan ${title.toLowerCase()}...`} />
      : <input className={input} value={value ?? ''} onChange={e => change(e.target.value)} placeholder={`Masukkan ${title.toLowerCase()}...`} />}
  </div>;
}

type SelectFieldProps = {
  title: string;
  value: string | null | undefined;
  options: string[];
  change: (value: string) => void;
};

function SelectField({ title, value, options, change }: SelectFieldProps) {
  return <div><label className={label}>{title}</label><select className={input} value={value ?? ''} onChange={e => change(e.target.value)}>
    <option value="">Pilih {title.toLowerCase()}</option>{options.map(x => <option key={x}>{x}</option>)}
  </select></div>;
}

type SectionProps = {
  n: string;
  title: string;
  desc: string;
  children: ReactNode;
};

function Section({ n, title, desc, children }: SectionProps) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex gap-3 border-b border-blue-100 bg-blue-50 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-800 font-bold text-white">{n}</div>
      <div><h2 className="font-bold text-slate-800">{title}</h2><p className="mt-1 text-xs text-slate-500">{desc}</p></div>
    </div>
    <div className="grid gap-4 p-5 md:grid-cols-2">{children}</div>
  </section>;
}

export default function ModulAjar() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const userId = userData?.uid || '';
  const guruId = userData?.guruId || '';
  const namaGuru = userData?.nama || 'Guru';
  const [data, setData] = useState<ModulAjarV2>(() => buatModulAjarKosongV2(userId, guruId, namaGuru));
  const [records, setRecords] = useState<R[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [legacyMode, setLegacyMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [, setMessage] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Identitas resmi sekolah dibaca langsung dari Pengaturan Firestore.
  const [schoolSettings, setSchoolSettings] = useState<R>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'pengaturan', 'sekolah'),
      snap => setSchoolSettings(snap.exists() ? snap.data() as R : {}),
      err => {
        console.error('Gagal memuat identitas sekolah dari Pengaturan:', err);
        setSchoolSettings({});
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const q = query(collection(db, 'modul_ajar'), where('userId', '==', userId));
    return onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })) as R[];
      rows.sort((a,b) => (b.updatedAt?.toDate?.()?.getTime?.() || 0) - (a.updatedAt?.toDate?.()?.getTime?.() || 0));
      setRecords(rows); setLoading(false); setError('');
    }, e => { console.error(e); setError('Daftar modul gagal dimuat. Periksa koneksi dan akses Firestore.'); setLoading(false); });
  }, [userId]);

  const nested = (section: string, key: string, value: any) => {
    setData(old => ({ ...old, [section]: { ...(old as any)[section], [key]: value } }));
    setMessage(''); setError('');
  };
  const top = (key: string, value: any) => setData(old => ({ ...old, [key]: value }));
  const add = (key: string, item: R) => top(key, [...((data as any)[key] || []), { id: uid(), ...item }]);
  const remove = (key: string, i: number) => top(key, ((data as any)[key] || []).filter((_: any, n: number) => n !== i));
  const updateItem = (key: string, i: number, field: string, value: any) => {
    const list = [...((data as any)[key] || [])]; list[i] = { ...list[i], [field]: value }; top(key, list);
  };
  const fresh = () => {
    setData(buatModulAjarKosongV2(userId, guruId, namaGuru));
    setEditId(null); setLegacyMode(false); setMessage('Formulir modul baru siap diisi.'); setError('');
  };
  const open = (row: R) => {
    const v = adaptModulAjarToV2(row as any);
    setData({ ...v, userId, guruId, namaGuru });
    setEditId(row.id); setLegacyMode(row.versiStruktur !== 2);
    setOpeningId(row.id);
    setError(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const generateWithAI = async () => {
  if (
    !data.identitas.jenjang ||
    !data.identitas.kelas ||
    !data.identitas.mataPelajaran ||
    !data.identitas.topik
  ) {
    setError(
      'Lengkapi Jenjang, Kelas, Mata Pelajaran, dan Topik terlebih dahulu.'
    );
    return;
  }

  if (
    !window.confirm(
      'AI akan menyusun isi pembelajaran. Isi bagian pembelajaran yang sudah ada akan diganti. Lanjutkan?'
    )
  ) return;

  setGeneratingAI(true);
  setError('');
  setMessage('');

  try {
    const hasil = await buatModulDenganAI(data.identitas);

    setData(old => ({
      ...old,
      ...hasil,
      userId,
      guruId,
      namaGuru,
      identitas: old.identitas,
      lampiranList: old.lampiranList,
      refleksi: old.refleksi,
      pengesahan: old.pengesahan,
      legacyData: old.legacyData,
    }));

    setMessage(
      'Modul Ajar berhasil disusun oleh AI. Silakan periksa dan edit setiap bagian.'
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    console.error('Gagal membuat Modul Ajar dengan AI:', e);
    setError(
      e instanceof Error
        ? e.message
        : 'AI gagal menyusun Modul Ajar. Silakan coba kembali.'
    );
  } finally {
    setGeneratingAI(false);
  }
};
  const save = async () => {
    if (!userId || !guruId) { setError('Identitas akun Guru belum lengkap. Silakan masuk kembali.'); return; }
    if (!data.identitas.judulModul.trim()) { setError('Judul Modul Ajar wajib diisi.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const payload: R = {
        versiStruktur: 2, userId, guruId, namaGuru,
        identitas: data.identitas,
        identifikasiPesertaDidik: data.identifikasiPesertaDidik,
        desainPembelajaran: data.desainPembelajaran,
        kerangkaPembelajaranMendalam: data.kerangkaPembelajaranMendalam,
        langkahPembelajaran: data.langkahPembelajaran,
        pertemuanList: data.pertemuanList, asesmenList: data.asesmenList,
        instrumenPenilaian: (data as any).instrumenPenilaian || {},
        rubrikList: data.rubrikList, pengayaanRemedial: data.pengayaanRemedial,
        mediaList: data.mediaList, sumberBelajarList: data.sumberBelajarList,
        lkpdList: data.lkpdList, lampiranList: data.lampiranList,
        refleksi: data.refleksi, pengesahan: data.pengesahan,
        updatedAt: serverTimestamp(),
      };
      if (editId && !legacyMode) {
        await updateDoc(doc(db, 'modul_ajar', editId), payload);
        setMessage('Modul Ajar V2 berhasil diperbarui.');
      } else {
        if (legacyMode && data.legacyData) payload.legacyData = data.legacyData;
        await addDoc(collection(db, 'modul_ajar'), { ...payload, createdAt: serverTimestamp() });
        setMessage(legacyMode
          ? 'Salinan Modul Ajar V2 berhasil dibuat. Dokumen lama tetap utuh.'
          : 'Modul Ajar V2 berhasil disimpan.');
      }
      setData(buatModulAjarKosongV2(userId, guruId, namaGuru)); setEditId(null); setLegacyMode(false);
    } catch (e) { console.error('Gagal menyimpan Modul Ajar:', e); setError('Gagal menyimpan. Periksa Rules Firestore, koneksi, dan pesan error pada Console.'); }
    finally { setSaving(false); }
  };
  const removeRecord = async (row: R) => {
    const title = row.identitas?.judulModul || row.judulModul || 'Modul tanpa judul';
    if (!window.confirm(`Hapus "${title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try { await deleteDoc(doc(db, 'modul_ajar', row.id)); if (editId === row.id) fresh(); setMessage('Modul berhasil dihapus.'); }
    catch (e) { console.error(e); setError('Gagal menghapus modul. Pastikan Anda pemilik dokumen.'); }
  };
  const print = () => {
    if (!data.identitas.judulModul.trim()) { setError('Isi judul modul sebelum mencetak.'); return; }
    window.print();
  };
  const fase = data.identitas.jenjang === 'SD'
    ? ['A (Kelas 1–2)', 'B (Kelas 3–4)', 'C (Kelas 5–6)'] : ['D (Kelas 7–9)'];

  const scalarSections: [string, string, string, string, string][] = [
    ['identifikasiPesertaDidik','kesiapanMurid','Kesiapan Murid','02','textarea'],
    ['identifikasiPesertaDidik','pengetahuanAwal','Pengetahuan Awal','02','textarea'],
    ['identifikasiPesertaDidik','kebutuhanBelajar','Kebutuhan Belajar','02','textarea'],
    ['identifikasiPesertaDidik','kondisiKelas','Kondisi Kelas','02','textarea'],
    ['identifikasiPesertaDidik','karakteristikMateri','Karakteristik Materi','02','textarea'],
  ];
  

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <style>{`
      @page { size: A4 portrait; margin: 5mm 12mm 17mm;
        @bottom-center { content: "RPM - Modul Ajar | Halaman " counter(page) " dari " counter(pages); font: 8pt Arial; color: #334155; border-top: 1px solid #1e3a8a; padding-top: 3mm; }
      }
      @keyframes modul-open-feedback { 0%{transform:scale(1)} 35%{transform:scale(1.07);box-shadow:0 0 0 5px rgba(37,99,235,.2)} 70%{transform:scale(.97)} 100%{transform:scale(1)} }
      .modul-open-feedback { animation: modul-open-feedback .65s ease-out 1; }
      @media print {
        html,body,#root{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;background:#fff!important}
        /* Lepaskan pembungkus dashboard/sidebar yang biasanya memakai h-screen dan overflow-y-auto/hidden. */
        body *{max-height:none!important;overflow:visible!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
        #root,#root>div,#root>div>div,main,main>div{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
        body *{visibility:hidden!important}.print-doc,.print-doc *{visibility:visible!important}
        .print-doc{display:block!important;position:static!important;width:100%!important;height:auto!important;max-height:none!important;overflow:visible!important;color:#17212b!important;font:9pt/1.35 Arial,Helvetica,sans-serif!important;break-inside:auto!important;page-break-inside:auto!important}
        .no-print{display:none!important}
        .rpm-title{color:#10245f!important;font-size:11pt!important;font-weight:800!important;margin:13px 0 6px!important;break-after:avoid!important;page-break-after:avoid!important}
        .rpm-subtitle{color:#10245f!important;font-size:9.5pt!important;font-weight:800!important;margin:9px 0 5px!important;break-after:avoid!important;page-break-after:avoid!important}
        .rpm-table{width:100%!important;border-collapse:collapse!important;margin:5px 0 10px!important;font-size:8.4pt!important}
        .rpm-table thead{display:table-header-group!important}.rpm-table tfoot{display:table-footer-group!important}
        .rpm-table th,.rpm-table td{border:1px solid #64748b!important;padding:4px 5px!important;vertical-align:top!important;overflow-wrap:anywhere!important}
        .rpm-table tr{break-inside:avoid!important;page-break-inside:avoid!important}
        .rpm-table th{background:#1f4e79!important;color:#fff!important;text-align:center!important;font-weight:700!important}
        .rpm-label{background:#d9e1f2!important;font-weight:700!important}
        .rpm-green th{background:#548235!important;color:#fff!important}
        .rpm-highlight{border:1px solid #bf8f00!important;background:#fff2cc!important;padding:8px!important;margin:8px 0!important;break-inside:avoid!important}
        .rpm-kop{display:grid!important;grid-template-columns:76px minmax(0,1fr) 76px!important;align-items:center!important;column-gap:12px!important;border-bottom:3px double #111!important;padding-bottom:6px!important;margin-bottom:8px!important;break-inside:avoid!important}
        .rpm-logo,.rpm-logo-right{width:76px!important;height:76px!important;border:0!important;border-radius:0!important;background:transparent!important;display:flex!important;align-items:center!important;justify-content:center!important;font-weight:700!important;overflow:visible!important}
        .rpm-logo img,.rpm-logo-right img{display:block!important;width:100%!important;height:100%!important;max-width:76px!important;max-height:76px!important;object-fit:contain!important;padding:0!important;border:0!important;border-radius:0!important}
        .rpm-kop-text{min-width:0!important;text-align:center!important;line-height:1.2!important}
        .rpm-sign{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12mm!important;margin-top:22px!important;text-align:center!important;break-inside:avoid!important;page-break-inside:avoid!important}
        .rpm-sign-space{height:58px!important}.rpm-body{white-space:pre-wrap!important;overflow-wrap:anywhere!important}
        .rpm-activity-list{display:block!important;width:100%!important;margin:7px 0 12px!important}
        .rpm-activity{display:block!important;width:100%!important;margin:0 0 9px!important;border:1px solid #94a3b8!important;break-inside:auto!important;page-break-inside:auto!important}
        .rpm-activity-heading{display:block!important;margin:0!important;padding:6px 8px!important;background:#d9e1f2!important;color:#10245f!important;font-size:9pt!important;font-weight:800!important;border-bottom:1px solid #94a3b8!important;break-after:avoid!important;page-break-after:avoid!important}
        .rpm-activity-content{display:block!important;padding:7px 9px!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;line-height:1.45!important}
        .rpm-activity-content p{margin:0 0 4px!important}
        p{orphans:3!important;widows:3!important}
      }
    `}</style>

    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <button onClick={() => navigate('/guru/ruang-kerja-guru')} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">← Kembali ke Ruang Kerja Guru</button>
      <div className="flex gap-2">
        <button onClick={fresh} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800">+ Modul Baru</button>
        <button onClick={print} className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white">Cetak / PDF</button>
      </div>
    </div>

    <header className="no-print rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 p-6 text-white shadow-lg md:p-8">
      <p className="text-xs font-bold tracking-widest text-blue-200">RUANG KERJA GURU</p>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">Penyusunan Modul Ajar</h1>
      <p className="mt-2 max-w-2xl text-sm text-blue-100">Editor Modul Ajar universal untuk SD dan SMP. Tambahkan pertemuan, asesmen, soal, LKPD, dan lampiran sesuai kebutuhan.</p>
    </header>
    <div className="no-print rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">
      <b>Petunjuk:</b> Isi bagian yang diperlukan. Data lama tetap dipertahankan. Jika modul lama dibuka lalu disimpan, sistem membuat dokumen V2 baru dan tidak menimpa dokumen lama.
    </div>
    {error && <div className="no-print rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="no-print space-y-5">
      <Section n="01" title="Identitas Modul" desc="Informasi sekolah, penyusun, jenjang, kelas, dan mata pelajaran.">
        <div className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-4">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="font-bold text-blue-900">
        Asisten AI Penyusun Modul Ajar
      </p>
      <p className="mt-1 text-xs text-blue-700">
        Isi identitas modul terlebih dahulu, kemudian gunakan fitur AI
        membantu menyusun seluruh bagian pembelajaran.
      </p>
    </div>

    <button
      type="button"
      onClick={generateWithAI}
      disabled={generatingAI}
      className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {generatingAI ? 'Sedang Menyusun...' : '✨ Buat Modul dengan AI'}
    </button>
  </div>
</div>
        <TextField title="Judul Modul Ajar" value={data.identitas.judulModul} change={v=>nested('identitas','judulModul',v)} wide />
        <TextField title="Nama Sekolah" value={data.identitas.namaSekolah} change={v=>nested('identitas','namaSekolah',v)} />
        <TextField title="Nama Penyusun" value={data.identitas.namaPenyusun} change={v=>nested('identitas','namaPenyusun',v)} />
        <TextField title="NIP Penyusun" value={data.identitas.nipPenyusun} change={v=>nested('identitas','nipPenyusun',v)} />
        <SelectField title="Jenjang" value={data.identitas.jenjang} options={['SD','SMP']} change={v=>{nested('identitas','jenjang',v);nested('identitas','fase','');}} />
        <SelectField title="Fase" value={data.identitas.fase} options={fase} change={v=>nested('identitas','fase',v)} />
        <TextField title="Kelas" value={data.identitas.kelas} change={v=>nested('identitas','kelas',v)} />
        <SelectField title="Semester" value={data.identitas.semester} options={['Ganjil','Genap']} change={v=>nested('identitas','semester',v)} />
        <TextField title="Tahun Ajaran" value={data.identitas.tahunAjaran} change={v=>nested('identitas','tahunAjaran',v)} />
        <TextField title="Mata Pelajaran" value={data.identitas.mataPelajaran} change={v=>nested('identitas','mataPelajaran',v)} />
        <TextField title="Topik / Materi" value={data.identitas.topik} change={v=>nested('identitas','topik',v)} />
        <TextField title="Alokasi Waktu" value={data.identitas.alokasiWaktu} change={v=>nested('identitas','alokasiWaktu',v)} />
        <TextField title="Jumlah Siswa" value={data.identitas.jumlahSiswa} change={v=>nested('identitas','jumlahSiswa',v)} />
      </Section>

      <Section n="02" title="Identifikasi Peserta Didik" desc="Petakan kondisi dan kebutuhan belajar peserta didik.">
        {scalarSections.map(([s,k,t],i)=><TextField key={k} title={t} value={(data as any)[s][k]} change={v=>nested(s,k,v)} area wide={i===4} />)}
      </Section>

      <Section n="03" title="Desain Pembelajaran" desc="Capaian, tujuan, materi, pertanyaan pemantik, model, pendekatan, dan metode.">
        {(['cp','tp','materiPokok','pertanyaanPemantik','modelPembelajaran','pendekatanPembelajaran','metodePembelajaran'] as string[]).map(k=><TextField key={k} title={({cp:'Capaian Pembelajaran (CP)',tp:'Tujuan Pembelajaran (TP)',materiPokok:'Materi Pokok',pertanyaanPemantik:'Pertanyaan Pemantik',modelPembelajaran:'Model Pembelajaran',pendekatanPembelajaran:'Pendekatan Pembelajaran',metodePembelajaran:'Metode Pembelajaran'} as any)[k]} value={(data.desainPembelajaran as any)[k]} change={v=>nested('desainPembelajaran',k,v)} area={['cp','tp','materiPokok','pertanyaanPemantik'].includes(k)} wide={['cp','tp'].includes(k)} />)}
      </Section>

      <Section n="04" title="Kerangka Pembelajaran Mendalam" desc="Dimensi profil lulusan, prinsip pembelajaran, dan ekosistem belajar.">
        <div className="md:col-span-2"><label className={label}>Dimensi Profil Lulusan</label><div className="grid gap-2 sm:grid-cols-2">
          {['Keimanan dan Ketakwaan terhadap Tuhan YME','Kewargaan','Penalaran Kritis','Kreativitas','Kolaborasi','Kemandirian','Kesehatan','Komunikasi'].map(x=><label key={x} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" className="accent-blue-700" checked={data.kerangkaPembelajaranMendalam.dimensiProfil.includes(x)} onChange={e=>nested('kerangkaPembelajaranMendalam','dimensiProfil',e.target.checked?[...data.kerangkaPembelajaranMendalam.dimensiProfil,x]:data.kerangkaPembelajaranMendalam.dimensiProfil.filter((v:string)=>v!==x))}/>{x}</label>)}
        </div></div>
        <div className="md:col-span-2"><label className={label}>Prinsip Pembelajaran</label><div className="flex flex-wrap gap-3">{['Berkesadaran','Bermakna','Menggembirakan'].map(x=><label key={x} className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm"><input type="checkbox" className="accent-blue-700" checked={data.kerangkaPembelajaranMendalam.prinsipPembelajaran.includes(x)} onChange={e=>nested('kerangkaPembelajaranMendalam','prinsipPembelajaran',e.target.checked?[...data.kerangkaPembelajaranMendalam.prinsipPembelajaran,x]:data.kerangkaPembelajaranMendalam.prinsipPembelajaran.filter((v:string)=>v!==x))}/>{x}</label>)}</div></div>
        {(['praktikPedagogis','kemitraan','lingkungan','pemanfaatanDigital'] as string[]).map(k=><TextField key={k} title={({praktikPedagogis:'Praktik Pedagogis',kemitraan:'Kemitraan Pembelajaran',lingkungan:'Lingkungan Pembelajaran',pemanfaatanDigital:'Pemanfaatan Digital'} as any)[k]} value={(data.kerangkaPembelajaranMendalam as any)[k]} change={v=>nested('kerangkaPembelajaranMendalam',k,v)} area />)}
      </Section>

      <Section n="05" title="Langkah-Langkah Pembelajaran" desc="Rangkaian kegiatan umum dari awal, inti, hingga penutup.">
        {(['kegiatanAwal','memahami','mengaplikasi','merefleksi','kegiatanPenutup'] as string[]).map(k=><TextField key={k} title={({kegiatanAwal:'Kegiatan Awal',memahami:'Memahami',mengaplikasi:'Mengaplikasi',merefleksi:'Merefleksi',kegiatanPenutup:'Kegiatan Penutup'} as any)[k]} value={(data.langkahPembelajaran as any)[k]} change={v=>nested('langkahPembelajaran',k,v)} area />)}
      </Section>

      <Section n="06" title="Rencana Kegiatan per Pertemuan" desc="Tambahkan jumlah pertemuan sesuai kebutuhan.">
        <div className="md:col-span-2 flex justify-end"><button onClick={()=>add('pertemuanList',{judul:`Pertemuan ${data.pertemuanList.length+1}`,tujuanPertemuan:'',indikator:'',alokasiWaktu:'',kegiatanAwal:'',kegiatanIntiAsli:'',memahami:'',mengaplikasi:'',merefleksi:'',kegiatanPenutup:'',mediaList:[],sumberBelajarList:[],asesmenIdList:[]})} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">+ Tambah Pertemuan</button></div>
        {data.pertemuanList.map((x:any,i:number)=><div key={x.id||i} className="md:col-span-2 rounded-xl border bg-slate-50 p-4">
          <div className="mb-3 flex justify-between"><b>Pertemuan {i+1}</b><button onClick={()=>remove('pertemuanList',i)} className="text-xs font-bold text-red-600">Hapus</button></div>
          {(['judul','tujuanPertemuan','indikator','alokasiWaktu','kegiatanAwal','kegiatanIntiAsli','memahami','mengaplikasi','merefleksi','kegiatanPenutup'] as string[]).map(k=><TextField key={k} title={({judul:'Judul Pertemuan',tujuanPertemuan:'Tujuan Pertemuan',indikator:'Indikator',alokasiWaktu:'Alokasi Waktu',kegiatanAwal:'Kegiatan Awal',kegiatanIntiAsli:'Kegiatan Inti Asli (data lama)',memahami:'Memahami',mengaplikasi:'Mengaplikasi',merefleksi:'Merefleksi',kegiatanPenutup:'Kegiatan Penutup'} as any)[k]} value={x[k]} change={v=>updateItem('pertemuanList',i,k,v)} area={k!=='judul'&&k!=='alokasiWaktu'} />)}
        </div>)}
        {!data.pertemuanList.length&&<p className="md:col-span-2 text-sm text-slate-500">Belum ada pertemuan. Klik Tambah Pertemuan.</p>}
      </Section>

      <Section n="07" title="Asesmen dan Evaluasi" desc="Buat asesmen diagnostik, formatif, atau sumatif dan butir soal dinamis.">
        <div className="md:col-span-2 flex justify-end"><button onClick={()=>add('asesmenList',{judul:`Asesmen ${data.asesmenList.length+1}`,jenis:'Formatif',tujuan:'',teknik:'',instrumen:'',waktuPelaksanaan:'',butirSoalList:[],kriteriaPenilaian:'',tindakLanjut:''})} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">+ Tambah Asesmen</button></div>
        {data.asesmenList.map((x:any,i:number)=><div key={x.id||i} className="md:col-span-2 rounded-xl border bg-slate-50 p-4">
          <div className="mb-3 flex justify-between"><b>Asesmen {i+1}</b><button onClick={()=>remove('asesmenList',i)} className="text-xs font-bold text-red-600">Hapus</button></div>
          <TextField title="Nama Asesmen" value={x.judul} change={v=>updateItem('asesmenList',i,'judul',v)}/>
          <SelectField title="Jenis Asesmen" value={x.jenis} options={['Diagnostik','Formatif','Sumatif']} change={v=>updateItem('asesmenList',i,'jenis',v)}/>
          {(['tujuan','teknik','instrumen','waktuPelaksanaan','kriteriaPenilaian','tindakLanjut'] as string[]).map(k=><TextField key={k} title={({tujuan:'Tujuan',teknik:'Teknik',instrumen:'Instrumen',waktuPelaksanaan:'Waktu Pelaksanaan',kriteriaPenilaian:'Kriteria Penilaian',tindakLanjut:'Tindak Lanjut'} as any)[k]} value={x[k]} change={v=>updateItem('asesmenList',i,k,v)} area={['tujuan','instrumen','kriteriaPenilaian','tindakLanjut'].includes(k)}/>)}
          <div className="mt-3 border-t pt-3 md:col-span-2"><div className="mb-2 flex justify-between"><b className="text-sm">Butir Soal</b><button onClick={()=>updateItem('asesmenList',i,'butirSoalList',[...(x.butirSoalList||[]),{id:uid(),pertanyaan:'',jenisSoal:'Uraian',pilihanJawaban:[],kunciJawaban:'',skor:1}])} className="text-xs font-bold text-blue-700">+ Tambah Soal</button></div>
            {(x.butirSoalList||[]).map((s:any,j:number)=><div key={s.id||j} className="mb-3 rounded-lg border bg-white p-3"><div className="mb-2 flex justify-between text-xs font-bold">Soal {j+1}<button onClick={()=>updateItem('asesmenList',i,'butirSoalList',x.butirSoalList.filter((_:any,n:number)=>n!==j))} className="text-red-600">Hapus</button></div>
              <TextField title="Pertanyaan" value={s.pertanyaan} change={v=>{const a=[...x.butirSoalList];a[j]={...s,pertanyaan:v};updateItem('asesmenList',i,'butirSoalList',a)}} area/>
              <TextField title="Jenis Soal" value={s.jenisSoal} change={v=>{const a=[...x.butirSoalList];a[j]={...s,jenisSoal:v};updateItem('asesmenList',i,'butirSoalList',a)}}/>
              <TextField title="Pilihan Jawaban (satu per baris)" value={(s.pilihanJawaban||[]).join('\n')} change={v=>{const a=[...x.butirSoalList];a[j]={...s,pilihanJawaban:v.split('\n').filter(Boolean)};updateItem('asesmenList',i,'butirSoalList',a)}} area/>
              <TextField title="Kunci Jawaban" value={s.kunciJawaban} change={v=>{const a=[...x.butirSoalList];a[j]={...s,kunciJawaban:v};updateItem('asesmenList',i,'butirSoalList',a)}} area/>
              <TextField title="Skor" value={String(s.skor??1)} change={v=>{const a=[...x.butirSoalList];a[j]={...s,skor:Number(v)||0};updateItem('asesmenList',i,'butirSoalList',a)}}/>
            </div>)}
          </div>
        </div>)}

        <div className="md:col-span-2 mt-2 border-t border-slate-200 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <b className="text-sm text-slate-800">Rubrik Penilaian</b>
            <button onClick={()=>add('rubrikList',{judul:`Rubrik ${data.rubrikList.length+1}`,tujuan:'',aspekList:[]})} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800">+ Tambah Rubrik</button>
          </div>
          {data.rubrikList.map((r:any,ri:number)=><div key={r.id||ri} className="mb-3 rounded-xl border bg-slate-50 p-4">
            <div className="mb-2 flex justify-between"><b>Rubrik {ri+1}</b><button onClick={()=>remove('rubrikList',ri)} className="text-xs text-red-600">Hapus</button></div>
            <TextField title="Judul Rubrik" value={r.judul} change={v=>updateItem('rubrikList',ri,'judul',v)}/>
            <TextField title="Tujuan Rubrik" value={r.tujuan} change={v=>updateItem('rubrikList',ri,'tujuan',v)} area/>
            <div className="mt-3 flex justify-end"><button onClick={()=>updateItem('rubrikList',ri,'aspekList',[...(r.aspekList||[]),{id:uid(),namaAspek:'',tingkatList:[]}])} className="text-xs font-bold text-blue-700">+ Tambah Aspek</button></div>
            {(r.aspekList||[]).map((a:any,ai:number)=><div key={a.id||ai} className="mt-3 rounded-lg border bg-white p-3">
              <div className="mb-2 flex justify-between"><b className="text-sm">Aspek {ai+1}</b><button onClick={()=>updateItem('rubrikList',ri,'aspekList',r.aspekList.filter((_:any,n:number)=>n!==ai))} className="text-xs text-red-600">Hapus aspek</button></div>
              <TextField title="Nama Aspek" value={a.namaAspek} change={v=>{const z=[...r.aspekList];z[ai]={...a,namaAspek:v};updateItem('rubrikList',ri,'aspekList',z)}}/>
              <div className="mt-2 flex justify-end"><button onClick={()=>{const z=[...r.aspekList];z[ai]={...a,tingkatList:[...(a.tingkatList||[]),{id:uid(),namaTingkat:'',skor:0,deskripsi:''}]};updateItem('rubrikList',ri,'aspekList',z)}} className="text-xs font-bold text-blue-700">+ Tambah Tingkat</button></div>
              {(a.tingkatList||[]).map((t:any,ti:number)=><div key={t.id||ti} className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-2">
                <TextField title="Nama Tingkat" value={t.namaTingkat} change={v=>{const z=[...r.aspekList];const q=[...z[ai].tingkatList];q[ti]={...t,namaTingkat:v};z[ai]={...z[ai],tingkatList:q};updateItem('rubrikList',ri,'aspekList',z)}}/>
                <TextField title="Skor" value={String(t.skor??0)} change={v=>{const z=[...r.aspekList];const q=[...z[ai].tingkatList];q[ti]={...t,skor:Number(v)||0};z[ai]={...z[ai],tingkatList:q};updateItem('rubrikList',ri,'aspekList',z)}}/>
                <div className="md:col-span-2"><TextField title="Deskripsi Kriteria" value={t.deskripsi} change={v=>{const z=[...r.aspekList];const q=[...z[ai].tingkatList];q[ti]={...t,deskripsi:v};z[ai]={...z[ai],tingkatList:q};updateItem('rubrikList',ri,'aspekList',z)}} area/></div>
                <button onClick={()=>{const z=[...r.aspekList];z[ai]={...z[ai],tingkatList:z[ai].tingkatList.filter((_:any,n:number)=>n!==ti)};updateItem('rubrikList',ri,'aspekList',z)}} className="text-left text-xs text-red-600">Hapus tingkat</button>
              </div>)}
            </div>)}
          </div>)}
        </div>
      </Section>

      <Section n="08" title="Pengayaan dan Remedial" desc="Rencanakan tindak lanjut berdasarkan hasil asesmen.">
        {(['pengayaan','remedial','pendampingan','tindakLanjut'] as string[]).map(k=><TextField key={k} title={({pengayaan:'Pengayaan',remedial:'Remedial',pendampingan:'Pendampingan',tindakLanjut:'Tindak Lanjut'} as any)[k]} value={(data.pengayaanRemedial as any)[k]} change={v=>nested('pengayaanRemedial',k,v)} area/>)}
      </Section>

      <Section n="09" title="Media, Bahan, dan Sumber Belajar" desc="Tambahkan daftar media dan sumber belajar.">
        <div className="md:col-span-2 flex flex-wrap justify-end gap-2"><button onClick={()=>add('mediaList',{nama:'',keterangan:''})} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800">+ Media</button><button onClick={()=>add('sumberBelajarList',{nama:'',jenis:'Buku',keterangan:'',url:''})} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">+ Sumber Belajar</button></div>
        {data.mediaList.map((x:any,i:number)=><div key={x.id||i} className="rounded-xl border bg-slate-50 p-3"><div className="mb-2 flex justify-between"><b>Media {i+1}</b><button onClick={()=>remove('mediaList',i)} className="text-xs text-red-600">Hapus</button></div><TextField title="Nama Media" value={typeof x==='string'?x:x.nama} change={v=>updateItem('mediaList',i,'nama',v)}/><TextField title="Keterangan" value={x.keterangan} change={v=>updateItem('mediaList',i,'keterangan',v)}/></div>)}
        {data.sumberBelajarList.map((x:any,i:number)=><div key={x.id||i} className="rounded-xl border bg-slate-50 p-3"><div className="mb-2 flex justify-between"><b>Sumber {i+1}</b><button onClick={()=>remove('sumberBelajarList',i)} className="text-xs text-red-600">Hapus</button></div><TextField title="Nama Sumber" value={x.nama} change={v=>updateItem('sumberBelajarList',i,'nama',v)}/><SelectField title="Jenis" value={x.jenis} options={['Buku','Modul','Video','Website','Lingkungan','Lainnya']} change={v=>updateItem('sumberBelajarList',i,'jenis',v)}/><TextField title="Keterangan" value={x.keterangan} change={v=>updateItem('sumberBelajarList',i,'keterangan',v)}/><TextField title="URL" value={x.url} change={v=>updateItem('sumberBelajarList',i,'url',v)}/></div>)}
      </Section>

      <Section n="10" title="Lampiran Perangkat Pembelajaran" desc="Tambahkan LKPD dan lampiran sebanyak yang diperlukan.">
        <div className="md:col-span-2 flex flex-wrap justify-end gap-2"><button onClick={()=>add('lkpdList',{judul:`LKPD ${data.lkpdList.length+1}`,tujuan:'',petunjuk:'',materi:'',langkahKerja:'',pertanyaan:[],tugas:'',penilaian:''})} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">+ Tambah LKPD</button><button onClick={()=>add('lampiranList',{judul:'',jenis:'Teks',deskripsi:'',namaFile:'',fileUrl:'',contentType:'text/plain'})} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800">+ Lampiran</button></div>
        {data.lkpdList.map((x:any,i:number)=><div key={x.id||i} className="md:col-span-2 rounded-xl border bg-slate-50 p-4"><div className="mb-3 flex justify-between"><b>LKPD {i+1}</b><button onClick={()=>remove('lkpdList',i)} className="text-xs text-red-600">Hapus</button></div>
          {(['judul','tujuan','petunjuk','materi','langkahKerja','pertanyaan','tugas','penilaian'] as string[]).map(k=><TextField key={k} title={({judul:'Judul LKPD',tujuan:'Tujuan',petunjuk:'Petunjuk',materi:'Materi',langkahKerja:'Langkah Kerja',pertanyaan:'Pertanyaan (satu per baris)',tugas:'Tugas',penilaian:'Penilaian'} as any)[k]} value={k==='pertanyaan'?(x.pertanyaan||[]).join('\n'):x[k]} change={v=>updateItem('lkpdList',i,k,k==='pertanyaan'?v.split('\n').filter(Boolean):v)} area={k!=='judul'}/>)}
        </div>)}
        {data.lampiranList.map((x:any,i:number)=><div key={x.id||i} className="rounded-xl border bg-slate-50 p-3"><div className="mb-2 flex justify-between"><b>Lampiran {i+1}</b><button onClick={()=>remove('lampiranList',i)} className="text-xs text-red-600">Hapus</button></div><TextField title="Judul" value={x.judul} change={v=>updateItem('lampiranList',i,'judul',v)}/><SelectField title="Jenis Lampiran" value={x.jenis} options={['Teks','Bahan Bacaan','Soal','Kunci Jawaban','Rubrik','Instrumen','Glosarium','Daftar Pustaka','File']} change={v=>updateItem('lampiranList',i,'jenis',v)}/><TextField title="Isi / Deskripsi" value={x.deskripsi} change={v=>updateItem('lampiranList',i,'deskripsi',v)} area/><TextField title="Nama File" value={x.namaFile} change={v=>updateItem('lampiranList',i,'namaFile',v)}/><TextField title="URL File" value={x.fileUrl} change={v=>updateItem('lampiranList',i,'fileUrl',v)}/></div>)}
      </Section>

      <Section n="11" title="Refleksi Pembelajaran" desc="Refleksi guru, peserta didik, kendala, dan rencana perbaikan.">
        {(['refleksiGuru','refleksiPesertaDidik','kendala','rencanaPerbaikan'] as string[]).map(k=><TextField key={k} title={({refleksiGuru:'Refleksi Guru',refleksiPesertaDidik:'Refleksi Peserta Didik',kendala:'Kendala',rencanaPerbaikan:'Rencana Perbaikan'} as any)[k]} value={(data.refleksi as any)[k]} change={v=>nested('refleksi',k,v)} area/>)}
      </Section>

      <Section n="12" title="Pengesahan" desc="Lengkapi identitas kepala sekolah dan penyusun.">
        <TextField title="Tempat" value={data.pengesahan.tempat} change={v=>nested('pengesahan','tempat',v)}/>
        <div><label className={label}>Tanggal</label><input type="date" className={input} value={data.pengesahan.tanggal||''} onChange={e=>nested('pengesahan','tanggal',e.target.value)}/></div>
        <TextField title="Nama Kepala Sekolah" value={data.pengesahan.namaKepalaSekolah} change={v=>nested('pengesahan','namaKepalaSekolah',v)}/>
        <TextField title="NIP Kepala Sekolah" value={data.pengesahan.nipKepalaSekolah} change={v=>nested('pengesahan','nipKepalaSekolah',v)}/>
        <TextField title="Nama Penyusun" value={data.pengesahan.namaPenyusun} change={v=>nested('pengesahan','namaPenyusun',v)}/>
        <TextField title="NIP Penyusun" value={data.pengesahan.nipPenyusun} change={v=>nested('pengesahan','nipPenyusun',v)}/>
      </Section>

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white/95 p-4 shadow-lg backdrop-blur">
        <span className="text-sm text-slate-600">{editId ? (legacyMode ? 'Mode salin dari dokumen lama' : 'Mode edit V2') : 'Modul baru'}</span>
        <div className="flex gap-2"><button onClick={fresh} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Kosongkan</button><button onClick={save} disabled={saving} className="rounded-xl bg-blue-800 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving?'Menyimpan...':'Simpan Modul Ajar'}</button></div>
      </div>
    </div>

    <div className="no-print rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">Modul Ajar Tersimpan</h2><p className="text-xs text-slate-500">Dokumen milik akun Guru ini.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{records.length} modul</span></div>
      {loading?<p className="py-5 text-center text-sm text-slate-500">Memuat...</p>:records.length===0?<p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">Belum ada modul tersimpan.</p>:<div className="space-y-3">{records.map(row=>{const title=row.identitas?.judulModul||row.judulModul||'Modul tanpa judul';const v2=row.versiStruktur===2;return <div key={row.id} className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><b>{title}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v2?'bg-blue-100 text-blue-800':'bg-amber-100 text-amber-800'}`}>{v2?'V2':'VERSI LAMA'}</span></div><p className="mt-1 text-xs text-slate-500">{row.identitas?.jenjang||row.jenjang||'—'} • {row.identitas?.kelas||row.kelas||'Kelas belum diisi'} • {row.identitas?.mataPelajaran||row.mataPelajaran||''}</p></div><div className="flex gap-2"><button
          onClick={() => open(row)}
          onAnimationEnd={() => setOpeningId(current => current === row.id ? null : current)}
          className={`rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 ${openingId === row.id ? 'modul-open-feedback' : ''}`}
        >Buka</button><button onClick={()=>removeRecord(row)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Hapus</button></div></div>})}</div>}
    </div>

    <div className="print-doc hidden bg-white text-slate-900">
      <header className="rpm-kop">
        <div className="rpm-logo">
          {schoolSettings.logoPemerintahUrl
            ? <img src={schoolSettings.logoPemerintahUrl} alt="Logo Pemerintah" />
            : 'LOGO'}
        </div>
        <div className="rpm-kop-text">
          <h2 className="text-sm font-extrabold uppercase">
            {schoolSettings.namaPemerintah || (data.identitas as any).namaPemerintah || 'PEMERINTAH KABUPATEN / KOTA'}
          </h2>
          <p className="text-xs font-bold uppercase">
            {schoolSettings.namaDinas || (data.identitas as any).namaDinas || 'DINAS PENDIDIKAN'}
          </p>
          <h2 className="text-base font-extrabold uppercase">
            {schoolSettings.namaSekolah || data.identitas.namaSekolah || 'NAMA SEKOLAH'}
          </h2>
          <p className="text-[9px]">
            {schoolSettings.alamat || (data.identitas as any).alamatSekolah || ''}
          </p>
        </div>
        <div className="rpm-logo-right">
          <img src="/tut-wuri-handayani.png" alt="Lambang Tut Wuri Handayani" />
        </div>
      </header>
      <div className="mb-3 text-center">
        <h1 className="text-base font-extrabold text-blue-950">RENCANA PEMBELAJARAN MENDALAM (RPM)</h1>
        <h2 className="text-sm font-bold text-blue-900">MODUL AJAR</h2>
        <p className="text-xs font-bold text-blue-900">FASE {data.identitas.fase || '-'} — KELAS {data.identitas.kelas || '-'}</p>
      </div>

      <h3 className="rpm-title">IDENTITAS MODUL</h3>
      <table className="rpm-table"><tbody>
        {[
          ['Sekolah/Madrasah',data.identitas.namaSekolah,'Mata Pelajaran',data.identitas.mataPelajaran],
          ['Topik',data.identitas.topik,'Fase/Kelas',`${data.identitas.fase || '-'} / ${data.identitas.kelas || '-'}`],
          ['Alokasi Waktu',data.identitas.alokasiWaktu,'Tahun Pelajaran',data.identitas.tahunAjaran],
          ['Tujuan Pembelajaran',data.desainPembelajaran.tp,'Semester',data.identitas.semester],
          ['Nama Penyusun',data.identitas.namaPenyusun || namaGuru,'NIP',data.identitas.nipPenyusun],
          ['Jumlah Siswa',data.identitas.jumlahSiswa,'Jenjang',data.identitas.jenjang],
        ].map((r,i)=><tr key={i}><td className="rpm-label" style={{width:'20%'}}>{r[0]}</td><td style={{width:'30%'}}>{r[1] || '-'}</td><td className="rpm-label" style={{width:'20%'}}>{r[2]}</td><td style={{width:'30%'}}>{r[3] || '-'}</td></tr>)}
      </tbody></table>

      <h3 className="rpm-title">A. IDENTIFIKASI</h3>
      <table className="rpm-table"><thead><tr><th>Komponen</th><th>Deskripsi</th></tr></thead><tbody>
        <tr><td className="rpm-label">Identifikasi Peserta Didik</td><td>
          <p><b>Jumlah Siswa:</b> {data.identitas.jumlahSiswa || '-'}</p>
          <p><b>Kesiapan Belajar:</b> {data.identifikasiPesertaDidik.kesiapanMurid || '-'}</p>
          <p><b>Pengetahuan Awal:</b> {data.identifikasiPesertaDidik.pengetahuanAwal || '-'}</p>
          <p><b>Minat:</b> {(data.identifikasiPesertaDidik as any).minatMurid || '-'}</p>
          <p><b>Latar Belakang:</b> {(data.identifikasiPesertaDidik as any).latarBelakangMurid || '-'}</p>
          <p><b>Kebutuhan Belajar:</b> {data.identifikasiPesertaDidik.kebutuhanBelajar || '-'}</p>
          <p><b>Kondisi Kelas:</b> {data.identifikasiPesertaDidik.kondisiKelas || '-'}</p>
        </td></tr>
        <tr><td className="rpm-label">Materi Pelajaran</td><td>{data.identifikasiPesertaDidik.karakteristikMateri || '-'}</td></tr>
        <tr><td className="rpm-label">Dimensi Profil Lulusan</td><td>{data.kerangkaPembelajaranMendalam.dimensiProfil.map((v,i)=><p key={i}>{i+1}. {v}</p>)}</td></tr>
      </tbody></table>

      <h3 className="rpm-title">B. DESAIN PEMBELAJARAN</h3>
      <table className="rpm-table"><thead><tr><th>Komponen</th><th>Deskripsi</th></tr></thead><tbody>
        {[
          ['Capaian Pembelajaran',data.desainPembelajaran.cp],
          ['Lintas Disiplin Ilmu',(data.desainPembelajaran as any).lintasDisiplinIlmu],
          ['Tujuan Pembelajaran',data.desainPembelajaran.tp],
          ['Indikator Pencapaian',(data.desainPembelajaran as any).indikatorPencapaian],
          ['Topik Pembelajaran',(data.desainPembelajaran as any).topikPembelajaran || data.desainPembelajaran.materiPokok],
          ['Model Pembelajaran',data.desainPembelajaran.modelPembelajaran],
          ['Pendekatan Pembelajaran',data.desainPembelajaran.pendekatanPembelajaran],
          ['Metode Pembelajaran',data.desainPembelajaran.metodePembelajaran],
        ].filter(([,v])=>v).map(([k,v],i)=><tr key={i}><td className="rpm-label">{k}</td><td className="rpm-body">{v}</td></tr>)}
      </tbody></table>
      {data.desainPembelajaran.pertanyaanPemantik && <div className="rpm-highlight"><b>Pertanyaan Pemantik:</b><p className="rpm-body italic">{data.desainPembelajaran.pertanyaanPemantik}</p></div>}

      <h3 className="rpm-title">C. KERANGKA PEMBELAJARAN MENDALAM</h3>
      <table className="rpm-table rpm-green"><thead><tr><th>Prinsip Pembelajaran</th><th>Wujud dalam Pembelajaran</th><th>Indikator Capaian</th></tr></thead><tbody>
        {data.kerangkaPembelajaranMendalam.prinsipPembelajaran.map((v,i)=><tr key={i}><td className="rpm-label">{v}</td><td>{data.kerangkaPembelajaranMendalam.praktikPedagogis || '-'}</td><td>{(data.kerangkaPembelajaranMendalam as any).indikatorCapaian || '-'}</td></tr>)}
      </tbody></table>
      <table className="rpm-table"><tbody>
        {[
          ['Kemitraan Pembelajaran',data.kerangkaPembelajaranMendalam.kemitraan],
          ['Lingkungan Pembelajaran',data.kerangkaPembelajaranMendalam.lingkungan],
          ['Pemanfaatan Digital',data.kerangkaPembelajaranMendalam.pemanfaatanDigital],
        ].filter(([,v])=>v).map(([k,v],i)=><tr key={i}><td className="rpm-label">{k}</td><td>{v}</td></tr>)}
      </tbody></table>

      <h3 className="rpm-title">D. LANGKAH-LANGKAH PEMBELAJARAN</h3>
      {data.pertemuanList.length ? data.pertemuanList.map((p:any,i:number)=><div key={p.id||i}>
        <h4 className="rpm-subtitle">{p.judul || `Pertemuan ${i+1}`} — {p.alokasiWaktu || ''}</h4>
        {p.tujuanPertemuan && <p><b>Tujuan:</b> {p.tujuanPertemuan}</p>}
        {p.indikator && <p><b>Indikator:</b> {p.indikator}</p>}
        <div className="rpm-activity-list">
          {[
            ['KEGIATAN AWAL', p.kegiatanAwal],
            ['KEGIATAN INTI — MEMAHAMI', p.memahami],
            ['KEGIATAN INTI — MENGAPLIKASI', p.mengaplikasi],
            ['KEGIATAN INTI — MEREFLEKSI', p.merefleksi],
            ['KEGIATAN PENUTUP', p.kegiatanPenutup],
          ].filter(([, v]) => typeof v === 'string' && v.trim()).map(([judul, isi], j) => (
            <section className="rpm-activity" key={j}>
              <h5 className="rpm-activity-heading">{judul}</h5>
              <div className="rpm-activity-content rpm-body">{isi}</div>
            </section>
          ))}
        </div>
        {p.kegiatanIntiAsli && ![p.memahami, p.mengaplikasi, p.merefleksi].some((v: string) => v && v.trim()) && (
          <section className="rpm-activity">
            <h5 className="rpm-activity-heading">KEGIATAN INTI (DATA LAMA)</h5>
            <div className="rpm-activity-content rpm-body">{p.kegiatanIntiAsli}</div>
          </section>
        )}
      </div>) : <p>Rencana pertemuan belum diisi.</p>}

      <h3 className="rpm-title">E. ASESMEN</h3>
      <table className="rpm-table"><thead><tr><th>Jenis Asesmen</th><th>Metode / Instrumen</th><th>Tujuan</th></tr></thead><tbody>
        {data.asesmenList.map((a:any,i:number)=><tr key={a.id||i}><td className="rpm-label">{a.jenis}<br/>{a.judul}</td><td><p><b>Teknik:</b> {a.teknik || '-'}</p><p><b>Instrumen:</b> {a.instrumen || '-'}</p><p><b>Waktu:</b> {a.waktuPelaksanaan || '-'}</p></td><td>{a.tujuan || '-'}</td></tr>)}
      </tbody></table>
      {data.asesmenList.map((a:any,i:number)=>(a.butirSoalList||[]).length>0&&<div key={`soal-${i}`}>
        <h4 className="rpm-subtitle">Soal — {a.judul || `Asesmen ${i+1}`}</h4>
        <table className="rpm-table"><thead><tr><th>No.</th><th>Pertanyaan</th><th>Jawaban Siswa</th></tr></thead><tbody>
          {a.butirSoalList.map((q:any,j:number)=><tr key={q.id||j}><td>{j+1}</td><td>{q.pertanyaan}<br/>{(q.pilihanJawaban||[]).map((v:string,k:number)=><p key={k}>{String.fromCharCode(65+k)}. {v}</p>)}</td><td style={{height:34}}></td></tr>)}
        </tbody></table>
      </div>)}

      <h3 className="rpm-title">F. RUBRIK PENILAIAN</h3>
      {data.rubrikList.map((r:any,ri:number)=><div key={r.id||ri}>
        <h4 className="rpm-subtitle">{r.judul || `Rubrik ${ri+1}`}</h4>
        {r.tujuan && <p><b>Tujuan:</b> {r.tujuan}</p>}
        {(r.aspekList||[]).map((a:any,ai:number)=>{const levels=[...(a.tingkatList||[])].sort((x:any,y:any)=>(Number(y.skor)||0)-(Number(x.skor)||0));return <table className="rpm-table" key={a.id||ai}>
          <thead><tr><th>{a.namaAspek || `Aspek ${ai+1}`}</th>{levels.map((t:any,j:number)=><th key={t.id||j}>{t.namaTingkat || 'Tingkat'} ({t.skor})</th>)}</tr></thead>
          <tbody><tr><td className="rpm-label">Deskripsi</td>{levels.map((t:any,j:number)=><td key={t.id||j}>{t.deskripsi || '-'}</td>)}</tr></tbody>
        </table>})}
      </div>)}

      <h3 className="rpm-title">G. PENGAYAAN DAN REMEDIAL</h3>
      <table className="rpm-table"><tbody>
        {[
          ['Pengayaan',data.pengayaanRemedial.pengayaan],['Remedial',data.pengayaanRemedial.remedial],
          ['Pendampingan',data.pengayaanRemedial.pendampingan],['Tindak Lanjut',data.pengayaanRemedial.tindakLanjut],
        ].filter(([,v])=>v).map(([k,v],i)=><tr key={i}><td className="rpm-label">{k}</td><td className="rpm-body">{v}</td></tr>)}
      </tbody></table>

      <h3 className="rpm-title">H. MEDIA DAN SUMBER BELAJAR</h3>
      <table className="rpm-table"><thead><tr><th>No.</th><th>Nama</th><th>Keterangan / Jenis</th></tr></thead><tbody>
        {data.mediaList.map((m:any,i:number)=><tr key={m.id||i}><td>{i+1}</td><td>{typeof m==='string'?m:m.nama}</td><td>{typeof m==='string'?'Media pembelajaran':m.keterangan||'-'}</td></tr>)}
        {data.sumberBelajarList.map((x:any,i:number)=><tr key={x.id||i}><td>{data.mediaList.length+i+1}</td><td>{x.nama}</td><td>{[x.jenis,x.keterangan,x.url].filter(Boolean).join(' — ') || '-'}</td></tr>)}
        {!data.mediaList.length&&!data.sumberBelajarList.length&&<tr><td colSpan={3}>Belum ada media/sumber belajar.</td></tr>}
      </tbody></table>

      <h3 className="rpm-title">I. LEMBAR KERJA PESERTA DIDIK (LKPD)</h3>
      {data.lkpdList.length ? data.lkpdList.map((x:any,i:number)=><div key={x.id||i}>
        <h4 className="rpm-subtitle">{x.judul || `LKPD ${i+1}`}</h4>
        <table className="rpm-table"><tbody>
          {[
            ['Tujuan',x.tujuan],['Materi',x.materi],['Petunjuk',x.petunjuk],['Langkah Kerja',x.langkahKerja],['Tugas',x.tugas],['Penilaian',x.penilaian],
          ].filter(([,v])=>v).map(([k,v],j)=><tr key={j}><td className="rpm-label">{k}</td><td className="rpm-body">{v}</td></tr>)}
          {(x.pertanyaan||[]).length>0&&<tr><td className="rpm-label">Pertanyaan</td><td>{x.pertanyaan.map((q:string,j:number)=><p key={j}>{j+1}. {q}</p>)}</td></tr>}
        </tbody></table>
        <p>Nama: ........................................ Kelas: ............... Tanggal: ...............</p>
        <table className="rpm-table"><thead><tr><th>No.</th><th>Jawaban / Hasil Pekerjaan</th></tr></thead><tbody>{[1,2,3].map(n=><tr key={n}><td>{n}</td><td style={{height:36}}></td></tr>)}</tbody></table>
      </div>) : <p>LKPD belum ditambahkan.</p>}

      <h3 className="rpm-title">J. LAMPIRAN TAMBAHAN</h3>
      {data.lampiranList.length ? <table className="rpm-table"><thead><tr><th>No.</th><th>Judul / Jenis</th><th>Deskripsi / File</th></tr></thead><tbody>
        {data.lampiranList.map((x:any,i:number)=><tr key={x.id||i}><td>{i+1}</td><td><b>{x.judul || `Lampiran ${i+1}`}</b><br/>{x.jenis}</td><td>{x.deskripsi || '-'}{x.namaFile&&<p>File: {x.namaFile}</p>}{x.fileUrl&&<p>URL: {x.fileUrl}</p>}</td></tr>)}
      </tbody></table> : <p>Tidak ada lampiran tambahan.</p>}

      <h3 className="rpm-title">K. REFLEKSI PEMBELAJARAN</h3>
      <table className="rpm-table"><thead><tr><th>Komponen</th><th>Uraian</th></tr></thead><tbody>
        {[
          ['Refleksi Guru',data.refleksi.refleksiGuru],['Refleksi Peserta Didik',data.refleksi.refleksiPesertaDidik],
          ['Kendala',data.refleksi.kendala],['Rencana Perbaikan',data.refleksi.rencanaPerbaikan],
        ].filter(([,v])=>v).map(([k,v],i)=><tr key={i}><td className="rpm-label">{k}</td><td className="rpm-body">{v}</td></tr>)}
      </tbody></table>

      <h3 className="rpm-title">L. PENGESAHAN</h3>
      <p className="rpm-body">RPM dan Modul Ajar ini disusun untuk mata pelajaran {data.identitas.mataPelajaran || '-'} kelas {data.identitas.kelas || '-'} fase {data.identitas.fase || '-'}. Dokumen ini menjadi panduan pelaksanaan pembelajaran yang berkesadaran, bermakna, dan menggembirakan.</p>
      <div className="rpm-sign">
        <div><p>Mengetahui,</p><p>Kepala Sekolah</p><div className="rpm-sign-space"></div><b>{data.pengesahan.namaKepalaSekolah || '........................................'}</b><p>NIP. {data.pengesahan.nipKepalaSekolah || '........................................'}</p></div>
        <div><p>{data.pengesahan.tempat || '........................'}, {data.pengesahan.tanggal || '........................'}</p><p>Guru / Penyusun</p><div className="rpm-sign-space"></div><b>{data.pengesahan.namaPenyusun || data.identitas.namaPenyusun || namaGuru}</b><p>NIP. {data.pengesahan.nipPenyusun || data.identitas.nipPenyusun || '-'}</p></div>
      </div>
    </div>
  </div>;
}
