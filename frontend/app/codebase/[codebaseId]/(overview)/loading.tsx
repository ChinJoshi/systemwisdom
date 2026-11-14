import { Skeleton } from "@/components/ui/skeleton";
import { CodebaseSectionsSkeleton, CodebaseShell } from "../sections";

// Shown immediately when navigating to a codebase while the page fetches its data.
export default function CodebaseLoading() {
  return (
    <CodebaseShell
      title={<Skeleton className="h-8 w-48" />}
      description={<Skeleton className="h-5 w-32" />}
      action={<Skeleton className="h-9 w-40" />}
    >
      <CodebaseSectionsSkeleton />
    </CodebaseShell>
  );
}
