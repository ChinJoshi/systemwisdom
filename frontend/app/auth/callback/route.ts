import { handleAuth } from "@workos-inc/authkit-nextjs";

// Default landing spot after sign-in. A returnPathname carried through the sign-in flow
// (e.g. from withAuth({ ensureSignedIn: true }) on a protected page) takes precedence.
export const GET = handleAuth({ returnPathname: "/dashboard" });
