import { DefaultSandbox, defineSandbox } from "eve/sandbox";

export const environment = DefaultSandbox.environment();

// The sandbox only holds the uploaded codebase, which is untrusted, and nothing in it needs the
// network: download_codebase fetches the zip from the app runtime and writes the files in. So cut
// off all egress.
export default defineSandbox(async () => {
  const sandbox = await environment.open();
  try {
    await sandbox.setNetworkPolicy("deny-all");
  } catch (error) {
    // just-bash, the local fallback when Docker isn't running, only supports "allow-all". Allow
    // that on a local dev server only; everywhere else, fail closed.
    const isLocalDev =
      process.env.EVE_DEV === "1" ||
      (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "development");
    if (!isLocalDev) throw error;
    console.warn("Sandbox network isolation is unavailable in local development", error);
  }
  return sandbox;
});
