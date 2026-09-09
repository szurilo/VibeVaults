/**
 * Main Responsibility:
 *   Next.js middleware helper (called from src/proxy.ts) that refreshes the
 *   Supabase session cookie on every request and enforces auth/subscription
 *   routing rules. Uses `encode: 'tokens-only'` to keep the auth cookie small
 *   enough for Realtime WebSocket upgrades.
 *
 * Sensitive Dependencies:
 *   - `encode` must match the browser and server clients exactly; inconsistent
 *     encoding across client/server will corrupt sessions on refresh.
 *   - Uses `supabase.auth.getClaims()` to read the JWT — does not need
 *     session.user, so the `tokens-only` encoding is transparent here.
 *   - Do not insert code between createServerClient and getClaims().
 *   - The workspace paywall calls the `get_user_workspace_billing()` RPC
 *     (migration 20260909000000). It must stay granted to `authenticated`:
 *     `profiles` RLS hides the owner's row from members, so without the RPC
 *     the proxy cannot tell whether an invited workspace is still paid for.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasActiveAccess } from "@/lib/tier-helpers";

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    // With Fluid compute, don't put this client in a global environment
    // variable. Always create a new one on each request.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                encode: 'tokens-only',
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value),
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options),
                    );
                },
            },
        },
    );

    // Do not run code between createServerClient and
    // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: If you remove getClaims() and you use server-side rendering
    // with the Supabase client, your users may be randomly logged out.
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;

    // If authenticated user visits login/register pages, send them to the dashboard.
    if (
        user &&
        (request.nextUrl.pathname === "/auth/login" ||
            request.nextUrl.pathname === "/auth/register")
    ) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url, 303);
    }

    if (
        !user &&
        !request.nextUrl.pathname.startsWith("/auth") &&
        !request.nextUrl.pathname.startsWith("/api/widget") &&
        !request.nextUrl.pathname.startsWith("/api/stripe") &&
        !request.nextUrl.pathname.startsWith("/api/email-redirect") &&
        !request.nextUrl.pathname.startsWith("/api/admin-alerts") &&
        !request.nextUrl.pathname.includes('widget.js') &&
        !request.nextUrl.pathname.includes('manifest') &&
        !request.nextUrl.pathname.startsWith('/privacy-policy') &&
        !request.nextUrl.pathname.startsWith('/terms-of-service') &&
        !request.nextUrl.pathname.startsWith('/pricing') &&
        !request.nextUrl.pathname.startsWith('/compare') &&
        !request.nextUrl.pathname.startsWith('/docs') &&
        !request.nextUrl.pathname.startsWith('/share') &&
        !request.nextUrl.pathname.startsWith('/access') &&
        // Token-authenticated opt-out. MUST stay public: guests and invited
        // clients have no account at all, so gating this behind a login makes
        // the unsubscribe link in every notification email impossible to use.
        !request.nextUrl.pathname.startsWith('/unsubscribe') &&
        !request.nextUrl.pathname.startsWith('/api/unsubscribe') &&
        !request.nextUrl.pathname.startsWith('/review') &&
        !request.nextUrl.pathname.startsWith('/api/review') &&
        !request.nextUrl.pathname.includes('sitemap.xml') &&
        !request.nextUrl.pathname.includes('robots.txt') &&
        !request.nextUrl.pathname.includes('llms.txt')
    ) {
        // If it's a non-GET/HEAD unauthenticated request (frequently bots), return 401 immediately
        // to avoid 405 errors caused by method-preserving redirects.
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new NextResponse(null, { status: 401 });
        }

        // For GET requests to protected paths, redirect to login.
        // We exclude "/" as it's the landing page.
        if (request.nextUrl.pathname !== "/") {
            const url = request.nextUrl.clone();
            url.pathname = "/auth/login";
            // Use 303 (See Other) to force the browser to use GET on the destination.
            return NextResponse.redirect(url, 303);
        }
    }

    // -----------------------------------------------------------------------
    // Workspace paywall for /dashboard
    //
    // A workspace is live only while its OWNER pays. This check is therefore
    // keyed on the selected workspace's owner, NOT on the viewing user: an
    // earlier version read the viewer's own profile and deliberately exempted
    // invited workspaces, which meant every member of a lapsed owner kept full
    // access for free.
    //
    // `profiles` RLS only exposes the caller's own row, so the owner's billing
    // state comes from the get_user_workspace_billing() SECURITY DEFINER RPC,
    // scoped to workspaces the caller is a member of. It hands back the raw
    // columns so hasActiveAccess() stays the only implementation of the
    // predicate.
    //
    // Excluded paths, and why each one must stay excluded:
    //   - the two redirect destinations themselves, or it loops
    //   - /dashboard/payment-success, which is how a fresh payment lands
    //   - /dashboard/account — billing and account deletion
    //   - /dashboard/settings/users — the ONLY place a member can leave a
    //     workspace and an owner can remove a member or revoke a client. Those
    //     are exits, so gating the page that hosts them would trap people in a
    //     workspace they can't use, exactly like gating unsubscribe would. The
    //     page renders itself in a restricted mode instead (no inviting), and
    //     `/dashboard/settings` (workspace settings) stays gated — the prefix
    //     below is deliberately the longer path.
    // -----------------------------------------------------------------------
    if (
        request.nextUrl.pathname.startsWith('/dashboard') &&
        !request.nextUrl.pathname.startsWith('/dashboard/payment-success') &&
        !request.nextUrl.pathname.startsWith('/dashboard/subscribe') &&
        !request.nextUrl.pathname.startsWith('/dashboard/workspace-paused') &&
        !request.nextUrl.pathname.startsWith('/dashboard/account') &&
        !request.nextUrl.pathname.startsWith('/dashboard/settings/users') &&
        user
    ) {
        const { data: billingRows, error } = await supabase.rpc('get_user_workspace_billing');

        // On error (migration not applied yet, transient failure) fail open
        // rather than locking paying customers out of their dashboard.
        if (error) {
            console.error('Middleware: Error fetching workspace billing:', error.message);
            return supabaseResponse;
        }

        type BillingRow = {
            workspace_id: string;
            owner_id: string | null;
            subscription_status: string | null;
            trial_ends_at: string | null;
        };
        const rows = (billingRows ?? []) as BillingRow[];

        if (rows.length > 0) {
            const selectedWorkspaceId = request.cookies.get('selectedWorkspaceId')?.value;
            const isLive = (row: BillingRow) => hasActiveAccess(row);

            // Which workspace is the user actually looking at? Honor a cookie
            // that still points at a workspace they belong to. Otherwise mirror
            // the layout's default-selection rule, which prefers a workspace
            // that actually works over the oldest one.
            const selected = selectedWorkspaceId
                ? rows.find(r => r.workspace_id === selectedWorkspaceId)
                : undefined;
            const effective = selected ?? rows.find(isLive) ?? rows[0];

            if (!isLive(effective)) {
                const url = request.nextUrl.clone();
                url.search = "";
                // The owner of a lapsed workspace can fix it themselves, so
                // they go to the plan picker. A member can't pay for someone
                // else's workspace, so showing them pricing would be a dead
                // end — they get the "ask the owner to renew" page instead.
                url.pathname = effective.owner_id === user.sub
                    ? "/dashboard/subscribe"
                    : "/dashboard/workspace-paused";
                return NextResponse.redirect(url);
            }
        }
    }

    // IMPORTANT: You *must* return the supabaseResponse object as it is.
    // If you're creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse;
}
