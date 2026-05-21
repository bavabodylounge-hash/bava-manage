'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer } from '@/lib/firestore';
import { ProgramType, PROGRAM_LABELS, PROGRAM_EMOJIS } from '@/types';

const GOALS = ['체지방 감량', '근육 증가', '체형 교정', '건강 유지', '복부 지방 제거', '전반적인 다이어트', '산후 관리', '노화 방지'];
const TRAINERS = ['김지수', '이하나', '박소연', '최민지', '정유진'];
const ALL_PROGRAMS: ProgramType[] = ['pilatesPt', 'bodyManage', 'circulation', 'headSpa'];

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedPrograms, setSelectedPrograms] = useState<ProgramType[]>([]);
  const [form, setForm] = useState({
    name: '', phone: '', birthYear: '', gender: 'female' as 'female' | 'male',
    goal: '체지방 감량', personality: '', startDate: new Date().toISOString().slice(0, 10),
    trainerName: '', notes: '', status: 'active' as const,
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const toggleProgram = (p: ProgramType) => {
    setSelectedPrograms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.trainerName) return alert('이름, 연락처, 담당자는 필수입니다.');
    if (selectedPrograms.length === 0) return alert('프로그램을 1개 이상 선택해주세요.');
    setSaving(true);
    try {
      console.log('저장 시작:', form.name);
      const id = await createCustomer({
        ...form,
        birthYear: form.birthYear ? parseInt(form.birthYear) : undefined,
        programs: selectedPrograms,
      });
      console.log('저장 완료, id:', id);
      router.push(`/customers/${id}`);
    } catch (err) {
      console.error('저장 에러:', err);
      alert('저장 실패: ' + String(err));
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          ← 뒤로
        </button>
        <h1 className="text-2xl font-bold text-gray-900">신규 고객 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 기본 정보 */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">📋 기본 정보</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="고객 이름 *">
              <input required value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="홍길동" className="input-field" />
            </Field>
            <Field label="연락처 *">
              <input required value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="010-0000-0000" className="input-field" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="출생 연도">
              <input type="number" value={form.birthYear} onChange={e => set('birthYear', e.target.value)}
                placeholder="1990" min="1940" max="2010" className="input-field" />
            </Field>
            <Field label="성별">
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className="input-field">
                <option value="female">여성</option>
                <option value="male">남성</option>
              </select>
            </Field>
          </div>
        </div>

        {/* 프로그램 선택 */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">🏋️ 프로그램 선택 * <span className="text-xs font-normal text-gray-400">(복수 선택 가능)</span></h2>
          <div className="grid grid-cols-2 gap-3">
            {ALL_PROGRAMS.map(p => {
              const selected = selectedPrograms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProgram(p)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    selected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50/30'
                  }`}
                >
                  <span className="text-2xl">{PROGRAM_EMOJIS[p]}</span>
                  <div>
                    <p className={`font-semibold text-sm ${selected ? 'text-purple-700' : 'text-gray-700'}`}>
                      {PROGRAM_LABELS[p]}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p === 'pilatesPt' && '사진 앞·측·뒤 3장'}
                      {p === 'bodyManage' && '사진 1장 + 인치변화'}
                      {p === 'circulation' && '사진 1장'}
                      {p === 'headSpa' && '사진 1장'}
                    </p>
                  </div>
                  {selected && (
                    <span className="ml-auto text-purple-500 text-lg">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedPrograms.length > 0 && (
            <p className="text-xs text-purple-600 bg-purple-50 px-3 py-2 rounded-lg">
              선택됨: {selectedPrograms.map(p => PROGRAM_LABELS[p]).join(', ')}
            </p>
          )}
        </div>

        {/* 관리 정보 */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">💪 관리 정보</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="목표">
              <select value={form.goal} onChange={e => set('goal', e.target.value)} className="input-field">
                {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="담당 매니저 *">
              <input value={form.trainerName} onChange={e => set('trainerName', e.target.value)}
                list="trainers-list" placeholder="담당자 이름" className="input-field" required />
              <datalist id="trainers-list">
                {TRAINERS.map(t => <option key={t} value={t} />)}
              </datalist>
            </Field>
          </div>
          <Field label="관리 시작일">
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
              className="input-field" />
          </Field>
          <Field label="고객 성향 (자유 입력)">
            <input value={form.personality} onChange={e => set('personality', e.target.value)}
              placeholder="예: 꼼꼼하고 동기부여가 필요함, 운동을 즐기는 편, 식단 조절 어려움..."
              className="input-field" />
          </Field>
          <Field label="특이사항 / 주의사항">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={3} placeholder="알레르기, 부상 이력, 주의해야 할 사항, 선호/비선호 운동 등..."
              className="input-field resize-none" />
          </Field>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 bava-gradient text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50">
            {saving ? '저장 중...' : '✅ 고객 등록'}
          </button>
        </div>
      </form>

      <style jsx global>{`
        .input-field {
          width: 100%; padding: 10px 14px; border: 1px solid #E5E7EB;
          border-radius: 10px; font-size: 14px; outline: none;
          transition: border-color 0.15s; background: #FAFAFA;
        }
        .input-field:focus { border-color: #9333EA; background: #fff; box-shadow: 0 0 0 3px rgba(147,51,234,0.08); }
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
