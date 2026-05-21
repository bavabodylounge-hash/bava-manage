import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 환경변수 확인
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: `Cloudinary 환경변수 누락: cloud_name=${cloudName}, api_key=${apiKey ? '있음' : '없음'}, api_secret=${apiSecret ? '있음' : '없음'}` },
      { status: 500 }
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const folder = 'bava-manager/' + (path ? path.split('/').slice(0, -1).join('/') : 'reports');

    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error) {
            // Cloudinary 에러 객체를 상세하게 직렬화
            const errMsg = typeof error === 'object'
              ? JSON.stringify(error)
              : String(error);
            reject(new Error(errMsg));
          } else {
            resolve(result as { secure_url: string });
          }
        }
      ).end(buffer);
    });

    return NextResponse.json({ url: uploadResult.secure_url });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[upload-image] 에러:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
