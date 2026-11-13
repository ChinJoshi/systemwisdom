"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { createAssessment } from "@/lib/api/generated";
import { useApiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Starts generating a new assessment. The agent takes a few minutes; the new row shows as
// "Generating" in the assessments table until its questions are stored.
export function CreateAssessmentButton({
  codebaseId,
  generating,
}: {
  codebaseId: string;
  // An assessment is already being generated for this codebase (the backend allows one at a time).
  generating: boolean;
}) {
  const apiClient = useApiClient();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const { error } = await createAssessment({
        client: apiClient,
        path: { codebase_id: codebaseId },
      });
      if (error) {
        const detail =
          typeof error === "object" && error !== null && "detail" in error && typeof error.detail === "string"
            ? error.detail
            : "Couldn't start the assessment. Try again.";
        toast.error(detail);
        return;
      }
      toast.success("Generating the assessment. This takes a few minutes.");
      router.refresh();
    });
  }

  return (
    <Button size="lg" onClick={handleClick} disabled={pending || generating}>
      {pending || generating ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
      {generating ? "Generating assessment" : "Create assessment"}
    </Button>
  );
}
