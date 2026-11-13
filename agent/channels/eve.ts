import { defaultEveAuth, eveChannel } from "eve/channels/eve";
import { localDev, placeholderAuth, vercelOidc } from "eve/channels/auth";
import { assessmentJobSchema, withAssessmentJob } from "../lib/assessment-job";

export default eveChannel({
  auth: [
    // Admits this project's own deployments (the backend) and the eve TUI on a deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and `vercel dev`; ignored in production.
    localDev(),
    // Rejects everything else (browsers included) in production.
    placeholderAuth(),
  ],
  onMessage(ctx) {
    const auth = defaultEveAuth(ctx);
    // The backend sends the assessment job as the first message's clientContext. Carry it on the
    // session's auth attributes (read back from `session.auth.initiator`), where tools and hooks
    // can read it.
    const job = assessmentJobSchema.safeParse(ctx.eve.clientContext);
    return {
      auth: auth !== null && job.success ? withAssessmentJob(auth, job.data) : auth,
      // Keep the job (including the webhook URL) out of the model's context; the message itself
      // carries the blob URI the model needs.
      clientContext: [],
    };
  },
});
