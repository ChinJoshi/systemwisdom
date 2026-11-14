import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { CircleAlertIcon, UsersIcon } from "lucide-react";
import { getAssessmentResults } from "@/lib/api/generated";
import { serverApiClient } from "@/lib/api/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { dateFormat } from "../../sections";
import { ContributorRadarCard } from "./contributor-radar-card";
import { ResultsGrid, ResultsShell } from "./results-shell";

// Shared by generateMetadata and the page, so a render fetches the results once.
const loadResults = cache(async (codebaseId: string, assessmentId: string) => {
  const { data, response } = await getAssessmentResults({
    client: serverApiClient,
    path: { codebase_id: codebaseId, assessment_id: assessmentId },
  });
  // 404: missing, or another user's codebase. 422: an id isn't a valid UUID.
  if (response?.status === 404 || response?.status === 422) notFound();
  return data;
});

export async function generateMetadata({
  params,
}: PageProps<"/codebase/[codebaseId]/assessments/[assessmentId]">): Promise<Metadata> {
  await withAuth({ ensureSignedIn: true });
  const { codebaseId, assessmentId } = await params;
  const results = await loadResults(codebaseId, assessmentId);
  return {
    title: results
      ? `Assessment results · ${dateFormat.format(new Date(results.assessment.created_at))} · System Wisdom`
      : "Assessment results · System Wisdom",
  };
}

export default async function AssessmentResultsPage({
  params,
}: PageProps<"/codebase/[codebaseId]/assessments/[assessmentId]">) {
  // Redirects to AuthKit sign-in (and back here afterwards) when there's no session.
  await withAuth({ ensureSignedIn: true });
  const { codebaseId, assessmentId } = await params;
  const results = await loadResults(codebaseId, assessmentId);

  if (results === undefined) {
    return (
      <ResultsShell title="Assessment results" description={null}>
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Couldn&apos;t load these results</AlertTitle>
          <AlertDescription>
            Something went wrong reaching the server. Refresh the page to try again.
          </AlertDescription>
        </Alert>
      </ResultsShell>
    );
  }

  const { assessment, contributors } = results;
  const state =
    assessment.status !== "ready"
      ? assessment.status === "generating"
        ? "Generating"
        : "Failed"
      : assessment.active
        ? "Active"
        : "Closed";

  return (
    <ResultsShell
      title="Assessment results"
      description={
        <>
          Created{" "}
          <time dateTime={assessment.created_at}>
            {dateFormat.format(new Date(assessment.created_at))}
          </time>{" "}
          · {assessment.question_count} questions · {results.concepts.length} concepts · {state}
        </>
      }
    >
      {contributors.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No results yet</EmptyTitle>
            <EmptyDescription>
              {assessment.active
                ? "Nobody has taken this assessment. Copy its link from the codebase page and share it with your contributors."
                : "Nobody took this assessment before it was closed."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ResultsGrid>
          {contributors.map((contributor) => (
            <ContributorRadarCard key={contributor.id} contributor={contributor} />
          ))}
        </ResultsGrid>
      )}
    </ResultsShell>
  );
}
