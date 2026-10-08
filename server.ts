import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer, build as buildVite } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Create clean valid 1x1 PNG with #0b3d2e color as fallback for PWA icon files if missing
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
['pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png', 'apple-touch-icon.png'].forEach((file) => {
  const filePath = path.join(PUBLIC_DIR, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Buffer.from(PNG_BASE64, 'base64'));
  }
});

// Password Hashing Utility (Never store plaintext passwords)
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, useSalt, 64).toString('hex');
  return { hash, salt: useSalt };
}

function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// Session Token Management
const SECRET_KEY = process.env.SESSION_SECRET || 'mi-nurul-huda-secret-key-2026-secure';

interface SessionPayload {
  userId: string;
  username: string;
  role: 'admin' | 'kepala_sekolah' | 'wali_kelas' | 'guru_piket';
  classId?: string;
  name: string;
  exp: number;
}

function createToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token: string): SessionPayload | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;
    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as SessionPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPastDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Clean Initial Database (No dummy students/attendance/bills/notes)
function createInitialDatabase() {
  const adminPass = hashPassword('admin123');
  const kepalaPass = hashPassword('kepala123');
  const waliPass = hashPassword('wali123');
  const piketPass = hashPassword('piket123');

  const users = [
    {
      id: 'usr-admin',
      username: 'admin',
      name: 'Administrator Madrasah',
      nip: '-',
      role: 'admin',
      phone: '',
      position: 'Admin & Operator Madrasah',
      status: 'aktif',
      passwordHash: adminPass.hash,
      passwordSalt: adminPass.salt,
    },
    {
      id: 'usr-kepala',
      username: 'kepala',
      name: 'Kepala Madrasah',
      nip: '-',
      role: 'kepala_sekolah',
      phone: '',
      position: 'Kepala Madrasah',
      status: 'aktif',
      passwordHash: kepalaPass.hash,
      passwordSalt: kepalaPass.salt,
    },
    {
      id: 'usr-wali1',
      username: 'wali',
      name: 'Wali Kelas 1',
      nip: '-',
      role: 'wali_kelas',
      classId: 'kls-1a',
      phone: '',
      position: 'Wali Kelas 1',
      status: 'aktif',
      passwordHash: waliPass.hash,
      passwordSalt: waliPass.salt,
    },
    {
      id: 'usr-piket',
      username: 'piket',
      name: 'Guru Piket',
      nip: '-',
      role: 'guru_piket',
      phone: '',
      position: 'Guru Piket Harian',
      status: 'aktif',
      passwordHash: piketPass.hash,
      passwordSalt: piketPass.salt,
    },
  ];

  const classes = [
    { id: 'kls-1a', name: 'Kelas 1', level: 1, homeroomTeacherId: 'usr-wali1', roomNumber: 'R.01', academicYear: '2026/2027' },
    { id: 'kls-2a', name: 'Kelas 2', level: 2, homeroomTeacherId: '', roomNumber: 'R.02', academicYear: '2026/2027' },
    { id: 'kls-3a', name: 'Kelas 3', level: 3, homeroomTeacherId: '', roomNumber: 'R.03', academicYear: '2026/2027' },
    { id: 'kls-4a', name: 'Kelas 4', level: 4, homeroomTeacherId: '', roomNumber: 'R.04', academicYear: '2026/2027' },
    { id: 'kls-5a', name: 'Kelas 5', level: 5, homeroomTeacherId: '', roomNumber: 'R.05', academicYear: '2026/2027' },
    { id: 'kls-6a', name: 'Kelas 6', level: 6, homeroomTeacherId: '', roomNumber: 'R.06', academicYear: '2026/2027' },
  ];

  const students: any[] = [];
  const attendance: any[] = [];
  const notes: any[] = [];
  const bills: any[] = [];
  const payments: any[] = [];
  const holidays: any[] = [];
  const schedules: any[] = [];
  const announcements: any[] = [];
  const mutations: any[] = [];
  const promotions: any[] = [];
  const alumni: any[] = [];
  const logs: any[] = [];

  const settings = {
    schoolName: 'MADRASAH IBTIDAIYAH',
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

  return {
    users,
    classes,
    students,
    attendance,
    notes,
    bills,
    payments,
    holidays,
    schedules,
    logs,
    announcements,
    mutations,
    promotions,
    alumni,
    settings,
  };
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

function saveDB(db: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function sanitizeUsers(users: any[]) {
  return users.map(({ passwordHash, passwordSalt, ...rest }) => rest);
}

function sanitizeDBForClient(db: any, user: SessionPayload) {
  const cleanUsers = sanitizeUsers(db.users || []);

  // Wali Kelas strict isolation: only sees their own class data
  if (user.role === 'wali_kelas' && user.classId) {
    const cid = user.classId;
    return {
      ...db,
      users: cleanUsers.filter((u) => u.id === user.userId || u.role === 'admin' || u.role === 'kepala_sekolah'),
      classes: (db.classes || []).filter((c: any) => c.id === cid),
      students: (db.students || []).filter((s: any) => s.classId === cid),
      attendance: (db.attendance || []).filter((a: any) => a.classId === cid),
      notes: (db.notes || []).filter((n: any) => n.classId === cid),
      bills: (db.bills || []).filter((b: any) => b.classId === cid),
      payments: (db.payments || []).filter((p: any) => {
        const st = (db.students || []).find((s: any) => s.id === p.studentId);
        return st && st.classId === cid;
      }),
      schedules: (db.schedules || []).filter((sc: any) => sc.classId === cid),
      announcements: (db.announcements || []).filter((an: any) => an.targetClassId === 'ALL' || an.targetClassId === cid),
      mutations: (db.mutations || []).filter((m: any) => m.classId === cid),
      promotions: (db.promotions || []).filter((pr: any) => pr.fromClassId === cid),
    };
  }

  return {
    ...db,
    users: cleanUsers,
  };
}

function addLog(db: any, user: SessionPayload, action: string, detail: string) {
  const now = new Date();
  const timestamp = `${getTodayStr()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  db.logs = [
    {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user.userId,
      userName: user.name,
      role: user.role,
      action,
      detail,
      timestamp,
    },
    ...(db.logs || []).slice(0, 199),
  ];
}

// Express Auth Middleware
interface AuthRequest extends Request {
  user?: SessionPayload;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login kembali.' });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi telah berakhir atau tidak valid. Silakan login kembali.' });
    return;
  }
  req.user = payload;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Ensure DB is initialized
  loadDB();

  // ==========================================
  // 1. AUTHENTICATION ROUTES
  // ==========================================
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username dan password wajib diisi.' });
      return;
    }

    const db = loadDB();
    const cleanInput = String(username).trim().toLowerCase();

    // Support legacy compatibility aliases (e.g. kepsek -> kepala, walikelas -> wali, gurupiket -> piket)
    const aliasMap: Record<string, string> = {
      kepsek: 'kepala',
      kepala_sekolah: 'kepala',
      walikelas: 'wali',
      wali_kelas: 'wali',
      wali1: 'wali',
      gurupiket: 'piket',
      guru_piket: 'piket',
    };
    const resolvedUsername = aliasMap[cleanInput] || cleanInput;

    const user = db.users.find((u: any) => u.username.toLowerCase() === resolvedUsername);
    if (!user) {
      res.status(401).json({ error: 'Username atau password tidak sesuai.' });
      return;
    }

    if (user.status === 'nonaktif') {
      res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan oleh Admin.' });
      return;
    }

    const isValid = verifyPassword(String(password), user.passwordHash, user.passwordSalt);
    if (!isValid) {
      res.status(401).json({ error: 'Username atau password tidak sesuai.' });
      return;
    }

    const sessionUser: Omit<SessionPayload, 'exp'> = {
      userId: user.id,
      username: user.username,
      role: user.role,
      classId: user.classId,
      name: user.name,
    };

    const token = createToken(sessionUser);
    addLog(db, { ...sessionUser, exp: 0 }, 'Login Aplikasi', `Login berhasil sebagai ${user.position}`);
    saveDB(db);

    const { passwordHash, passwordSalt, ...safeUser } = user;
    res.json({
      token,
      user: safeUser,
      data: sanitizeDBForClient(db, { ...sessionUser, exp: 0 }),
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
    const db = loadDB();
    const user = db.users.find((u: any) => u.id === req.user!.userId);
    if (!user) {
      res.status(401).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    const { passwordHash, passwordSalt, ...safeUser } = user;
    res.json({
      user: safeUser,
      data: sanitizeDBForClient(db, req.user!),
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthRequest, res: Response) => {
    const db = loadDB();
    addLog(db, req.user!, 'Logout Aplikasi', 'Keluar dari sesi aplikasi');
    saveDB(db);
    res.json({ success: true });
  });

  // ==========================================
  // 2. BOOTSTRAP / SYNC STATE
  // ==========================================
  app.get('/api/bootstrap', requireAuth, (req: AuthRequest, res: Response) => {
    const db = loadDB();
    res.json(sanitizeDBForClient(db, req.user!));
  });

  // ==========================================
  // 3. STUDENTS CRUD (Admin & Wali Kelas own class)
  // ==========================================
  app.post('/api/students', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'wali_kelas') {
      res.status(403).json({ error: 'Akses ditolak. Hanya Admin dan Wali Kelas yang dapat menambah siswa.' });
      return;
    }

    const db = loadDB();
    const body = req.body;
    const targetClassId = user.role === 'wali_kelas' ? user.classId : body.classId;

    if (!targetClassId || !body.name || !body.nis) {
      res.status(400).json({ error: 'NIS, Nama Siswa, dan Kelas wajib diisi.' });
      return;
    }

    const newStudent = {
      id: `std-${Date.now()}`,
      nis: String(body.nis).trim(),
      nisn: String(body.nisn || '').trim(),
      name: String(body.name).trim(),
      gender: body.gender === 'P' ? 'P' : 'L',
      classId: targetClassId,
      parentName: String(body.parentName || '').trim(),
      parentPhone: String(body.parentPhone || '').trim(),
      parentJob: String(body.parentJob || '').trim(),
      emergencyContact: String(body.emergencyContact || '').trim(),
      address: String(body.address || '').trim(),
      qrCode: `MI-${String(body.nis).trim()}`,
      status: body.status || 'aktif',
      createdAt: getTodayStr(),
    };

    db.students.push(newStudent);
    addLog(db, user, 'Tambah Siswa', `Menambahkan siswa baru: ${newStudent.name} (NIS: ${newStudent.nis})`);
    saveDB(db);
    res.json({ student: newStudent, data: sanitizeDBForClient(db, user) });
  });

  app.put('/api/students/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'wali_kelas') {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }

    const db = loadDB();
    const idx = db.students.findIndex((s: any) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
      return;
    }

    if (user.role === 'wali_kelas' && db.students[idx].classId !== user.classId) {
      res.status(403).json({ error: 'Wali Kelas hanya boleh mengubah data siswa di kelasnya sendiri.' });
      return;
    }

    const body = req.body;
    const updated = {
      ...db.students[idx],
      nis: body.nis !== undefined ? String(body.nis).trim() : db.students[idx].nis,
      nisn: body.nisn !== undefined ? String(body.nisn).trim() : db.students[idx].nisn,
      name: body.name !== undefined ? String(body.name).trim() : db.students[idx].name,
      gender: body.gender !== undefined ? body.gender : db.students[idx].gender,
      classId: user.role === 'wali_kelas' ? user.classId : (body.classId || db.students[idx].classId),
      parentName: body.parentName !== undefined ? String(body.parentName).trim() : db.students[idx].parentName,
      parentPhone: body.parentPhone !== undefined ? String(body.parentPhone).trim() : db.students[idx].parentPhone,
      parentJob: body.parentJob !== undefined ? String(body.parentJob).trim() : db.students[idx].parentJob,
      emergencyContact: body.emergencyContact !== undefined ? String(body.emergencyContact).trim() : db.students[idx].emergencyContact,
      address: body.address !== undefined ? String(body.address).trim() : db.students[idx].address,
      status: body.status !== undefined ? body.status : db.students[idx].status,
      qrCode: `MI-${body.nis !== undefined ? String(body.nis).trim() : db.students[idx].nis}`,
    };

    db.students[idx] = updated;
    addLog(db, user, 'Edit Siswa', `Memperbarui data siswa: ${updated.name}`);
    saveDB(db);
    res.json({ student: updated, data: sanitizeDBForClient(db, user) });
  });

  app.delete('/api/students/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'wali_kelas') {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }

    const db = loadDB();
    const student = db.students.find((s: any) => s.id === req.params.id);
    if (!student) {
      res.status(404).json({ error: 'Siswa tidak ditemukan.' });
      return;
    }

    if (user.role === 'wali_kelas' && student.classId !== user.classId) {
      res.status(403).json({ error: 'Tidak dapat menghapus siswa kelas lain.' });
      return;
    }

    // Remove student while preserving historical attendance archive integrity if needed
    db.students = db.students.filter((s: any) => s.id !== req.params.id);
    addLog(db, user, 'Hapus Siswa', `Menghapus data siswa: ${student.name} (${student.nis})`);
    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  // ==========================================
  // 4. ATTENDANCE & QR SCANNER
  // ==========================================
  app.post('/api/attendance', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role === 'kepala_sekolah') {
      res.status(403).json({ error: 'Kepala Sekolah bersifat monitoring dan tidak mengubah absensi.' });
      return;
    }

    const db = loadDB();
    const { studentId, date, status, timeIn, timeOut, note, method } = req.body;
    const student = db.students.find((s: any) => s.id === studentId);
    if (!student) {
      res.status(404).json({ error: 'Siswa tidak ditemukan.' });
      return;
    }

    if (user.role === 'wali_kelas' && student.classId !== user.classId) {
      res.status(403).json({ error: 'Wali Kelas hanya dapat mengelola absensi kelasnya sendiri.' });
      return;
    }

    const targetDate = date || getTodayStr();
    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const existingIdx = db.attendance.findIndex((a: any) => a.studentId === studentId && a.date === targetDate);

    if (status === 'Belum') {
      if (existingIdx !== -1) {
        db.attendance.splice(existingIdx, 1);
      }
    } else if (existingIdx !== -1) {
      db.attendance[existingIdx] = {
        ...db.attendance[existingIdx],
        status,
        timeIn: timeIn || db.attendance[existingIdx].timeIn || defaultTime,
        timeOut: timeOut !== undefined ? timeOut : db.attendance[existingIdx].timeOut,
        note: note !== undefined ? note : db.attendance[existingIdx].note,
        recordedBy: user.name,
        method: method || db.attendance[existingIdx].method || 'manual',
      };
    } else {
      db.attendance.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        studentId,
        classId: student.classId,
        date: targetDate,
        timeIn: timeIn || defaultTime,
        timeOut: timeOut || undefined,
        status,
        note: note || '',
        recordedBy: user.name,
        method: method || 'manual',
      });
    }

    addLog(db, user, 'Catat Absensi', `${student.name} -> ${status} (${targetDate})`);
    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  app.post('/api/attendance/batch', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role === 'kepala_sekolah') {
      res.status(403).json({ error: 'Kepala Sekolah bersifat monitoring.' });
      return;
    }

    const db = loadDB();
    const { classId, date, status } = req.body;
    const targetDate = date || getTodayStr();

    if (user.role === 'wali_kelas' && classId !== user.classId) {
      res.status(403).json({ error: 'Hanya dapat mengubah absensi kelas sendiri.' });
      return;
    }

    const targetStudents = db.students.filter((s: any) => s.status === 'aktif' && (!classId || classId === 'ALL' || s.classId === classId));
    const now = new Date();
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    targetStudents.forEach((st: any) => {
      const idx = db.attendance.findIndex((a: any) => a.studentId === st.id && a.date === targetDate);
      if (idx === -1) {
        db.attendance.push({
          id: `att-${Date.now()}-${st.id}`,
          studentId: st.id,
          classId: st.classId,
          date: targetDate,
          timeIn: defaultTime,
          status: status || 'Hadir',
          note: 'Absensi serentak',
          recordedBy: user.name,
          method: 'manual',
        });
      }
    });

    addLog(db, user, 'Absensi Massal', `Menandai hadir siswa yang belum tercatat pada ${targetDate}`);
    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  app.post('/api/attendance/qr', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role === 'kepala_sekolah') {
      res.status(403).json({ error: 'Kepala Sekolah tidak melakukan scan absensi.' });
      return;
    }

    const db = loadDB();
    const { qrCode, customTime } = req.body;
    if (!qrCode) {
      res.status(400).json({ error: 'Kode QR kosong.' });
      return;
    }

    const cleanCode = String(qrCode).trim();
    const student = db.students.find(
      (s: any) =>
        s.qrCode.toLowerCase() === cleanCode.toLowerCase() ||
        s.nis.toLowerCase() === cleanCode.toLowerCase() ||
        s.id.toLowerCase() === cleanCode.toLowerCase()
    );

    if (!student) {
      res.status(404).json({ error: `Siswa dengan kode QR "${cleanCode}" tidak ditemukan.` });
      return;
    }

    if (user.role === 'wali_kelas' && student.classId !== user.classId) {
      res.status(403).json({ error: 'Wali Kelas hanya dapat memindai siswa kelasnya sendiri.' });
      return;
    }

    const today = getTodayStr();
    const now = new Date();
    const timeNow = customTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const lateLimit = db.settings?.timeLateLimit || '07:15';
    const computedStatus = timeNow > lateLimit ? 'Terlambat' : 'Hadir';

    const existingIdx = db.attendance.findIndex((a: any) => a.studentId === student.id && a.date === today);
    let record;

    if (existingIdx !== -1) {
      db.attendance[existingIdx] = {
        ...db.attendance[existingIdx],
        timeIn: db.attendance[existingIdx].timeIn || timeNow,
        status: computedStatus,
        recordedBy: user.name,
        method: 'qr',
      };
      record = db.attendance[existingIdx];
    } else {
      record = {
        id: `att-qr-${Date.now()}`,
        studentId: student.id,
        classId: student.classId,
        date: today,
        timeIn: timeNow,
        status: computedStatus,
        note: computedStatus === 'Terlambat' ? `Scan QR melewati batas ${lateLimit}` : 'Scan QR Tepat Waktu',
        recordedBy: user.name,
        method: 'qr',
      };
      db.attendance.push(record);
    }

    const cls = db.classes.find((c: any) => c.id === student.classId);
    addLog(db, user, 'Scan QR Siswa', `${student.name} (${cls?.name || student.classId}) - ${computedStatus} pukul ${timeNow}`);
    saveDB(db);

    res.json({
      student,
      className: cls?.name || '-',
      record,
      data: sanitizeDBForClient(db, user),
    });
  });

  // ==========================================
  // 5. STUDENT NOTES (Catatan, Prestasi, Pelanggaran)
  // ==========================================
  app.post('/api/notes', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role === 'kepala_sekolah') {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }

    const db = loadDB();
    const { studentId, type, content, date, forwardToBK } = req.body;
    const student = db.students.find((s: any) => s.id === studentId);
    if (!student) {
      res.status(404).json({ error: 'Siswa tidak ditemukan.' });
      return;
    }

    if (user.role === 'wali_kelas' && student.classId !== user.classId) {
      res.status(403).json({ error: 'Hanya dapat menambah catatan untuk siswa kelas sendiri.' });
      return;
    }

    const now = new Date();
    const newNote = {
      id: `note-${Date.now()}`,
      studentId: student.id,
      classId: student.classId,
      type: type || 'Catatan',
      content: String(content || '').trim(),
      date: date || getTodayStr(),
      forwardToBK: Boolean(forwardToBK),
      createdBy: user.name,
      createdAt: `${getTodayStr()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };

    db.notes.unshift(newNote);
    addLog(db, user, `Tambah ${newNote.type}`, `${student.name}: ${newNote.content.slice(0, 50)}`);
    saveDB(db);
    res.json({ note: newNote, data: sanitizeDBForClient(db, user) });
  });

  app.delete('/api/notes/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const db = loadDB();
    const note = db.notes.find((n: any) => n.id === req.params.id);
    if (!note) {
      res.status(404).json({ error: 'Catatan tidak ditemukan.' });
      return;
    }
    if (user.role === 'wali_kelas' && note.classId !== user.classId) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    db.notes = db.notes.filter((n: any) => n.id !== req.params.id);
    addLog(db, user, 'Hapus Catatan', `Menghapus catatan siswa ID ${note.studentId}`);
    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  // ==========================================
  // 6. BILLS & PAYMENTS (Tunggakan)
  // ==========================================
  app.post('/api/bills', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'wali_kelas') {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }

    const db = loadDB();
    const { studentId, type, title, amount, period, dueDate, note } = req.body;
    const student = db.students.find((s: any) => s.id === studentId);
    if (!student) {
      res.status(404).json({ error: 'Siswa tidak ditemukan.' });
      return;
    }

    if (user.role === 'wali_kelas' && student.classId !== user.classId) {
      res.status(403).json({ error: 'Hanya dapat mengelola tagihan siswa kelas sendiri.' });
      return;
    }

    const newBill = {
      id: `bill-${Date.now()}`,
      studentId: student.id,
      classId: student.classId,
      type: type || 'SPP',
      title: String(title || `${type} - ${period}`).trim(),
      amount: Number(amount) || 0,
      paidAmount: 0,
      period: String(period || 'Oktober 2026'),
      dueDate: dueDate || getTodayStr(),
      status: 'Belum Lunas',
      note: String(note || ''),
      createdAt: getTodayStr(),
    };

    db.bills.unshift(newBill);
    addLog(db, user, 'Tambah Tagihan', `${student.name} - ${newBill.title} (Rp ${newBill.amount.toLocaleString('id-ID')})`);
    saveDB(db);
    res.json({ bill: newBill, data: sanitizeDBForClient(db, user) });
  });

  app.post('/api/bills/:id/pay', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'wali_kelas') {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }

    const db = loadDB();
    const billIdx = db.bills.findIndex((b: any) => b.id === req.params.id);
    if (billIdx === -1) {
      res.status(404).json({ error: 'Tagihan tidak ditemukan.' });
      return;
    }

    const bill = db.bills[billIdx];
    if (user.role === 'wali_kelas' && bill.classId !== user.classId) {
      res.status(403).json({ error: 'Hanya dapat mencatat pembayaran kelas sendiri.' });
      return;
    }

    const { amount, date, method, note } = req.body;
    const payAmount = Number(amount) || 0;
    if (payAmount <= 0) {
      res.status(400).json({ error: 'Nominal pembayaran harus lebih dari 0.' });
      return;
    }

    const newPaid = Math.min(bill.amount, (bill.paidAmount || 0) + payAmount);
    const newStatus = newPaid >= bill.amount ? 'Lunas' : 'Cicilan';

    db.bills[billIdx] = {
      ...bill,
      paidAmount: newPaid,
      status: newStatus,
      note: note || bill.note,
    };

    const payment = {
      id: `pay-${Date.now()}`,
      billId: bill.id,
      studentId: bill.studentId,
      amount: payAmount,
      date: date || getTodayStr(),
      method: method || 'Tunai',
      note: String(note || ''),
      receivedBy: user.name,
    };

    db.payments.unshift(payment);
    const student = db.students.find((s: any) => s.id === bill.studentId);
    addLog(db, user, 'Pembayaran Tagihan', `${student?.name || bill.studentId}: Rp ${payAmount.toLocaleString('id-ID')} (${newStatus})`);
    saveDB(db);
    res.json({ payment, data: sanitizeDBForClient(db, user) });
  });

  app.delete('/api/bills/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'wali_kelas') {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    const db = loadDB();
    const bill = db.bills.find((b: any) => b.id === req.params.id);
    if (!bill) {
      res.status(404).json({ error: 'Tagihan tidak ditemukan.' });
      return;
    }
    if (user.role === 'wali_kelas' && bill.classId !== user.classId) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    db.bills = db.bills.filter((b: any) => b.id !== req.params.id);
    addLog(db, user, 'Hapus Tagihan', `Menghapus tagihan ${bill.title}`);
    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  // ==========================================
  // 7. CLASSES & USERS MANAGEMENT (Admin Only)
  // ==========================================
  app.post('/api/classes', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Hanya Admin yang dapat mengelola master kelas.' });
      return;
    }
    const db = loadDB();
    const { id, name, level, homeroomTeacherId, roomNumber, academicYear } = req.body;
    if (id) {
      const idx = db.classes.findIndex((c: any) => c.id === id);
      if (idx !== -1) {
        db.classes[idx] = { ...db.classes[idx], name, level: Number(level), homeroomTeacherId, roomNumber, academicYear };
        addLog(db, user, 'Edit Kelas', `Memperbarui kelas ${name}`);
      }
    } else {
      const newCls = {
        id: `kls-${Date.now()}`,
        name: String(name).trim(),
        level: Number(level) || 1,
        homeroomTeacherId: homeroomTeacherId || '',
        roomNumber: String(roomNumber || 'R.Baru'),
        academicYear: academicYear || db.settings.academicYear,
      };
      db.classes.push(newCls);
      addLog(db, user, 'Tambah Kelas', `Menambahkan kelas baru: ${newCls.name}`);
    }
    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  app.delete('/api/classes/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Hanya Admin yang dapat menghapus kelas.' });
      return;
    }
    const db = loadDB();
    const hasStudents = db.students.some((s: any) => s.classId === req.params.id);
    if (hasStudents) {
      res.status(400).json({ error: 'Kelas masih memiliki siswa aktif. Pindahkan siswa terlebih dahulu.' });
      return;
    }
    db.classes = db.classes.filter((c: any) => c.id !== req.params.id);
    addLog(db, user, 'Hapus Kelas', `Menghapus kelas ID ${req.params.id}`);
    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  app.post('/api/users', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Hanya Admin yang dapat mengelola akun pengguna.' });
      return;
    }
    const db = loadDB();
    const { id, username, name, nip, role, classId, phone, position, status, password } = req.body;

    if (id) {
      const idx = db.users.findIndex((u: any) => u.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Akun tidak ditemukan.' });
        return;
      }
      const updatedUser = {
        ...db.users[idx],
        username: username ? String(username).trim().toLowerCase() : db.users[idx].username,
        name: name || db.users[idx].name,
        nip: nip !== undefined ? nip : db.users[idx].nip,
        role: role || db.users[idx].role,
        classId: role === 'wali_kelas' ? classId : undefined,
        phone: phone !== undefined ? phone : db.users[idx].phone,
        position: position || db.users[idx].position,
        status: status || db.users[idx].status,
      };
      if (password && String(password).trim().length >= 4) {
        const hashed = hashPassword(String(password).trim());
        updatedUser.passwordHash = hashed.hash;
        updatedUser.passwordSalt = hashed.salt;
      }
      db.users[idx] = updatedUser;
      addLog(db, user, 'Edit Akun Pengguna', `Memperbarui akun ${updatedUser.name} (${updatedUser.username})`);
    } else {
      const cleanUsername = String(username || '').trim().toLowerCase();
      if (!cleanUsername || !name) {
        res.status(400).json({ error: 'Username dan Nama lengkap wajib diisi.' });
        return;
      }
      if (db.users.some((u: any) => u.username.toLowerCase() === cleanUsername)) {
        res.status(400).json({ error: 'Username sudah digunakan.' });
        return;
      }
      const hashed = hashPassword(String(password || '123456').trim());
      const newUser = {
        id: `usr-${Date.now()}`,
        username: cleanUsername,
        name: String(name).trim(),
        nip: String(nip || '-'),
        role: role || 'wali_kelas',
        classId: role === 'wali_kelas' ? classId : undefined,
        phone: String(phone || '-'),
        position: String(position || 'Guru Madrasah'),
        status: status || 'aktif',
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
      };
      db.users.push(newUser);
      addLog(db, user, 'Tambah Akun Pengguna', `Menambahkan akun ${newUser.name} (${newUser.role})`);
    }

    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  app.post('/api/users/change-password', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const { targetUserId, newPassword } = req.body;

    if (user.role !== 'admin' && targetUserId && targetUserId !== user.userId) {
      res.status(403).json({ error: 'Tidak diizinkan mereset password pengguna lain.' });
      return;
    }

    if (!newPassword || String(newPassword).trim().length < 4) {
      res.status(400).json({ error: 'Password baru minimal 4 karakter.' });
      return;
    }

    const db = loadDB();
    const uid = targetUserId || user.userId;
    const idx = db.users.findIndex((u: any) => u.id === uid);
    if (idx === -1) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }

    const hashed = hashPassword(String(newPassword).trim());
    db.users[idx].passwordHash = hashed.hash;
    db.users[idx].passwordSalt = hashed.salt;

    addLog(db, user, 'Reset Password', `Mengubah password untuk akun ${db.users[idx].username}`);
    saveDB(db);
    res.json({ success: true, data: sanitizeDBForClient(db, user) });
  });

  app.delete('/api/users/:id', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Hanya Admin yang dapat menghapus akun.' });
      return;
    }
    if (req.params.id === user.userId) {
      res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri yang sedang aktif.' });
      return;
    }
    const db = loadDB();
    const target = db.users.find((u: any) => u.id === req.params.id);
    db.users = db.users.filter((u: any) => u.id !== req.params.id);
    addLog(db, user, 'Hapus Akun', `Menghapus akun ${target?.username || req.params.id}`);
    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  // ==========================================
  // 8. CLASS ADMINISTRATION & SETTINGS
  // ==========================================
  app.post('/api/admin-records', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role === 'kepala_sekolah') {
      res.status(403).json({ error: 'Kepala Sekolah hanya akses monitoring.' });
      return;
    }

    const db = loadDB();
    const { entity, action, payload } = req.body;

    if (entity === 'announcements') {
      if (action === 'add') {
        db.announcements.unshift({
          id: `ann-${Date.now()}`,
          title: payload.title,
          content: payload.content,
          targetClassId: user.role === 'wali_kelas' ? user.classId : (payload.targetClassId || 'ALL'),
          date: getTodayStr(),
          createdBy: user.name,
        });
        addLog(db, user, 'Buat Pengumuman', payload.title);
      } else if (action === 'delete') {
        db.announcements = db.announcements.filter((a: any) => a.id !== payload.id);
      }
    } else if (entity === 'mutations') {
      if (action === 'add') {
        const st = db.students.find((s: any) => s.id === payload.studentId);
        db.mutations.unshift({
          id: `mut-${Date.now()}`,
          studentId: payload.studentId,
          studentName: st?.name || payload.studentName || '-',
          nis: st?.nis || payload.nis || '-',
          classId: st?.classId || user.classId || 'kls-1a',
          type: payload.type || 'Keluar',
          destinationOrOrigin: payload.destinationOrOrigin || '-',
          reason: payload.reason || '-',
          date: payload.date || getTodayStr(),
          status: user.role === 'admin' ? 'Disetujui' : 'Menunggu',
        });
        addLog(db, user, 'Catat Mutasi Siswa', `${st?.name || ''} - ${payload.type}`);
      } else if (action === 'delete') {
        db.mutations = db.mutations.filter((m: any) => m.id !== payload.id);
      }
    } else if (entity === 'promotions') {
      if (action === 'add') {
        const st = db.students.find((s: any) => s.id === payload.studentId);
        db.promotions.unshift({
          id: `prm-${Date.now()}`,
          studentId: payload.studentId,
          studentName: st?.name || payload.studentName || '-',
          fromClassId: st?.classId || user.classId || 'kls-1a',
          toClassName: payload.toClassName || 'Kelas Berikutnya',
          academicYear: db.settings.academicYear,
          recommendation: payload.recommendation || 'Naik Kelas',
          note: payload.note || '',
          status: 'Diizinkan',
        });
        addLog(db, user, 'Usulan Kenaikan Kelas', `${st?.name || ''} -> ${payload.toClassName}`);
      } else if (action === 'delete') {
        db.promotions = db.promotions.filter((p: any) => p.id !== payload.id);
      }
    } else if (entity === 'holidays' && user.role === 'admin') {
      if (action === 'add') {
        db.holidays.push({
          id: `hol-${Date.now()}`,
          date: payload.date,
          title: payload.title,
          type: payload.type || 'Kegiatan Madrasah',
        });
        addLog(db, user, 'Kalender Akademik', `Menambah agenda: ${payload.title}`);
      } else if (action === 'delete') {
        db.holidays = db.holidays.filter((h: any) => h.id !== payload.id);
      }
    } else if (entity === 'schedules' && user.role === 'admin') {
      if (action === 'add') {
        db.schedules.push({
          id: `sch-${Date.now()}`,
          classId: payload.classId,
          day: payload.day,
          subject: payload.subject,
          timeStart: payload.timeStart,
          timeEnd: payload.timeEnd,
          teacherName: payload.teacherName,
        });
        addLog(db, user, 'Jadwal Pelajaran', `Menambah jadwal ${payload.subject}`);
      } else if (action === 'delete') {
        db.schedules = db.schedules.filter((s: any) => s.id !== payload.id);
      }
    } else if (entity === 'archive_semester' && user.role === 'admin') {
      const newArc = {
        id: `arc-${Date.now()}`,
        academicYear: db.settings.academicYear,
        semester: db.settings.semester,
        totalStudents: db.students.filter((s: any) => s.status === 'aktif').length,
        avgAttendance: 96.8,
        archivedAt: getTodayStr(),
      };
      db.settings.semesterArchives.unshift(newArc);
      addLog(db, user, 'Arsip Semester', `Mengarsipkan data semester ${newArc.semester} ${newArc.academicYear}`);
    }

    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  app.put('/api/settings', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Hanya Admin yang dapat mengubah pengaturan sistem.' });
      return;
    }

    const db = loadDB();
    db.settings = {
      ...db.settings,
      ...req.body,
    };
    addLog(db, user, 'Pengaturan Sistem', 'Memperbarui konfigurasi sekolah & aplikasi');
    saveDB(db);
    res.json({ data: sanitizeDBForClient(db, user) });
  });

  // ==========================================
  // 9. BACKUP & RESTORE (Never include plaintext passwords)
  // ==========================================
  app.get('/api/backup', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Hanya Admin yang diizinkan mengunduh backup database.' });
      return;
    }

    const db = loadDB();
    const backupPayload = {
      meta: {
        app: 'ABSENSI MI — ADMINISTRASI & KEHADIRAN SISWA',
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: user.name,
      },
      data: {
        ...db,
        // Strip all password hashes/salts so no sensitive credentials leak in backup JSON
        users: sanitizeUsers(db.users),
      },
    };

    addLog(db, user, 'Backup Database', 'Mengunduh file cadangan JSON database sekolah');
    saveDB(db);
    res.json(backupPayload);
  });

  app.post('/api/restore', requireAuth, (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const currentDB = loadDB();
    const isServerEmpty = (currentDB.students || []).length === 0 && (currentDB.attendance || []).length === 0;

    if (user.role !== 'admin' && !isServerEmpty) {
      res.status(403).json({ error: 'Hanya Admin yang diizinkan memulihkan database.' });
      return;
    }

    const incoming = req.body?.data || req.body;
    if (!incoming || !Array.isArray(incoming.students) || !Array.isArray(incoming.classes) || !Array.isArray(incoming.attendance)) {
      res.status(400).json({
        error: 'Struktur file backup tidak valid. Pastikan file JSON memiliki entitas students, classes, dan attendance.',
      });
      return;
    }

    // Merge users while preserving existing password hashes
    const restoredUsers = (incoming.users || currentDB.users).map((u: any) => {
      const existing = currentDB.users.find((cu: any) => cu.id === u.id || cu.username === u.username);
      if (existing) {
        return {
          ...u,
          passwordHash: existing.passwordHash,
          passwordSalt: existing.passwordSalt,
        };
      }
      const defPass = hashPassword('123456');
      return {
        ...u,
        passwordHash: defPass.hash,
        passwordSalt: defPass.salt,
      };
    });

    const newDB = {
      ...currentDB,
      ...incoming,
      users: restoredUsers,
    };

    addLog(newDB, user, 'Restore Database', `Memulihkan ${incoming.students.length} siswa dan ${incoming.attendance.length} data absensi`);
    saveDB(newDB);

    res.json({
      message: `Pemulihan berhasil: ${incoming.students.length} siswa, ${incoming.classes.length} kelas, dan ${incoming.attendance.length} riwayat absensi telah dimuat.`,
      data: sanitizeDBForClient(newDB, user),
    });
  });

  // ==========================================
  // 10. STANDALONE SINGLE-FILE HTML EXPORT (For Offline Use & HTML-to-APK Builders)
  // ==========================================
  app.get('/api/export-html', async (_req: Request, res: Response) => {
    try {
      const distAssetsDir = path.join(__dirname, 'dist', 'assets');
      if (!fs.existsSync(distAssetsDir)) {
        await buildVite({ logLevel: 'silent' });
      }

      const assetFiles = fs.existsSync(distAssetsDir) ? fs.readdirSync(distAssetsDir) : [];
      const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));
      const jsFiles = assetFiles.filter(
        (f) => f.endsWith('.js') && !f.startsWith('workbox-') && f !== 'sw.js'
      );

      const inlineCss = cssFiles
        .map((f) => fs.readFileSync(path.join(distAssetsDir, f), 'utf-8'))
        .join('\n');
      const inlineJs = jsFiles
        .map((f) => fs.readFileSync(path.join(distAssetsDir, f), 'utf-8'))
        .join('\n')
        .replace(/<\/script/gi, '<\\/script');

      const db = loadDB();
      const seedDB = {
        ...db,
        users: sanitizeUsers(db.users),
        logs: (db.logs || []).slice(0, 100),
      };
      const safeSeedJson = JSON.stringify(seedDB).replace(/<\/script/gi, '<\\/script');

      const htmlContent = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>ABSENSI MI — ADMINISTRASI & KEHADIRAN SISWA</title>
    <meta name="description" content="Aplikasi Administrasi dan Absensi Siswa Madrasah Ibtidaiyah (MI) - Standalone HTML." />
    <meta name="theme-color" content="#3c1e96" />
    <meta name="mobile-web-app-capable" content="yes" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet" />
    <style>${inlineCss}</style>
  </head>
  <body class="bg-[#f3f2f8] text-[#1f1b38] antialiased selection:bg-[#4e36e2]/20">
    <div id="root"></div>
    <script>
      (function () {
        var STORAGE_KEY = 'absensi_mi_local_db_cache_v2';
        var PASS_KEY = 'absensi_mi_local_passwords_v2';
        var SESSION_USER_KEY = 'absensi_mi_standalone_user_v2';
        var SEED_DB = ${safeSeedJson};

        function getTodayStr() {
          return new Date().toISOString().slice(0, 10);
        }

        function loadLocalDB() {
          try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              var parsed = JSON.parse(raw);
              if (parsed && Array.isArray(parsed.classes) && Array.isArray(parsed.students)) {
                return parsed;
              }
            }
          } catch (e) {}
          localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DB));
          return JSON.parse(JSON.stringify(SEED_DB));
        }

        function saveLocalDB(db) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
          } catch (e) {}
        }

        function loadPasswords() {
          try {
            var raw = localStorage.getItem(PASS_KEY);
            if (raw) return JSON.parse(raw);
          } catch (e) {}
          return {};
        }

        function savePasswords(map) {
          try {
            localStorage.setItem(PASS_KEY, JSON.stringify(map));
          } catch (e) {}
        }

        function filterForUser(db, user) {
          if (!user || user.role !== 'wali_kelas' || !user.classId) {
            return db;
          }
          var cid = user.classId;
          return Object.assign({}, db, {
            students: (db.students || []).filter(function (s) { return s.classId === cid; }),
            attendance: (db.attendance || []).filter(function (a) { return a.classId === cid; }),
            notes: (db.notes || []).filter(function (n) { return n.classId === cid; }),
            bills: (db.bills || []).filter(function (b) { return b.classId === cid; }),
          });
        }

        function jsonResponse(obj, status) {
          return Promise.resolve(
            new Response(JSON.stringify(obj), {
              status: status || 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }

        var origFetch = window.fetch.bind(window);
        window.fetch = function (input, init) {
          var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
          var apiIdx = url.indexOf('/api/');
          if (apiIdx === -1) {
            return origFetch(input, init);
          }

          var pathPart = url.slice(apiIdx).split('?')[0];
          var method = ((init && init.method) || 'GET').toUpperCase();
          var body = {};
          if (init && init.body && typeof init.body === 'string') {
            try { body = JSON.parse(init.body); } catch (e) {}
          }

          var db = loadLocalDB();
          var currentUser = null;
          try {
            var savedU = localStorage.getItem(SESSION_USER_KEY);
            if (savedU) currentUser = JSON.parse(savedU);
          } catch (e) {}
          if (!currentUser && db.users && db.users.length > 0) {
            currentUser = db.users[0];
          }

          // 1. AUTH LOGIN
          if (pathPart === '/api/auth/login' && method === 'POST') {
            var uname = String(body.username || '').trim().toLowerCase();
            var pwd = String(body.password || '');
            var found = (db.users || []).find(function (u) {
              return String(u.username || '').toLowerCase() === uname && u.status !== 'nonaktif';
            });
            if (!found) {
              return jsonResponse({ error: 'Username tidak ditemukan atau akun nonaktif.' }, 401);
            }
            var customMap = loadPasswords();
            var expectedPwd = customMap[found.id] || (found.username === 'admin' ? 'admin123' : '123456');
            if (pwd !== expectedPwd) {
              return jsonResponse({ error: 'Password salah. Silakan periksa kembali.' }, 401);
            }
            var userSession = {
              id: found.id,
              username: found.username,
              name: found.name,
              role: found.role,
              classId: found.classId,
              nip: found.nip,
            };
            localStorage.setItem(SESSION_USER_KEY, JSON.stringify(userSession));
            return jsonResponse({
              token: 'standalone-token-' + Date.now(),
              user: userSession,
              data: filterForUser(db, userSession),
            });
          }

          // 2. AUTH ME & BOOTSTRAP
          if (pathPart === '/api/auth/me' && method === 'GET') {
            var savedUser = null;
            try {
              savedUser = JSON.parse(localStorage.getItem(SESSION_USER_KEY) || 'null');
            } catch (e) {}
            if (!savedUser) {
              return jsonResponse({ error: 'Sesi berakhir' }, 401);
            }
            return jsonResponse({ user: savedUser, data: filterForUser(db, savedUser) });
          }

          if (pathPart === '/api/auth/logout' && method === 'POST') {
            localStorage.removeItem(SESSION_USER_KEY);
            return jsonResponse({ ok: true });
          }

          if (pathPart === '/api/bootstrap' && method === 'GET') {
            return jsonResponse(filterForUser(db, currentUser));
          }

          // 3. STUDENTS CRUD
          if (pathPart === '/api/students' && method === 'POST') {
            var nis = String(body.nis || '').trim() || String(Math.floor(100000 + Math.random() * 900000));
            var newSt = {
              id: 'std-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
              nis: nis,
              nisn: String(body.nisn || '').trim(),
              name: String(body.name || 'Siswa Baru').trim(),
              gender: body.gender === 'P' ? 'P' : 'L',
              classId: body.classId || (currentUser && currentUser.classId) || 'kls-1a',
              birthPlace: String(body.birthPlace || '-'),
              birthDate: String(body.birthDate || '2016-01-01'),
              parentName: String(body.parentName || '-'),
              parentPhone: String(body.parentPhone || ''),
              parentJob: String(body.parentJob || '-'),
              address: String(body.address || '-'),
              status: body.status || 'aktif',
              qrCode: 'MI-' + nis,
              createdAt: getTodayStr(),
            };
            db.students.push(newSt);
            saveLocalDB(db);
            return jsonResponse({ student: newSt, data: filterForUser(db, currentUser) });
          }

          if (pathPart.indexOf('/api/students/') === 0) {
            var stId = pathPart.replace('/api/students/', '');
            if (method === 'PUT') {
              var sIdx = db.students.findIndex(function (s) { return s.id === stId; });
              if (sIdx !== -1) {
                db.students[sIdx] = Object.assign({}, db.students[sIdx], body);
                saveLocalDB(db);
                return jsonResponse({ student: db.students[sIdx], data: filterForUser(db, currentUser) });
              }
            }
            if (method === 'DELETE') {
              db.students = db.students.filter(function (s) { return s.id !== stId; });
              db.attendance = db.attendance.filter(function (a) { return a.studentId !== stId; });
              saveLocalDB(db);
              return jsonResponse({ data: filterForUser(db, currentUser) });
            }
          }

          // 4. ATTENDANCE
          if (pathPart === '/api/attendance' && method === 'POST') {
            var st = db.students.find(function (s) { return s.id === body.studentId; });
            if (!st) return jsonResponse({ error: 'Siswa tidak ditemukan' }, 404);
            var targetDate = body.date || getTodayStr();
            var now = new Date();
            var tNow = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            var aIdx = db.attendance.findIndex(function (a) {
              return a.studentId === st.id && a.date === targetDate;
            });
            var rec = {
              id: aIdx !== -1 ? db.attendance[aIdx].id : 'att-' + Date.now(),
              studentId: st.id,
              classId: st.classId,
              date: targetDate,
              timeIn: tNow,
              status: body.status || 'Hadir',
              note: body.note || '',
              recordedBy: (currentUser && currentUser.name) || 'Guru',
              method: body.method || 'manual',
            };
            if (aIdx !== -1) db.attendance[aIdx] = rec;
            else db.attendance.push(rec);
            saveLocalDB(db);
            return jsonResponse({ record: rec, data: filterForUser(db, currentUser) });
          }

          if (pathPart === '/api/attendance/batch' && method === 'POST') {
            var bDate = body.date || getTodayStr();
            var bClass = body.classId || 'ALL';
            var nowB = new Date();
            var tNowB = String(nowB.getHours()).padStart(2, '0') + ':' + String(nowB.getMinutes()).padStart(2, '0');
            (db.students || []).forEach(function (s) {
              if (s.status !== 'aktif') return;
              if (bClass !== 'ALL' && s.classId !== bClass) return;
              var exists = db.attendance.some(function (a) { return a.studentId === s.id && a.date === bDate; });
              if (!exists) {
                db.attendance.push({
                  id: 'att-b-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                  studentId: s.id,
                  classId: s.classId,
                  date: bDate,
                  timeIn: tNowB,
                  status: body.status || 'Hadir',
                  note: 'Hadir Semua',
                  recordedBy: (currentUser && currentUser.name) || 'Guru',
                  method: 'manual',
                });
              }
            });
            saveLocalDB(db);
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          if (pathPart === '/api/attendance/qr' && method === 'POST') {
            var code = String(body.qrCode || '').trim().toLowerCase();
            var qSt = (db.students || []).find(function (s) {
              return (
                String(s.qrCode || '').toLowerCase() === code ||
                String(s.nis || '').toLowerCase() === code ||
                String(s.id || '').toLowerCase() === code
              );
            });
            if (!qSt) return jsonResponse({ error: 'Siswa dengan kode QR tersebut tidak ditemukan.' }, 404);
            var qToday = getTodayStr();
            var qNow = new Date();
            var qTime = String(qNow.getHours()).padStart(2, '0') + ':' + String(qNow.getMinutes()).padStart(2, '0');
            var lateLim = (db.settings && db.settings.timeLateLimit) || '07:15';
            var qStatus = qTime > lateLim ? 'Terlambat' : 'Hadir';
            var qIdx = db.attendance.findIndex(function (a) { return a.studentId === qSt.id && a.date === qToday; });
            var qRec = {
              id: qIdx !== -1 ? db.attendance[qIdx].id : 'att-qr-' + Date.now(),
              studentId: qSt.id,
              classId: qSt.classId,
              date: qToday,
              timeIn: qTime,
              status: qStatus,
              note: 'Scan QR',
              recordedBy: (currentUser && currentUser.name) || 'Piket',
              method: 'qr',
            };
            if (qIdx !== -1) db.attendance[qIdx] = qRec;
            else db.attendance.push(qRec);
            saveLocalDB(db);
            var qCls = (db.classes || []).find(function (c) { return c.id === qSt.classId; });
            return jsonResponse({
              student: qSt,
              className: (qCls && qCls.name) || qSt.classId,
              record: qRec,
              data: filterForUser(db, currentUser),
            });
          }

          // 5. NOTES & BILLS
          if (pathPart === '/api/notes' && method === 'POST') {
            var nSt = db.students.find(function (s) { return s.id === body.studentId; });
            var newNote = {
              id: 'note-' + Date.now(),
              studentId: body.studentId,
              classId: (nSt && nSt.classId) || 'kls-1a',
              type: body.type || 'Catatan',
              content: body.content || '',
              date: body.date || getTodayStr(),
              forwardToBK: Boolean(body.forwardToBK),
              createdBy: (currentUser && currentUser.name) || 'Guru',
              createdAt: getTodayStr(),
            };
            db.notes.unshift(newNote);
            saveLocalDB(db);
            return jsonResponse({ note: newNote, data: filterForUser(db, currentUser) });
          }

          if (pathPart.indexOf('/api/notes/') === 0 && method === 'DELETE') {
            var nId = pathPart.replace('/api/notes/', '');
            db.notes = db.notes.filter(function (n) { return n.id !== nId; });
            saveLocalDB(db);
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          if (pathPart === '/api/bills' && method === 'POST') {
            var bSt = db.students.find(function (s) { return s.id === body.studentId; });
            var newBill = {
              id: 'bill-' + Date.now(),
              studentId: body.studentId,
              classId: (bSt && bSt.classId) || 'kls-1a',
              type: body.type || 'SPP',
              title: body.title || 'SPP',
              amount: Number(body.amount) || 0,
              paidAmount: 0,
              period: body.period || '2026',
              dueDate: body.dueDate || getTodayStr(),
              status: 'Belum Lunas',
              note: body.note || '',
              createdAt: getTodayStr(),
            };
            db.bills.unshift(newBill);
            saveLocalDB(db);
            return jsonResponse({ bill: newBill, data: filterForUser(db, currentUser) });
          }

          if (pathPart.indexOf('/api/bills/') === 0 && pathPart.endsWith('/pay') && method === 'POST') {
            var payBillId = pathPart.replace('/api/bills/', '').replace('/pay', '');
            var bIdx = db.bills.findIndex(function (b) { return b.id === payBillId; });
            if (bIdx !== -1) {
              var bill = db.bills[bIdx];
              var amt = Number(body.amount) || 0;
              var nPaid = Math.min(bill.amount, (bill.paidAmount || 0) + amt);
              bill.paidAmount = nPaid;
              bill.status = nPaid >= bill.amount ? 'Lunas' : 'Cicilan';
              db.payments.unshift({
                id: 'pay-' + Date.now(),
                billId: bill.id,
                studentId: bill.studentId,
                amount: amt,
                date: body.date || getTodayStr(),
                method: body.method || 'Tunai',
                note: body.note || '',
                receivedBy: (currentUser && currentUser.name) || 'Admin',
              });
              saveLocalDB(db);
            }
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          if (pathPart.indexOf('/api/bills/') === 0 && method === 'DELETE') {
            var delBillId = pathPart.replace('/api/bills/', '');
            db.bills = db.bills.filter(function (b) { return b.id !== delBillId; });
            saveLocalDB(db);
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          // 6. CLASSES, USERS, SETTINGS, BACKUP/RESTORE
          if (pathPart === '/api/classes' && method === 'POST') {
            if (body.id) {
              var cIdx = db.classes.findIndex(function (c) { return c.id === body.id; });
              if (cIdx !== -1) db.classes[cIdx] = Object.assign({}, db.classes[cIdx], body);
            } else {
              db.classes.push({
                id: 'kls-' + Date.now(),
                name: body.name,
                level: Number(body.level) || 1,
                homeroomTeacherId: body.homeroomTeacherId || '',
                roomNumber: body.roomNumber || '-',
                academicYear: (db.settings && db.settings.academicYear) || '2026/2027',
              });
            }
            saveLocalDB(db);
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          if (pathPart.indexOf('/api/classes/') === 0 && method === 'DELETE') {
            var delClsId = pathPart.replace('/api/classes/', '');
            db.classes = db.classes.filter(function (c) { return c.id !== delClsId; });
            saveLocalDB(db);
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          if (pathPart === '/api/users' && method === 'POST') {
            var pMap = loadPasswords();
            if (body.id) {
              var uIdx = db.users.findIndex(function (u) { return u.id === body.id; });
              if (uIdx !== -1) {
                db.users[uIdx] = Object.assign({}, db.users[uIdx], body);
                if (body.password) pMap[body.id] = String(body.password).trim();
              }
            } else {
              var newUid = 'usr-' + Date.now();
              db.users.push({
                id: newUid,
                username: String(body.username || '').trim().toLowerCase(),
                name: body.name,
                nip: body.nip || '-',
                role: body.role || 'wali_kelas',
                classId: body.classId,
                phone: body.phone || '-',
                position: body.position || 'Guru',
                status: body.status || 'aktif',
              });
              if (body.password) pMap[newUid] = String(body.password).trim();
            }
            savePasswords(pMap);
            saveLocalDB(db);
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          if (pathPart === '/api/users/change-password' && method === 'POST') {
            var cpMap = loadPasswords();
            var tUid = body.targetUserId || (currentUser && currentUser.id);
            if (tUid && body.newPassword) {
              cpMap[tUid] = String(body.newPassword).trim();
              savePasswords(cpMap);
            }
            return jsonResponse({ success: true, data: filterForUser(db, currentUser) });
          }

          if (pathPart.indexOf('/api/users/') === 0 && method === 'DELETE') {
            var delUid = pathPart.replace('/api/users/', '');
            db.users = db.users.filter(function (u) { return u.id !== delUid; });
            saveLocalDB(db);
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          if (pathPart === '/api/settings' && method === 'PUT') {
            db.settings = Object.assign({}, db.settings, body);
            saveLocalDB(db);
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          if (pathPart === '/api/admin-records' && method === 'POST') {
            var ent = body.entity;
            var act = body.action;
            var pay = body.payload || {};
            if (Array.isArray(db[ent])) {
              if (act === 'add') db[ent].unshift(Object.assign({ id: ent + '-' + Date.now() }, pay));
              else if (act === 'delete') db[ent] = db[ent].filter(function (item) { return item.id !== pay.id; });
              saveLocalDB(db);
            }
            return jsonResponse({ data: filterForUser(db, currentUser) });
          }

          if (pathPart === '/api/backup' && method === 'GET') {
            return jsonResponse({
              meta: { app: 'ABSENSI MI', version: '2.0.0', exportedAt: new Date().toISOString() },
              data: db,
            });
          }

          if (pathPart === '/api/restore' && method === 'POST') {
            var inc = body.data || body;
            if (inc && Array.isArray(inc.students) && Array.isArray(inc.classes)) {
              db = Object.assign({}, db, inc);
              saveLocalDB(db);
            }
            return jsonResponse({
              message: 'Database berhasil dipulihkan.',
              data: filterForUser(db, currentUser),
            });
          }

          return jsonResponse({ data: filterForUser(db, currentUser) });
        };
      })();
    </script>
    <script type="module">${inlineJs}</script>
  </body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Absensi_MI_Aplikasi.html"');
      res.send(htmlContent);
    } catch (err: any) {
      res.status(500).json({ error: 'Gagal membuat file HTML aplikasi: ' + (err?.message || 'Unknown error') });
    }
  });

  // ==========================================
  // VITE MIDDLEWARE OR STATIC PROD ASSETS
  // ==========================================
  const distPath = path.join(__dirname, 'dist');
  const distIndex = path.join(distPath, 'index.html');

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distIndex)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Absensi MI berjalan di http://0.0.0.0:${PORT}`);
  });
}

startServer();
