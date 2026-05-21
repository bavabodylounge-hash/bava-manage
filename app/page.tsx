'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllCustomers, getAllReports } from '@/lib/firestore';
import { Customer, MonthlyReport } from '@/types';

export default function HomePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllCustomers(), getAllReports()])
      .then(([c, r]) => {
        setCustomers(c);
        setReports(r);
      })
      .catch(e => console.error('데이터 로딩 실패:', e))
      .finally(() => setLoading(false));
  }, []);

  const active = customers.filter(c => c.status === 'active');
  const ended = customers.filter(c => c.status === 'ended');
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthReports = reports.filter(r => r.reportMonth === thisMonth);

  // 이번달 미등록 활성 고객
  const reportedIds = new Set(thisMonthReports.map(r => r.customerId));
  const notReported = active.filter(c => !reportedIds.has(c.id));

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
          <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
        <Link href="/customers/new" className="px-4 py-2 bava-gradient text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all">
          + 신규 고객 등록
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="전체 고객" value={customers.length} icon="👥" color="purple" />
        <StatCard label="관리 중" value={active.length} icon="💪" color="green" />
        <StatCard label="종료 고객" value={ended.length} icon="🎓" color="gray" />
        <StatCard label="이번 달 리포트" value={thisMonthReports.length} icon="📋" color="blue" />
      </div>

      {/* 이번 달 리포트 미작성 알림 */}
      {notReported.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-600 text-lg">⚠️</span>
            <h2 className="font-bold text-amber-800">이번 달 리포트 미작성 고객 ({notReported.length}명)</h2>
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

      {/* 최근 활성 고객 */}
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
            {active.slice(0, 6).map(c => {
              const hasReport = reportedIds.has(c.id);
              return (
                <Link key={c.id} href={`/customers/${c.id}`}
                  className="card hover:shadow-md transition-all cursor-pointer border-l-4 border-purple-500">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-gray-900">{c.name}</div>
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
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-600',
    blue: 'bg-blue-50 text-blue-700',
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
