'use server';

import { createClient } from "@/lib/supabase/server";
import { sendClientInviteNotification } from "@/lib/notifications";

export async function inviteClientAction(projectId: string, clientEmail: string) {
    const supabase = await createClient();

    // Verify project belongs to current user
    const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

    if (fetchError || !project) {
        return { success: false, error: "Project not found or unauthorized" };
    }

    if (!project.website_url) {
        return { success: false, error: "Please configure a Website URL in Project Settings first." }
    }

    // Clean up target URL just in case
    let cleanUrl = project.website_url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
    }

    // Add vv_email tracking param. We must be able to parse it using URL
    let finalUrl = cleanUrl;
    try {
        const urlObj = new URL(cleanUrl);
        urlObj.searchParams.set('vv_email', clientEmail);
        finalUrl = urlObj.toString();
    } catch (e) {
        return { success: false, error: "Invalid website URL format." };
    }

    const { error: emailError } = await sendClientInviteNotification({
        to: clientEmail,
        projectName: project.name,
        inviteLink: finalUrl
    });

    if (emailError) {
        console.error("Failed to send invite email", emailError);
        return { success: false, error: "Failed to send invite email." };
    }

    return { success: true };
}
