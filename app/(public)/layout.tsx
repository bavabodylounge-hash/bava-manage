import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BAVA BODY LOUNGE — 월별 리포트',
};

/**
 * 고객 공개 페이지 레이아웃
 * 헤더/네비 완전 없음
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
