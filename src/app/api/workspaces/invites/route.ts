/**
 * Main Responsibility: Secures API endpoints for issuing and revoking Workspace Invites. Manages
 * permission checks (owner only) and generates appropriate Supabase Magic Links depending on member vs. client roles.
 * 
 * Sensitive Dependencies: 
 * - Supabase Server Client (@/lib/supabase/server) for RLS protected insertions and role verifications.
 * - Supabase Admin Client (@/lib/supabase/admin) for generating Auth Magic Links programmatically.
 * - Emails Notifications (@/lib/notifications) for final delivery of the generated auth links.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendWorkspaceInviteNotification, sendClientInviteNotification } from "@/lib/notifications";
import { getNotificationPrefs } from "@/lib/notification-prefs";

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

        // Verify user is owner of this workspace
        const { data: membership } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user.id)
            .single();

        if (!membership || membership.role !== 'owner') {
            return new NextResponse("Forbidden: Only owners can invite members", { status: 403 });
        }

        // Prevent self-invites (owner inviting themselves as member or client)
        if (email.toLowerCase() === user.email?.toLowerCase()) {
            return new NextResponse("You already have access to this workspace", { status: 400 });
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

            const adminSupabase = createAdminClient();
            const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
                type: 'magiclink',
                email: email,
                options: {
                    redirectTo: `${BASE_URL}/dashboard`
                }
            });

            if (linkError) {
                console.error("Failed to generate magic link:", linkError);
                return new NextResponse("Failed to generate access link", { status: 500 });
            }

            const hashedToken = linkData.properties?.hashed_token;
            const verificationType = linkData.properties?.verification_type || 'magiclink';
            const inviteLink = hashedToken
                ? `${BASE_URL}/auth/confirm?token_hash=${hashedToken}&type=${verificationType}&next=/dashboard`
                : `${BASE_URL}/auth/login?invite=${invite.id}`;

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
    } catch (error: any) {
        console.error("Invite error:", error);
        return new NextResponse(error.message || "Internal Server Error", { status: 500 });
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

        // Verify user is owner
        const { data: membership } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', invite.workspace_id)
            .eq('user_id', user.id)
            .single();

        if (!membership || membership.role !== 'owner') {
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
    } catch (error: any) {
        return new NextResponse(error.message || "Internal Server Error", { status: 500 });
    }
}
