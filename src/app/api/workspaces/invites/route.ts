/**
 * Main Responsibility: Secures API endpoints for issuing and revoking Workspace Invites. Manages
 * permission checks (owner only) and composes invite emails with links that defer account creation
 * until the invitee actively signs in (member invites) or visits the embedded widget (client invites).
 *
 * Sensitive Dependencies:
 * - Supabase Server Client (@/lib/supabase/server) for RLS protected insertions and role verifications.
 * - Supabase Admin Client (@/lib/supabase/admin) for bypassing RLS where necessary.
 * - Emails Notifications (@/lib/notifications) for delivery of the invitation emails.
 * - /auth/accept-invite page — resolves the invite token and runs sign-in + membership provisioning.
 *   Member invites link there directly; we deliberately do NOT call supabase.auth.admin.generateLink
 *   because that provisions an auth.users row before the invitee has consented to ToS / Privacy.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWorkspaceOwner } from "@/lib/role-helpers";
import { NextResponse } from "next/server";
import { sendWorkspaceInviteNotification, sendClientInviteNotification } from "@/lib/notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";
import { checkMemberLimit } from "@/lib/tier-helpers";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, workspaceId, role = 'member' } = body;

        if (!email || !workspaceId) {
            return new NextResponse("Email and Workspace ID are required", { status: 400 });
        }
        if (role !== 'member' && role !== 'client') {
            return new NextResponse("Invalid role", { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (!user || userError) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!(await isWorkspaceOwner(supabase, user.id, workspaceId))) {
            return new NextResponse("Forbidden: Only owners can invite members", { status: 403 });
        }

        // Check tier member limit (only for 'member' role — client invites are unlimited)
        if (role === 'member') {
            const limitCheck = await checkMemberLimit(workspaceId);
            if (!limitCheck.allowed) {
                return new NextResponse(limitCheck.message ?? 'Member limit reached', { status: 403 });
            }
        }

        // Prevent self-invites (owner inviting themselves as member or client)
        if (email.toLowerCase() === user.email?.toLowerCase()) {
            return new NextResponse("You already have access to this workspace", { status: 400 });
        }

        // Client invites email a list of project website URLs to visit, so we
        // require at least one project with a website_url. Members get
        // workspace-level dashboard access and don't need a project to exist.
        if (role === 'client') {
            const adminCheck = createAdminClient();
            const { data: projectsWithUrl } = await adminCheck
                .from('projects')
                .select('id')
                .eq('workspace_id', workspaceId)
                .not('website_url', 'is', null)
                .limit(1);

            if (!projectsWithUrl || projectsWithUrl.length === 0) {
                return new NextResponse(
                    "Please create a project with a website URL before inviting a client",
                    { status: 400 }
                );
            }
        }

        // Check if an invite already exists for this email in this workspace
        const { data: existingInvite } = await supabase
            .from('workspace_invites')
            .select('id, role')
            .eq('workspace_id', workspaceId)
            .eq('email', email)
            .single();

        if (existingInvite) {
            if (existingInvite.role === 'client') {
                return new NextResponse("This client already has access to this workspace", { status: 400 });
            }
            return new NextResponse("An invitation is already pending for this email", { status: 400 });
        }

        // Check if user is already an accepted member (only for 'member' invites)
        if (role === 'member') {
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .single();

            if (existingUser) {
                const { data: existingMember } = await supabase
                    .from('workspace_members')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .eq('user_id', existingUser.id)
                    .single();

                if (existingMember) {
                    return new NextResponse("This user is already a member of this workspace", { status: 400 });
                }
            }
        }

        // Insert into workspace_invites
        const { data: invite, error: inviteError } = await supabase
            .from('workspace_invites')
            .insert({
                workspace_id: workspaceId,
                email,
                role
            })
            .select()
            .single();

        if (inviteError) {
            if (inviteError.code === '23505') {
                return new NextResponse("Invite already sent to this email", { status: 400 });
            }
            return new NextResponse(inviteError.message, { status: 500 });
        }

        const { data: workspace } = await supabase
            .from('workspaces')
            .select('name')
            .eq('id', workspaceId)
            .single();

        // Send email via Resend
        if (role === 'member') {
            const BASE_URL = process.env.NEXT_PUBLIC_APP_URL!;

            // The invite ID doubles as the token — UUID v4 is unguessable enough, and the
            // /auth/accept-invite page gates acceptance on the authed user's email matching
            // the invite's target email, so leaked tokens alone can't be used to hijack an invite.
            const inviteLink = `${BASE_URL}/auth/accept-invite?token=${invite.id}`;

            const { unsubscribeToken: wsUnsubToken } = await getNotificationPrefs(email, 'replies');

            await sendWorkspaceInviteNotification({
                to: email,
                inviterName: user.user_metadata?.full_name || user.email || 'A colleague',
                workspaceName: workspace?.name || 'a workspace',
                inviteLink,
                unsubscribeToken: wsUnsubToken
            });
        }

        // For 'client' role, send a workspace-level invite email listing all projects
        // Use admin client to bypass RLS (the authed user may not own all projects in edge cases)
        if (role === 'client') {
            const adminSupabaseClient = createAdminClient();
            const { data: projects } = await adminSupabaseClient
                .from('projects')
                .select('name, website_url')
                .eq('workspace_id', workspaceId)
                .order('created_at', { ascending: true });

            const projectList: { name: string, url: string }[] = [];
            for (const p of (projects || [])) {
                if (!p.website_url) continue;
                try {
                    const siteUrl = new URL(p.website_url);
                    siteUrl.searchParams.set('vv_email', email);
                    projectList.push({ name: p.name, url: siteUrl.toString() });
                } catch {
                    // website_url is not a valid URL, include project name with raw url
                    projectList.push({ name: p.name, url: p.website_url });
                }
            }

            const { unsubscribeToken } = await getNotificationPrefs(email, 'replies');

            await sendClientInviteNotification({
                to: email,
                workspaceName: workspace?.name || 'a workspace',
                projects: projectList,
                unsubscribeToken
            });
        }

        // Send in-app notification if the invited user already has an account
        if (role === 'member') {
            const adminSupabaseForNotif = createAdminClient();
            const { data: invitedProfile } = await adminSupabaseForNotif
                .from('profiles')
                .select('id')
                .eq('email', email)
                .single();

            if (invitedProfile) {
                adminSupabaseForNotif
                    .from('notifications')
                    .insert({
                        user_id: invitedProfile.id,
                        type: 'workspace_invite',
                        title: 'Workspace Invitation',
                        message: `${user.user_metadata?.full_name || user.email || 'Someone'} invited you to join ${workspace?.name || 'a workspace'}`,
                        project_id: null
                    })
                    .then(() => {});
            }
        }

        return NextResponse.json(invite);
    } catch (error) {
        console.error("Invite error:", error);
        const msg = error instanceof Error ? error.message : 'Internal Server Error';
        return new NextResponse(msg, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const inviteId = searchParams.get('id');

        if (!inviteId) {
            return new NextResponse("Invite ID is required", { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get invite to check workspace
        const { data: invite } = await supabase
            .from('workspace_invites')
            .select('workspace_id')
            .eq('id', inviteId)
            .single();

        if (!invite) {
            return new NextResponse("Invite not found", { status: 404 });
        }

        if (!(await isWorkspaceOwner(supabase, user.id, invite.workspace_id))) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const { error } = await supabase
            .from('workspace_invites')
            .delete()
            .eq('id', inviteId);

        if (error) {
            return new NextResponse(error.message, { status: 500 });
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Internal Server Error';
        return new NextResponse(msg, { status: 500 });
    }
}
