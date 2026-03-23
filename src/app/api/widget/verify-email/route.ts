/**
 * Main Responsibility: Lightweight email verification for the widget. Checks if an email
 * belongs to a workspace member (owner/member) or an invited client, so the widget can
 * show/hide itself without requiring a vv_email URL parameter.
 *
 * Sensitive Dependencies:
 * - Supabase Admin Client (@/lib/supabase/admin) for bypassing RLS to check profiles + memberships.
 * - Widget Helpers (@/lib/widget-helpers) for CORS, rate limiting, and API key validation.
 */
import { corsError, corsSuccess, optionsResponse, validateApiKey, isRateLimited, verifyWidgetEmail } from "@/lib/widget-helpers";

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

    const authorized = await verifyWidgetEmail(email, project.workspace_id);
    return corsSuccess({ authorized });
}
