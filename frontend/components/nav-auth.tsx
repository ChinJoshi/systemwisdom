"use client";

import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function NavAuth() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return (
      <form action={signOutAction} className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    );
  }

  return (
    <Button render={<a href="/sign-in" />} nativeButton={false}>
      Sign in
    </Button>
  );
}
