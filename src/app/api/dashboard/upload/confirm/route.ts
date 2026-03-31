/**
 * Main Responsibility: Confirm completed presigned uploads and create feedback_attachments records.
 * Called after the dashboard uploads files directly to Supabase Storage via presigned URLs.
 *
 * Sensitive Dependencies: feedback_attachments table, Supabase Storage (feedback-attachments bucket)
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
        projectId?: string;
        feedbackId?: string;
        replyId?: string | null;
        files?: { fileId: string; path: string; fileName: string; size: number; mimeType: string }[];
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { projectId, feedbackId, replyId, files } = body;

    if (!projectId) return NextResponse.json({ error: "Missing project ID" }, { status: 400 });
    if (!feedbackId) return NextResponse.json({ error: "Missing feedback ID" }, { status: 400 });
    if (!files || !Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ error: "No files to confirm." }, { status: 400 });
    }

    // Verify the feedback belongs to a project the user has access to
    const { data: feedback } = await supabase
        .from('feedbacks')
        .select('id, project_id')
        .eq('id', feedbackId)
        .single();

    if (!feedback || feedback.project_id !== projectId) {
        return NextResponse.json({ error: "Feedback not found or access denied" }, { status: 404 });
    }

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
            return NextResponse.json({ error: `File "${file.fileName}" was not uploaded successfully.` }, { status: 400 });
        }

        const { data: urlData } = adminSupabase.storage
            .from('feedback-attachments')
            .getPublicUrl(file.path);

        const { data: record, error: insertError } = await adminSupabase
            .from('feedback_attachments')
            .insert({
                id: file.fileId,
                feedback_id: feedbackId,
                reply_id: replyId || null,
                project_id: projectId,
                file_name: file.fileName,
                file_url: urlData.publicUrl,
                file_size: file.size,
                mime_type: file.mimeType,
                uploaded_by: user.email || user.id,
            })
            .select('id, file_name, file_url, mime_type')
            .single();

        if (insertError) {
            console.error("[VibeVaults] Dashboard confirm insert error:", insertError);
            return NextResponse.json({ error: `Failed to save "${file.fileName}"` }, { status: 500 });
        }

        attachments.push(record!);
    }

    return NextResponse.json({ attachments });
}
