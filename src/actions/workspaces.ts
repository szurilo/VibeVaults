'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { sendWelcomeNotification, sendMemberRemovedNotification, sendMemberLeftNotification } from '@/lib/notifications';
import { checkWorkspaceLimit } from '@/lib/tier-helpers';

export async function createWorkspaceAction(name: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    // Check tier workspace limit before creating
    const limitCheck = await checkWorkspaceLimit(user.id);
    if (!limitCheck.allowed) {
        return { error: limitCheck.message };
    }

    // Call the RPC function we just created
    const { data: newWorkspaceId, error } = await supabase
        .rpc('create_workspace', { input_name: name });

    if (error) {
        throw new Error(error.message);
    }

    // If this is the user's first owned workspace (e.g. a member creating their own),
    // reset onboarding so they see the owner-specific checklist.
    const { count } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('role', 'owner');

    if (count === 1) {
        // No need to reset completed_onboarding_steps — steps are now
        // workspace-scoped (prefixed with workspaceId), so a new workspace
        // naturally starts with no completed steps.
        await supabase
            .from('profiles')
            .update({ has_onboarded: false })
            .eq('id', user!.id);

        // Send welcome email on first workspace creation (owner only)
        const { data: profile } = await supabase
            .from('profiles')
            .select('welcome_email_sent')
            .eq('id', user!.id)
            .single();

        if (profile && !profile.welcome_email_sent) {
            await supabase
                .from('profiles')
                .update({ welcome_email_sent: true })
                .eq('id', user!.id);

            const email = user!.email || 'friend';
            const nameStr = email.split('@')[0];
            const formattedName = nameStr.charAt(0).toUpperCase() + nameStr.slice(1);
            sendWelcomeNotification({ to: email, name: formattedName }).catch(e =>
                console.error('Failed to send welcome email:', e)
            );
        }
    }

    revalidatePath('/dashboard');
    return newWorkspaceId as string;
}

export async function removeMemberAction(workspaceId: string, userId: string) {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Gather info before deleting membership
    const [{ data: { user: currentUser } }, { data: workspace }, { data: removedProfile }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('workspaces').select('name').eq('id', workspaceId).single(),
        adminSupabase.from('profiles').select('email').eq('id', userId).single()
    ]);

    const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

    if (error) {
        throw new Error(error.message);
    }

    // Send in-app notification + email to removed member (fire-and-forget)
    const workspaceName = workspace?.name || 'Unknown workspace';
    const removerName = currentUser?.email?.split('@')[0] || 'The workspace owner';

    adminSupabase.from('notifications').insert({
        user_id: userId,
        type: 'member_removed',
        title: 'Access Revoked',
        message: `You have been removed from ${workspaceName}`
    }).then(() => {});

    if (removedProfile?.email) {
        sendMemberRemovedNotification({
            to: removedProfile.email,
            workspaceName,
            removedByName: removerName
        }).catch(e => console.error('Failed to send member removed email:', e));
    }

    revalidatePath('/dashboard/settings/users');
}

export async function leaveWorkspaceAction(workspaceId: string) {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    // Gather info before deleting membership
    const { data: workspace } = await supabase
        .from('workspaces')
        .select('name, owner_id')
        .eq('id', workspaceId)
        .single();

    const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id);

    if (error) {
        throw new Error(error.message);
    }

    // Send in-app notification + email to workspace owner (fire-and-forget)
    const workspaceName = workspace?.name || 'Unknown workspace';
    const memberName = user.email?.split('@')[0] || 'A member';

    if (workspace?.owner_id) {
        adminSupabase.from('notifications').insert({
            user_id: workspace.owner_id,
            type: 'member_left',
            title: 'Member Left',
            message: `${memberName} has left ${workspaceName}`
        }).then(() => {});

        const { data: ownerProfile } = await adminSupabase
            .from('profiles')
            .select('email')
            .eq('id', workspace.owner_id)
            .single();

        if (ownerProfile?.email) {
            sendMemberLeftNotification({
                to: ownerProfile.email,
                workspaceName,
                memberName
            }).catch(e => console.error('Failed to send member left email:', e));
        }
    }

    revalidatePath('/dashboard');
}
