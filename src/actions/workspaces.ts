'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createWorkspaceAction(name: string) {
    const supabase = await createClient();

    // Call the RPC function we just created
    const { data: newWorkspaceId, error } = await supabase
        .rpc('create_workspace', { input_name: name });

    if (error) {
        throw new Error(error.message);
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
