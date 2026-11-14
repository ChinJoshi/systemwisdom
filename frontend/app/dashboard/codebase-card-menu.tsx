"use client";

import { useRouter } from "next/navigation";
import { deleteCodebase } from "@/lib/api/generated";
import { useApiClient } from "@/lib/api/client";
import { DeleteMenu } from "@/components/delete-menu";

export function CodebaseCardMenu({ codebaseId, name }: { codebaseId: string; name: string }) {
  const apiClient = useApiClient();
  const router = useRouter();
  return (
    <DeleteMenu
      triggerLabel={`Actions for ${name}`}
      title={`Delete ${name}?`}
      description="This permanently deletes the codebase, its uploaded zip, its assessments, and every contributor score recorded for it. It can't be undone."
      confirmLabel="Delete codebase"
      successMessage={`Deleted ${name}.`}
      onDelete={async () => {
        // The backend deletes the rows and the uploaded zip from Vercel Blob.
        const { error } = await deleteCodebase({
          client: apiClient,
          path: { codebase_id: codebaseId },
        });
        if (!error) return null;
        return typeof error === "object" && error !== null && "detail" in error && typeof error.detail === "string"
          ? error.detail
          : "Couldn't delete the codebase. Try again.";
      }}
      onDeleted={() => router.refresh()}
    />
  );
}
