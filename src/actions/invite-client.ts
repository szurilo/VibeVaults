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

    // Record the invite in the database
    const { error: insertError } = await supabase
        .from('project_invites')
        .insert({
            project_id: projectId,
            email: clientEmail
        });

    // If there is an existing invite, we just silently ignore the conflict
    if (insertError && insertError.code !== '23505') {
        console.error("Failed to record invite", insertError);
        // We still return success if the email actually sent, but this is a side effect.
    }

    return { success: true };
}

export async function getProjectInvitesAction(projectId: string) {
    const supabase = await createClient();

    // RLS policy ensures user can only get invites for their own project
    const { data: invites, error } = await supabase
        .from('project_invites')
        .select('id, email, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (error) {
        return { success: false, error: "Failed to fetch invites." };
    }

    return { success: true, invites };
}

export async function revokeClientInviteAction(inviteId: string) {
    const supabase = await createClient();

    // RLS policy ensures user can only delete invites for their own projects
    const { error } = await supabase
        .from('project_invites')
        .delete()
        .eq('id', inviteId);

    if (error) {
        return { success: false, error: "Failed to revoke invite." };
    }

    return { success: true };
}
