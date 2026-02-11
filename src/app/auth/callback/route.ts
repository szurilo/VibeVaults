
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    // Handle OAuth PKCE flow (used by OAuth providers like Google, GitHub, etc.)
    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }

        console.error('Error exchanging code for session:', error)
    }

    // If we get here, either no code was provided or verification failed
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
