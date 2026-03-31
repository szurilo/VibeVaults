/**
 * Main Responsibility: Generate presigned upload URLs for dashboard file attachments.
 * Validates auth + project access, checks tier limits, returns signed URLs
 * so the client uploads directly to Supabase Storage (bypassing Vercel body size limits).
 *
 * Sensitive Dependencies: Supabase Storage (feedback-attachments bucket), tier-helpers
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

    let body: {
        feedbackId?: string;
        files?: { name: string; size: number; type: string }[];
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { feedbackId, files } = body;

    if (!feedbackId) {
        return NextResponse.json({ error: "Missing feedbackId" }, { status: 400 });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
        return NextResponse.json({ error: `Maximum ${MAX_FILES_PER_REQUEST} files per upload` }, { status: 400 });
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

    // Check storage limit for workspace owner
    const adminSupabase = createAdminClient();
    const { data: project } = await adminSupabase
        .from('projects')
        .select('workspace_id')
        .eq('id', feedback.project_id)
        .single();

    if (project) {
        const { data: workspace } = await adminSupabase
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

    // Validate files metadata
    for (const file of files) {
        if (!file.name || !file.size || !file.type) {
            return NextResponse.json({ error: "Each file must have name, size, and type." }, { status: 400 });
        }
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `File "${file.name}" exceeds the 10MB limit` }, { status: 400 });
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json({ error: `File type "${file.type}" is not allowed` }, { status: 400 });
        }
    }

    // Generate presigned upload URLs
    const uploads: { fileId: string; path: string; signedUrl: string; token: string; fileName: string; mimeType: string }[] = [];

    for (const file of files) {
        const fileId = crypto.randomUUID();
        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `${feedback.project_id}/${fileId}.${ext}`;

        const { data, error: signError } = await adminSupabase.storage
            .from('feedback-attachments')
            .createSignedUploadUrl(storagePath);

        if (signError || !data) {
            console.error("[VibeVaults] Dashboard signed URL error:", signError);
            return NextResponse.json({ error: `Failed to prepare upload for "${file.name}"` }, { status: 500 });
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

    return NextResponse.json({
        projectId: feedback.project_id,
        feedbackId: feedback.id,
        uploads,
    });
}
