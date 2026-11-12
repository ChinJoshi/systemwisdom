import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy();

// Run on all routes except Next.js internals and static files so withAuth() works everywhere.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
