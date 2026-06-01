import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BAVA BODY LOUNGE',
  description: 'BAVA BODY LOUNGE 관리 시스템',
};

/**
 * Root Layout - 최소화
 * 헤더/네비는 각 Route Group layout에서만 처리:
 *   app/(manager)/layout.tsx  → 매니저 헤더 있음
 *   app/(public)/layout.tsx   → 헤더 없음 (고객 공유 링크)
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
