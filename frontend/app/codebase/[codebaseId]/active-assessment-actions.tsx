"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyIcon, ExternalLinkIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import { closeAssessment } from "@/lib/api/generated";
import { useApiClient } from "@/lib/api/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Actions for the codebase's active assessment: share its public link, or close it.
export function ActiveAssessmentActions({
  codebaseId,
  assessmentId,
}: {
  codebaseId: string;
  assessmentId: string;
}) {
  const apiClient = useApiClient();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, startClosing] = useTransition();
  const path = `/codebase/assessment/${assessmentId}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      toast.success("Assessment link copied. Share it with your contributors.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  function close() {
    startClosing(async () => {
      const { error } = await closeAssessment({
        client: apiClient,
        path: { codebase_id: codebaseId, assessment_id: assessmentId },
      });
      if (error) {
        const detail =
          typeof error === "object" && error !== null && "detail" in error && typeof error.detail === "string"
            ? error.detail
            : "Couldn't close the assessment. Try again.";
        toast.error(detail);
        return;
      }
      setConfirmOpen(false);
      toast.success("Assessment closed. Its link no longer accepts answers.");
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={copyLink}>
        <CopyIcon data-icon="inline-start" />
        Copy link
      </Button>
      <Button variant="ghost" size="sm" render={<Link href={path} />} nativeButton={false}>
        <ExternalLinkIcon data-icon="inline-start" />
        Open
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={(open) => !closing && setConfirmOpen(open)}>
        <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
          <LockIcon data-icon="inline-start" />
          Close
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              Contributors won&apos;t be able to take it anymore: its link stops accepting answers.
              Scores already recorded are kept. You can&apos;t reopen it, but you can create a new
              assessment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={close} disabled={closing}>
              {closing && <Spinner data-icon="inline-start" />}
              {closing ? "Closing…" : "Close assessment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
