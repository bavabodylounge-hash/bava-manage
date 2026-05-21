'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getReport, getCustomer } from '@/lib/firestoreClient';
import { MonthlyReport, Customer, ReportProgram, PROGRAM_EMOJIS } from '@/types';

export default function ShareReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<MonthlyReport | null>(null);
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
  if (report.height && report.weight) {
    const bmi = report.weight / Math.pow(report.height / 100, 2);
    const cat = bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만';
    bmiText = `${bmi.toFixed(1)} (${cat})`;
  }

  const programs = report.programs ?? [];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* 헤더 */}
      <div className="bava-gradient text-white px-5 pt-10 pb-8">
        <p className="text-sm opacity-75 font-medium tracking-widest uppercase mb-1">BAVA BODY LOUNGE</p>
        <h1 className="text-2xl font-bold">{report.customerName}님의 월별 리포트</h1>
        <p className="text-purple-200 mt-1 text-sm">{report.reportMonth} · 담당 매니저 작성</p>
        {/* 프로그램 태그 (복수) */}
        {programs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {programs.map(prog => (
              <div key={prog.programType}
                className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-sm">
                {PROGRAM_EMOJIS[prog.programType]} {prog.programLabel}
                {prog.currentSession != null && (
                  <span className="opacity-80">· {prog.currentSession}회차 진행 중</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">

        {/* 이번 달 측정 데이터 */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <span className="text-purple-600">📊</span> 이번 달 측정 결과
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <StatBox label="체중" value={`${report.weight}`} unit="kg" color="purple" />
            {report.bodyFat && <StatBox label="체지방률" value={`${report.bodyFat}`} unit="%" color="orange" />}
            {report.muscleMass && <StatBox label="근육량" value={`${report.muscleMass}`} unit="kg" color="green" />}
          </div>
          {bmiText && (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-600">
              📏 BMI <span className="font-semibold text-gray-800">{bmiText}</span>
              <span className="text-xs text-gray-400 ml-1">(한국인 기준: 정상 18.5~22.9)</span>
            </div>
          )}
        </div>

        {/* 프로그램별 섹션 */}
        {programs.map(prog => (
          <ShareProgramSection key={prog.programType} prog={prog} />
        ))}

        {/* AI 코멘트 */}
        {report.aiFeedback && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <span>💌</span> 매니저 코멘트
            </h2>
            <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap bg-purple-50 rounded-xl p-4">
              {report.aiFeedback}
            </p>
          </div>
        )}

        {/* 다음 달 방향성 */}
        {report.aiDirection && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <span>🚀</span> 다음 달 방향성
            </h2>
            <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap bg-green-50 rounded-xl p-4">
              {report.aiDirection}
            </p>
          </div>
        )}

        {/* 하단 브랜드 */}
        <div className="text-center pt-4 pb-2">
          <p className="text-xs text-gray-400">BAVA BODY LOUNGE · Professional Body Care Studio</p>
          <p className="text-xs text-gray-300 mt-1">{report.reportMonth} 월별 관리 리포트</p>
        </div>
      </div>

      <style jsx global>{`
        body { background: #F9FAFB; }
        .bava-gradient { background: linear-gradient(135deg, #7C3AED 0%, #9333EA 100%); }
      `}</style>
    </div>
  );
}

/** 공유 페이지용 프로그램 섹션 */
function ShareProgramSection({ prog }: { prog: ReportProgram }) {
  const isPilates = prog.programType === 'pilatesPt';
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
    { label: '하체', before: prog.inchLowerBefore,    after: prog.inchLowerAfter },
    { label: '팔',  before: prog.inchArmBefore,       after: prog.inchArmAfter },
    { label: '복부', before: prog.inchAbdomenBefore,  after: prog.inchAbdomenAfter },
    { label: '엉덩이', before: prog.inchHipBefore,    after: prog.inchHipAfter },
  ].filter(r => r.before != null || r.after != null) : [];

  const hasPhotos = beforePhotos.length > 0 || afterPhotos.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      {/* 프로그램명 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">
          {PROGRAM_EMOJIS[prog.programType]} {prog.programLabel}
        </h2>
        {prog.currentSession != null && prog.remainingSessions != null && (
          <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-full">
            {prog.currentSession}회차 · 잔여 {prog.remainingSessions}회
          </span>
        )}
      </div>

      {/* 회차 진행 바 */}
      {prog.currentSession != null && prog.remainingSessions != null && (
        <div className="bg-blue-50 rounded-xl px-4 py-3">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-600">{prog.currentSession}회차 완료</span>
            <span className="text-orange-500 font-semibold">잔여 {prog.remainingSessions}회차</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bava-gradient h-2 rounded-full"
              style={{ width: `${Math.min(100, (prog.currentSession / (prog.currentSession + prog.remainingSessions)) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Before 사진 */}
      {beforePhotos.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
            <span>📸</span><span className="text-orange-500">Before</span>
          </h3>
          <div className={`grid gap-2 ${beforePhotos.length >= 3 ? 'grid-cols-3' : beforePhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {beforePhotos.map(p => <PhotoCard key={p.label} url={p.url} label={p.label} />)}
          </div>
        </div>
      )}

      {/* After 사진 */}
      {afterPhotos.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
            <span>✨</span><span className="text-purple-600">After</span>
          </h3>
          <div className={`grid gap-2 ${afterPhotos.length >= 3 ? 'grid-cols-3' : afterPhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {afterPhotos.map(p => <PhotoCard key={p.label} url={p.url} label={p.label} />)}
          </div>
        </div>
      )}

      {/* Before & After 비교 (1장씩인 경우만) */}
      {!isPilates && beforePhotos.length > 0 && afterPhotos.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-800 mb-2">🔄 Before &amp; After 비교</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-center font-semibold text-orange-500">Before</p>
              <img src={beforePhotos[0].url} alt="비포" className="w-full aspect-[3/4] object-cover rounded-xl" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-center font-semibold text-purple-600">After</p>
              <img src={afterPhotos[0].url} alt="애프터" className="w-full aspect-[3/4] object-cover rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* 인치 변화 (바디관리 전용) */}
      {inchRows.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-800 mb-2">📏 인치 변화</h3>
          <div className="grid grid-cols-2 gap-2">
            {inchRows.map(r => {
              const diff = r.before != null && r.after != null ? r.after - r.before : null;
              return (
                <div key={r.label} className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm">
                  <p className="text-xs text-gray-500 mb-0.5">{r.label}</p>
                  <div className="flex items-center gap-1 font-medium text-gray-800">
                    <span>{r.before ?? '-'}</span>
                    <span className="text-gray-400 text-xs">→</span>
                    <span>{r.after ?? '-'}</span>
                    {diff != null && (
                      <span className={`text-xs ml-1 ${diff < 0 ? 'text-green-500' : diff > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                        ({diff > 0 ? '+' : ''}{diff.toFixed(1)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 사진도 인치도 없는 경우 */}
      {!hasPhotos && inchRows.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">이 프로그램의 기록이 없습니다.</p>
      )}
    </div>
  );
}

function StatBox({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-700',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-700',
  };
  return (
    <div className={`${colors[color]} rounded-xl p-3 text-center`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-70">{unit}</p>
    </div>
  );
}

function PhotoCard({ url, label }: { url: string; label: string }) {
  return (
    <div>
      <p className="text-xs text-center text-gray-400 mb-1">{label}</p>
      <img src={url} alt={label} className="w-full aspect-[3/4] object-cover rounded-xl" />
    </div>
  );
}
