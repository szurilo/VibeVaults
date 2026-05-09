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
import { shouldSendProjectEventImmediately, recordEmailSent, queueDigestEmail } from "@/lib/email-digest";
import { issueWidgetIdentity } from "@/lib/widget-helpers";

/**
 * Builds a project-specific URL that activates the widget on the host site
 * for a particular recipient. Clients get a `?vv_invite=<inviteId>` URL the
 * widget exchanges for a token; members get a freshly-issued raw token via
 * `?vv_token=<token>` so the widget plants it directly. Returns null if the
 * project has no website URL configured.
 */
function buildWidgetActivationUrl(
    websiteUrl: string | null,
    params: { vv_invite?: string; vv_token?: string }
): string | null {
    if (!websiteUrl) return null;
    try {
        const url = new URL(websiteUrl);
        if (params.vv_invite) url.searchParams.set('vv_invite', params.vv_invite);
        if (params.vv_token) url.searchParams.set('vv_token', params.vv_token);
        return url.toString();
    } catch {
        const sep = websiteUrl.includes('?') ? '&' : '?';
        if (params.vv_invite) return `${websiteUrl}${sep}vv_invite=${encodeURIComponent(params.vv_invite)}`;
        if (params.vv_token) return `${websiteUrl}${sep}vv_token=${encodeURIComponent(params.vv_token)}`;
        return websiteUrl;
    }
}

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

    // Notify workspace members AND clients via email. Members get a freshly
    // issued widget token (`?vv_token=`); clients get their persistent invite
    // ID (`?vv_invite=`). Either way, opening the link on the host site
    // activates the widget for that recipient on that device.
    try {
        const adminSupabase = createAdminClient();

        const [
            { data: workspace },
            { data: memberRows },
            { data: clientInvites }
        ] = await Promise.all([
            adminSupabase.from('workspaces').select('name').eq('id', workspace_id).single(),
            adminSupabase.from('workspace_members').select('user_id').eq('workspace_id', workspace_id),
            adminSupabase.from('workspace_invites').select('id, email').eq('workspace_id', workspace_id).eq('role', 'client'),
        ]);

        if (workspace) {
            const creatorName = user.email?.split('@')[0] || 'A team member';
            const websiteUrl: string | null = project.website_url ?? null;

            // --- Members ---
            if (memberRows && memberRows.length > 0) {
                const memberIds = memberRows
                    .filter((m: { user_id: string }) => m.user_id !== user.id)
                    .map((m: { user_id: string }) => m.user_id);

                const { data: profiles } = memberIds.length > 0
                    ? await adminSupabase.from('profiles').select('id, email').in('id', memberIds)
                    : { data: [] as { id: string; email: string | null }[] };

                for (const p of (profiles || [])) {
                    const email = p.email;
                    if (!email) continue;

                    const prefs = await getNotificationPrefs(email, 'project_created');
                    if (!prefs.shouldNotify) continue;

                    const payload = { projectName: name, actorName: creatorName, workspaceName: workspace.name, type: 'created', workspaceId: workspace_id, projectId: project.id };
                    const sendNow = await shouldSendProjectEventImmediately(email, 'project_created');

                    if (sendNow) {
                        let widgetUrl: string | null = null;
                        if (websiteUrl) {
                            try {
                                const rawToken = await issueWidgetIdentity({
                                    projectId: project.id,
                                    email,
                                    userId: p.id,
                                });
                                widgetUrl = buildWidgetActivationUrl(websiteUrl, { vv_token: rawToken });
                            } catch (e) {
                                console.error('Failed to issue widget identity for member project-created email', e);
                            }
                        }

                        await sendProjectCreatedNotification({
                            to: email,
                            projectName: name,
                            creatorName,
                            workspaceName: workspace.name,
                            unsubscribeToken: prefs.unsubscribeToken,
                            workspaceId: workspace_id,
                            projectId: project.id,
                            widgetUrl: widgetUrl ?? undefined,
                            recipientKind: 'member',
                        });
                        await recordEmailSent({
                            recipientEmail: email,
                            notificationType: 'project_created',
                            projectId: project.id,
                            payload
                        });
                    } else {
                        await queueDigestEmail({
                            recipientEmail: email,
                            notificationType: 'project_created',
                            projectId: project.id,
                            payload
                        });
                    }
                }
            }

            // --- Clients ---
            for (const invite of (clientInvites || [])) {
                const email = invite.email;
                if (!email) continue;

                const prefs = await getNotificationPrefs(email, 'project_created');
                if (!prefs.shouldNotify) continue;

                const payload = { projectName: name, actorName: creatorName, workspaceName: workspace.name, type: 'created', workspaceId: workspace_id, projectId: project.id };
                const sendNow = await shouldSendProjectEventImmediately(email, 'project_created');

                if (sendNow) {
                    const widgetUrl = buildWidgetActivationUrl(websiteUrl, { vv_invite: invite.id });

                    await sendProjectCreatedNotification({
                        to: email,
                        projectName: name,
                        creatorName,
                        workspaceName: workspace.name,
                        unsubscribeToken: prefs.unsubscribeToken,
                        workspaceId: workspace_id,
                        projectId: project.id,
                        widgetUrl: widgetUrl ?? undefined,
                        recipientKind: 'client',
                    });
                    await recordEmailSent({
                        recipientEmail: email,
                        notificationType: 'project_created',
                        projectId: project.id,
                        payload
                    });
                } else {
                    await queueDigestEmail({
                        recipientEmail: email,
                        notificationType: 'project_created',
                        projectId: project.id,
                        payload
                    });
                }
            }
        }
    } catch (e) {
        console.error("VibeVaults: Project email notification error", e);
    }

    return NextResponse.json(project);
}
