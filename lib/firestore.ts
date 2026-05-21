import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, Timestamp, deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Customer, MonthlyReport } from '@/types';

// ──────────────── 고객 CRUD ────────────────
export async function createCustomer(data: Omit<Customer, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'bava_customers'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
  await updateDoc(doc(db, 'bava_customers', id), data);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  try {
    const snap = await getDoc(doc(db, 'bava_customers', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Customer;
  } catch (e) {
    console.error('getCustomer error:', e);
    return null;
  }
}

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    // orderBy 없이 단순 조회 후 메모리 정렬 (인덱스 불필요)
    const snap = await getDocs(collection(db, 'bava_customers'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
    // createdAt 기준 내림차순 정렬
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
  await deleteDoc(doc(db, 'bava_customers', id));
}

// undefined 필드 제거 (Firestore는 undefined 저장 불가)
function cleanData<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

// ──────────────── 월별 리포트 CRUD ────────────────
export async function createReport(data: Omit<MonthlyReport, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'bava_reports'), {
    ...cleanData(data as unknown as Record<string, unknown>),
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateReport(id: string, data: Partial<MonthlyReport>): Promise<void> {
  await updateDoc(doc(db, 'bava_reports', id), data);
}

export async function getReport(id: string): Promise<MonthlyReport | null> {
  try {
    const snap = await getDoc(doc(db, 'bava_reports', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as MonthlyReport;
  } catch (e) {
    console.error('getReport error:', e);
    return null;
  }
}

export async function getCustomerReports(customerId: string): Promise<MonthlyReport[]> {
  try {
    // where만 사용 (orderBy 제거 → 복합 인덱스 불필요)
    const snap = await getDocs(
      query(
        collection(db, 'bava_reports'),
        where('customerId', '==', customerId)
      )
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyReport));
    // reportMonth 기준 오름차순 메모리 정렬
    list.sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));
    return list;
  } catch (e) {
    console.error('getCustomerReports error:', e);
    return [];
  }
}

export async function getAllReports(): Promise<MonthlyReport[]> {
  try {
    const snap = await getDocs(collection(db, 'bava_reports'));
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
