
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
            // Check subscription status
            const { data: profile } = await supabase
                .from('profiles')
                .select('subscription_status')
                .eq('id', (await supabase.auth.getUser()).data.user?.id)
                .single();

            if (profile?.subscription_status !== 'active') {
                return NextResponse.redirect(`${origin}/api/stripe/checkout`)
            }

            return NextResponse.redirect(`${origin}${next}`)
        }

        console.error('Error exchanging code for session:', error)
    }

    // If we get here, either no code was provided or verification failed
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
