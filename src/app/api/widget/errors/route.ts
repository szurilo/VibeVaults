/**
 * Main Responsibility: Receives client-side error reports from the embeddable widget
 * and stores them in the widget_errors Supabase table for monitoring.
 *
 * Sensitive Dependencies:
 * - @/lib/supabase/admin for service-role inserts (RLS blocks direct client access).
 * - @/lib/widget-helpers for CORS headers and rate limiting.
 */
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsHeaders, corsError, corsSuccess, optionsResponse, isRateLimited } from "@/lib/widget-helpers";

export async function OPTIONS() {
    return optionsResponse();
}

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (isRateLimited(ip, "widget-errors")) {
        return corsError("Too many requests", 429);
    }

    try {
        const body = await request.json();
        const { apiKey, message, stack, url, userAgent, metadata } = body;

        if (!apiKey || !message) {
            return corsError("Missing required fields", 400);
        }

        const supabase = createAdminClient();
        const { error } = await supabase.from("widget_errors").insert({
            api_key: apiKey,
            error_message: String(message).slice(0, 2000),
            error_stack: stack ? String(stack).slice(0, 5000) : null,
            url: url ? String(url).slice(0, 2000) : null,
            user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
            metadata: metadata ?? {},
        });

        if (error) {
            console.error("Failed to insert widget error:", error.message);
            return corsError("Failed to log error", 500);
        }

        return corsSuccess({ ok: true });
    } catch {
        return corsError("Invalid request", 400);
    }
}
