import { NextResponse } from 'next/server';
import { handleUpload, handleUploadPresigned } from '@vercel/blob/client';
import { issueSignedToken } from '@vercel/blob';
import { currentUser } from '@/lib/server/auth';
import { accessFor } from '@/lib/server/access';
import { blobMode } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

const LIMITS = {
  allowedContentTypes: ['image/*', 'video/*'],
  maximumSizeInBytes: 200 * 1024 * 1024,
};

/** Library files only: assets/<brand>/<folder>/<file>. Nothing else in the store can be overwritten. */
const LIBRARY_PATH = /^assets\/[a-z0-9-]+\/[a-z0-9-]+\/[A-Za-z0-9._-]+$/;

async function mayUpload(pathname: string): Promise<void> {
  if (!LIBRARY_PATH.test(pathname)) throw new Error('Not a library path');
  const me = await currentUser();
  if (!me) throw new Error('Not signed in');
  const a = await accessFor(me);
  // The record is checked per brand when it is registered; here, only people
  // who can edit some brand may upload at all.
  if (!a.platformAdmin && !Object.values(a.brands).some((r) => r !== 'viewer')) throw new Error('Not allowed');
}

/**
 * Lets the browser upload a file straight to Blob storage, so a 40 MB
 * photograph or a video never squeezes through a serverless request.
 *
 * Two ways in, depending on how the store was connected:
 *   token  the project holds a read-write token; the browser gets a client token
 *   oidc   the project holds only a store id; the deployment signs a
 *          short-lived, single-path upload URL as itself
 * The browser asks /api/health which one, and uses the matching upload call.
 *
 * Same filename overwrites the old file. That is the replace-once rule:
 * replace a picture in the library and every deck using it updates.
 */
export async function POST(req: Request) {
  const mode = blobMode();
  if (!mode) {
    return NextResponse.json({ error: 'File storage is not connected to this project.' }, { status: 501 });
  }
  const body = await req.json();
  try {
    if (mode === 'oidc') {
      const result = await handleUploadPresigned({
        body,
        request: req,
        getSignedToken: async (pathname) => {
          await mayUpload(pathname);
          const token = await issueSignedToken({
            pathname,
            operations: ['put'],
            validUntil: Date.now() + 10 * 60 * 1000,
            ...LIMITS,
          });
          return { token, urlOptions: { ...LIMITS, addRandomSuffix: false, allowOverwrite: true } };
        },
      });
      return NextResponse.json(result);
    }

    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        await mayUpload(pathname);
        return { ...LIMITS, addRandomSuffix: false, allowOverwrite: true };
      },
      onUploadCompleted: async () => {
        /* the client registers the asset itself */
      },
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 400 });
  }
}
