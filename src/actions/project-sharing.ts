'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleProjectSharing(projectId: string, enable: boolean) {
    const supabase = await createClient();

    if (enable) {
        // Check if project has a share token
        const { data: project, error: fetchError } = await supabase
            .from('projects')
            .select('share_token')
            .eq('id', projectId)
            .single();

        if (fetchError) {
            console.error("Error fetching project:", fetchError);
            throw new Error("Failed to fetch project details");
        }

        if (!project?.share_token) {
            const token = crypto.randomUUID();
            const { error: updateError } = await supabase.from('projects').update({
                share_token: token,
                is_sharing_enabled: true
            }).eq('id', projectId);

            if (updateError) {
                console.error("Failed to generate share token and enable:", updateError);
                throw new Error("Failed to enable sharing");
            }
        } else {
            const { error: updateError } = await supabase
                .from('projects')
                .update({ is_sharing_enabled: true })
                .eq('id', projectId);

            if (updateError) {
                console.error("Failed to enable sharing:", updateError);
                throw new Error("Failed to enable sharing");
            }
        }
    } else {
        const { error: updateError } = await supabase
            .from('projects')
            .update({ is_sharing_enabled: false })
            .eq('id', projectId);

        if (updateError) {
            console.error("Failed to disable sharing:", updateError);
            throw new Error("Failed to disable sharing");
        }
    }

    revalidatePath('/dashboard/settings');
}
