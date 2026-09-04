/**
 * Main Responsibility: Turns a review token + a guest's self-declared name and
 * email into a fresh guest widget identity, returning the customer-site URL
 * that plants it. Shared logic behind the hosted review page's form POST.
 *
 * Sensitive Dependencies:
 * - Supabase Admin Client: guests are anonymous; the unguessable review token
 *   is the credential, so RLS does not apply.
 * - checkOwnerAccess: a lapsed owner's project must not accept new guests.
 * - projects.widget_last_seen_at: null means the widget has never loaded on
 *   the site, so the redirect would strand the guest on an inert URL.
 * - public/widget.js: consumes the `vv_token` + `vv_key` params this builds.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { issueWidgetIdentity, checkOwnerAccess } from "@/lib/widget-helpers";
import { appendQueryParams } from "@/lib/review-url";
import { createActionRateLimiter } from "@/lib/action-rate-limit";

export type RedeemFailure = 'invalid_input' | 'invalid_link' | 'inactive' | 'not_set_up' | 'rate_limited' | 'internal_error';

export type RedeemReviewLinkResult =
    | { ok: true; url: string }
    | { ok: false; reason: RedeemFailure };

const REDEEM_MAX_PER_IP = 10;
const isRedeemRateLimited = createActionRateLimiter(10 * 60_000);

/**
 * Multi-device by design: every redeem mints a fresh identity row, so the
 * same guest can open the link on a laptop and a phone.
 */
export async function redeemReviewLink(
    reviewToken: string,
    name: string,
    email: string,
    ip: string,
): Promise<RedeemReviewLinkResult> {
    const cleanName = (name ?? '').trim();
    const cleanEmail = (email ?? '').trim().toLowerCase();

    if (!reviewToken || typeof reviewToken !== 'string') return { ok: false, reason: 'invalid_link' };
    if (!cleanName || cleanName.length > 100) return { ok: false, reason: 'invalid_input' };
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
        return { ok: false, reason: 'invalid_input' };
    }

    if (isRedeemRateLimited(`ip:${ip}`, REDEEM_MAX_PER_IP)) {
        return { ok: false, reason: 'rate_limited' };
    }

    const admin = createAdminClient();
    const { data: project } = await admin
        .from('projects')
        .select('id, workspace_id, api_key, website_url, widget_last_seen_at')
        .eq('review_token', reviewToken)
        .maybeSingle();

    if (!project || !project.website_url) return { ok: false, reason: 'invalid_link' };

    const access = await checkOwnerAccess(project.workspace_id);
    if (!access.ok) return { ok: false, reason: 'inactive' };

    if (!project.widget_last_seen_at) return { ok: false, reason: 'not_set_up' };

    try {
        const rawToken = await issueWidgetIdentity({
            projectId: project.id,
            email: cleanEmail,
            viaReview: true,
            displayName: cleanName,
        });
        return { ok: true, url: appendQueryParams(project.website_url, { vv_token: rawToken, vv_key: project.api_key }) };
    } catch (e) {
        console.error('redeemReviewLink: failed to issue identity', e);
        return { ok: false, reason: 'internal_error' };
    }
}
