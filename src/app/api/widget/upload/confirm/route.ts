/**
 * Main Responsibility: Confirm completed presigned uploads and create feedback_attachments records.
 * Called after the widget uploads files directly to Supabase Storage via presigned URLs.
 *
 * Sensitive Dependencies: feedback_attachments table, Supabase Storage (feedback-attachments bucket)
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { corsError, corsSuccess, optionsResponse, isRateLimited, authenticateWidgetRequest } from "@/lib/widget-helpers";

export async function OPTIONS() {
    return optionsResponse();
}

export async function POST(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:upload:confirm")) return corsError("Too many requests. Please try again later.", 429);

    let body: {
        apiKey?: string;
        projectId?: string;
        feedbackId?: string | null;
        replyId?: string | null;
        files?: { fileId: string; path: string; fileName: string; size: number; mimeType: string }[];
    };

    try {
        body = await request.json();
    } catch {
        return corsError("Invalid JSON body", 400);
    }

    const { apiKey, projectId, feedbackId, replyId, files } = body;

    if (!apiKey) return corsError("Missing API Key", 400);
    if (!projectId) return corsError("Missing project ID", 400);
    if (!files || !Array.isArray(files) || files.length === 0) return corsError("No files to confirm.", 400);

    const { project, identity, error, status } = await authenticateWidgetRequest(request, apiKey);
    if (error || !project || !identity) return corsError(error ?? "Unauthorized", status);

    // Verify the projectId in the body matches the resolved one (defensive)
    if (project.id !== projectId) return corsError("Project ID mismatch.", 403);

    const senderEmail = identity.email;
    const adminSupabase = createAdminClient();
    const attachments: { id: string; file_name: string; file_url: string; mime_type: string }[] = [];

    for (const file of files) {
        // Verify the file actually exists in storage
        const { data: fileData } = await adminSupabase.storage
            .from('feedback-attachments')
            .list(file.path.substring(0, file.path.lastIndexOf('/')), {
                search: file.path.substring(file.path.lastIndexOf('/') + 1),
            });

        if (!fileData || fileData.length === 0) {
            return corsError(`File "${file.fileName}" was not uploaded successfully.`, 400);
        }

        const { data: urlData } = adminSupabase.storage
            .from('feedback-attachments')
            .getPublicUrl(file.path);

        const { data: record, error: insertError } = await adminSupabase
            .from('feedback_attachments')
            .insert({
                id: file.fileId,
                feedback_id: feedbackId || null,
                reply_id: replyId || null,
                project_id: projectId,
                file_name: file.fileName,
                file_url: urlData.publicUrl,
                file_size: file.size,
                mime_type: file.mimeType,
                uploaded_by: senderEmail,
            })
            .select('id, file_name, file_url, mime_type')
            .single();

        if (insertError) {
            console.error("[VibeVaults] Attachment confirm insert error:", insertError);
            return corsError(`Failed to save "${file.fileName}".`, 500);
        }

        attachments.push(record);
    }

    return corsSuccess({ attachments });
}
