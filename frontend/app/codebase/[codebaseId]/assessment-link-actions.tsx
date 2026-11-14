"use client";

import Link from "next/link";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Actions for sharing the active assessment: contributors take it at this public link.
export function AssessmentLinkActions({ assessmentId }: { assessmentId: string }) {
  const path = `/codebase/assessment/${assessmentId}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      toast.success("Assessment link copied. Share it with your contributors.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
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
    </div>
  );
}
