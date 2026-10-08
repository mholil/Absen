import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Student, ClassRoom, Role } from '../types';

interface StudentFormModalProps {
  isOpen: boolean;
  editingStudent: Student | null;
  classes: ClassRoom[];
  userRole: Role;
  userClassId?: string;
  onClose: () => void;
  onSave: (payload: Partial<Student>) => Promise<void>;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  editingStudent,
  classes,
  userRole,
  userClassId,
  onClose,
  onSave,
}) => {
  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [classId, setClassId] = useState(userClassId || classes[0]?.id || 'kls-1a');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentJob, setParentJob] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingStudent) {
      setNis(editingStudent.nis);
      setNisn(editingStudent.nisn || '');
      setName(editingStudent.name);
      setGender(editingStudent.gender);
      setClassId(editingStudent.classId);
      setParentName(editingStudent.parentName || '');
      setParentPhone(editingStudent.parentPhone || '');
      setParentJob(editingStudent.parentJob || '');
      setEmergencyContact(editingStudent.emergencyContact || '');
      setAddress(editingStudent.address || '');
    } else {
      setNis(`26010${Math.floor(10 + Math.random() * 89)}`);
      setNisn(`013489${Math.floor(1000 + Math.random() * 8999)}`);
      setName('');
      setGender('L');
      setClassId(userRole === 'wali_kelas' && userClassId ? userClassId : classes[0]?.id || 'kls-1a');
      setParentName('');
      setParentPhone('');
      setParentJob('');
      setEmergencyContact('');
      setAddress('');
    }
  }, [editingStudent, isOpen, userRole, userClassId, classes]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        nis,
        nisn,
        name,
        gender,
        classId: userRole === 'wali_kelas' && userClassId ? userClassId : classId,
        parentName,
        parentPhone,
        parentJob,
        emergencyContact,
        address,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl border border-indigo-100 flex flex-col max-h-[88vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-[#f3f2f8]">
          <h3 className="text-[15px] font-bold text-[#1f1b38]">
            {editingStudent ? 'Edit Data Siswa Madrasah' : 'Tambah Siswa Baru'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/70 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">NIS Lokal Madrasah *</label>
              <input
                type="text"
                value={nis}
                onChange={(e) => setNis(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">NISN Nasional</label>
              <input
                type="text"
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Nama Lengkap Siswa *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap sesuai akta/ijazah..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px]"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Kelas</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                disabled={userRole === 'wali_kelas'}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] disabled:bg-slate-100"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Nama Orang Tua / Wali</label>
              <input
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Nomor HP Orang Tua / WA</label>
              <input
                type="text"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="0812..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Pekerjaan Orang Tua</label>
              <input
                type="text"
                value={parentJob}
                onChange={(e) => setParentJob(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Kontak Darurat</label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Nomor & Hubungan Keluarga"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-medium text-slate-700 mb-1">Alamat Lengkap</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#3c1e96] px-5 py-2 text-[12px] font-semibold text-white hover:bg-[#4e36e2] cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Simpan Data Siswa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
