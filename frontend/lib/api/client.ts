"use client";

import { useMemo } from "react";
import { useAccessToken } from "@workos-inc/authkit-nextjs/components";
import { createClient, createConfig } from "./generated/client";

// API client for client components (must render inside <AuthKitProvider>):
//   const apiClient = useApiClient();
//   const { data } = await listCodebases({ client: apiClient });
//
// Requests are same-origin (vercel.json rewrites /api/* to the backend). The bearer token comes
// from AuthKit's useAccessToken().getAccessToken(), which caches the token and refreshes it
// before it expires. It resolves to undefined until AuthKit has loaded the user, so wait for
// useAuth().loading to be false before calling authenticated endpoints.
export function useApiClient() {
  const { getAccessToken } = useAccessToken();
  return useMemo(
    () => createClient(createConfig({ auth: () => getAccessToken() })),
    [getAccessToken],
  );
}
