import { Student, ClassRoom, AttendanceRecord, StudentNote, Bill } from '../types';
import { WhatsAppPayload } from '../components/WhatsAppPreviewModal';

/**
 * Normalize Indonesian phone numbers to international format (628...) for wa.me links
 */
export function normalizeWhatsAppNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return '62' + digits.slice(1);
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return '62' + digits;
  }
  return digits;
}

export interface BuildWhatsAppOptions {
  student: Student;
  classRoom?: ClassRoom;
  schoolName: string;
  attendance: AttendanceRecord[];
  notes: StudentNote[];
  bills?: Bill[];
  customFocusNote?: StudentNote;
  customFocusBill?: Bill;
}

/**
 * Generate structured WhatsApp message payload (text + direct URLs)
 * so it can be previewed in-app or launched via whatsapp:// / wa.me / web.whatsapp.com
 * without hitting iframe X-Frame-Options SVG error icons.
 */
export function buildStudentWhatsAppPayload(options: BuildWhatsAppOptions): WhatsAppPayload | null {
  const phone = normalizeWhatsAppNumber(options.student.parentPhone);
  if (!phone) return null;

  const {
    student,
    classRoom,
    schoolName,
    attendance,
    notes,
    bills = [],
    customFocusNote,
    customFocusBill,
  } = options;
  const className = classRoom?.name || student.classId;

  let messageText = '';

  if (customFocusBill) {
    const remaining = Math.max(0, customFocusBill.amount - customFocusBill.paidAmount);
    const billLines: string[] = [
      `Assalamu'alaikum Wr. Wb.`,
      `Yth. Bapak/Ibu *${student.parentName || 'Wali Murid'}*,`,
      `Orang tua/wali dari ananda *${student.name}* (NIS: ${student.nis} — ${className}).`,
      ``,
      `Melalui pesan ini kami dari bagian Administrasi *${schoolName}* menyampaikan pemberitahuan rincian tagihan/administrasi madrasah ananda:`,
      ``,
      `*Rincian Tagihan / Tunggakan:*`,
      `• Jenis: ${customFocusBill.type} (${customFocusBill.title})`,
      `• Periode: ${customFocusBill.period}`,
      `• Total Tagihan: Rp ${customFocusBill.amount.toLocaleString('id-ID')}`,
      `• Sudah Terbayar: Rp ${customFocusBill.paidAmount.toLocaleString('id-ID')}`,
      `• *Sisa Tunggakan: Rp ${remaining.toLocaleString('id-ID')}*`,
      `• Status: ${customFocusBill.status}`,
      `• Jatuh Tempo: ${customFocusBill.dueDate || '-'}`,
      ``,
      `Mohon kesediaan Bapak/Ibu untuk dapat melakukan penyelesaian administrasi melalui Tata Usaha (TU) atau Wali Kelas. Apabila sudah melakukan pembayaran, mohon abaikan pesan ini.`,
      ``,
      `Terima kasih atas perhatian dan kerja sama Bapak/Ibu.`,
      `Wassalamu'alaikum Wr. Wb.`,
    ];
    messageText = billLines.join('\n');
  } else {
    const stAtt = attendance.filter((a) => a.studentId === student.id);
    const hadir = stAtt.filter((a) => a.status === 'Hadir').length;
    const terlambat = stAtt.filter((a) => a.status === 'Terlambat').length;
    const izin = stAtt.filter((a) => a.status === 'Izin').length;
    const sakit = stAtt.filter((a) => a.status === 'Sakit').length;
    const alpa = stAtt.filter((a) => a.status === 'Alpa').length;

    const stNotes = notes.filter((n) => n.studentId === student.id);
    const latestNote = customFocusNote || stNotes[0];

    const unpaidBills = bills.filter(
      (b) => b.studentId === student.id && b.status !== 'Lunas' && b.amount - b.paidAmount > 0
    );
    const totalUnpaid = unpaidBills.reduce((acc, b) => acc + Math.max(0, b.amount - b.paidAmount), 0);

    const lines: string[] = [
      `Assalamu'alaikum Wr. Wb.`,
      `Yth. Bapak/Ibu *${student.parentName || 'Wali Murid'}*,`,
      `Orang tua/wali dari ananda *${student.name}* (NIS: ${student.nis} — ${className}).`,
      ``,
      `Berikut informasi rekapitulasi kehadiran, perkembangan, & administrasi ananda dari *${schoolName}*:`,
      ``,
      `*Rekap Kehadiran Siswa:*`,
      `• Hadir Tepat Waktu: ${hadir} hari`,
      `• Terlambat: ${terlambat} hari`,
      `• Izin: ${izin} hari`,
      `• Sakit: ${sakit} hari`,
      `• Alpa (Tanpa Keterangan): ${alpa} hari`,
    ];

    if (latestNote) {
      lines.push(
        ``,
        `*Catatan ${latestNote.type} Terbaru (${latestNote.date}):*`,
        `"${latestNote.content}"`
      );
    } else {
      lines.push(
        ``,
        `*Catatan Perilaku / Akademik:*`,
        `Ananda mengikuti kegiatan belajar di madrasah dengan baik.`
      );
    }

    if (unpaidBills.length > 0) {
      lines.push(``, `*Informasi Administrasi / Tunggakan:*`);
      unpaidBills.forEach((b) => {
        const rem = Math.max(0, b.amount - b.paidAmount);
        lines.push(`• ${b.title} (${b.period}): Sisa *Rp ${rem.toLocaleString('id-ID')}* [${b.status}]`);
      });
      lines.push(`*Total Tunggakan: Rp ${totalUnpaid.toLocaleString('id-ID')}*`);
    } else {
      lines.push(``, `*Status Administrasi / SPP:*`, `Alhamdulillah, tidak ada tunggakan tagihan saat ini (Lunas).`);
    }

    lines.push(
      ``,
      `Terima kasih atas kerja sama dan perhatian Bapak/Ibu dalam mendampingi pendidikan ananda.`,
      `Wassalamu'alaikum Wr. Wb.`
    );

    messageText = lines.join('\n');
  }

  const encodedText = encodeURIComponent(messageText);

  return {
    phone,
    rawPhone: student.parentPhone || phone,
    recipientName: student.parentName || 'Orang Tua / Wali',
    studentName: student.name,
    text: messageText,
    waMeUrl: `https://wa.me/${phone}?text=${encodedText}`,
    apiWaUrl: `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`,
    webWaUrl: `https://web.whatsapp.com/send?phone=${phone}&text=${encodedText}`,
    deepLinkUrl: `whatsapp://send?phone=${phone}&text=${encodedText}`,
  };
}

export function buildStudentWhatsAppUrl(options: BuildWhatsAppOptions): string | null {
  const payload = buildStudentWhatsAppPayload(options);
  return payload ? payload.waMeUrl : null;
}
