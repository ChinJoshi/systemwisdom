"use client";

import { useRouter } from "next/navigation";
import { deleteAssessment } from "@/lib/api/generated";
import { useApiClient } from "@/lib/api/client";
import { DeleteMenu } from "@/components/delete-menu";

export function AssessmentRowMenu({
  codebaseId,
  assessmentId,
  active,
}: {
  codebaseId: string;
  assessmentId: string;
  active: boolean;
}) {
  const apiClient = useApiClient();
  const router = useRouter();
  return (
    <DeleteMenu
      triggerLabel="Assessment actions"
      title="Delete this assessment?"
      description={
        active
          ? "This permanently deletes the assessment, its questions, and every score contributors recorded on it. Its link stops working, and the codebase has no active assessment until you create another. It can't be undone."
          : "This permanently deletes the assessment, its questions, and every score contributors recorded on it. It can't be undone."
      }
      confirmLabel="Delete assessment"
      successMessage="Assessment deleted."
      onDelete={async () => {
        const { error } = await deleteAssessment({
          client: apiClient,
          path: { codebase_id: codebaseId, assessment_id: assessmentId },
        });
        if (!error) return null;
        return typeof error === "object" && error !== null && "detail" in error && typeof error.detail === "string"
          ? error.detail
          : "Couldn't delete the assessment. Try again.";
      }}
      onDeleted={() => router.refresh()}
    />
  );
}
