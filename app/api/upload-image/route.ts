import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: `Cloudinary 환경변수 누락` },
      { status: 500 }
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const path = (formData.get('path') as string | null) ?? '';

    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: '파일 크기는 10MB 이하' }, { status: 400 });

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ★ 완전 해결책:
    // public_id + overwrite 조합이 서명 충돌의 원인
    // → folder 만 지정 (슬래시 없이 단순 경로)
    // → 파일명은 path 기반 slug로 자동 생성 (Cloudinary가 랜덤 ID 부여)
    // → overwrite, timestamp 옵션 일절 사용 안 함
    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'bava_manager',
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            reject(new Error(typeof error === 'object' ? JSON.stringify(error) : String(error ?? 'upload failed')));
          } else {
            resolve(result as { secure_url: string });
          }
        }
      );
      stream.end(buffer);
    });

    return NextResponse.json({ url: uploadResult.secure_url });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[upload-image] 에러:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
