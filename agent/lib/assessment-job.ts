import type { SessionAuthContext } from "eve/context";
import { z } from "zod";

/**
 * The assessment job a session works on. The backend sends it as the first message's
 * `clientContext`. `agent/channels/eve.ts` moves it onto the session's auth attributes, which
 * tools and hooks can read but the model never sees. So the model (or text planted in the
 * repository) can't change where the codebase comes from or where results are sent.
 */
export const assessmentJobSchema = z.object({
  assessmentId: z.string().uuid(),
  // The private Vercel Blob URL of the uploaded codebase zip.
  blobUri: z.string().url(),
  // The backend endpoint that receives the HMAC-signed result webhook.
  callbackUrl: z.string().url(),
});

export type AssessmentJob = z.infer<typeof assessmentJobSchema>;

const ATTRIBUTE_PREFIX = "systemwisdom.";

/** Adds the job to a caller's auth attributes, as `onMessage` returns them. */
export function withAssessmentJob(
  auth: SessionAuthContext,
  job: AssessmentJob,
): SessionAuthContext {
  return {
    ...auth,
    attributes: {
      ...auth.attributes,
      [`${ATTRIBUTE_PREFIX}assessmentId`]: job.assessmentId,
      [`${ATTRIBUTE_PREFIX}blobUri`]: job.blobUri,
      [`${ATTRIBUTE_PREFIX}callbackUrl`]: job.callbackUrl,
    },
  };
}

/**
 * Reads the job from the session's auth. Pass `ctx.session.auth.initiator`, the caller that
 * created the session, so a later message can't replace the job. Returns null for sessions that
 * aren't assessments, such as a chat from the eve TUI.
 */
export function assessmentJobFrom(auth: SessionAuthContext | null | undefined): AssessmentJob | null {
  const attributes = auth?.attributes ?? {};
  const job = assessmentJobSchema.safeParse({
    assessmentId: attributes[`${ATTRIBUTE_PREFIX}assessmentId`],
    blobUri: attributes[`${ATTRIBUTE_PREFIX}blobUri`],
    callbackUrl: attributes[`${ATTRIBUTE_PREFIX}callbackUrl`],
  });
  return job.success ? job.data : null;
}

/** Where `download_codebase` extracts the codebase, relative to the sandbox workspace root. */
export const CODEBASE_DIR = "codebase";
