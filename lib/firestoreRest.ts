/**
 * Firestore REST API 클라이언트
 * App Check 우회: 브라우저 → Next.js API Route → Firestore REST API
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bava-body-lounge';
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY    || 'AIzaSyCNnzs1GtKhbSnZW68xWKTZkbpfXW0ZipU';
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ──────────────── Firestore 타입 정의 ────────────────

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

interface FirestoreDoc {
  name: string;
  fields?: Record<string, FirestoreValue>;
}

// ──────────────── 타입 변환 ────────────────

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

function fromFirestoreValue(val: FirestoreValue): unknown {
  if ('nullValue'      in val) return null;
  if ('booleanValue'   in val) return val.booleanValue;
  if ('integerValue'   in val) return parseInt(val.integerValue);
  if ('doubleValue'    in val) return val.doubleValue;
  if ('stringValue'    in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue'     in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue'       in val) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

export function toFirestoreFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return fields;
}

export function fromFirestoreDoc(doc: FirestoreDoc): Record<string, unknown> {
  const id = doc.name.split('/').pop()!;
  const data: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = fromFirestoreValue(v);
  }
  return data;
}

// ──────────────── HTTP 요청 ────────────────

async function firestoreRequest(
  fullUrl: string,
  method: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(fullUrl, {
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

/** URL 생성 헬퍼 */
function docUrl(collection: string, docId?: string, params?: Record<string, string>) {
  const base = docId
    ? `${BASE_URL}/${collection}/${docId}`
    : `${BASE_URL}/${collection}`;
  const qs = new URLSearchParams({ key: API_KEY, ...(params || {}) });
  return `${base}?${qs.toString()}`;
}

// ──────────────── CRUD 함수 ────────────────

/** 문서 추가 (auto-ID) */
export async function restAddDoc(
  collection: string,
  data: Record<string, unknown>
): Promise<string> {
  const url = docUrl(collection);
  const result = await firestoreRequest(url, 'POST', {
    fields: toFirestoreFields(data),
  }) as FirestoreDoc;
  return result.name.split('/').pop()!;
}

/** 문서 단건 조회 */
export async function restGetDoc(
  collection: string,
  docId: string
): Promise<Record<string, unknown> | null> {
  try {
    const url = docUrl(collection, docId);
    const result = await firestoreRequest(url, 'GET') as FirestoreDoc;
    return fromFirestoreDoc(result);
  } catch (e) {
    if (String(e).includes('NOT_FOUND')) return null;
    throw e;
  }
}

/** 문서 업데이트 (PATCH) */
export async function restUpdateDoc(
  collection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const fields = toFirestoreFields(data);
  const fieldPaths = Object.keys(fields);
  const params: Record<string, string> = {};
  // updateMask는 반복 파라미터 → URLSearchParams는 마지막만 유지하므로 수동 처리
  const maskQs = fieldPaths.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${BASE_URL}/${collection}/${docId}?key=${API_KEY}&${maskQs}`;
  await firestoreRequest(url, 'PATCH', { fields });
}

/** 문서 삭제 */
export async function restDeleteDoc(
  collection: string,
  docId: string
): Promise<void> {
  const url = docUrl(collection, docId);
  await firestoreRequest(url, 'DELETE');
}

/** 컬렉션 전체 조회 */
export async function restGetCollection(
  collection: string
): Promise<Record<string, unknown>[]> {
  const url = docUrl(collection);
  const result = await firestoreRequest(url, 'GET') as {
    documents?: FirestoreDoc[];
  };
  if (!result.documents) return [];
  return result.documents.map(fromFirestoreDoc);
}

/** where 단일 조건 쿼리 */
export async function restQuery(
  collection: string,
  fieldPath: string,
  value: string
): Promise<Record<string, unknown>[]> {
  // runQuery 엔드포인트: /documents:runQuery (프로젝트 루트 기준)
  const url = `${BASE_URL}:runQuery?key=${API_KEY}`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op: 'EQUAL',
          value: { stringValue: value },
        },
      },
    },
  };

  const results = await firestoreRequest(url, 'POST', body) as Array<{
    document?: FirestoreDoc;
  }>;

  return results
    .filter(item => item.document)
    .map(item => fromFirestoreDoc(item.document!));
}
