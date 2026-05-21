/**
 * Firestore 서버 프록시 API
 * 브라우저 → /api/firestore → Firestore REST API
 * 
 * App Check는 브라우저의 Firebase JS SDK에만 적용되므로,
 * 서버(Next.js API Route)에서 직접 REST API 호출 시 우회됨.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  restAddDoc,
  restGetDoc,
  restGetCollection,
  restUpdateDoc,
  restDeleteDoc,
  restQuery,
} from '@/lib/firestoreRest';

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
