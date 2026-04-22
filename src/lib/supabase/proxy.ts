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
        !request.nextUrl.pathname.includes('widget.js') &&
        !request.nextUrl.pathname.includes('manifest') &&
        !request.nextUrl.pathname.startsWith('/privacy-policy') &&
        !request.nextUrl.pathname.startsWith('/terms-of-service') &&
        !request.nextUrl.pathname.startsWith('/pricing') &&
        !request.nextUrl.pathname.startsWith('/share') &&
        !request.nextUrl.pathname.includes('sitemap.xml') &&
        !request.nextUrl.pathname.includes('robots.txt')
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

    // New: Subscription protection for /dashboard
    if (request.nextUrl.pathname.startsWith('/dashboard') && !request.nextUrl.pathname.startsWith('/dashboard/payment-success') && !request.nextUrl.pathname.startsWith('/dashboard/subscribe') && !request.nextUrl.pathname.startsWith('/dashboard/account') && user) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('subscription_status, subscription_tier, trial_ends_at')
            .eq('id', user.sub)
            .single();

        // If the table is missing or there's an error, don't redirect yet to avoid infinite loops
        // during development or if the profile hasn't been created yet.
        if (error) {
            console.error('Middleware: Error fetching profile:', error.message);
            return supabaseResponse;
        }

        if (!hasActiveAccess(profile)) {
            // Paywall is scoped to the active workspace, not the account. A user
            // with an expired trial can still access workspaces they were invited
            // to — the inviting owner pays for those. We only gate access when
            // the user is viewing (or would land on) one of their OWN workspaces.
            const selectedWorkspaceId = request.cookies.get('selectedWorkspaceId')?.value;

            // RLS limits this to workspaces the user is a member of.
            const { data: myWorkspaces } = await supabase
                .from('workspaces')
                .select('id, owner_id');

            const ownsAny = myWorkspaces?.some(w => w.owner_id === user.sub) ?? false;
            const hasInvited = myWorkspaces?.some(w => w.owner_id !== user.sub) ?? false;
            const selectedOwnership = selectedWorkspaceId
                ? myWorkspaces?.find(w => w.id === selectedWorkspaceId)?.owner_id
                : undefined;

            // Rules:
            //  - Selected workspace is one the user owns → paywall. The cookie
            //    reflects the user's current context; if that context is a
            //    locked (owned+expired) workspace, the subscribe page is what
            //    we show. The subscribe page itself offers a "keep working on
            //    <invited>" CTA when applicable, so the user is never stuck.
            //  - No valid selection → paywall only if they have no invited
            //    workspace to fall back to. Otherwise let the layout pick an
            //    invited workspace as the default.
            //  - Selected workspace is invited → full access, regardless of
            //    the user's own trial status (the inviting owner pays).
            let shouldPaywall = false;
            if (selectedOwnership === user.sub) {
                shouldPaywall = true;
            } else if (selectedOwnership === undefined) {
                shouldPaywall = ownsAny && !hasInvited;
            }

            if (shouldPaywall) {
                const url = request.nextUrl.clone();
                url.pathname = "/dashboard/subscribe";
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
