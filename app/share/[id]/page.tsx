'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getReport, getCustomerReports } from '@/lib/firestoreClient';
import { MonthlyReport, ReportProgram, PROGRAM_EMOJIS } from '@/types';

export default function ShareReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport]       = useState<MonthlyReport | null>(null);
  const [allReports, setAllReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    getReport(id)
      .then(async (r) => {
        if (!r) return;
        setReport(r);
        // 히스토리용 전체 리포트 로드
        const all = await getCustomerReports(r.customerId);
        setAllReports(all);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!report) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-4xl mb-3">😕</p>
        <p className="text-gray-500">리포트를 찾을 수 없습니다.</p>
      </div>
    </div>
  );

  // BMI 계산
  let bmiText = '';
  let bmiKorean = '';
  if (report.height && report.weight) {
    const bmi = report.weight / Math.pow(report.height / 100, 2);
    const cat = bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만';
    bmiText = `BMI ${bmi.toFixed(1)}`;
    bmiKorean = `${cat} (한국인 기준: 정상 18.5~22.9)`;
  }

  const programs = report.programs ?? [];

  // 히스토리 데이터 (최대 6개월, 날짜순)
  const historyData = allReports
    .sort((a, b) => a.reportMonth.localeCompare(b.reportMonth))
    .slice(-6);

  return (
    <div className="min-h-screen bg-gray-50 pb-16" style={{ WebkitTextSizeAdjust: '100%' }}>

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)' }}
        className="text-white px-4 pt-10 pb-10">
        <p className="text-xs opacity-70 font-semibold tracking-widest uppercase mb-2">
          BAVA BODY LOUNGE
        </p>
        <h1 className="text-xl font-bold leading-tight">
          {report.customerName}님의 월별 리포트
        </h1>
        <p className="text-purple-200 mt-1 text-sm">
          {report.reportMonth} · 담당 매니저 작성
        </p>

        {/* 프로그램 태그 */}
        {programs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {programs.map(prog => (
              <span key={prog.programType}
                className="inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-xs font-medium">
                {PROGRAM_EMOJIS[prog.programType]} {prog.programLabel}
                {prog.currentSession != null && (
                  <span className="opacity-80">· {prog.currentSession}회차</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 space-y-4">

        {/* ★ 이번 달 미션 카드 */}
        {report.monthlyMission && (
          <MissionCard mission={report.monthlyMission} name={report.customerName} />
        )}

        {/* 측정 데이터 */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
            <span>📊</span> 이번 달 측정 결과
          </h2>

          <div className="grid grid-cols-3 gap-3">
            <StatBox label="체중" value={`${report.weight}`} unit="kg" color="purple" />
            {report.bodyFat   != null && <StatBox label="체지방률" value={`${report.bodyFat}`}   unit="%" color="orange" />}
            {report.muscleMass != null && <StatBox label="근육량"  value={`${report.muscleMass}`} unit="kg" color="green" />}
          </div>

          {bmiText && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700">
              <span className="font-semibold">{bmiText}</span>
              <span className="text-xs text-gray-400 ml-2">{bmiKorean}</span>
            </div>
          )}
        </div>

        {/* ★ 히스토리 그래프 */}
        {historyData.length >= 2 && (
          <HistoryGraph reports={historyData} currentReportId={id} />
        )}

        {/* 프로그램별 섹션 */}
        {programs.map(prog => (
          <ShareProgramSection key={prog.programType} prog={prog} />
        ))}

        {/* 매니저 코멘트 */}
        {report.aiFeedback && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
              <span>💌</span> 매니저 코멘트
            </h2>
            <p className="text-gray-700 leading-7 text-sm whitespace-pre-wrap bg-purple-50 rounded-xl p-4">
              {report.aiFeedback}
            </p>
          </div>
        )}

        {/* 맞춤 영양 플랜 (탄단지) */}
        {report.nutrition && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
              <span>🥗</span> 맞춤 영양 플랜
            </h2>

            {report.nutrition.targetWeightLoss && (
              <div style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
                className="rounded-xl px-4 py-3 text-white">
                <p className="text-sm font-bold">🎯 목표 감량: {report.nutrition.targetWeightLoss}kg</p>
                <div className="flex gap-4 mt-1 text-xs text-emerald-100">
                  <span>일일 칼로리 부족: {Math.round(report.nutrition.tdee - report.nutrition.targetKcal)}kcal</span>
                  {report.nutrition.weeksToGoal && <span>예상 기간: 약 {report.nutrition.weeksToGoal}주</span>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">기초대사량</p>
                <p className="text-xl font-bold text-gray-700">{report.nutrition.bmr}</p>
                <p className="text-xs text-gray-400">kcal</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">활동대사량</p>
                <p className="text-xl font-bold text-gray-700">{report.nutrition.tdee}</p>
                <p className="text-xs text-gray-400">kcal</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
                <p className="text-xs text-emerald-100 mb-1">목표 칼로리</p>
                <p className="text-xl font-bold text-white">{report.nutrition.targetKcal}</p>
                <p className="text-xs text-emerald-200">kcal</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">하루 권장 섭취량</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="w-3 h-3 rounded-full bg-amber-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 mb-1">탄수화물</p>
                  <p className="text-xl font-bold text-gray-800">{report.nutrition.carb}</p>
                  <p className="text-xs text-gray-400">g</p>
                </div>
                <div className="bg-rose-50 rounded-xl p-3 text-center">
                  <div className="w-3 h-3 rounded-full bg-rose-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 mb-1">단백질</p>
                  <p className="text-xl font-bold text-gray-800">{report.nutrition.protein}</p>
                  <p className="text-xs text-gray-400">g</p>
                </div>
                <div className="bg-sky-50 rounded-xl p-3 text-center">
                  <div className="w-3 h-3 rounded-full bg-sky-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 mb-1">지방</p>
                  <p className="text-xl font-bold text-gray-800">{report.nutrition.fat}</p>
                  <p className="text-xs text-gray-400">g</p>
                </div>
              </div>
            </div>

            {report.nutrition.mealPlan && report.nutrition.mealPlan.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">추천 식단 예시</p>
                <div className="space-y-2">
                  {report.nutrition.mealPlan.map((meal, i) => (
                    <p key={i} className="text-xs text-gray-700 bg-emerald-50 rounded-xl px-3 py-2.5">
                      {meal}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 다음 달 방향성 */}
        {report.aiDirection && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
              <span>🚀</span> 다음 달 방향성
            </h2>
            <p className="text-gray-700 leading-7 text-sm whitespace-pre-wrap bg-green-50 rounded-xl p-4">
              {report.aiDirection}
            </p>
          </div>
        )}

        {/* 하단 브랜드 */}
        <div className="text-center pt-4 pb-6">
          <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)' }}
            className="inline-block text-white text-xs px-4 py-1.5 rounded-full font-medium mb-2">
            BAVA BODY LOUNGE
          </div>
          <p className="text-xs text-gray-400">Professional Body Care Studio</p>
          <p className="text-xs text-gray-300 mt-1">{report.reportMonth} 월별 관리 리포트</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── 이번 달 미션 카드 ──────────────── */
function MissionCard({ mission, name }: { mission: string; name: string }) {
  return (
    <div className="rounded-2xl shadow-sm overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)' }}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="text-amber-900 text-xs font-bold tracking-widest uppercase">이번 달 미션</p>
            <p className="text-amber-800 text-xs">{name}님만을 위한 단 하나의 목표</p>
          </div>
        </div>
        <div className="bg-white/40 rounded-xl px-4 py-3">
          <p className="text-amber-900 font-bold text-base leading-relaxed">{mission}</p>
        </div>
        <p className="text-amber-800 text-xs mt-3 text-center">
          ✨ 이것 하나만 지켜도 다음 달이 달라집니다
        </p>
      </div>
    </div>
  );
}

/* ──────────────── 히스토리 그래프 ──────────────── */
function HistoryGraph({ reports, currentReportId }: { reports: MonthlyReport[]; currentReportId: string }) {
  const weights  = reports.map(r => r.weight);
  const bodyFats = reports.map(r => r.bodyFat);
  const hasBodyFat = bodyFats.some(v => v != null);

  const minW = Math.min(...weights) - 1;
  const maxW = Math.max(...weights) + 1;
  const rangeW = maxW - minW || 1;

  // SVG 좌표 계산
  const W = 300, H = 100, PAD = 20;
  const xStep = (W - PAD * 2) / Math.max(reports.length - 1, 1);

  const toX = (i: number) => PAD + i * xStep;
  const toYW = (v: number) => H - PAD - ((v - minW) / rangeW) * (H - PAD * 2);

  // 체지방 y축
  const fatVals = bodyFats.filter((v): v is number => v != null);
  const minF = fatVals.length ? Math.min(...fatVals) - 1 : 0;
  const maxF = fatVals.length ? Math.max(...fatVals) + 1 : 100;
  const rangeF = maxF - minF || 1;
  const toYF = (v: number) => H - PAD - ((v - minF) / rangeF) * (H - PAD * 2);

  // 체중 꺾은선 path
  const weightPath = reports.map((r, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toYW(r.weight).toFixed(1)}`
  ).join(' ');

  // 체지방 꺾은선 path
  const fatPoints = reports.map((r, i) => ({ x: toX(i), y: r.bodyFat != null ? toYF(r.bodyFat) : null }));
  const fatPath = fatPoints.reduce((acc, p, i) => {
    if (p.y == null) return acc;
    const prev = fatPoints.slice(0, i).reverse().find(q => q.y != null);
    return acc + `${!prev ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
  }, '');

  // 첫 → 마지막 체중 변화
  const first = reports[0].weight;
  const last  = reports[reports.length - 1].weight;
  const diff  = last - first;
  const totalMonths = reports.length;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
          <span>📈</span> 나의 변화 히스토리
        </h2>
        <span className="text-xs text-gray-400">{totalMonths}개월 기록</span>
      </div>

      {/* 총 변화 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-3 text-center ${diff <= 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
          <p className="text-xs text-gray-500 mb-1">시작 대비 체중 변화</p>
          <p className={`text-xl font-bold ${diff <= 0 ? 'text-green-600' : 'text-orange-500'}`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}kg
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{first}kg → {last}kg</p>
        </div>
        {hasBodyFat && (() => {
          const firstFat = reports.find(r => r.bodyFat != null)?.bodyFat;
          const lastFat  = [...reports].reverse().find(r => r.bodyFat != null)?.bodyFat;
          if (firstFat == null || lastFat == null) return null;
          const fatDiff = lastFat - firstFat;
          return (
            <div className={`rounded-xl p-3 text-center ${fatDiff <= 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
              <p className="text-xs text-gray-500 mb-1">시작 대비 체지방 변화</p>
              <p className={`text-xl font-bold ${fatDiff <= 0 ? 'text-green-600' : 'text-orange-500'}`}>
                {fatDiff > 0 ? '+' : ''}{fatDiff.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{firstFat}% → {lastFat}%</p>
            </div>
          );
        })()}
      </div>

      {/* SVG 그래프 */}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
          {/* 격자선 */}
          {[0.25, 0.5, 0.75].map(t => (
            <line key={t}
              x1={PAD} y1={(H - PAD) - t * (H - PAD * 2)}
              x2={W - PAD} y2={(H - PAD) - t * (H - PAD * 2)}
              stroke="#F3F4F6" strokeWidth="1" />
          ))}

          {/* 체지방 꺾은선 (주황) */}
          {hasBodyFat && fatPath && (
            <path d={fatPath} fill="none" stroke="#F97316" strokeWidth="1.5" strokeDasharray="4 2" strokeLinecap="round" />
          )}

          {/* 체중 꺾은선 (보라) */}
          <path d={weightPath} fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* 체중 점 */}
          {reports.map((r, i) => {
            const isCurrent = r.id === currentReportId;
            return (
              <g key={i}>
                <circle cx={toX(i)} cy={toYW(r.weight)} r={isCurrent ? 5 : 3}
                  fill={isCurrent ? '#7C3AED' : '#fff'}
                  stroke="#7C3AED" strokeWidth="2" />
                {isCurrent && (
                  <circle cx={toX(i)} cy={toYW(r.weight)} r={9}
                    fill="none" stroke="#7C3AED" strokeWidth="1" opacity="0.3" />
                )}
              </g>
            );
          })}

          {/* 체지방 점 */}
          {hasBodyFat && reports.map((r, i) => {
            if (r.bodyFat == null) return null;
            return (
              <circle key={i} cx={toX(i)} cy={toYF(r.bodyFat)} r={2.5}
                fill="#F97316" stroke="#fff" strokeWidth="1" />
            );
          })}
        </svg>

        {/* X축 레이블 (월) */}
        <div className="flex justify-between px-5 -mt-1">
          {reports.map(r => (
            <span key={r.reportMonth} className="text-xs text-gray-400">
              {r.reportMonth.slice(5)}월
            </span>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 justify-center text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-purple-600 rounded" />
          <span>체중 (kg)</span>
        </div>
        {hasBodyFat && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-orange-400 rounded" style={{ borderTop: '1.5px dashed #F97316' }} />
            <span>체지방률 (%)</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-600 border-2 border-purple-600" />
          <span>이번 달</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── 프로그램 섹션 (BEST 배지 포함) ──────────────── */
function ShareProgramSection({ prog }: { prog: ReportProgram }) {
  const isPilates    = prog.programType === 'pilatesPt';
  const isBodyManage = prog.programType === 'bodyManage';

  const beforePhotos = [
    { url: prog.beforeFrontUrl, label: isPilates ? '앞면' : 'Before' },
    ...(isPilates ? [
      { url: prog.beforeSideUrl, label: '측면' },
      { url: prog.beforeBackUrl, label: '뒷면' },
    ] : []),
  ].filter((p): p is { url: string; label: string } => !!p.url);

  const afterPhotos = [
    { url: prog.afterFrontUrl, label: isPilates ? '앞면' : 'After' },
    ...(isPilates ? [
      { url: prog.afterSideUrl, label: '측면' },
      { url: prog.afterBackUrl, label: '뒷면' },
    ] : []),
  ].filter((p): p is { url: string; label: string } => !!p.url);

  // 인치 변화 (BEST 계산 포함)
  const inchRows = isBodyManage ? [
    { label: '하체 둘레', before: prog.inchLowerBefore,    after: prog.inchLowerAfter },
    { label: '팔 둘레',   before: prog.inchArmBefore,      after: prog.inchArmAfter },
    { label: '복부 둘레', before: prog.inchAbdomenBefore,  after: prog.inchAbdomenAfter },
    { label: '엉덩이',    before: prog.inchHipBefore,      after: prog.inchHipAfter },
  ].filter(r => r.before != null || r.after != null) : [];

  // ★ BEST 배지: diff 가장 작은(많이 줄어든) 항목
  const diffs = inchRows.map(r =>
    r.before != null && r.after != null ? r.after - r.before : null
  );
  const minDiff = diffs.reduce<number | null>((m, d) =>
    d != null && (m == null || d < m) ? d : m, null
  );
  const bestIdx = minDiff != null && minDiff < 0
    ? diffs.findIndex(d => d === minDiff) : -1;

  const total    = (prog.currentSession ?? 0) + (prog.remainingSessions ?? 0);
  const progress = total > 0 ? Math.min(100, ((prog.currentSession ?? 0) / total) * 100) : 0;
  const isLow    = (prog.remainingSessions ?? 99) <= 5;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base">
          {PROGRAM_EMOJIS[prog.programType]} {prog.programLabel}
        </h2>
        {prog.currentSession != null && prog.remainingSessions != null && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
            isLow ? 'bg-rose-100 text-rose-600' : 'bg-orange-50 text-orange-600'
          }`}>
            {prog.currentSession}회 완료 · 잔여 {prog.remainingSessions}회
          </span>
        )}
      </div>

      {/* 진행 바 */}
      {total > 0 && (
        <div className={`rounded-xl px-4 py-3 ${isLow ? 'bg-rose-50' : 'bg-blue-50'}`}>
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>{prog.currentSession}회차 완료</span>
            <span className={`font-semibold ${isLow ? 'text-rose-600' : 'text-blue-600'}`}>
              잔여 {prog.remainingSessions}회차
              {isLow && <span className="ml-1.5 bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-xs">재등록 필요</span>}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full transition-all ${isLow ? 'bg-rose-400' : 'bg-purple-500'}`}
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Before 사진 */}
      {beforePhotos.length > 0 && (
        <div>
          <p className="text-sm font-bold text-orange-500 mb-2">📸 Before</p>
          <div className={`grid gap-2 ${
            beforePhotos.length >= 3 ? 'grid-cols-3'
            : beforePhotos.length === 2 ? 'grid-cols-2'
            : 'grid-cols-1'
          }`}>
            {beforePhotos.map(p => <PhotoCard key={p.label} url={p.url} label={p.label} />)}
          </div>
        </div>
      )}

      {/* After 사진 */}
      {afterPhotos.length > 0 && (
        <div>
          <p className="text-sm font-bold text-purple-600 mb-2">✨ After</p>
          <div className={`grid gap-2 ${
            afterPhotos.length >= 3 ? 'grid-cols-3'
            : afterPhotos.length === 2 ? 'grid-cols-2'
            : 'grid-cols-1'
          }`}>
            {afterPhotos.map(p => <PhotoCard key={p.label} url={p.url} label={p.label} />)}
          </div>
        </div>
      )}

      {/* Before & After 나란히 */}
      {!isPilates && beforePhotos.length > 0 && afterPhotos.length > 0 && (
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">🔄 Before &amp; After 비교</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-center font-semibold text-orange-500">Before</p>
              <img src={beforePhotos[0].url} alt="비포"
                className="w-full rounded-xl object-cover" style={{ aspectRatio: '3/4' }} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-center font-semibold text-purple-600">After</p>
              <img src={afterPhotos[0].url} alt="애프터"
                className="w-full rounded-xl object-cover" style={{ aspectRatio: '3/4' }} />
            </div>
          </div>
        </div>
      )}

      {/* ★ 인치 변화 (BEST 배지 포함) */}
      {inchRows.length > 0 && (
        <div>
          <p className="text-sm font-bold text-teal-600 mb-2">📏 인치 변화 (cm)</p>
          <div className="space-y-2">
            {inchRows.map((r, idx) => {
              const diff = r.before != null && r.after != null ? r.after - r.before : null;
              const isBest = idx === bestIdx;
              return (
                <div key={r.label}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 transition-colors ${
                    isBest ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 font-medium">{r.label}</span>
                    {isBest && (
                      <span className="inline-flex items-center gap-1 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        🔥 BEST
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">{r.before ?? '-'}</span>
                    <span className="text-gray-300">→</span>
                    <span className="font-semibold text-gray-800">{r.after ?? '-'}</span>
                    {diff != null && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        diff < 0 ? 'bg-green-100 text-green-600'
                        : diff > 0 ? 'bg-orange-100 text-orange-500'
                        : 'bg-gray-100 text-gray-400'
                      }`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* BEST 항목 강조 메시지 */}
          {bestIdx >= 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                🏆 이번 달 <span className="font-bold">{inchRows[bestIdx].label}</span>에서
                <span className="font-bold text-amber-600"> {Math.abs(diffs[bestIdx]!).toFixed(1)}cm</span> 감량!
                가장 눈에 띄는 변화입니다.
              </p>
            </div>
          )}
        </div>
      )}

      {beforePhotos.length === 0 && afterPhotos.length === 0 && inchRows.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">이 프로그램의 기록이 없습니다.</p>
      )}
    </div>
  );
}

function StatBox({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string;
}) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-700',
    orange: 'bg-orange-50 text-orange-600',
    green:  'bg-green-50 text-green-700',
  };
  return (
    <div className={`${colors[color]} rounded-xl p-3 text-center`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-xs mt-1 opacity-70">{unit}</p>
    </div>
  );
}

function PhotoCard({ url, label }: { url: string; label: string }) {
  return (
    <div>
      <p className="text-xs text-center text-gray-400 mb-1 font-medium">{label}</p>
      <img src={url} alt={label}
        className="w-full rounded-xl object-cover"
        style={{ aspectRatio: '3/4' }}
        loading="lazy" />
    </div>
  );
}
