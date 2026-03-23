/**
 * Main Responsibility: Lightweight email verification for the widget. Checks if an email
 * belongs to a workspace member (owner/member) or an invited client, so the widget can
 * show/hide itself without requiring a vv_email URL parameter.
 *
 * Sensitive Dependencies:
 * - Supabase Admin Client (@/lib/supabase/admin) for bypassing RLS to check profiles + memberships.
 * - Widget Helpers (@/lib/widget-helpers) for CORS, rate limiting, and API key validation.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { corsError, corsSuccess, optionsResponse, validateApiKey, isRateLimited } from "@/lib/widget-helpers";

export async function OPTIONS() {
    return optionsResponse();
}

export async function GET(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:verify-email")) return corsError("Too many requests. Please try again later.", 429);

    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("key");
    const email = searchParams.get("email");

    if (!apiKey) {
        return corsError("Missing API Key", 400);
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return corsError("Invalid email address", 400);
    }

    const { project, error, status } = await validateApiKey(apiKey);
    if (error) {
        return corsError(error, status);
    }

    const adminSupabase = createAdminClient();

    // Check if email belongs to a workspace member (owner/member)
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

    if (profile) {
        const { data: membership } = await adminSupabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', project.workspace_id)
            .eq('user_id', profile.id)
            .single();

        if (membership) {
            return corsSuccess({ authorized: true });
        }
    }

    // Check if email is in workspace_invites (for clients)
    const { data: invite } = await adminSupabase
        .from('workspace_invites')
        .select('id')
        .eq('workspace_id', project.workspace_id)
        .eq('email', email)
        .single();

    if (invite) {
        return corsSuccess({ authorized: true });
    }

    return corsSuccess({ authorized: false });
}
