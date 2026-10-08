import React, { useState } from 'react';
import { X, MessageCircle, Copy, Check, ExternalLink, Phone, Send } from 'lucide-react';

export interface WhatsAppPayload {
  phone: string;
  rawPhone: string;
  recipientName: string;
  studentName: string;
  text: string;
  waMeUrl: string;
  apiWaUrl: string;
  webWaUrl: string;
  deepLinkUrl: string;
}

interface WhatsAppPreviewModalProps {
  payload: WhatsAppPayload | null;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({
  payload,
  onClose,
  showToast,
}) => {
  const [editableText, setEditableText] = useState(payload?.text || '');
  const [editablePhone, setEditablePhone] = useState(payload?.phone || '');
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (payload) {
      setEditableText(payload.text);
      setEditablePhone(payload.phone);
      setCopied(false);
    }
  }, [payload]);

  if (!payload) return null;

  const cleanPhone = editablePhone.replace(/[^0-9]/g, '');
  const encodedMsg = encodeURIComponent(editableText);

  const directAppProtocolUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`;
  const webWaDirectUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;
  const waMeDirectUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(editableText);
      setCopied(true);
      showToast('Pesan berhasil disalin ke clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Gagal menyalin pesan', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs no-print">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-emerald-100 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#2bc155] text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold truncate">Kirim Pesan WhatsApp Orang Tua</h3>
              <p className="text-[11px] text-emerald-50 truncate">
                Siswa: {payload.studentName} · Wali: {payload.recipientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/20 cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">
              Nomor WhatsApp Orang Tua / Wali (Format 628...)
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={editablePhone}
                onChange={(e) => setEditablePhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#f3f2f8] pl-9 pr-3 py-2 text-[13px] font-mono focus:bg-white focus:border-[#2bc155] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11.5px] font-semibold text-slate-600">
                Isi Pesan Template (Dapat diedit sebelum dikirim)
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-[#2bc155]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
              </button>
            </div>
            <textarea
              rows={9}
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-[#f7f8f7] p-3.5 text-[12.5px] leading-relaxed text-[#1f1b38] focus:bg-white focus:border-[#2bc155] focus:outline-none"
            />
          </div>

          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3 text-[11.5px] text-emerald-950 space-y-1">
            <p className="font-semibold text-[#0b3d2e]">Pilih Metode Pengiriman WhatsApp:</p>
            <p className="text-slate-600">
              • Gunakan <strong>Buka Aplikasi WhatsApp</strong> untuk langsung membuka aplikasi WA di HP/Laptop tanpa melewati halaman blokir browser.
            </p>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="px-4 sm:px-5 py-3.5 border-t border-slate-100 bg-[#f3f2f8] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Batal
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Option 1: Direct whatsapp:// protocol (Never blocked by iframe X-Frame-Options!) */}
            <a
              href={directAppProtocolUrl}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2bc155] px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-[#24a648] transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Buka Aplikasi WA</span>
            </a>

            {/* Option 2: WhatsApp Web in New Tab */}
            <a
              href={webWaDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3c1e96] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#4e36e2] transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>WA Web</span>
            </a>

            {/* Option 3: Official wa.me link */}
            <a
              href={waMeDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-[#1f1b38] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span>wa.me</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
