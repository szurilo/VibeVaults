
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function safeRedirectPath(path: string): string {
    // Only allow relative paths starting with / — block protocol-relative URLs (//evil.com)
    if (path.startsWith('/') && !path.startsWith('//')) return path
    return '/dashboard'
}

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = safeRedirectPath(searchParams.get('next') ?? '/dashboard')

    if (code) {
        const response = NextResponse.redirect(`${origin}${next}`)

        // Supabase calls setAll asynchronously (via internal auth state listener)
        // after exchangeCodeForSession resolves. We use a promise to wait for it
        // before returning the response, ensuring session cookies are included.
        let resolveSetAll: () => void
        const cookiesReady = new Promise<void>(resolve => { resolveSetAll = resolve })

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    // MUST match client.ts / server.ts / proxy.ts. Without it
                    // this route writes the full-user cookie (user_metadata,
                    // identities, provider_token), which bloats the auth
                    // cookie past what Realtime's WebSocket upgrade accepts —
                    // so a Google sign-in would start every session with the
                    // oversized cookie until something else rewrote it.
                    encode: 'tokens-only',
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(name, value, options)
                        })
                        resolveSetAll()
                    },
                },
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            await Promise.race([
                cookiesReady,
                new Promise(resolve => setTimeout(resolve, 5000)),
            ])
            return response
        }

        console.error('Error exchanging code for session:', error)
    }

    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
