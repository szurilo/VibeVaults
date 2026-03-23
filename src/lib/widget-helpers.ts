import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function optionsResponse() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export function corsError(message: string, status: number) {
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
}

export function corsSuccess(data: object) {
    return NextResponse.json(data, { headers: corsHeaders });
}

// --- In-memory rate limiter (per warm serverless instance) ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;  // max requests per IP per endpoint per window

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/** Removes expired entries every 5 minutes to prevent memory leaks. */
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
        if (now > entry.resetAt) rateLimitMap.delete(key);
    }
}, 5 * 60_000);

/**
 * Checks if an IP has exceeded the rate limit for a specific endpoint.
 * Rate limits are tracked per IP + endpoint combination, so normal widget
 * usage across multiple endpoints won't exhaust the budget.
 * Returns `true` if the request should be blocked.
 */
export function isRateLimited(ip: string, endpoint?: string): boolean {
    const key = endpoint ? `${ip}:${endpoint}` : ip;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }

    entry.count++;
    return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Validates a widget API key and returns the project row.
 * Also checks that the workspace owner has an active subscription or trial.
 * Returns `{ project }` on success or `{ error, status }` on failure.
 */
export async function validateApiKey(apiKey: string) {
    const supabase = await createClient();
    const { data: projects, error } = await supabase.rpc('get_project_by_api_key', { key_param: apiKey });

    if (error || !projects || projects.length === 0) {
        return { project: null, error: "Invalid API Key", status: 401 };
    }

    const project = projects[0];

    // Check workspace owner's subscription/trial status
    const adminSupabase = createAdminClient();
    const { data: workspace } = await adminSupabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', project.workspace_id)
        .single();

    if (workspace?.owner_id) {
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('subscription_status, trial_ends_at')
            .eq('id', workspace.owner_id)
            .single();

        const isSubscribed = profile?.subscription_status === 'active';
        const isTrialActive = profile?.trial_ends_at
            ? new Date(profile.trial_ends_at) > new Date()
            : false;

        if (!isSubscribed && !isTrialActive) {
            return { project: null, error: "This widget is currently inactive. Please contact the site owner.", status: 403 };
        }
    }

    return { project, error: null, status: 200 };
}
