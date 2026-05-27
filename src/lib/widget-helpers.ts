import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getTierLimits, type TierSlug } from "@/lib/tier-config";
import { hasActiveAccess } from "@/lib/tier-helpers";
import { createHash, randomBytes } from "crypto";

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
    // Admin client: get_project_by_api_key is no longer granted to anon /
    // authenticated (see 20260527000000_security_hardening.sql). Widget
    // requests have no user session anyway, so service_role is the right fit.
    const supabase = createAdminClient();
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
            .select('subscription_status, trial_ends_at, subscription_tier')
            .eq('id', workspace.owner_id)
            .single();

        if (!hasActiveAccess(profile)) {
            return { project: null, ownerTier: null, error: "This widget is currently inactive. Please contact the site owner.", status: 403 };
        }

        const ownerTier = (profile?.subscription_tier as TierSlug | null) ?? null;
        return { project, ownerTier, error: null, status: 200 };
    }

    return { project, ownerTier: null, error: null, status: 200 };
}

// ---------------------------------------------------------------------------
// Widget identity tokens
//
// Per-device, opaque, server-issued tokens that authenticate a single browser
// against a single project. Rows live in `widget_identities`; we only ever
// store the sha256 hash of the raw token.
// ---------------------------------------------------------------------------

const WIDGET_TOKEN_BYTES = 32;

function hashWidgetToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
}

function generateRawWidgetToken(): string {
    return randomBytes(WIDGET_TOKEN_BYTES).toString("base64url");
}

export type IssueWidgetIdentityArgs = {
    projectId: string;
    email: string;
    /** Set when the identity is provisioned from a client invite. */
    inviteId?: string | null;
    /** Set when the identity is provisioned for an owner/member. */
    userId?: string | null;
};

/**
 * Creates a `widget_identities` row and returns the raw token.
 * The raw token is only ever returned at issue time — caller is responsible
 * for delivering it to the client (URL param on bootstrap link, etc.).
 */
export async function issueWidgetIdentity(args: IssueWidgetIdentityArgs): Promise<string> {
    if (!args.inviteId && !args.userId) {
        throw new Error("issueWidgetIdentity requires either inviteId or userId");
    }

    const adminSupabase = createAdminClient();
    const rawToken = generateRawWidgetToken();
    const tokenHash = hashWidgetToken(rawToken);

    const { error } = await adminSupabase.from("widget_identities").insert({
        project_id: args.projectId,
        email: args.email,
        invite_id: args.inviteId ?? null,
        user_id: args.userId ?? null,
        token_hash: tokenHash,
    });

    if (error) {
        throw new Error(`Failed to issue widget identity: ${error.message}`);
    }

    return rawToken;
}

export type WidgetIdentity = {
    id: string;
    project_id: string;
    email: string;
    invite_id: string | null;
    user_id: string | null;
};

/**
 * Verifies a raw widget token against a project. Returns the identity row
 * or `null` if the token is missing, unknown, or scoped to a different project.
 * On success, best-effort updates `last_used_at`.
 */
export async function verifyWidgetToken(rawToken: string | null | undefined, projectId: string): Promise<WidgetIdentity | null> {
    if (!rawToken) return null;

    const adminSupabase = createAdminClient();
    const tokenHash = hashWidgetToken(rawToken);

    const { data, error } = await adminSupabase
        .from("widget_identities")
        .select("id, project_id, email, invite_id, user_id")
        .eq("token_hash", tokenHash)
        .eq("project_id", projectId)
        .maybeSingle();

    if (error || !data) return null;

    // Best-effort timestamp; intentionally not awaited for failure handling.
    adminSupabase
        .from("widget_identities")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id)
        .then(() => undefined, () => undefined);

    return data as WidgetIdentity;
}

/**
 * Extracts a Bearer token from an Authorization header. Returns null if
 * absent or malformed.
 */
export function readBearerToken(request: Request): string | null {
    const header = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!header) return null;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

/**
 * One-shot authentication for widget API requests:
 *   1. Validates the project API key (and the workspace owner's subscription/trial).
 *   2. Reads a Bearer token from the Authorization header.
 *   3. Verifies the token against `widget_identities` for the resolved project.
 *
 * Returns the project (with ownerTier) and identity row on success, or an
 * error+status the caller should pass to `corsError`. SSE routes that can't
 * send custom headers should compose `validateApiKey` + `verifyWidgetToken`
 * directly, reading the token from a query parameter.
 */
export async function authenticateWidgetRequest(request: Request, apiKey: string) {
    const { project, ownerTier, error: keyError, status } = await validateApiKey(apiKey);
    if (keyError || !project) {
        return { project: null, ownerTier: null, identity: null, error: keyError ?? "Invalid project.", status };
    }

    const token = readBearerToken(request);
    const identity = await verifyWidgetToken(token, project.id);
    if (!identity) {
        return { project: null, ownerTier: null, identity: null, error: "Widget access not authorized. Request a new access link.", status: 401 };
    }

    return { project, ownerTier, identity, error: null, status: 200 };
}
