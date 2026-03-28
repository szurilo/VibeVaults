/**
 * Main Responsibility: Server-side operations for project management (deletion with notifications).
 *
 * Sensitive Dependencies:
 * - Supabase Server Client (@/lib/supabase/server) for authenticated operations.
 * - Supabase Admin Client (@/lib/supabase/admin) for fetching workspace members bypassing RLS.
 * - Notifications library (@/lib/notifications) for email dispatch.
 * - Storage cleanup (@/lib/storage-cleanup) for removing attachment files.
 */
'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getNotificationPrefs } from "@/lib/notification-prefs";
import { sendProjectDeletedNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupProjectStorage } from "@/lib/storage-cleanup";

export async function deleteProjectAction(projectId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "You must be logged in to delete a project." };

    // Fetch project details before deletion (needed for notifications)
    const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, workspace_id')
        .eq('id', projectId)
        .single();

    if (fetchError || !project) return { error: "Project not found or you no longer have access." };

    // Fetch workspace info and members before deletion (for email notifications)
    const adminSupabase = createAdminClient();
    const [{ data: workspace }, { data: memberRows }] = await Promise.all([
        adminSupabase.from('workspaces').select('name').eq('id', project.workspace_id).single(),
        adminSupabase.from('workspace_members').select('user_id').eq('workspace_id', project.workspace_id)
    ]);

    // Clean up storage files
    await cleanupProjectStorage(supabase, projectId);

    // Delete the project (DB trigger handles bell notifications)
    const { data, error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .select('id');

    if (deleteError) return { error: "Failed to delete project." };
    if (!data || data.length === 0) return { error: "Project not found or you no longer have access." };

    // Send email notifications to workspace members (excluding the deleter)
    try {
        if (memberRows && memberRows.length > 0 && workspace) {
            const memberIds = memberRows.filter(m => m.user_id !== user.id).map(m => m.user_id);

            const { data: profiles } = await adminSupabase
                .from('profiles')
                .select('email')
                .in('id', memberIds);

            if (profiles) {
                const deleterName = user.email?.split('@')[0] || 'A team member';

                for (const p of profiles) {
                    const email = p.email;
                    if (!email) continue;

                    const prefs = await getNotificationPrefs(email, 'project_deleted');
                    if (!prefs.shouldNotify) continue;

                    await sendProjectDeletedNotification({
                        to: email,
                        projectName: project.name,
                        deleterName,
                        workspaceName: workspace.name,
                        unsubscribeToken: prefs.unsubscribeToken
                    });
                }
            }
        }
    } catch (e) {
        console.error("VibeVaults: Project deletion email notification error", e);
    }

    revalidatePath('/dashboard');
    return { error: null };
}
