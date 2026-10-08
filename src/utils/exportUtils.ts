import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, ClassRoom, Bill, SchoolSettings } from '../types';

/**
 * Strip invalid XML 1.0 control characters and sanitize text for OpenXML / SpreadsheetML
 */
function sanitizeXmlString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    // Remove illegal XML 1.0 control chars (except tab \x09, LF \x0A, CR \x0D)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Escape XML entities for SpreadsheetML 2003 format
 */
function escapeXmlEntities(val: unknown): string {
  return sanitizeXmlString(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitize Excel worksheet name (max 31 chars, no : \ / ? * [ ] characters, non-empty)
 */
function sanitizeSheetName(rawName: string): string {
  const cleaned = sanitizeXmlString(rawName)
    .replace(/[:\\/?*\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned || 'Data_Madrasah';
}

/**
 * Build a 100% standards-compliant Microsoft Office SpreadsheetML 2003 XML document
 * that opens natively in Microsoft Excel, Google Sheets, and LibreOffice Calc without format errors.
 */
export function buildSpreadsheetML2003XML(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
): string {
  const safeSheet = escapeXmlEntities(sanitizeSheetName(sheetName));

  const headerCells = headers
    .map(
      (h) =>
        `        <Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXmlEntities(h)}</Data></Cell>`
    )
    .join('\n');

  const dataRows = rows
    .map((row) => {
      const cells = headers
        .map((_, colIdx) => {
          const cellVal = row[colIdx] ?? '';
          // Keep leading-zero identifiers (NIS, NISN, NIP, Phone) as String so Excel doesn't corrupt them
          const isPureNumber =
            typeof cellVal === 'number' && Number.isFinite(cellVal);
          const dataType = isPureNumber ? 'Number' : 'String';
          return `        <Cell ss:StyleID="sBody"><Data ss:Type="${dataType}">${escapeXmlEntities(
            cellVal
          )}</Data></Cell>`;
        })
        .join('\n');
      return `      <Row ss:AutoFitHeight="1">\n${cells}\n      </Row>`;
    })
    .join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<?mso-application progid="Excel.Sheet"?>`,
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"`,
    ` xmlns:o="urn:schemas-microsoft-com:office:office"`,
    ` xmlns:x="urn:schemas-microsoft-com:office:excel"`,
    ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"`,
    ` xmlns:html="http://www.w3.org/TR/REC-html40">`,
    `  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">`,
    `    <Title>${safeSheet}</Title>`,
    `    <Company>Madrasah Ibtidaiyah</Company>`,
    `  </DocumentProperties>`,
    `  <Styles>`,
    `    <Style ss:ID="Default" ss:Name="Normal">`,
    `      <Alignment ss:Vertical="Center"/>`,
    `      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1F1B38"/>`,
    `    </Style>`,
    `    <Style ss:ID="sHeader">`,
    `      <Alignment ss:Vertical="Center" ss:WrapText="1"/>`,
    `      <Borders>`,
    `        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3C1E96"/>`,
    `        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3C1E96"/>`,
    `        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3C1E96"/>`,
    `        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3C1E96"/>`,
    `      </Borders>`,
    `      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>`,
    `      <Interior ss:Color="#3C1E96" ss:Pattern="Solid"/>`,
    `    </Style>`,
    `    <Style ss:ID="sBody">`,
    `      <Alignment ss:Vertical="Center"/>`,
    `      <Borders>`,
    `        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>`,
    `        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>`,
    `        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>`,
    `        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>`,
    `      </Borders>`,
    `    </Style>`,
    `  </Styles>`,
    `  <Worksheet ss:Name="${safeSheet}">`,
    `    <Table>`,
    `      <Row ss:Height="22">`,
    headerCells,
    `      </Row>`,
    dataRows,
    `    </Table>`,
    `  </Worksheet>`,
    `</Workbook>`,
  ].join('\n');
}

/**
 * Export tabular data to a valid Office Open XML (.xlsx) workbook with sanitized XML structure,
 * automatic column widths, and leading-zero identifier protection for Microsoft Excel & Google Sheets.
 */
export function exportToExcelXML(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const safeHeaders = headers.map((h) => sanitizeXmlString(h));
  const safeRows = rows.map((row) =>
    headers.map((_, colIdx) => {
      const raw = row[colIdx] ?? '';
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
      }
      return sanitizeXmlString(raw);
    })
  );
  const safeSheet = sanitizeSheetName(sheetName);

  try {
    const cleanFilename = filename.replace(/\.(xls|xlsx|xml|csv)$/i, '') + '.xlsx';
    const worksheetData = [safeHeaders, ...safeRows];

    // Create sheet with raw: true so string identifiers with leading zeros ('0812...', '0012...') stay text
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Ensure every string cell is explicitly typed as string ('s') to prevent Excel number coercion warnings
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        if (!cell) continue;
        if (typeof cell.v === 'string') {
          cell.t = 's';
        } else if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
          cell.t = 'n';
        }
      }
    }

    // Auto-calculate column widths for neatness in Excel & Google Sheets
    const colWidths = safeHeaders.map((h, colIdx) => {
      let maxLen = String(h || '').length;
      safeRows.forEach((r) => {
        const cellLen = String(r[colIdx] ?? '').length;
        if (cellLen > maxLen) maxLen = cellLen;
      });
      return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: safeSheet,
      Author: 'Sistem Administrasi & Absensi MI',
      CreatedDate: new Date(),
    };
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheet);

    // Generate binary Uint8Array and wrap in standard OpenXML Spreadsheet MIME type
    const excelArray = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
      compression: true,
    });
    const blob = new Blob([excelArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerBlobDownload(blob, cleanFilename);
  } catch (err) {
    console.error('XLSX binary generation error, falling back to valid SpreadsheetML 2003 XML:', err);
    const xmlFilename = filename.replace(/\.(xls|xlsx|xml|csv)$/i, '') + '.xml';
    const xmlContent = buildSpreadsheetML2003XML(safeSheet, safeHeaders, safeRows);
    const blob = new Blob(['\uFEFF' + xmlContent], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    triggerBlobDownload(blob, xmlFilename);
  }
}

/**
 * Export tabular data to CSV (with UTF-8 BOM so Excel opens Indonesian characters cleanly)
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const cleanFilename = filename.replace(/\.(xls|xlsx|csv)$/i, '') + '.csv';
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvRows = [
    headers.map(escapeCsv).join(','),
    ...rows.map((r) => r.map(escapeCsv).join(',')),
  ];
  const csvString = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, cleanFilename);
}

/**
 * Export official Madrasah Report directly to a downloadable .pdf file using jsPDF + autoTable
 */
export function exportToPDFDocument(options: {
  filename: string;
  schoolName: string;
  nsm: string;
  npsn: string;
  address: string;
  docPrefix: string;
  reportTitle: string;
  subtitle: string;
  headmasterName: string;
  headmasterNip: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  const cleanFilename = options.filename.replace(/\.pdf$/i, '') + '.pdf';
  const doc = new jsPDF({
    orientation: options.headers.length > 7 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Official Letterhead (Kop Madrasah)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 30, 150);
  doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA - MADRASAH IBTIDAIYAH', 14, 13);

  doc.setFontSize(14);
  doc.setTextColor(31, 27, 56);
  doc.text(options.schoolName.toUpperCase(), 14, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 105);
  doc.text(`NSM: ${options.nsm}  |  NPSN: ${options.npsn}  |  ${options.address}`, 14, 24);
  doc.text(`Nomor Dokumen: ${options.docPrefix}`, 14, 28.5);

  // Divider line
  doc.setDrawColor(60, 30, 150);
  doc.setLineWidth(0.6);
  doc.line(14, 31.5, pageWidth - 14, 31.5);

  // Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(31, 27, 56);
  doc.text(options.reportTitle, 14, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 115);
  doc.text(options.subtitle, 14, 43);

  // AutoTable
  autoTable(doc, {
    startY: 47,
    head: [options.headers],
    body: options.rows,
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [31, 27, 56],
    },
    headStyles: {
      fillColor: [60, 30, 150],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [246, 245, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // Signature block at bottom of table
  const finalY = (doc as any).lastAutoTable?.finalY || 75;
  if (finalY + 35 < doc.internal.pageSize.getHeight()) {
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 65);
    doc.text('Mengetahui,', 14, finalY + 12);
    doc.setFont('helvetica', 'bold');
    doc.text('Kepala Madrasah', 14, finalY + 16.5);
    doc.text(options.headmasterName, 14, finalY + 31);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`NIP. ${options.headmasterNip}`, 14, finalY + 35);
  }

  const pdfBlob = doc.output('blob');
  triggerBlobDownload(pdfBlob, cleanFilename);
}

/**
 * Generate a clean, formal PDF statement of student bills/arrears (Surat Rekap Tunggakan & SPP Siswa)
 * specifically formatted for sharing with parents/guardians.
 */
export function exportStudentBillsPDF(options: {
  student: Student;
  classRoom?: ClassRoom;
  settings: SchoolSettings;
  bills: Bill[];
}) {
  const { student, classRoom, settings, bills } = options;
  const studentBills = bills.filter((b) => b.studentId === student.id);
  const className = classRoom?.name || student.classId;
  const todayStr = new Date().toISOString().slice(0, 10);
  const cleanName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_Tunggakan_${cleanName}_${student.nis}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Official Madrasah Header (Kop Surat)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 30, 150);
  doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA · MADRASAH IBTIDAIYAH', 14, 14);

  doc.setFontSize(14);
  doc.setTextColor(31, 27, 56);
  doc.text(settings.schoolName.toUpperCase(), 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 105);
  doc.text(`NSM: ${settings.nsm}  |  NPSN: ${settings.npsn}  |  ${settings.address}`, 14, 25);
  doc.text(
    `Nomor Dokumen: ${settings.docPrefix}  |  Tahun Ajaran: ${settings.academicYear} (${settings.semester})`,
    14,
    29.5
  );

  doc.setDrawColor(60, 30, 150);
  doc.setLineWidth(0.7);
  doc.line(14, 32.5, pageWidth - 14, 32.5);

  // 2. Document Title & Parent Salutation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(31, 27, 56);
  doc.text('LEMBAR INFORMASI & REKAPITULASI ADMINISTRASI KEUANGAN SISWA', 14, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 75);
  doc.text(`Kepada Yth. Bapak/Ibu ${student.parentName || 'Orang Tua / Wali Siswa'}`, 14, 46);
  doc.text(`Di Tempat`, 14, 50.5);

  // 3. Student Identity Box
  doc.setFillColor(246, 245, 252);
  doc.setDrawColor(225, 223, 240);
  doc.roundedRect(14, 54, pageWidth - 28, 22, 2.5, 2.5, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 27, 56);
  doc.text(`Nama Siswa : ${student.name}`, 18, 60.5);
  doc.text(`NIS / NISN   : ${student.nis} / ${student.nisn || '-'}`, 18, 66);
  doc.text(`Kelas            : ${className}`, 18, 71.5);

  doc.setFont('helvetica', 'normal');
  doc.text(`Orang Tua/Wali : ${student.parentName || '-'}`, pageWidth / 2 + 4, 60.5);
  doc.text(`No. Telepon/WA : ${student.parentPhone || '-'}`, pageWidth / 2 + 4, 66);
  doc.text(`Tanggal Cetak  : ${todayStr}`, pageWidth / 2 + 4, 71.5);

  // 4. Financial Summary Calculation
  const totalTagihan = studentBills.reduce((sum, b) => sum + b.amount, 0);
  const totalTerbayar = studentBills.reduce((sum, b) => sum + b.paidAmount, 0);
  const totalSisa = studentBills.reduce((sum, b) => sum + Math.max(0, b.amount - b.paidAmount), 0);

  // 5. Table of Bills
  const headers = [
    'No',
    'Jenis',
    'Rincian Tagihan',
    'Periode',
    'Jatuh Tempo',
    'Nominal (Rp)',
    'Terbayar (Rp)',
    'Sisa Tunggakan',
    'Status',
  ];

  const rows: (string | number)[][] =
    studentBills.length > 0
      ? studentBills.map((b, idx) => {
          const rem = Math.max(0, b.amount - b.paidAmount);
          return [
            idx + 1,
            b.type,
            b.title,
            b.period,
            b.dueDate || '-',
            `Rp ${b.amount.toLocaleString('id-ID')}`,
            `Rp ${b.paidAmount.toLocaleString('id-ID')}`,
            `Rp ${rem.toLocaleString('id-ID')}`,
            b.status,
          ];
        })
      : [['1', '-', 'Tidak ada catatan tagihan / tunggakan siswa', '-', '-', 'Rp 0', 'Rp 0', 'Rp 0', 'Lunas']];

  autoTable(doc, {
    startY: 81,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: [31, 27, 56],
    },
    headStyles: {
      fillColor: [60, 30, 150],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 248, 253],
    },
    margin: { left: 14, right: 14 },
  });

  const afterTableY = ((doc as any).lastAutoTable?.finalY || 110) + 6;

  // 6. Total Summary Box
  doc.setFillColor(243, 242, 248);
  doc.setDrawColor(60, 30, 150);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, afterTableY, pageWidth - 28, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 27, 56);
  doc.text(`Total Tagihan: Rp ${totalTagihan.toLocaleString('id-ID')}`, 18, afterTableY + 7);
  doc.setTextColor(43, 193, 85);
  doc.text(`Total Terbayar: Rp ${totalTerbayar.toLocaleString('id-ID')}`, 82, afterTableY + 7);
  doc.setTextColor(totalSisa > 0 ? 210 : 31, totalSisa > 0 ? 40 : 27, totalSisa > 0 ? 40 : 56);
  doc.text(`TOTAL SISA TUNGGAKAN: Rp ${totalSisa.toLocaleString('id-ID')}`, 18, afterTableY + 13.5);

  // 7. Polite Closing Note & Official Signatures
  const noteY = afterTableY + 25;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 95);
  doc.text(
    'Catatan: Lembar rekapitulasi ini diterbitkan secara resmi oleh sistem administrasi madrasah sebagai informasi bagi',
    14,
    noteY
  );
  doc.text(
    'orang tua/wali siswa. Pembayaran dapat dilakukan melalui loket Tata Usaha (TU) atau Wali Kelas.',
    14,
    noteY + 4.5
  );

  const sigY = noteY + 14;
  if (sigY + 30 < doc.internal.pageSize.getHeight()) {
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 55);
    doc.text('Mengetahui,', 14, sigY);
    doc.setFont('helvetica', 'bold');
    doc.text('Kepala Madrasah', 14, sigY + 4.5);
    doc.text(settings.headmasterName, 14, sigY + 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`NIP. ${settings.headmasterNip}`, 14, sigY + 25);

    doc.setFontSize(9);
    doc.text(`Diterbitkan pada: ${todayStr}`, pageWidth - 72, sigY);
    doc.setFont('helvetica', 'bold');
    doc.text('Bendahara / Administrasi TU', pageWidth - 72, sigY + 4.5);
    doc.text('Bagian Keuangan Madrasah', pageWidth - 72, sigY + 21);
  }

  const pdfBlob = doc.output('blob');
  triggerBlobDownload(pdfBlob, filename);
}

/**
 * Generate a clean, formal PDF Recap of all student bills/arrears for a class or entire school
 */
export function exportBillsRecapReportPDF(options: {
  filename: string;
  title: string;
  settings: SchoolSettings;
  bills: Bill[];
  students: Student[];
  classes: ClassRoom[];
}) {
  const { filename, title, settings, bills, students, classes } = options;
  const todayStr = new Date().toISOString().slice(0, 10);

  const headers = [
    'No',
    'NIS',
    'Nama Siswa',
    'Kelas',
    'Orang Tua / Wali',
    'Jenis & Rincian',
    'Periode',
    'Tagihan (Rp)',
    'Terbayar (Rp)',
    'Sisa Tunggakan',
    'Status',
  ];

  const totalTagihan = bills.reduce((s, b) => s + b.amount, 0);
  const totalTerbayar = bills.reduce((s, b) => s + b.paidAmount, 0);
  const totalSisa = bills.reduce((s, b) => s + Math.max(0, b.amount - b.paidAmount), 0);

  const rows: (string | number)[][] = bills.map((b, idx) => {
    const st = students.find((s) => s.id === b.studentId);
    const cls = classes.find((c) => c.id === st?.classId);
    const rem = Math.max(0, b.amount - b.paidAmount);
    return [
      idx + 1,
      st?.nis || '-',
      st?.name || b.studentId,
      cls?.name || st?.classId || '-',
      st?.parentName || '-',
      `${b.type} - ${b.title}`,
      b.period,
      `Rp ${b.amount.toLocaleString('id-ID')}`,
      `Rp ${b.paidAmount.toLocaleString('id-ID')}`,
      `Rp ${rem.toLocaleString('id-ID')}`,
      b.status,
    ];
  });

  rows.push([
    '',
    '',
    'TOTAL REKAPITULASI',
    '',
    '',
    '',
    '',
    `Rp ${totalTagihan.toLocaleString('id-ID')}`,
    `Rp ${totalTerbayar.toLocaleString('id-ID')}`,
    `Rp ${totalSisa.toLocaleString('id-ID')}`,
    '',
  ]);

  exportToPDFDocument({
    filename,
    schoolName: settings.schoolName,
    nsm: settings.nsm,
    npsn: settings.npsn,
    address: settings.address,
    docPrefix: settings.docPrefix,
    reportTitle: title,
    subtitle: `Tahun Ajaran ${settings.academicYear} (Semester ${settings.semester})  |  Total Sisa Tunggakan: Rp ${totalSisa.toLocaleString('id-ID')}  |  Tanggal Cetak: ${todayStr}`,
    headmasterName: settings.headmasterName,
    headmasterNip: settings.headmasterNip,
    headers,
    rows,
  });
}

/**
 * Export JSON file cleanly
 */
export function downloadJSONFile(filename: string, payload: unknown) {
  const cleanFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  triggerBlobDownload(blob, cleanFilename);
}

/**
 * Reliable browser & iframe download helper
 */
function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 1500);
}
