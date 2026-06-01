'use client';
import { usePathname } from 'next/navigation';

/**
 * 매니저 전용 헤더 + 레이아웃 래퍼
 * - /share/* 경로: 헤더 숨김 + 풀스크린 레이아웃
 * - 그 외: 매니저 헤더 표시 + 최대 너비 제한 레이아웃
 */
export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isShare = pathname.startsWith('/share');

  if (isShare) {
    // 공유 링크 페이지: 헤더 없음, 풀스크린
    return <>{children}</>;
  }

  // 매니저 페이지: 헤더 + 콘텐츠 래퍼
  return (
    <>
      <header className="bava-gradient text-white shadow-lg no-print">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">B</div>
            <div>
              <div className="font-bold text-sm tracking-widest">BAVA BODY LOUNGE</div>
              <div className="text-white/70 text-xs tracking-wider">MANAGER SYSTEM</div>
            </div>
          </div>
          <nav className="flex gap-1">
            <a href="/" className="px-3 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors">홈</a>
            <a href="/customers" className="px-3 py-1.5 rounded-lg text-sm hover:bg-white/20 transition-colors">고객 목록</a>
            <a href="/customers/new" className="px-3 py-1.5 rounded-lg text-sm bg-white/20 hover:bg-white/30 transition-colors font-semibold">+ 신규 등록</a>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </>
  );
}
