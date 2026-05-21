import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, Timestamp, deleteDoc, setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Customer, MonthlyReport } from '@/types';

// ──────────────── Promise 타임아웃 유틸 ────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[TIMEOUT] ${label} — ${ms}ms 초과`)), ms)
    ),
  ]);
}

// ──────────────── 고객 CRUD ────────────────
export async function createCustomer(data: Omit<Customer, 'id' | 'createdAt'>): Promise<string> {
  console.log('[createCustomer] 시작:', data.name);

  // undefined 필드 제거 (Firestore는 undefined 저장 불가)
  const cleanedData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  console.log('[createCustomer] 정제된 데이터:', JSON.stringify(cleanedData));

  try {
    const ref = await withTimeout(
      addDoc(collection(db, 'bava_customers'), {
        ...cleanedData,
        createdAt: Timestamp.now(),
      }),
      15000,
      'createCustomer addDoc'
    );
    console.log('[createCustomer] 성공! id:', ref.id);
    return ref.id;
  } catch (err) {
    console.error('[createCustomer] 에러 상세:', err);
    // App Check 에러 감지
    if (String(err).includes('app-check') || String(err).includes('AppCheck') || String(err).includes('UNAUTHENTICATED')) {
      throw new Error('Firebase App Check 오류: Firebase 콘솔에서 Firestore의 App Check를 비활성화해야 합니다.');
    }
    if (String(err).includes('PERMISSION_DENIED') || String(err).includes('permission-denied')) {
      throw new Error('Firebase 권한 오류: Firestore 보안 규칙을 확인하세요.\n\nFirebase 콘솔 → Firestore → 규칙에서\nallow read, write: if true; 로 설정하세요.');
    }
    if (String(err).includes('TIMEOUT')) {
      throw new Error('Firebase 응답 없음 (15초 초과).\n\n원인 1: App Check가 Firestore에 Enforce 중\n원인 2: Firestore 보안 규칙이 쓰기를 차단\n\n→ Firebase 콘솔에서 확인하세요.');
    }
    throw err;
  }
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
  await withTimeout(
    updateDoc(doc(db, 'bava_customers', id), data),
    10000,
    'updateCustomer'
  );
}

export async function getCustomer(id: string): Promise<Customer | null> {
  try {
    const snap = await withTimeout(
      getDoc(doc(db, 'bava_customers', id)),
      10000,
      'getCustomer'
    );
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Customer;
  } catch (e) {
    console.error('getCustomer error:', e);
    return null;
  }
}

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const snap = await withTimeout(
      getDocs(collection(db, 'bava_customers')),
      10000,
      'getAllCustomers'
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
    list.sort((a, b) => {
      const aTime = (a.createdAt as unknown as { seconds: number })?.seconds ?? 0;
      const bTime = (b.createdAt as unknown as { seconds: number })?.seconds ?? 0;
      return bTime - aTime;
    });
    return list;
  } catch (e) {
    console.error('getAllCustomers error:', e);
    return [];
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  await withTimeout(
    deleteDoc(doc(db, 'bava_customers', id)),
    10000,
    'deleteCustomer'
  );
}

// undefined 필드 제거 (Firestore는 undefined 저장 불가)
function cleanData<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

// ──────────────── 월별 리포트 CRUD ────────────────
export async function createReport(data: Omit<MonthlyReport, 'id' | 'createdAt'>): Promise<string> {
  const ref = await withTimeout(
    addDoc(collection(db, 'bava_reports'), {
      ...cleanData(data as unknown as Record<string, unknown>),
      createdAt: Timestamp.now(),
    }),
    15000,
    'createReport'
  );
  return ref.id;
}

export async function updateReport(id: string, data: Partial<MonthlyReport>): Promise<void> {
  await withTimeout(
    updateDoc(doc(db, 'bava_reports', id), data),
    10000,
    'updateReport'
  );
}

export async function getReport(id: string): Promise<MonthlyReport | null> {
  try {
    const snap = await withTimeout(
      getDoc(doc(db, 'bava_reports', id)),
      10000,
      'getReport'
    );
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as MonthlyReport;
  } catch (e) {
    console.error('getReport error:', e);
    return null;
  }
}

export async function getCustomerReports(customerId: string): Promise<MonthlyReport[]> {
  try {
    const snap = await withTimeout(
      getDocs(
        query(
          collection(db, 'bava_reports'),
          where('customerId', '==', customerId)
        )
      ),
      10000,
      'getCustomerReports'
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyReport));
    list.sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));
    return list;
  } catch (e) {
    console.error('getCustomerReports error:', e);
    return [];
  }
}

export async function getAllReports(): Promise<MonthlyReport[]> {
  try {
    const snap = await withTimeout(
      getDocs(collection(db, 'bava_reports')),
      10000,
      'getAllReports'
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyReport));
    list.sort((a, b) => {
      const aTime = (a.createdAt as unknown as { seconds: number })?.seconds ?? 0;
      const bTime = (b.createdAt as unknown as { seconds: number })?.seconds ?? 0;
      return bTime - aTime;
    });
    return list;
  } catch (e) {
    console.error('getAllReports error:', e);
    return [];
  }
}
