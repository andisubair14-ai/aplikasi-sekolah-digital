import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query,
  serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { adaptModulAjarToV2, buatModulAjarKosongV2 } from '../utils/modulAjarAdapter';
import type { ModulAjarV2 } from '../types/modulAjar';

type R = Record<string, any>;
const green = '#1e3a8a';
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
function PrintField({ title, value }: { title: string; value: unknown }) {
  if (Array.isArray(value)) value = value.join(', ');
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return <div className="mb-3 break-inside-avoid"><div className="text-xs font-bold uppercase text-slate-500">{title}</div><div className="mt-1 whitespace-pre-wrap text-sm">{String(value)}</div></div>;
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    setMessage(row.versiStruktur === 2
      ? `Sedang mengedit: ${v.identitas.judulModul || 'Modul tanpa judul'}`
      : 'Modul lama dibuka. Saat disimpan, sistem membuat dokumen V2 baru; dokumen lama tidak ditimpa.');
    setError(''); window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const printGroups: [string, [string, any][]][] = [
    ['01. Identitas Modul', Object.entries(data.identitas)],
    ['02. Identifikasi Peserta Didik', Object.entries(data.identifikasiPesertaDidik)],
    ['03. Desain Pembelajaran', Object.entries(data.desainPembelajaran).filter(([k]) => k !== 'tujuanPembelajaran')],
    ['04. Kerangka Pembelajaran Mendalam', Object.entries(data.kerangkaPembelajaranMendalam)],
    ['05. Langkah-Langkah Pembelajaran', Object.entries(data.langkahPembelajaran)],
    ['08. Pengayaan dan Remedial', Object.entries(data.pengayaanRemedial)],
    ['11. Refleksi Pembelajaran', Object.entries(data.refleksi)],
    ['12. Pengesahan', Object.entries(data.pengesahan)],
  ];

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <style>{`@page{size:A4;margin:15mm}@media print{body{background:#fff!important}body *{visibility:hidden!important}.print-doc,.print-doc *{visibility:visible!important}.print-doc{display:block!important;position:absolute!important;left:0;top:0;width:100%;color:#17212b!important}.no-print{display:none!important}.avoid-break{break-inside:avoid;page-break-inside:avoid}}`}</style>

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
    {message && <div className="no-print rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>}

    <div className="no-print space-y-5">
      <Section n="01" title="Identitas Modul" desc="Informasi sekolah, penyusun, jenjang, kelas, dan mata pelajaran.">
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
      {loading?<p className="py-5 text-center text-sm text-slate-500">Memuat...</p>:records.length===0?<p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">Belum ada modul tersimpan.</p>:<div className="space-y-3">{records.map(row=>{const title=row.identitas?.judulModul||row.judulModul||'Modul tanpa judul';const v2=row.versiStruktur===2;return <div key={row.id} className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><b>{title}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v2?'bg-blue-100 text-blue-800':'bg-amber-100 text-amber-800'}`}>{v2?'V2':'VERSI LAMA'}</span></div><p className="mt-1 text-xs text-slate-500">{row.identitas?.jenjang||row.jenjang||'—'} • {row.identitas?.kelas||row.kelas||'Kelas belum diisi'} • {row.identitas?.mataPelajaran||row.mataPelajaran||''}</p></div><div className="flex gap-2"><button onClick={()=>open(row)} className="rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold text-white">Buka</button><button onClick={()=>removeRecord(row)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600">Hapus</button></div></div>})}</div>}
    </div>

    <div className="print-doc hidden bg-white text-slate-900">
      <header className="mb-6 border-b-2 border-blue-800 pb-4 text-center"><p className="text-xs font-bold uppercase">{data.identitas.namaSekolah||'Nama Sekolah'}</p><h1 className="mt-2 text-2xl font-bold" style={{color:green}}>MODUL AJAR</h1><p>{data.identitas.judulModul}</p></header>
      {printGroups.map(([title,fields])=><section key={title} className="mb-6"><h2 className="mb-3 border-b border-blue-700 pb-2 font-bold" style={{color:green}}>{title}</h2><div className="grid grid-cols-2 gap-x-6">{fields.map(([k,v])=><PrintField key={k} title={k} value={v}/>)}</div></section>)}
      {data.pertemuanList.length>0&&<section className="mb-6"><h2 className="mb-3 border-b pb-2 font-bold">06. Rencana Kegiatan per Pertemuan</h2>{data.pertemuanList.map((x:any,i:number)=><div key={x.id||i} className="avoid-break mb-4"><b>Pertemuan {i+1}: {x.judul}</b>{Object.entries(x).filter(([k])=>!['id','judul'].includes(k)).map(([k,v])=><PrintField key={k} title={k} value={v}/>)}</div>)}</section>}
      {data.asesmenList.length>0&&<section className="mb-6"><h2 className="mb-3 border-b pb-2 font-bold">07. Asesmen dan Evaluasi</h2>{data.asesmenList.map((x:any,i:number)=><div key={x.id||i} className="avoid-break mb-4"><b>{x.judul} ({x.jenis})</b>{Object.entries(x).filter(([k])=>!['id','judul','jenis','butirSoalList'].includes(k)).map(([k,v])=><PrintField key={k} title={k} value={v}/>) }{(x.butirSoalList||[]).map((s:any,j:number)=><div key={s.id||j} className="ml-4 border-l pl-3"><PrintField title={`Soal ${j+1}`} value={s.pertanyaan}/><PrintField title="Kunci Jawaban" value={s.kunciJawaban}/><PrintField title="Skor" value={s.skor}/></div>)}</div>)}</section>}
      {data.lkpdList.length>0&&<section className="mb-6"><h2 className="mb-3 border-b pb-2 font-bold">10. LKPD</h2>{data.lkpdList.map((x:any,i:number)=><div key={x.id||i} className="avoid-break mb-4"><b>{x.judul||`LKPD ${i+1}`}</b>{Object.entries(x).filter(([k])=>!['id','judul'].includes(k)).map(([k,v])=><PrintField key={k} title={k} value={v}/>)}</div>)}</section>}
      {data.lampiranList.length>0&&<section className="mb-6"><h2 className="mb-3 border-b pb-2 font-bold">Lampiran Tambahan</h2>{data.lampiranList.map((x:any,i:number)=><div key={x.id||i} className="avoid-break mb-4"><b>{x.judul||`Lampiran ${i+1}`}</b><PrintField title="Jenis" value={x.jenis}/><PrintField title="Isi" value={x.deskripsi}/><PrintField title="File" value={x.namaFile}/><PrintField title="URL" value={x.fileUrl}/></div>)}</section>}
      <section className="mt-10 grid grid-cols-2 gap-12 text-center text-sm"><div><p>{data.pengesahan.tempat}, {data.pengesahan.tanggal}</p><p>Mengetahui, Kepala Sekolah</p><div className="h-20"/><b className="underline">{data.pengesahan.namaKepalaSekolah}</b><p>NIP. {data.pengesahan.nipKepalaSekolah}</p></div><div><p>&nbsp;</p><p>Penyusun Modul Ajar</p><div className="h-20"/><b className="underline">{data.pengesahan.namaPenyusun||namaGuru}</b><p>NIP. {data.pengesahan.nipPenyusun||data.identitas.nipPenyusun}</p></div></section>
    </div>
  </div>;
}
