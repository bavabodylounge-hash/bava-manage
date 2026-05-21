import jsPDF from 'jspdf';
import { Customer, MonthlyReport, PROGRAM_EMOJIS } from '@/types';

// ── 색상 팔레트 ──────────────────────────────────────
const C = {
  purple: [74, 14, 110] as [number, number, number],
  purpleMid: [107, 33, 168] as [number, number, number],
  purpleLight: [147, 51, 234] as [number, number, number],
  palePurple: [245, 240, 255] as [number, number, number],
  pink: [255, 145, 164] as [number, number, number],
  gold: [184, 150, 90] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [243, 244, 246] as [number, number, number],
  dark: [26, 26, 46] as [number, number, number],
  green: [16, 185, 129] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
};

function setFill(doc: jsPDF, color: [number, number, number]) { doc.setFillColor(color[0], color[1], color[2]); }
function setColor(doc: jsPDF, color: [number, number, number]) { doc.setTextColor(color[0], color[1], color[2]); }
function setDraw(doc: jsPDF, color: [number, number, number]) { doc.setDrawColor(color[0], color[1], color[2]); }

// 긴 텍스트를 줄바꿈하여 배열로
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

// 헤더 그라데이션 블록
function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const pw = doc.internal.pageSize.getWidth();
  setFill(doc, C.purple);
  doc.rect(0, 0, pw, 38, 'F');
  setFill(doc, C.purpleMid);
  doc.rect(pw * 0.5, 0, pw * 0.5, 38, 'F');

  // 브랜드 이름
  doc.setFont('helvetica', 'bold');
  setColor(doc, C.white);
  doc.setFontSize(16);
  doc.text('BAVA BODY LOUNGE', 15, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, [255, 255, 255]);
  doc.setTextColor(255, 255, 255);
  doc.text('PROFESSIONAL BODY CARE STUDIO', 15, 22);

  // 타이틀
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setColor(doc, C.white);
  doc.text(title, 15, 31);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, [220, 200, 255]);
    doc.text(subtitle, pw - 15, 31, { align: 'right' });
  }
}

// 섹션 제목 박스
function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  setFill(doc, C.palePurple);
  doc.roundedRect(10, y, pw - 20, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, C.purple);
  doc.text(text, 15, y + 6.3);
  return y + 13;
}

// 정보 행
function drawInfoRow(doc: jsPDF, label: string, value: string, x: number, y: number, w: number): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, C.gray);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  setColor(doc, C.dark);
  doc.text(value || '-', x + w * 0.38, y);
  return y + 6.5;
}

// 텍스트 박스
function drawTextBox(doc: jsPDF, text: string, x: number, y: number, w: number, bgColor: [number,number,number]): number {
  if (!text) return y;
  const lines = wrapText(doc, text, w - 10);
  const boxH = lines.length * 5.5 + 8;
  setFill(doc, bgColor);
  doc.roundedRect(x, y, w, boxH, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, C.dark);
  lines.forEach((line, i) => doc.text(line, x + 5, y + 7 + i * 5.5));
  return y + boxH + 4;
}

// 페이지 하단 서명란
function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  setDraw(doc, C.lightGray);
  doc.setLineWidth(0.3);
  doc.line(10, ph - 18, pw - 10, ph - 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setColor(doc, C.gray);
  doc.text('BAVA BODY LOUNGE  |  본 문서는 고객 관리 목적으로 생성된 자료입니다', 15, ph - 12);
  doc.text(new Date().toLocaleDateString('ko-KR'), pw - 15, ph - 12, { align: 'right' });

  // 서명란
  doc.setFontSize(7.5);
  setColor(doc, C.dark);
  doc.text('담당 매니저 서명:', pw - 60, ph - 6);
  setDraw(doc, C.gray);
  doc.line(pw - 30, ph - 6, pw - 10, ph - 6);
}

// ══════════════════════════════════════════════════════
//  월별 리포트 PDF
// ══════════════════════════════════════════════════════
export async function generateMonthlyPDF(
  customer: Customer,
  report: MonthlyReport,
  allReports: MonthlyReport[]
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const prevReport = allReports.length > 1
    ? allReports.find((_, i) => allReports[i + 1]?.id === report.id)
    : null;
  const weightChange = prevReport ? report.weight - prevReport.weight : null;

  // ── 헤더 ──
  drawHeader(doc,
    `월별 관리 리포트  ${report.reportMonth}`,
    `${customer.name} 고객님`
  );

  let y = 46;

  // ── 고객 기본 정보 ──
  y = drawSectionTitle(doc, '👤  고객 정보', y);
  const leftX = 15; const midX = pw / 2 + 5;
  y = drawInfoRow(doc, '고객명', customer.name, leftX, y, pw / 2 - 10);
  const y2 = drawInfoRow(doc, '담당 매니저', customer.trainerName, midX, y - 6.5, pw / 2 - 10);
  y = Math.max(y, y2);
  y = drawInfoRow(doc, '목표', customer.goal, leftX, y, pw / 2 - 10);
  const y3 = drawInfoRow(doc, '관리 기간', `${customer.startDate} ~`, midX, y - 6.5, pw / 2 - 10);
  y = Math.max(y, y3) + 2;

  // ── 측정 데이터 ──
  y = drawSectionTitle(doc, '📊  측정 데이터', y);

  // 체중 강조 박스
  const wChange = weightChange !== null
    ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}kg`
    : '';
  const wChangeColor = weightChange === null ? C.gray : weightChange < 0 ? C.green : C.red;

  setFill(doc, C.palePurple);
  doc.roundedRect(leftX, y, 50, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setColor(doc, C.purple);
  doc.text(`${report.weight}`, leftX + 25, y + 13, { align: 'center' });
  doc.setFontSize(9);
  doc.text('kg', leftX + 40, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, C.gray);
  doc.text('이번 달 체중', leftX + 25, y + 19, { align: 'center' });

  if (wChange) {
    setFill(doc, weightChange! < 0 ? [209, 250, 229] : [254, 226, 226]);
    doc.roundedRect(leftX + 55, y, 40, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setColor(doc, wChangeColor);
    doc.text(wChange, leftX + 75, y + 13, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setColor(doc, C.gray);
    doc.text('지난 달 대비', leftX + 75, y + 19, { align: 'center' });
  }

  if (report.bodyFat) {
    setFill(doc, C.lightGray);
    doc.roundedRect(midX, y, 35, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setColor(doc, C.dark);
    doc.text(`${report.bodyFat}`, midX + 17.5, y + 13, { align: 'center' });
    doc.setFontSize(9);
    doc.text('%', midX + 30, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setColor(doc, C.gray);
    doc.text('체지방률', midX + 17.5, y + 19, { align: 'center' });
  }

  if (report.muscleMass) {
    const mmX = report.bodyFat ? midX + 40 : midX;
    setFill(doc, C.lightGray);
    doc.roundedRect(mmX, y, 35, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setColor(doc, C.dark);
    doc.text(`${report.muscleMass}`, mmX + 17.5, y + 13, { align: 'center' });
    doc.setFontSize(9);
    doc.text('kg', mmX + 30, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setColor(doc, C.gray);
    doc.text('근육량', mmX + 17.5, y + 19, { align: 'center' });
  }
  y += 28;

  // 체중 변화 이력 (미니 차트 대신 텍스트)
  if (allReports.length > 1) {
    const recentReports = allReports.slice(-6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setColor(doc, C.gray);
    doc.text('체중 변화 이력: ' + recentReports.map(r => `${r.reportMonth.slice(5)}월 ${r.weight}kg`).join(' → '), leftX, y);
    y += 7;
  }

  // ── 이번 달 성향 & 메모 ──
  if (report.personality || report.monthlyNote) {
    y = drawSectionTitle(doc, '📝  매니저 메모', y);
    if (report.personality) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setColor(doc, C.gray);
      doc.text('고객 성향:', leftX, y);
      doc.setFont('helvetica', 'normal');
      setColor(doc, C.dark);
      doc.text(report.personality, leftX + 22, y);
      y += 7;
    }
    if (report.monthlyNote) {
      y = drawTextBox(doc, report.monthlyNote, leftX, y, pw - 25, C.lightGray);
    }
  }

  // ── AI 코멘트 ──
  if (report.aiFeedback) {
    y = drawSectionTitle(doc, '🤖  AI 이달의 코멘트', y);
    y = drawTextBox(doc, report.aiFeedback, leftX, y, pw - 25, C.palePurple);
  }

  // ── 다음 달 방향성 ──
  if (report.aiDirection) {
    // 페이지 넘침 체크
    if (y > 230) { doc.addPage(); drawHeader(doc, `월별 관리 리포트 ${report.reportMonth}`, `${customer.name} 고객님`); y = 46; }
    y = drawSectionTitle(doc, '🚀  다음 달 방향성', y);
    y = drawTextBox(doc, report.aiDirection, leftX, y, pw - 25, [236, 253, 245]);
  }

  // ── 사진 섹션 (프로그램별 비포/애프터) ──
  const programs = report.programs ?? [];
  for (const prog of programs) {
    const isPilates = prog.programType === 'pilatesPt';
    const photos: { url: string; label: string }[] = [
      prog.beforeFrontUrl && { url: prog.beforeFrontUrl, label: isPilates ? 'Before 앞' : 'Before' },
      isPilates && prog.beforeSideUrl && { url: prog.beforeSideUrl, label: 'Before 측' },
      isPilates && prog.beforeBackUrl && { url: prog.beforeBackUrl, label: 'Before 뒤' },
      prog.afterFrontUrl  && { url: prog.afterFrontUrl,  label: isPilates ? 'After 앞' : 'After' },
      isPilates && prog.afterSideUrl  && { url: prog.afterSideUrl,  label: 'After 측' },
      isPilates && prog.afterBackUrl  && { url: prog.afterBackUrl,  label: 'After 뒤' },
    ].filter((p): p is { url: string; label: string } => !!p);

    if (photos.length > 0) {
      if (y > 180) { doc.addPage(); drawHeader(doc, `월별 관리 리포트 ${report.reportMonth}`, `${customer.name} 고객님`); y = 46; }
      y = drawSectionTitle(doc, `📸  ${PROGRAM_EMOJIS[prog.programType]} ${prog.programLabel} 변화도 사진`, y);
      const photoW = (pw - 30 - (photos.length - 1) * 5) / photos.length;
      const photoH = photoW * 1.33;
      for (let i = 0; i < photos.length; i++) {
        try {
          const img = await loadImageAsBase64(photos[i].url);
          doc.addImage(img, 'JPEG', leftX + i * (photoW + 5), y, photoW, photoH);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          setColor(doc, C.gray);
          doc.text(photos[i].label, leftX + i * (photoW + 5) + photoW / 2, y + photoH + 4, { align: 'center' });
        } catch { /* 사진 로드 실패 무시 */ }
      }
      y += photoH + 10;
    }

    // 인치 변화 (바디관리 전용)
    if (prog.programType === 'bodyManage') {
      const inchRows = [
        { label: '하체', before: prog.inchLowerBefore, after: prog.inchLowerAfter },
        { label: '팔',   before: prog.inchArmBefore,   after: prog.inchArmAfter },
        { label: '복부', before: prog.inchAbdomenBefore, after: prog.inchAbdomenAfter },
        { label: '엉덩이', before: prog.inchHipBefore, after: prog.inchHipAfter },
      ].filter(r => r.before != null || r.after != null);

      if (inchRows.length > 0) {
        if (y > 220) { doc.addPage(); drawHeader(doc, `월별 관리 리포트 ${report.reportMonth}`, `${customer.name} 고객님`); y = 46; }
        y = drawSectionTitle(doc, '📏  인치 변화 (바디관리)', y);
        inchRows.forEach(r => {
          const diff = r.before != null && r.after != null ? r.after - r.before : null;
          const diffStr = diff != null ? ` (${diff > 0 ? '+' : ''}${diff.toFixed(1)})` : '';
          y = drawInfoRow(doc, r.label, `${r.before ?? '-'} → ${r.after ?? '-'}${diffStr}`, leftX, y, pw - 25);
        });
      }
    }
  }

  drawFooter(doc);
  doc.save(`BAVA_${customer.name}_${report.reportMonth}_리포트.pdf`);
}

// ══════════════════════════════════════════════════════
//  종료 종합 리포트 PDF
// ══════════════════════════════════════════════════════
export async function generateFinalPDF(
  customer: Customer,
  reports: MonthlyReport[],
  aiSummary: string,
  aiRecommendation: string
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const firstReport = reports[0];
  const lastReport = reports[reports.length - 1];
  const weightChange = lastReport && firstReport ? lastReport.weight - firstReport.weight : 0;

  // ── 페이지 1: 커버 ──────────────────────────────────
  setFill(doc, C.purple);
  doc.rect(0, 0, pw, doc.internal.pageSize.getHeight(), 'F');

  // 장식 원
  setFill(doc, C.purpleMid);
  doc.circle(pw + 10, -10, 60, 'F');
  doc.circle(-10, doc.internal.pageSize.getHeight() + 10, 50, 'F');
  setFill(doc, C.purpleLight);
  doc.circle(pw - 20, 50, 20, 'F');

  // 브랜드
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(doc, [200, 170, 255]);
  doc.text('BAVA BODY LOUNGE', pw / 2, 55, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  setColor(doc, [180, 150, 230]);
  doc.text('PROFESSIONAL BODY CARE STUDIO', pw / 2, 62, { align: 'center' });

  // 타이틀
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  setColor(doc, C.white);
  doc.text('관리 종합 리포트', pw / 2, 100, { align: 'center' });

  doc.setFontSize(14);
  setColor(doc, [220, 200, 255]);
  doc.text(`${customer.name} 고객님`, pw / 2, 114, { align: 'center' });

  // 구분선
  setFill(doc, C.pink);
  doc.rect(pw / 2 - 20, 120, 40, 1.5, 'F');

  // 관리 기간
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, [200, 180, 240]);
  doc.text(`${customer.startDate} ~ ${customer.endDate || ''}`, pw / 2, 130, { align: 'center' });
  doc.text(`총 ${reports.length}개월 관리 완료`, pw / 2, 139, { align: 'center' });

  // 체중 변화 하이라이트
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pw / 2 - 45, 148, 90, 35, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, C.purple);
  doc.text('총 체중 변화', pw / 2, 157, { align: 'center' });
  doc.setFontSize(22);
  const changeColor = weightChange < 0 ? C.green : weightChange > 0 ? C.red : C.gray;
  setColor(doc, changeColor);
  doc.text(`${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`, pw / 2, 170, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, C.gray);
  doc.text(`${firstReport?.weight}kg → ${lastReport?.weight}kg`, pw / 2, 178, { align: 'center' });

  // 목표
  setColor(doc, [180, 150, 230]);
  doc.setFontSize(9);
  doc.text(`목표: ${customer.goal}`, pw / 2, 200, { align: 'center' });

  // 하단
  doc.setFontSize(8);
  setColor(doc, [150, 120, 200]);
  doc.text(`발행일: ${new Date().toLocaleDateString('ko-KR')}`, pw / 2, 270, { align: 'center' });
  doc.text('이 문서는 BAVA BODY LOUNGE 고객 관리 시스템에서 자동 생성되었습니다', pw / 2, 278, { align: 'center' });

  // ── 페이지 2: 데이터 + AI 총평 ──────────────────────
  doc.addPage();
  drawHeader(doc, '관리 종합 리포트', `${customer.name} 고객님`);
  let y = 46;

  // 고객 정보
  y = drawSectionTitle(doc, '👤  고객 정보 요약', y);
  const leftX = 15; const midX = pw / 2 + 5;
  y = drawInfoRow(doc, '고객명', customer.name, leftX, y, pw / 2 - 10);
  drawInfoRow(doc, '담당 매니저', customer.trainerName, midX, y - 6.5, pw / 2 - 10);
  y = drawInfoRow(doc, '목표', customer.goal, leftX, y, pw / 2 - 10);
  drawInfoRow(doc, '관리 기간', `${reports.length}개월`, midX, y - 6.5, pw / 2 - 10);
  y = drawInfoRow(doc, '시작일', customer.startDate, leftX, y, pw / 2 - 10);
  drawInfoRow(doc, '종료일', customer.endDate || '-', midX, y - 6.5, pw / 2 - 10);
  if (customer.notes) {
    y = drawTextBox(doc, `특이사항: ${customer.notes}`, leftX, y + 2, pw - 25, C.lightGray);
  }
  y += 2;

  // 전체 체중 변화 이력
  y = drawSectionTitle(doc, '📊  월별 체중 변화 이력', y);
  const colW = (pw - 30) / Math.min(reports.length, 8);
  const chunkSize = 8;
  for (let ci = 0; ci < reports.length; ci += chunkSize) {
    const chunk = reports.slice(ci, ci + chunkSize);
    chunk.forEach((r, i) => {
      const cx = leftX + (ci + i) * colW;
      setFill(doc, C.palePurple);
      doc.roundedRect(cx, y, colW - 2, 16, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setColor(doc, C.purple);
      doc.text(`${r.weight}`, cx + (colW - 2) / 2, y + 8.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      setColor(doc, C.gray);
      doc.text(r.reportMonth.slice(5) + '월', cx + (colW - 2) / 2, y + 14.5, { align: 'center' });
    });
    if (ci + chunkSize < reports.length) y += 20;
  }
  y += 22;

  // AI 총평
  y = drawSectionTitle(doc, '🤖  AI 전체 관리 총평', y);
  y = drawTextBox(doc, aiSummary, leftX, y, pw - 25, C.palePurple);
  y += 2;

  // AI 향후 방향 (페이지 넘침 체크)
  if (y > 230) {
    doc.addPage();
    drawHeader(doc, '관리 종합 리포트', `${customer.name} 고객님`);
    y = 46;
  }
  y = drawSectionTitle(doc, '🚀  앞으로의 독립 관리 방향', y);
  y = drawTextBox(doc, aiRecommendation, leftX, y, pw - 25, [236, 253, 245]);

  drawFooter(doc);

  // ── 페이지 3: 월별 상세 히스토리 ──────────────────────
  doc.addPage();
  drawHeader(doc, '월별 상세 히스토리', `${customer.name} 고객님`);
  y = 46;

  for (const r of reports) {
    if (y > 250) {
      doc.addPage();
      drawHeader(doc, '월별 상세 히스토리', `${customer.name} 고객님`);
      y = 46;
    }
    y = drawSectionTitle(doc, `📋  ${r.reportMonth}`, y);
    const prevR = reports.find((_, i) => reports[i + 1]?.id === r.id);
    const chg = prevR ? r.weight - prevR.weight : null;
    const chgStr = chg !== null ? ` (${chg > 0 ? '+' : ''}${chg.toFixed(1)}kg)` : '';
    y = drawInfoRow(doc, '체중', `${r.weight}kg${chgStr}`, leftX, y, pw / 2 - 10);
    if (r.bodyFat) drawInfoRow(doc, '체지방률', `${r.bodyFat}%`, midX, y - 6.5, pw / 2 - 10);
    y += 1;
    if (r.aiFeedback) y = drawTextBox(doc, `💬 ${r.aiFeedback}`, leftX, y, pw - 25, C.palePurple);
    if (r.aiDirection) y = drawTextBox(doc, `🚀 ${r.aiDirection}`, leftX, y, pw - 25, [236, 253, 245]);
    y += 2;
  }

  drawFooter(doc);
  doc.save(`BAVA_${customer.name}_종합관리리포트.pdf`);
}

// ── 이미지 URL을 base64로 변환 ──
async function loadImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
