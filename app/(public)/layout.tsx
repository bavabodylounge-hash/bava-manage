/**
 * 고객 공개 페이지 레이아웃
 * 헤더 없음 - 고객이 카톡 링크로 접근하는 페이지
 * 매니저 네비게이션(홈/고객목록/신규등록) 완전 차단
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body > header,
        header.bava-gradient {
          display: none !important;
        }
      `}</style>
      {children}
    </>
  );
}
