"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useStore } from "@tanstack/react-form";
import { upload } from "@vercel/blob/client";
import { CircleAlertIcon, PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { getCodebase, listCodebases } from "@/lib/api/generated";
import { useApiClient } from "@/lib/api/client";
import {
  CODEBASE_UPLOAD_URL,
  MAX_CODEBASE_NAME_LENGTH,
  MAX_CODEBASE_SIZE_BYTES,
  ZIP_CONTENT_TYPE,
  codebaseBlobPathname,
  formatMegabytes,
  validateCodebaseName,
  type CodebaseUploadClientPayload,
} from "@/lib/codebase-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

type CodebaseUploadValues = {
  name: string;
  file: File | null;
};

const defaultValues: CodebaseUploadValues = { name: "", file: null };

// Validators return this shape so errors render directly in <FieldError errors={...} />.
type FieldIssue = { message: string };
const issue = (message: string): FieldIssue => ({ message });

const NAME_CHECK_DEBOUNCE_MS = 400;
// After the file lands in Blob storage, Vercel Blob calls our upload route, which records the
// codebase. Poll for that row for a bit so the dashboard shows the codebase when the sheet closes.
const PROCESSING_POLL_INTERVAL_MS = 1000;
const PROCESSING_TIMEOUT_MS = 30_000;

type UploadStatus =
  | { phase: "idle" }
  | { phase: "uploading"; percentage: number }
  | { phase: "processing" };

export function AddCodebaseSheet() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    // While an upload is running, a stray click on the backdrop shouldn't cancel it. The close
    // button and Escape still work and abort the upload.
    <Sheet open={open} onOpenChange={setOpen} disablePointerDismissal={busy}>
      <SheetTrigger render={<Button size="lg" />}>
        <PlusIcon data-icon="inline-start" />
        Add codebase
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a codebase</SheetTitle>
          <SheetDescription>
            Upload a zip of the repository to map its concepts and see which
            contributors understand them.
          </SheetDescription>
        </SheetHeader>
        <CodebaseUploadForm
          onBusyChange={setBusy}
          onDone={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function CodebaseUploadForm({
  onBusyChange,
  onDone,
}: {
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const apiClient = useApiClient();
  const [status, setStatus] = useState<UploadStatus>({ phase: "idle" });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Closing the sheet unmounts the form: stop any upload or polling still in flight.
  useEffect(() => () => abortRef.current?.abort(), []);

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      // Field validators guarantee a file by the time onSubmit runs.
      const file = value.file!;
      const name = value.name.trim();
      const controller = new AbortController();
      abortRef.current = controller;
      setSubmitError(null);

      try {
        const payload: CodebaseUploadClientPayload = {
          codebaseId: crypto.randomUUID(),
          name,
        };

        setStatus({ phase: "uploading", percentage: 0 });
        await upload(codebaseBlobPathname(payload.codebaseId), file, {
          access: "private",
          handleUploadUrl: CODEBASE_UPLOAD_URL,
          clientPayload: JSON.stringify(payload),
          // Browsers disagree on a zip's MIME type (Windows reports application/x-zip-compressed),
          // so send the one the upload route allows.
          contentType: ZIP_CONTENT_TYPE,
          abortSignal: controller.signal,
          onUploadProgress: ({ percentage }) =>
            setStatus({ phase: "uploading", percentage }),
        });

        setStatus({ phase: "processing" });
        const recorded = await pollUntil(
          async () => {
            const { data } = await getCodebase({
              client: apiClient,
              path: { codebase_id: payload.codebaseId },
              signal: controller.signal,
            });
            return data;
          },
          controller.signal,
        );

        if (recorded) {
          toast.success(`Added ${recorded.name}`);
        } else {
          toast.info(`Uploaded ${name}`, {
            description: "It'll show up on your dashboard once it's processed.",
          });
        }
        router.refresh();
        onDone();
      } catch (error) {
        // Aborted because the sheet closed: nothing left to show.
        if (controller.signal.aborted) return;
        console.error("Codebase upload failed", error);
        setStatus({ phase: "idle" });
        setSubmitError(
          "We couldn't upload this codebase. Check your connection and try again.",
        );
      }
    },
  });

  // Granular subscription: re-renders this component only when isSubmitting flips.
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  useEffect(() => onBusyChange(isSubmitting), [isSubmitting, onBusyChange]);

  return (
    <form
      noValidate
      className="flex flex-1 flex-col overflow-y-auto"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="px-4">
        <form.Field
          name="file"
          validators={{
            onChange: ({ value }) => validateZipFile(value),
            // Only runs once the sync checks pass, so it never reads an oversized file.
            onChangeAsync: async ({ value }) =>
              value && !(await hasZipSignature(value))
                ? issue("This file isn't a valid zip archive.")
                : undefined,
          }}
          listeners={{
            // Suggest a name from the archive's filename, unless the user already typed one.
            onChange: ({ value }) => {
              if (value && !form.getFieldValue("name").trim()) {
                form.setFieldValue("name", value.name.replace(/\.zip$/i, ""));
              }
            },
          }}
        >
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            const file = field.state.value;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Codebase archive</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="file"
                  accept=".zip,application/zip"
                  disabled={isSubmitting}
                  aria-invalid={isInvalid}
                  aria-describedby={`${field.name}-description`}
                  onBlur={field.handleBlur}
                  onChange={(event) =>
                    field.handleChange(event.target.files?.[0] ?? null)
                  }
                />
                <FieldDescription id={`${field.name}-description`}>
                  {file
                    ? `${file.name} · ${formatMegabytes(file.size)}`
                    : `A .zip file up to ${formatMegabytes(MAX_CODEBASE_SIZE_BYTES)}.`}
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => {
              const message = validateCodebaseName(value);
              return message ? issue(message) : undefined;
            },
            onChangeAsyncDebounceMs: NAME_CHECK_DEBOUNCE_MS,
            onChangeAsync: async ({ value, signal }) => {
              const { data: codebases } = await listCodebases({
                client: apiClient,
                signal,
              });
              const taken = codebases?.some(
                (codebase) =>
                  codebase.name.toLowerCase() === value.trim().toLowerCase(),
              );
              // If the check itself fails, don't block the upload on it.
              return taken
                ? issue("You already have a codebase with this name.")
                : undefined;
            },
          }}
        >
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  maxLength={MAX_CODEBASE_NAME_LENGTH}
                  placeholder="acme-api"
                  autoComplete="off"
                  disabled={isSubmitting}
                  aria-invalid={isInvalid}
                  aria-describedby={`${field.name}-description`}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <FieldDescription
                  id={`${field.name}-description`}
                  aria-live="polite"
                  className="flex items-center gap-1.5"
                >
                  {field.state.meta.isValidating ? (
                    <>
                      <Spinner className="size-3" />
                      Checking name…
                    </>
                  ) : (
                    "How this codebase appears on your dashboard."
                  )}
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        {status.phase !== "idle" && <UploadProgress status={status} />}

        {submitError && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Upload failed</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>

      <SheetFooter>
        {/* Granular subscription: only the submit button re-renders as these flags change. */}
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, submitting]) => (
            <Button type="submit" size="lg" disabled={!canSubmit || submitting}>
              {submitting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UploadIcon data-icon="inline-start" />
              )}
              {submitting ? "Uploading…" : "Upload codebase"}
            </Button>
          )}
        </form.Subscribe>
      </SheetFooter>
    </form>
  );
}

function UploadProgress({
  status,
}: {
  status: Exclude<UploadStatus, { phase: "idle" }>;
}) {
  const uploading = status.phase === "uploading";
  return (
    // A null value renders base-ui's indeterminate state while the server records the codebase.
    <Progress value={uploading ? Math.round(status.percentage) : null}>
      <ProgressLabel>
        {uploading ? "Uploading" : "Processing upload"}
      </ProgressLabel>
      {uploading && <ProgressValue className="ml-auto" />}
    </Progress>
  );
}

function validateZipFile(file: File | null): FieldIssue | undefined {
  if (!file) return issue("Choose a .zip file to upload.");
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return issue("Only .zip files are supported.");
  }
  if (file.size === 0) return issue("This file is empty.");
  if (file.size > MAX_CODEBASE_SIZE_BYTES) {
    return issue(
      `This file is ${formatMegabytes(file.size)}. The limit is ${formatMegabytes(MAX_CODEBASE_SIZE_BYTES)}.`,
    );
  }
  return undefined;
}

// Zip archives start with a local file header ("PK\x03\x04"), or an end-of-central-directory
// record ("PK\x05\x06") when empty. Catches files that were renamed to .zip.
async function hasZipSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06))
  );
}

// Calls `fetch` every PROCESSING_POLL_INTERVAL_MS until it returns a value, giving up (undefined)
// after PROCESSING_TIMEOUT_MS. Rejects if `signal` aborts.
async function pollUntil<T>(
  fetch: () => Promise<T | undefined>,
  signal: AbortSignal,
): Promise<T | undefined> {
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await fetch();
    if (result !== undefined) return result;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, PROCESSING_POLL_INTERVAL_MS);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }
  return undefined;
}
