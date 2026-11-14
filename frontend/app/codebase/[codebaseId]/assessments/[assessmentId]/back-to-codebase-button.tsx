"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Reads the codebase id from the URL so it also works in loading.tsx, which gets no params.
export function BackToCodebaseButton() {
  const { codebaseId } = useParams<{ codebaseId: string }>();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2.5 w-fit"
      render={<Link href={`/codebase/${codebaseId}`} />}
      nativeButton={false}
    >
      <ArrowLeftIcon data-icon="inline-start" />
      Codebase
    </Button>
  );
}
