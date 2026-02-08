'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleProjectSharing(projectId: string, enable: boolean) {
    const supabase = await createClient();

    if (enable) {
        const { data: project } = await supabase
            .from('projects')
            .select('share_token')
            .eq('id', projectId)
            .single();

        if (!project?.share_token) {
            const token = crypto.randomUUID();
            const { error: updateError } = await supabase.from('projects').update({
                share_token: token,
                is_sharing_enabled: true
            }).eq('id', projectId);

            if (updateError) {
                console.error("Failed to generate share token:", updateError);
                throw new Error("Failed to enable sharing");
            }
        } else {
            const { error: updateError } = await supabase
                .from('projects')
                .update({ is_sharing_enabled: true })
                .eq('id', projectId);

            if (updateError) {
                console.error("Failed to update sharing status (enable):", updateError);
                throw new Error("Failed to enable sharing");
            }
        }
    } else {
        await supabase
            .from('projects')
            .update({ is_sharing_enabled: false })
            .eq('id', projectId);
    }

    revalidatePath('/dashboard/settings');
}
