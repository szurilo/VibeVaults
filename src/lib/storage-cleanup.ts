/**
 * Main Responsibility: Clean up Supabase Storage files when projects, workspaces, or accounts are deleted.
 * Sensitive Dependencies: Supabase Storage buckets (feedback-attachments, workspace-logos)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Remove all files under a folder in a Supabase Storage bucket. */
async function clearBucketFolder(
    client: SupabaseClient,
    bucket: string,
    folder: string
) {
    const { data: files } = await client.storage.from(bucket).list(folder);
    if (files && files.length > 0) {
        await client.storage
            .from(bucket)
            .remove(files.map(f => `${folder}/${f.name}`));
    }
}

/** Delete all feedback-attachment files for a single project. */
export async function cleanupProjectStorage(
    client: SupabaseClient,
    projectId: string
) {
    await clearBucketFolder(client, 'feedback-attachments', projectId);
}

/** Delete all storage files for a workspace: feedback-attachments for all its projects + workspace logo. */
export async function cleanupWorkspaceStorage(
    client: SupabaseClient,
    workspaceId: string
) {
    const { data: projects } = await client
        .from('projects')
        .select('id')
        .eq('workspace_id', workspaceId);

    if (projects) {
        for (const project of projects) {
            await cleanupProjectStorage(client, project.id);
        }
    }

    await clearBucketFolder(client, 'workspace-logos', workspaceId);
}
