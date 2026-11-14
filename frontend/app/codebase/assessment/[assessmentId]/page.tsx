import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CircleAlertIcon } from "lucide-react";
import { getAssessmentToTake } from "@/lib/api/generated";
import { serverApiClient } from "@/lib/api/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AssessmentForm } from "./assessment-form";

// Public page: contributors open the link the codebase owner shares, usually without an account,
// so there's no sign-in here. The backend never sends correct answers to this page.

// Shared by generateMetadata and the page, so a render fetches the assessment once.
const loadAssessment = cache(async (assessmentId: string) => {
  const { data, response } = await getAssessmentToTake({
    client: serverApiClient,
    path: { assessment_id: assessmentId },
  });
  // 404: missing or not ready yet. 422: the id isn't a valid UUID.
  if (response?.status === 404 || response?.status === 422) notFound();
  return { assessment: data, replaced: response?.status === 410 };
});

export async function generateMetadata({
  params,
}: PageProps<"/codebase/assessment/[assessmentId]">): Promise<Metadata> {
  const { assessment } = await loadAssessment((await params).assessmentId);
  return {
    title: assessment
      ? `${assessment.codebase_name} assessment · System Wisdom`
      : "Assessment · System Wisdom",
  };
}

export default async function AssessmentPage({
  params,
}: PageProps<"/codebase/assessment/[assessmentId]">) {
  const { assessment, replaced } = await loadAssessment((await params).assessmentId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      {assessment === undefined ? (
        <Alert variant={replaced ? "default" : "destructive"}>
          <CircleAlertIcon />
          <AlertTitle>
            {replaced ? "This assessment is closed" : "Couldn't load this assessment"}
          </AlertTitle>
          <AlertDescription>
            {replaced
              ? "A newer assessment has replaced it. Ask the person who sent you this link for the current one."
              : "Something went wrong reaching the server. Refresh the page to try again."}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {assessment.codebase_name} assessment
            </h1>
            <p className="text-sm text-muted-foreground">
              {assessment.questions.length} questions about how this codebase works. Answer each
              one from what you know; there&apos;s no time limit.
            </p>
          </div>
          <AssessmentForm assessment={assessment} />
        </>
      )}
    </div>
  );
}
