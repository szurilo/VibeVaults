/**
 * Main Responsibility: Mint presigned Supabase Storage upload URLs for the
 * attachment routes, with a bounded wait and one retry.
 *
 * Why the retry exists: Supabase's gateway occasionally times out in front of
 * storage-api and answers with its own HTML error page. supabase-js then fails
 * to JSON.parse it (StorageUnknownError "Unexpected token '<'"), the route
 * turns that into a 500 and the widget drops the screenshot it just captured.
 * That happened in production after a 40-50s stall. A per-attempt timeout
 * keeps the composer from hanging that long, and a second attempt rides out
 * the one-off blip instead of discarding the capture.
 *
 * Sensitive Dependencies: Supabase Storage (feedback-attachments bucket);
 * both /api/widget/upload and /api/dashboard/upload build their responses
 * from the entries returned here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'feedback-attachments';
const ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2;

export type PresignedUpload = {
    fileId: string;
    path: string;
    signedUrl: string;
    token: string;
    fileName: string;
    mimeType: string;
};

export type UploadFileMeta = { name: string; size: number; type: string };

async function signWithTimeout(client: SupabaseClient, storagePath: string) {
    // The storage client takes no AbortSignal, so the slow call is raced rather
    // than cancelled; a dangling attempt is harmless once we have moved on.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Storage presign timed out after ${ATTEMPT_TIMEOUT_MS}ms`)), ATTEMPT_TIMEOUT_MS);
    });
    try {
        const { data, error } = await Promise.race([
            client.storage.from(BUCKET).createSignedUploadUrl(storagePath),
            timeout,
        ]);
        if (error || !data) throw error ?? new Error('Storage presign returned no data');
        return data;
    } finally {
        clearTimeout(timer);
    }
}

async function createSignedUploadWithRetry(client: SupabaseClient, storagePath: string) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await signWithTimeout(client, storagePath);
        } catch (err) {
            lastError = err;
            console.error(`[VibeVaults] Signed URL error (attempt ${attempt}/${MAX_ATTEMPTS}):`, err);
        }
    }
    throw lastError;
}

/**
 * Presigns one upload per file under `<projectId>/<uuid>.<ext>`.
 * Throws with the offending file's name in the message so the route can
 * surface it without knowing anything about storage.
 */
export async function presignUploads(
    client: SupabaseClient,
    projectId: string,
    files: UploadFileMeta[],
): Promise<PresignedUpload[]> {
    const uploads: PresignedUpload[] = [];
    for (const file of files) {
        const fileId = crypto.randomUUID();
        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `${projectId}/${fileId}.${ext}`;

        let signed: { signedUrl: string; token: string };
        try {
            signed = await createSignedUploadWithRetry(client, storagePath);
        } catch {
            throw new Error(`Failed to prepare upload for "${file.name}".`);
        }

        uploads.push({
            fileId,
            path: storagePath,
            signedUrl: signed.signedUrl,
            token: signed.token,
            fileName: file.name,
            mimeType: file.type,
        });
    }
    return uploads;
}
