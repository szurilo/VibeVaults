/**
 * Main Responsibility: Handle file uploads from authenticated dashboard users.
 * Validates auth, uploads to Supabase Storage, inserts into feedback_attachments.
 *
 * Sensitive Dependencies: Supabase Storage (feedback-attachments bucket), feedback_attachments table
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const feedbackId = formData.get("feedbackId") as string | null;
    const replyId = formData.get("replyId") as string | null;

    if (!feedbackId) {
        return NextResponse.json({ error: "Missing feedbackId" }, { status: 400 });
    }

    // Verify the feedback belongs to a project the user has access to
    const { data: feedback } = await supabase
        .from('feedbacks')
        .select('id, project_id')
        .eq('id', feedbackId)
        .single();

    if (!feedback) {
        return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    // Collect files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
        if (key === 'files' && value instanceof File) {
            files.push(value);
        }
    }

    if (files.length === 0) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
        return NextResponse.json({ error: `Maximum ${MAX_FILES_PER_REQUEST} files per upload` }, { status: 400 });
    }

    // Check storage limit for workspace owner
    const adminSupabaseForLimit = createAdminClient();
    const { data: project } = await adminSupabaseForLimit
        .from('projects')
        .select('workspace_id')
        .eq('id', feedback.project_id)
        .single();

    if (project) {
        const { data: workspace } = await adminSupabaseForLimit
            .from('workspaces')
            .select('owner_id')
            .eq('id', project.workspace_id)
            .single();

        if (workspace?.owner_id) {
            const totalSize = files.reduce((sum, f) => sum + f.size, 0);
            const storageCheck = await checkStorageLimit(workspace.owner_id, totalSize);
            if (!storageCheck.allowed) {
                return NextResponse.json({ error: storageCheck.message ?? 'Storage limit exceeded' }, { status: 403 });
            }
        }
    }

    // Validate files
    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `File "${file.name}" exceeds the 10MB limit` }, { status: 400 });
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json({ error: `File type "${file.type}" is not allowed` }, { status: 400 });
        }
    }

    const adminSupabase = createAdminClient();
    const uploaded: { id: string; file_name: string; file_url: string; mime_type: string }[] = [];

    for (const file of files) {
        const fileId = crypto.randomUUID();
        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `${feedback.project_id}/${fileId}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadError } = await adminSupabase.storage
            .from('feedback-attachments')
            .upload(storagePath, arrayBuffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("[VibeVaults] Dashboard upload error:", uploadError);
            return NextResponse.json({ error: `Failed to upload "${file.name}"` }, { status: 500 });
        }

        const { data: urlData } = adminSupabase.storage
            .from('feedback-attachments')
            .getPublicUrl(storagePath);

        const { data: record, error: insertError } = await adminSupabase
            .from('feedback_attachments')
            .insert({
                id: fileId,
                feedback_id: feedbackId,
                reply_id: replyId || null,
                project_id: feedback.project_id,
                file_name: file.name,
                file_url: urlData.publicUrl,
                file_size: file.size,
                mime_type: file.type,
                uploaded_by: user.email || user.id,
            })
            .select('id, file_name, file_url, mime_type')
            .single();

        if (insertError) {
            console.error("[VibeVaults] Dashboard attachment insert error:", insertError);
            return NextResponse.json({ error: `Failed to save "${file.name}"` }, { status: 500 });
        }

        uploaded.push(record!);
    }

    return NextResponse.json({ attachments: uploaded });
}
