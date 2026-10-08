import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, Printer, FileText } from 'lucide-react';
import { AppDatabase, Role } from '../types';
import {
  exportToExcelXML,
  exportToPDFDocument,
  exportStudentBillsPDF,
  exportBillsRecapReportPDF,
} from '../utils/exportUtils';

interface ReportsViewProps {
  db: AppDatabase;
  role: Role;
  userClassId?: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type ReportTab = 'harian' | 'mingguan' | 'bulanan' | 'per_siswa' | 'per_kelas' | 'guru_staf' | 'tunggakan';

export const ReportsView: React.FC<ReportsViewProps> = ({ db, role, userClassId, showToast }) => {
  const [reportType, setReportType] = useState<ReportTab>(role === 'wali_kelas' ? 'per_kelas' : 'harian');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedClassId, setSelectedClassId] = useState<string>(
    role === 'wali_kelas' && userClassId ? userClassId : 'ALL'
  );

  const filteredStudents = useMemo(() => {
    return db.students.filter((s) => {
      if (role === 'wali_kelas' && userClassId) return s.classId === userClassId;
      if (selectedClassId !== 'ALL') return s.classId === selectedClassId;
      return true;
    });
  }, [db.students, role, userClassId, selectedClassId]);

  // Compute the 7-day range (Monday to Sunday or 7 days ending at selectedDate) for Mingguan report
  const weekDates = useMemo(() => {
    const base = new Date(selectedDate + 'T00:00:00');
    if (isNaN(base.getTime())) return [];
    const dayOfWeek = base.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMonday);

    const days: { dateStr: string; label: string; shortDay: string }[] = [];
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    for (let i = 0; i < 6; i++) {
      // 6 hari efektif madrasah (Senin s.d Sabtu)
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      days.push({
        dateStr,
        label: `${dayNames[d.getDay()]} ${day}/${m}`,
        shortDay: dayNames[d.getDay()],
      });
    }
    return days;
  }, [selectedDate]);

  const weekRangeLabel = useMemo(() => {
    if (weekDates.length === 0) return selectedDate;
    return `${weekDates[0].dateStr} s.d ${weekDates[weekDates.length - 1].dateStr}`;
  }, [weekDates, selectedDate]);

  const studentRecapRows = useMemo(() => {
    const weekSet = new Set(weekDates.map((d) => d.dateStr));

    return filteredStudents.map((st) => {
      const cls = db.classes.find((c) => c.id === st.classId);
      const records = db.attendance.filter((a) => {
        if (a.studentId !== st.id) return false;
        if (reportType === 'harian') return a.date === selectedDate;
        if (reportType === 'mingguan') return weekSet.has(a.date);
        if (reportType === 'bulanan') return a.date.startsWith(selectedMonth);
        return true; // 'per_siswa' -> seluruh riwayat semester
      });

      const hadir = records.filter((r) => r.status === 'Hadir').length;
      const terlambat = records.filter((r) => r.status === 'Terlambat').length;
      const izin = records.filter((r) => r.status === 'Izin').length;
      const sakit = records.filter((r) => r.status === 'Sakit').length;
      const alpa = records.filter((r) => r.status === 'Alpa').length;
      const totalRecorded = hadir + terlambat + izin + sakit + alpa;
      const pct = totalRecorded > 0 ? Math.round(((hadir + terlambat) / totalRecorded) * 100) : 0;

      const todayRecord = db.attendance.find((a) => a.studentId === st.id && a.date === selectedDate);

      // Daily status map for the 6-day school week (Senin - Sabtu)
      const weeklyStatuses = weekDates.map((wd) => {
        const rec = db.attendance.find((a) => a.studentId === st.id && a.date === wd.dateStr);
        if (!rec) return '-';
        if (rec.status === 'Hadir') return 'H';
        if (rec.status === 'Terlambat') return 'T';
        if (rec.status === 'Izin') return 'I';
        if (rec.status === 'Sakit') return 'S';
        if (rec.status === 'Alpa') return 'A';
        return '-';
      });

      const studentNotesCount = db.notes.filter((n) => n.studentId === st.id).length;

      return {
        student: st,
        className: cls?.name || st.classId,
        todayStatus: todayRecord?.status || 'Belum',
        todayTime: todayRecord?.timeIn || '-',
        todayNote: todayRecord?.note || '-',
        todayRecordedBy: todayRecord?.recordedBy || '-',
        weeklyStatuses,
        hadir,
        terlambat,
        izin,
        sakit,
        alpa,
        totalRecorded,
        pct,
        studentNotesCount,
      };
    });
  }, [filteredStudents, db.classes, db.attendance, db.notes, reportType, selectedDate, selectedMonth, weekDates]);

  const classRecapRows = useMemo(() => {
    const targetClasses =
      role === 'wali_kelas' && userClassId
        ? db.classes.filter((c) => c.id === userClassId)
        : db.classes;

    return targetClasses.map((cls) => {
      const clsStudents = db.students.filter((s) => s.classId === cls.id);
      const clsAtt = db.attendance.filter((a) => a.classId === cls.id && a.date.startsWith(selectedMonth));
      const hadir = clsAtt.filter((a) => a.status === 'Hadir').length;
      const terlambat = clsAtt.filter((a) => a.status === 'Terlambat').length;
      const izin = clsAtt.filter((a) => a.status === 'Izin').length;
      const sakit = clsAtt.filter((a) => a.status === 'Sakit').length;
      const alpa = clsAtt.filter((a) => a.status === 'Alpa').length;
      const total = hadir + terlambat + izin + sakit + alpa;
      const pct = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 100;
      const wali = db.users.find((u) => u.id === cls.homeroomTeacherId);

      return {
        cls,
        waliName: wali?.name || '-',
        studentCount: clsStudents.length,
        hadir,
        terlambat,
        izin,
        sakit,
        alpa,
        pct,
      };
    });
  }, [db.classes, db.students, db.attendance, db.users, role, userClassId, selectedMonth]);

  const getReportTablePayload = () => {
    if (reportType === 'per_kelas') {
      const headers = ['No', 'Kelas', 'Wali Kelas', 'Jumlah Siswa', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', 'Persentase (%)'];
      const rows = classRecapRows.map((r, i) => [
        i + 1,
        r.cls.name,
        r.waliName,
        r.studentCount,
        r.hadir,
        r.terlambat,
        r.izin,
        r.sakit,
        r.alpa,
        `${r.pct}%`,
      ]);
      return {
        filename: `Laporan_Per_Kelas_${selectedMonth}`,
        sheetName: 'Rekap Kelas',
        title: `Rekapitulasi Kehadiran Per Kelas — Periode ${selectedMonth}`,
        headers,
        rows,
      };
    } else if (reportType === 'guru_staf') {
      const headers = ['No', 'Nama Guru / Staf', 'NIP', 'Jabatan', 'Peran Sistem', 'Telepon', 'Status'];
      const rows = db.users.map((u, i) => [i + 1, u.name, u.nip, u.position, u.role, u.phone, u.status]);
      return {
        filename: `Laporan_Guru_Staf_MI`,
        sheetName: 'Guru Staf',
        title: `Daftar Pendidik & Tenaga Kependidikan (Guru / Staf MI)`,
        headers,
        rows,
      };
    } else if (reportType === 'tunggakan') {
      const filteredStudentIds = new Set(filteredStudents.map((s) => s.id));
      const targetBills = db.bills.filter((b) => filteredStudentIds.has(b.studentId));
      const headers = [
        'No',
        'NIS',
        'Nama Siswa',
        'Kelas',
        'Orang Tua / Wali',
        'Jenis Tagihan',
        'Rincian',
        'Periode',
        'Tagihan (Rp)',
        'Terbayar (Rp)',
        'Sisa Tunggakan (Rp)',
        'Status',
      ];
      const rows = targetBills.map((b, i) => {
        const st = db.students.find((s) => s.id === b.studentId);
        const cls = db.classes.find((c) => c.id === st?.classId);
        const rem = Math.max(0, b.amount - b.paidAmount);
        return [
          i + 1,
          st?.nis || '-',
          st?.name || b.studentId,
          cls?.name || st?.classId || '-',
          st?.parentName || '-',
          b.type,
          b.title,
          b.period,
          b.amount,
          b.paidAmount,
          rem,
          b.status,
        ];
      });
      return {
        filename: `Laporan_Rekap_Tunggakan_Siswa_MI_${selectedDate}`,
        sheetName: 'Rekap Tunggakan',
        title: `Laporan Rekapitulasi Tunggakan & Administrasi Keuangan Siswa`,
        headers,
        rows,
      };
    } else if (reportType === 'harian') {
      const headers = [
        'No',
        'NIS',
        'Nama Siswa',
        'Kelas',
        'Status Kehadiran',
        'Jam Masuk',
        'Keterangan / Alasan',
        'Dicatat Oleh',
      ];
      const rows = studentRecapRows.map((r, i) => [
        i + 1,
        r.student.nis,
        r.student.name,
        r.className,
        r.todayStatus,
        r.todayTime,
        r.todayNote,
        r.todayRecordedBy,
      ]);
      return {
        filename: `Laporan_Harian_MI_${selectedDate}`,
        sheetName: 'Absensi Harian',
        title: `Laporan Kehadiran Harian Siswa — Tanggal ${selectedDate}`,
        headers,
        rows,
      };
    } else if (reportType === 'mingguan') {
      const headers = [
        'No',
        'NIS',
        'Nama Siswa',
        'Kelas',
        ...weekDates.map((d) => d.label),
        'H',
        'T',
        'I',
        'S',
        'A',
        'Kehadiran (%)',
      ];
      const rows = studentRecapRows.map((r, i) => [
        i + 1,
        r.student.nis,
        r.student.name,
        r.className,
        ...r.weeklyStatuses,
        r.hadir,
        r.terlambat,
        r.izin,
        r.sakit,
        r.alpa,
        `${r.pct}%`,
      ]);
      return {
        filename: `Laporan_Mingguan_MI_${selectedDate}`,
        sheetName: 'Rekap Mingguan',
        title: `Rekapitulasi Kehadiran Mingguan Siswa (${weekRangeLabel})`,
        headers,
        rows,
      };
    } else if (reportType === 'bulanan') {
      const headers = [
        'No',
        'NIS',
        'NISN',
        'Nama Siswa',
        'Kelas',
        'Hadir (H)',
        'Terlambat (T)',
        'Izin (I)',
        'Sakit (S)',
        'Alpa (A)',
        'Total Hari Efektif',
        'Persentase Bulanan (%)',
      ];
      const rows = studentRecapRows.map((r, i) => [
        i + 1,
        r.student.nis,
        r.student.nisn || '-',
        r.student.name,
        r.className,
        r.hadir,
        r.terlambat,
        r.izin,
        r.sakit,
        r.alpa,
        r.totalRecorded,
        `${r.pct}%`,
      ]);
      return {
        filename: `Laporan_Bulanan_MI_${selectedMonth}`,
        sheetName: 'Rekap Bulanan',
        title: `Rekapitulasi Kehadiran Bulanan Siswa — Periode ${selectedMonth}`,
        headers,
        rows,
      };
    } else {
      // 'per_siswa' -> Akumulasi Semester & Catatan
      const headers = [
        'No',
        'NIS',
        'NISN',
        'Nama Siswa',
        'Kelas',
        'Orang Tua / Wali',
        'Hadir',
        'Terlambat',
        'Izin',
        'Sakit',
        'Alpa',
        'Catatan / Prestasi',
        'Kehadiran (%)',
      ];
      const rows = studentRecapRows.map((r, i) => [
        i + 1,
        r.student.nis,
        r.student.nisn || '-',
        r.student.name,
        r.className,
        r.student.parentName || '-',
        r.hadir,
        r.terlambat,
        r.izin,
        r.sakit,
        r.alpa,
        `${r.studentNotesCount} Catatan`,
        `${r.pct}%`,
      ]);
      return {
        filename: `Laporan_Per_Siswa_MI_${selectedMonth}`,
        sheetName: 'Rekap Per Siswa',
        title: `Laporan Rekapitulasi Kehadiran & Catatan Per Siswa`,
        headers,
        rows,
      };
    }
  };

  const handleExportExcel = () => {
    const payload = getReportTablePayload();
    exportToExcelXML(payload.filename, payload.sheetName, payload.headers, payload.rows);
    showToast(`File Excel (${payload.filename}.xlsx) berhasil diunduh`);
  };

  const handleExportPDF = () => {
    if (reportType === 'tunggakan') {
      const filteredStudentIds = new Set(filteredStudents.map((s) => s.id));
      const targetBills = db.bills.filter((b) => filteredStudentIds.has(b.studentId));
      exportBillsRecapReportPDF({
        filename: `Laporan_Rekap_Tunggakan_Siswa_MI_${selectedDate}`,
        title: 'Laporan Rekapitulasi Tunggakan & Administrasi Keuangan Siswa',
        settings: db.settings,
        bills: targetBills,
        students: db.students,
        classes: db.classes,
      });
      showToast('File PDF Rekap Tunggakan berhasil diunduh');
      return;
    }

    const payload = getReportTablePayload();
    exportToPDFDocument({
      filename: payload.filename,
      schoolName: db.settings.schoolName,
      nsm: db.settings.nsm,
      npsn: db.settings.npsn,
      address: db.settings.address,
      docPrefix: db.settings.docPrefix,
      reportTitle: payload.title,
      subtitle: `Tahun Ajaran ${db.settings.academicYear} (Semester ${db.settings.semester}) | Tanggal Cetak: ${selectedDate}`,
      headmasterName: db.settings.headmasterName,
      headmasterNip: db.settings.headmasterNip,
      headers: payload.headers,
      rows: payload.rows,
    });
    showToast(`File PDF (${payload.filename}.pdf) berhasil diunduh`);
  };

  const handlePrint = () => {
    showToast('Menyiapkan tampilan cetak dokumen laporan...');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const availableTabs: { id: ReportTab; label: string }[] =
    role === 'wali_kelas'
      ? [
          { id: 'per_kelas', label: 'Laporan Kelas' },
          { id: 'bulanan', label: 'Laporan Bulanan' },
          { id: 'per_siswa', label: 'Laporan Per Siswa' },
          { id: 'harian', label: 'Laporan Harian' },
          { id: 'tunggakan', label: 'Rekap Tunggakan (PDF)' },
        ]
      : [
          { id: 'harian', label: 'Harian' },
          { id: 'mingguan', label: 'Mingguan' },
          { id: 'bulanan', label: 'Bulanan' },
          { id: 'per_siswa', label: 'Per Siswa' },
          { id: 'per_kelas', label: 'Per Kelas' },
          { id: 'guru_staf', label: 'Guru / Staf' },
          { id: 'tunggakan', label: 'Rekap Tunggakan & SPP' },
        ];

  return (
    <div className="space-y-4">
      {/* Compact Minimalist Controls Toolbar */}
      <div className="neu-card rounded-2xl p-4 sm:p-5 no-print space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
          {/* Report Type Selector */}
          <div className="inline-flex items-center gap-1 overflow-x-auto bg-[#f3f2f8] p-1 rounded-xl">
            {availableTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setReportType(t.id)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  reportType === t.id
                    ? 'bg-[#3c1e96] text-white'
                    : 'text-slate-600 hover:text-[#1f1b38]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Concise Export Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 rounded-xl bg-[#2bc155] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#24a648] transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 rounded-xl bg-[#3c1e96] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4e36e2] transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1f1b38] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        {/* Inline Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-slate-500">Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-[#f3f2f8] px-3 py-1.5 text-[12px] font-mono focus:bg-white focus:border-[#4e36e2] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-slate-500">Bulan:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border border-slate-200 bg-[#f3f2f8] px-3 py-1.5 text-[12px] font-mono focus:bg-white focus:border-[#4e36e2] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-slate-500">Kelas:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={role === 'wali_kelas'}
              className="rounded-xl border border-slate-200 bg-[#f3f2f8] px-3 py-1.5 text-[12px] disabled:bg-slate-100 focus:bg-white focus:border-[#4e36e2] focus:outline-none"
            >
              {role !== 'wali_kelas' && <option value="ALL">Semua Kelas</option>}
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="neu-card print-sheet rounded-2xl p-4 sm:p-6 bg-white">
        {/* Official Madrasah Letterhead (Kop Surat Resmi Sekolah/Madrasah) */}
        <div className="border-b-[3px] border-double border-[#1f1b38] pb-3.5 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-[#3c1e96] text-white flex items-center justify-center font-bold text-[20px] shrink-0">
              MI
            </div>
            <div>
              <p className="text-[10.5px] font-bold tracking-wider text-[#3c1e96] uppercase">
                KEMENTERIAN AGAMA REPUBLIK INDONESIA · MADRASAH IBTIDAIYAH
              </p>
              <h3 className="text-[18px] font-extrabold text-[#1f1b38] uppercase tracking-tight leading-snug">
                {db.settings.schoolName}
              </h3>
              <p className="text-[11px] text-slate-600">
                NSM: <span className="font-mono font-semibold">{db.settings.nsm}</span> · NPSN:{' '}
                <span className="font-mono font-semibold">{db.settings.npsn}</span> · {db.settings.address}
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right text-[11px] text-slate-600 font-mono shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            <p className="font-semibold text-[#1f1b38]">No: {db.settings.docPrefix}</p>
            <p>
              T.A {db.settings.academicYear} (Sem. {db.settings.semester})
            </p>
            <p>Tanggal Cetak: {selectedDate}</p>
          </div>
        </div>

        {/* Table Content based on selected Report Type */}
        {reportType === 'per_kelas' ? (
          <div className="overflow-x-auto">
            <div className="mb-3">
              <h4 className="text-[14px] font-bold text-[#1f1b38] uppercase">
                Laporan Rekapitulasi Kehadiran Siswa Per Kelas
              </h4>
              <p className="text-[11.5px] text-slate-500">
                Periode Bulan: <span className="font-mono font-semibold">{selectedMonth}</span> · Tahun Ajaran{' '}
                {db.settings.academicYear}
              </p>
            </div>
            <table className="print-table w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-slate-200 bg-[#f3f2f8] text-slate-700">
                  <th className="py-2.5 px-3 font-bold">No</th>
                  <th className="py-2.5 px-3 font-bold">Kelas</th>
                  <th className="py-2.5 px-3 font-bold">Wali Kelas</th>
                  <th className="py-2.5 px-3 font-bold text-right">Siswa</th>
                  <th className="py-2.5 px-3 font-bold text-right">Hadir</th>
                  <th className="py-2.5 px-3 font-bold text-right">Terlambat</th>
                  <th className="py-2.5 px-3 font-bold text-right">Izin</th>
                  <th className="py-2.5 px-3 font-bold text-right">Sakit</th>
                  <th className="py-2.5 px-3 font-bold text-right">Alpa</th>
                  <th className="py-2.5 px-3 font-bold text-right">Capaian (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {classRecapRows.map((row, idx) => (
                  <tr key={row.cls.id} className="hover:bg-indigo-50/30">
                    <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-[#1f1b38]">{row.cls.name}</td>
                    <td className="py-2 px-3 text-slate-700">{row.waliName}</td>
                    <td className="py-2 px-3 text-right font-mono">{row.studentCount}</td>
                    <td className="py-2 px-3 text-right font-mono text-[#2bc155] font-medium">{row.hadir}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-600">{row.terlambat}</td>
                    <td className="py-2 px-3 text-right font-mono text-[#48a9f8]">{row.izin}</td>
                    <td className="py-2 px-3 text-right font-mono text-[#4e36e2]">{row.sakit}</td>
                    <td className="py-2 px-3 text-right font-mono text-red-600">{row.alpa}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[#1f1b38]">{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : reportType === 'guru_staf' ? (
          <div className="overflow-x-auto">
            <div className="mb-3">
              <h4 className="text-[14px] font-bold text-[#1f1b38] uppercase">
                Daftar Pendidik & Tenaga Kependidikan (Guru / Staf Madrasah)
              </h4>
              <p className="text-[11.5px] text-slate-500">
                Tahun Ajaran {db.settings.academicYear} · Total: {db.users.length} Personel
              </p>
            </div>
            <table className="print-table w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-slate-200 bg-[#f3f2f8] text-slate-700">
                  <th className="py-2.5 px-3 font-bold">No</th>
                  <th className="py-2.5 px-3 font-bold">Nama Lengkap</th>
                  <th className="py-2.5 px-3 font-bold">NIP / NUPTK</th>
                  <th className="py-2.5 px-3 font-bold">Jabatan Tugas</th>
                  <th className="py-2.5 px-3 font-bold">Kontak</th>
                  <th className="py-2.5 px-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {db.users.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-indigo-50/30">
                    <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-[#1f1b38]">{u.name}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{u.nip}</td>
                    <td className="py-2 px-3 text-slate-700">{u.position}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{u.phone}</td>
                    <td className="py-2 px-3 font-medium text-[#2bc155] capitalize">{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : reportType === 'tunggakan' ? (
          <div className="overflow-x-auto">
            {(() => {
              const targetBills = db.bills.filter((b) => filteredStudents.some((s) => s.id === b.studentId));
              const totalNominal = targetBills.reduce((s, b) => s + b.amount, 0);
              const totalPaid = targetBills.reduce((s, b) => s + b.paidAmount, 0);
              const totalRemaining = targetBills.reduce((s, b) => s + Math.max(0, b.amount - b.paidAmount), 0);
              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-[14px] font-bold text-[#1f1b38] uppercase">
                        Laporan Rekapitulasi Tunggakan & Administrasi Keuangan Siswa
                      </h4>
                      <p className="text-[11.5px] text-slate-500">
                        Total Tagihan: <strong className="font-mono">Rp {totalNominal.toLocaleString('id-ID')}</strong> ·
                        Terbayar: <strong className="font-mono text-[#2bc155]">Rp {totalPaid.toLocaleString('id-ID')}</strong> ·
                        Sisa Tunggakan: <strong className="font-mono text-red-600">Rp {totalRemaining.toLocaleString('id-ID')}</strong>
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500 no-print">
                      Klik tombol <strong>PDF Orang Tua</strong> pada baris siswa untuk mengunduh surat tunggakan per siswa.
                    </span>
                  </div>
                  <table className="print-table w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="border-y border-slate-200 bg-[#f3f2f8] text-slate-700">
                        <th className="py-2.5 px-2.5 font-bold">No</th>
                        <th className="py-2.5 px-2.5 font-bold">NIS</th>
                        <th className="py-2.5 px-2.5 font-bold">Nama Siswa & Wali</th>
                        <th className="py-2.5 px-2.5 font-bold">Kelas</th>
                        <th className="py-2.5 px-2.5 font-bold">Jenis & Rincian</th>
                        <th className="py-2.5 px-2.5 font-bold">Periode</th>
                        <th className="py-2.5 px-2.5 font-bold text-right">Tagihan (Rp)</th>
                        <th className="py-2.5 px-2.5 font-bold text-right">Terbayar (Rp)</th>
                        <th className="py-2.5 px-2.5 font-bold text-right">Sisa Tunggakan</th>
                        <th className="py-2.5 px-2.5 font-bold">Status</th>
                        <th className="py-2.5 px-2.5 font-bold text-right no-print">Surat Orang Tua</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {targetBills.map((b, idx) => {
                        const st = db.students.find((s) => s.id === b.studentId);
                        const cls = db.classes.find((c) => c.id === st?.classId);
                        const rem = Math.max(0, b.amount - b.paidAmount);
                        return (
                          <tr key={b.id} className="hover:bg-indigo-50/30">
                            <td className="py-2 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-2.5 font-mono text-slate-600">{st?.nis || '-'}</td>
                            <td className="py-2 px-2.5">
                              <span className="font-semibold text-[#1f1b38] block">{st?.name || b.studentId}</span>
                              <span className="text-[10.5px] text-slate-500">Wali: {st?.parentName || '-'}</span>
                            </td>
                            <td className="py-2 px-2.5 text-slate-600">{cls?.name || st?.classId || '-'}</td>
                            <td className="py-2 px-2.5">
                              <span className="font-medium text-[#3c1e96]">{b.type}</span> · {b.title}
                            </td>
                            <td className="py-2 px-2.5 text-slate-600">{b.period}</td>
                            <td className="py-2 px-2.5 text-right font-mono">Rp {b.amount.toLocaleString('id-ID')}</td>
                            <td className="py-2 px-2.5 text-right font-mono text-[#2bc155]">
                              Rp {b.paidAmount.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-red-600">
                              Rp {rem.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2.5">
                              <span
                                className={`font-semibold ${
                                  b.status === 'Lunas'
                                    ? 'text-[#2bc155]'
                                    : b.status === 'Cicilan'
                                    ? 'text-amber-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {b.status}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-right no-print">
                              {st && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    exportStudentBillsPDF({
                                      student: st,
                                      classRoom: cls,
                                      settings: db.settings,
                                      bills: db.bills,
                                    });
                                    showToast(`PDF Rekap Tunggakan (${st.name}) berhasil diunduh`);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full bg-[#3c1e96] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#4e36e2] cursor-pointer"
                                  title="Download Surat PDF Rekap Tunggakan Siswa untuk Orang Tua"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>PDF Orang Tua</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#f3f2f8] font-bold text-[#1f1b38] border-t-2 border-slate-300">
                        <td colSpan={6} className="py-2.5 px-2.5 text-right">
                          TOTAL REKAPITULASI TUNGGAKAN & PEMBAYARAN
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono">
                          Rp {totalNominal.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-[#2bc155]">
                          Rp {totalPaid.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-red-600">
                          Rp {totalRemaining.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-2.5" />
                        <td className="py-2.5 px-2.5 no-print" />
                      </tr>
                    </tfoot>
                  </table>
                </>
              );
            })()}
          </div>
        ) : reportType === 'harian' ? (
          <div className="overflow-x-auto">
            <div className="mb-3">
              <h4 className="text-[14px] font-bold text-[#1f1b38] uppercase">
                Laporan Kehadiran Harian Siswa
              </h4>
              <p className="text-[11.5px] text-slate-500">
                Tanggal Absensi: <span className="font-mono font-semibold text-[#3c1e96]">{selectedDate}</span> · Jumlah Siswa:{' '}
                <strong>{studentRecapRows.length} Siswa</strong>
              </p>
            </div>
            <table className="print-table w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-slate-200 bg-[#f3f2f8] text-slate-700">
                  <th className="py-2.5 px-2.5 font-bold">No</th>
                  <th className="py-2.5 px-2.5 font-bold">NIS</th>
                  <th className="py-2.5 px-2.5 font-bold">Nama Lengkap Siswa</th>
                  <th className="py-2.5 px-2.5 font-bold">Kelas</th>
                  <th className="py-2.5 px-2.5 font-bold">Status Kehadiran ({selectedDate})</th>
                  <th className="py-2.5 px-2.5 font-bold">Jam Masuk</th>
                  <th className="py-2.5 px-2.5 font-bold">Keterangan / Alasan</th>
                  <th className="py-2.5 px-2.5 font-bold">Dicatat Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {studentRecapRows.map((r, idx) => (
                  <tr key={r.student.id} className="hover:bg-indigo-50/30">
                    <td className="py-2 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-2.5 font-mono text-slate-600">{r.student.nis}</td>
                    <td className="py-2 px-2.5 font-semibold text-[#1f1b38]">{r.student.name}</td>
                    <td className="py-2 px-2.5 text-slate-600">{r.className}</td>
                    <td className="py-2 px-2.5">
                      <span
                        className={`font-semibold ${
                          r.todayStatus === 'Hadir'
                            ? 'text-[#2bc155]'
                            : r.todayStatus === 'Terlambat'
                            ? 'text-amber-600'
                            : r.todayStatus === 'Alpa'
                            ? 'text-red-600'
                            : r.todayStatus === 'Belum'
                            ? 'text-slate-400'
                            : 'text-[#48a9f8]'
                        }`}
                      >
                        {r.todayStatus}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-mono text-slate-600">{r.todayTime}</td>
                    <td className="py-2 px-2.5 text-slate-600">{r.todayNote}</td>
                    <td className="py-2 px-2.5 text-slate-500">{r.todayRecordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : reportType === 'mingguan' ? (
          <div className="overflow-x-auto">
            <div className="mb-3">
              <h4 className="text-[14px] font-bold text-[#1f1b38] uppercase">
                Laporan Matriks Kehadiran Mingguan Siswa (Senin s.d Sabtu)
              </h4>
              <p className="text-[11.5px] text-slate-500">
                Rentang Minggu: <span className="font-mono font-semibold text-[#3c1e96]">{weekRangeLabel}</span> · Jumlah Siswa:{' '}
                <strong>{studentRecapRows.length} Siswa</strong>
              </p>
            </div>
            <table className="print-table w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-slate-200 bg-[#f3f2f8] text-slate-700">
                  <th className="py-2.5 px-2 font-bold">No</th>
                  <th className="py-2.5 px-2 font-bold">NIS</th>
                  <th className="py-2.5 px-2.5 font-bold">Nama Lengkap Siswa</th>
                  <th className="py-2.5 px-2 font-bold">Kelas</th>
                  {weekDates.map((wd) => (
                    <th key={wd.dateStr} className="py-2.5 px-2 font-bold text-center font-mono text-[11px]">
                      {wd.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-2 font-bold text-right">H</th>
                  <th className="py-2.5 px-2 font-bold text-right">T</th>
                  <th className="py-2.5 px-2 font-bold text-right">I</th>
                  <th className="py-2.5 px-2 font-bold text-right">S</th>
                  <th className="py-2.5 px-2 font-bold text-right">A</th>
                  <th className="py-2.5 px-2 font-bold text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {studentRecapRows.map((r, idx) => (
                  <tr key={r.student.id} className="hover:bg-indigo-50/30">
                    <td className="py-2 px-2 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-2 font-mono text-slate-600">{r.student.nis}</td>
                    <td className="py-2 px-2.5 font-semibold text-[#1f1b38]">{r.student.name}</td>
                    <td className="py-2 px-2 text-slate-600">{r.className}</td>
                    {r.weeklyStatuses.map((stCode, i) => (
                      <td
                        key={i}
                        className={`py-2 px-2 text-center font-mono font-bold ${
                          stCode === 'H'
                            ? 'text-[#2bc155]'
                            : stCode === 'T'
                            ? 'text-amber-600'
                            : stCode === 'A'
                            ? 'text-red-600'
                            : stCode === '-'
                            ? 'text-slate-300'
                            : 'text-[#48a9f8]'
                        }`}
                      >
                        {stCode}
                      </td>
                    ))}
                    <td className="py-2 px-2 text-right font-mono text-[#2bc155]">{r.hadir}</td>
                    <td className="py-2 px-2 text-right font-mono text-amber-600">{r.terlambat}</td>
                    <td className="py-2 px-2 text-right font-mono text-[#48a9f8]">{r.izin}</td>
                    <td className="py-2 px-2 text-right font-mono text-[#4e36e2]">{r.sakit}</td>
                    <td className="py-2 px-2 text-right font-mono text-red-600">{r.alpa}</td>
                    <td className="py-2 px-2 text-right font-mono font-semibold text-[#1f1b38]">{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="mb-3">
              <h4 className="text-[14px] font-bold text-[#1f1b38] uppercase">
                {reportType === 'bulanan'
                  ? `Laporan Rekapitulasi Kehadiran Bulanan Siswa (Periode ${selectedMonth})`
                  : 'Laporan Akumulasi Kehadiran & Catatan Per Siswa (Semester)'}
              </h4>
              <p className="text-[11.5px] text-slate-500">
                Periode Bulan: <span className="font-mono font-semibold text-[#3c1e96]">{selectedMonth}</span> · Jumlah Siswa:{' '}
                <strong>{studentRecapRows.length} Siswa</strong>
              </p>
            </div>
            <table className="print-table w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-slate-200 bg-[#f3f2f8] text-slate-700">
                  <th className="py-2.5 px-2.5 font-bold">No</th>
                  <th className="py-2.5 px-2.5 font-bold">NIS / NISN</th>
                  <th className="py-2.5 px-2.5 font-bold">Nama Lengkap Siswa</th>
                  <th className="py-2.5 px-2.5 font-bold">Kelas</th>
                  {reportType === 'per_siswa' && <th className="py-2.5 px-2.5 font-bold">Orang Tua / Wali</th>}
                  <th className="py-2.5 px-2.5 font-bold text-right">Hadir (H)</th>
                  <th className="py-2.5 px-2.5 font-bold text-right">Terlambat (T)</th>
                  <th className="py-2.5 px-2.5 font-bold text-right">Izin (I)</th>
                  <th className="py-2.5 px-2.5 font-bold text-right">Sakit (S)</th>
                  <th className="py-2.5 px-2.5 font-bold text-right">Alpa (A)</th>
                  <th className="py-2.5 px-2.5 font-bold text-right">
                    {reportType === 'per_siswa' ? 'Catatan Siswa' : 'Total Hari'}
                  </th>
                  <th className="py-2.5 px-2.5 font-bold text-right">Kehadiran (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {studentRecapRows.map((r, idx) => (
                  <tr key={r.student.id} className="hover:bg-indigo-50/30">
                    <td className="py-2 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-2.5 font-mono text-slate-600">
                      {r.student.nis}
                      {r.student.nisn ? <span className="block text-[10px] text-slate-400">{r.student.nisn}</span> : null}
                    </td>
                    <td className="py-2 px-2.5 font-semibold text-[#1f1b38]">{r.student.name}</td>
                    <td className="py-2 px-2.5 text-slate-600">{r.className}</td>
                    {reportType === 'per_siswa' && (
                      <td className="py-2 px-2.5 text-slate-600">{r.student.parentName || '-'}</td>
                    )}
                    <td className="py-2 px-2.5 text-right font-mono text-[#2bc155] font-semibold">{r.hadir}</td>
                    <td className="py-2 px-2.5 text-right font-mono text-amber-600">{r.terlambat}</td>
                    <td className="py-2 px-2.5 text-right font-mono text-[#48a9f8]">{r.izin}</td>
                    <td className="py-2 px-2.5 text-right font-mono text-[#4e36e2]">{r.sakit}</td>
                    <td className="py-2 px-2.5 text-right font-mono text-red-600">{r.alpa}</td>
                    <td className="py-2 px-2.5 text-right font-mono text-slate-600">
                      {reportType === 'per_siswa' ? `${r.studentNotesCount} Catatan` : `${r.totalRecorded} Hari`}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-semibold text-[#1f1b38]">{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signature Block for Print / PDF */}
        <div className="print-signature mt-6 pt-4 border-t border-slate-200 flex justify-between text-[12px] text-slate-700">
          <div>
            <p>Mengetahui,</p>
            <p className="font-semibold text-[#1f1b38]">Kepala Madrasah</p>
            <div className="h-14" />
            <p className="font-bold underline text-[#1f1b38]">{db.settings.headmasterName}</p>
            <p className="font-mono text-[11px]">NIP. {db.settings.headmasterNip}</p>
          </div>
          <div className="text-right">
            <p>Dicetak pada {selectedDate}</p>
            <p className="font-semibold text-[#1f1b38]">Petugas Administrasi / Wali Kelas</p>
            <div className="h-14" />
            <p className="font-bold underline text-[#1f1b38]">Tim Tata Usaha MI</p>
          </div>
        </div>
      </div>
    </div>
  );
};
