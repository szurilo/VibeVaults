'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendWelcomeNotification } from '@/lib/notifications';

export async function createWorkspaceAction(name: string) {
    const supabase = await createClient();

    // Call the RPC function we just created
    const { data: newWorkspaceId, error } = await supabase
        .rpc('create_workspace', { input_name: name });

    if (error) {
        throw new Error(error.message);
    }

    // If this is the user's first owned workspace (e.g. a member creating their own),
    // reset onboarding so they see the owner-specific checklist.
    const { data: { user } } = await supabase.auth.getUser();
    const { count } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'owner');

    if (count === 1) {
        await supabase
            .from('profiles')
            .update({ has_onboarded: false, completed_onboarding_steps: [] })
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

    const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath('/dashboard/settings/users');
}

export async function leaveWorkspaceAction(workspaceId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id);

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath('/dashboard');
}
