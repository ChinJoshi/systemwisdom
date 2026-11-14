import { defineTool } from "eve/tools";
import { z } from "zod";
import { assessmentJobFrom, CODEBASE_DIR } from "../lib/assessment-job";

// Matches MAX_CODEBASE_SIZE_BYTES in frontend/lib/codebase-upload.ts (200 MB), which the upload
// token enforces. Keep the two in sync.
const MAX_ZIP_BYTES = 200 * 1024 * 1024;
// Limits on what gets extracted, so a zip bomb or a huge repository can't exhaust the runtime or
// flood the sandbox. Large single files (data dumps, binaries) rarely help explain a codebase.
// MAX_FILE_BYTES doesn't apply inside .git, whose pack files are needed whole.
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const MAX_FILES = 25_000;
// Installed dependencies and build caches: not the team's code, and often most of a zip.
const SKIPPED_DIRECTORIES = new Set([
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".next",
    ".turbo",
    ".pnpm-store",
    "__MACOSX",
]);
const WRITE_BATCH_FILES = 500;
const WRITE_BATCH_BYTES = 8 * 1024 * 1024;

export default defineTool({
    description:
        "Download the codebase zip from its Vercel Blob URI and extract it into the sandbox at " +
        `/workspace/${CODEBASE_DIR}, replacing anything already there. Returns the extracted file ` +
        "count, the top-level entries, and whether a .git directory is present. Call it once, " +
        "before exploring the codebase.",
    inputSchema: z.object({
        blobUri: z
            .string()
            .url()
            .describe("The codebase's Vercel Blob URI, exactly as given."),
    }),
    async execute({ blobUri }, ctx) {
        const job = assessmentJobFrom(ctx.session.auth.initiator);
        // A session started by the backend may only fetch the codebase it was asked to assess, so
        // instructions planted in repository files can't point the agent at another blob.
        if (job !== null && blobUri !== job.blobUri) {
            throw new Error(
                "This session can only download the codebase it was asked to assess. " +
                    `Use the blob URI from the request: ${job.blobUri}`,
            );
        }

        // Authenticates with BLOB_READ_WRITE_TOKEN (or VERCEL_OIDC_TOKEN + BLOB_STORE_ID), and
        // refuses URLs that don't point at a Vercel Blob store.
        const { get } = await import("@vercel/blob");
        const result = await get(blobUri, {
            access: "private",
            abortSignal: ctx.abortSignal,
        });
        if (result === null || result.statusCode !== 200) {
            throw new Error("The codebase was not found in blob storage.");
        }
        if (result.blob.size > MAX_ZIP_BYTES) {
            throw new Error(
                `The codebase zip is ${result.blob.size} bytes, over the supported limit.`,
            );
        }
        const zip = new Uint8Array(
            await new Response(result.stream).arrayBuffer(),
        );

        const skipped = {
            dependencyOrCacheFiles: 0,
            oversizedFiles: 0,
            unsafePaths: 0,
            overLimit: 0,
        };
        let acceptedFiles = 0;
        let acceptedBytes = 0;

        const { unzipSync } = await import("fflate");
        let entries: Record<string, Uint8Array>;
        try {
            entries = unzipSync(zip, {
                filter(file) {
                    if (file.name.endsWith("/")) return false; // directory entry
                    const path = toSafeRelativePath(file.name);
                    if (path === null) {
                        skipped.unsafePaths++;
                        return false;
                    }
                    const segments = path.split("/");
                    if (
                        segments.some((segment) =>
                            SKIPPED_DIRECTORIES.has(segment),
                        )
                    ) {
                        skipped.dependencyOrCacheFiles++;
                        return false;
                    }
                    // Git history lives in pack files that are routinely far over the per-file cap, and
                    // dropping one corrupts the repository for list_git_contributors. Those files still
                    // count toward the total limits below.
                    const isGitMetadata = segments.includes(".git");
                    if (!isGitMetadata && file.originalSize > MAX_FILE_BYTES) {
                        skipped.oversizedFiles++;
                        return false;
                    }
                    if (
                        acceptedFiles >= MAX_FILES ||
                        acceptedBytes + file.originalSize > MAX_TOTAL_BYTES
                    ) {
                        skipped.overLimit++;
                        return false;
                    }
                    acceptedFiles++;
                    acceptedBytes += file.originalSize;
                    return true;
                },
            });
        } catch (error) {
            throw new Error(
                `The codebase upload is not a readable zip archive: ${String(error)}`,
            );
        }

        const files = new Map<string, Uint8Array>();
        for (const [name, content] of Object.entries(entries)) {
            const path = toSafeRelativePath(name);
            if (path !== null) files.set(path, content);
        }
        if (files.size === 0) {
            throw new Error(
                "The codebase zip contains no files that could be extracted.",
            );
        }
        const relativePaths = stripSharedTopLevelDirectory([...files.keys()]);

        const sandbox = await ctx.getSandbox();
        await sandbox.removePath({
            path: CODEBASE_DIR,
            recursive: true,
            force: true,
        });
        let batch: { path: string; content: Uint8Array }[] = [];
        let batchBytes = 0;
        for (const [original, relative] of relativePaths) {
            const content = files.get(original)!;
            batch.push({ path: `${CODEBASE_DIR}/${relative}`, content });
            batchBytes += content.byteLength;
            if (
                batch.length >= WRITE_BATCH_FILES ||
                batchBytes >= WRITE_BATCH_BYTES
            ) {
                await sandbox.writeFiles({
                    files: batch,
                    signal: ctx.abortSignal,
                });
                batch = [];
                batchBytes = 0;
            }
        }
        if (batch.length > 0) {
            await sandbox.writeFiles({ files: batch, signal: ctx.abortSignal });
        }

        const extracted = [...relativePaths.values()];
        const topLevelEntries = [
            ...new Set(
                extracted.map((path) =>
                    path.includes("/") ? `${path.split("/")[0]}/` : path,
                ),
            ),
        ].sort();
        return {
            codebaseRoot: sandbox.resolvePath(CODEBASE_DIR),
            fileCount: extracted.length,
            totalBytes: [...files.values()].reduce(
                (sum, content) => sum + content.byteLength,
                0,
            ),
            hasGitDirectory: extracted.some((path) => path.startsWith(".git/")),
            topLevelEntries: topLevelEntries.slice(0, 100),
            skipped,
        };
    },
});

/**
 * Normalizes a zip entry name to a relative POSIX path, or returns null for names that could
 * escape the extraction directory (absolute paths, drive letters, `..` segments, NUL bytes).
 */
function toSafeRelativePath(name: string): string | null {
    if (name.includes("\0")) return null;
    const normalized = name.replaceAll("\\", "/");
    if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized))
        return null;
    const segments = normalized
        .split("/")
        .filter((segment) => segment !== "" && segment !== ".");
    if (segments.length === 0 || segments.includes("..")) return null;
    return segments.join("/");
}

/**
 * Zips made by "Compress folder" or GitHub's "Download ZIP" wrap everything in one top-level
 * directory. Strip it so the repository root (and any .git directory) lands at the codebase root.
 * Returns a map from each original path to its extracted path.
 */
function stripSharedTopLevelDirectory(paths: string[]): Map<string, string> {
    const first = paths[0]!.split("/")[0]!;
    const shared =
        first !== ".git" && paths.every((path) => path.startsWith(`${first}/`))
            ? `${first}/`
            : "";
    return new Map(paths.map((path) => [path, path.slice(shared.length)]));
}
