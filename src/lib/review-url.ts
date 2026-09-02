/**
 * Main Responsibility: Builds the shareable review URL
 * (`website_url` + `?vv_review=<review_token>`) — the single implementation
 * used by every surface that displays the link (review-link-card,
 * create-project-dialog). Client-safe, no server imports.
 */
export function buildReviewUrl(websiteUrl: string, reviewToken: string): string {
    try {
        const u = new URL(websiteUrl);
        u.searchParams.set('vv_review', reviewToken);
        return u.toString();
    } catch {
        // website_url isn't a fully-qualified URL — best-effort fallback that
        // still produces a shareable link (browsers will normalize).
        const sep = websiteUrl.includes('?') ? '&' : '?';
        return `${websiteUrl}${sep}vv_review=${encodeURIComponent(reviewToken)}`;
    }
}
