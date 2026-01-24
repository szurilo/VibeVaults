import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)

    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const next = searchParams.get('next') ?? '/dashboard'

    if (token_hash && type) {
        const supabase = await createClient()
        const { error } = await supabase.auth.verifyOtp({
            type: type as any,
            token_hash,
        })

        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }

        console.error('❌ [/auth/confirm] Error verifying OTP:', error)
    } else {
    }

    // If verification failed or no params provided, redirect to error page
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
