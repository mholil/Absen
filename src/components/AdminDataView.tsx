import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  QrCode,
  Download,
  Upload,
  Eye,
  X,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { AppDatabase, Student, ClassRoom, User, BillType, Role } from '../types';
import {
  exportToExcelXML,
  exportToCSV,
  exportStudentBillsPDF,
  exportBillsRecapReportPDF,
} from '../utils/exportUtils';
import { buildStudentWhatsAppPayload } from '../utils/whatsappUtils';
import { WhatsAppPreviewModal, WhatsAppPayload } from './WhatsAppPreviewModal';

interface AdminDataViewProps {
  db: AppDatabase;
  onAddStudentClick: () => void;
  onEditStudentClick: (student: Student) => void;
  onDeleteStudent: (id: string) => Promise<void>;
  onSelectStudentDetail: (student: Student) => void;
  onShowQR: (student: Student) => void;
  onSaveClass: (payload: Partial<ClassRoom>) => Promise<void>;
  onDeleteClass: (id: string) => Promise<void>;
  onSaveUser: (payload: Partial<User> & { password?: string }) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onAddBill: (payload: {
    studentId: string;
    type: BillType;
    title: string;
    amount: number;
    period: string;
    dueDate: string;
    note: string;
  }) => Promise<void>;
  onPayBill: (
    billId: string,
    payload: { amount: number; date: string; method: 'Tunai' | 'Transfer' | 'QRIS'; note: string }
  ) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
  onImportStudents: (students: Partial<Student>[]) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type DataSubTab = 'siswa' | 'guru_staf' | 'kelas' | 'akun' | 'tunggakan';

export const AdminDataView: React.FC<AdminDataViewProps> = ({
  db,
  onAddStudentClick,
  onEditStudentClick,
  onDeleteStudent,
  onSelectStudentDetail,
  onShowQR,
  onSaveClass,
  onDeleteClass,
  onSaveUser,
  onDeleteUser,
  onAddBill,
  onPayBill,
  onDeleteBill,
  onImportStudents,
  showToast,
}) => {
  const [subTab, setSubTab] = useState<DataSubTab>('siswa');
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<{ type: 'student' | 'class' | 'user' | 'bill'; id: string; name: string } | null>(null);
  const [waModalPayload, setWaModalPayload] = useState<WhatsAppPayload | null>(null);

  // Class Modal State
  const [editingClass, setEditingClass] = useState<Partial<ClassRoom> | null>(null);

  // User/Guru Modal State
  const [editingUser, setEditingUser] = useState<(Partial<User> & { password?: string }) | null>(null);

  // Bill Modal State
  const [isAddingBill, setIsAddingBill] = useState(false);
  const [billStudentId, setBillStudentId] = useState(db.students[0]?.id || '');
  const [billType, setBillType] = useState<BillType>('SPP');
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('75000');
  const [billPeriod, setBillPeriod] = useState('Oktober 2026');
  const [billDueDate, setBillDueDate] = useState(() => new Date().toISOString().slice(0, 10));

  const filteredStudents = useMemo(() => {
    return db.students.filter((s) => {
      if (classFilter !== 'ALL' && s.classId !== classFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q) ||
          (s.nisn && s.nisn.toLowerCase().includes(q)) ||
          (s.parentName && s.parentName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [db.students, classFilter, searchQuery]);

  const handleExportStudents = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const headers = ['NIS', 'NISN', 'Nama Lengkap', 'L/P', 'Kelas', 'Orang Tua / Wali', 'No HP', 'Pekerjaan', 'Alamat', 'Kode QR'];
    const rows = filteredStudents.map((s) => {
      const cls = db.classes.find((c) => c.id === s.classId);
      return [
        s.nis,
        s.nisn || '-',
        s.name,
        s.gender,
        cls?.name || s.classId,
        s.parentName || '-',
        s.parentPhone || '-',
        s.parentJob || '-',
        s.address || '-',
        s.qrCode,
      ];
    });
    if (format === 'csv') {
      exportToCSV('Data_Siswa_MI', headers, rows);
      showToast('Data siswa berhasil diekspor ke CSV (.csv)');
    } else {
      exportToExcelXML('Data_Siswa_MI', 'Data Siswa', headers, rows);
      showToast('Data siswa berhasil diekspor ke Excel (.xlsx)');
    }
  };

  const handleExportUsers = () => {
    const headers = ['Nama Lengkap', 'Username', 'NIP / NUPTK', 'Jabatan', 'Role Sistem', 'No HP', 'Status'];
    const rows = db.users.map((u) => [u.name, u.username, u.nip, u.position, u.role, u.phone, u.status]);
    exportToExcelXML('Data_Guru_Staf_MI', 'Guru Staf', headers, rows);
    showToast('Data Guru & Staf berhasil diekspor ke Excel (.xlsx)');
  };

  const handleExportBills = () => {
    const headers = ['Nama Siswa', 'NIS', 'Jenis Tagihan', 'Rincian', 'Periode', 'Nominal (Rp)', 'Terbayar (Rp)', 'Sisa (Rp)', 'Status'];
    const rows = db.bills.map((b) => {
      const st = db.students.find((s) => s.id === b.studentId);
      const rem = Math.max(0, b.amount - b.paidAmount);
      return [st?.name || b.studentId, st?.nis || '-', b.type, b.title, b.period, b.amount, b.paidAmount, rem, b.status];
    });
    exportToExcelXML('Data_Tunggakan_SPP_MI', 'Tunggakan SPP', headers, rows);
    showToast('Data Tunggakan & SPP berhasil diekspor ke Excel (.xlsx)');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          const imported: Partial<Student>[] = [];
          rows.slice(1).forEach((cols) => {
            if (cols && cols[0] && cols[2]) {
              imported.push({
                nis: String(cols[0]).trim(),
                nisn: String(cols[1] || '').trim(),
                name: String(cols[2]).trim(),
                gender: String(cols[3] || 'L').toUpperCase() === 'P' ? 'P' : 'L',
                classId: db.classes[0]?.id || 'kls-1a',
                parentName: String(cols[5] || 'Wali Murid').trim(),
                parentPhone: String(cols[6] || '-').trim(),
                parentJob: String(cols[7] || '-').trim(),
                address: String(cols[8] || '-').trim(),
              });
            }
          });
          if (!imported.length) {
            showToast('File Excel kosong atau format kolom tidak sesuai', 'error');
            return;
          }
          await onImportStudents(imported);
          showToast(`${imported.length} siswa berhasil diimpor dari Excel`);
        } catch {
          showToast('Gagal membaca file Excel (.xlsx)', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = String(ev.target?.result || '');
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : parsed.students || [];
          if (!list.length) {
            showToast('Tidak ada data siswa di dalam file JSON', 'error');
            return;
          }
          await onImportStudents(list);
          showToast(`${list.length} siswa berhasil diimpor dari JSON`);
        } else {
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          const imported: Partial<Student>[] = [];
          lines.slice(1).forEach((line) => {
            const cols = line.split(/[,;]/).map((c) => c.replace(/^"|"$/g, '').trim());
            if (cols[0] && cols[1]) {
              imported.push({
                nis: cols[0],
                name: cols[2] || cols[1],
                gender: cols[3] === 'P' || cols[2] === 'P' ? 'P' : 'L',
                classId: db.classes[0]?.id || 'kls-1a',
                parentName: cols[5] || cols[3] || 'Wali Murid',
                parentPhone: cols[6] || cols[4] || '-',
              });
            }
          });
          if (!imported.length) {
            showToast('Format CSV kosong atau tidak sesuai', 'error');
            return;
          }
          await onImportStudents(imported);
          showToast(`${imported.length} siswa berhasil diimpor dari CSV`);
        }
      } catch {
        showToast('Gagal mengimpor file. Gunakan file Excel (.xlsx), CSV, atau JSON.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeConfirmedDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      if (confirmDeleteId.type === 'student') await onDeleteStudent(confirmDeleteId.id);
      if (confirmDeleteId.type === 'class') await onDeleteClass(confirmDeleteId.id);
      if (confirmDeleteId.type === 'user') await onDeleteUser(confirmDeleteId.id);
      if (confirmDeleteId.type === 'bill') await onDeleteBill(confirmDeleteId.id);
      showToast(`${confirmDeleteId.name} berhasil dihapus`);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus data', 'error');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="neu-card rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Unified Top Toolbar: Sub-tabs + Search/Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5">
        <div className="inline-flex items-center gap-1 overflow-x-auto rounded-xl bg-[#f3f2f8] p-1">
          {[
            { id: 'siswa', label: `Siswa (${db.students.length})` },
            { id: 'guru_staf', label: `Guru (${db.users.length})` },
            { id: 'kelas', label: `Kelas (${db.classes.length})` },
            { id: 'akun', label: 'Akun' },
            { id: 'tunggakan', label: `SPP (${db.bills.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as DataSubTab)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                subTab === t.id
                  ? 'bg-[#3c1e96] text-white'
                  : 'text-slate-600 hover:text-[#1f1b38]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari data..."
              className="w-full rounded-xl border border-slate-200 bg-[#f3f2f8] pl-8 pr-3 py-1.5 text-[12px] focus:bg-white focus:border-[#4e36e2] focus:outline-none"
            />
          </div>
          {subTab === 'siswa' && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-[#f3f2f8] px-3 py-1.5 text-[12px] focus:bg-white focus:border-[#4e36e2] focus:outline-none"
            >
              <option value="ALL">Semua Kelas</option>
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 1. TAB SISWA */}
      {subTab === 'siswa' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-[#1f1b38]">Daftar Siswa Madrasah</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <label className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-[#1f1b38] hover:bg-slate-50 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#2bc155]" />
                <span>Import</span>
                <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={handleImportFile} className="hidden" />
              </label>
              <button
                onClick={() => handleExportStudents('xlsx')}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-[#1f1b38] hover:bg-slate-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#4e36e2]" />
                <span>Excel</span>
              </button>
              <button
                onClick={onAddStudentClick}
                className="flex items-center gap-1 rounded-xl bg-[#3c1e96] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4e36e2] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Siswa</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3 font-semibold">NIS</th>
                  <th className="py-2.5 px-3 font-semibold">Nama Siswa</th>
                  <th className="py-2.5 px-3 font-semibold">Kelas</th>
                  <th className="py-2.5 px-3 font-semibold">Orang Tua / Wali</th>
                  <th className="py-2.5 px-3 font-semibold">No. HP</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st) => {
                  const cls = db.classes.find((c) => c.id === st.classId);
                  return (
                    <tr key={st.id} className="hover:bg-indigo-50/30">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{st.nis}</td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => onSelectStudentDetail(st)}
                          className="font-semibold text-[#1f1b38] hover:text-[#4e36e2] text-left cursor-pointer"
                        >
                          {st.name}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{cls?.name || st.classId}</td>
                      <td className="py-2.5 px-3 text-slate-600">{st.parentName || '-'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{st.parentPhone || '-'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const payload = buildStudentWhatsAppPayload({
                                student: st,
                                classRoom: cls,
                                schoolName: db.settings.schoolName,
                                attendance: db.attendance,
                                notes: db.notes,
                                bills: db.bills,
                              });
                              if (!payload) {
                                showToast('Nomor HP orang tua belum diisi', 'error');
                                return;
                              }
                              setWaModalPayload(payload);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-[#2bc155] hover:bg-[#2bc155] hover:text-white transition-colors cursor-pointer"
                            title="Kirim WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA</span>
                          </button>
                          <button
                            onClick={() => onShowQR(st)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-[#3c1e96] hover:bg-indigo-50 cursor-pointer"
                            title="Kartu QR Siswa"
                          >
                            QR
                          </button>
                          <button
                            onClick={() => onEditStudentClick(st)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            title="Edit Siswa"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId({ type: 'student', id: st.id, name: st.name })}
                            className="rounded-lg border border-slate-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2 & 4. TAB GURU/STAF & AKUN PENGGUNA */}
      {(subTab === 'guru_staf' || subTab === 'akun') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[#1f1b38]">
              {subTab === 'guru_staf' ? 'Daftar Guru & Staf' : 'Akun Pengguna Sistem'}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportUsers}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-[#1f1b38] hover:bg-slate-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#4e36e2]" />
                <span>Excel</span>
              </button>
              <button
                onClick={() =>
                  setEditingUser({
                    username: '',
                    name: '',
                    nip: '',
                    role: 'wali_kelas',
                    classId: db.classes[0]?.id || 'kls-1a',
                    phone: '',
                    position: 'Wali Kelas',
                    status: 'aktif',
                    password: '',
                  })
                }
                className="flex items-center gap-1 rounded-xl bg-[#3c1e96] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4e36e2] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Akun</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3 font-semibold">Nama Lengkap</th>
                  <th className="py-2.5 px-3 font-semibold">Username</th>
                  <th className="py-2.5 px-3 font-semibold">Jabatan</th>
                  <th className="py-2.5 px-3 font-semibold">Role</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.users
                  .filter(
                    (u) =>
                      !searchQuery.trim() ||
                      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      u.username.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((u) => {
                    const cls = db.classes.find((c) => c.id === u.classId);
                    return (
                      <tr key={u.id} className="hover:bg-indigo-50/30">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-[#1f1b38]">{u.name}</span>
                          {u.nip && <span className="block font-mono text-[10.5px] text-slate-400">NIP {u.nip}</span>}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-[#4e36e2]">{u.username}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {u.position} {cls ? `(${cls.name})` : ''}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{u.role}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setEditingUser({ ...u, password: '' })}
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                              title="Edit Akun"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {u.username !== 'admin' && (
                              <button
                                onClick={() => setConfirmDeleteId({ type: 'user', id: u.id, name: u.name })}
                                className="rounded-lg border border-slate-200 p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                                title="Hapus Akun"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TAB KELAS */}
      {subTab === 'kelas' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[#1f1b38]">Daftar Kelas</h3>
            <button
              onClick={() =>
                setEditingClass({
                  name: '',
                  level: 1,
                  homeroomTeacherId: db.users[0]?.id || '',
                  roomNumber: 'R.07',
                  academicYear: db.settings.academicYear,
                })
              }
              className="flex items-center gap-1 rounded-xl bg-[#3c1e96] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4e36e2] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Kelas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {db.classes.map((cls) => {
              const wali = db.users.find((u) => u.id === cls.homeroomTeacherId);
              const count = db.students.filter((s) => s.classId === cls.id).length;
              return (
                <div key={cls.id} className="rounded-xl border border-slate-200/80 p-3.5 bg-[#f3f2f8] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-bold text-[#1f1b38]">{cls.name}</h4>
                    <p className="text-[11.5px] text-slate-500 truncate">
                      Wali: {wali?.name || '-'} · <span className="font-mono font-semibold text-[#3c1e96]">{count}</span> siswa
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingClass(cls)}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer"
                      title="Edit Kelas"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId({ type: 'class', id: cls.id, name: cls.name })}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                      title="Hapus Kelas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB TUNGGAKAN & SPP SEKOLAH */}
      {subTab === 'tunggakan' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-[#1f1b38]">Tagihan & SPP Siswa</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={handleExportBills}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-[#1f1b38] hover:bg-slate-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#4e36e2]" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => {
                  exportBillsRecapReportPDF({
                    filename: 'Laporan_Rekap_Tunggakan_SPP_MI',
                    title: 'Rekapitulasi Administrasi Tagihan & Tunggakan Siswa Madrasah',
                    settings: db.settings,
                    bills: db.bills,
                    students: db.students,
                    classes: db.classes,
                  });
                  showToast('Laporan PDF Rekap Tunggakan berhasil diunduh');
                }}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-[#1f1b38] hover:bg-slate-50 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#3c1e96]" />
                <span>PDF Rekap</span>
              </button>
              <button
                onClick={() => setIsAddingBill(!isAddingBill)}
                className="flex items-center gap-1 rounded-xl bg-[#3c1e96] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4e36e2] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Tagihan</span>
              </button>
            </div>
          </div>

          {isAddingBill && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onAddBill({
                  studentId: billStudentId,
                  type: billType,
                  title: billTitle.trim() || `${billType} - ${billPeriod}`,
                  amount: Number(billAmount) || 0,
                  period: billPeriod,
                  dueDate: billDueDate,
                  note: '',
                });
                setIsAddingBill(false);
                setBillTitle('');
                showToast('Tagihan berhasil ditambahkan');
              }}
              className="rounded-xl border border-slate-200 bg-[#f3f2f8] p-3 grid grid-cols-1 sm:grid-cols-5 gap-2"
            >
              <select
                value={billStudentId}
                onChange={(e) => setBillStudentId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
              >
                {db.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.nis})
                  </option>
                ))}
              </select>
              <select
                value={billType}
                onChange={(e) => setBillType(e.target.value as BillType)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
              >
                <option value="SPP">SPP</option>
                <option value="Kegiatan">Kegiatan</option>
                <option value="Seragam">Seragam</option>
                <option value="Buku">Buku</option>
                <option value="Lainnya">Lainnya</option>
              </select>
              <input
                type="number"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="Nominal Rp"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-mono"
                required
              />
              <input
                type="text"
                value={billPeriod}
                onChange={(e) => setBillPeriod(e.target.value)}
                placeholder="Periode (Oktober 2026)"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
                required
              />
              <button
                type="submit"
                className="rounded-lg bg-[#2bc155] px-3 py-1.5 text-[12px] font-semibold text-white cursor-pointer"
              >
                Simpan
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3 font-semibold">Siswa</th>
                  <th className="py-2.5 px-3 font-semibold">Tagihan</th>
                  <th className="py-2.5 px-3 font-semibold">Periode</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Nominal</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.bills.map((b) => {
                  const st = db.students.find((s) => s.id === b.studentId);
                  const rem = Math.max(0, b.amount - b.paidAmount);
                  return (
                    <tr key={b.id} className="hover:bg-indigo-50/30">
                      <td className="py-2.5 px-3 font-semibold text-[#1f1b38]">{st?.name || b.studentId}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-[#4e36e2]">{b.type}</span> · {b.title}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{b.period}</td>
                      <td className="py-2.5 px-3 text-right font-mono">Rp {b.amount.toLocaleString('id-ID')}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            b.status === 'Lunas'
                              ? 'text-[#2bc155]'
                              : b.status === 'Cicilan'
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {st && (
                            <button
                              type="button"
                              onClick={() => {
                                const cls = db.classes.find((c) => c.id === st.classId);
                                exportStudentBillsPDF({
                                  student: st,
                                  classRoom: cls,
                                  settings: db.settings,
                                  bills: db.bills,
                                });
                                showToast(`PDF Rekap Tunggakan ${st.name} berhasil diunduh`);
                              }}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-[#3c1e96] hover:bg-indigo-50 cursor-pointer"
                            >
                              PDF
                            </button>
                          )}
                          {b.status !== 'Lunas' && st && (
                            <button
                              type="button"
                              onClick={() => {
                                const cls = db.classes.find((c) => c.id === st.classId);
                                const payload = buildStudentWhatsAppPayload({
                                  student: st,
                                  classRoom: cls,
                                  schoolName: db.settings.schoolName,
                                  attendance: db.attendance,
                                  notes: db.notes,
                                  bills: db.bills,
                                  customFocusBill: b,
                                });
                                if (!payload) {
                                  showToast('Nomor HP orang tua belum diisi', 'error');
                                  return;
                                }
                                setWaModalPayload(payload);
                              }}
                              className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-[#2bc155] hover:bg-[#2bc155] hover:text-white transition-colors cursor-pointer"
                            >
                              WA
                            </button>
                          )}
                          {b.status !== 'Lunas' && (
                            <button
                              onClick={async () => {
                                await onPayBill(b.id, {
                                  amount: rem,
                                  date: new Date().toISOString().slice(0, 10),
                                  method: 'Tunai',
                                  note: 'Pelunasan TU',
                                });
                                showToast('Tagihan ditandai Lunas');
                              }}
                              className="rounded-lg bg-[#2bc155] px-2.5 py-1 text-[11px] font-medium text-white cursor-pointer"
                            >
                              Lunasi
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDeleteId({ type: 'bill', id: b.id, name: b.title })}
                            className="rounded-lg border border-slate-200 p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Edit / Tambah Kelas */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onSaveClass(editingClass);
              setEditingClass(null);
              showToast('Data kelas berhasil disimpan');
            }}
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-[15px] font-bold text-[#1f1b38]">
                {editingClass.id ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
              </h4>
              <button type="button" onClick={() => setEditingClass(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Nama Kelas (Contoh: Kelas 1B)</label>
              <input
                type="text"
                value={editingClass.name || ''}
                onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">Tingkat (1-6)</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={editingClass.level || 1}
                  onChange={(e) => setEditingClass({ ...editingClass, level: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">Nomor Ruang</label>
                <input
                  type="text"
                  value={editingClass.roomNumber || ''}
                  onChange={(e) => setEditingClass({ ...editingClass, roomNumber: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Wali Kelas</label>
              <select
                value={editingClass.homeroomTeacherId || ''}
                onChange={(e) => setEditingClass({ ...editingClass, homeroomTeacherId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]"
              >
                {db.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="rounded-xl border border-slate-300 px-4 py-1.5 text-[12px]"
              >
                Batal
              </button>
              <button type="submit" className="rounded-xl bg-[#3c1e96] px-4 py-1.5 text-[12px] font-medium text-white">
                Simpan Kelas
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Edit / Tambah Guru & Akun Pengguna */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onSaveUser(editingUser);
              setEditingUser(null);
              showToast('Data akun guru/staf berhasil disimpan');
            }}
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl space-y-3 max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-[15px] font-bold text-[#1f1b38]">
                {editingUser.id ? 'Edit Akun Guru / Staf' : 'Tambah Guru / Akun Pengguna'}
              </h4>
              <button type="button" onClick={() => setEditingUser(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Nama Lengkap & Gelar *</label>
              <input
                type="text"
                value={editingUser.name || ''}
                onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">Username Login *</label>
                <input
                  type="text"
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">
                  {editingUser.id ? 'Password Baru (Opsional)' : 'Password Awal *'}
                </label>
                <input
                  type="password"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  placeholder={editingUser.id ? 'Kosongkan jika tetap' : 'Min 4 karakter'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                  required={!editingUser.id}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">Role Hak Akses</label>
                <select
                  value={editingUser.role || 'wali_kelas'}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as Role })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]"
                >
                  <option value="admin">Admin Madrasah</option>
                  <option value="kepala_sekolah">Kepala Sekolah</option>
                  <option value="wali_kelas">Wali Kelas</option>
                  <option value="guru_piket">Guru Piket</option>
                </select>
              </div>
              {editingUser.role === 'wali_kelas' && (
                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1">Kelas Diampu</label>
                  <select
                    value={editingUser.classId || db.classes[0]?.id}
                    onChange={(e) => setEditingUser({ ...editingUser, classId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]"
                  >
                    {db.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">NIP / NUPTK</label>
                <input
                  type="text"
                  value={editingUser.nip || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, nip: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">Nomor HP</label>
                <input
                  type="text"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Jabatan</label>
              <input
                type="text"
                value={editingUser.position || ''}
                onChange={(e) => setEditingUser({ ...editingUser, position: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-xl border border-slate-300 px-4 py-1.5 text-[12px]"
              >
                Batal
              </button>
              <button type="submit" className="rounded-xl bg-[#3c1e96] px-4 py-1.5 text-[12px] font-medium text-white">
                Simpan Akun
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl space-y-3">
            <h4 className="text-[15px] font-bold text-[#1f1b38]">Konfirmasi Penghapusan</h4>
            <p className="text-[13px] text-slate-600">
              Apakah Anda yakin ingin menghapus <strong>{confirmDeleteId.name}</strong>? Riwayat arsip absensi tetap terjaga.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-xl border border-slate-300 px-4 py-1.5 text-[12px] font-medium text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={executeConfirmedDelete}
                className="rounded-xl bg-red-600 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-red-700 cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <WhatsAppPreviewModal
        payload={waModalPayload}
        onClose={() => setWaModalPayload(null)}
        showToast={showToast}
      />
    </div>
  );
};
