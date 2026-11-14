import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BackToCodebaseButton } from "./back-to-codebase-button";

// Static frame of the results page, used by both page.tsx and loading.tsx so the fallback and the
// real page line up exactly.
export function ResultsShell({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-4">
        <BackToCodebaseButton />
        <div className="flex min-w-0 flex-col gap-1">
          {/* loading.tsx passes a skeleton, which can't go inside a heading. */}
          {typeof title === "string" ? (
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          ) : (
            title
          )}
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function ResultsGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function ContributorCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-44" />
      </CardHeader>
      <CardContent>
        <Skeleton className="mx-auto aspect-square max-h-72 w-full rounded-full" />
      </CardContent>
    </Card>
  );
}
