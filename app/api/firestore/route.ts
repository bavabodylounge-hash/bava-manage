/**
 * Firestore 서버 API - Firebase Admin SDK 사용
 * Admin SDK = 보안 규칙 무시 + App Check 무관
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

function cleanUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function GET() {
  try {
    const db = getAdminDb();
    // 쓰기 테스트
    const ref = db.collection('_diag').doc('test');
    await ref.set({ ts: Date.now(), ok: true });
    await ref.delete();
    return NextResponse.json({ status: '✅ Admin SDK 정상 작동', sdk: 'firebase-admin' });
  } catch (e) {
    return NextResponse.json({ status: '❌ 실패', error: String(e) }, { status: 500 });
  }
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
    const { action, collection, docId, data, where: w } = body;
    const db = getAdminDb();

    switch (action) {
      case 'add': {
        if (!data) return NextResponse.json({ error: 'data required' }, { status: 400 });
        const ref = await db.collection(collection).add({
          ...cleanUndefined(data),
          createdAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ id: ref.id });
      }

      case 'get': {
        if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 });
        const snap = await db.collection(collection).doc(docId).get();
        if (!snap.exists) return NextResponse.json({ error: 'not found' }, { status: 404 });
        return NextResponse.json({ id: snap.id, ...snap.data() });
      }

      case 'getAll': {
        const snap = await db.collection(collection).get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ docs });
      }

      case 'query': {
        if (!w) return NextResponse.json({ error: 'where required' }, { status: 400 });
        const snap = await db.collection(collection).where(w.field, '==', w.value).get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ docs });
      }

      case 'update': {
        if (!docId || !data) return NextResponse.json({ error: 'docId and data required' }, { status: 400 });
        await db.collection(collection).doc(docId).update(cleanUndefined(data));
        return NextResponse.json({ success: true });
      }

      case 'delete': {
        if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 });
        await db.collection(collection).doc(docId).delete();
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[/api/firestore]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
