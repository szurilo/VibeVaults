/**
 * Main Responsibility: Exchanges a bootstrap token for a long-lived per-device
 * widget identity token. Two paths, discriminated by body shape:
 *   - `inviteToken`: a workspace_invites.id from `?vv_invite=` (client invite).
 *   - `reviewToken` + `email` + `name`: a projects.review_token from
 *     `?vv_review=` (shareable review link) — the visitor self-identifies,
 *     no per-person invite exists.
 * The returned token is stored in the host site's localStorage and sent as a
 * Bearer credential on subsequent widget API calls.
 *
 * Sensitive Dependencies:
 * - Supabase Admin Client: bypasses RLS to look up workspace_invites /
 *   projects.review_token and insert widget_identities.
 * - validateApiKey: enforces project existence + workspace owner's active
 *   subscription/trial — disabled widgets cannot bootstrap new sessions.
 *
 * Security notes:
 * - Both bootstrap tokens are UUID v4, unguessable. The review token is
 *   permanent by design (never rotated — see review-link-card).
 * - Cross-project use is prevented: invite.workspace_id / review token row
 *   must match the project resolved from the API key.
 * - Multi-device by design: each successful exchange creates a fresh row,
 *   so two browsers can hold tokens for the same email simultaneously.
 * - Review emails are self-declared and unverified — same trust level as any
 *   public comment form. Rate limiting caps the abuse surface.
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

    let body: { apiKey?: string; inviteToken?: string; reviewToken?: string; email?: string; name?: string };
    try {
        body = await request.json();
    } catch {
        return corsError("Invalid request body.", 400);
    }

    const { apiKey, inviteToken, reviewToken } = body;

    if (!apiKey) return corsError("Missing API key.", 400);
    if (!inviteToken && !reviewToken) return corsError("Missing invite token.", 400);

    const { project, error, status } = await validateApiKey(apiKey);
    if (error || !project) {
        return corsError(error ?? "Invalid project.", status);
    }

    const adminSupabase = createAdminClient();

    // --- Review-link path: self-declared name + email, gated on the project's
    // permanent review token. ---
    if (reviewToken) {
        const email = (body.email ?? "").trim().toLowerCase();
        const name = (body.name ?? "").trim();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return corsError("A valid email is required.", 400);
        }
        if (!name || name.length > 100) {
            return corsError("A name is required (max 100 characters).", 400);
        }

        const { data: reviewProject } = await adminSupabase
            .from("projects")
            .select("id")
            .eq("id", project.id)
            .eq("review_token", reviewToken)
            .maybeSingle();

        if (!reviewProject) {
            return corsError("Invalid review link.", 401);
        }

        try {
            const rawToken = await issueWidgetIdentity({
                projectId: project.id,
                email,
                viaReview: true,
                displayName: name,
            });
            return corsSuccess({ token: rawToken, email });
        } catch (e) {
            console.error("identity/exchange: review issue failed", e);
            return corsError("Failed to issue widget access. Please try again.", 500);
        }
    }

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
