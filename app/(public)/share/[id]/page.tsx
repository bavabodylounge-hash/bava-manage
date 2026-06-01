'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getReport, getCustomer } from '@/lib/firestoreClient';
import { MonthlyReport, Customer, ReportProgram, PROGRAM_EMOJIS } from '@/types';

export default function ShareReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport]   = useState<MonthlyReport | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReport(id)
      .then(async (r) => {
        if (!r) return;
        setReport(r);
        const c = await getCustomer(r.customerId);
        setCustomer(c);
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

  return (
    <div className="min-h-screen bg-gray-50 pb-16" style={{ WebkitTextSizeAdjust: '100%' }}>
      {/* 매니저 헤더 강제 숨김 (route group layout 적용 안 된 경우 방어) */}
      <style>{`header.bava-gradient { display: none !important; }`}</style>

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

        {/* 측정 데이터 */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
            <span>📊</span> 이번 달 측정 결과
          </h2>

          {/* 체중은 항상 단독으로 크게 표시 */}
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

            {/* 목표 감량 배너 */}
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

            {/* 칼로리 3박스 */}
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

            {/* 탄단지 */}
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

            {/* 식단 추천 */}
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

/** 공유 페이지용 프로그램 섹션 */
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

  const inchRows = isBodyManage ? [
    { label: '하체 둘레', before: prog.inchLowerBefore,    after: prog.inchLowerAfter },
    { label: '팔 둘레',   before: prog.inchArmBefore,      after: prog.inchArmAfter },
    { label: '복부 둘레', before: prog.inchAbdomenBefore,  after: prog.inchAbdomenAfter },
    { label: '엉덩이',    before: prog.inchHipBefore,      after: prog.inchHipAfter },
  ].filter(r => r.before != null || r.after != null) : [];

  const total    = (prog.currentSession ?? 0) + (prog.remainingSessions ?? 0);
  const progress = total > 0 ? Math.min(100, ((prog.currentSession ?? 0) / total) * 100) : 0;
  const isLow    = (prog.remainingSessions ?? 99) <= 5;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">

      {/* 헤더 */}
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

      {/* Before & After 나란히 비교 (1장씩인 경우) */}
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

      {/* 인치 변화 */}
      {inchRows.length > 0 && (
        <div>
          <p className="text-sm font-bold text-teal-600 mb-2">📏 인치 변화 (cm)</p>
          <div className="space-y-2">
            {inchRows.map(r => {
              const diff = r.before != null && r.after != null ? r.after - r.before : null;
              return (
                <div key={r.label}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-600 font-medium">{r.label}</span>
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
        </div>
      )}

      {/* 사진·인치 모두 없는 경우 */}
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
