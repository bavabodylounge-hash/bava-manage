import { NextResponse } from 'next/server';

// Firebase 연결 진단 엔드포인트 (firebase-admin 없이 순수 진단만)
export async function GET() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bava-body-lounge';
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    projectId,
    env: {
      apiKey: apiKey ? '✅ 설정됨' : '❌ 없음',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ 설정됨' : '❌ 없음',
      appId: appId ? '✅ 설정됨' : '❌ 없음',
    },
    diagnosis: {
      problem: '저장 시 무한 대기 (Firebase 응답 없음)',
      causes: [
        'App Check가 Firestore를 Enforced 모드로 차단 중',
        'Firestore 보안 규칙이 쓰기를 거부 중',
      ],
      solutions: [
        {
          step: 1,
          title: 'App Check Unenforce',
          path: 'Firebase 콘솔 → App Check → APIs 탭',
          action: 'firestore.googleapis.com 우측 ⋮ → Unenforce 클릭',
        },
        {
          step: 2,
          title: 'Firestore 보안 규칙 수정',
          path: 'Firebase 콘솔 → Firestore Database → 규칙',
          rule: 'allow read, write: if true;',
        },
      ],
    },
  });
}
