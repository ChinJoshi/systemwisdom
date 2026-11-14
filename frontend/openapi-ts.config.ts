import { defineConfig } from "@hey-api/openapi-ts";

// Regenerate with `pnpm api:generate` while the app is running locally (`vercel dev` serves on
// port 3000 and routes /api/* to the backend; the spec path is set by `openapi_url` in
// backend/app/main.py).
export default defineConfig({
  input: "http://localhost:3000/api/openapi.json",
  output: "./lib/api/generated",
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/typescript",
    // No default client: every SDK call must pass `client` (serverApiClient or useApiClient()),
    // so a request can't go out without a base URL and auth configured.
    { name: "@hey-api/sdk", client: false },
  ],
});
