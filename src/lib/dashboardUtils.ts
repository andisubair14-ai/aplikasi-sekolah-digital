
export interface DashboardRow {
  id?: string;
  tanggal?: string;
  nisn?: string;
  status?: string;
  kelas?: string;
  kelasId?: string;
  [key: string]: unknown;
}

export interface AttendanceSummary {
  hadir: number;
  tidakHadir: number;
  belumDiisi: number;
  tercatat: number;
  persentaseHadir: number;
  pieData: Array<{ name: string; value: number }>;
}

export interface TrendRow {
  tanggal: string;
  day: string;
  hadir: number | null;
}

const pad = (value: number) => String(value).padStart(2, '0');

// Menggunakan tanggal lokal perangkat.
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Mengambil tujuh hari terakhir.
export function getLastSevenDays(): Array<{ tanggal: string; day: string }> {
  const hasil: Array<{ tanggal: string; day: string }> = [];
  const today = new Date();

  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);

    const namaHari = date
      .toLocaleDateString('id-ID', { weekday: 'short' })
      .replace('.', '');

    hasil.push({
      tanggal: localDateKey(date),
      day: namaHari
    });
  }

  return hasil;
}

// Menghindari penghitungan siswa yang tercatat lebih dari satu kali.
function uniqueAttendance(records: DashboardRow[]): DashboardRow[] {
  const map = new Map<string, DashboardRow>();

  records.forEach((record, index) => {
    const key = String(record.nisn || record.id || `baris-${index}`);
    map.set(key, record);
  });

  return Array.from(map.values());
}

// Menghitung ringkasan kehadiran berdasarkan ID rombel.
export function summarizeAttendance(
  records: DashboardRow[],
  totalSiswa: number,
  tanggal: string,
  classIds?: Set<string>
): AttendanceSummary {
  const filtered = records.filter((record) => {
    if (record.tanggal !== tanggal) return false;

    if (
      classIds &&
      classIds.has(String(record.kelasId || ''))
    ) {
      return false;
    }

    return true;
  });

  const unique = uniqueAttendance(filtered);

  const hadir = unique.filter(
    (item) => item.status === 'Hadir'
  ).length;

  const tidakHadir = unique.filter((item) =>
    ['Sakit', 'Izin', 'Alpa'].includes(String(item.status || ''))
  ).length;

  const tercatat = hadir + tidakHadir;

  const belumDiisi = Math.max(0, totalSiswa - tercatat);

  const persentaseHadir = totalSiswa > 0
    ? Math.round((hadir / totalSiswa) * 1000) / 10
    : 0;

  return {
    hadir,
    tidakHadir,
    belumDiisi,
    tercatat,
    persentaseHadir,
    pieData: [
      { name: 'Hadir', value: hadir },
      { name: 'Tidak Hadir (Sakit/Izin/Alpa)', value: tidakHadir },
      { name: 'Belum Diisi', value: belumDiisi }
    ]
  };
}

// Membuat data grafik kehadiran tujuh hari berdasarkan ID rombel.
export function buildWeeklyTrend(
  records: DashboardRow[],
  totalSiswa: number,
  classIds?: Set<string>
): TrendRow[] {
  const days = getLastSevenDays();

  return days.map((day) => {
    const dailyRecords = records.filter((record) => {
      if (record.tanggal !== day.tanggal) return false;

      if (
        classIds &&
        !classIds.has(String(record.kelasId || ''))
      ) {
        return false;
      }

      return true;
    });

    const unique = uniqueAttendance(dailyRecords);

    const knownRecords = unique.filter((item) =>
      ['Hadir', 'Sakit', 'Izin', 'Alpa'].includes(
        String(item.status || '')
      )
    );

    const present = knownRecords.filter(
      (item) => item.status === 'Hadir'
    ).length;

    return {
      tanggal: day.tanggal,
      day: day.day,
      hadir: totalSiswa > 0 && knownRecords.length > 0
        ? Math.round((present / totalSiswa) * 1000) / 10
        : null
    };
  });
}

// Memeriksa apakah siswa aktif pada tahun ajaran tertentu.
export function isStudentActiveForYear(
  student: DashboardRow,
  activeYear: string | null
): boolean {
  if (student.status !== 'Aktif') return false;

  if (!activeYear) return true;

  const year = String(student.tahunAjaran || '').trim();

  return !year || year === activeYear;
}

// Memeriksa apakah tanggal berada pada bulan berjalan.
export function isThisMonth(value: unknown): boolean {
  if (!value) return false;

  const text = String(value);
  const monthKey = localDateKey(new Date()).slice(0, 7);

  return text.slice(0, 7) === monthKey;
}

// Format angka sesuai kebiasaan Indonesia.
export function formatIndonesianNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}
