import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const body = await req.json();
    const { customer, report, allReports, mode } = body;

    if (mode === 'monthly') {
      // 사진 URL 수집 (비포/애프터 최대 6장)
      const photoUrls: string[] = [];
      if (report.beforeFrontUrl) photoUrls.push(report.beforeFrontUrl);
      if (report.beforeSideUrl) photoUrls.push(report.beforeSideUrl);
      if (report.beforeBackUrl) photoUrls.push(report.beforeBackUrl);
      if (report.afterFrontUrl) photoUrls.push(report.afterFrontUrl);
      if (report.afterSideUrl) photoUrls.push(report.afterSideUrl);
      if (report.afterBackUrl) photoUrls.push(report.afterBackUrl);

      const hasPhotos = photoUrls.length > 0;
      const promptText = buildMonthlyPrompt(customer, report, allReports, hasPhotos);

      const systemPrompt = `당신은 BAVA BODY LOUNGE의 전문 바디케어 코치이자 체형 분석 전문가입니다.
고객의 비포/애프터 사진과 측정 데이터를 분석하여 전문적이고 따뜻한 피드백을 제공합니다.

[분석 기준]
- 한국인 표준 BMI: 저체중 <18.5 / 정상 18.5~22.9 / 과체중 23~24.9 / 비만 25 이상
- 한국인 여성 표준 체지방률: 정상 18~28% / 과체중 28~33% / 비만 33% 이상
- 한국인 남성 표준 체지방률: 정상 10~20% / 과체중 20~25% / 비만 25% 이상

[사진 분석 시 확인 항목]
- 전체적인 체형 변화 (비포 vs 애프터 비교)
- 복부/허리 라인 변화
- 어깨/등 자세 (굽은 등, 거북목, 골반 틀어짐 등)
- 하체 균형 (O자/X자 다리, 골반 좌우 불균형 등)
- 근육 발달 정도

[피드백 원칙]
- 한국어로 작성, 고객 이름을 친근하게 부름
- 구체적인 수치 변화 언급
- 사진에서 보이는 자세/체형 개선점 포함
- 긍정적이고 동기부여가 되는 톤
- 실천 가능한 구체적인 제안`;

      let userContent: OpenAI.Chat.ChatCompletionContentPart[] | string;

      if (hasPhotos) {
        // Vision API: 텍스트 + 사진
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
        max_tokens: 1500,
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
            content: `당신은 BAVA BODY LOUNGE의 전문 바디케어 코치입니다.
고객의 전체 관리 기간 데이터를 종합적으로 분석하여 총평과 앞으로의 독립적인 관리 방법을 제시합니다.
- 한국어로 작성, 고객 이름을 따뜻하게 부름
- 전체 변화 여정을 구체적으로 요약
- 독립 후 유지 방법 구체적으로 제안
- 응원과 격려의 메시지 포함`,
          },
          { role: 'user', content: buildFinalPrompt(customer, allReports) },
        ],
        max_tokens: 1800,
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
    ? `이전 달(${prevReport.reportMonth}) ${prevReport.weight}kg → 이번 달 ${report.weight}kg (${Number(report.weight) - Number(prevReport.weight) > 0 ? '+' : ''}${(Number(report.weight) - Number(prevReport.weight)).toFixed(1)}kg)`
    : `현재 체중: ${report.weight}kg (첫 번째 리포트)`;

  // BMI 계산
  let bmiInfo = '';
  if (report.height && report.weight) {
    const bmi = Number(report.weight) / Math.pow(Number(report.height) / 100, 2);
    const bmiCategory = bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만';
    bmiInfo = `- BMI: ${bmi.toFixed(1)} (${bmiCategory}) [한국인 기준]`;
  }

  const photoInfo = hasPhotos
    ? `\n[사진 분석 요청]\n첨부된 비포/애프터 사진을 분석하여 체형 변화, 자세 개선 여부, 특이사항을 피드백에 포함해주세요.`
    : '';

  return `
[고객 정보]
- 이름: ${customer.name} (${customer.gender === 'female' ? '여성' : '남성'})
- 목표: ${customer.goal}
- 성향: ${customer.personality || report.personality}
- 관리 시작일: ${customer.startDate}
- 누적 관리 월수: ${allReports.length}개월
- 특이사항: ${customer.notes || '없음'}

[이번 달 (${report.reportMonth}) 측정 데이터]
- 체중 변화: ${weightChange}
${report.height ? `- 키: ${report.height}cm` : ''}
${bmiInfo}
${report.bodyFat ? `- 체지방률: ${report.bodyFat}% (${customer.gender === 'female' ? '여성 정상 18~28%' : '남성 정상 10~20%'} 기준)` : ''}
${report.muscleMass ? `- 근육량: ${report.muscleMass}kg` : ''}
- 이번 달 메모: ${report.monthlyNote || '없음'}
${photoInfo}
${allReports.length > 1 ? `\n[전체 체중 변화 추이]\n${allReports.map((r: Record<string, unknown>) => `${r.reportMonth}: ${r.weight}kg`).join(' → ')}` : ''}

위 데이터를 바탕으로 아래 두 가지를 작성해주세요:

[이번 달 코멘트]
(고객에게 직접 전달하는 피드백. 수치 변화 + 사진 기반 체형/자세 분석 포함, 4~5문장)

[다음 달 방향성]
(구체적인 운동 방법, 식단 제안, 자세 교정 포인트 등 4~5가지 항목으로 작성)
`.trim();
}

function buildFinalPrompt(customer: Record<string, unknown>, allReports: Record<string, unknown>[]): string {
  const firstReport = allReports[0];
  const lastReport = allReports[allReports.length - 1];
  const totalChange = lastReport && firstReport
    ? Number(lastReport.weight) - Number(firstReport.weight)
    : 0;

  return `
[고객 정보]
- 이름: ${customer.name} (${customer.gender === 'female' ? '여성' : '남성'})
- 목표: ${customer.goal}
- 성향: ${customer.personality}
- 관리 시작일: ${customer.startDate}
- 관리 종료일: ${customer.endDate}
- 총 관리 기간: ${allReports.length}개월
- 특이사항: ${customer.notes || '없음'}

[전체 체중 변화 이력]
${allReports.map((r: Record<string, unknown>) => `${r.reportMonth}: ${r.weight}kg`).join('\n')}

[총 변화]
- 시작: ${firstReport?.weight}kg → 종료: ${lastReport?.weight}kg
- 총 변화량: ${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)}kg

[월별 메모 요약]
${allReports.map((r: Record<string, unknown>) => `${r.reportMonth}: ${r.monthlyNote || '기록 없음'}`).join('\n')}

아래 두 가지를 작성해주세요:

[전체 관리 총평]
(전체 여정 총평, 변화에 대한 구체적인 칭찬, 4~5문장)

[앞으로의 독립 관리 방향]
(BAVA 졸업 후 스스로 관리하는 방법, 운동/식단/생활습관 5가지 항목)
`.trim();
}

function splitFeedbackAndDirection(text: string): [string, string] {
  const directionMarkers = ['[다음 달 방향성]', '다음 달 방향성', '**다음 달', '## 다음 달'];
  for (const marker of directionMarkers) {
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
