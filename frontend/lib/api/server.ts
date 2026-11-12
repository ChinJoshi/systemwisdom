import { withAuth } from "@workos-inc/authkit-nextjs";
import { createClient, createConfig } from "./generated/client";

// API client for server components, server actions and route handlers:
//   const { data } = await getMe({ client: serverApiClient });
//
// Calls the backend directly at the URL injected by the service binding in vercel.json, sending
// the signed-in user's access token from withAuth() as `Authorization: Bearer <token>` on every
// operation that requires auth. Importing this from a client component fails at build time,
// because withAuth is server-only.
export const serverApiClient = createClient(
  createConfig({
    baseUrl: process.env.BACKEND_URL?.replace(/\/+$/, ""),
    auth: async () => (await withAuth()).accessToken,
  }),
);
