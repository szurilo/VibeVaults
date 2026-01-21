
import { type User } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // With Fluid compute, don't put this client in a global environment
    // variable. Always create a new one on each request.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: The official Supabase SSR documentation recommends using getUser() 
    // to ensure the session is valid and tokens are refreshed on the server.
    // However, for performance, we try getClaims() first.
    let { data } = await supabase.auth.getClaims()
    let user: User | Record<string, any> | null = data?.claims ?? null

    // If no claims found (e.g. expired token, clock skew in prod, or key mismatch),
    // we MUST verify with getUser() which handles token refresh and server-side validation.
    if (!user) {
        const { data: userData, error } = await supabase.auth.getUser()

        // If getUser found a valid user, we allow the request.
        // We do NOT re-call getClaims() here as it might persistently fail in this environment.
        if (userData?.user && !error) {
            user = userData.user
        }
    }

    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        !request.nextUrl.pathname.startsWith('/api') &&
        !request.nextUrl.pathname.startsWith('/register') &&
        !request.nextUrl.pathname.startsWith('/privacy-policy') &&
        !request.nextUrl.pathname.startsWith('/terms-of-service') &&
        !request.nextUrl.pathname.includes('manifest') &&
        request.nextUrl.pathname !== '/' // Allow landing page
    ) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
