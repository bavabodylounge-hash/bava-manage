'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getReport, updateReport, getCustomer } from '@/lib/firestoreClient';
import { Customer, MonthlyReport, ProgramType, ReportProgram, PROGRAM_LABELS, PROGRAM_EMOJIS } from '@/types';

// ──── 영양 계산 (Mifflin-St Jeor) ────
interface NutritionResult {
  bmr: number; tdee: number; targetKcal: number;
  carb: number; protein: number; fat: number;
  targetWeightLoss?: number;
  weeklyDeficit?: number;
  weeksToGoal?: number;
  mealPlan: string[];
}
function calcNutrition(
  weightKg: number, heightCm: number, gender: 'female' | 'male', goal: string,
  targetWeightLoss?: number
): NutritionResult {
  const bmr = gender === 'female'
    ? 10 * weightKg + 6.25 * heightCm - 5 * 30 - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * 30 + 5;
  const tdee = Math.round(bmr * 1.4);
  const isLoss = goal.includes('감량') || goal.includes('다이어트') || goal.includes('지방');
  const isBulk = goal.includes('근육') || goal.includes('증가');

  let targetKcal: number;
  let weeklyDeficit: number | undefined;
  let weeksToGoal: number | undefined;

  if (targetWeightLoss && targetWeightLoss > 0) {
    const weeklyLossKg = Math.min(targetWeightLoss / 12, 0.8);
    weeklyDeficit = Math.round(weeklyLossKg * 7700);
    const dailyDeficit = Math.round(weeklyDeficit / 7);
    targetKcal = Math.max(tdee - dailyDeficit, gender === 'female' ? 1200 : 1500);
    weeksToGoal = Math.ceil(targetWeightLoss / weeklyLossKg);
  } else if (isLoss) {
    targetKcal = Math.round(tdee * 0.8);
  } else if (isBulk) {
    targetKcal = Math.round(tdee * 1.1);
  } else {
    targetKcal = tdee;
  }

  let carbRatio = 0.45, protRatio = 0.25, fatRatio = 0.30;
  if (isLoss || targetWeightLoss) { carbRatio = 0.40; protRatio = 0.35; fatRatio = 0.25; }
  if (isBulk) { carbRatio = 0.45; protRatio = 0.30; fatRatio = 0.25; }
  const carb    = Math.round((targetKcal * carbRatio) / 4);
  const protein = Math.round((targetKcal * protRatio) / 4);
  const fat     = Math.round((targetKcal * fatRatio)  / 9);
  const mealPlan: string[] = (isLoss || targetWeightLoss)
    ? ['🌅 아침: 닭가슴살 100g + 삶은 달걀 2개 + 방울토마토',
       '☀️ 점심: 현미밥 반공기 + 두부조림 + 나물 반찬 2가지',
       '🌙 저녁: 고구마 1개 + 그릭요거트 + 오이·당근 스틱',
       '🍎 간식: 아몬드 15알 또는 단백질 쉐이크',
       '💧 수분: 하루 물 2L 이상']
    : isBulk
    ? ['🌅 아침: 귀리오트밀 100g + 바나나 1개 + 삶은 달걀 3개',
       '☀️ 점심: 현미밥 1공기 + 닭가슴살 150g + 채소볶음',
       '🌙 저녁: 고구마 2개 + 두부 반모 + 브로콜리',
       '💪 운동 후: 단백질 쉐이크 + 바나나']
    : ['🌅 아침: 통곡물빵 2장 + 스크램블에그 + 우유 200ml',
       '☀️ 점심: 잡곡밥 + 생선구이 + 나물 반찬',
       '🌙 저녁: 닭가슴살 + 샐러드 + 견과류 한 줌',
       '🍵 간식: 그릭요거트 or 프로틴바 1개'];
  return { bmr: Math.round(bmr), tdee, targetKcal, carb, protein, fat,
    targetWeightLoss, weeklyDeficit, weeksToGoal, mealPlan };
}

const PROGRAM_TYPES: ProgramType[] = ['pilatesPt', 'bodyManage', 'circulation', 'headSpa'];

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

const INCH_ITEMS = [
  { label: '하체 둘레', sub: '허벅지·종아리', beforeKey: 'inchLowerBefore',   afterKey: 'inchLowerAfter' },
  { label: '팔 둘레',   sub: '이두·삼두',     beforeKey: 'inchArmBefore',     afterKey: 'inchArmAfter' },
  { label: '복부 둘레', sub: '허리·복부',      beforeKey: 'inchAbdomenBefore', afterKey: 'inchAbdomenAfter' },
  { label: '엉덩이',    sub: '힙라인',         beforeKey: 'inchHipBefore',     afterKey: 'inchHipAfter' },
];

interface ProgramState {
  selected: boolean;
  currentSession: string;
  remainingSessions: string;
  photos: Record<string, string>;
  inch: Record<string, string>;
}

function initProgramState(): ProgramState {
  return { selected: false, currentSession: '', remainingSessions: '', photos: {}, inch: {} };
}

// ReportProgram → ProgramState
function fromReportProgram(prog: ReportProgram): ProgramState {
  return {
    selected: true,
    currentSession:   prog.currentSession   != null ? String(prog.currentSession)   : '',
    remainingSessions: prog.remainingSessions != null ? String(prog.remainingSessions) : '',
    photos: {
      beforeFrontUrl: prog.beforeFrontUrl ?? '',
      beforeSideUrl:  prog.beforeSideUrl  ?? '',
      beforeBackUrl:  prog.beforeBackUrl  ?? '',
      afterFrontUrl:  prog.afterFrontUrl  ?? '',
      afterSideUrl:   prog.afterSideUrl   ?? '',
      afterBackUrl:   prog.afterBackUrl   ?? '',
    },
    inch: {
      inchLowerBefore:   prog.inchLowerBefore   != null ? String(prog.inchLowerBefore)   : '',
      inchLowerAfter:    prog.inchLowerAfter     != null ? String(prog.inchLowerAfter)    : '',
      inchArmBefore:     prog.inchArmBefore      != null ? String(prog.inchArmBefore)     : '',
      inchArmAfter:      prog.inchArmAfter       != null ? String(prog.inchArmAfter)      : '',
      inchAbdomenBefore: prog.inchAbdomenBefore  != null ? String(prog.inchAbdomenBefore) : '',
      inchAbdomenAfter:  prog.inchAbdomenAfter   != null ? String(prog.inchAbdomenAfter)  : '',
      inchHipBefore:     prog.inchHipBefore      != null ? String(prog.inchHipBefore)     : '',
      inchHipAfter:      prog.inchHipAfter       != null ? String(prog.inchHipAfter)      : '',
    },
  };
}

export default function EditReportPage() {
  const { id, reportId } = useParams<{ id: string; reportId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [nutrition, setNutrition] = useState<NutritionResult | null>(null);
  const [targetWeightLoss, setTargetWeightLoss] = useState('');

  // 폼 상태
  const [reportMonth,  setReportMonth]  = useState('');
  const [weight,       setWeight]       = useState('');
  const [height,       setHeight]       = useState('');
  const [bodyFat,      setBodyFat]      = useState('');
  const [muscleMass,   setMuscleMass]   = useState('');
  const [personality,  setPersonality]  = useState('');
  const [monthlyNote,  setMonthlyNote]  = useState('');
  const [aiFeedback,      setAiFeedback]      = useState('');
  const [aiDirection,     setAiDirection]     = useState('');
  const [monthlyMission,  setMonthlyMission]  = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const [programs, setPrograms] = useState<Record<ProgramType, ProgramState>>({
    pilatesPt:   initProgramState(),
    bodyManage:  initProgramState(),
    circulation: initProgramState(),
    headSpa:     initProgramState(),
  });

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // 기존 리포트 로드
  useEffect(() => {
    getCustomer(id).then(c => setCustomer(c)).catch(console.error);
    getReport(reportId).then(r => {
      if (!r) { router.push(`/customers/${id}`); return; }

      setReportMonth(r.reportMonth);
      setWeight(r.weight       != null ? String(r.weight)      : '');
      setHeight(r.height       != null ? String(r.height)      : '');
      setBodyFat(r.bodyFat     != null ? String(r.bodyFat)     : '');
      setMuscleMass(r.muscleMass != null ? String(r.muscleMass) : '');
      setPersonality(r.personality  ?? '');
      setMonthlyNote(r.monthlyNote  ?? '');
      setAiFeedback(r.aiFeedback       ?? '');
      setAiDirection(r.aiDirection     ?? '');
      setMonthlyMission(r.monthlyMission ?? '');

      // 기존 프로그램 데이터 복원
      const next = { ...programs };
      for (const prog of r.programs ?? []) {
        next[prog.programType] = fromReportProgram(prog);
      }
      setPrograms(next);
    }).catch(() => router.push(`/customers/${id}`))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  // 헬퍼
  const updateProgram = (type: ProgramType, patch: Partial<ProgramState>) =>
    setPrograms(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const toggleProgram = (type: ProgramType) =>
    updateProgram(type, { selected: !programs[type].selected });

  const setPhoto = (type: ProgramType, key: string, url: string) =>
    setPrograms(prev => ({
      ...prev,
      [type]: { ...prev[type], photos: { ...prev[type].photos, [key]: url } },
    }));

  const setInch = (type: ProgramType, key: string, val: string) =>
    setPrograms(prev => ({
      ...prev,
      [type]: { ...prev[type], inch: { ...prev[type].inch, [key]: val } },
    }));

  // AI 피드백 자동 생성
  const handleGenerateAi = async () => {
    if (!customer) return alert('고객 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
    if (!weight) return alert('체중 정보가 필요합니다. 측정 데이터를 먼저 입력해주세요.');
    setAiGenerating(true);
    try {
      const selectedTypes = PROGRAM_TYPES.filter(t => programs[t].selected);
      const reportPrograms = selectedTypes.map(type => {
        const p = programs[type];
        return {
          programType:  type,
          programLabel: PROGRAM_LABELS[type],
          currentSession:    p.currentSession    ? parseInt(p.currentSession)    : undefined,
          remainingSessions: p.remainingSessions ? parseInt(p.remainingSessions) : undefined,
          beforeFrontUrl: p.photos['beforeFrontUrl'] || undefined,
          beforeSideUrl:  p.photos['beforeSideUrl']  || undefined,
          beforeBackUrl:  p.photos['beforeBackUrl']  || undefined,
          afterFrontUrl:  p.photos['afterFrontUrl']  || undefined,
          afterSideUrl:   p.photos['afterSideUrl']   || undefined,
          afterBackUrl:   p.photos['afterBackUrl']   || undefined,
        };
      });
      const reportObj = {
        reportMonth,
        weight:     weight     ? parseFloat(weight)     : undefined,
        bodyFat:    bodyFat    ? parseFloat(bodyFat)    : undefined,
        muscleMass: muscleMass ? parseFloat(muscleMass) : undefined,
        programs:   reportPrograms,
        personality,
        monthlyNote,
      };
      const res = await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer, report: reportObj, allReports: [], mode: 'monthly' }),
      });
      if (!res.ok) throw new Error(`API 오류: ${res.status}`);
      const data = await res.json();
      if (data.feedback)  setAiFeedback(data.feedback);
      if (data.direction) setAiDirection(data.direction);
    } catch (err) {
      alert('AI 생성 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAiGenerating(false);
    }
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
      const res  = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPhoto(type, photoKey, data.url);
    } catch (err) {
      alert('업로드 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingKey(null);
    }
  };

  // 저장 (재시도 포함 안정화)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedTypes = PROGRAM_TYPES.filter(t => programs[t].selected);
    if (!weight) return alert('체중은 필수입니다.');
    if (selectedTypes.length === 0) return alert('프로그램을 최소 1개 선택해주세요.');
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const reportPrograms: ReportProgram[] = selectedTypes.map(type => {
        const p = programs[type];
        const prog: ReportProgram = {
          programType:  type,
          programLabel: PROGRAM_LABELS[type],
          currentSession:    p.currentSession    ? parseInt(p.currentSession)    : undefined,
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

      const patch: Partial<MonthlyReport> = {
        reportMonth,
        weight:      parseFloat(weight),
        height:      height     ? parseFloat(height)     : undefined,
        bodyFat:     bodyFat    ? parseFloat(bodyFat)    : undefined,
        muscleMass:  muscleMass ? parseFloat(muscleMass) : undefined,
        programs:    reportPrograms,
        personality,
        monthlyNote,
        aiFeedback:     aiFeedback     || undefined,
        aiDirection:    aiDirection    || undefined,
        monthlyMission: monthlyMission || undefined,
        // ★ 영양 계산 결과 저장
        nutrition: nutrition ? {
          bmr: nutrition.bmr,
          tdee: nutrition.tdee,
          targetKcal: nutrition.targetKcal,
          carb: nutrition.carb,
          protein: nutrition.protein,
          fat: nutrition.fat,
          targetWeightLoss: nutrition.targetWeightLoss,
          weeklyDeficit: nutrition.weeklyDeficit,
          weeksToGoal: nutrition.weeksToGoal,
          mealPlan: nutrition.mealPlan,
        } : undefined,
      };

      // 최대 3회 재시도
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await updateReport(reportId, patch);
          setSaveSuccess(true);
          setTimeout(() => router.push(`/customers/${id}`), 800);
          return;
        } catch (err) {
          lastErr = err;
          if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
      setSaveError(`저장 실패 (3회 시도): ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
      setSaving(false);
    } catch (err) {
      setSaveError(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const selectedTypes = PROGRAM_TYPES.filter(t => programs[t].selected);

  // BMI
  let bmiInfo = '';
  if (height && weight) {
    const bmi = parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2);
    const cat   = bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만';
    const color = bmi < 18.5 ? 'text-blue-500' : bmi < 23 ? 'text-green-500' : bmi < 25 ? 'text-yellow-500' : 'text-red-500';
    bmiInfo = `BMI ${bmi.toFixed(1)} · <span class="${color} font-semibold">${cat}</span>`;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">← 뒤로</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">리포트 수정</h1>
          <p className="text-gray-500 text-sm">{reportMonth} 월별 리포트</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ① 측정 데이터 */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">📊 측정 데이터</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="리포트 월 *">
              <input type="month" value={reportMonth}
                onChange={e => setReportMonth(e.target.value)}
                className="input-field" required />
            </Field>
            <Field label="체중 (kg) *">
              <input type="number" step="0.1" value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="예: 58.5" className="input-field" required />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="키 (cm)">
              <input type="number" step="0.1" value={height}
                onChange={e => setHeight(e.target.value)}
                placeholder="예: 163" className="input-field" />
            </Field>
            <Field label="체지방률 (%)">
              <input type="number" step="0.1" value={bodyFat}
                onChange={e => setBodyFat(e.target.value)}
                placeholder="예: 24.5" className="input-field" />
            </Field>
            <Field label="근육량 (kg)">
              <input type="number" step="0.1" value={muscleMass}
                onChange={e => setMuscleMass(e.target.value)}
                placeholder="예: 28.3" className="input-field" />
            </Field>
          </div>
          {bmiInfo && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2"
              dangerouslySetInnerHTML={{ __html: `📏 ${bmiInfo}` }} />
          )}

          {/* 목표 감량 + 영양 계산 */}
          {weight && height && customer && (
            <div className="space-y-3 border border-emerald-200 rounded-xl p-4 bg-emerald-50/50">
              <p className="text-xs font-semibold text-emerald-700">🥗 맞춤 영양 플랜 계산</p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">목표 감량 (선택)</label>
                  <div className="relative">
                    <input type="number" step="0.5" min="0.5" max="30" value={targetWeightLoss}
                      onChange={e => setTargetWeightLoss(e.target.value)}
                      placeholder="예: 5" className="input-field pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">입력 시 더 정밀한 칼로리 계산</p>
                </div>
                <button type="button"
                  onClick={() => setNutrition(calcNutrition(
                    parseFloat(weight), parseFloat(height), customer.gender, customer.goal,
                    targetWeightLoss ? parseFloat(targetWeightLoss) : undefined
                  ))}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap">
                  자동 계산
                </button>
              </div>
            </div>
          )}

          {/* 영양 결과 */}
          {nutrition && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-emerald-800">🥗 맞춤 영양 플랜</p>
                <button type="button" onClick={() => setNutrition(null)} className="text-xs text-gray-400 hover:text-gray-600">닫기 ✕</button>
              </div>
              {nutrition.targetWeightLoss && (
                <div className="bg-emerald-600 text-white rounded-xl px-4 py-3 space-y-1">
                  <p className="text-sm font-bold">🎯 목표 감량: {nutrition.targetWeightLoss}kg</p>
                  <div className="flex gap-4 text-xs text-emerald-200">
                    <span>일일 칼로리 부족: {Math.round((nutrition.tdee - nutrition.targetKcal))}kcal</span>
                    <span>예상 기간: 약 {nutrition.weeksToGoal}주</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white rounded-xl p-3 border border-emerald-100">
                  <p className="text-xs text-gray-400 mb-1">기초대사량</p>
                  <p className="text-lg font-bold text-emerald-700">{nutrition.bmr}</p>
                  <p className="text-xs text-gray-400">kcal</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-emerald-100">
                  <p className="text-xs text-gray-400 mb-1">활동대사량</p>
                  <p className="text-lg font-bold text-emerald-700">{nutrition.tdee}</p>
                  <p className="text-xs text-gray-400">kcal</p>
                </div>
                <div className="bg-emerald-600 rounded-xl p-3">
                  <p className="text-xs text-emerald-200 mb-1">목표 칼로리</p>
                  <p className="text-lg font-bold text-white">{nutrition.targetKcal}</p>
                  <p className="text-xs text-emerald-200">kcal</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-2">하루 권장 섭취량</p>
                <div className="grid grid-cols-3 gap-3">
                  <MacroCard label="탄수화물" value={nutrition.carb}    unit="g" color="bg-amber-400" />
                  <MacroCard label="단백질"   value={nutrition.protein} unit="g" color="bg-rose-400" />
                  <MacroCard label="지방"     value={nutrition.fat}     unit="g" color="bg-sky-400" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-2">추천 식단 예시</p>
                <div className="space-y-1.5">
                  {nutrition.mealPlan.map((meal, i) => (
                    <p key={i} className="text-xs text-gray-700 bg-white rounded-lg px-3 py-2 border border-emerald-100">{meal}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ② 프로그램 선택 */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-700 border-b pb-2">🏋️ 진행 프로그램</h2>
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
        </div>

        {/* ③ 선택된 프로그램 섹션 */}
        {selectedTypes.map(type => {
          const p     = programs[type];
          const slots = getPhotoSlots(type);
          const total = p.currentSession && p.remainingSessions
            ? parseInt(p.currentSession) + parseInt(p.remainingSessions) : 0;
          const progress = total > 0 ? Math.min(100, (parseInt(p.currentSession!) / total) * 100) : 0;
          const isLow = p.remainingSessions && parseInt(p.remainingSessions) <= 5;

          return (
            <div key={type} className="card space-y-4">
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
                <div className={`rounded-xl p-3 ${isLow ? 'bg-rose-50 border border-rose-200' : 'bg-purple-50'}`}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>진행률</span>
                    <span className={`font-semibold ${isLow ? 'text-rose-600' : 'text-purple-600'}`}>
                      {p.currentSession}회 완료 · {p.remainingSessions}회 남음
                      {isLow && <span className="ml-2 bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">재등록 필요</span>}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${isLow ? 'bg-rose-400' : 'bava-gradient'}`}
                      style={{ width: `${progress}%` }} />
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
                    <PhotoBox key={slot.key} label={slot.label}
                      url={p.photos[slot.key] || ''} uploading={uploadingKey === `${type}_${slot.key}`}
                      theme="before"
                      onFile={f => handlePhotoUpload(f, type, slot.key)}
                      onRemove={() => setPhoto(type, slot.key, '')}
                      inputRef={el => { fileRefs.current[`${type}_${slot.key}`] = el; }} />
                  ))}
                  {type !== 'pilatesPt' && slots.after.map(slot => (
                    <PhotoBox key={slot.key} label={slot.label}
                      url={p.photos[slot.key] || ''} uploading={uploadingKey === `${type}_${slot.key}`}
                      theme="after"
                      onFile={f => handlePhotoUpload(f, type, slot.key)}
                      onRemove={() => setPhoto(type, slot.key, '')}
                      inputRef={el => { fileRefs.current[`${type}_${slot.key}`] = el; }} />
                  ))}
                </div>
              </div>

              {/* After 사진 (필라테스PT만 별도 행) */}
              {type === 'pilatesPt' && (
                <div>
                  <p className="text-xs font-semibold text-purple-600 mb-2">✨ After 사진 (앞·측·뒤 3장)</p>
                  <div className="grid grid-cols-3 gap-3">
                    {slots.after.map(slot => (
                      <PhotoBox key={slot.key} label={slot.label}
                        url={p.photos[slot.key] || ''} uploading={uploadingKey === `${type}_${slot.key}`}
                        theme="after"
                        onFile={f => handlePhotoUpload(f, type, slot.key)}
                        onRemove={() => setPhoto(type, slot.key, '')}
                        inputRef={el => { fileRefs.current[`${type}_${slot.key}`] = el; }} />
                    ))}
                  </div>
                </div>
              )}

              {/* 인치 변화 (바디관리 전용) */}
              {type === 'bodyManage' && (
                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-3">📐 인치 변화 (cm)</p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-xs text-center text-gray-400 font-medium">
                      <div className="text-left">부위</div>
                      <div className="bg-orange-50 rounded py-1">Before</div>
                      <div className="bg-purple-50 rounded py-1">After</div>
                      <div>변화</div>
                    </div>
                    {INCH_ITEMS.map(item => {
                      const bv   = parseFloat(p.inch[item.beforeKey] || '');
                      const av   = parseFloat(p.inch[item.afterKey]  || '');
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
                          <div className={`text-center text-sm font-bold ${
                            diff === null ? 'text-gray-300' : diff < 0 ? 'text-green-500' : diff > 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
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
              placeholder="예: 이번 달 의지가 강함..." className="input-field" />
          </Field>
          <Field label="이번 달 특이사항 및 메모">
            <textarea value={monthlyNote} onChange={e => setMonthlyNote(e.target.value)}
              rows={4} placeholder="운동 수행도, 식단 준수 여부..." className="input-field resize-none" />
          </Field>
        </div>

        {/* ⑤ AI 피드백 */}
        <div className="card space-y-4">
          {/* 헤더 + 자동생성 버튼 */}
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="font-bold text-gray-700">🤖 AI 피드백 &amp; 방향성</h2>
            <button
              type="button"
              onClick={handleGenerateAi}
              disabled={aiGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-60"
              style={{ background: aiGenerating ? '#9CA3AF' : 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
            >
              {aiGenerating ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  생성 중...
                </>
              ) : (
                <>✨ AI 자동 생성</>
              )}
            </button>
          </div>

          {/* 생성 중 안내 */}
          {aiGenerating && (
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-purple-700">AI가 피드백을 생성하고 있어요</p>
                <p className="text-xs text-purple-500 mt-0.5">고객 데이터와 매니저 메모를 분석 중입니다...</p>
              </div>
            </div>
          )}

          <Field label="이번 달 코멘트">
            <textarea value={aiFeedback} onChange={e => setAiFeedback(e.target.value)}
              rows={5} placeholder={aiGenerating ? 'AI가 생성 중입니다...' : '✨ AI 자동 생성 버튼을 누르거나 직접 입력하세요'}
              className="input-field resize-none" />
          </Field>
          <Field label="다음 달 방향성">
            <textarea value={aiDirection} onChange={e => setAiDirection(e.target.value)}
              rows={5} placeholder={aiGenerating ? 'AI가 생성 중입니다...' : '✨ AI 자동 생성 버튼을 누르거나 직접 입력하세요'}
              className="input-field resize-none" />
          </Field>

          {/* 생성 완료 안내 */}
          {!aiGenerating && (aiFeedback || aiDirection) && (
            <p className="text-xs text-purple-500 bg-purple-50 rounded-lg px-3 py-2">
              💡 AI가 생성한 내용을 직접 수정할 수 있습니다. 수정 후 수정 완료를 눌러 저장하세요.
            </p>
          )}
        </div>

        {/* ⑥ 이번 달 미션 하나 */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            <span className="text-xl">🎯</span>
            <h2 className="font-bold text-gray-700">이번 달 미션 하나</h2>
            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">회원 리포트에 표시</span>
          </div>
          <p className="text-xs text-gray-400">딱 하나의 실천 가능한 미션. 짧고 구체적일수록 효과적입니다.</p>
          <div className="flex flex-wrap gap-2">
            {['하루 단백질 120g 채우기', '취침 3시간 전 야식 금지', '물 하루 2L 마시기', '엘리베이터 대신 계단 이용'].map(ex => (
              <button key={ex} type="button" onClick={() => setMonthlyMission(ex)}
                className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full hover:bg-amber-100 transition-colors">
                {ex}
              </button>
            ))}
          </div>
          <textarea value={monthlyMission} onChange={e => setMonthlyMission(e.target.value)}
            rows={2}
            placeholder="예: 하루 단백질 120g 채우기 — 이것만 지켜도 다음 달 근육량 +0.3kg 예측!"
            className="input-field resize-none" />
        </div>

        {/* 저장 에러 */}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-red-700 text-sm">저장 실패</p>
              <p className="text-xs text-red-500 mt-1">{saveError}</p>
            </div>
          </div>
        )}

        {/* 저장 성공 */}
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <p className="font-semibold text-green-700">저장 완료! 페이지를 이동합니다...</p>
          </div>
        )}

        {/* 저장 버튼 */}
        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button type="submit" disabled={saving || saveSuccess || selectedTypes.length === 0}
            className="flex-1 py-3 bava-gradient text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50">
            {saving && !saveSuccess ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                저장 중...
              </span>
            ) : saveSuccess ? '✅ 저장 완료!' : '✅ 수정 완료'}
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

function MacroCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-emerald-100 text-center">
      <div className={`w-3 h-3 rounded-full ${color} mx-auto mb-1`} />
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-400">{unit}</p>
    </div>
  );
}

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
