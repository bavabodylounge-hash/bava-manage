'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllCustomers, getAllReports } from '@/lib/firestoreClient';
import { Customer, MonthlyReport } from '@/types';

// 최근 리포트에서 남은 회차 5회 이하인 프로그램이 있는지 확인
function getReRegistrationWarning(reports: MonthlyReport[]): { programLabel: string; remaining: number } | null {
  if (reports.length === 0) return null;
  const latest = reports[reports.length - 1];
  for (const p of latest.programs || []) {
    if (p.remainingSessions !== undefined && p.remainingSessions <= 5) {
      return { programLabel: p.programLabel, remaining: p.remainingSessions };
    }
  }
  return null;
}

export default function HomePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllCustomers(), getAllReports()])
      .then(([c, r]) => { setCustomers(c); setReports(r); })
      .catch(e => console.error('데이터 로딩 실패:', e))
      .finally(() => setLoading(false));
  }, []);

  const active = customers.filter(c => c.status === 'active');
  const ended  = customers.filter(c => c.status === 'ended');
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthReports = reports.filter(r => r.reportMonth === thisMonth);
  const reportedIds = new Set(thisMonthReports.map(r => r.customerId));
  const notReported = active.filter(c => !reportedIds.has(c.id));

  // 고객별 최근 리포트 맵
  const latestReportByCustomer = new Map<string, MonthlyReport>();
  for (const r of reports) {
    const cur = latestReportByCustomer.get(r.customerId);
    if (!cur || r.reportMonth > cur.reportMonth) latestReportByCustomer.set(r.customerId, r);
  }

  // 재등록 임박 고객 (남은 회차 5회 이하)
  const reRegCustomers = active
    .map(c => {
      const latest = latestReportByCustomer.get(c.id);
      if (!latest) return null;
      const warning = getReRegistrationWarning([latest]);
      if (!warning) return null;
      return { customer: c, warning };
    })
    .filter(Boolean) as { customer: Customer; warning: { programLabel: string; remaining: number } }[];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">데이터 로딩 중...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <Link href="/customers/new" className="px-4 py-2 bava-gradient text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all">
          + 신규 고객 등록
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="전체 고객"      value={customers.length}        icon="👥" color="purple" />
        <StatCard label="관리 중"        value={active.length}           icon="💪" color="green" />
        <StatCard label="재등록 임박"    value={reRegCustomers.length}   icon="🔔" color="orange" />
        <StatCard label="이번 달 리포트" value={thisMonthReports.length} icon="📋" color="blue" />
      </div>

      {/* 🔴 재등록 임박 섹션 */}
      {reRegCustomers.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔔</span>
            <h2 className="font-bold text-rose-700 text-base">재등록 임박 고객 ({reRegCustomers.length}명)</h2>
            <span className="text-xs text-rose-500 bg-rose-100 px-2 py-0.5 rounded-full">남은 회차 5회 이하</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {reRegCustomers.map(({ customer: c, warning }) => (
              <Link key={c.id} href={`/customers/${c.id}`}
                className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-rose-200 hover:border-rose-400 hover:shadow-sm transition-all">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{warning.programLabel} · 담당 {c.trainerName}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-rose-600 text-lg">{warning.remaining}회</p>
                  <p className="text-xs text-rose-400">남음</p>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-xs text-rose-400 mt-3">💡 재등록 상담을 진행해주세요</p>
        </div>
      )}

      {/* 이번 달 리포트 미작성 알림 */}
      {notReported.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-600 text-lg">⚠️</span>
            <h2 className="font-bold text-amber-800">이번 달 리포트 미작성 ({notReported.length}명)</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {notReported.map(c => (
              <Link key={c.id} href={`/customers/${c.id}/report/new`}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-sm font-medium transition-colors">
                {c.name} →
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 관리 중인 고객 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">관리 중인 고객</h2>
          <Link href="/customers" className="text-purple-600 text-sm hover:underline">전체 보기 →</Link>
        </div>
        {active.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 text-4xl mb-3">👥</p>
            <p className="text-gray-500">등록된 고객이 없습니다</p>
            <Link href="/customers/new" className="mt-4 inline-block px-4 py-2 bava-gradient text-white rounded-xl text-sm font-semibold">
              첫 고객 등록하기
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.slice(0, 9).map(c => {
              const hasReport = reportedIds.has(c.id);
              const latest = latestReportByCustomer.get(c.id);
              const reReg = latest ? getReRegistrationWarning([latest]) : null;
              return (
                <Link key={c.id} href={`/customers/${c.id}`}
                  className={`card hover:shadow-md transition-all cursor-pointer border-l-4 ${reReg ? 'border-rose-400' : 'border-purple-500'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{c.name}</span>
                        {reReg && (
                          <span className="text-xs bg-rose-100 text-rose-600 font-bold px-1.5 py-0.5 rounded-full">
                            재등록 {reReg.remaining}회
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-sm mt-0.5">{c.phone}</div>
                      <div className="text-purple-600 text-xs mt-1 font-medium">{c.goal}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="badge-active">관리중</span>
                      {hasReport
                        ? <span className="text-xs text-green-600 font-medium">✓ 리포트 완료</span>
                        : <span className="text-xs text-amber-500 font-medium">리포트 필요</span>}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">담당: {c.trainerName} · 시작 {c.startDate}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-700',
    green:  'bg-green-50 text-green-700',
    orange: 'bg-rose-50 text-rose-700',
    gray:   'bg-gray-50 text-gray-600',
    blue:   'bg-blue-50 text-blue-700',
  };
  return (
    <div className={`card flex items-center gap-3 ${colors[color]}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs opacity-70">{label}</div>
      </div>
    </div>
  );
}
