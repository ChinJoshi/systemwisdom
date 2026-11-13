// Contract for codebase uploads, shared by the upload form (browser) and the client-upload route
// handler (server) so both enforce the same rules.

// Route handler that issues Vercel Blob client tokens and receives the upload-completed callback.
// Lives outside /api because vercel.json rewrites /api/* to the backend service.
export const CODEBASE_UPLOAD_URL = "/codebases/upload";

export const ZIP_CONTENT_TYPE = "application/zip";
export const MAX_CODEBASE_SIZE_BYTES = 150 * 1024 * 1024; // 50 MB
export const MAX_CODEBASE_NAME_LENGTH = 255; // codebases.name is VARCHAR(255)

// Sent by the browser as the upload's clientPayload. Untrusted: the server validates it.
export type CodebaseUploadClientPayload = {
    // Generated in the browser so it can poll for the codebase row the upload callback creates.
    codebaseId: string;
    name: string;
};

// Set by the server when issuing the client token. Vercel Blob signs it into the upload-completed
// callback, so it can be trusted there.
export type CodebaseUploadTokenPayload = CodebaseUploadClientPayload & {
    userId: string;
};

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Each codebase is stored at a pathname derived from its id (Vercel Blob adds a random suffix).
export function codebaseBlobPathname(codebaseId: string) {
    return `codebases/${codebaseId}.zip`;
}

export function validateCodebaseName(name: string): string | undefined {
    const trimmed = name.trim();
    if (!trimmed) return "Give the codebase a name.";
    if (trimmed.length > MAX_CODEBASE_NAME_LENGTH) {
        return `Keep the name under ${MAX_CODEBASE_NAME_LENGTH} characters.`;
    }
    return undefined;
}

// Throws with a user-facing message if the payload is malformed.
export function parseCodebaseUploadClientPayload(
    raw: string | null,
): CodebaseUploadClientPayload {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw ?? "");
    } catch {
        throw new Error("Missing upload details.");
    }
    const { codebaseId, name } = (parsed ?? {}) as Record<string, unknown>;
    if (typeof codebaseId !== "string" || !UUID_PATTERN.test(codebaseId)) {
        throw new Error("Invalid codebase id.");
    }
    if (typeof name !== "string") throw new Error("Give the codebase a name.");
    const nameError = validateCodebaseName(name);
    if (nameError) throw new Error(nameError);
    return { codebaseId, name: name.trim() };
}

export function formatMegabytes(bytes: number) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
