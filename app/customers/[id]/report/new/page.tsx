'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCustomer, getCustomerReports, createReport } from '@/lib/firestoreClient';
import { Customer, MonthlyReport, ProgramType, ReportProgram, PROGRAM_LABELS, PROGRAM_EMOJIS } from '@/types';

const PROGRAM_TYPES: ProgramType[] = ['pilatesPt', 'bodyManage', 'circulation', 'headSpa'];

// 프로그램별 사진 슬롯 정의
type PhotoSlot = { key: string; label: string };
function getPhotoSlots(type: ProgramType): { before: PhotoSlot[]; after: PhotoSlot[] } {
  if (type === 'pilatesPt') {
    return {
      before: [{ key: 'beforeFrontUrl', label: '앞면' }, { key: 'beforeSideUrl', label: '측면' }, { key: 'beforeBackUrl', label: '뒷면' }],
      after:  [{ key: 'afterFrontUrl',  label: '앞면' }, { key: 'afterSideUrl',  label: '측면' }, { key: 'afterBackUrl',  label: '뒷면' }],
    };
  }
  return {
    before: [{ key: 'beforeFrontUrl', label: 'Before' }],
    after:  [{ key: 'afterFrontUrl',  label: 'After' }],
  };
}

// 인치 변화 항목 (바디관리 전용)
const INCH_ITEMS = [
  { label: '하체 둘레', sub: '허벅지·종아리', beforeKey: 'inchLowerBefore', afterKey: 'inchLowerAfter' },
  { label: '팔 둘레',   sub: '이두·삼두',     beforeKey: 'inchArmBefore',   afterKey: 'inchArmAfter' },
  { label: '복부 둘레', sub: '허리·복부',      beforeKey: 'inchAbdomenBefore', afterKey: 'inchAbdomenAfter' },
  { label: '엉덩이',    sub: '힙라인',         beforeKey: 'inchHipBefore',   afterKey: 'inchHipAfter' },
];

// 프로그램별 데이터 상태
interface ProgramState {
  selected: boolean;
  currentSession: string;
  remainingSessions: string;
  photos: Record<string, string>;   // key → url
  inch: Record<string, string>;     // inchXxxBefore/After → value
}

function initProgramState(): ProgramState {
  return { selected: false, currentSession: '', remainingSessions: '', photos: {}, inch: {} };
}

export default function NewReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [allReports, setAllReports] = useState<MonthlyReport[]>([]);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null); // "programType_photoKey"

  const thisMonth = new Date().toISOString().slice(0, 7);
  const [reportMonth, setReportMonth] = useState(thisMonth);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [personality, setPersonality] = useState('');
  const [monthlyNote, setMonthlyNote] = useState('');
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiDirection, setAiDirection] = useState('');

  // 프로그램별 상태
  const [programs, setPrograms] = useState<Record<ProgramType, ProgramState>>({
    pilatesPt:   initProgramState(),
    bodyManage:  initProgramState(),
    circulation: initProgramState(),
    headSpa:     initProgramState(),
  });

  // 파일 input ref 모음: "programType_photoKey" → ref
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    Promise.all([getCustomer(id), getCustomerReports(id)])
      .then(([c, r]) => {
        setCustomer(c);
        setAllReports(r);
        if (c) setPersonality(c.personality || '');
      })
      .catch(err => console.error('데이터 로드 실패:', err));
  }, [id]);

  // 프로그램 상태 업데이트 헬퍼
  const updateProgram = (type: ProgramType, patch: Partial<ProgramState>) => {
    setPrograms(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  };
  const toggleProgram = (type: ProgramType) => {
    updateProgram(type, { selected: !programs[type].selected });
  };
  const setPhoto = (type: ProgramType, key: string, url: string) => {
    setPrograms(prev => ({
      ...prev,
      [type]: { ...prev[type], photos: { ...prev[type].photos, [key]: url } },
    }));
  };
  const setInch = (type: ProgramType, key: string, val: string) => {
    setPrograms(prev => ({
      ...prev,
      [type]: { ...prev[type], inch: { ...prev[type].inch, [key]: val } },
    }));
  };

  // 사진 업로드
  const handlePhotoUpload = async (file: File, type: ProgramType, photoKey: string) => {
    const refKey = `${type}_${photoKey}`;
    setUploadingKey(refKey);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('파일 크기 10MB 이하');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', `reports/${id}/${reportMonth}/${type}_${photoKey}`);
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPhoto(type, photoKey, data.url);
    } catch (err) {
      alert('업로드 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingKey(null);
    }
  };

  // 선택된 프로그램 목록
  const selectedTypes = PROGRAM_TYPES.filter(t => programs[t].selected);

  // AI 생성
  const handleGenerateAI = async () => {
    if (!customer || !weight) return alert('체중을 먼저 입력해주세요.');
    setGeneratingAI(true);
    try {
      const res = await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          report: { weight: parseFloat(weight), bodyFat: bodyFat ? parseFloat(bodyFat) : undefined, personality, monthlyNote },
          allReports,
          mode: 'monthly',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiFeedback(data.feedback || '');
      setAiDirection(data.direction || '');
    } catch (err) {
      alert('AI 생성 실패: ' + err);
    } finally {
      setGeneratingAI(false);
    }
  };

  // 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !weight) return alert('체중은 필수입니다.');
    if (selectedTypes.length === 0) return alert('프로그램을 최소 1개 선택해주세요.');
    setSaving(true);
    try {
      const reportPrograms: ReportProgram[] = selectedTypes.map(type => {
        const p = programs[type];
        const prog: ReportProgram = {
          programType: type,
          programLabel: PROGRAM_LABELS[type],
          currentSession: p.currentSession ? parseInt(p.currentSession) : undefined,
          remainingSessions: p.remainingSessions ? parseInt(p.remainingSessions) : undefined,
          beforeFrontUrl: p.photos['beforeFrontUrl'] || undefined,
          beforeSideUrl:  p.photos['beforeSideUrl']  || undefined,
          beforeBackUrl:  p.photos['beforeBackUrl']  || undefined,
          afterFrontUrl:  p.photos['afterFrontUrl']  || undefined,
          afterSideUrl:   p.photos['afterSideUrl']   || undefined,
          afterBackUrl:   p.photos['afterBackUrl']   || undefined,
        };
        if (type === 'bodyManage') {
          prog.inchLowerBefore   = p.inch['inchLowerBefore']   ? parseFloat(p.inch['inchLowerBefore'])   : undefined;
          prog.inchLowerAfter    = p.inch['inchLowerAfter']    ? parseFloat(p.inch['inchLowerAfter'])    : undefined;
          prog.inchArmBefore     = p.inch['inchArmBefore']     ? parseFloat(p.inch['inchArmBefore'])     : undefined;
          prog.inchArmAfter      = p.inch['inchArmAfter']      ? parseFloat(p.inch['inchArmAfter'])      : undefined;
          prog.inchAbdomenBefore = p.inch['inchAbdomenBefore'] ? parseFloat(p.inch['inchAbdomenBefore']) : undefined;
          prog.inchAbdomenAfter  = p.inch['inchAbdomenAfter']  ? parseFloat(p.inch['inchAbdomenAfter'])  : undefined;
          prog.inchHipBefore     = p.inch['inchHipBefore']     ? parseFloat(p.inch['inchHipBefore'])     : undefined;
          prog.inchHipAfter      = p.inch['inchHipAfter']      ? parseFloat(p.inch['inchHipAfter'])      : undefined;
        }
        return prog;
      });

      await createReport({
        customerId:   id,
        customerName: customer.name,
        reportMonth,
        weight:      parseFloat(weight),
        height:      height    ? parseFloat(height)    : undefined,
        bodyFat:     bodyFat   ? parseFloat(bodyFat)   : undefined,
        muscleMass:  muscleMass? parseFloat(muscleMass): undefined,
        programs:    reportPrograms,
        personality,
        monthlyNote,
        aiFeedback:  aiFeedback  || undefined,
        aiDirection: aiDirection || undefined,
      });
      router.push(`/customers/${id}`);
    } catch (err) {
      alert('저장 실패: ' + err);
      setSaving(false);
    }
  };

  if (!customer) return <LoadingSpinner />;

  const lastReport = allReports.length > 0 ? allReports[allReports.length - 1] : null;
  const weightChange = lastReport && weight ? parseFloat(weight) - lastReport.weight : null;

  let bmiInfo = '';
  if (height && weight) {
    const bmi = parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2);
    const cat = bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만';
    const color = bmi < 18.5 ? 'text-blue-500' : bmi < 23 ? 'text-green-500' : bmi < 25 ? 'text-yellow-500' : 'text-red-500';
    bmiInfo = `BMI ${bmi.toFixed(1)} · <span class="${color} font-semibold">${cat}</span>`;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">← 뒤로</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">월별 리포트 작성</h1>
          <p className="text-gray-500 text-sm">{customer.name} · {customer.goal}</p>
        </div>
      </div>

      {/* 지난 달 참고 */}
      {lastReport && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm">
          <span className="text-purple-600 font-semibold">📌 지난 달 ({lastReport.reportMonth})</span>
          <span className="text-gray-600 ml-3">체중 {lastReport.weight}kg</span>
          {lastReport.bodyFat && <span className="text-gray-500 ml-2">· 체지방 {lastReport.bodyFat}%</span>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ① 측정 데이터 */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">📊 측정 데이터</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="리포트 월 *">
              <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="input-field" required />
            </Field>
            <Field label={`체중 (kg) *${weightChange !== null ? ` → ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}kg` : ''}`}>
              <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)}
                placeholder="예: 58.5" className="input-field" required />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="키 (cm)">
              <input type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} placeholder="예: 163" className="input-field" />
            </Field>
            <Field label="체지방률 (%)">
              <input type="number" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="예: 24.5" className="input-field" />
            </Field>
            <Field label="근육량 (kg)">
              <input type="number" step="0.1" value={muscleMass} onChange={e => setMuscleMass(e.target.value)} placeholder="예: 28.3" className="input-field" />
            </Field>
          </div>
          {bmiInfo && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2"
              dangerouslySetInnerHTML={{ __html: `📏 ${bmiInfo}` }} />
          )}
        </div>

        {/* ② 프로그램 선택 */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">🏋️ 진행 프로그램 선택</h2>
          <p className="text-xs text-gray-400">이번 달 진행한 프로그램을 선택하세요 (복수 선택 가능)</p>
          <div className="grid grid-cols-2 gap-3">
            {PROGRAM_TYPES.map(type => {
              const sel = programs[type].selected;
              return (
                <button key={type} type="button" onClick={() => toggleProgram(type)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all
                    ${sel ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-500 hover:border-purple-200'}`}>
                  <span className="text-xl">{PROGRAM_EMOJIS[type]}</span>
                  <span>{PROGRAM_LABELS[type]}</span>
                  {sel && <span className="ml-auto text-purple-500">✓</span>}
                </button>
              );
            })}
          </div>
          {selectedTypes.length === 0 && (
            <p className="text-xs text-red-400">⚠️ 최소 1개 프로그램을 선택해주세요</p>
          )}
        </div>

        {/* ③ 선택된 프로그램별 섹션 */}
        {selectedTypes.map(type => {
          const p = programs[type];
          const slots = getPhotoSlots(type);
          const total = p.currentSession && p.remainingSessions
            ? parseInt(p.currentSession) + parseInt(p.remainingSessions) : 0;
          const progress = total > 0 ? Math.min(100, (parseInt(p.currentSession!) / total) * 100) : 0;

          return (
            <div key={type} className="card space-y-4">
              {/* 프로그램 헤더 */}
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-2xl">{PROGRAM_EMOJIS[type]}</span>
                <h2 className="font-bold text-gray-700">{PROGRAM_LABELS[type]}</h2>
              </div>

              {/* 회차 */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="진행 회차">
                  <div className="relative">
                    <input type="number" min="1" value={p.currentSession}
                      onChange={e => updateProgram(type, { currentSession: e.target.value })}
                      placeholder="예: 8" className="input-field pr-10" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">회</span>
                  </div>
                </Field>
                <Field label="남은 회차">
                  <div className="relative">
                    <input type="number" min="0" value={p.remainingSessions}
                      onChange={e => updateProgram(type, { remainingSessions: e.target.value })}
                      placeholder="예: 4" className="input-field pr-10" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">회</span>
                  </div>
                </Field>
              </div>
              {total > 0 && (
                <div className="bg-purple-50 rounded-xl p-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>진행률</span>
                    <span className="font-semibold text-purple-600">{p.currentSession}회 완료 · {p.remainingSessions}회 남음</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bava-gradient h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Before 사진 */}
              <div>
                <p className="text-xs font-semibold text-orange-500 mb-2">
                  📸 Before 사진 {type === 'pilatesPt' ? '(앞·측·뒤 3장)' : '(1장)'}
                </p>
                <div className={`grid gap-3 ${type === 'pilatesPt' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {slots.before.map(slot => (
                    <PhotoBox key={slot.key}
                      label={slot.label}
                      url={p.photos[slot.key] || ''}
                      uploading={uploadingKey === `${type}_${slot.key}`}
                      theme="before"
                      onFile={f => handlePhotoUpload(f, type, slot.key)}
                      onRemove={() => setPhoto(type, slot.key, '')}
                      inputRef={el => { fileRefs.current[`${type}_${slot.key}`] = el; }}
                    />
                  ))}
                  {/* 필라테스PT가 아닌 경우 After도 같은 행에 표시 */}
                  {type !== 'pilatesPt' && slots.after.map(slot => (
                    <PhotoBox key={slot.key}
                      label={slot.label}
                      url={p.photos[slot.key] || ''}
                      uploading={uploadingKey === `${type}_${slot.key}`}
                      theme="after"
                      onFile={f => handlePhotoUpload(f, type, slot.key)}
                      onRemove={() => setPhoto(type, slot.key, '')}
                      inputRef={el => { fileRefs.current[`${type}_${slot.key}`] = el; }}
                    />
                  ))}
                </div>
              </div>

              {/* After 사진 (필라테스PT만 별도 행) */}
              {type === 'pilatesPt' && (
                <div>
                  <p className="text-xs font-semibold text-purple-600 mb-2">✨ After 사진 (앞·측·뒤 3장)</p>
                  <div className="grid grid-cols-3 gap-3">
                    {slots.after.map(slot => (
                      <PhotoBox key={slot.key}
                        label={slot.label}
                        url={p.photos[slot.key] || ''}
                        uploading={uploadingKey === `${type}_${slot.key}`}
                        theme="after"
                        onFile={f => handlePhotoUpload(f, type, slot.key)}
                        onRemove={() => setPhoto(type, slot.key, '')}
                        inputRef={el => { fileRefs.current[`${type}_${slot.key}`] = el; }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 인치 변화 (바디관리 전용) */}
              {type === 'bodyManage' && (
                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-3">📐 인치 변화 (cm)</p>
                  <div className="space-y-2">
                    {/* 헤더 */}
                    <div className="grid grid-cols-4 gap-2 text-xs text-center text-gray-400 font-medium">
                      <div className="text-left">부위</div>
                      <div className="bg-orange-50 rounded py-1">Before</div>
                      <div className="bg-purple-50 rounded py-1">After</div>
                      <div>변화</div>
                    </div>
                    {INCH_ITEMS.map(item => {
                      const bv = parseFloat(p.inch[item.beforeKey] || '');
                      const av = parseFloat(p.inch[item.afterKey]  || '');
                      const diff = (!isNaN(bv) && !isNaN(av)) ? av - bv : null;
                      return (
                        <div key={item.label} className="grid grid-cols-4 gap-2 items-center">
                          <div>
                            <p className="text-xs font-medium text-gray-700">{item.label}</p>
                            <p className="text-xs text-gray-400">{item.sub}</p>
                          </div>
                          <input type="number" step="0.1" value={p.inch[item.beforeKey] || ''}
                            onChange={e => setInch(type, item.beforeKey, e.target.value)}
                            placeholder="-" className="input-field text-center text-sm px-2" />
                          <input type="number" step="0.1" value={p.inch[item.afterKey] || ''}
                            onChange={e => setInch(type, item.afterKey, e.target.value)}
                            placeholder="-" className="input-field text-center text-sm px-2" />
                          <div className={`text-center text-sm font-bold
                            ${diff === null ? 'text-gray-300' : diff < 0 ? 'text-green-500' : diff > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {diff === null ? '-' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ④ 매니저 메모 */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">📝 매니저 메모</h2>
          <Field label="이번 달 고객 성향">
            <input value={personality} onChange={e => setPersonality(e.target.value)}
              placeholder="예: 이번 달 의지가 강함, 식단 잘 지킴..."
              className="input-field" />
          </Field>
          <Field label="이번 달 특이사항 및 메모">
            <textarea value={monthlyNote} onChange={e => setMonthlyNote(e.target.value)}
              rows={4} placeholder="운동 수행도, 식단 준수 여부, 부상/컨디션 변화..."
              className="input-field resize-none" />
          </Field>
        </div>

        {/* ⑤ AI 피드백 */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h2 className="font-bold text-gray-700">🤖 AI 피드백 &amp; 방향성</h2>
              <p className="text-xs text-gray-400 mt-0.5">측정 데이터 기반 자동 생성</p>
            </div>
            <button type="button" onClick={handleGenerateAI} disabled={generatingAI || !weight}
              className="px-4 py-2 bava-gradient text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-all">
              {generatingAI ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  분석 중...
                </span>
              ) : '✨ AI 자동 생성'}
            </button>
          </div>
          <Field label="이번 달 코멘트">
            <textarea value={aiFeedback} onChange={e => setAiFeedback(e.target.value)}
              rows={5} placeholder="AI 생성 또는 직접 입력..." className="input-field resize-none" />
          </Field>
          <Field label="다음 달 방향성">
            <textarea value={aiDirection} onChange={e => setAiDirection(e.target.value)}
              rows={5} placeholder="AI 생성 또는 직접 입력..." className="input-field resize-none" />
          </Field>
        </div>

        {/* 저장 버튼 */}
        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button type="submit" disabled={saving || selectedTypes.length === 0}
            className="flex-1 py-3 bava-gradient text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50">
            {saving ? '저장 중...' : '✅ 리포트 저장'}
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

// 사진 업로드 박스
function PhotoBox({ label, url, uploading, theme, onFile, onRemove, inputRef }: {
  label: string; url: string; uploading: boolean;
  theme: 'before' | 'after';
  onFile: (f: File) => void; onRemove: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const borderColor = theme === 'before'
    ? (url ? 'border-orange-300' : 'border-gray-200 hover:border-orange-300')
    : (url ? 'border-purple-300' : 'border-gray-200 hover:border-purple-300');

  return (
    <div className="space-y-1">
      <p className="text-xs text-center text-gray-500 font-medium">{label}</p>
      <div onClick={() => !url && localRef.current?.click()}
        className={`relative w-full aspect-[3/4] rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer transition-colors bg-gray-50 ${borderColor}`}>
        {uploading ? (
          <div className="flex flex-col items-center gap-1">
            <div className={`w-6 h-6 border-2 ${theme === 'before' ? 'border-orange-400' : 'border-purple-500'} border-t-transparent rounded-full animate-spin`} />
            <span className="text-xs text-gray-400">업로드 중</span>
          </div>
        ) : url ? (
          <>
            <img src={url} alt={label} className="w-full h-full object-cover" />
            <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 shadow">
              ×
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <span className="text-2xl">📷</span>
            <span className="text-xs">클릭하여 업로드</span>
          </div>
        )}
      </div>
      <input ref={el => { localRef.current = el; inputRef(el); }}
        type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
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

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
