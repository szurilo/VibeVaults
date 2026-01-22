import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)

    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const next = searchParams.get('next') ?? '/dashboard'

    // CANONICAL DOMAIN ENFORCEMENT
    // If not in development and not on 'www', redirect to 'www'
    const host = request.headers.get('host')
    const isLocalEnv = process.env.NODE_ENV === 'development'
    if (!isLocalEnv && host && host === 'vibe-vaults.com') {
        const canonicalURL = new URL(request.url)
        canonicalURL.host = 'www.vibe-vaults.com'
        return NextResponse.redirect(canonicalURL.toString())
    }

    if (token_hash && type) {
        const supabase = await createClient()
        const { error } = await supabase.auth.verifyOtp({
            type: type as any,
            token_hash,
        })

        if (!error) {
            const forwardedHost = request.headers.get('x-forwarded-host')

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        }

        console.error('❌ [/auth/confirm] Error verifying OTP:', error)
    } else {
    }

    // If verification failed or no params provided, redirect to error page
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
