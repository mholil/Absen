import React, { useState } from 'react';
import {
  X,
  Plus,
  QrCode,
  FileText,
  Receipt,
  Phone,
  MapPin,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import {
  Student,
  ClassRoom,
  StudentNote,
  Bill,
  Payment,
  NoteType,
  BillType,
  AttendanceRecord,
  SchoolSettings,
} from '../types';
import { buildStudentWhatsAppPayload } from '../utils/whatsappUtils';
import { exportStudentBillsPDF } from '../utils/exportUtils';
import { WhatsAppPreviewModal, WhatsAppPayload } from './WhatsAppPreviewModal';

interface StudentDetailModalProps {
  student: Student | null;
  classRoom?: ClassRoom;
  schoolName?: string;
  settings?: SchoolSettings;
  notes: StudentNote[];
  bills: Bill[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  canManage: boolean;
  onClose: () => void;
  onEditStudent: (student: Student) => void;
  onShowQR: (student: Student) => void;
  onAddNote: (payload: {
    studentId: string;
    type: NoteType;
    content: string;
    date: string;
    forwardToBK: boolean;
  }) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
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
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  classRoom,
  schoolName = 'MI Nurul Huda Nusantara',
  settings,
  notes,
  bills,
  payments,
  attendance,
  canManage,
  onClose,
  onEditStudent,
  onShowQR,
  onAddNote,
  onDeleteNote,
  onAddBill,
  onPayBill,
  showToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'profil' | 'catatan' | 'tunggakan'>('profil');
  const [waModalPayload, setWaModalPayload] = useState<WhatsAppPayload | null>(null);

  // Sub-modal for adding Catatan / Prestasi / Pelanggaran
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>('Catatan');
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [forwardToBK, setForwardToBK] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);

  // Sub-modal for adding Tagihan
  const [isBillFormOpen, setIsBillFormOpen] = useState(false);
  const [billType, setBillType] = useState<BillType>('SPP');
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('75000');
  const [billPeriod, setBillPeriod] = useState('Oktober 2026');
  const [billDueDate, setBillDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billNote, setBillNote] = useState('');

  // Sub-modal for paying Tagihan
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Tunai' | 'Transfer' | 'QRIS'>('Tunai');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState('');

  if (!student) return null;

  const studentNotes = notes.filter((n) => n.studentId === student.id);
  const studentBills = bills.filter((b) => b.studentId === student.id);
  const studentAtt = attendance.filter((a) => a.studentId === student.id);

  const hadirCount = studentAtt.filter((a) => a.status === 'Hadir').length;
  const terlambatCount = studentAtt.filter((a) => a.status === 'Terlambat').length;
  const izinCount = studentAtt.filter((a) => a.status === 'Izin').length;
  const sakitCount = studentAtt.filter((a) => a.status === 'Sakit').length;
  const alpaCount = studentAtt.filter((a) => a.status === 'Alpa').length;

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      showToast('Isi catatan wajib diisi', 'error');
      return;
    }
    setSubmittingNote(true);
    try {
      await onAddNote({
        studentId: student.id,
        type: noteType,
        content: noteContent.trim(),
        date: noteDate,
        forwardToBK,
      });
      // Close note form, return to student profile/notes view, show notification
      setIsNoteFormOpen(false);
      setNoteContent('');
      setForwardToBK(false);
      showToast(`Catatan ${noteType} untuk ${student.name} berhasil disimpan`);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan catatan', 'error');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onAddBill({
        studentId: student.id,
        type: billType,
        title: billTitle.trim() || `${billType} - ${billPeriod}`,
        amount: Number(billAmount) || 0,
        period: billPeriod,
        dueDate: billDueDate,
        note: billNote,
      });
      setIsBillFormOpen(false);
      setBillTitle('');
      showToast('Data tagihan siswa berhasil ditambahkan');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan tagihan', 'error');
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    try {
      await onPayBill(payingBill.id, {
        amount: Number(payAmount) || 0,
        date: payDate,
        method: payMethod,
        note: payNote,
      });
      setPayingBill(null);
      setPayAmount('');
      setPayNote('');
      showToast('Pembayaran tagihan berhasil dicatat');
    } catch (err: any) {
      showToast(err.message || 'Gagal mencatat pembayaran', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl border border-indigo-100 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-[#f3f2f8]">
          <div className="min-w-0 pr-2">
            <h2 className="text-[16px] font-bold text-[#1f1b38] truncate">{student.name}</h2>
            <p className="text-[12px] text-slate-500">
              {classRoom?.name || student.classId} · NIS: <span className="font-mono">{student.nis}</span> · NISN:{' '}
              <span className="font-mono">{student.nisn || '-'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer shrink-0"
            title="Tutup Profil Siswa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-navigation inside Student Profile */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5 bg-white shrink-0">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'profil', label: 'Biodata & Kehadiran' },
              { id: 'catatan', label: `Catatan Siswa (${studentNotes.length})` },
              { id: 'tunggakan', label: `Tunggakan / SPP (${studentBills.length})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveSubTab(t.id as any);
                  setIsNoteFormOpen(false);
                  setIsBillFormOpen(false);
                  setPayingBill(null);
                }}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                  activeSubTab === t.id
                    ? 'bg-[#3c1e96] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-[#f3f2f8]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const payload = buildStudentWhatsAppPayload({
                  student,
                  classRoom,
                  schoolName,
                  attendance,
                  notes,
                  bills,
                });
                if (!payload) {
                  showToast('Nomor HP orang tua belum diisi pada biodata siswa', 'error');
                  return;
                }
                setWaModalPayload(payload);
              }}
              className="flex items-center gap-1.5 rounded-full bg-[#2bc155] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#24a648] shadow-2xs transition-colors cursor-pointer"
              title="Kirim Rekap Kehadiran, Catatan & Tunggakan via WhatsApp ke Orang Tua"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Kirim Pesan WhatsApp</span>
            </button>
            <button
              onClick={() => onShowQR(student)}
              className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-[#1f1b38] hover:bg-slate-50 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-[#4e36e2]" />
              <span className="hidden sm:inline">Kartu QR</span>
            </button>
            {canManage && (
              <button
                onClick={() => onEditStudent(student)}
                className="rounded-full bg-[#f3f2f8] border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-[#1f1b38] hover:bg-indigo-100/50 cursor-pointer"
              >
                Edit Biodata
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: BIODATA & RINGKASAN KEHADIRAN */}
          {activeSubTab === 'profil' && (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: 'Hadir', val: hadirCount, color: 'text-[#0a6b4a]' },
                  { label: 'Terlambat', val: terlambatCount, color: 'text-amber-600' },
                  { label: 'Izin', val: izinCount, color: 'text-sky-600' },
                  { label: 'Sakit', val: sakitCount, color: 'text-indigo-600' },
                  { label: 'Alpa', val: alpaCount, color: 'text-red-600' },
                ].map((st) => (
                  <div key={st.label} className="rounded-xl border border-slate-100 bg-[#f7f8f7] p-2.5">
                    <p className={`text-[18px] font-bold font-mono tabular-nums ${st.color}`}>{st.val}</p>
                    <p className="text-[11px] text-slate-500">{st.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5 text-[13px]">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e] border-b border-slate-100 pb-2">
                  Informasi Orang Tua / Wali & Kontak Darurat
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <p className="text-[11px] text-slate-500">Jenis Kelamin</p>
                    <p className="font-medium text-[#0b3d2e]">
                      {student.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Nama Orang Tua / Wali</p>
                    <p className="font-medium text-[#0b3d2e]">{student.parentName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Nomor HP Orang Tua</p>
                    <p className="font-mono font-medium text-[#0a6b4a]">{student.parentPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Pekerjaan Orang Tua</p>
                    <p className="font-medium text-[#0b3d2e]">{student.parentJob || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Kontak Darurat</p>
                    <p className="font-medium text-[#0b3d2e]">{student.emergencyContact || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Kode QR Absensi</p>
                    <p className="font-mono font-medium text-[#0b3d2e]">{student.qrCode}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[11px] text-slate-500">Alamat Tempat Tinggal</p>
                    <p className="font-medium text-[#0b3d2e]">{student.address || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CATATAN SISWA (Catatan, Prestasi, Pelanggaran) */}
          {activeSubTab === 'catatan' && (
            <div className="space-y-3">
              {!isNoteFormOpen ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0b3d2e]">
                        Rekam Catatan, Prestasi & Pelanggaran Siswa
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Catatan perkembangan perilaku, prestasi akademik/tahfidz, atau pelanggaran tata tertib
                      </p>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => setIsNoteFormOpen(true)}
                        className="flex items-center gap-1 rounded-xl bg-[#0b3d2e] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#0a6b4a] cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Catatan</span>
                      </button>
                    )}
                  </div>

                  {studentNotes.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-[#f7f8f7] p-6 text-center">
                      <p className="text-[13px] font-medium text-slate-600">Belum ada catatan untuk siswa ini.</p>
                      {canManage && (
                        <button
                          onClick={() => setIsNoteFormOpen(true)}
                          className="mt-2 rounded-lg bg-[#0a6b4a] px-3 py-1.5 text-[12px] font-medium text-white cursor-pointer"
                        >
                          + Buat Catatan Pertama
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studentNotes.map((n) => (
                        <div key={n.id} className="rounded-xl border border-slate-200 p-3 bg-white">
                          <div className="flex items-center justify-between text-[12px]">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-semibold ${
                                  n.type === 'Prestasi'
                                    ? 'text-[#0a6b4a]'
                                    : n.type === 'Pelanggaran'
                                    ? 'text-red-600'
                                    : 'text-[#0b3d2e]'
                                }`}
                              >
                                {n.type}
                              </span>
                              <span>·</span>
                              <span className="font-mono text-slate-500">{n.date}</span>
                              {n.forwardToBK && (
                                <>
                                  <span>·</span>
                                  <span className="text-amber-700 font-medium">Diteruskan ke BK / Kepala MI</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const payload = buildStudentWhatsAppPayload({
                                    student,
                                    classRoom,
                                    schoolName,
                                    attendance,
                                    notes,
                                    bills,
                                    customFocusNote: n,
                                  });
                                  if (!payload) {
                                    showToast('Nomor HP orang tua belum diisi', 'error');
                                    return;
                                  }
                                  setWaModalPayload(payload);
                                }}
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-[#2bc155] hover:bg-[#2bc155] hover:text-white transition-colors cursor-pointer"
                                title="Kirim catatan ini ke WhatsApp Orang Tua"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>Kirim WA</span>
                              </button>
                              {canManage && (
                                <button
                                  onClick={() => onDeleteNote(n.id)}
                                  className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                                  title="Hapus catatan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="mt-1.5 text-[13px] text-slate-800">{n.content}</p>
                          <p className="mt-1 text-[11px] text-slate-400">Dicatat oleh: {n.createdBy}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Functional Note Form (Section 7 compliance: Jenis, Isi Catatan, Tanggal, Opsi BK, Simpan, Batal, X) */
                <form onSubmit={handleSaveNote} className="rounded-xl border-2 border-[#0b3d2e]/20 bg-[#f7f8f7] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <h4 className="text-[14px] font-bold text-[#0b3d2e]">Formulir Catatan Siswa</h4>
                    <button
                      type="button"
                      onClick={() => setIsNoteFormOpen(false)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer"
                      title="Tutup Form Catatan"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Jenis Catatan</label>
                      <select
                        value={noteType}
                        onChange={(e) => setNoteType(e.target.value as NoteType)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]"
                      >
                        <option value="Catatan">Catatan Perkembangan</option>
                        <option value="Prestasi">Prestasi Siswa</option>
                        <option value="Pelanggaran">Pelanggaran Tata Tertib</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Tanggal</label>
                      <input
                        type="date"
                        value={noteDate}
                        onChange={(e) => setNoteDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1">Isi Catatan Lengkap</label>
                    <textarea
                      rows={3}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Tuliskan rincian catatan, prestasi, atau tindak lanjut pembinaan siswa..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-[13px] focus:border-[#0a6b4a] focus:outline-none"
                      required
                    />
                  </div>

                  <label className="flex items-center gap-2 text-[12px] font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forwardToBK}
                      onChange={(e) => setForwardToBK(e.target.checked)}
                      className="h-4 w-4 accent-[#0b3d2e]"
                    />
                    <span>Teruskan catatan ini ke Bimbingan Konseling (BK) / Pembinaan Madrasah</span>
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsNoteFormOpen(false)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submittingNote}
                      className="rounded-xl bg-[#0b3d2e] px-4 py-2 text-[12px] font-medium text-white hover:bg-[#0a6b4a] cursor-pointer"
                    >
                      {submittingNote ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: TUNGGAKAN & PEMBAYARAN SISWA */}
          {activeSubTab === 'tunggakan' && (
            <div className="space-y-3">
              {!isBillFormOpen && !payingBill && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Tagihan & Administrasi Keuangan Siswa</h3>
                      <p className="text-[11px] text-slate-500">SPP, kegiatan, seragam, buku, dan riwayat pembayaran</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const effectiveSettings: SchoolSettings = settings || {
                            schoolName,
                            nsm: '-',
                            npsn: '-',
                            address: 'Alamat Madrasah',
                            phone: '-',
                            email: '-',
                            headmasterName: 'Nama Kepala Madrasah',
                            headmasterNip: '-',
                            academicYear: '2026/2027',
                            semester: 'Ganjil',
                            timeInLimit: '07:00',
                            timeLateLimit: '07:15',
                            timeOutLimit: '12:30',
                            docPrefix: 'MI/ADM/2026',
                            notificationsEnabled: true,
                            waGatewayNotice: true,
                            compactMode: false,
                            rolePermissions: {
                              waliCanAddStudent: true,
                              waliCanManageBills: true,
                              piketCanEditPastAttendance: false,
                            },
                            registeredDevices: [],
                            semesterArchives: [],
                          };
                          exportStudentBillsPDF({
                            student,
                            classRoom,
                            settings: effectiveSettings,
                            bills,
                          });
                          showToast(`PDF Rekap Tunggakan (${student.name}) berhasil diunduh`);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-[#3c1e96] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#4e36e2] cursor-pointer"
                        title="Download Surat Rekap Tunggakan Siswa (PDF) untuk Orang Tua"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Cetak PDF Tunggakan</span>
                      </button>
                      {canManage && (
                        <button
                          onClick={() => setIsBillFormOpen(true)}
                          className="flex items-center gap-1 rounded-xl bg-[#0b3d2e] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#0a6b4a] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Tagihan</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {studentBills.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-[#f7f8f7] p-6 text-center text-[13px] text-slate-600">
                      Tidak ada tunggakan atau tagihan tercatat untuk siswa ini.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studentBills.map((b) => {
                        const remaining = Math.max(0, b.amount - b.paidAmount);
                        return (
                          <div key={b.id} className="rounded-xl border border-slate-200 p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 text-[12px]">
                                <span className="font-semibold text-[#0b3d2e]">{b.type}</span>
                                <span>·</span>
                                <span className="text-slate-600">{b.period}</span>
                                <span>·</span>
                                <span
                                  className={`font-semibold ${
                                    b.status === 'Lunas'
                                      ? 'text-[#0a6b4a]'
                                      : b.status === 'Cicilan'
                                      ? 'text-amber-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {b.status}
                                </span>
                              </div>
                              <p className="text-[13px] font-medium text-slate-800 mt-0.5">{b.title}</p>
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                Nominal: Rp {b.amount.toLocaleString('id-ID')} · Terbayar: Rp{' '}
                                {b.paidAmount.toLocaleString('id-ID')} · Sisa: Rp {remaining.toLocaleString('id-ID')}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              {b.status !== 'Lunas' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const payload = buildStudentWhatsAppPayload({
                                      student,
                                      classRoom,
                                      schoolName,
                                      attendance,
                                      notes,
                                      bills,
                                      customFocusBill: b,
                                    });
                                    if (!payload) {
                                      showToast('Nomor HP orang tua belum diisi', 'error');
                                      return;
                                    }
                                    setWaModalPayload(payload);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-[11px] font-semibold text-[#2bc155] hover:bg-[#2bc155] hover:text-white transition-colors cursor-pointer"
                                  title="Kirim Pemberitahuan Tunggakan ini via WhatsApp ke Orang Tua"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>Ingatkan WA</span>
                                </button>
                              )}
                              {canManage && b.status !== 'Lunas' && (
                                <button
                                  onClick={() => {
                                    setPayingBill(b);
                                    setPayAmount(String(remaining));
                                  }}
                                  className="rounded-lg bg-[#0a6b4a] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0b3d2e] cursor-pointer shrink-0"
                                >
                                  Bayar / Cicil
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {isBillFormOpen && (
                <form onSubmit={handleSaveBill} className="rounded-xl border border-slate-200 bg-[#f7f8f7] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-[14px] font-bold text-[#0b3d2e]">Tambah Tagihan Siswa</h4>
                    <button type="button" onClick={() => setIsBillFormOpen(false)} className="text-slate-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Jenis Tagihan</label>
                      <select
                        value={billType}
                        onChange={(e) => setBillType(e.target.value as BillType)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]"
                      >
                        <option value="SPP">SPP / Infaq Bulanan</option>
                        <option value="Kegiatan">Kegiatan Madrasah</option>
                        <option value="Seragam">Seragam</option>
                        <option value="Buku">Buku / Kitab & LKS</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Nominal (Rp)</label>
                      <input
                        type="number"
                        value={billAmount}
                        onChange={(e) => setBillAmount(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Periode</label>
                      <input
                        type="text"
                        value={billPeriod}
                        onChange={(e) => setBillPeriod(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Jatuh Tempo</label>
                      <input
                        type="date"
                        value={billDueDate}
                        onChange={(e) => setBillDueDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Keterangan / Nama Tagihan</label>
                      <input
                        type="text"
                        value={billTitle}
                        onChange={(e) => setBillTitle(e.target.value)}
                        placeholder="Contoh: SPP Bulan Oktober 2026"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBillFormOpen(false)}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-[12px]"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#0b3d2e] px-4 py-1.5 text-[12px] font-medium text-white"
                    >
                      Simpan Tagihan
                    </button>
                  </div>
                </form>
              )}

              {payingBill && (
                <form onSubmit={handleSavePayment} className="rounded-xl border border-slate-200 bg-[#f7f8f7] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-[14px] font-bold text-[#0b3d2e]">Catat Pembayaran: {payingBill.title}</h4>
                    <button type="button" onClick={() => setPayingBill(null)} className="text-slate-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Jumlah Bayar (Rp)</label>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Metode Pembayaran</label>
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]"
                      >
                        <option value="Tunai">Tunai (Loket TU / Wali Kelas)</option>
                        <option value="Transfer">Transfer Bank</option>
                        <option value="QRIS">QRIS Madrasah</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">Tanggal Bayar</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPayingBill(null)}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-[12px]"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#0a6b4a] px-4 py-1.5 text-[12px] font-medium text-white"
                    >
                      Simpan Pembayaran
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-3 border-t border-slate-100 bg-[#f7f8f7]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      <WhatsAppPreviewModal
        payload={waModalPayload}
        onClose={() => setWaModalPayload(null)}
        showToast={showToast}
      />
    </div>
  );
};
