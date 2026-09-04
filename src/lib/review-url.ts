/**
 * Main Responsibility: URL helpers for the hosted review-link flow. The
 * shareable link now points at OUR domain (`/review/<token>`), where the
 * guest identifies themselves before being redirected to the customer's site
 * with a planted widget token. Client-safe, no server imports.
 *
 * Sensitive Dependencies:
 * - `/review/[token]` page: `hostedReviewUrl` must match its route shape.
 * - `public/widget.js`: reads the `vv_token` / `vv_key` params that
 *   `appendQueryParams` attaches on redirect.
 */

/** The shareable review URL shown in the dashboard (our domain, not the customer's site). */
export function hostedReviewUrl(origin: string, reviewToken: string): string {
    return `${origin}/review/${encodeURIComponent(reviewToken)}`;
}

/**
 * Appends query params to a customer-supplied website URL. Best-effort when
 * the stored URL isn't fully qualified (browsers will normalize).
 */
export function appendQueryParams(websiteUrl: string, params: Record<string, string>): string {
    try {
        const u = new URL(websiteUrl);
        for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
        return u.toString();
    } catch {
        const query = Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');
        const sep = websiteUrl.includes('?') ? '&' : '?';
        return `${websiteUrl}${sep}${query}`;
    }
}
