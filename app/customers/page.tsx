'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllCustomers } from '@/lib/firestore';
import { Customer } from '@/types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllCustomers().then(c => { setCustomers(c); setLoading(false); });
  }, []);

  const filtered = customers.filter(c => {
    if (filter === 'active' && c.status !== 'active') return false;
    if (filter === 'ended' && c.status !== 'ended') return false;
    if (search && !c.name.includes(search) && !c.phone.includes(search) && !c.trainerName.includes(search)) return false;
    return true;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">고객 목록</h1>
        <Link href="/customers/new" className="px-4 py-2 bava-gradient text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all">
          + 신규 등록
        </Link>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text" placeholder="이름, 전화번호, 담당자 검색..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <div className="flex gap-2">
          {(['all', 'active', 'ended'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? 'bava-gradient text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'}`}>
              {f === 'all' ? '전체' : f === 'active' ? '관리중' : '종료'}
            </button>
          ))}
        </div>
      </div>

      {/* 고객 목록 */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">검색 결과가 없습니다</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-purple-50 border-b border-purple-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider">고객명</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider hidden md:table-cell">연락처</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider hidden md:table-cell">목표</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider hidden lg:table-cell">담당자</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider hidden lg:table-cell">시작일</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-purple-700 uppercase tracking-wider">상태</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-purple-50/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-400 md:hidden">{c.phone}</div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 hidden md:table-cell">{c.phone}</td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{c.goal}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 hidden lg:table-cell">{c.trainerName}</td>
                  <td className="px-5 py-3 text-sm text-gray-500 hidden lg:table-cell">{c.startDate}</td>
                  <td className="px-5 py-3">
                    <span className={c.status === 'active' ? 'badge-active' : 'badge-ended'}>
                      {c.status === 'active' ? '관리중' : '종료'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/customers/${c.id}`} className="text-purple-600 text-sm hover:underline font-medium">
                      보기 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400 text-right">총 {filtered.length}명 표시 중</p>
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
