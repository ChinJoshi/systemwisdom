import { createHmac } from "node:crypto";
import { backOff } from "exponential-backoff";
import { failure, parts } from "eve/events";
import { defineHook } from "eve/hooks";
import { assessmentJobFrom } from "../lib/assessment-job";

// One attempt plus up to three retries, waiting 1s, 3s, then 9s in between.
const DELIVERY_ATTEMPTS = 4;

/** A webhook response that retrying won't fix. */
class NonRetryableWebhookError extends Error {}

/**
 * Reports an assessment session's outcome to the backend once its turn settles: the structured
 * result the backend requested with `outputSchema`, or why there isn't one. The body is signed with
 * HMAC-SHA256 over HMAC_SECRET and sent as `X-Signature`, like every /api/internal/* call.
 */
export default defineHook({
  events: {
    async "turn.settled"(event, ctx) {
      const job = assessmentJobFrom(ctx.session.auth.initiator);
      if (job === null) return; // Not an assessment session, e.g. a chat from the eve TUI.

      const { turnId, outcome } = event.data;
      const result =
        outcome === "completed"
          ? parts(ctx.view, { turnId, kind: "result" }).at(-1)?.value
          : undefined;

      const payload =
        result !== undefined
          ? { status: "completed", session_id: ctx.session.id, result }
          : {
              status: "failed",
              session_id: ctx.session.id,
              error:
                outcome === "completed"
                  ? "The agent finished without producing a structured result."
                  : `The agent's turn ${outcome}: ${failure(ctx.view, turnId)?.message ?? "no details"}`.slice(
                      0,
                      2_000,
                    ),
            };

      // A throw here is only logged (the turn has already ended), so log enough to follow up.
      try {
        await deliver(job.callbackUrl, JSON.stringify(payload), ctx.occurrence.abortSignal);
      } catch (error) {
        console.error("Failed to deliver the assessment webhook", {
          assessmentId: job.assessmentId,
          sessionId: ctx.session.id,
          error,
        });
        throw error;
      }
    },
  },
});

async function deliver(url: string, body: string, signal: AbortSignal): Promise<void> {
  const secret = process.env.HMAC_SECRET;
  if (!secret) throw new Error("HMAC_SECRET is not set");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-signature": createHmac("sha256", secret).update(body).digest("hex"),
  };
  // The webhook goes through the deployment's public URL, so protected (preview) deployments
  // need the automation bypass secret.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) headers["x-vercel-protection-bypass"] = bypass;

  await backOff(
    async () => {
      const response = await fetch(url, { method: "POST", headers, body, signal });
      if (response.ok) return;
      const message = `Webhook returned ${response.status}: ${await response.text()}`;
      // A 4xx (bad signature, invalid result) won't succeed on retry; 429 and 5xx might.
      if (response.status < 500 && response.status !== 429) {
        throw new NonRetryableWebhookError(message);
      }
      throw new Error(message);
    },
    {
      numOfAttempts: DELIVERY_ATTEMPTS,
      startingDelay: 1_000,
      timeMultiple: 3,
      // Stop on responses retrying won't fix, and when the turn is cancelled.
      retry: (error) => !(error instanceof NonRetryableWebhookError) && !signal.aborted,
    },
  );
}
