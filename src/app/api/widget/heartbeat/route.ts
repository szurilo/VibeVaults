/**
 * Main Responsibility: Records that `public/widget.js` is actually loading on
 * a customer's site, by stamping `projects.widget_last_seen_at`. The dashboard
 * uses that flag to unlock the shareable review link and to confirm the embed
 * step after project creation.
 *
 * Why it is unauthenticated: it answers "is the script live on the page?",
 * which must be answerable BEFORE anyone holds a widget token. The config GET
 * also stamps the flag, but only after a token authenticates — so on its own
 * it can never observe a freshly embedded snippet, which is the exact moment
 * the dashboard needs to detect.
 *
 * Sensitive Dependencies:
 * - Carries only the project API key, which is public by construction (it sits
 *   in the customer's embed snippet). No personal data, no request body.
 * - Fire-and-forget from widget.js: failures are swallowed there, so this must
 *   never be load-bearing for widget behaviour.
 * - Rate-limited per IP like every other widget endpoint.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { corsError, optionsResponse, isRateLimited, corsHeaders } from "@/lib/widget-helpers";
import { NextResponse } from "next/server";

export async function OPTIONS() {
    return optionsResponse();
}

export async function POST(request: Request) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, "widget:heartbeat")) {
        return corsError("Too many requests. Please try again later.", 429);
    }

    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("key");
    if (!apiKey) return corsError("Missing API Key", 400);

    // Deliberately not validateApiKey(): the owner's trial/subscription state
    // is irrelevant to whether the script is on the page, and a lapsed owner
    // still needs the dashboard to show the embed as done.
    const admin = createAdminClient();
    const { error } = await admin
        .from("projects")
        .update({ widget_last_seen_at: new Date().toISOString() })
        .eq("api_key", apiKey);

    if (error) {
        console.error("widget heartbeat failed:", error);
    }

    // No body: the widget ignores the response entirely.
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}
