import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const body = await req.json();
    const { customer, report, allReports, mode } = body;

    if (mode === 'monthly') {
      // 모든 프로그램의 사진 URL 수집 (비포/애프터 최대 6장)
      const photoUrls: string[] = [];
      const reportPrograms: Record<string, unknown>[] = report.programs ?? [];

      for (const prog of reportPrograms) {
        if (prog.beforeFrontUrl) photoUrls.push(prog.beforeFrontUrl as string);
        if (prog.beforeSideUrl)  photoUrls.push(prog.beforeSideUrl as string);
        if (prog.beforeBackUrl)  photoUrls.push(prog.beforeBackUrl as string);
        if (prog.afterFrontUrl)  photoUrls.push(prog.afterFrontUrl as string);
        if (prog.afterSideUrl)   photoUrls.push(prog.afterSideUrl as string);
        if (prog.afterBackUrl)   photoUrls.push(prog.afterBackUrl as string);
      }
      // 레거시 호환: 최상위 레벨 사진 필드도 체크
      if (!photoUrls.length) {
        if (report.beforeFrontUrl) photoUrls.push(report.beforeFrontUrl);
        if (report.beforeSideUrl)  photoUrls.push(report.beforeSideUrl);
        if (report.beforeBackUrl)  photoUrls.push(report.beforeBackUrl);
        if (report.afterFrontUrl)  photoUrls.push(report.afterFrontUrl);
        if (report.afterSideUrl)   photoUrls.push(report.afterSideUrl);
        if (report.afterBackUrl)   photoUrls.push(report.afterBackUrl);
      }

      const hasPhotos = photoUrls.length > 0;
      const promptText = buildMonthlyPrompt(customer, report, allReports, hasPhotos);

      // ★ 업그레이드된 시스템 프롬프트: 전문 운동처방 + 자세분석
      const systemPrompt = `당신은 BAVA BODY LOUNGE의 수석 바디케어 전문가이자 운동처방사(NSCA-CPT 취득)입니다.
체형 교정, 재활 운동, 영양 상담을 전문으로 하며 비포/애프터 사진을 통해 구체적인 자세 변화를 분석합니다.

[전문 분석 기준]
■ 체성분
- 한국인 BMI: 저체중 <18.5 / 정상 18.5~22.9 / 과체중 23~24.9 / 비만 ≥25
- 여성 체지방률: 정상 18~28% / 과체중 28~33% / 비만 33% 이상
- 남성 체지방률: 정상 10~20% / 과체중 20~25% / 비만 25% 이상
- 근육량 변화: 동일 체중이라도 체지방 감소 + 근육량 증가면 리컴포지션 성공

■ 사진 분석 시 반드시 확인할 항목
① 전신 체형 변화 (비포 vs 애프터 세밀 비교)
   - 복부/허리 라인 슬리밍 정도
   - 엉덩이(힙업) 및 하체 라인 변화
   - 상체/팔뚝 슬리밍 또는 근육 발달
② 자세 교정 상태 (매우 중요)
   - 경추/흉추 자세: 전방두부자세(거북목), 흉추후만증(굽은등), 견봉 높이 차이(어깨 불균형)
   - 요추/골반: 골반전방경사(허리굴곡 과도), 골반후방경사(납작엉덩이), 좌우 골반 틀어짐
   - 하지 정렬: 무릎 과신전, O형다리/X형다리, 발목 내/외번
   - 코어 안정성: 복부 긴장도, 요추 안정화 능력
③ 근육 발달 정도
   - 사두근/햄스트링 균형
   - 코어(복직근, 복횡근) 발달
   - 상체(삼각근, 승모근, 배면) 발달

[운동 처방 원칙]
- 구체적인 운동 종목 + 세트 × 반복 × 강도 명시
- 자세 교정 필요 시: 교정 운동(Corrective Exercise) 우선 처방
- 약한 근육군 강화: 길항근 균형 운동 포함
- 예시: "루마니안 데드리프트 3세트 × 12회(체중의 50%) → 햄스트링 강화 및 골반 안정화"

[피드백 원칙]
- 한국어, 고객 이름을 친근하게 사용
- 사진에서 확인되는 변화를 구체적으로 기술 (모호한 표현 금지)
- 매니저 메모(성향/특이사항)를 적극 반영하여 개인 맞춤형으로 작성
- 동기부여가 되는 전문적이고 따뜻한 어조
- 수치 변화 + 시각적 변화 + 운동 처방의 3박자 구성`;

      let userContent: OpenAI.Chat.ChatCompletionContentPart[] | string;

      if (hasPhotos) {
        const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [
          { type: 'text', text: promptText }
        ];
        for (const url of photoUrls) {
          contentParts.push({
            type: 'image_url',
            image_url: { url, detail: 'high' }
          });
        }
        userContent = contentParts;
      } else {
        userContent = promptText;
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      const text = completion.choices[0].message.content || '';
      const [feedbackPart, directionPart] = splitFeedbackAndDirection(text);
      return NextResponse.json({ feedback: feedbackPart, direction: directionPart });

    } else if (mode === 'final') {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `당신은 BAVA BODY LOUNGE의 수석 바디케어 전문가입니다.
고객의 전체 관리 기간 데이터를 종합적으로 분석하여 최종 평가 리포트를 작성합니다.

[총평 작성 기준]
- 전체 체중·체지방·근육량 변화를 기간별로 구체적으로 서술
- 월별 특이사항(메모)을 시간순으로 반영
- 가장 큰 성과 구간을 칭찬하고, 정체 구간의 원인 분석
- 졸업 후 독립 관리 방법을 운동/식단/생활습관으로 세분화하여 구체적으로 제시
- 한국어, 따뜻하고 전문적인 어조`,
          },
          { role: 'user', content: buildFinalPrompt(customer, allReports) },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      const text = completion.choices[0].message.content || '';
      const [summaryPart, recommendationPart] = splitSummaryAndRecommendation(text);
      return NextResponse.json({ summary: summaryPart, recommendation: recommendationPart });
    }

    return NextResponse.json({ error: 'invalid mode' }, { status: 400 });

  } catch (err: unknown) {
    console.error('AI feedback error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildMonthlyPrompt(
  customer: Record<string, unknown>,
  report: Record<string, unknown>,
  allReports: Record<string, unknown>[],
  hasPhotos: boolean
): string {
  const prevReport = allReports.length > 1 ? allReports[allReports.length - 2] : null;
  const weightChange = prevReport
    ? `이전 달(${prevReport.reportMonth}) ${prevReport.weight}kg → 이번 달 ${report.weight}kg (${Number(report.weight) - Number(prevReport.weight) > 0 ? '+' : ''}${(Number(report.weight) - Number(prevReport.weight)).toFixed(1)}kg 변화)`
    : `현재 체중: ${report.weight}kg (첫 번째 리포트)`;

  // BMI 계산
  let bmiInfo = '';
  if (report.height && report.weight) {
    const bmi = Number(report.weight) / Math.pow(Number(report.height) / 100, 2);
    const bmiCategory = bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만';
    bmiInfo = `- BMI: ${bmi.toFixed(1)} (${bmiCategory}) [한국인 기준]`;
  }

  // 체지방률 변화
  let fatChange = '';
  if (prevReport?.bodyFat && report.bodyFat) {
    const diff = Number(report.bodyFat) - Number(prevReport.bodyFat);
    fatChange = ` (전월 대비 ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%)`;
  }

  // 근육량 변화
  let muscleChange = '';
  if (prevReport?.muscleMass && report.muscleMass) {
    const diff = Number(report.muscleMass) - Number(prevReport.muscleMass);
    muscleChange = ` (전월 대비 ${diff > 0 ? '+' : ''}${diff.toFixed(1)}kg)`;
  }

  // 프로그램 정보 (programs 배열 기반)
  const programs: Record<string, unknown>[] = (report.programs as Record<string, unknown>[]) ?? [];
  const programInfo = programs.length > 0
    ? programs.map((p: Record<string, unknown>) =>
        `${p.programLabel}: ${p.currentSession}회차 완료, 잔여 ${p.remainingSessions}회`
      ).join(' / ')
    : '프로그램 정보 없음';

  // 인치 변화 (바디관리 전용)
  const inchChanges: string[] = [];
  for (const prog of programs) {
    if (prog.programType === 'bodyManage') {
      if (prog.inchLowerBefore != null && prog.inchLowerAfter != null) {
        const diff = Number(prog.inchLowerAfter) - Number(prog.inchLowerBefore);
        inchChanges.push(`하체 둘레: ${prog.inchLowerBefore}→${prog.inchLowerAfter}cm (${diff > 0 ? '+' : ''}${diff.toFixed(1)}cm)`);
      }
      if (prog.inchArmBefore != null && prog.inchArmAfter != null) {
        const diff = Number(prog.inchArmAfter) - Number(prog.inchArmBefore);
        inchChanges.push(`팔 둘레: ${prog.inchArmBefore}→${prog.inchArmAfter}cm (${diff > 0 ? '+' : ''}${diff.toFixed(1)}cm)`);
      }
      if (prog.inchAbdomenBefore != null && prog.inchAbdomenAfter != null) {
        const diff = Number(prog.inchAbdomenAfter) - Number(prog.inchAbdomenBefore);
        inchChanges.push(`복부 둘레: ${prog.inchAbdomenBefore}→${prog.inchAbdomenAfter}cm (${diff > 0 ? '+' : ''}${diff.toFixed(1)}cm)`);
      }
      if (prog.inchHipBefore != null && prog.inchHipAfter != null) {
        const diff = Number(prog.inchHipAfter) - Number(prog.inchHipBefore);
        inchChanges.push(`엉덩이: ${prog.inchHipBefore}→${prog.inchHipAfter}cm (${diff > 0 ? '+' : ''}${diff.toFixed(1)}cm)`);
      }
    }
  }

  const photoInstruction = hasPhotos
    ? `
[★ 사진 분석 필수 지시사항]
첨부된 비포/애프터 사진을 면밀히 비교 분석하여 다음 사항을 반드시 피드백에 포함하세요:
① 전신 체형 변화: 복부/허리/엉덩이/하체 라인의 구체적 변화 기술
② 자세 변화 분석: 거북목/굽은등/골반 틀어짐/다리 정렬 개선 여부를 전문 용어로 명시
③ 개선점 강조: 사진에서 눈에 띄게 좋아진 부위를 구체적으로 칭찬
④ 추가 교정 필요 부위: 아직 개선이 필요한 자세/체형 부위 1~2개 전문적으로 언급
※ "사진을 보면", "사진에서 확인되는" 등의 표현으로 사진 기반 분석임을 명시`
    : '(사진 없음 - 수치 데이터 기반으로만 분석)';

  return `
[고객 정보]
- 이름: ${customer.name} (${customer.gender === 'female' ? '여성' : '남성'})
- 목표: ${customer.goal}
- 관리 시작일: ${customer.startDate}
- 누적 관리: ${allReports.length}개월차
- 고객 성향: ${customer.personality || '기록 없음'}
- 고객 특이사항: ${customer.notes || '없음'}

[이번 달 (${report.reportMonth}) 측정 데이터]
- 체중 변화: ${weightChange}
${report.height ? `- 키: ${report.height}cm` : ''}
${bmiInfo}
${report.bodyFat ? `- 체지방률: ${report.bodyFat}%${fatChange} (${customer.gender === 'female' ? '여성 정상 18~28%' : '남성 정상 10~20%'} 기준)` : ''}
${report.muscleMass ? `- 근육량: ${report.muscleMass}kg${muscleChange}` : ''}
- 진행 프로그램: ${programInfo}
${inchChanges.length > 0 ? `- 인치 변화:\n  ${inchChanges.join('\n  ')}` : ''}
- 이번 달 매니저 메모: ${report.monthlyNote || '없음'}
- 이번 달 고객 성향 기록: ${report.personality || '없음'}
${photoInstruction}
${allReports.length > 1 ? `
[전체 체중 변화 추이]
${allReports.map((r: Record<string, unknown>) => `${r.reportMonth}: ${r.weight}kg${r.bodyFat ? ` (체지방 ${r.bodyFat}%)` : ''}`).join(' → ')}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
위 데이터와 사진을 바탕으로 아래 두 가지를 작성해주세요.
고객 성향(${report.personality || customer.personality || '기록 없음'})과 매니저 메모를 반드시 반영하여 개인 맞춤형으로 작성하세요.

[이번 달 코멘트]
(고객에게 직접 전달하는 전문적이고 따뜻한 피드백)
- 수치 변화 + 사진에서 보이는 체형/자세 변화를 구체적으로 언급 (4~5문장)
- 가장 개선된 부위를 칭찬하고, 아직 개선 중인 부분도 부드럽게 언급
- 고객 성향과 노력을 반영한 동기부여 메시지 포함

[다음 달 방향성]
(구체적인 운동 처방 + 식단 + 자세 교정 포인트)
① 집중 운동 처방: 종목명 + 세트/횟수 + 목적 (2~3개)
② 자세 교정 포인트: 개선이 필요한 자세 문제와 교정 운동 (1~2개)
③ 식단 가이드: 목표에 맞는 구체적 식단 팁 (1~2개)
④ 생활 습관: 일상에서 실천할 수 있는 팁 (1개)
`.trim();
}

function buildFinalPrompt(customer: Record<string, unknown>, allReports: Record<string, unknown>[]): string {
  const firstReport = allReports[0];
  const lastReport  = allReports[allReports.length - 1];
  const totalChange = lastReport && firstReport
    ? Number(lastReport.weight) - Number(firstReport.weight) : 0;

  // 체지방률 변화
  const fatChange = (firstReport?.bodyFat && lastReport?.bodyFat)
    ? Number(lastReport.bodyFat) - Number(firstReport.bodyFat) : null;

  // 근육량 변화
  const muscleChange = (firstReport?.muscleMass && lastReport?.muscleMass)
    ? Number(lastReport.muscleMass) - Number(firstReport.muscleMass) : null;

  // 월별 메모 요약
  const monthlyMemos = allReports
    .map((r: Record<string, unknown>) => `${r.reportMonth}: ${r.monthlyNote || r.personality || '기록 없음'}`)
    .join('\n');

  return `
[고객 정보]
- 이름: ${customer.name} (${customer.gender === 'female' ? '여성' : '남성'})
- 목표: ${customer.goal}
- 성향: ${customer.personality || '기록 없음'}
- 관리 시작일: ${customer.startDate} → 종료일: ${customer.endDate || '미정'}
- 총 관리 기간: ${allReports.length}개월
- 특이사항: ${customer.notes || '없음'}

[전체 체성분 변화]
- 체중: ${firstReport?.weight}kg → ${lastReport?.weight}kg (총 ${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)}kg)
${fatChange !== null ? `- 체지방률: ${firstReport?.bodyFat}% → ${lastReport?.bodyFat}% (${fatChange > 0 ? '+' : ''}${fatChange.toFixed(1)}%)` : ''}
${muscleChange !== null ? `- 근육량: ${firstReport?.muscleMass}kg → ${lastReport?.muscleMass}kg (${muscleChange > 0 ? '+' : ''}${muscleChange.toFixed(1)}kg)` : ''}

[월별 체중 변화 추이]
${allReports.map((r: Record<string, unknown>) => `${r.reportMonth}: ${r.weight}kg${r.bodyFat ? ` (체지방 ${r.bodyFat}%)` : ''}`).join(' → ')}

[월별 매니저 메모]
${monthlyMemos}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
고객의 전체 관리 여정을 종합적으로 분석하여 아래 두 가지를 작성해주세요.

[전체 관리 총평]
- 전체 기간 동안의 체성분 변화를 구체적인 수치와 함께 서술 (첫 달 대비 마지막 달)
- 특히 잘 이루어진 변화 구간을 강조하고 그 요인을 분석
- 고객의 성향과 노력을 반영한 진심 어린 칭찬 포함
- 정체 구간이 있었다면 그 원인과 극복 과정 언급
- (4~5문장, 전문적이고 따뜻한 어조)

[앞으로의 독립 관리 방향]
BAVA 졸업 후 스스로 관리하는 구체적인 방법을 5가지 항목으로:
① 주간 운동 루틴: 구체적 종목 + 빈도 + 세트/횟수
② 자세 유지 운동: 일상에서 할 수 있는 교정 운동
③ 식단 가이드: 목표 유지를 위한 장기 식단 전략
④ 생활 습관: 수면/스트레스 관리 등 라이프스타일
⑤ 자가 체크: 스스로 몸 상태를 모니터링하는 방법
`.trim();
}

function splitFeedbackAndDirection(text: string): [string, string] {
  const directionMarkers = ['[다음 달 방향성]', '다음 달 방향성', '**다음 달', '## 다음 달', '①'];
  // 방향성 섹션 찾기
  for (const marker of directionMarkers.slice(0, 4)) {
    const idx = text.indexOf(marker);
    if (idx > -1) {
      return [
        text.substring(0, idx).replace(/\[이번 달 코멘트\]/g, '').trim(),
        text.substring(idx).replace(marker, '').trim()
      ];
    }
  }
  const half = Math.floor(text.length / 2);
  const splitIdx = text.indexOf('\n\n', half);
  if (splitIdx > -1) return [text.substring(0, splitIdx).trim(), text.substring(splitIdx).trim()];
  return [text, ''];
}

function splitSummaryAndRecommendation(text: string): [string, string] {
  const markers = ['[앞으로의 독립 관리 방향]', '앞으로의 독립', '## 앞으로', '**앞으로'];
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx > -1) {
      return [
        text.substring(0, idx).replace(/\[전체 관리 총평\]/g, '').trim(),
        text.substring(idx).replace(marker, '').trim()
      ];
    }
  }
  const half = Math.floor(text.length / 2);
  const splitIdx = text.indexOf('\n\n', half);
  if (splitIdx > -1) return [text.substring(0, splitIdx).trim(), text.substring(splitIdx).trim()];
  return [text, ''];
}
