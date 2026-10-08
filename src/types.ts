export type Role = 'admin' | 'kepala_sekolah' | 'wali_kelas' | 'guru_piket';

export interface User {
  id: string;
  username: string;
  name: string;
  nip: string;
  role: Role;
  classId?: string;
  phone: string;
  position: string;
  status: 'aktif' | 'nonaktif';
}

export interface ClassRoom {
  id: string;
  name: string;
  level: number;
  homeroomTeacherId: string;
  roomNumber: string;
  academicYear: string;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  classId: string;
  parentName: string;
  parentPhone: string;
  parentJob: string;
  emergencyContact: string;
  address: string;
  qrCode: string;
  status: 'aktif' | 'mutasi' | 'alumni';
  createdAt: string;
}

export type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa' | 'Belum';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string; // YYYY-MM-DD
  timeIn: string; // HH:mm
  timeOut?: string; // HH:mm
  status: AttendanceStatus;
  note?: string;
  recordedBy: string;
  method: 'qr' | 'manual';
}

export type NoteType = 'Catatan' | 'Prestasi' | 'Pelanggaran';

export interface StudentNote {
  id: string;
  studentId: string;
  classId: string;
  type: NoteType;
  content: string;
  date: string;
  forwardToBK: boolean;
  createdBy: string;
  createdAt: string;
}

export type BillType = 'SPP' | 'Kegiatan' | 'Seragam' | 'Buku' | 'Lainnya';

export interface Bill {
  id: string;
  studentId: string;
  classId: string;
  type: BillType;
  title: string;
  amount: number;
  paidAmount: number;
  period: string;
  dueDate: string;
  status: 'Lunas' | 'Belum Lunas' | 'Cicilan';
  note?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  billId: string;
  studentId: string;
  amount: number;
  date: string;
  method: 'Tunai' | 'Transfer' | 'QRIS';
  note?: string;
  receivedBy: string;
}

export interface Holiday {
  id: string;
  date: string;
  title: string;
  type: 'Libur Nasional' | 'Cuti Bersama' | 'Kegiatan Madrasah' | 'Ujian';
}

export interface ScheduleItem {
  id: string;
  classId: string;
  day: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  subject: string;
  timeStart: string;
  timeEnd: string;
  teacherName: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  role: Role;
  action: string;
  detail: string;
  timestamp: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetClassId: string; // 'ALL' or classId
  date: string;
  createdBy: string;
}

export interface MutationRecord {
  id: string;
  studentId: string;
  studentName: string;
  nis: string;
  classId: string;
  type: 'Masuk' | 'Keluar' | 'Pindah Kelas';
  destinationOrOrigin: string;
  reason: string;
  date: string;
  status: 'Disetujui' | 'Menunggu' | 'Ditolak';
}

export interface PromotionProposal {
  id: string;
  studentId: string;
  studentName: string;
  fromClassId: string;
  toClassName: string;
  academicYear: string;
  recommendation: 'Naik Kelas' | 'Tinggal Kelas' | 'Lulus';
  note: string;
  status: 'Diizinkan' | ' diusulkan';
}

export interface AlumniRecord {
  id: string;
  studentId: string;
  nis: string;
  nisn: string;
  name: string;
  graduationYear: string;
  continuingSchool: string;
  phone: string;
}

export interface SchoolSettings {
  schoolName: string;
  nsm: string;
  npsn: string;
  address: string;
  phone: string;
  email: string;
  headmasterName: string;
  headmasterNip: string;
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  timeInLimit: string; // e.g. "07:00"
  timeLateLimit: string; // e.g. "07:15"
  timeOutLimit: string; // e.g. "12:30"
  docPrefix: string; // e.g. "MI-NH/ABS/2026"
  notificationsEnabled: boolean;
  waGatewayNotice: boolean;
  compactMode: boolean;
  rolePermissions: {
    waliCanAddStudent: boolean;
    waliCanManageBills: boolean;
    piketCanEditPastAttendance: boolean;
  };
  registeredDevices: {
    id: string;
    name: string;
    browser: string;
    lastActive: string;
    status: 'Aktif' | 'Diblokir';
  }[];
  semesterArchives: {
    id: string;
    academicYear: string;
    semester: string;
    totalStudents: number;
    avgAttendance: number;
    archivedAt: string;
  }[];
}

export interface AppDatabase {
  users: User[];
  classes: ClassRoom[];
  students: Student[];
  attendance: AttendanceRecord[];
  notes: StudentNote[];
  bills: Bill[];
  payments: Payment[];
  holidays: Holiday[];
  schedules: ScheduleItem[];
  logs: ActivityLog[];
  announcements: Announcement[];
  mutations: MutationRecord[];
  promotions: PromotionProposal[];
  alumni: AlumniRecord[];
  settings: SchoolSettings;
}
