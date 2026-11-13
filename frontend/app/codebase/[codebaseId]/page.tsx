import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { CircleAlertIcon, PlusIcon } from "lucide-react";
import {
  getCodebase,
  listAssessments,
  listConcepts,
  listContributors,
} from "@/lib/api/generated";
import { serverApiClient } from "@/lib/api/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AssessmentsSection,
  CodebaseShell,
  ConceptsSection,
  ContributorsSection,
  dateFormat,
} from "./sections";

// Shared by generateMetadata and the page, so a render fetches the codebase once.
const loadCodebase = cache(async (codebaseId: string) => {
  const { data, response } = await getCodebase({
    client: serverApiClient,
    path: { codebase_id: codebaseId },
  });
  // 404: missing or someone else's codebase. 422: the id isn't a valid UUID.
  if (response?.status === 404 || response?.status === 422) notFound();
  return data;
});

export async function generateMetadata({
  params,
}: PageProps<"/codebase/[codebaseId]">): Promise<Metadata> {
  await withAuth({ ensureSignedIn: true });
  const codebase = await loadCodebase((await params).codebaseId);
  return { title: `${codebase?.name ?? "Codebase"} · System Wisdom` };
}

export default async function CodebasePage({
  params,
}: PageProps<"/codebase/[codebaseId]">) {
  // Redirects to AuthKit sign-in (and back here afterwards) when there's no session.
  await withAuth({ ensureSignedIn: true });
  const { codebaseId } = await params;
  const path = { codebase_id: codebaseId };

  const [codebase, contributors, concepts, assessments] = await Promise.all([
    loadCodebase(codebaseId),
    listContributors({ client: serverApiClient, path }),
    listConcepts({ client: serverApiClient, path }),
    listAssessments({ client: serverApiClient, path }),
  ]);

  if (codebase === undefined) {
    return (
      <CodebaseShell title="Codebase" description={null}>
        <Alert variant="destructive" className="md:col-span-2">
          <CircleAlertIcon />
          <AlertTitle>Couldn&apos;t load this codebase</AlertTitle>
          <AlertDescription>
            Something went wrong reaching the server. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      </CodebaseShell>
    );
  }

  return (
    <CodebaseShell
      title={codebase.name}
      description={
        <>
          Added{" "}
          <time dateTime={codebase.created_at}>
            {dateFormat.format(new Date(codebase.created_at))}
          </time>
        </>
      }
      action={
        <Button
          size="lg"
          render={<Link href={`/codebase/${codebase.id}/assessments/new`} />}
          nativeButton={false}
        >
          <PlusIcon data-icon="inline-start" />
          Create assessment
        </Button>
      }
    >
      <ContributorsSection contributors={contributors.data} />
      <ConceptsSection concepts={concepts.data} />
      <AssessmentsSection assessments={assessments.data} />
    </CodebaseShell>
  );
}
