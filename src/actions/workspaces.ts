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
