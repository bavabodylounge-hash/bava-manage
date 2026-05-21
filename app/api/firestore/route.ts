import { NextRequest, NextResponse } from 'next/server';
import {
  restAddDoc,
  restGetDoc,
  restGetCollection,
  restUpdateDoc,
  restDeleteDoc,
  restQuery,
} from '@/lib/firestoreRest';

// 환경변수 진단용 GET
export async function GET() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  // 실제 쓰기 시도해서 에러 메시지 확인
  let writeTest: string;
  try {
    const https = await import('https');
    const result = await new Promise<string>((resolve) => {
      const pid = projectId || 'bava-body-lounge';
      const key = apiKey    || 'AIzaSyCNnzs1GtKhbSnZW68xWKTZkbpfXW0ZipU';
      const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/bava_customers?key=${key}`;
      const body = JSON.stringify({ fields: { name: { stringValue: '_diag_test' }, createdAt: { timestampValue: new Date().toISOString() } } });
      const req = https.default.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let d = '';
        res.on('data', (c: Buffer) => d += c);
        res.on('end', () => {
          const j = JSON.parse(d) as { name?: string; error?: { status: string; message: string } };
          if (res.statusCode === 200) resolve('✅ OK id=' + j.name?.split('/').pop());
          else resolve(`❌ ${res.statusCode} ${j.error?.status}: ${j.error?.message}`);
        });
      });
      req.on('error', (e: Error) => resolve('❌ 네트워크 오류: ' + e.message));
      req.write(body);
      req.end();
    });
    writeTest = result;
  } catch (e) {
    writeTest = '❌ 예외: ' + String(e);
  }

  return NextResponse.json({
    env: {
      PROJECT_ID: projectId ? `✅ ${projectId}` : '❌ 없음 (fallback 사용)',
      API_KEY:    apiKey    ? `✅ ${apiKey.slice(0,8)}...` : '❌ 없음 (fallback 사용)',
    },
    writeTest,
    time: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: string;
      collection: string;
      docId?: string;
      data?: Record<string, unknown>;
      where?: { field: string; value: string };
    };
    const { action, collection, docId, data, where: whereClause } = body;

    switch (action) {
      case 'add': {
        if (!data) return NextResponse.json({ error: 'data required' }, { status: 400 });
        const id = await restAddDoc(collection, {
          ...data,
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ id });
      }
      case 'get': {
        if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 });
        const doc = await restGetDoc(collection, docId);
        if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });
        return NextResponse.json(doc);
      }
      case 'getAll': {
        const docs = await restGetCollection(collection);
        return NextResponse.json({ docs });
      }
      case 'query': {
        if (!whereClause) return NextResponse.json({ error: 'where required' }, { status: 400 });
        const docs = await restQuery(collection, whereClause.field, whereClause.value);
        return NextResponse.json({ docs });
      }
      case 'update': {
        if (!docId || !data) return NextResponse.json({ error: 'docId and data required' }, { status: 400 });
        await restUpdateDoc(collection, docId, data);
        return NextResponse.json({ success: true });
      }
      case 'delete': {
        if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 });
        await restDeleteDoc(collection, docId);
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[/api/firestore] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
