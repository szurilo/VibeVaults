'use server';

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getWorkspaceOwnerTier } from "@/lib/tier-helpers";

export async function toggleProjectSharing(projectId: string, enable: boolean) {
    const supabase = await createClient();

    if (enable) {
        // Check if the workspace owner's tier allows public dashboard sharing
        const adminSupabase = createAdminClient();
        const { data: proj } = await adminSupabase
            .from('projects')
            .select('workspace_id')
            .eq('id', projectId)
            .single();

        if (!proj) {
            return { error: 'Project not found.' };
        }

        const { effectiveLimits } = await getWorkspaceOwnerTier(proj.workspace_id);
        if (!effectiveLimits.publicDashboard) {
            return { error: 'Public dashboard sharing is available on Pro and Business plans. Upgrade to unlock.' };
        }
        // Check if project has a share token
        const { data: project, error: fetchError } = await supabase
            .from('projects')
            .select('share_token')
            .eq('id', projectId)
            .single();

        if (fetchError) {
            console.error("Error fetching project:", fetchError);
            return { error: "You no longer have access to this project. Your access may have been revoked." };
        }

        if (!project?.share_token) {
            const token = crypto.randomUUID();
            const { error: updateError } = await supabase.from('projects').update({
                share_token: token,
                is_sharing_enabled: true
            }).eq('id', projectId);

            if (updateError) {
                console.error("Failed to generate share token and enable:", updateError);
                return { error: "Failed to enable sharing." };
            }
        } else {
            const { error: updateError } = await supabase
                .from('projects')
                .update({ is_sharing_enabled: true })
                .eq('id', projectId);

            if (updateError) {
                console.error("Failed to enable sharing:", updateError);
                return { error: "Failed to enable sharing." };
            }
        }
    } else {
        const { error: updateError } = await supabase
            .from('projects')
            .update({ is_sharing_enabled: false })
            .eq('id', projectId);

        if (updateError) {
            console.error("Failed to disable sharing:", updateError);
            return { error: "Failed to disable sharing." };
        }
    }

    revalidatePath('/dashboard/settings');
    return { error: null };
}
