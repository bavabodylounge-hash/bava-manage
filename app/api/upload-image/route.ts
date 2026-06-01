import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: `Cloudinary 환경변수 누락: cloud_name=${cloudName}, api_key=${apiKey ? '있음' : '없음'}, api_secret=${apiSecret ? '있음' : '없음'}` },
      { status: 500 }
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key:    apiKey,
    api_secret: apiSecret,
    secure:     true,
  });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const path = (formData.get('path') as string | null) ?? '';

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 });
    }

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ★ 핵심 수정:
    // timestamp를 upload_stream 옵션으로 전달하면 SDK 내부 서명과 충돌 → 401
    // 대신 folder + public_id 로 경로 지정, 서명은 SDK가 자동 생성하게 맡김
    const safePath   = path.replace(/[^a-zA-Z0-9_\-\/]/g, '_');
    const folder     = 'bava-manager';
    const public_id  = safePath ? `${folder}/${safePath}` : `${folder}/reports/${Date.now()}`;

    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id,          // 경로 포함 파일명
          resource_type: 'image',
          overwrite:     true,
          // ★ timestamp 절대 넣지 않음 → SDK 자동 생성으로 서명 일치 보장
        },
        (error, result) => {
          if (error || !result) {
            reject(new Error(
              typeof error === 'object' ? JSON.stringify(error) : String(error ?? 'upload failed')
            ));
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
