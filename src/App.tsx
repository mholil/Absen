import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Database,
  CalendarCheck,
  FileBarChart2,
  Users,
  Clock,
  QrCode,
  UserX,
  Settings,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Edit3,
  UserCheck,
  ShieldCheck,
  Calendar,
  Award,
  AlertTriangle,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import {
  AppDatabase,
  User,
  Role,
  Student,
  AttendanceStatus,
  NoteType,
  BillType,
  SchoolSettings,
} from './types';
import { OfflineIndicator } from './components/PWAInstallButton';
import { QRScannerView, StudentQRCardModal } from './components/QRScannerModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';
import { StudentDetailModal } from './components/StudentDetailModal';
import { StudentFormModal } from './components/StudentFormModal';
import { ReportsView } from './components/ReportsView';
import { WaliClassAdminPanel } from './components/WaliClassAdminPanel';
import { AdminDataView } from './components/AdminDataView';
import { downloadJSONFile, exportToExcelXML } from './utils/exportUtils';
import { buildStudentWhatsAppPayload } from './utils/whatsappUtils';
import { WhatsAppPreviewModal, WhatsAppPayload } from './components/WhatsAppPreviewModal';

const TOKEN_STORAGE_KEY = 'absensi_mi_session_token_v2';
const LOCAL_DB_CACHE_KEY = 'absensi_mi_local_db_cache_v2';

// Helper component for circular donut progress (Jobie style)
const DonutRing: React.FC<{ percentage: number; color: string; label: string }> = ({
  percentage,
  color,
  label,
}) => {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-14 w-14 flex items-center justify-center">
        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="transparent"
            stroke="#f1f0f7"
            strokeWidth="5"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[11px] font-bold font-mono tabular-nums text-[#1f1b38]">
          {clamped}%
        </span>
      </div>
      <span className="mt-1 text-[11px] font-medium text-slate-500">{label}</span>
    </div>
  );
};

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active Navigation Tab (Strictly 4 per role)
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Student | null>(null);
  const [selectedStudentForQR, setSelectedStudentForQR] = useState<Student | null>(null);
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [waModalPayload, setWaModalPayload] = useState<WhatsAppPayload | null>(null);

  // Attendance Filter State
  const [attDate, setAttDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attClassId, setAttClassId] = useState<string>('ALL');
  const [attSearch, setAttSearch] = useState('');
  const [attMode, setAttMode] = useState<'hari_ini' | 'riwayat' | 'scan_qr'>('hari_ini');

  // Wali Kelas Student Tab Sub-view ('daftar' | 'administrasi')
  const [waliStudentSubView, setWaliStudentSubView] = useState<'daftar' | 'administrasi'>('daftar');
  const [waliSearch, setWaliSearch] = useState('');

  // Header Quick Search
  const [headerSearch, setHeaderSearch] = useState('');

  // Toast Notification
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 3200);
  };

  // Helper for authenticated API calls
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        performCleanLogout();
      }
      throw new Error(data.error || 'Terjadi kesalahan pada server.');
    }
    return data;
  };

  // Mirror full DB state to localStorage (when Admin or when non-empty) so data survives Cloud Run container restarts
  useEffect(() => {
    if (!db || !currentUser) return;
    if (currentUser.role === 'admin') {
      const hasData =
        db.students.length > 0 ||
        db.attendance.length > 0 ||
        db.bills.length > 0 ||
        db.notes.length > 0 ||
        db.settings.schoolName !== 'MADRASAH IBTIDAIYAH';
      if (hasData) {
        try {
          localStorage.setItem(LOCAL_DB_CACHE_KEY, JSON.stringify(db));
        } catch {
          // Ignore storage quota errors
        }
      }
    }
  }, [db, currentUser]);

  // Helper to check if server DB was reset on container restart and auto-restore from browser cache
  const syncOrRecoverDatabase = async (serverData: AppDatabase, activeToken: string): Promise<AppDatabase> => {
    const serverIsFreshEmpty =
      serverData.students.length === 0 &&
      serverData.attendance.length === 0 &&
      serverData.bills.length === 0 &&
      serverData.settings.schoolName === 'MADRASAH IBTIDAIYAH';

    if (serverIsFreshEmpty) {
      try {
        const cachedRaw = localStorage.getItem(LOCAL_DB_CACHE_KEY);
        if (cachedRaw) {
          const cachedDB = JSON.parse(cachedRaw) as AppDatabase;
          const cacheHasData =
            (cachedDB.students && cachedDB.students.length > 0) ||
            (cachedDB.attendance && cachedDB.attendance.length > 0) ||
            (cachedDB.settings && cachedDB.settings.schoolName !== 'MADRASAH IBTIDAIYAH');

          if (cacheHasData) {
            const restoreRes = await fetch('/api/restore', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${activeToken}`,
              },
              body: JSON.stringify({ data: cachedDB }),
            });
            if (restoreRes.ok) {
              const restoredPayload = await restoreRes.json();
              if (restoredPayload.data) {
                return restoredPayload.data;
              }
            }
          }
        }
      } catch {
        // Fallback to serverData if cache parse fails
      }
    }
    return serverData;
  };

  // Restore session on mount
  useEffect(() => {
    const verifyExistingSession = async () => {
      if (!token) {
        setLoadingAuth(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          performCleanLogout();
          return;
        }
        const payload = await res.json();
        const finalData = await syncOrRecoverDatabase(payload.data, token);
        setCurrentUser(payload.user);
        setDb(finalData);
        setDefaultTabForRole(payload.user.role, payload.user.classId);
      } catch {
        performCleanLogout();
      } finally {
        setLoadingAuth(false);
      }
    };
    verifyExistingSession();
  }, []);

  const setDefaultTabForRole = (role: Role, classId?: string) => {
    if (role === 'guru_piket') {
      setActiveTab('scan');
    } else {
      setActiveTab('dashboard');
    }
    if (role === 'wali_kelas' && classId) {
      setAttClassId(classId);
    } else {
      setAttClassId('ALL');
    }
  };

  // Strict Clean Logout: closes all modals/settings, clears token, returns directly to Login
  const performCleanLogout = () => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setIsSettingsOpen(false);
    setSelectedStudentForDetail(null);
    setSelectedStudentForQR(null);
    setIsStudentFormOpen(false);
    setEditingStudent(null);
    setToken(null);
    setCurrentUser(null);
    setDb(null);
    setLoginPassword('');
    setLoginError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setLoginError(payload.error || 'Login gagal. Periksa username dan password.');
        return;
      }
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      const finalData = await syncOrRecoverDatabase(payload.data, payload.token);
      setToken(payload.token);
      setCurrentUser(payload.user);
      setDb(finalData);
      setDefaultTabForRole(payload.user.role, payload.user.classId);
      showToast(`Selamat datang, ${payload.user.name}`);
    } catch {
      setLoginError('Gagal menghubungi server. Periksa koneksi jaringan Anda.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fillQuickLogin = (u: string, p: string) => {
    setLoginUsername(u);
    setLoginPassword(p);
    setLoginError(null);
  };

  // ==========================================
  // CRUD & ACTION HANDLERS
  // ==========================================
  const handleSaveStudent = async (payload: Partial<Student>) => {
    if (editingStudent) {
      const res = await apiFetch(`/api/students/${editingStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setDb(res.data);
      if (selectedStudentForDetail?.id === editingStudent.id) {
        setSelectedStudentForDetail(res.student);
      }
      showToast(`Data siswa ${res.student.name} berhasil diperbarui`);
    } else {
      const res = await apiFetch('/api/students', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setDb(res.data);
      showToast(`Siswa baru ${res.student.name} berhasil ditambahkan`);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    const res = await apiFetch(`/api/students/${id}`, { method: 'DELETE' });
    setDb(res.data);
    if (selectedStudentForDetail?.id === id) {
      setSelectedStudentForDetail(null);
    }
  };

  const handleRecordAttendance = async (
    studentId: string,
    status: AttendanceStatus,
    date?: string,
    note?: string
  ) => {
    const res = await apiFetch('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        studentId,
        status,
        date: date || attDate,
        note,
        method: 'manual',
      }),
    });
    setDb(res.data);
    showToast(`Status kehadiran diperbarui menjadi ${status}`);
  };

  const handleBatchAttendance = async (classId: string, date: string) => {
    const res = await apiFetch('/api/attendance/batch', {
      method: 'POST',
      body: JSON.stringify({ classId, date, status: 'Hadir' }),
    });
    setDb(res.data);
    showToast('Semua siswa yang belum absen telah ditandai Hadir');
  };

  const handleScanQR = async (qrCode: string) => {
    const res = await apiFetch('/api/attendance/qr', {
      method: 'POST',
      body: JSON.stringify({ qrCode }),
    });
    setDb(res.data);
    showToast(`Scan berhasil: ${res.student.name} (${res.record.status})`);
    return res;
  };

  const handleAddNote = async (payload: {
    studentId: string;
    type: NoteType;
    content: string;
    date: string;
    forwardToBK: boolean;
  }) => {
    const res = await apiFetch('/api/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setDb(res.data);
  };

  const handleDeleteNote = async (id: string) => {
    const res = await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
    setDb(res.data);
    showToast('Catatan siswa dihapus');
  };

  const handleAddBill = async (payload: {
    studentId: string;
    type: BillType;
    title: string;
    amount: number;
    period: string;
    dueDate: string;
    note: string;
  }) => {
    const res = await apiFetch('/api/bills', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setDb(res.data);
  };

  const handlePayBill = async (
    billId: string,
    payload: { amount: number; date: string; method: 'Tunai' | 'Transfer' | 'QRIS'; note: string }
  ) => {
    const res = await apiFetch(`/api/bills/${billId}/pay`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setDb(res.data);
  };

  const handleDeleteBill = async (id: string) => {
    const res = await apiFetch(`/api/bills/${id}`, { method: 'DELETE' });
    setDb(res.data);
  };

  // ==========================================
  // COMPUTED DASHBOARD METRICS
  // ==========================================
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const dashboardMetrics = useMemo(() => {
    if (!db || !currentUser) {
      return {
        totalStudents: 0,
        hadir: 0,
        terlambat: 0,
        izin: 0,
        sakit: 0,
        alpa: 0,
        belum: 0,
        percentage: 0,
        tepatWaktuPct: 0,
        terlambatPct: 0,
        izinSakitPct: 0,
        unrecordedList: [] as Student[],
        lateList: [] as { student: Student; timeIn: string; note?: string; className: string }[],
      };
    }

    const activeStudents = db.students.filter((s) => {
      if (s.status !== 'aktif') return false;
      if (currentUser.role === 'wali_kelas' && currentUser.classId) {
        return s.classId === currentUser.classId;
      }
      return true;
    });

    const todayAtt = db.attendance.filter((a) => {
      if (a.date !== todayStr) return false;
      if (currentUser.role === 'wali_kelas' && currentUser.classId) {
        return a.classId === currentUser.classId;
      }
      return true;
    });

    const hadir = todayAtt.filter((a) => a.status === 'Hadir').length;
    const terlambat = todayAtt.filter((a) => a.status === 'Terlambat').length;
    const izin = todayAtt.filter((a) => a.status === 'Izin').length;
    const sakit = todayAtt.filter((a) => a.status === 'Sakit').length;
    const alpa = todayAtt.filter((a) => a.status === 'Alpa').length;

    const recordedIds = new Set(todayAtt.map((a) => a.studentId));
    const unrecordedList = activeStudents.filter((s) => !recordedIds.has(s.id));
    const belum = unrecordedList.length;

    const total = activeStudents.length;
    const percentage = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;
    const tepatWaktuPct = total > 0 ? Math.round((hadir / total) * 100) : 0;
    const terlambatPct = total > 0 ? Math.round((terlambat / total) * 100) : 0;
    const izinSakitPct = total > 0 ? Math.round(((izin + sakit) / total) * 100) : 0;

    const lateList = todayAtt
      .filter((a) => a.status === 'Terlambat')
      .map((a) => {
        const st = db.students.find((s) => s.id === a.studentId);
        const cls = db.classes.find((c) => c.id === a.classId);
        return st
          ? {
              student: st,
              timeIn: a.timeIn,
              note: a.note,
              className: cls?.name || a.classId,
            }
          : null;
      })
      .filter(Boolean) as { student: Student; timeIn: string; note?: string; className: string }[];

    return {
      totalStudents: total,
      hadir,
      terlambat,
      izin,
      sakit,
      alpa,
      belum,
      percentage,
      tepatWaktuPct,
      terlambatPct,
      izinSakitPct,
      unrecordedList,
      lateList,
    };
  }, [db, currentUser, todayStr]);

  // ==========================================
  // BOTTOM & SIDEBAR NAVIGATION ITEMS PER ROLE (STRICTLY 4 ITEMS)
  // ==========================================
  const navItems = useMemo(() => {
    if (!currentUser) return [];
    switch (currentUser.role) {
      case 'admin':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'data', label: 'Data', icon: Database },
          { id: 'absensi', label: 'Absensi', icon: CalendarCheck },
          { id: 'laporan', label: 'Laporan', icon: FileBarChart2 },
        ];
      case 'wali_kelas':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'siswa', label: 'Siswa', icon: Users },
          { id: 'absensi', label: 'Absensi', icon: CalendarCheck },
          { id: 'laporan', label: 'Laporan', icon: FileBarChart2 },
        ];
      case 'kepala_sekolah':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'absensi', label: 'Absensi', icon: CalendarCheck },
          { id: 'laporan', label: 'Laporan', icon: FileBarChart2 },
          { id: 'terlambat', label: 'Terlambat', icon: Clock },
        ];
      case 'guru_piket':
        return [
          { id: 'scan', label: 'Scan Absen', icon: QrCode },
          { id: 'belum_hadir', label: 'Belum Hadir', icon: UserX },
          { id: 'absensi', label: 'Absensi', icon: CalendarCheck },
          { id: 'laporan', label: 'Laporan', icon: FileBarChart2 },
        ];
    }
  }, [currentUser]);

  // ==========================================
  // RENDER LOADING OR LOGIN SCREEN
  // ==========================================
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f2f8] p-4">
        <div className="text-center space-y-2">
          <div className="h-11 w-11 mx-auto rounded-full bg-[#3c1e96] flex items-center justify-center text-white font-bold text-[15px] shadow-md">
            MI
          </div>
          <p className="text-[13px] font-medium text-[#1f1b38]">Memuat Sistem Absensi Madrasah...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !db) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#f3f2f8] px-4 py-8">
        <OfflineIndicator />

        <div className="w-full max-w-sm rounded-2xl bg-white p-6 sm:p-7 border border-indigo-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-[#3c1e96] flex items-center justify-center text-white font-display font-bold text-[15px] shrink-0">
              MI
            </div>
            <div>
              <h1 className="text-[16px] font-bold tracking-tight text-[#1f1b38] leading-snug">
                Absensi MI
              </h1>
              <p className="text-[12px] text-slate-500">Administrasi & Kehadiran Siswa</p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#1f1b38] mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Masukkan username..."
                className="w-full rounded-xl border border-slate-200 bg-[#f3f2f8] px-3.5 py-2.5 text-[13px] text-[#1f1b38] focus:bg-white focus:border-[#4e36e2] focus:outline-none transition-colors"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#1f1b38] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Masukkan password..."
                className="w-full rounded-xl border border-slate-200 bg-[#f3f2f8] px-3.5 py-2.5 text-[13px] text-[#1f1b38] focus:bg-white focus:border-[#4e36e2] focus:outline-none transition-colors"
                required
                autoComplete="current-password"
              />
            </div>

            {loginError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-[12px] text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full rounded-xl bg-[#3c1e96] py-2.5 text-[13px] font-semibold text-white hover:bg-[#4e36e2] transition-colors cursor-pointer"
            >
              {isLoggingIn ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Gunakan akun resmi yang diberikan oleh Administrator Madrasah.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATED MAIN WORKSPACE (MINIMALIST MODERN WITH ROYAL PURPLE PALETTE)
  // ==========================================
  const canEditStudents =
    currentUser.role === 'admin' ||
    (currentUser.role === 'wali_kelas' && db.settings.rolePermissions.waliCanAddStudent);

  const homeroomClass = currentUser.classId
    ? db.classes.find((c) => c.id === currentUser.classId)
    : undefined;

  const activeNavTitle = navItems.find((n) => n.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#f3f2f8] text-[#1f1b38] flex flex-col lg:flex-row pb-20 lg:pb-0">
      <OfflineIndicator />

      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed top-16 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-medium text-white shadow-lg transition-all no-print ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-[#3c1e96]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-[#2bc155] shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ============================================================
          MINIMALIST ROYAL PURPLE SIDEBAR (Desktop lg+)
      ============================================================ */}
      <aside className="hidden lg:flex lg:w-60 bg-[#3c1e96] text-white flex-col justify-between shrink-0 min-h-screen select-none no-print">
        <div>
          {/* Brand Logo Lockup */}
          <div className="h-14 px-5 flex items-center gap-2.5 border-b border-white/10">
            <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center text-[#3c1e96] font-bold text-[12px] shrink-0">
              MI
            </div>
            <span className="font-display text-[15px] font-bold tracking-tight text-white truncate">
              Absensi MI
            </span>
          </div>

          {/* 4 Navigation Items */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] rounded-xl transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#3c1e96] font-bold shadow-2xs'
                      : 'text-indigo-100/85 hover:text-white hover:bg-white/10 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#3c1e96] stroke-[2.2]' : 'text-indigo-200 stroke-[1.8]'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-3.5 m-3 rounded-xl bg-white/10 text-[11px] text-indigo-100 space-y-1">
          <p className="font-semibold text-white truncate">{db.settings.schoolName}</p>
          <p className="text-indigo-200">
            T.A {db.settings.academicYear} · {db.settings.semester}
          </p>
          <p className="text-[10.5px] text-indigo-200/80 font-mono">
            Masuk {db.settings.timeInLimit} · Terlambat {db.settings.timeLateLimit}
          </p>
        </div>
      </aside>

      {/* ============================================================
          MAIN CONTENT AREA
      ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Minimalist Top Header */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3 border-b border-indigo-950/5 no-print">
          {/* Left: Page Title & Mobile Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="lg:hidden h-7 w-7 rounded-lg bg-[#3c1e96] flex items-center justify-center text-white font-bold text-[12px] shrink-0">
              MI
            </div>
            <h1 className="text-[15px] sm:text-[16px] font-bold text-[#1f1b38] truncate">
              {activeNavTitle}
            </h1>
            <span className="hidden md:inline text-slate-300">·</span>
            <span className="hidden md:inline text-[12px] text-slate-500 truncate">
              {db.settings.schoolName}
            </span>
          </div>

          {/* Right: Search, Settings Gear (Admin), User Profile & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:block relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={headerSearch}
                onChange={(e) => {
                  setHeaderSearch(e.target.value);
                  setAttSearch(e.target.value);
                  setWaliSearch(e.target.value);
                }}
                placeholder="Cari siswa / NIS..."
                className="w-full rounded-lg bg-[#f3f2f8] border border-transparent pl-8 pr-3 py-1.5 text-[12px] text-[#1f1b38] placeholder:text-slate-400 focus:bg-white focus:border-[#4e36e2] focus:outline-none"
              />
            </div>

            {currentUser.role === 'admin' && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-100 bg-white text-[#3c1e96] hover:bg-[#3c1e96] hover:text-white transition-colors cursor-pointer"
                title="Pengaturan Madrasah"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 text-[12px]">
              <span className="font-semibold text-[#1f1b38] truncate max-w-[130px]">
                {currentUser.name}
              </span>
            </div>

            <button
              onClick={performCleanLogout}
              className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Workspace Content */}
        <main className="flex-1 px-4 sm:px-6 py-5 max-w-6xl w-full mx-auto space-y-5">
          {/* ============================================================
              VIEW 1: DASHBOARD (Clean Minimalist Modern + Signature Colors)
          ============================================================ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              {/* Top Greeting & Quick Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-bold text-[#1f1b38] tracking-tight">
                    Ringkasan Kehadiran Hari Ini
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Tanggal <span className="font-mono">{todayStr}</span>
                    {homeroomClass ? ` · ${homeroomClass.name}` : ` · ${db.settings.schoolName}`}
                    {' · '}Total <span className="font-mono font-semibold text-[#3c1e96]">{dashboardMetrics.totalStudents}</span> siswa aktif
                  </p>
                </div>

                {currentUser.role !== 'kepala_sekolah' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (currentUser.role === 'guru_piket') {
                          setActiveTab('scan');
                        } else {
                          setActiveTab('absensi');
                          setAttMode('scan_qr');
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#3c1e96] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#4e36e2] transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Scan QR</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('absensi');
                        setAttMode('hari_ini');
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-white px-3.5 py-2 text-[12px] font-semibold text-[#3c1e96] hover:bg-indigo-50/50 transition-colors cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Input Absensi</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Row 1: 4 Signature Color Metric Cards (Minimalist & Clean) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="rounded-2xl bg-[#4e36e2] p-4 text-white">
                  <p className="text-[11.5px] font-medium text-indigo-100">Capaian Kehadiran</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[26px] font-bold font-mono tabular-nums">
                      {dashboardMetrics.percentage}%
                    </span>
                    <span className="text-[11px] text-indigo-100 font-mono">
                      {dashboardMetrics.hadir + dashboardMetrics.terlambat}/{dashboardMetrics.totalStudents} siswa
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#48a9f8] p-4 text-white">
                  <p className="text-[11.5px] font-medium text-sky-50">Siswa Hadir</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[26px] font-bold font-mono tabular-nums">
                      {dashboardMetrics.hadir}
                    </span>
                    <span className="text-[11px] text-sky-50">
                      Tepat waktu
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#2bc155] p-4 text-white">
                  <p className="text-[11.5px] font-medium text-emerald-50">Siswa Terlambat</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[26px] font-bold font-mono tabular-nums">
                      {dashboardMetrics.terlambat}
                    </span>
                    <span className="text-[11px] text-emerald-50 font-mono">
                      &gt; {db.settings.timeLateLimit}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#8bc740] p-4 text-white">
                  <p className="text-[11.5px] font-medium text-lime-50">Izin · Sakit · Alpa</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[26px] font-bold font-mono tabular-nums">
                      {dashboardMetrics.izin + dashboardMetrics.sakit + dashboardMetrics.alpa}
                    </span>
                    <span className="text-[11px] text-lime-50 font-mono">
                      I:{dashboardMetrics.izin} S:{dashboardMetrics.sakit} A:{dashboardMetrics.alpa}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: Clean 2-Column Workspace (Left: Kehadiran Per Kelas, Right: Siswa Belum Absen) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left (7 cols): Rekap Kehadiran Per Kelas */}
                <div className="lg:col-span-7 neu-card rounded-2xl p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-[14px] font-bold text-[#1f1b38]">Kehadiran Per Kelas</h3>
                      <p className="text-[11.5px] text-slate-500">Status kehadiran rombongan belajar hari ini</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('laporan')}
                      className="text-[12px] font-semibold text-[#4e36e2] hover:underline cursor-pointer"
                    >
                      Lihat Laporan →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 mt-1">
                    {db.classes.map((cls) => {
                      const clsStudents = db.students.filter((s) => s.classId === cls.id && s.status === 'aktif');
                      const clsAtt = db.attendance.filter((a) => a.classId === cls.id && a.date === todayStr);
                      const present = clsAtt.filter((a) => a.status === 'Hadir' || a.status === 'Terlambat').length;
                      const pct = clsStudents.length > 0 ? Math.round((present / clsStudents.length) * 100) : 0;

                      return (
                        <div key={cls.id} className="py-3 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#1f1b38]">{cls.name}</p>
                            <p className="text-[11px] text-slate-500">
                              Ruang {cls.roomNumber || '-'} · <span className="font-mono">{clsStudents.length}</span> siswa
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="w-24 sm:w-32 h-1.5 rounded-full bg-[#f3f2f8] overflow-hidden">
                              <div
                                className="h-full bg-[#4e36e2] rounded-full transition-all"
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-[12px] font-mono font-semibold text-[#1f1b38] w-16 text-right">
                              {present}/{clsStudents.length} ({pct}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right (5 cols): Siswa Belum Absen Hari Ini */}
                <div className="lg:col-span-5 neu-card rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-[14px] font-bold text-[#1f1b38]">
                          Belum Absen Hari Ini ({dashboardMetrics.unrecordedList.length})
                        </h3>
                        <p className="text-[11.5px] text-slate-500">Klik Tandai Hadir untuk mencatat cepat</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('absensi')}
                        className="text-[12px] font-semibold text-[#4e36e2] hover:underline cursor-pointer"
                      >
                        Semua →
                      </button>
                    </div>

                    {dashboardMetrics.totalStudents === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-[13px] font-medium text-slate-600">Belum ada data siswa</p>
                        <p className="text-[11.5px] text-slate-400 mt-1">
                          Tambahkan siswa melalui menu Data untuk mulai mencatat kehadiran.
                        </p>
                      </div>
                    ) : dashboardMetrics.unrecordedList.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-[13px] font-medium text-[#2bc155]">
                          Seluruh siswa telah tercatat kehadirannya hari ini.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 mt-1 max-h-72 overflow-y-auto">
                        {dashboardMetrics.unrecordedList.slice(0, 8).map((st) => {
                          const cls = db.classes.find((c) => c.id === st.classId);
                          return (
                            <div key={st.id} className="py-2.5 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-[#1f1b38] truncate">{st.name}</p>
                                <p className="text-[11px] text-slate-400">
                                  {cls?.name || st.classId} · NIS <span className="font-mono">{st.nis}</span>
                                </p>
                              </div>
                              {currentUser.role !== 'kepala_sekolah' && (
                                <button
                                  onClick={() => handleRecordAttendance(st.id, 'Hadir', todayStr)}
                                  className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-[#3c1e96] hover:bg-[#3c1e96] hover:text-white transition-colors shrink-0 cursor-pointer"
                                >
                                  Tandai Hadir
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Jam Masuk: {db.settings.timeInLimit} WIB</span>
                    <span>Batas Terlambat: {db.settings.timeLateLimit} WIB</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              VIEW 2: ADMIN DATA (Siswa, Guru/Staf, Kelas, Akun, Tunggakan)
          ============================================================ */}
          {activeTab === 'data' && currentUser.role === 'admin' && (
            <AdminDataView
              db={db}
              onAddStudentClick={() => {
                setEditingStudent(null);
                setIsStudentFormOpen(true);
              }}
              onEditStudentClick={(st) => {
                setEditingStudent(st);
                setIsStudentFormOpen(true);
              }}
              onDeleteStudent={handleDeleteStudent}
              onSelectStudentDetail={(st) => setSelectedStudentForDetail(st)}
              onShowQR={(st) => setSelectedStudentForQR(st)}
              onSaveClass={async (payload) => {
                const res = await apiFetch('/api/classes', {
                  method: 'POST',
                  body: JSON.stringify(payload),
                });
                setDb(res.data);
              }}
              onDeleteClass={async (id) => {
                const res = await apiFetch(`/api/classes/${id}`, { method: 'DELETE' });
                setDb(res.data);
              }}
              onSaveUser={async (payload) => {
                const res = await apiFetch('/api/users', {
                  method: 'POST',
                  body: JSON.stringify(payload),
                });
                setDb(res.data);
              }}
              onDeleteUser={async (id) => {
                const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
                setDb(res.data);
              }}
              onAddBill={handleAddBill}
              onPayBill={handlePayBill}
              onDeleteBill={handleDeleteBill}
              onImportStudents={async (list) => {
                for (const item of list) {
                  await apiFetch('/api/students', {
                    method: 'POST',
                    body: JSON.stringify(item),
                  });
                }
                const fresh = await apiFetch('/api/bootstrap');
                setDb(fresh);
              }}
              showToast={showToast}
            />
          )}

          {/* ============================================================
              VIEW 3: WALI KELAS — SISWA & ADMINISTRASI KELAS
          ============================================================ */}
          {activeTab === 'siswa' && currentUser.role === 'wali_kelas' && (
            <div className="neu-card rounded-2xl p-4 sm:p-5 space-y-4">
              {/* Single Clean Toolbar: Sub-Tab Switcher + Primary Action */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5 no-print">
                <div className="inline-flex items-center gap-1 rounded-xl bg-[#f3f2f8] p-1">
                  <button
                    onClick={() => setWaliStudentSubView('daftar')}
                    className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                      waliStudentSubView === 'daftar'
                        ? 'bg-[#3c1e96] text-white'
                        : 'text-slate-600 hover:text-[#1f1b38]'
                    }`}
                  >
                    Siswa {homeroomClass?.name} ({db.students.length})
                  </button>
                  <button
                    onClick={() => setWaliStudentSubView('administrasi')}
                    className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                      waliStudentSubView === 'administrasi'
                        ? 'bg-[#3c1e96] text-white'
                        : 'text-slate-600 hover:text-[#1f1b38]'
                    }`}
                  >
                    Administrasi Kelas
                  </button>
                </div>

                {waliStudentSubView === 'daftar' && (
                  <div className="flex items-center gap-2">
                    <div className="relative w-44 sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={waliSearch}
                        onChange={(e) => setWaliSearch(e.target.value)}
                        placeholder="Cari siswa / NIS..."
                        className="w-full rounded-xl border border-slate-200 bg-[#f3f2f8] pl-8 pr-3 py-1.5 text-[12px] focus:bg-white focus:border-[#4e36e2] focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const headers = ['NIS', 'NISN', 'Nama Siswa', 'L/P', 'Orang Tua / Wali', 'No HP', 'Pekerjaan', 'Alamat'];
                        const rows = db.students.map((s) => [
                          s.nis,
                          s.nisn || '-',
                          s.name,
                          s.gender,
                          s.parentName || '-',
                          s.parentPhone || '-',
                          s.parentJob || '-',
                          s.address || '-',
                        ]);
                        exportToExcelXML(`Daftar_Siswa_${homeroomClass?.name || 'Kelas'}`, 'Daftar Siswa', headers, rows);
                        showToast('Daftar siswa kelas berhasil diekspor ke Excel (.xlsx)');
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-[#1f1b38] hover:bg-slate-50 cursor-pointer"
                    >
                      Excel
                    </button>
                    {canEditStudents && (
                      <button
                        onClick={() => {
                          setEditingStudent(null);
                          setIsStudentFormOpen(true);
                        }}
                        className="flex items-center gap-1 rounded-xl bg-[#3c1e96] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4e36e2] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {waliStudentSubView === 'daftar' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 px-3 font-semibold">NIS</th>
                        <th className="py-2.5 px-3 font-semibold">Nama Siswa</th>
                        <th className="py-2.5 px-3 font-semibold">Orang Tua / Wali</th>
                        <th className="py-2.5 px-3 font-semibold">No. HP</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {db.students
                        .filter(
                          (s) =>
                            !waliSearch.trim() ||
                            s.name.toLowerCase().includes(waliSearch.toLowerCase()) ||
                            s.nis.includes(waliSearch)
                        )
                        .map((st) => (
                          <tr key={st.id} className="hover:bg-indigo-50/30">
                            <td className="py-2.5 px-3 font-mono text-slate-600">{st.nis}</td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => setSelectedStudentForDetail(st)}
                                className="font-semibold text-[#1f1b38] hover:text-[#4e36e2] text-left cursor-pointer"
                              >
                                {st.name}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{st.parentName || '-'}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{st.parentPhone || '-'}</td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const payload = buildStudentWhatsAppPayload({
                                      student: st,
                                      classRoom: homeroomClass,
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
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-[#2bc155] hover:bg-[#2bc155] hover:text-white transition-colors cursor-pointer"
                                  title="Kirim WhatsApp ke Orang Tua"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>WA</span>
                                </button>
                                <button
                                  onClick={() => setSelectedStudentForQR(st)}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-[#3c1e96] hover:bg-indigo-50 cursor-pointer"
                                  title="Kartu QR Siswa"
                                >
                                  QR
                                </button>
                                <button
                                  onClick={() => setSelectedStudentForDetail(st)}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-[#1f1b38] hover:bg-slate-100 cursor-pointer"
                                >
                                  Detail
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <WaliClassAdminPanel
                  db={db}
                  classId={currentUser.classId || 'kls-1a'}
                  onAddNote={handleAddNote}
                  onDeleteNote={handleDeleteNote}
                  onAddBill={handleAddBill}
                  onPayBill={handlePayBill}
                  onAdminRecordAction={async (entity, action, payload) => {
                    const res = await apiFetch('/api/admin-records', {
                      method: 'POST',
                      body: JSON.stringify({ entity, action, payload }),
                    });
                    setDb(res.data);
                  }}
                  showToast={showToast}
                />
              )}
            </div>
          )}

          {/* ============================================================
              VIEW 4: ABSENSI (All 4 Roles: Compact Toolbar & Clean Status Buttons)
          ============================================================ */}
          {activeTab === 'absensi' && (
            <div className="neu-card rounded-2xl p-4 sm:p-5 space-y-4">
              {/* Single-row Mode & Action Header */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5">
                <div className="inline-flex items-center gap-1 bg-[#f3f2f8] p-1 rounded-xl">
                  <button
                    onClick={() => {
                      setAttMode('hari_ini');
                      setAttDate(todayStr);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                      attMode === 'hari_ini' ? 'bg-[#3c1e96] text-white' : 'text-slate-600 hover:text-[#1f1b38]'
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    onClick={() => setAttMode('riwayat')}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                      attMode === 'riwayat' ? 'bg-[#3c1e96] text-white' : 'text-slate-600 hover:text-[#1f1b38]'
                    }`}
                  >
                    Riwayat Tanggal
                  </button>
                  {currentUser.role !== 'kepala_sekolah' && (
                    <button
                      onClick={() => setAttMode('scan_qr')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
                        attMode === 'scan_qr'
                          ? 'bg-[#4e36e2] text-white'
                          : 'text-[#3c1e96] hover:bg-indigo-100/60'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Scan QR</span>
                    </button>
                  )}
                </div>

                {currentUser.role !== 'kepala_sekolah' && attMode !== 'scan_qr' && (
                  <button
                    onClick={() =>
                      handleBatchAttendance(
                        currentUser.role === 'wali_kelas' ? currentUser.classId || 'ALL' : attClassId,
                        attDate
                      )
                    }
                    className="flex items-center gap-1.5 rounded-xl bg-[#2bc155] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#24a648] transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Hadir Semua</span>
                  </button>
                )}
              </div>

              {attMode === 'scan_qr' && currentUser.role !== 'kepala_sekolah' ? (
                <QRScannerView
                  students={db.students.filter((s) => s.status === 'aktif')}
                  classes={db.classes}
                  onScanCode={handleScanQR}
                />
              ) : (
                <>
                  {/* Compact Inline Filter Bar */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="date"
                      value={attDate}
                      onChange={(e) => setAttDate(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-[#f3f2f8] px-3 py-1.5 text-[12px] font-mono focus:bg-white focus:border-[#4e36e2] focus:outline-none"
                    />
                    <select
                      value={currentUser.role === 'wali_kelas' ? currentUser.classId : attClassId}
                      onChange={(e) => setAttClassId(e.target.value)}
                      disabled={currentUser.role === 'wali_kelas'}
                      className="rounded-xl border border-slate-200 bg-[#f3f2f8] px-3 py-1.5 text-[12px] disabled:bg-slate-100 focus:bg-white focus:border-[#4e36e2] focus:outline-none"
                    >
                      {currentUser.role !== 'wali_kelas' && <option value="ALL">Semua Kelas</option>}
                      {db.classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={attSearch}
                        onChange={(e) => setAttSearch(e.target.value)}
                        placeholder="Cari nama atau NIS siswa..."
                        className="w-full rounded-xl border border-slate-200 bg-[#f3f2f8] pl-8 pr-3 py-1.5 text-[12px] focus:bg-white focus:border-[#4e36e2] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Clean Attendance Table with Compact H / T / I / S / A Segmented Buttons */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[12px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 px-3 font-semibold">Nama Siswa</th>
                          <th className="py-2.5 px-3 font-semibold">Kelas</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Jam</th>
                          <th className="py-2.5 px-3 font-semibold text-right">
                            {currentUser.role === 'kepala_sekolah' ? 'Keterangan' : 'Pilih Status'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {db.students
                          .filter((s) => {
                            if (s.status !== 'aktif') return false;
                            if (currentUser.role === 'wali_kelas' && currentUser.classId) {
                              if (s.classId !== currentUser.classId) return false;
                            } else if (attClassId !== 'ALL' && s.classId !== attClassId) {
                              return false;
                            }
                            if (attSearch.trim()) {
                              const q = attSearch.toLowerCase();
                              return s.name.toLowerCase().includes(q) || s.nis.includes(q);
                            }
                            return true;
                          })
                          .map((st) => {
                            const cls = db.classes.find((c) => c.id === st.classId);
                            const rec = db.attendance.find((a) => a.studentId === st.id && a.date === attDate);
                            const currentStatus: AttendanceStatus = rec?.status || 'Belum';

                            return (
                              <tr key={st.id} className="hover:bg-indigo-50/30">
                                <td className="py-2.5 px-3">
                                  <button
                                    onClick={() => setSelectedStudentForDetail(st)}
                                    className="font-semibold text-[#1f1b38] hover:text-[#4e36e2] text-left cursor-pointer"
                                  >
                                    {st.name}
                                  </button>
                                  <span className="block font-mono text-[10.5px] text-slate-400">NIS {st.nis}</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">{cls?.name || st.classId}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`font-semibold ${
                                      currentStatus === 'Hadir'
                                        ? 'text-[#2bc155]'
                                        : currentStatus === 'Terlambat'
                                        ? 'text-amber-500'
                                        : currentStatus === 'Alpa'
                                        ? 'text-red-500'
                                        : currentStatus === 'Belum'
                                        ? 'text-slate-400'
                                        : 'text-[#48a9f8]'
                                    }`}
                                  >
                                    {currentStatus}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">{rec?.timeIn || '-'}</td>
                                <td className="py-2.5 px-3 text-right">
                                  {currentUser.role === 'kepala_sekolah' ? (
                                    <span className="text-slate-500 text-[11px]">{rec?.note || '-'}</span>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 rounded-xl bg-[#f3f2f8] p-1">
                                      {(
                                        [
                                          { val: 'Hadir', short: 'Hadir' },
                                          { val: 'Terlambat', short: 'Telat' },
                                          { val: 'Izin', short: 'Izin' },
                                          { val: 'Sakit', short: 'Sakit' },
                                          { val: 'Alpa', short: 'Alpa' },
                                        ] as { val: AttendanceStatus; short: string }[]
                                      ).map((opt) => {
                                        const active = currentStatus === opt.val;
                                        return (
                                          <button
                                            key={opt.val}
                                            onClick={() => handleRecordAttendance(st.id, opt.val, attDate)}
                                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                                              active
                                                ? 'bg-[#3c1e96] text-white'
                                                : 'text-slate-600 hover:bg-white hover:text-[#1f1b38]'
                                            }`}
                                          >
                                            {opt.short}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============================================================
              VIEW 5: LAPORAN (All 4 Roles: Excel, PDF, Cetak)
          ============================================================ */}
          {activeTab === 'laporan' && (
            <ReportsView
              db={db}
              role={currentUser.role}
              userClassId={currentUser.classId}
              showToast={showToast}
            />
          )}

          {/* ============================================================
              VIEW 6: KEPALA SEKOLAH — TERLAMBAT (Monitoring Siswa Terlambat)
          ============================================================ */}
          {activeTab === 'terlambat' && currentUser.role === 'kepala_sekolah' && (
            <div className="neu-card rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-bold text-[#1f1b38]">
                    Monitoring Keterlambatan Siswa
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Jam masuk: <span className="font-mono">{db.settings.timeInLimit}</span> · Batas terlambat:{' '}
                    <span className="font-mono">{db.settings.timeLateLimit}</span>
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                      <th className="py-2.5 px-3 font-semibold">Jam Datang</th>
                      <th className="py-2.5 px-3 font-semibold">Nama Siswa</th>
                      <th className="py-2.5 px-3 font-semibold">Kelas</th>
                      <th className="py-2.5 px-3 font-semibold">Keterangan</th>
                      <th className="py-2.5 px-3 font-semibold">Petugas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {db.attendance
                      .filter((a) => a.status === 'Terlambat')
                      .map((a) => {
                        const st = db.students.find((s) => s.id === a.studentId);
                        const cls = db.classes.find((c) => c.id === a.classId);
                        return (
                          <tr key={a.id} className="hover:bg-indigo-50/30">
                            <td className="py-2.5 px-3 font-mono text-slate-600">{a.date}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-600">{a.timeIn} WIB</td>
                            <td className="py-2.5 px-3 font-semibold text-[#1f1b38]">{st?.name || a.studentId}</td>
                            <td className="py-2.5 px-3 text-slate-600">{cls?.name || a.classId}</td>
                            <td className="py-2.5 px-3 text-slate-700">{a.note || '-'}</td>
                            <td className="py-2.5 px-3 text-slate-500">{a.recordedBy}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================
              VIEW 7: GURU PIKET — SCAN ABSEN QR
          ============================================================ */}
          {activeTab === 'scan' && currentUser.role === 'guru_piket' && (
            <QRScannerView
              students={db.students.filter((s) => s.status === 'aktif')}
              classes={db.classes}
              onScanCode={handleScanQR}
            />
          )}

          {/* ============================================================
              VIEW 8: GURU PIKET — BELUM HADIR (Siswa Belum Absen Hari Ini)
          ============================================================ */}
          {activeTab === 'belum_hadir' && currentUser.role === 'guru_piket' && (
            <div className="neu-card rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-[15px] font-bold text-[#1f1b38]">
                    Siswa Belum Hadir ({dashboardMetrics.unrecordedList.length})
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Klik tombol status untuk mencatat kehadiran siswa
                  </p>
                </div>
                {dashboardMetrics.unrecordedList.length > 0 && (
                  <button
                    onClick={() => handleBatchAttendance('ALL', todayStr)}
                    className="rounded-xl bg-[#2bc155] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#24a648] cursor-pointer"
                  >
                    Hadir Semua
                  </button>
                )}
              </div>

              {dashboardMetrics.unrecordedList.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] font-medium text-[#2bc155]">
                    Seluruh siswa telah tercatat kehadirannya hari ini ({todayStr}).
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {dashboardMetrics.unrecordedList.map((st) => {
                    const cls = db.classes.find((c) => c.id === st.classId);
                    return (
                      <div
                        key={st.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-[#1f1b38]">{st.name}</p>
                          <p className="text-[11.5px] text-slate-500">
                            {cls?.name || st.classId} · NIS <span className="font-mono">{st.nis}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
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
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-[#2bc155] hover:bg-[#2bc155] hover:text-white transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA</span>
                          </button>
                          <div className="inline-flex items-center gap-1 rounded-xl bg-[#f3f2f8] p-1">
                            {(['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((statusOpt) => (
                              <button
                                key={statusOpt}
                                onClick={() => handleRecordAttendance(st.id, statusOpt, todayStr)}
                                className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#1f1b38] hover:bg-[#3c1e96] hover:text-white transition-colors cursor-pointer"
                              >
                                {statusOpt === 'Terlambat' ? 'Telat' : statusOpt}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ============================================================
          FIXED BOTTOM NAVIGATION (MINIMALIST ROYAL PURPLE, 4 ITEMS PER ROLE)
      ============================================================ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#3c1e96] text-white px-3 py-1.5 shadow-lg no-print">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center rounded-xl py-1.5 px-1 min-h-[46px] transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#3c1e96] font-bold'
                    : 'text-indigo-200 hover:text-white font-medium'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-[#3c1e96] stroke-[2.3]' : 'stroke-[1.75]'}`}
                />
                <span className="mt-0.5 text-[10.5px] leading-tight tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ============================================================
          MODALS (Scrollable, Bounded Height, Working X & Cancel)
      ============================================================ */}
      <AdminSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        db={db}
        currentUser={currentUser}
        onSaveSettings={async (newSettings: Partial<SchoolSettings>) => {
          const res = await apiFetch('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(newSettings),
          });
          setDb(res.data);
        }}
        onChangePassword={async (targetUserId: string, newPassword: string) => {
          const res = await apiFetch('/api/users/change-password', {
            method: 'POST',
            body: JSON.stringify({ targetUserId, newPassword }),
          });
          setDb(res.data);
        }}
        onAdminRecordAction={async (entity: string, action: string, payload: any) => {
          const res = await apiFetch('/api/admin-records', {
            method: 'POST',
            body: JSON.stringify({ entity, action, payload }),
          });
          setDb(res.data);
        }}
        onBackupDownload={async () => {
          const backup = await apiFetch('/api/backup');
          downloadJSONFile(`Backup_Absensi_MI_${todayStr}.json`, backup);
          showToast('File Backup JSON berhasil diunduh');
        }}
        onRestoreUpload={async (jsonData: any) => {
          const res = await apiFetch('/api/restore', {
            method: 'POST',
            body: JSON.stringify(jsonData),
          });
          setDb(res.data);
          return res.message;
        }}
        onLogout={performCleanLogout}
        showToast={showToast}
      />

      <StudentDetailModal
        student={selectedStudentForDetail}
        classRoom={
          selectedStudentForDetail
            ? db.classes.find((c) => c.id === selectedStudentForDetail.classId)
            : undefined
        }
        schoolName={db.settings.schoolName}
        settings={db.settings}
        notes={db.notes}
        bills={db.bills}
        payments={db.payments}
        attendance={db.attendance}
        canManage={currentUser.role === 'admin' || currentUser.role === 'wali_kelas'}
        onClose={() => setSelectedStudentForDetail(null)}
        onEditStudent={(st) => {
          setSelectedStudentForDetail(null);
          setEditingStudent(st);
          setIsStudentFormOpen(true);
        }}
        onShowQR={(st) => setSelectedStudentForQR(st)}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
        onAddBill={handleAddBill}
        onPayBill={handlePayBill}
        showToast={showToast}
      />

      <StudentFormModal
        isOpen={isStudentFormOpen}
        editingStudent={editingStudent}
        classes={db.classes}
        userRole={currentUser.role}
        userClassId={currentUser.classId}
        onClose={() => {
          setIsStudentFormOpen(false);
          setEditingStudent(null);
        }}
        onSave={handleSaveStudent}
      />

      <StudentQRCardModal
        student={selectedStudentForQR}
        classRoom={
          selectedStudentForQR
            ? db.classes.find((c) => c.id === selectedStudentForQR.classId)
            : undefined
        }
        schoolName={db.settings.schoolName}
        onClose={() => setSelectedStudentForQR(null)}
      />

      <WhatsAppPreviewModal
        payload={waModalPayload}
        onClose={() => setWaModalPayload(null)}
        showToast={showToast}
      />
    </div>
  );
}
