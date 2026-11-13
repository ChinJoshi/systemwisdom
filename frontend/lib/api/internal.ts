import { createHmac } from "node:crypto";
import { createClient, createConfig } from "./generated/client";

// API client for trusted server-to-server calls that run without a user session, such as the
// Vercel Blob upload-completed callback:
//   await createCodebase({ client: internalApiClient, body });
//
// Calls the backend at the service-binding URL (see vercel.json) and signs every request body with
// HMAC-SHA256 using HMAC_SECRET, sending the hex digest as `X-Signature`; the backend verifies it
// on /api/internal/* endpoints. Never import this from client components: the secret must stay on
// the server.
export const internalApiClient = createClient(
  createConfig({
    baseUrl: process.env.BACKEND_URL?.replace(/\/+$/, ""),
  }),
);

internalApiClient.interceptors.request.use(async (request) => {
  const secret = process.env.HMAC_SECRET;
  if (!secret) throw new Error("HMAC_SECRET is not set");
  // Sign the exact bytes being sent (an empty string for bodiless requests).
  const body = await request.clone().text();
  request.headers.set(
    "X-Signature",
    createHmac("sha256", secret).update(body).digest("hex"),
  );
  return request;
});
