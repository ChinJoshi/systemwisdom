import type { Metadata } from "next";
import { Suspense } from "react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import {
  CodebaseList,
  CodebaseListSkeleton,
  DashboardShell,
  HeaderAddButton,
} from "./codebases";

export const metadata: Metadata = {
  title: "Dashboard · System Wisdom",
};

export default async function DashboardPage() {
  // Redirects to AuthKit sign-in (and back here afterwards) when there's no session.
  await withAuth({ ensureSignedIn: true });

  // The frame renders right away; only the parts that need backend data wait on it.
  return (
    <DashboardShell
      action={
        <Suspense fallback={null}>
          <HeaderAddButton />
        </Suspense>
      }
    >
      <Suspense fallback={<CodebaseListSkeleton />}>
        <CodebaseList />
      </Suspense>
    </DashboardShell>
  );
}
