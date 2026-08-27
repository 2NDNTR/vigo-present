import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { currentUser } from '@/lib/server/auth';
import { hasBlob } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/**
 * Hands the browser a short-lived token so it can upload the file straight to
 * Blob storage. Going direct avoids the serverless request size limit, which
 * matters for real photography and video.
 */
export async function POST(req: Request) {
  if (!hasBlob()) {
    return NextResponse.json(
      { error: 'Blob storage is not configured. Add BLOB_READ_WRITE_TOKEN.' },
      { status: 501 }
    );
  }
  const body = await req.json();
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const me = await currentUser();
        if (!me) throw new Error('Not signed in');
        return {
          allowedContentTypes: ['image/*', 'video/*'],
          maximumSizeInBytes: 200 * 1024 * 1024,
          // Same filename overwrites the old file — that is the replace-once
          // rule, enforced at the storage layer.
          addRandomSuffix: false,
          allowOverwrite: true,
        } as any;
      },
      onUploadCompleted: async () => {
        /* the client registers the asset itself, so nothing to do here */
      },
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 400 });
  }
}
