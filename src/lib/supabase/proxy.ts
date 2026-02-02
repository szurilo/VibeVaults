import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

    if (
        !user &&
        !request.nextUrl.pathname.startsWith("/auth") &&
        !request.nextUrl.pathname.startsWith("/api/widget") &&
        !request.nextUrl.pathname.startsWith("/api/stripe") &&
        !request.nextUrl.pathname.includes('widget.js') &&
        !request.nextUrl.pathname.includes('manifest') &&
        !request.nextUrl.pathname.startsWith('/privacy-policy') &&
        !request.nextUrl.pathname.startsWith('/terms-of-service') &&
        !request.nextUrl.pathname.includes('sitemap.xml') &&
        !request.nextUrl.pathname.includes('robots.txt')
    ) {
        // If it's a non-GET unauthenticated request (frequently bots), return 401 immediately
        // to avoid 405 errors caused by method-preserving redirects.
        if (request.method !== 'GET') {
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
    if (request.nextUrl.pathname.startsWith('/dashboard') && !request.nextUrl.pathname.startsWith('/dashboard/payment-success') && user) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('subscription_status')
            .eq('id', user.sub)
            .single();

        // If the table is missing or there's an error, don't redirect yet to avoid infinite loops
        // during development or if the profile hasn't been created yet.
        if (error) {
            console.error('Middleware: Error fetching profile:', error.message);
            return supabaseResponse;
        }

        if (profile?.subscription_status !== 'active') {
            const url = request.nextUrl.clone();
            url.pathname = "/api/stripe/checkout";
            return NextResponse.redirect(url);
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
