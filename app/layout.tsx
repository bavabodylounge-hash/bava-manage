import type { Metadata } from 'next';
import './globals.css';
import ConditionalLayout from '@/components/ConditionalHeader';

export const metadata: Metadata = {
  title: 'BAVA BODY LOUNGE — 고객 관리 시스템',
  description: 'BAVA BODY LOUNGE 매니저 전용 고객 관리 및 AI 피드백 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
      </body>
    </html>
  );
}
