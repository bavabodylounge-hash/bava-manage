/**
 * Firestore REST API 클라이언트
 * App Check 우회: 브라우저 → Next.js API Route → Firestore REST API
 * 
 * App Check는 Firebase JS SDK (브라우저)에만 적용됨.
 * Next.js 서버에서 REST API를 직접 호출하면 App Check 토큰 불필요.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bava-body-lounge';
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCNnzs1GtKhbSnZW68xWKTZkbpfXW0ZipU';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ──────────────── Firestore 값 변환 유틸 ────────────────

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

/** JS 값 → Firestore 타입 변환 */
function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/** Firestore 타입 → JS 값 변환 */
function fromFirestoreValue(val: FirestoreValue): unknown {
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

/** JS 객체 → Firestore fields 변환 */
export function toFirestoreFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return fields;
}

/** Firestore 문서 → JS 객체 변환 */
export function fromFirestoreDoc(doc: {
  name: string;
  fields?: Record<string, FirestoreValue>;
}): Record<string, unknown> {
  const id = doc.name.split('/').pop()!;
  const data: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = fromFirestoreValue(v);
  }
  return data;
}

// ──────────────── REST API 호출 ────────────────

async function firestoreRequest(
  path: string,
  method: string,
  body?: unknown
): Promise<unknown> {
  const url = `${BASE_URL}/${path}?key=${API_KEY}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json() as { error?: { status: string; message: string } };
  if (!res.ok) {
    const err = json.error;
    throw new Error(`Firestore REST Error [${err?.status}]: ${err?.message}`);
  }
  return json;
}

/** 컬렉션에 문서 추가 (POST → auto-generated ID) */
export async function restAddDoc(
  collectionPath: string,
  data: Record<string, unknown>
): Promise<string> {
  const fields = toFirestoreFields(data);
  const result = await firestoreRequest(collectionPath, 'POST', { fields }) as { name: string };
  return result.name.split('/').pop()!;
}

/** 특정 문서 가져오기 */
export async function restGetDoc(
  collectionPath: string,
  docId: string
): Promise<Record<string, unknown> | null> {
  try {
    const result = await firestoreRequest(`${collectionPath}/${docId}`, 'GET') as {
      name: string;
      fields?: Record<string, FirestoreValue>;
    };
    return fromFirestoreDoc(result);
  } catch (e) {
    if (String(e).includes('NOT_FOUND')) return null;
    throw e;
  }
}

/** 문서 업데이트 (PATCH) */
export async function restUpdateDoc(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const fields = toFirestoreFields(data);
  const fieldPaths = Object.keys(fields).join(',');
  await firestoreRequest(
    `${collectionPath}/${docId}?updateMask.fieldPaths=${fieldPaths}`,
    'PATCH',
    { fields }
  );
}

/** 문서 삭제 */
export async function restDeleteDoc(
  collectionPath: string,
  docId: string
): Promise<void> {
  await firestoreRequest(`${collectionPath}/${docId}`, 'DELETE');
}

/** 컬렉션 전체 조회 */
export async function restGetCollection(
  collectionPath: string
): Promise<Record<string, unknown>[]> {
  const result = await firestoreRequest(collectionPath, 'GET') as {
    documents?: Array<{ name: string; fields?: Record<string, FirestoreValue> }>;
  };
  if (!result.documents) return [];
  return result.documents.map(fromFirestoreDoc);
}

/** 쿼리 (where 조건) */
export async function restQuery(
  collectionPath: string,
  fieldPath: string,
  value: string
): Promise<Record<string, unknown>[]> {
  const parts = collectionPath.split('/');
  const collectionId = parts[parts.length - 1];
  const parentPath = parts.slice(0, -1).join('/');

  const queryUrl = parentPath
    ? `${BASE_URL.replace('/documents', '')}/documents/${parentPath}:runQuery?key=${API_KEY}`
    : `${BASE_URL.replace('/documents', '')}/documents:runQuery?key=${API_KEY}`;

  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op: 'EQUAL',
          value: { stringValue: value },
        },
      },
    },
  };

  const res = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = await res.json() as Array<{
    document?: { name: string; fields?: Record<string, FirestoreValue> };
  }>;

  return json
    .filter(item => item.document)
    .map(item => fromFirestoreDoc(item.document!));
}
