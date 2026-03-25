/**
 * Main Responsibility: Secure API endpoints for listing or inserting Projects. Heavily restricted by 
 * database-level RLS policies to ensure users only access or mutate data within their active workspaces (single-owned, multi-joined).
 * 
 * Sensitive Dependencies: 
 * - @/lib/supabase/server to safely execute DB transactions securely impersonating the calling user.
 * - next/headers (cookies) to lock REST `GET` returns directly to the user's `selectedWorkspaceId`.
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNotificationPrefs } from "@/lib/notification-prefs";
import { sendProjectCreatedNotification } from "@/lib/notifications";
import { checkProjectLimit } from "@/lib/tier-helpers";

export async function GET() {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("selectedWorkspaceId")?.value;

    let query = supabase.from("projects").select("*").order("created_at", { ascending: true });

    if (workspaceId) {
        query = query.eq("workspace_id", workspaceId);
    }

    const { data: projects, error } = await query;

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json(projects);
}

export async function POST(req: Request) {
    const body = await req.json();
    const { name, website_url, workspace_id } = body;

    if (!name) {
        return new NextResponse("Project name is required", { status: 400 });
    }

    if (!website_url) {
        return new NextResponse("Website URL is required", { status: 400 });
    }

    if (!workspace_id) {
        return new NextResponse("Workspace ID is required", { status: 400 });
    }

    const supabase = await createClient();
    // User auth context is securely handled by the `auth` object, we don't need getClaims for RLS if RLS is enabled,
    // but we can enforce server-side validation here.
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user || userError) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check tier project limit for this workspace
    const limitCheck = await checkProjectLimit(workspace_id, user.id);
    if (!limitCheck.allowed) {
        return new NextResponse(limitCheck.message ?? 'Project limit reached', { status: 403 });
    }

    const { data: project, error } = await supabase
        .from("projects")
        .insert({
            name,
            website_url,
            user_id: user.id, // we still keep user_id as the creator
            workspace_id
        })
        .select()
        .single();

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    // Notify workspace members via email (batch API for multiple recipients)
    try {
        const adminSupabase = createAdminClient();

        const [{ data: workspace }, { data: memberRows }] = await Promise.all([
            adminSupabase.from('workspaces').select('name').eq('id', workspace_id).single(),
            adminSupabase.from('workspace_members').select('user_id').eq('workspace_id', workspace_id)
        ]);

        if (memberRows && memberRows.length > 0 && workspace) {
            const memberIds = memberRows.filter((m: any) => m.user_id !== user.id).map((m: any) => m.user_id);

            const { data: profiles } = await adminSupabase
                .from('profiles')
                .select('email')
                .in('id', memberIds);

            if (profiles) {
                const creatorName = user.email?.split('@')[0] || 'A team member';

                for (const p of profiles) {
                    const email = p.email;
                    if (!email) continue;

                    const prefs = await getNotificationPrefs(email, 'project_created');
                    if (!prefs.shouldNotify) continue;

                    await sendProjectCreatedNotification({
                        to: email,
                        projectName: name,
                        creatorName,
                        workspaceName: workspace.name,
                        unsubscribeToken: prefs.unsubscribeToken
                    });
                }
            }
        }
    } catch (e) {
        console.error("VibeVaults: Project email notification error", e);
    }

    return NextResponse.json(project);
}
