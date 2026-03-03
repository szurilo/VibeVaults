import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendWorkspaceInviteNotification } from "@/lib/notifications";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, workspaceId } = body;

        if (!email || !workspaceId) {
            return new NextResponse("Email and Workspace ID are required", { status: 400 });
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

        // Check if user is already a member
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
                return new NextResponse("User is already a member of this workspace", { status: 400 });
            }
        }

        // Insert into workspace_invites
        const { data: invite, error: inviteError } = await supabase
            .from('workspace_invites')
            .insert({
                workspace_id: workspaceId,
                email,
                role: 'member'
            })
            .select()
            .single();

        if (inviteError) {
            if (inviteError.code === '23505') {
                return new NextResponse("Invite already sent to this email", { status: 400 });
            }
            return new NextResponse(inviteError.message, { status: 500 });
        }

        // Send email via Resend
        // Generate a simple invite link. 
        // We will just send them to /auth/login.
        // Once they sign up/login, our auth flow/callback will need to check the invites table.
        const BASE_URL = process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000'
            : 'https://www.vibe-vaults.com';
        const inviteLink = `${BASE_URL}/auth/login?invite=${invite.id}`;

        const { data: workspace } = await supabase
            .from('workspaces')
            .select('name')
            .eq('id', workspaceId)
            .single();

        await sendWorkspaceInviteNotification({
            to: email,
            inviterName: user.user_metadata?.full_name || user.email || 'A colleague',
            workspaceName: workspace?.name || 'a workspace',
            inviteLink
        });

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
