
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeRedirectPath(path: string): string {
    // Only allow relative paths starting with / — block protocol-relative URLs (//evil.com)
    if (path.startsWith('/') && !path.startsWith('//')) return path
    return '/dashboard'
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = safeRedirectPath(searchParams.get('next') ?? '/dashboard')

    // Handle OAuth PKCE flow (used by OAuth providers like Google, GitHub, etc.)
    if (code) {
        const supabase = await createClient()
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }

        console.error('Error exchanging code for session:', error)
    }

    // If we get here, either no code was provided or verification failed
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
