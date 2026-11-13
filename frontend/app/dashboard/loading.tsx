import { CodebaseListSkeleton, DashboardShell } from "./codebases";

// Prefetched with links to /dashboard, so navigating here shows this immediately
// while the page renders on the server.
export default function DashboardLoading() {
  return (
    <DashboardShell>
      <CodebaseListSkeleton />
    </DashboardShell>
  );
}
