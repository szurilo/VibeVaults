/**
 * Main Responsibility: Exchanges a one-time bootstrap token (a workspace_invites.id
 * for clients) for a long-lived per-device widget identity token. Called by
 * widget.js when it sees a `?vv_invite=` URL parameter on first load on a host
 * site. The returned token is stored in the host site's localStorage and sent
 * as a Bearer credential on subsequent widget API calls.
 *
 * Sensitive Dependencies:
 * - Supabase Admin Client: bypasses RLS to look up workspace_invites and insert
 *   widget_identities (clients have no auth.users row in the new model).
 * - validateApiKey: enforces project existence + workspace owner's active
 *   subscription/trial — disabled widgets cannot bootstrap new sessions.
 *
 * Security notes:
 * - The bootstrap token (workspace_invites.id) is a UUID v4, unguessable.
 * - Cross-workspace use is prevented: invite.workspace_id must match the
 *   project's workspace.
 * - Multi-device by design: each successful exchange creates a fresh row,
 *   so two browsers can hold tokens for the same email simultaneously.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
    corsError,
    corsSuccess,
    optionsResponse,
    validateApiKey,
    isRateLimited,
    issueWidgetIdentity,
} from "@/lib/widget-helpers";

export async function OPTIONS() {
    return optionsResponse();
}

export async function POST(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:identity:exchange")) {
        return corsError("Too many requests. Please try again later.", 429);
    }

    let body: { apiKey?: string; inviteToken?: string };
    try {
        body = await request.json();
    } catch {
        return corsError("Invalid request body.", 400);
    }

    const { apiKey, inviteToken } = body;

    if (!apiKey) return corsError("Missing API key.", 400);
    if (!inviteToken) return corsError("Missing invite token.", 400);

    const { project, error, status } = await validateApiKey(apiKey);
    if (error || !project) {
        return corsError(error ?? "Invalid project.", status);
    }

    const adminSupabase = createAdminClient();

    const { data: invite } = await adminSupabase
        .from("workspace_invites")
        .select("id, workspace_id, email")
        .eq("id", inviteToken)
        .maybeSingle();

    if (!invite || invite.workspace_id !== project.workspace_id) {
        return corsError("Invalid or expired invite.", 401);
    }

    let rawToken: string;
    try {
        rawToken = await issueWidgetIdentity({
            projectId: project.id,
            email: invite.email,
            inviteId: invite.id,
        });
    } catch (e) {
        console.error("identity/exchange: issue failed", e);
        return corsError("Failed to issue widget access. Please try again.", 500);
    }

    return corsSuccess({ token: rawToken, email: invite.email });
}
