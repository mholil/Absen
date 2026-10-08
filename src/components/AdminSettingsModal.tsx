import React, { useState } from 'react';
import {
  X,
  Building2,
  UserCog,
  KeyRound,
  ShieldCheck,
  Calendar,
  Clock,
  Bell,
  History,
  Database,
  Download,
  Upload,
  Smartphone,
  Search,
  FileText,
  Archive,
  Activity,
  Sliders,
  LogOut,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-react';
import { AppDatabase, SchoolSettings, User } from '../types';
import { downloadJSONFile } from '../utils/exportUtils';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: AppDatabase;
  currentUser: User;
  onSaveSettings: (newSettings: Partial<SchoolSettings>) => Promise<void>;
  onChangePassword: (targetUserId: string, newPassword: string) => Promise<void>;
  onAdminRecordAction: (entity: string, action: string, payload: any) => Promise<void>;
  onBackupDownload: () => Promise<void>;
  onRestoreUpload: (jsonData: any) => Promise<string>;
  onLogout: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type SettingsTab =
  | 'profil'
  | 'akun_password'
  | 'hak_akses'
  | 'jam_semester'
  | 'kalender_jadwal'
  | 'backup_restore'
  | 'perangkat_sistem'
  | 'pencarian_arsip';

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  onClose,
  db,
  currentUser,
  onSaveSettings,
  onChangePassword,
  onAdminRecordAction,
  onBackupDownload,
  onRestoreUpload,
  onLogout,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profil');
  const [formSettings, setFormSettings] = useState<SchoolSettings>(db.settings);
  const [saving, setSaving] = useState(false);

  // Password reset state
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id);
  const [newPassword, setNewPassword] = useState('');

  // Calendar / Holiday state
  const [holDate, setHolDate] = useState('');
  const [holTitle, setHolTitle] = useState('');
  const [holType, setHolType] = useState<'Libur Nasional' | 'Cuti Bersama' | 'Kegiatan Madrasah' | 'Ujian'>('Kegiatan Madrasah');

  // Schedule state
  const [schClassId, setSchClassId] = useState(db.classes[0]?.id || 'kls-1a');
  const [schDay, setSchDay] = useState<'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu'>('Senin');
  const [schSubject, setSchSubject] = useState('');
  const [schStart, setSchStart] = useState('07:00');
  const [schEnd, setSchEnd] = useState('08:30');
  const [schTeacher, setSchTeacher] = useState('');

  // Restore confirmation state
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<string | null>(null);

  // Global search state inside settings
  const [globalQuery, setGlobalQuery] = useState('');

  if (!isOpen) return null;

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(formSettings);
      showToast('Pengaturan madrasah berhasil disimpan');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengaturan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim().length < 4) {
      showToast('Password baru minimal 4 karakter', 'error');
      return;
    }
    setSaving(true);
    try {
      await onChangePassword(selectedUserId, newPassword.trim());
      setNewPassword('');
      showToast('Password akun berhasil diperbarui secara aman');
    } catch (err: any) {
      showToast(err.message || 'Gagal mereset password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        const payload = parsed.data || parsed;
        if (!Array.isArray(payload.students) || !Array.isArray(payload.classes) || !Array.isArray(payload.attendance)) {
          showToast('File JSON tidak valid: struktur students/classes/attendance tidak ditemukan', 'error');
          return;
        }
        setPendingRestoreData(parsed);
        setRestoreSummary(null);
      } catch {
        showToast('Gagal membaca file JSON. Pastikan format file benar.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const confirmRestore = async () => {
    if (!pendingRestoreData) return;
    setSaving(true);
    try {
      const resultMsg = await onRestoreUpload(pendingRestoreData);
      setRestoreSummary(resultMsg);
      setPendingRestoreData(null);
      showToast('Data madrasah berhasil dipulihkan');
    } catch (err: any) {
      showToast(err.message || 'Gagal memulihkan data', 'error');
    } finally {
      setSaving(false);
    }
  };

  const globalResults = globalQuery.trim()
    ? {
        students: db.students.filter(
          (s) =>
            s.name.toLowerCase().includes(globalQuery.toLowerCase()) ||
            s.nis.includes(globalQuery) ||
            s.parentName.toLowerCase().includes(globalQuery.toLowerCase())
        ),
        users: db.users.filter(
          (u) =>
            u.name.toLowerCase().includes(globalQuery.toLowerCase()) ||
            u.username.toLowerCase().includes(globalQuery.toLowerCase())
        ),
        bills: db.bills.filter((b) => b.title.toLowerCase().includes(globalQuery.toLowerCase())),
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-3xl bg-white shadow-xl border border-indigo-100 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-[#f3f2f8]">
          <div>
            <h2 className="text-[16px] font-bold text-[#1f1b38]">Pengaturan Sistem & Administrasi Madrasah</h2>
            <p className="text-[11px] text-slate-500">
              Konfigurasi profil MI, jam kehadiran, kalender akademik, keamanan akun, & cadangan data
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer"
            title="Tutup Pengaturan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 bg-white px-4 py-2.5 shrink-0">
          {[
            { id: 'profil', label: 'Profil & Dokumen', icon: Building2 },
            { id: 'jam_semester', label: 'Jam & Semester', icon: Clock },
            { id: 'akun_password', label: 'Akun & Reset Sandi', icon: KeyRound },
            { id: 'hak_akses', label: 'Hak Akses & Tampilan', icon: ShieldCheck },
            { id: 'kalender_jadwal', label: 'Kalender & Jadwal', icon: Calendar },
            { id: 'backup_restore', label: 'Backup & Import/Export', icon: Database },
            { id: 'pencarian_arsip', label: 'Pencarian & Arsip', icon: Archive },
            { id: 'perangkat_sistem', label: 'Perangkat & Log Sistem', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#3c1e96] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-[#f3f2f8] hover:text-[#1f1b38]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. PROFIL SEKOLAH & NOMOR DOKUMEN */}
          {activeTab === 'profil' && (
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1">Nama Madrasah (MI)</label>
                  <input
                    type="text"
                    value={formSettings.schoolName}
                    onChange={(e) => setFormSettings({ ...formSettings, schoolName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:border-[#0a6b4a] focus:outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1">NSM</label>
                    <input
                      type="text"
                      value={formSettings.nsm}
                      onChange={(e) => setFormSettings({ ...formSettings, nsm: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono focus:border-[#0a6b4a] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1">NPSN</label>
                    <input
                      type="text"
                      value={formSettings.npsn}
                      onChange={(e) => setFormSettings({ ...formSettings, npsn: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono focus:border-[#0a6b4a] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-medium text-slate-700 mb-1">Alamat Lengkap Madrasah</label>
                  <input
                    type="text"
                    value={formSettings.address}
                    onChange={(e) => setFormSettings({ ...formSettings, address: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:border-[#0a6b4a] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1">Nama Kepala Madrasah</label>
                  <input
                    type="text"
                    value={formSettings.headmasterName}
                    onChange={(e) => setFormSettings({ ...formSettings, headmasterName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:border-[#0a6b4a] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1">NIP Kepala Madrasah</label>
                  <input
                    type="text"
                    value={formSettings.headmasterNip}
                    onChange={(e) => setFormSettings({ ...formSettings, headmasterNip: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono focus:border-[#0a6b4a] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1">Telepon / WhatsApp Madrasah</label>
                  <input
                    type="text"
                    value={formSettings.phone}
                    onChange={(e) => setFormSettings({ ...formSettings, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:border-[#0a6b4a] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1">Format Nomor Dokumen Laporan</label>
                  <input
                    type="text"
                    value={formSettings.docPrefix}
                    onChange={(e) => setFormSettings({ ...formSettings, docPrefix: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono focus:border-[#0a6b4a] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0b3d2e] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0a6b4a] transition-colors cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Profil & Dokumen'}
                </button>
              </div>
            </form>
          )}

          {/* 2. JAM KEHADIRAN, TAHUN AJARAN & SEMESTER */}
          {activeTab === 'jam_semester' && (
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 p-3 bg-[#f7f8f7]">
                  <label className="block text-[12px] font-semibold text-[#0b3d2e] mb-1">Jam Masuk (Tepat Waktu)</label>
                  <input
                    type="time"
                    value={formSettings.timeInLimit}
                    onChange={(e) => setFormSettings({ ...formSettings, timeInLimit: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-mono"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Jam standar bel masuk pagi</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-[#f7f8f7]">
                  <label className="block text-[12px] font-semibold text-[#0b3d2e] mb-1">Batas Jam Terlambat</label>
                  <input
                    type="time"
                    value={formSettings.timeLateLimit}
                    onChange={(e) => setFormSettings({ ...formSettings, timeLateLimit: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-mono"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Scan lewat jam ini otomatis tercatat Terlambat</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-[#f7f8f7]">
                  <label className="block text-[12px] font-semibold text-[#0b3d2e] mb-1">Jam Pulang Madrasah</label>
                  <input
                    type="time"
                    value={formSettings.timeOutLimit}
                    onChange={(e) => setFormSettings({ ...formSettings, timeOutLimit: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[14px] font-mono"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Waktu kepulangan siswa reguler</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1">Tahun Ajaran Aktif</label>
                  <input
                    type="text"
                    value={formSettings.academicYear}
                    onChange={(e) => setFormSettings({ ...formSettings, academicYear: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-700 mb-1">Semester Aktif</label>
                  <select
                    value={formSettings.semester}
                    onChange={(e) => setFormSettings({ ...formSettings, semester: e.target.value as 'Ganjil' | 'Genap' })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] bg-white"
                  >
                    <option value="Ganjil">Semester Ganjil</option>
                    <option value="Genap">Semester Genap</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0b3d2e] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0a6b4a] transition-colors cursor-pointer"
                >
                  Simpan Pengaturan Jam & Semester
                </button>
              </div>
            </form>
          )}

          {/* 3. PENGATURAN AKUN, MANAJEMEN AKUN & RESET PASSWORD */}
          {activeTab === 'akun_password' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-3.5 bg-[#f7f8f7]">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Profil Akun Anda Saat Ini</h3>
                <p className="text-[12px] text-slate-600 mt-1">
                  Nama: <strong>{currentUser.name}</strong> · Username: <span className="font-mono">{currentUser.username}</span> · Jabatan: {currentUser.position}
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Reset Password Pengguna (Enkripsi Scrypt)</h3>
                <p className="text-[12px] text-slate-500">
                  Password tidak pernah disimpan dalam bentuk plaintext. Gunakan formulir ini untuk mengganti password akun.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1">Pilih Akun Pengguna</label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] bg-white"
                    >
                      {db.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.username} - {u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-slate-700 mb-1">Password Baru</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 4 karakter..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#0a6b4a] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0b3d2e] cursor-pointer"
                  >
                    Perbarui Password
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 4. HAK AKSES, NOTIFIKASI & TAMPILAN APLIKASI */}
          {activeTab === 'hak_akses' && (
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Hak Akses Peran (Role Permissions)</h3>
                <label className="flex items-center justify-between gap-2 text-[13px] text-slate-700 cursor-pointer">
                  <span>Izinkan Wali Kelas menambah & mengedit siswa di kelas yang diampu</span>
                  <input
                    type="checkbox"
                    checked={formSettings.rolePermissions.waliCanAddStudent}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        rolePermissions: { ...formSettings.rolePermissions, waliCanAddStudent: e.target.checked },
                      })
                    }
                    className="h-4 w-4 accent-[#0b3d2e]"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-[13px] text-slate-700 cursor-pointer">
                  <span>Izinkan Wali Kelas mencatat pembayaran tunggakan siswa kelasnya</span>
                  <input
                    type="checkbox"
                    checked={formSettings.rolePermissions.waliCanManageBills}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        rolePermissions: { ...formSettings.rolePermissions, waliCanManageBills: e.target.checked },
                      })
                    }
                    className="h-4 w-4 accent-[#0b3d2e]"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-[13px] text-slate-700 cursor-pointer">
                  <span>Izinkan Guru Piket mengoreksi riwayat absensi tanggal sebelumnya</span>
                  <input
                    type="checkbox"
                    checked={formSettings.rolePermissions.piketCanEditPastAttendance}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        rolePermissions: { ...formSettings.rolePermissions, piketCanEditPastAttendance: e.target.checked },
                      })
                    }
                    className="h-4 w-4 accent-[#0b3d2e]"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Notifikasi & Tampilan Aplikasi</h3>
                <label className="flex items-center justify-between gap-2 text-[13px] text-slate-700 cursor-pointer">
                  <span>Aktifkan notifikasi suara & pop-up saat scan QR berhasil</span>
                  <input
                    type="checkbox"
                    checked={formSettings.notificationsEnabled}
                    onChange={(e) => setFormSettings({ ...formSettings, notificationsEnabled: e.target.checked })}
                    className="h-4 w-4 accent-[#0b3d2e]"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-[13px] text-slate-700 cursor-pointer">
                  <span>Tampilkan pengingat kiriman pesan WhatsApp ke orang tua untuk siswa Alpa/Terlambat</span>
                  <input
                    type="checkbox"
                    checked={formSettings.waGatewayNotice}
                    onChange={(e) => setFormSettings({ ...formSettings, waGatewayNotice: e.target.checked })}
                    className="h-4 w-4 accent-[#0b3d2e]"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-[13px] text-slate-700 cursor-pointer">
                  <span>Mode Tabel Rapat (Compact Mode) untuk layar HP kecil</span>
                  <input
                    type="checkbox"
                    checked={formSettings.compactMode}
                    onChange={(e) => setFormSettings({ ...formSettings, compactMode: e.target.checked })}
                    className="h-4 w-4 accent-[#0b3d2e]"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0b3d2e] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0a6b4a] cursor-pointer"
                >
                  Simpan Hak Akses & Tampilan
                </button>
              </div>
            </form>
          )}

          {/* 5. KALENDER AKADEMIK & JADWAL PELAJARAN */}
          {activeTab === 'kalender_jadwal' && (
            <div className="space-y-4">
              {/* Kalender Akademik */}
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Kalender Akademik & Hari Libur Madrasah</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="date"
                    value={holDate}
                    onChange={(e) => setHolDate(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]"
                  />
                  <input
                    type="text"
                    value={holTitle}
                    onChange={(e) => setHolTitle(e.target.value)}
                    placeholder="Nama agenda / hari libur..."
                    className="sm:col-span-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!holDate || !holTitle.trim()) return;
                      await onAdminRecordAction('holidays', 'add', { date: holDate, title: holTitle.trim(), type: holType });
                      setHolTitle('');
                      showToast('Agenda kalender akademik ditambahkan');
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg bg-[#0b3d2e] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0a6b4a] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {db.holidays.map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-2 text-[12px]">
                      <div>
                        <span className="font-mono font-medium text-[#0b3d2e]">{h.date}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="font-medium text-slate-800">{h.title}</span>
                        <span className="ml-2 text-slate-500">({h.type})</span>
                      </div>
                      <button
                        onClick={() => onAdminRecordAction('holidays', 'delete', { id: h.id })}
                        className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jadwal Pelajaran */}
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Jadwal Pelajaran Madrasah</h3>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <select
                    value={schClassId}
                    onChange={(e) => setSchClassId(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] bg-white"
                  >
                    {db.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={schDay}
                    onChange={(e) => setSchDay(e.target.value as any)}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] bg-white"
                  >
                    {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={schSubject}
                    onChange={(e) => setSchSubject(e.target.value)}
                    placeholder="Mata Pelajaran"
                    className="col-span-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]"
                  />
                  <input
                    type="text"
                    value={schTeacher}
                    onChange={(e) => setSchTeacher(e.target.value)}
                    placeholder="Nama Guru"
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!schSubject.trim()) return;
                      await onAdminRecordAction('schedules', 'add', {
                        classId: schClassId,
                        day: schDay,
                        subject: schSubject.trim(),
                        timeStart: schStart,
                        timeEnd: schEnd,
                        teacherName: schTeacher.trim() || 'Guru MI',
                      });
                      setSchSubject('');
                      showToast('Jadwal pelajaran ditambahkan');
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg bg-[#0a6b4a] px-3 py-1.5 text-[12px] font-medium text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {db.schedules.map((s) => {
                    const cls = db.classes.find((c) => c.id === s.classId);
                    return (
                      <div key={s.id} className="flex items-center justify-between py-2 text-[12px]">
                        <div>
                          <span className="font-semibold text-[#0b3d2e]">{cls?.name || s.classId}</span>
                          <span className="mx-1.5">·</span>
                          <span>{s.day} ({s.timeStart}–{s.timeEnd})</span>
                          <span className="mx-1.5">·</span>
                          <span className="font-medium text-[#0a6b4a]">{s.subject}</span>
                          <span className="text-slate-500"> — {s.teacherName}</span>
                        </div>
                        <button
                          onClick={() => onAdminRecordAction('schedules', 'delete', { id: s.id })}
                          className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 6. BACKUP & PEMULIHAN DATA (EXPORT / IMPORT JSON) */}
          {activeTab === 'backup_restore' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 bg-[#f7f8f7]">
                  <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Backup & Export JSON</h3>
                  <p className="text-[12px] text-slate-600 mt-1">
                    Unduh seluruh data siswa, kelas, riwayat absensi, catatan, dan tunggakan ke dalam file JSON. Password dijamin aman dan tidak disertakan dalam file backup.
                  </p>
                  <button
                    type="button"
                    onClick={onBackupDownload}
                    className="mt-3 flex items-center gap-2 rounded-xl bg-[#0b3d2e] px-4 py-2 text-[12px] font-medium text-white hover:bg-[#0a6b4a] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Backup JSON</span>
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-[#f7f8f7]">
                  <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Restore & Import JSON</h3>
                  <p className="text-[12px] text-slate-600 mt-1">
                    Pulihkan database dari file cadangan JSON. Sistem akan memvalidasi struktur data terlebih dahulu dan meminta konfirmasi Anda.
                  </p>
                  <label className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#0b3d2e] bg-white px-4 py-2 text-[12px] font-medium text-[#0b3d2e] hover:bg-slate-50 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Pilih File Backup (.json)</span>
                    <input type="file" accept=".json,application/json" onChange={handleFileSelect} className="hidden" />
                  </label>
                </div>
              </div>

              {pendingRestoreData && (
                <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 space-y-2">
                  <p className="text-[13px] font-bold text-amber-950">Konfirmasi Pemulihan Database (Restore)</p>
                  <p className="text-[12px] text-amber-900">
                    File backup tervalidasi berisi{' '}
                    <strong>{(pendingRestoreData.data || pendingRestoreData).students?.length || 0} siswa</strong>,{' '}
                    <strong>{(pendingRestoreData.data || pendingRestoreData).classes?.length || 0} kelas</strong>, dan{' '}
                    <strong>{(pendingRestoreData.data || pendingRestoreData).attendance?.length || 0} catatan absensi</strong>.
                    Apakah Anda yakin ingin memulihkan data ini?
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={confirmRestore}
                      disabled={saving}
                      className="rounded-lg bg-[#0b3d2e] px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#0a6b4a] cursor-pointer"
                    >
                      Ya, Konfirmasi & Pulihkan Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRestoreData(null)}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-[12px] font-medium text-slate-700 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {restoreSummary && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-[12px] text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0a6b4a] shrink-0" />
                  <span>{restoreSummary}</span>
                </div>
              )}
            </div>
          )}

          {/* 7. PENCARIAN GLOBAL & ARSIP SEMESTER */}
          {activeTab === 'pencarian_arsip' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Pencarian Global Satu Pintu</h3>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={globalQuery}
                    onChange={(e) => setGlobalQuery(e.target.value)}
                    placeholder="Cari nama siswa, NIS, nama orang tua, guru/staf, atau tagihan..."
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-[13px]"
                  />
                </div>
                {globalResults && (
                  <div className="space-y-2 pt-1 text-[12px] max-h-44 overflow-y-auto">
                    <p className="text-slate-500">
                      Ditemukan: {globalResults.students.length} siswa · {globalResults.users.length} guru/staf · {globalResults.bills.length} tagihan
                    </p>
                    {globalResults.students.map((s) => (
                      <div key={s.id} className="rounded-lg bg-[#f7f8f7] px-3 py-1.5 flex justify-between">
                        <span className="font-medium text-[#0b3d2e]">{s.name}</span>
                        <span className="font-mono text-slate-500">NIS: {s.nis} · Wali: {s.parentName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Arsip Semester Madrasah</h3>
                    <p className="text-[11px] text-slate-500">Rekam jejak rekapitulasi semester sebelumnya</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await onAdminRecordAction('archive_semester', 'add', {});
                      showToast('Snapshot arsip semester berhasil disimpan');
                    }}
                    className="rounded-lg bg-[#0b3d2e] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0a6b4a] cursor-pointer"
                  >
                    + Buat Snapshot Arsip Saat Ini
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {db.settings.semesterArchives.map((arc) => (
                    <div key={arc.id} className="flex items-center justify-between py-2 text-[12px]">
                      <div>
                        <span className="font-semibold text-[#0b3d2e]">
                          Tahun Ajaran {arc.academicYear} — Semester {arc.semester}
                        </span>
                        <span className="ml-2 text-slate-500">Diarsipkan: {arc.archivedAt}</span>
                      </div>
                      <span className="font-mono text-[#0a6b4a] font-medium">
                        {arc.totalStudents} Siswa · Kehadiran {arc.avgAttendance}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 8. MANAJEMEN PERANGKAT, RIWAYAT AKTIVITAS & KESEHATAN SISTEM */}
          {activeTab === 'perangkat_sistem' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 p-3 bg-[#f7f8f7]">
                  <p className="text-[11px] text-slate-500">Kesehatan Basis Data</p>
                  <p className="text-[15px] font-bold text-[#0a6b4a] mt-0.5">Optimal & Persisten</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Enkripsi Scrypt + Token HMAC</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-[#f7f8f7]">
                  <p className="text-[11px] text-slate-500">Total Entitas Tersimpan</p>
                  <p className="text-[15px] font-bold text-[#0b3d2e] font-mono mt-0.5">
                    {db.students.length} Siswa · {db.attendance.length} Absen
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{db.notes.length} Catatan · {db.bills.length} Tagihan</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 bg-[#f7f8f7]">
                  <p className="text-[11px] text-slate-500">Status PWA Android</p>
                  <p className="text-[15px] font-bold text-[#0b3d2e] mt-0.5">Siap Instal (Manifest Aktif)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Mendukung layar kecil & kamera</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Manajemen Perangkat Terdaftar</h3>
                <div className="divide-y divide-slate-100">
                  {db.settings.registeredDevices.map((dev) => (
                    <div key={dev.id} className="flex items-center justify-between py-2 text-[12px]">
                      <div>
                        <p className="font-medium text-[#0b3d2e]">{dev.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {dev.browser} · Aktif terakhir: <span className="font-mono">{dev.lastActive}</span>
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-[#0a6b4a]">{dev.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
                <h3 className="text-[14px] font-semibold text-[#0b3d2e]">Riwayat Aktivitas Terbaru (Audit Log)</h3>
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {db.logs.slice(0, 15).map((log) => (
                    <div key={log.id} className="py-1.5 text-[12px] flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-[#0b3d2e]">{log.action}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="text-slate-600">{log.detail}</span>
                        <span className="ml-1.5 text-[11px] text-slate-400">({log.userName})</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">{log.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Clean Direct Logout & Close */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-[#f7f8f7]">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-[12px] font-medium text-white hover:bg-red-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar / Logout Aplikasi</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Tutup Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
};
