/**
 * Firebase Admin SDK - 서버 전용
 * 보안 규칙 완전 무시, App Check 무관
 */
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let adminDb: Firestore;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  // 환경변수에서 서비스 계정 키 읽기
  const serviceAccountJson = process.env.FIREBASE_ADMIN_SDK_JSON;
  
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // fallback: 개별 환경변수
    const projectId     = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bava-body-lounge';
    const clientEmail   = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey    = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (clientEmail && privateKey) {
      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      // 마지막 fallback: Application Default Credentials
      adminApp = initializeApp({ projectId });
    }
  }

  return adminApp;
}

export function getAdminDb(): Firestore {
  if (adminDb) return adminDb;
  getAdminApp();
  adminDb = getFirestore();
  return adminDb;
}
