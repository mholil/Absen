import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  QrCode,
  Printer,
  RefreshCw,
  ShieldAlert,
  ImageUp,
} from 'lucide-react';
import { Student, ClassRoom } from '../types';

export const StudentQRCanvas: React.FC<{ value: string; size?: number }> = ({ value, size = 140 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(
        canvasRef.current,
        value,
        {
          width: size,
          margin: 1,
          color: {
            dark: '#3c1e96',
            light: '#ffffff',
          },
        },
        () => {}
      );
    }
  }, [value, size]);

  return <canvas ref={canvasRef} className="mx-auto rounded-lg border border-slate-100" />;
};

export const StudentQRCardModal: React.FC<{
  student: Student | null;
  classRoom?: ClassRoom;
  schoolName: string;
  onClose: () => void;
}> = ({ student, classRoom, schoolName, onClose }) => {
  if (!student) return null;

  const handlePrintCard = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-[#0b3d2e]/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 no-print">
          <h3 className="text-[15px] font-semibold text-[#0b3d2e]">Kartu QR Absensi Siswa</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-[#3c1e96] bg-[#f3f2f8] p-4 text-center">
          <div className="border-b border-[#3c1e96]/15 pb-2">
            <p className="text-[11px] font-semibold text-[#4e36e2]">{schoolName}</p>
            <p className="text-[13px] font-bold text-[#1f1b38]">KARTU IDENTITAS & ABSENSI SISWA</p>
          </div>

          <div className="my-3 flex justify-center">
            <div className="rounded-xl bg-white p-2.5 shadow-xs">
              <StudentQRCanvas value={student.qrCode} size={156} />
            </div>
          </div>

          <p className="text-[15px] font-bold text-[#1f1b38]">{student.name}</p>
          <p className="mt-0.5 text-[12px] text-slate-600">
            {classRoom?.name || student.classId} · NIS: <span className="font-mono font-medium">{student.nis}</span>
          </p>
          <p className="mt-1 text-[11px] font-mono text-[#4e36e2]">Kode QR: {student.qrCode}</p>
        </div>

        <div className="mt-4 flex items-center gap-2 no-print">
          <button
            onClick={handlePrintCard}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#3c1e96] py-2.5 text-[13px] font-medium text-white hover:bg-[#4e36e2] transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Kartu</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

interface QRScannerViewProps {
  students: Student[];
  classes: ClassRoom[];
  onScanCode: (code: string) => Promise<any>;
}

export const QRScannerView: React.FC<QRScannerViewProps> = ({ students, classes, onScanCode }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [lastResult, setLastResult] = useState<{
    studentName: string;
    nis: string;
    className: string;
    timeIn: string;
    status: string;
    qrCode: string;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async (preferredMode: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    setScanError(null);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Browser ini memblokir kamera langsung. Silakan klik tombol "Foto Kartu QR" di samping atau ketik NIS di bawah.'
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: preferredMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback if specific facingMode/resolution is rejected by device
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setCameraError(
        'Akses kamera langsung belum diizinkan oleh browser/pratinjau. Gunakan tombol "Foto Kartu QR" (Kamera HP) atau klik nama siswa di bawah.'
      );
      setCameraActive(false);
    }
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraActive) {
      startCamera(nextMode);
    }
  };

  // Decode QR from a captured photo or uploaded image file (Works 100% even inside restricted iframes/WebViews!)
  const handleImageCaptureScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    setCameraError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1000;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          triggerScan(code.data);
        } else {
          setScanError(
            'Kode QR tidak terbaca dari foto. Pastikan Kartu QR terlihat jelas dan terang, atau ketik NIS siswa.'
          );
        }
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    let animationFrameId: number;
    let lastScannedCode = '';
    let lastScannedTime = 0;

    const tick = () => {
      if (
        cameraActive &&
        videoRef.current &&
        canvasRef.current &&
        videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA &&
        videoRef.current.videoWidth > 0
      ) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code && code.data) {
            const now = Date.now();
            if (code.data !== lastScannedCode || now - lastScannedTime > 3000) {
              lastScannedCode = code.data;
              lastScannedTime = now;
              triggerScan(code.data);
            }
          }
        }
      }
      if (cameraActive) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (cameraActive) {
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [cameraActive]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const triggerScan = async (code: string) => {
    if (!code.trim() || isProcessing) return;
    setIsProcessing(true);
    setScanError(null);
    try {
      const res = await onScanCode(code.trim());
      if (res && res.student) {
        setLastResult({
          studentName: res.student.name,
          nis: res.student.nis,
          className: res.className,
          timeIn: res.record.timeIn,
          status: res.record.status,
          qrCode: res.student.qrCode,
        });
        setManualCode('');
      }
    } catch (err: any) {
      setScanError(err.message || 'Gagal memproses kode QR siswa.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="neu-card rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1f1b38]">Pemindai QR Absensi Siswa</h2>
            <p className="text-[12px] text-slate-500">
              Gunakan Kamera Live, Foto Kartu QR dari HP, atau ketik NIS / Kode QR
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden file input for Native Mobile Camera / Gallery QR Scan */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCaptureScan}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-[#3c1e96]/25 bg-indigo-50/70 px-3.5 py-2 text-[12px] font-semibold text-[#3c1e96] hover:bg-[#3c1e96] hover:text-white transition-colors cursor-pointer"
              title="Ambil Foto Kartu QR dengan Kamera HP atau Pilih Gambar QR"
            >
              <ImageUp className="w-4 h-4" />
              <span>Foto / Upload QR</span>
            </button>

            {!cameraActive ? (
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="flex items-center gap-1.5 rounded-full bg-[#3c1e96] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#4e36e2] transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Aktifkan Kamera</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-[#1f1b38] hover:bg-slate-50 cursor-pointer"
                  title="Ganti Kamera Depan / Belakang"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Putar Kamera</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>Matikan</span>
                </button>
              </>
            )}
          </div>
        </div>

        {cameraError && (
          <div className="mt-3 flex items-start justify-between gap-2.5 rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-[12px] text-amber-900">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Info Kamera Perangkat</p>
                <p className="mt-0.5 text-amber-800">{cameraError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 cursor-pointer"
            >
              Buka Kamera Foto QR
            </button>
          </div>
        )}

        {/* Always keep video element mounted so streamRef attaches immediately when startCamera is called */}
        <div
          className={`mt-3 relative overflow-hidden rounded-2xl bg-black aspect-video max-h-72 mx-auto items-center justify-center ${
            cameraActive ? 'flex' : 'hidden'
          }`}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-44 w-44 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          <span className="absolute bottom-2.5 rounded-lg bg-black/75 px-3 py-1 text-[11px] font-medium text-white">
            Arahkan Kartu QR Siswa ke dalam kotak hijau...
          </span>
        </div>

        {/* Manual / Fast QR Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            triggerScan(manualCode);
          }}
          className="mt-3 flex items-center gap-2"
        >
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ketik Kode QR (misal: MI-2601001) atau NIS Siswa..."
              className="w-full rounded-xl border border-slate-200 bg-[#f7f8f7] pl-9 pr-3 py-2 text-[13px] text-[#0b3d2e] focus:border-[#0a6b4a] focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isProcessing || !manualCode.trim()}
            className="rounded-xl bg-[#0a6b4a] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0b3d2e] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            {isProcessing ? 'Memproses...' : 'Catat Hadir'}
          </button>
        </form>

        {scanError && (
          <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">
            {scanError}
          </div>
        )}

        {lastResult && (
          <div className="mt-3 rounded-xl bg-emerald-50/90 border border-emerald-200 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#0a6b4a] shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-[#0a6b4a]">ABSENSI QR BERHASIL TERCATAT</p>
                  <p className="text-[15px] font-bold text-[#0b3d2e]">{lastResult.studentName}</p>
                </div>
              </div>
              <span className="text-[12px] font-mono font-semibold text-[#0b3d2e]">
                {lastResult.timeIn} WIB
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600 pl-7">
              <span>Kelas: <strong>{lastResult.className}</strong></span>
              <span>·</span>
              <span>NIS: <strong className="font-mono">{lastResult.nis}</strong></span>
              <span>·</span>
              <span>Status: <strong className={lastResult.status === 'Terlambat' ? 'text-amber-700' : 'text-[#0a6b4a]'}>{lastResult.status}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Simulation / Tap List for Guru Piket */}
      <div className="neu-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[14px] font-semibold text-[#0b3d2e]">
            Pilih Cepat / Simulasi Scan Kartu QR Siswa
          </h3>
          <span className="text-[11px] text-slate-500">{students.length} siswa terdaftar</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
          {students.map((st) => {
            const cls = classes.find((c) => c.id === st.classId);
            return (
              <button
                key={st.id}
                onClick={() => triggerScan(st.qrCode)}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-[#f7f8f7] px-3 py-2 text-left hover:border-[#0a6b4a] hover:bg-white transition-colors cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-[13px] font-medium text-[#0b3d2e] truncate">{st.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {cls?.name || st.classId} · <span className="font-mono">{st.qrCode}</span>
                  </p>
                </div>
                <span className="text-[11px] font-medium text-[#0a6b4a] shrink-0">Scan →</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
