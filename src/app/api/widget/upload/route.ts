/**
 * Main Responsibility: Generate presigned upload URLs for widget file attachments.
 * Validates API key + sender authorization, checks tier limits, returns signed URLs
 * so the client uploads directly to Supabase Storage (bypassing Vercel body size limits).
 *
 * Sensitive Dependencies: Supabase Storage (feedback-attachments bucket), tier-helpers
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { corsHeaders, corsError, corsSuccess, optionsResponse, validateApiKey, isRateLimited, verifyWidgetEmail } from "@/lib/widget-helpers";
import { checkStorageLimit } from "@/lib/tier-helpers";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_REQUEST = 10;
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
]);

export async function OPTIONS() {
    return optionsResponse();
}

export async function POST(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:upload")) return corsError("Too many requests. Please try again later.", 429);

    let body: {
        apiKey?: string;
        senderEmail?: string;
        files?: { name: string; size: number; type: string }[];
    };

    try {
        body = await request.json();
    } catch {
        return corsError("Invalid JSON body", 400);
    }

    const { apiKey, senderEmail, files } = body;

    if (!apiKey) return corsError("Missing API Key", 400);
    if (!senderEmail) return corsError("Missing sender email", 400);
    if (!files || !Array.isArray(files) || files.length === 0) return corsError("No files provided.", 400);
    if (files.length > MAX_FILES_PER_REQUEST) return corsError(`Maximum ${MAX_FILES_PER_REQUEST} files per upload.`, 400);

    // Validate API key + subscription
    const { project, error, status } = await validateApiKey(apiKey);
    if (error) return corsError(error, status);

    // Verify sender is authorized
    const isAuthorized = await verifyWidgetEmail(senderEmail, project.workspace_id);
    if (!isAuthorized) return corsError("Unauthorized email address.", 403);

    // Check storage limit for workspace owner
    const adminSupabase = createAdminClient();
    const { data: workspace } = await adminSupabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', project.workspace_id)
        .single();

    if (workspace?.owner_id) {
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        const storageCheck = await checkStorageLimit(workspace.owner_id, totalSize);
        if (!storageCheck.allowed) {
            return corsError(storageCheck.message ?? 'Storage limit exceeded', 403);
        }
    }

    // Validate each file's metadata
    for (const file of files) {
        if (!file.name || !file.size || !file.type) {
            return corsError("Each file must have name, size, and type.", 400);
        }
        if (file.size > MAX_FILE_SIZE) {
            return corsError(`File "${file.name}" exceeds the 10MB limit.`, 400);
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return corsError(`File type "${file.type}" is not allowed.`, 400);
        }
    }

    // Generate presigned upload URLs
    const uploads: { fileId: string; path: string; signedUrl: string; token: string; fileName: string; mimeType: string }[] = [];

    for (const file of files) {
        const fileId = crypto.randomUUID();
        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `${project.id}/${fileId}.${ext}`;

        const { data, error: signError } = await adminSupabase.storage
            .from('feedback-attachments')
            .createSignedUploadUrl(storagePath);

        if (signError || !data) {
            console.error("[VibeVaults] Signed URL error:", signError);
            return corsError(`Failed to prepare upload for "${file.name}".`, 500);
        }

        uploads.push({
            fileId,
            path: storagePath,
            signedUrl: data.signedUrl,
            token: data.token,
            fileName: file.name,
            mimeType: file.type,
        });
    }

    return corsSuccess({
        projectId: project.id,
        uploads,
    });
}
