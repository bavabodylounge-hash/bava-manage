'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCustomer, updateCustomer } from '@/lib/firestoreClient';
import { Customer } from '@/types';

const GOALS = ['체지방 감량', '근육 증가', '체형 교정', '건강 유지', '복부 지방 제거', '전반적인 다이어트', '산후 관리', '노화 방지'];

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomer(id).then(c => {
      if (c) setForm(c);
      setLoading(false);
    });
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCustomer(id, form);
      router.push(`/customers/${id}`);
    } catch (err) {
      alert('저장 실패: ' + err);
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">← 뒤로</button>
        <h1 className="text-2xl font-bold text-gray-900">고객 정보 수정</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">📋 기본 정보</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="이름">
              <input value={form.name || ''} onChange={e => set('name', e.target.value)} className="input-field" required />
            </Field>
            <Field label="연락처">
              <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="input-field" required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="목표">
              <select value={form.goal || ''} onChange={e => set('goal', e.target.value)} className="input-field">
                {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="담당 매니저">
              <input value={form.trainerName || ''} onChange={e => set('trainerName', e.target.value)} className="input-field" />
            </Field>
          </div>
          <Field label="성향">
            <input value={form.personality || ''} onChange={e => set('personality', e.target.value)}
              placeholder="예: 꼼꼼함, 동기부여 필요..." className="input-field" />
          </Field>
          <Field label="특이사항">
            <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)}
              rows={3} className="input-field resize-none" />
          </Field>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">취소</button>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 bava-gradient text-white rounded-xl font-semibold shadow-md disabled:opacity-50">
            {saving ? '저장 중...' : '✅ 수정 완료'}
          </button>
        </div>
      </form>

      <style jsx global>{`
        .input-field { width:100%; padding:10px 14px; border:1px solid #E5E7EB; border-radius:10px; font-size:14px; outline:none; background:#FAFAFA; }
        .input-field:focus { border-color:#9333EA; background:#fff; box-shadow:0 0 0 3px rgba(147,51,234,0.08); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
