/**
 * Main Responsibility: Receives the hosted review page's form POST and answers
 * with a real HTTP 303 to the customer's site (on success) or back to the
 * review page with an `?error=` code (on failure).
 *
 * Why a route handler and not a server action: Next.js blocks server-action
 * redirects to external hosts (it compares the redirect host against the
 * request Host header), and the whole point here is to send the guest to the
 * customer's own domain. A plain form POST also works before — or entirely
 * without — client hydration, which a click-handler-based flow does not: on a
 * slow device the guest could click "Start reviewing" before React attached,
 * the native submit would reload the page, and nothing would happen.
 *
 * Sensitive Dependencies:
 * - redeemReviewLink (src/lib/review-redeem.ts) does the validation, rate
 *   limiting, identity minting and URL construction.
 * - Excluded from the auth gate in src/lib/supabase/proxy.ts (`/api/review`).
 * - The `?error=` codes are rendered by src/app/review/[token]/page.tsx.
 */
import { NextResponse } from "next/server";
import { redeemReviewLink } from "@/lib/review-redeem";

export async function POST(request: Request) {
    const form = await request.formData().catch(() => null);
    if (!form) {
        return NextResponse.redirect(new URL('/review/invalid?error=invalid_link', request.url), 303);
    }

    const token = String(form.get('token') ?? '');
    const name = String(form.get('name') ?? '');
    const email = String(form.get('email') ?? '');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const result = await redeemReviewLink(token, name, email, ip);

    if (!result.ok) {
        const back = new URL(`/review/${encodeURIComponent(token)}`, request.url);
        back.searchParams.set('error', result.reason);
        return NextResponse.redirect(back, 303);
    }

    // 303 so the browser issues a GET for the customer's site after the POST.
    return NextResponse.redirect(result.url, 303);
}
