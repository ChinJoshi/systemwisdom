import { cache, type ReactNode } from "react";
import Link from "next/link";
import { CircleAlertIcon, FolderGit2Icon } from "lucide-react";
import { listCodebases, type CodebaseResponse } from "@/lib/api/generated";
import { serverApiClient } from "@/lib/api/server";
import { AddCodebaseSheet } from "@/components/add-codebase-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { CodebaseCardMenu } from "./codebase-card-menu";

// Shared by the header's add button and the list, so a render makes one backend call.
const getCodebases = cache(async () => {
  const { data } = await listCodebases({ client: serverApiClient });
  return data;
});

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const gridClassName = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

// Static frame of the dashboard, used by both page.tsx and loading.tsx so the fallback
// and the real page line up exactly.
export function DashboardShell({
  action,
  children,
}: {
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Codebases</h1>
          <p className="text-sm text-muted-foreground">
            Pick a codebase to see who understands what.
          </p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// The empty state has its own add button, so only show this one alongside the grid.
export async function HeaderAddButton() {
  const codebases = await getCodebases();
  return codebases && codebases.length > 0 ? <AddCodebaseSheet /> : null;
}

export async function CodebaseList() {
  const codebases = await getCodebases();

  if (codebases === undefined) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Couldn&apos;t load your codebases</AlertTitle>
        <AlertDescription>
          Something went wrong reaching the server. Refresh the page to try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (codebases.length === 0) {
    return (
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderGit2Icon />
          </EmptyMedia>
          <EmptyTitle>No codebases yet</EmptyTitle>
          <EmptyDescription>
            Add a codebase to map its concepts and see which contributors
            understand them.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <AddCodebaseSheet />
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className={gridClassName}>
      {codebases.map((codebase) => (
        <CodebaseCard key={codebase.id} codebase={codebase} />
      ))}
    </div>
  );
}

export function CodebaseListSkeleton() {
  return (
    <div className={gridClassName} aria-busy="true" aria-label="Loading codebases">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

// The title's link stretches over the whole card (its ::after), so the card is clickable while the
// actions menu, which sits above that overlay, stays its own button. A button can't go inside a
// link, which is why the card isn't simply wrapped in one.
function CodebaseCard({ codebase }: { codebase: CodebaseResponse }) {
  return (
    <Card className="relative h-full transition-colors has-[a:hover]:bg-muted/50 has-[a:hover]:ring-foreground/20 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          <FolderGit2Icon className="size-4 shrink-0 text-muted-foreground" />
          <Link
            href={`/codebase/${codebase.id}`}
            className="truncate outline-none after:absolute after:inset-0 after:content-['']"
          >
            {codebase.name}
          </Link>
        </CardTitle>
        <CardDescription>
          Added{" "}
          <time dateTime={codebase.created_at}>
            {dateFormat.format(new Date(codebase.created_at))}
          </time>
        </CardDescription>
        <CardAction className="relative z-10">
          <CodebaseCardMenu codebaseId={codebase.id} name={codebase.name} />
        </CardAction>
      </CardHeader>
    </Card>
  );
}
