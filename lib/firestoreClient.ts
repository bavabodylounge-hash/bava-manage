/**
 * 브라우저 클라이언트용 Firestore 프록시 클라이언트
 * /api/firestore 서버 라우트를 통해 App Check 우회
 */

async function callFirestore<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/firestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json() as { error?: string } & T;

  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

// ──────────────── 고객 CRUD ────────────────
import { Customer, MonthlyReport } from '@/types';

export async function createCustomer(
  data: Omit<Customer, 'id' | 'createdAt'>
): Promise<string> {
  // undefined 제거
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  const result = await callFirestore<{ id: string }>({
    action: 'add',
    collection: 'bava_customers',
    data: clean,
  });
  return result.id;
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  await callFirestore({
    action: 'update',
    collection: 'bava_customers',
    docId: id,
    data: clean,
  });
}

export async function getCustomer(id: string): Promise<Customer | null> {
  try {
    const doc = await callFirestore<Customer>({
      action: 'get',
      collection: 'bava_customers',
      docId: id,
    });
    return doc;
  } catch (e) {
    if (String(e).includes('not found')) return null;
    console.error('getCustomer error:', e);
    return null;
  }
}

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const result = await callFirestore<{ docs: Customer[] }>({
      action: 'getAll',
      collection: 'bava_customers',
    });
    const list = result.docs || [];
    list.sort((a, b) => {
      const aTime = typeof a.createdAt === 'string' ? a.createdAt : '';
      const bTime = typeof b.createdAt === 'string' ? b.createdAt : '';
      return bTime.localeCompare(aTime);
    });
    return list;
  } catch (e) {
    console.error('getAllCustomers error:', e);
    return [];
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  await callFirestore({
    action: 'delete',
    collection: 'bava_customers',
    docId: id,
  });
}

// ──────────────── 월별 리포트 CRUD ────────────────

function cleanData<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export async function createReport(
  data: Omit<MonthlyReport, 'id' | 'createdAt'>
): Promise<string> {
  const result = await callFirestore<{ id: string }>({
    action: 'add',
    collection: 'bava_reports',
    data: cleanData(data as unknown as Record<string, unknown>),
  });
  return result.id;
}

export async function updateReport(id: string, data: Partial<MonthlyReport>): Promise<void> {
  await callFirestore({
    action: 'update',
    collection: 'bava_reports',
    docId: id,
    data: cleanData(data as unknown as Record<string, unknown>),
  });
}

export async function getReport(id: string): Promise<MonthlyReport | null> {
  try {
    const doc = await callFirestore<MonthlyReport>({
      action: 'get',
      collection: 'bava_reports',
      docId: id,
    });
    return doc;
  } catch (e) {
    if (String(e).includes('not found')) return null;
    console.error('getReport error:', e);
    return null;
  }
}

export async function getCustomerReports(customerId: string): Promise<MonthlyReport[]> {
  try {
    const result = await callFirestore<{ docs: MonthlyReport[] }>({
      action: 'query',
      collection: 'bava_reports',
      where: { field: 'customerId', value: customerId },
    });
    const list = result.docs || [];
    list.sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));
    return list;
  } catch (e) {
    console.error('getCustomerReports error:', e);
    return [];
  }
}

export async function getAllReports(): Promise<MonthlyReport[]> {
  try {
    const result = await callFirestore<{ docs: MonthlyReport[] }>({
      action: 'getAll',
      collection: 'bava_reports',
    });
    const list = result.docs || [];
    list.sort((a, b) => {
      const aTime = typeof a.createdAt === 'string' ? a.createdAt : '';
      const bTime = typeof b.createdAt === 'string' ? b.createdAt : '';
      return bTime.localeCompare(aTime);
    });
    return list;
  } catch (e) {
    console.error('getAllReports error:', e);
    return [];
  }
}
