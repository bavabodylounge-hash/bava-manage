'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCustomer, getCustomerReports, updateCustomer, deleteCustomer } from '@/lib/firestore';
import { Customer, MonthlyReport, ReportProgram, PROGRAM_EMOJIS } from '@/types';
import { generateMonthlyPDF, generateFinalPDF } from '@/lib/pdfGenerator';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingFinal, setGeneratingFinal] = useState(false);
  const [finalAI, setFinalAI] = useState<{ summary: string; recommendation: string } | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    Promise.all([getCustomer(id), getCustomerReports(id)])
      .then(([c, r]) => {
        setCustomer(c);
        setReports(r);
      })
      .catch(e => console.error('load error:', e))
      .finally(() => setLoading(false));
  }, [id]);

  const handleEndManagement = async () => {
    if (!customer) return;
    await updateCustomer(id, { status: 'ended', endDate });
    setCustomer(prev => prev ? { ...prev, status: 'ended', endDate } : null);
    setShowEndModal(false);
  };

  const handleDelete = async () => {
    if (!confirm(`${customer?.name} 고객을 삭제하시겠습니까? 모든 리포트도 함께 삭제됩니다.`)) return;
    await deleteCustomer(id);
    router.push('/customers');
  };

  const handleGenerateFinalReport = async () => {
    if (!customer || reports.length === 0) return alert('리포트 데이터가 없습니다.');
    setGeneratingFinal(true);
    try {
      const res = await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer, allReports: reports, mode: 'final' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFinalAI(data);
    } catch (err) {
      alert('AI 생성 오류: ' + err);
    } finally {
      setGeneratingFinal(false);
    }
  };

  const handleDownloadFinalPDF = async () => {
    if (!customer || !finalAI) return;
    await generateFinalPDF(customer, reports, finalAI.summary, finalAI.recommendation);
  };

  const handleDownloadMonthlyPDF = async (report: MonthlyReport) => {
    if (!customer) return;
    await generateMonthlyPDF(customer, report, reports);
  };

  const handleCopyShareUrl = async (reportId: string) => {
    const url = `${window.location.origin}/share/${reportId}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('📋 링크가 복사되었습니다!\n카카오톡에 붙여넣기 하세요 😊\n\n' + url);
    } catch {
      // 복사 실패 시 직접 보여주기
      prompt('아래 링크를 복사하세요:', url);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!customer) return <div className="card text-center py-16 text-gray-500">고객을 찾을 수 없습니다.</div>;

  const firstWeight = reports.length > 0 ? reports[0].weight : null;
  const lastWeight = reports.length > 0 ? reports[reports.length - 1].weight : null;
  const weightChange = firstWeight && lastWeight ? lastWeight - firstWeight : null;

  return (
    <div className="space-y-6">
      {/* 상단 헤더 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">← 뒤로</button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
              <span className={customer.status === 'active' ? 'badge-active' : 'badge-ended'}>
                {customer.status === 'active' ? '관리중' : '종료'}
              </span>
            </div>
            <p className="text-gray-500 text-sm">{customer.phone} · 담당: {customer.trainerName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {customer.status === 'active' && (
            <>
              <Link href={`/customers/${id}/report/new`}
                className="px-3 py-2 bava-gradient text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all">
                + 월별 리포트 작성
              </Link>
              <button onClick={() => setShowEndModal(true)}
                className="px-3 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                관리 종료
              </button>
            </>
          )}
          <button onClick={handleDelete}
            className="px-3 py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 transition-colors">
            삭제
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* 고객 정보 카드 */}
        <div className="card space-y-3">
          <h2 className="font-bold text-gray-700 border-b pb-2">👤 고객 정보</h2>
          <InfoRow label="목표" value={customer.goal} />
          <InfoRow label="성별" value={customer.gender === 'female' ? '여성' : '남성'} />
          {customer.birthYear && <InfoRow label="출생연도" value={`${customer.birthYear}년생`} />}
          <InfoRow label="시작일" value={customer.startDate} />
          {customer.endDate && <InfoRow label="종료일" value={customer.endDate} />}
          <InfoRow label="성향" value={customer.personality || '-'} />
          {customer.notes && (
            <div>
              <span className="text-xs text-gray-500 font-medium">특이사항</span>
              <p className="text-sm text-gray-700 mt-1 bg-amber-50 p-2 rounded-lg">{customer.notes}</p>
            </div>
          )}
          <Link href={`/customers/${id}/edit`}
            className="block w-full text-center py-2 border border-purple-200 text-purple-600 rounded-xl text-sm hover:bg-purple-50 transition-colors mt-2">
            정보 수정
          </Link>
        </div>

        {/* 통계 */}
        <div className="card space-y-3">
          <h2 className="font-bold text-gray-700 border-b pb-2">📊 변화 현황</h2>
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-purple-700">{reports.length}회</div>
            <div className="text-gray-500 text-sm">누적 월별 리포트</div>
          </div>
          {weightChange !== null && (
            <div className={`text-center p-3 rounded-xl ${weightChange < 0 ? 'bg-green-50' : weightChange > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
              <div className={`text-2xl font-bold ${weightChange < 0 ? 'text-green-600' : weightChange > 0 ? 'text-orange-500' : 'text-gray-500'}`}>
                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)}kg
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {firstWeight}kg → {lastWeight}kg
              </div>
            </div>
          )}
          {reports.length > 0 && (
            <div className="space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>최근 리포트</span>
                <span className="font-medium text-gray-700">{reports[reports.length - 1].reportMonth}</span>
              </div>
            </div>
          )}
        </div>

        {/* 종합 AI 리포트 */}
        <div className="card space-y-3">
          <h2 className="font-bold text-gray-700 border-b pb-2">🤖 종합 AI 리포트</h2>
          {finalAI ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-purple-700 mb-1">📝 총평</p>
                <p className="text-sm text-gray-700 bg-purple-50 p-3 rounded-lg whitespace-pre-wrap">{finalAI.summary}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-green-700 mb-1">🚀 향후 방향</p>
                <p className="text-sm text-gray-700 bg-green-50 p-3 rounded-lg whitespace-pre-wrap">{finalAI.recommendation}</p>
              </div>
              <button onClick={handleDownloadFinalPDF}
                className="w-full py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors">
                📄 종합 리포트 PDF 저장
              </button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <p className="text-gray-400 text-sm">
                {reports.length === 0
                  ? '리포트가 없어 종합 분석을 생성할 수 없습니다'
                  : `${reports.length}개월 데이터로 AI 종합 분석을 생성합니다`}
              </p>
              <button
                onClick={handleGenerateFinalReport}
                disabled={reports.length === 0 || generatingFinal}
                className="w-full py-2 bava-gradient text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-all">
                {generatingFinal ? '🤖 AI 분석 중...' : '🤖 AI 종합 분석 생성'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 체중 변화 그래프 (간단) */}
      {reports.length > 1 && (
        <div className="card">
          <h2 className="font-bold text-gray-700 mb-4">📈 체중 변화 추이</h2>
          <WeightChart reports={reports} />
        </div>
      )}

      {/* 월별 리포트 목록 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-700">📋 월별 리포트</h2>
          {customer.status === 'active' && (
            <Link href={`/customers/${id}/report/new`}
              className="text-purple-600 text-sm hover:underline">+ 이번 달 작성</Link>
          )}
        </div>
        {reports.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-4xl mb-2">📝</p>
            <p className="text-gray-500 text-sm">아직 작성된 리포트가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...reports].reverse().map((r) => (
              <ReportCard key={r.id} report={r}
                onDownload={() => handleDownloadMonthlyPDF(r)}
                onShare={() => handleCopyShareUrl(r.id)} />
            ))}
          </div>
        )}
      </div>

      {/* 관리 종료 모달 */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">관리 종료</h3>
            <p className="text-gray-600 text-sm">{customer.name} 고객의 관리를 종료하시겠습니까?</p>
            <div>
              <label className="text-sm font-medium text-gray-700">종료일</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="input-field mt-1" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowEndModal(false)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleEndManagement}
                className="flex-1 py-2 bava-gradient text-white rounded-xl text-sm font-semibold">종료 확인</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input-field { width:100%; padding:10px 14px; border:1px solid #E5E7EB; border-radius:10px; font-size:14px; outline:none; background:#FAFAFA; }
        .input-field:focus { border-color:#9333EA; background:#fff; }
      `}</style>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start text-sm">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-gray-800 font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function ReportCard({ report, onDownload, onShare }: { report: MonthlyReport; onDownload: () => void; onShare: () => void }) {
  const [open, setOpen] = useState(false);
  const programs = report.programs ?? [];

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* 헤더 행 */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-purple-700">{report.reportMonth}</span>
          <span className="text-sm text-gray-700">{report.weight}kg</span>
          {/* 프로그램 태그 (복수) */}
          {programs.map(prog => (
            <span key={prog.programType} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              {PROGRAM_EMOJIS[prog.programType]} {prog.programLabel}
            </span>
          ))}
          {report.aiFeedback && <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">AI ✓</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onShare(); }}
            className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-1">
            🔗 카톡공유
          </button>
          <button onClick={e => { e.stopPropagation(); onDownload(); }}
            className="text-xs text-purple-600 border border-purple-200 px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors">
            PDF
          </button>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* 펼침 영역 */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
          {programs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">프로그램 정보가 없습니다.</p>
          ) : (
            programs.map(prog => (
              <ProgramSection key={prog.programType} prog={prog} />
            ))
          )}

          {report.monthlyNote && (
            <div>
              <p className="text-xs text-gray-500 font-medium">📝 메모</p>
              <p className="text-sm text-gray-700 mt-1">{report.monthlyNote}</p>
            </div>
          )}
          {report.aiFeedback && (
            <div>
              <p className="text-xs text-purple-600 font-semibold">🤖 AI 코멘트</p>
              <p className="text-sm text-gray-700 mt-1 bg-purple-50 p-3 rounded-lg whitespace-pre-wrap">{report.aiFeedback}</p>
            </div>
          )}
          {report.aiDirection && (
            <div>
              <p className="text-xs text-green-600 font-semibold">🚀 다음 달 방향성</p>
              <p className="text-sm text-gray-700 mt-1 bg-green-50 p-3 rounded-lg whitespace-pre-wrap">{report.aiDirection}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 프로그램 단위 섹션 (회차 정보 + 사진 + 인치변화) */
function ProgramSection({ prog }: { prog: ReportProgram }) {
  const isPilates = prog.programType === 'pilatesPt';
  const isBodyManage = prog.programType === 'bodyManage';

  const beforePhotos = [
    { url: prog.beforeFrontUrl, label: isPilates ? '앞면' : 'Before' },
    ...(isPilates ? [
      { url: prog.beforeSideUrl, label: '측면' },
      { url: prog.beforeBackUrl, label: '뒷면' },
    ] : []),
  ].filter(p => p.url);

  const afterPhotos = [
    { url: prog.afterFrontUrl, label: isPilates ? '앞면' : 'After' },
    ...(isPilates ? [
      { url: prog.afterSideUrl, label: '측면' },
      { url: prog.afterBackUrl, label: '뒷면' },
    ] : []),
  ].filter(p => p.url);

  const inchRows = isBodyManage ? [
    { label: '하체', before: prog.inchLowerBefore, after: prog.inchLowerAfter },
    { label: '팔',  before: prog.inchArmBefore,   after: prog.inchArmAfter },
    { label: '복부', before: prog.inchAbdomenBefore, after: prog.inchAbdomenAfter },
    { label: '엉덩이', before: prog.inchHipBefore, after: prog.inchHipAfter },
  ].filter(r => r.before != null || r.after != null) : [];

  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-3">
      {/* 프로그램명 + 회차 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">
          {PROGRAM_EMOJIS[prog.programType]} {prog.programLabel}
        </p>
        {prog.currentSession != null && (
          <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
            {prog.currentSession}회차 · 잔여 {prog.remainingSessions ?? 0}회
          </span>
        )}
      </div>

      {/* 회차 프로그레스 바 */}
      {prog.currentSession != null && prog.remainingSessions != null && (
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(100, (prog.currentSession / (prog.currentSession + prog.remainingSessions)) * 100)}%` }} />
        </div>
      )}

      {/* Before 사진 */}
      {beforePhotos.length > 0 && (
        <div>
          <p className="text-xs text-orange-500 font-semibold mb-1.5">📸 Before</p>
          <div className={`grid gap-2 ${beforePhotos.length >= 3 ? 'grid-cols-3' : beforePhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-[160px]'}`}>
            {beforePhotos.map(p => (
              <div key={p.label}>
                <p className="text-xs text-gray-400 mb-1 text-center">{p.label}</p>
                <img src={p.url} alt={`비포 ${p.label}`} className="w-full h-28 object-cover rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* After 사진 */}
      {afterPhotos.length > 0 && (
        <div>
          <p className="text-xs text-purple-600 font-semibold mb-1.5">✨ After</p>
          <div className={`grid gap-2 ${afterPhotos.length >= 3 ? 'grid-cols-3' : afterPhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-[160px]'}`}>
            {afterPhotos.map(p => (
              <div key={p.label}>
                <p className="text-xs text-gray-400 mb-1 text-center">{p.label}</p>
                <img src={p.url} alt={`애프터 ${p.label}`} className="w-full h-28 object-cover rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 인치 변화 (바디관리 전용) */}
      {inchRows.length > 0 && (
        <div>
          <p className="text-xs text-teal-600 font-semibold mb-1.5">📏 인치 변화</p>
          <div className="grid grid-cols-2 gap-1.5">
            {inchRows.map(r => {
              const diff = r.before != null && r.after != null ? r.after - r.before : null;
              return (
                <div key={r.label} className="bg-white rounded-lg px-2.5 py-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium">
                    {r.before ?? '-'} → {r.after ?? '-'}
                    {diff != null && (
                      <span className={`ml-1 ${diff < 0 ? 'text-green-500' : diff > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                        ({diff > 0 ? '+' : ''}{diff.toFixed(1)})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WeightChart({ reports }: { reports: MonthlyReport[] }) {
  const weights = reports.map(r => r.weight);
  const min = Math.min(...weights) - 2;
  const max = Math.max(...weights) + 2;
  const range = max - min;
  const w = 600; const h = 120;
  const pts = reports.map((r, i) => {
    const x = (i / (reports.length - 1)) * (w - 40) + 20;
    const y = h - 20 - ((r.weight - min) / range) * (h - 40);
    return { x, y, w: r.weight, m: r.reportMonth };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full" style={{ minWidth: '300px' }}>
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9333EA" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#9333EA" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 그리드 */}
        {[0.25, 0.5, 0.75].map(t => (
          <line key={t} x1="20" y1={h - 20 - t * (h - 40)} x2={w - 20} y2={h - 20 - t * (h - 40)}
            stroke="#E5E7EB" strokeWidth="1" />
        ))}
        {/* 면적 */}
        <path d={`${pathD} L ${pts[pts.length - 1].x} ${h - 20} L ${pts[0].x} ${h - 20} Z`}
          fill="url(#wg)" />
        {/* 선 */}
        <path d={pathD} stroke="#9333EA" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* 포인트 + 라벨 */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#9333EA" stroke="#fff" strokeWidth="2" />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#6B7280">{p.w}kg</text>
            <text x={p.x} y={h + 14} textAnchor="middle" fontSize="8" fill="#9CA3AF">{p.m.slice(5)}</text>
          </g>
        ))}
      </svg>
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
