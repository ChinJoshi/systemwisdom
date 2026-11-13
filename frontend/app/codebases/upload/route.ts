import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { createCodebase } from "@/lib/api/generated";
import { internalApiClient } from "@/lib/api/internal";
import {
  MAX_CODEBASE_SIZE_BYTES,
  ZIP_CONTENT_TYPE,
  codebaseBlobPathname,
  parseCodebaseUploadClientPayload,
  type CodebaseUploadTokenPayload,
} from "@/lib/codebase-upload";

// Vercel Blob client uploads (https://vercel.com/docs/vercel-blob/client-upload). This route gets
// two kinds of requests:
//   1. blob.generate-client-token, from the signed-in user's browser: authenticate them and issue
//      a token that only allows a zip of at most 15 MB at the expected pathname.
//   2. blob.upload-completed, from Vercel Blob once the file is stored (no user session; handleUpload
//      verifies the request signature): record the codebase in the backend.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { user } = await withAuth();
        if (!user) {
          throw new Error("You need to be signed in to upload a codebase.");
        }

        const { codebaseId, name } =
          parseCodebaseUploadClientPayload(clientPayload);
        if (pathname !== codebaseBlobPathname(codebaseId)) {
          throw new Error("Invalid upload pathname.");
        }

        const tokenPayload: CodebaseUploadTokenPayload = {
          codebaseId,
          name,
          userId: user.id,
        };
        return {
          allowedContentTypes: [ZIP_CONTENT_TYPE],
          maximumSizeInBytes: MAX_CODEBASE_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(tokenPayload),
          // Locally this is a smee.io channel that forwards to this route (see vercel.json). Passed
          // as-is because handleUpload would otherwise append this route's path to it, which a smee
          // channel URL doesn't accept. Unset on Vercel, where handleUpload derives the callback URL
          // from the deployment's system environment variables.
          callbackUrl: process.env.VERCEL_BLOB_CALLBACK_URL,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { codebaseId, name, userId } = JSON.parse(
          tokenPayload ?? "",
        ) as CodebaseUploadTokenPayload;

        await createCodebase({
          client: internalApiClient,
          body: { id: codebaseId, user_id: userId, name, blob_uri: blob.url },
          throwOnError: true,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (body.type === "blob.upload-completed") {
      console.error("Failed to record uploaded codebase", error);
      // Vercel Blob retries the callback (up to 5 times) on a 5xx but not on a 4xx. Recording the
      // codebase is idempotent, so let it retry transient failures.
      return NextResponse.json({ error: message }, { status: 500 });
    }
    // Token requests come from the browser, where upload() surfaces this message.
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
