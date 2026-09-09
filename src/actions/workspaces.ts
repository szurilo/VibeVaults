'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sendMemberRemovedNotification } from '@/lib/notifications';
import { notifyOwnerMemberDeparted } from '@/lib/workspace-notifications';
import { checkWorkspaceLimit, getUserTier, isTrialExpired } from '@/lib/tier-helpers';

export async function createWorkspaceAction(name: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    // Billing gate, matching the locked Create Workspace control in the
    // switcher. Without it a lapsed owner can still create workspaces: their
    // `subscription_tier` is null, and getTierLimits() treats null as Pro (for
    // trial users), so the limit check below would allow up to three.
    //
    // Gated on the caller's OWN plan having *run out*, not merely being absent:
    // `trialStarted` false means they have never owned a workspace, and creating
    // their first one is exactly what starts their trial.
    const tierInfo = await getUserTier(user.id);
    if (tierInfo.trialStarted && isTrialExpired(tierInfo)) {
        return { error: 'Your subscription is inactive. Renew your plan to create a workspace.' };
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

    const workspaceName = workspace?.name || 'Unknown workspace';
    const removerName = currentUser?.email?.split('@')[0] || 'The workspace owner';

    // In-app notification + email to the removed member. Deliberately not
    // blocking the response, but via `after()` rather than a bare un-awaited
    // promise: on Vercel the instance can be frozen the moment the action
    // returns, silently dropping whatever is still in flight.
    after(async () => {
        const { error: notifError } = await adminSupabase.from('notifications').insert({
            user_id: userId,
            type: 'member_removed',
            title: 'Access Revoked',
            message: `You have been removed from ${workspaceName}`
        });

        if (notifError) {
            console.error('Failed to insert member removed notification:', notifError);
        }

        if (removedProfile?.email) {
            try {
                await sendMemberRemovedNotification({
                    to: removedProfile.email,
                    workspaceName,
                    removedByName: removerName
                });
            } catch (e) {
                console.error('Failed to send member removed email:', e);
            }
        }
    });

    revalidatePath('/dashboard/settings/users');
}

export async function leaveWorkspaceAction(workspaceId: string) {
    const supabase = await createClient();
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

    if (workspace?.owner_id) {
        const ownerId = workspace.owner_id;
        const departedWorkspaceName = workspace.name || 'Unknown workspace';
        const memberName = user.email?.split('@')[0] || 'A member';

        // See removeMemberAction: `after()` keeps the invocation alive so the
        // owner's notification survives the response returning.
        after(async () => {
            try {
                await notifyOwnerMemberDeparted({
                    workspaceId,
                    workspaceName: departedWorkspaceName,
                    ownerId,
                    memberName,
                    reason: 'left'
                });
            } catch (e: unknown) {
                console.error('Failed to notify owner of member leave:', e);
            }
        });
    }

    revalidatePath('/dashboard');
}
