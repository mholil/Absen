import React, { useState } from 'react';
import {
  FileText,
  Award,
  AlertTriangle,
  Megaphone,
  Receipt,
  ArrowLeftRight,
  TrendingUp,
  Printer,
  Archive,
  Plus,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import { AppDatabase, Student, NoteType, BillType } from '../types';
import { buildStudentWhatsAppPayload } from '../utils/whatsappUtils';
import { exportStudentBillsPDF, exportBillsRecapReportPDF } from '../utils/exportUtils';
import { WhatsAppPreviewModal, WhatsAppPayload } from './WhatsAppPreviewModal';

interface WaliClassAdminPanelProps {
  db: AppDatabase;
  classId: string;
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
  onAdminRecordAction: (entity: string, action: string, payload: any) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type AdminSubMenu =
  | 'catatan_kelas'
  | 'prestasi'
  | 'pelanggaran'
  | 'pengumuman'
  | 'tunggakan'
  | 'mutasi'
  | 'kenaikan'
  | 'cetak_daftar'
  | 'arsip_siswa';

export const WaliClassAdminPanel: React.FC<WaliClassAdminPanelProps> = ({
  db,
  classId,
  onAddNote,
  onDeleteNote,
  onAddBill,
  onPayBill,
  onAdminRecordAction,
  showToast,
}) => {
  const [subMenu, setSubMenu] = useState<AdminSubMenu>('catatan_kelas');
  const [waModalPayload, setWaModalPayload] = useState<WhatsAppPayload | null>(null);
  const classStudents = db.students.filter((s) => s.classId === classId);
  const cls = db.classes.find((c) => c.id === classId);

  // Quick Note Form
  const [selectedStudentId, setSelectedStudentId] = useState(classStudents[0]?.id || '');
  const [noteContent, setNoteContent] = useState('');
  const [forwardBK, setForwardBK] = useState(false);

  // Announcement Form
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');

  // Mutation Form
  const [mutStudentId, setMutStudentId] = useState(classStudents[0]?.id || '');
  const [mutType, setMutType] = useState<'Masuk' | 'Keluar' | 'Pindah Kelas'>('Keluar');
  const [mutDest, setMutDest] = useState('');
  const [mutReason, setMutReason] = useState('');

  // Promotion Form
  const [prmStudentId, setPrmStudentId] = useState(classStudents[0]?.id || '');
  const [prmToClass, setPrmToClass] = useState('Kelas Berikutnya');
  const [prmRec, setPrmRec] = useState<'Naik Kelas' | 'Tinggal Kelas' | 'Lulus'>('Naik Kelas');
  const [prmNote, setPrmNote] = useState('');

  // Bill Form
  const [billStudentId, setBillStudentId] = useState(classStudents[0]?.id || '');
  const [billType, setBillType] = useState<BillType>('SPP');
  const [billAmount, setBillAmount] = useState('75000');
  const [billPeriod, setBillPeriod] = useState('Oktober 2026');

  const handleQuickNote = async (type: NoteType) => {
    if (!selectedStudentId || !noteContent.trim()) {
      showToast('Pilih siswa dan isi catatan terlebih dahulu', 'error');
      return;
    }
    await onAddNote({
      studentId: selectedStudentId,
      type,
      content: noteContent.trim(),
      date: new Date().toISOString().slice(0, 10),
      forwardToBK: forwardBK,
    });
    setNoteContent('');
    setForwardBK(false);
    showToast(`${type} kelas berhasil disimpan`);
  };

  return (
    <div className="neu-card rounded-3xl p-5 space-y-4">
      <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2 no-print">
        <div>
          <h3 className="text-[15px] font-bold text-[#1f1b38]">
            Administrasi Wali Kelas — {cls?.name || 'Kelas Saya'}
          </h3>
          <p className="text-[12px] text-slate-400">
            Kelola catatan kelas, prestasi, pelanggaran, pengumuman, tunggakan, mutasi, & kenaikan kelas
          </p>
        </div>
      </div>

      {/* 9 Sub-menu buttons required for Wali Kelas Administration */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-print">
        {[
          { id: 'catatan_kelas', label: 'Catatan Kelas', icon: FileText },
          { id: 'prestasi', label: 'Catatan Prestasi', icon: Award },
          { id: 'pelanggaran', label: 'Catatan Pelanggaran', icon: AlertTriangle },
          { id: 'pengumuman', label: 'Pengumuman Kelas', icon: Megaphone },
          { id: 'tunggakan', label: 'Tunggakan Kelas', icon: Receipt },
          { id: 'mutasi', label: 'Mutasi Siswa', icon: ArrowLeftRight },
          { id: 'kenaikan', label: 'Usulan Kenaikan Kelas', icon: TrendingUp },
          { id: 'cetak_daftar', label: 'Cetak Daftar Siswa', icon: Printer },
          { id: 'arsip_siswa', label: 'Arsip Siswa', icon: Archive },
        ].map((item) => {
          const Icon = item.icon;
          const active = subMenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSubMenu(item.id as AdminSubMenu)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? 'bg-[#3c1e96] text-white shadow-2xs'
                  : 'bg-[#f3f2f8] text-slate-700 hover:bg-indigo-100/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1, 2, 3: CATATAN KELAS / PRESTASI / PELANGGARAN */}
      {(subMenu === 'catatan_kelas' || subMenu === 'prestasi' || subMenu === 'pelanggaran') && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-[#f7f8f7] p-3.5 space-y-2.5">
            <h4 className="text-[13px] font-semibold text-[#0b3d2e]">
              Tambah {subMenu === 'prestasi' ? 'Catatan Prestasi' : subMenu === 'pelanggaran' ? 'Catatan Pelanggaran' : 'Catatan Kelas'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px]"
              >
                {classStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.nis})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Isi rincian catatan..."
                className="sm:col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px]"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forwardBK}
                  onChange={(e) => setForwardBK(e.target.checked)}
                  className="h-4 w-4 accent-[#0b3d2e]"
                />
                <span>Teruskan ke BK / Pembinaan Madrasah</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  handleQuickNote(
                    subMenu === 'prestasi' ? 'Prestasi' : subMenu === 'pelanggaran' ? 'Pelanggaran' : 'Catatan'
                  )
                }
                className="rounded-xl bg-[#0b3d2e] px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#0a6b4a] cursor-pointer"
              >
                Simpan Catatan
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {db.notes
              .filter((n) => {
                if (subMenu === 'prestasi') return n.type === 'Prestasi';
                if (subMenu === 'pelanggaran') return n.type === 'Pelanggaran';
                return true;
              })
              .map((n) => {
                const st = db.students.find((s) => s.id === n.studentId);
                return (
                  <div key={n.id} className="py-2.5 flex items-start justify-between gap-2 text-[12px]">
                    <div>
                      <span className="font-semibold text-[#0b3d2e]">{st?.name || n.studentId}</span>
                      <span className="mx-1.5">·</span>
                      <span
                        className={`font-medium ${
                          n.type === 'Prestasi'
                            ? 'text-[#0a6b4a]'
                            : n.type === 'Pelanggaran'
                            ? 'text-red-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {n.type}
                      </span>
                      <span className="mx-1.5">·</span>
                      <span className="font-mono text-slate-400">{n.date}</span>
                      <p className="text-[13px] text-slate-700 mt-0.5">{n.content}</p>
                    </div>
                    <button
                      onClick={() => onDeleteNote(n.id)}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 4: PENGUMUMAN KELAS */}
      {subMenu === 'pengumuman' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-[#f7f8f7] p-3.5 space-y-2.5">
            <h4 className="text-[13px] font-semibold text-[#0b3d2e]">Buat Pengumuman Kelas</h4>
            <input
              type="text"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="Judul pengumuman kelas..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px]"
            />
            <textarea
              rows={2}
              value={annContent}
              onChange={(e) => setAnnContent(e.target.value)}
              placeholder="Isi pengumuman untuk siswa / wali murid..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-[12px]"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!annTitle.trim()) return;
                  await onAdminRecordAction('announcements', 'add', {
                    title: annTitle.trim(),
                    content: annContent.trim(),
                    targetClassId: classId,
                  });
                  setAnnTitle('');
                  setAnnContent('');
                  showToast('Pengumuman kelas berhasil diterbitkan');
                }}
                className="rounded-xl bg-[#0b3d2e] px-3.5 py-1.5 text-[12px] font-medium text-white cursor-pointer"
              >
                Terbitkan Pengumuman
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {db.announcements.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 p-3 flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-semibold text-[#0b3d2e]">{a.title}</p>
                  <p className="text-[12px] text-slate-600 mt-0.5">{a.content}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {a.date} · Oleh: {a.createdBy}
                  </p>
                </div>
                <button
                  onClick={() => onAdminRecordAction('announcements', 'delete', { id: a.id })}
                  className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5: TUNGGAKAN KELAS */}
      {subMenu === 'tunggakan' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-slate-600">
              Kelola & cetak surat pemberitahuan tunggakan/SPP resmi untuk orang tua siswa {cls?.name}.
            </p>
            <button
              type="button"
              onClick={() => {
                exportBillsRecapReportPDF({
                  filename: `Rekap_Tunggakan_${cls?.name || 'Kelas'}`,
                  title: `Rekapitulasi Tagihan & Tunggakan Siswa — ${cls?.name || 'Kelas'}`,
                  settings: db.settings,
                  bills: db.bills,
                  students: classStudents,
                  classes: db.classes,
                });
                showToast('PDF Rekap Tunggakan Kelas berhasil diunduh');
              }}
              className="flex items-center gap-1.5 rounded-full bg-[#3c1e96] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4e36e2] cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Cetak PDF Rekap Kelas</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#f7f8f7] p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select
              value={billStudentId}
              onChange={(e) => setBillStudentId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
            >
              {classStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={billType}
              onChange={(e) => setBillType(e.target.value as BillType)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
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
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-mono"
            />
            <button
              type="button"
              onClick={async () => {
                if (!billStudentId) return;
                await onAddBill({
                  studentId: billStudentId,
                  type: billType,
                  title: `${billType} - ${billPeriod}`,
                  amount: Number(billAmount) || 0,
                  period: billPeriod,
                  dueDate: new Date().toISOString().slice(0, 10),
                  note: '',
                });
                showToast('Tagihan siswa ditambahkan');
              }}
              className="rounded-xl bg-[#0b3d2e] px-3 py-1.5 text-[12px] font-medium text-white cursor-pointer"
            >
              + Tambah Tagihan
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {db.bills.map((b) => {
              const st = db.students.find((s) => s.id === b.studentId);
              const rem = Math.max(0, b.amount - b.paidAmount);
              return (
                <div key={b.id} className="py-2.5 flex items-center justify-between gap-2 text-[12px]">
                  <div>
                    <p className="font-semibold text-[#0b3d2e]">
                      {st?.name || b.studentId} — <span className="text-[#0a6b4a]">{b.title}</span>
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      Tagihan: Rp {b.amount.toLocaleString('id-ID')} · Sisa: Rp {rem.toLocaleString('id-ID')} · Status:{' '}
                      <strong>{b.status}</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
                          showToast(`PDF Rekap Tunggakan ${st.name} berhasil diunduh`);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-[11px] font-semibold text-[#3c1e96] hover:bg-[#3c1e96] hover:text-white transition-colors cursor-pointer"
                        title="Cetak PDF Surat Rekap Tunggakan untuk Orang Tua"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF Orang Tua</span>
                      </button>
                    )}
                    {b.status !== 'Lunas' && (
                      <>
                        {st && (
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
                                customFocusBill: b,
                              });
                              if (!payload) {
                                showToast('Nomor HP orang tua belum diisi', 'error');
                                return;
                              }
                              setWaModalPayload(payload);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-[#2bc155] hover:bg-[#2bc155] hover:text-white transition-colors cursor-pointer"
                            title="Kirim Pemberitahuan Tunggakan ke WhatsApp Orang Tua"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA Tagihan</span>
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            await onPayBill(b.id, {
                              amount: rem,
                              date: new Date().toISOString().slice(0, 10),
                              method: 'Tunai',
                              note: 'Pelunasan via Wali Kelas',
                            });
                            showToast('Pembayaran lunas berhasil dicatat');
                          }}
                          className="rounded-lg bg-[#0a6b4a] px-2.5 py-1 text-[11px] font-medium text-white cursor-pointer"
                        >
                          Tandai Lunas
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6: MUTASI SISWA */}
      {subMenu === 'mutasi' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-[#f7f8f7] p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select
              value={mutStudentId}
              onChange={(e) => setMutStudentId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
            >
              {classStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={mutType}
              onChange={(e) => setMutType(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
            >
              <option value="Keluar">Mutasi Keluar</option>
              <option value="Masuk">Mutasi Masuk</option>
              <option value="Pindah Kelas">Pindah Kelas</option>
            </select>
            <input
              type="text"
              value={mutDest}
              onChange={(e) => setMutDest(e.target.value)}
              placeholder="Sekolah Tujuan / Asal..."
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
            />
            <button
              type="button"
              onClick={async () => {
                if (!mutStudentId) return;
                await onAdminRecordAction('mutations', 'add', {
                  studentId: mutStudentId,
                  type: mutType,
                  destinationOrOrigin: mutDest || 'MI Tujuan',
                  reason: mutReason || 'Permohonan orang tua/wali',
                });
                setMutDest('');
                showToast('Data mutasi siswa berhasil dicatat');
              }}
              className="rounded-xl bg-[#0b3d2e] px-3 py-1.5 text-[12px] font-medium text-white cursor-pointer"
            >
              Simpan Mutasi
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {db.mutations.map((m) => (
              <div key={m.id} className="py-2 text-[12px] flex justify-between">
                <div>
                  <span className="font-semibold text-[#0b3d2e]">{m.studentName}</span> · <span>{m.type}</span> ·{' '}
                  <span className="text-slate-500">{m.destinationOrOrigin}</span>
                </div>
                <span className="font-mono text-slate-400">{m.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7: USULAN KENAIKAN KELAS */}
      {subMenu === 'kenaikan' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-[#f7f8f7] p-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select
              value={prmStudentId}
              onChange={(e) => setPrmStudentId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
            >
              {classStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={prmRec}
              onChange={(e) => setPrmRec(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
            >
              <option value="Naik Kelas">Naik Kelas</option>
              <option value="Lulus">Lulus Madrasah</option>
              <option value="Tinggal Kelas">Perlu Pembinaan / Tinggal</option>
            </select>
            <input
              type="text"
              value={prmToClass}
              onChange={(e) => setPrmToClass(e.target.value)}
              placeholder="Ke Kelas (misal: Kelas 2A)"
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]"
            />
            <button
              type="button"
              onClick={async () => {
                if (!prmStudentId) return;
                await onAdminRecordAction('promotions', 'add', {
                  studentId: prmStudentId,
                  recommendation: prmRec,
                  toClassName: prmToClass,
                  note: prmNote || 'Memenuhi syarat kehadiran & akademik',
                });
                showToast('Usulan kenaikan kelas berhasil disimpan');
              }}
              className="rounded-xl bg-[#0b3d2e] px-3 py-1.5 text-[12px] font-medium text-white cursor-pointer"
            >
              Ajukan Usulan
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {db.promotions.map((p) => (
              <div key={p.id} className="py-2 text-[12px] flex justify-between">
                <div>
                  <span className="font-semibold text-[#0b3d2e]">{p.studentName}</span> ·{' '}
                  <span className="text-[#0a6b4a] font-medium">{p.recommendation}</span> → <span>{p.toClassName}</span>
                </div>
                <span className="text-slate-500">{p.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8: CETAK DAFTAR SISWA */}
      {subMenu === 'cetak_daftar' && (
        <div className="space-y-4 print-sheet">
          <div className="flex items-center justify-between no-print">
            <p className="text-[12px] text-slate-600">
              Daftar resmi seluruh siswa {cls?.name} ({classStudents.length} siswa) siap cetak.
            </p>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl bg-[#0b3d2e] px-3.5 py-1.5 text-[12px] font-medium text-white cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Daftar Siswa</span>
            </button>
          </div>

          {/* Official Letterhead for Print */}
          <div className="border-b-[3px] border-double border-[#1f1b38] pb-3 mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10.5px] font-bold tracking-wider text-[#3c1e96] uppercase">
                KEMENTERIAN AGAMA REPUBLIK INDONESIA · MADRASAH IBTIDAIYAH
              </p>
              <h3 className="text-[17px] font-extrabold text-[#1f1b38] uppercase">{db.settings.schoolName}</h3>
              <p className="text-[11px] text-slate-600">
                NSM: <span className="font-mono">{db.settings.nsm}</span> · NPSN:{' '}
                <span className="font-mono">{db.settings.npsn}</span> · {db.settings.address}
              </p>
            </div>
            <div className="text-right text-[11px] font-mono text-slate-600">
              <p className="font-semibold text-[#1f1b38]">DAFTAR INDUK SISWA {cls?.name?.toUpperCase()}</p>
              <p>T.A {db.settings.academicYear} ({db.settings.semester})</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="print-table w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-[#f7f8f7]">
                  <th className="py-2 px-2.5 font-bold">No</th>
                  <th className="py-2 px-2.5 font-bold">NIS / NISN</th>
                  <th className="py-2 px-2.5 font-bold">Nama Lengkap Siswa</th>
                  <th className="py-2 px-2.5 font-bold">L/P</th>
                  <th className="py-2 px-2.5 font-bold">Orang Tua / Wali</th>
                  <th className="py-2 px-2.5 font-bold">Telepon / WA</th>
                  <th className="py-2 px-2.5 font-bold">Alamat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {classStudents.map((s, idx) => (
                  <tr key={s.id}>
                    <td className="py-2 px-2.5 font-mono">{idx + 1}</td>
                    <td className="py-2 px-2.5 font-mono">
                      {s.nis} / {s.nisn || '-'}
                    </td>
                    <td className="py-2 px-2.5 font-semibold text-[#1f1b38]">{s.name}</td>
                    <td className="py-2 px-2.5">{s.gender}</td>
                    <td className="py-2 px-2.5">{s.parentName}</td>
                    <td className="py-2 px-2.5 font-mono">{s.parentPhone}</td>
                    <td className="py-2 px-2.5 text-slate-600">{s.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="print-signature mt-6 pt-4 border-t border-slate-200 flex justify-between text-[12px] text-slate-700">
            <div>
              <p>Mengetahui,</p>
              <p className="font-semibold text-[#1f1b38]">Kepala Madrasah</p>
              <div className="h-14" />
              <p className="font-bold underline text-[#1f1b38]">{db.settings.headmasterName}</p>
              <p className="font-mono text-[11px]">NIP. {db.settings.headmasterNip}</p>
            </div>
            <div className="text-right">
              <p>Wali Kelas {cls?.name}</p>
              <div className="h-14" />
              <p className="font-bold underline text-[#1f1b38]">Wali Kelas Pengampu</p>
            </div>
          </div>
        </div>
      )}

      {/* 9: ARSIP SISWA */}
      {subMenu === 'arsip_siswa' && (
        <div className="space-y-2 text-[12px]">
          <p className="text-slate-600">
            Rekam Arsip Siswa, Mutasi, & Alumni Madrasah ({db.alumni.length} data arsip/alumni):
          </p>
          <div className="divide-y divide-slate-100">
            {db.alumni.map((al) => (
              <div key={al.id} className="py-2 flex justify-between">
                <div>
                  <span className="font-semibold text-[#0b3d2e]">{al.name}</span> · NIS:{' '}
                  <span className="font-mono">{al.nis}</span>
                </div>
                <span className="text-slate-500">
                  Lulus {al.graduationYear} · Melanjutkan ke: {al.continuingSchool}
                </span>
              </div>
            ))}
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
