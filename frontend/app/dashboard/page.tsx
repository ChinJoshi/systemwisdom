import type { Metadata } from "next";
import Link from "next/link";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { CircleAlertIcon, FolderGit2Icon, PlusIcon } from "lucide-react";
import { listCodebases, type CodebaseResponse } from "@/lib/api/generated";
import { serverApiClient } from "@/lib/api/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
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

export const metadata: Metadata = {
  title: "Dashboard · System Wisdom",
};

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export default async function DashboardPage() {
  // Redirects to AuthKit sign-in (and back here afterwards) when there's no session.
  await withAuth({ ensureSignedIn: true });

  const { data: codebases } = await listCodebases({ client: serverApiClient });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Codebases</h1>
          <p className="text-sm text-muted-foreground">
            Pick a codebase to see who understands what.
          </p>
        </div>
        {/* The empty state has its own add button, so only show this one alongside the grid. */}
        {codebases && codebases.length > 0 && <AddCodebaseButton />}
      </div>

      {codebases === undefined ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Couldn&apos;t load your codebases</AlertTitle>
          <AlertDescription>
            Something went wrong reaching the server. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      ) : codebases.length === 0 ? (
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
            <AddCodebaseButton />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {codebases.map((codebase) => (
            <CodebaseCard key={codebase.id} codebase={codebase} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddCodebaseButton() {
  return (
    <Button size="lg" render={<Link href="/codebases/new" />} nativeButton={false}>
      <PlusIcon data-icon="inline-start" />
      Add codebase
    </Button>
  );
}

function CodebaseCard({ codebase }: { codebase: CodebaseResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderGit2Icon className="size-4 text-muted-foreground" />
          <span className="truncate">{codebase.name}</span>
        </CardTitle>
        <CardDescription>
          Added{" "}
          <time dateTime={codebase.created_at}>
            {dateFormat.format(new Date(codebase.created_at))}
          </time>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
