/**
 * Main Responsibility: Handle file uploads from the widget (screenshots + attachments).
 * Validates API key + sender invite, uploads to Supabase Storage, inserts into feedback_attachments.
 *
 * Sensitive Dependencies: Supabase Storage (feedback-attachments bucket), feedback_attachments table
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { corsHeaders, corsError, corsSuccess, optionsResponse, validateApiKey, isRateLimited } from "@/lib/widget-helpers";

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
    if (isRateLimited(ip)) return corsError("Too many requests. Please try again later.", 429);

    const formData = await request.formData();
    const apiKey = formData.get("apiKey") as string;
    const senderEmail = formData.get("senderEmail") as string;
    const feedbackId = formData.get("feedbackId") as string | null;
    const replyId = formData.get("replyId") as string | null;

    if (!apiKey) return corsError("Missing API Key", 400);
    if (!senderEmail) return corsError("Missing sender email", 400);

    // Validate API key + subscription
    const { project, error, status } = await validateApiKey(apiKey);
    if (error) return corsError(error, status);

    // Verify sender is authorized (workspace member OR invited client)
    const adminSupabase = createAdminClient();

    // Check if sender is a workspace member (owner/member) by matching email → profile → membership
    const { data: memberProfile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('email', senderEmail)
        .single();

    let isAuthorized = false;

    if (memberProfile) {
        const { data: membership } = await adminSupabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', project.workspace_id)
            .eq('user_id', memberProfile.id)
            .single();

        if (membership) {
            isAuthorized = true;
        }
    }

    // Fall back to checking workspace_invites (for clients)
    if (!isAuthorized) {
        const { data: invite } = await adminSupabase
            .from('workspace_invites')
            .select('id')
            .eq('workspace_id', project.workspace_id)
            .eq('email', senderEmail)
            .single();

        if (!invite) return corsError("Unauthorized email address.", 403);
    }

    // Collect files from formData
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
        if (key === 'files' && value instanceof File) {
            files.push(value);
        }
    }

    if (files.length === 0) return corsError("No files provided.", 400);
    if (files.length > MAX_FILES_PER_REQUEST) return corsError(`Maximum ${MAX_FILES_PER_REQUEST} files per upload.`, 400);

    // Validate each file
    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
            return corsError(`File "${file.name}" exceeds the 10MB limit.`, 400);
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return corsError(`File type "${file.type}" is not allowed.`, 400);
        }
    }

    // Upload files and create DB records
    const uploaded: { id: string; file_name: string; file_url: string; mime_type: string }[] = [];

    for (const file of files) {
        const fileId = crypto.randomUUID();
        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `${project.id}/${fileId}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadError } = await adminSupabase.storage
            .from('feedback-attachments')
            .upload(storagePath, arrayBuffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("[VibeVaults] Storage upload error:", uploadError);
            return corsError(`Failed to upload "${file.name}".`, 500);
        }

        const { data: urlData } = adminSupabase.storage
            .from('feedback-attachments')
            .getPublicUrl(storagePath);

        const fileUrl = urlData.publicUrl;

        const { data: record, error: insertError } = await adminSupabase
            .from('feedback_attachments')
            .insert({
                id: fileId,
                feedback_id: feedbackId || null,
                reply_id: replyId || null,
                project_id: project.id,
                file_name: file.name,
                file_url: fileUrl,
                file_size: file.size,
                mime_type: file.type,
                uploaded_by: senderEmail,
            })
            .select('id, file_name, file_url, mime_type')
            .single();

        if (insertError) {
            console.error("[VibeVaults] Attachment insert error:", insertError);
            return corsError(`Failed to save "${file.name}".`, 500);
        }

        uploaded.push(record);
    }

    return corsSuccess({ attachments: uploaded });
}
