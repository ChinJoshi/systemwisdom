import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { CircleAlertIcon } from "lucide-react";
import {
  getCodebase,
  listAssessments,
  listConcepts,
  listContributors,
} from "@/lib/api/generated";
import { serverApiClient } from "@/lib/api/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AssessmentsSection,
  CodebaseShell,
  ConceptsSection,
  ContributorsSection,
  dateFormat,
} from "../sections";
import { CreateAssessmentButton } from "../create-assessment-button";
import { RefreshWhileGenerating } from "../refresh-while-generating";

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

  const generating =
    assessments.data?.some((assessment) => assessment.status === "generating") ?? false;

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
      action={<CreateAssessmentButton codebaseId={codebase.id} generating={generating} />}
    >
      <RefreshWhileGenerating active={generating} />
      <ContributorsSection contributors={contributors.data} />
      <ConceptsSection concepts={concepts.data} />
      <AssessmentsSection codebaseId={codebase.id} assessments={assessments.data} />
    </CodebaseShell>
  );
}
