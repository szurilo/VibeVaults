
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    // Handle OAuth PKCE flow (used by OAuth providers like Google, GitHub, etc.)
    if (code) {
        const supabase = await createClient()
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Attempt to schedule welcome email if new user
            if (data?.user) {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('welcome_email_sent')
                        .eq('id', data.user.id)
                        .single();

                    if (profile && !profile.welcome_email_sent) {
                        // Mark as sent
                        await supabase
                            .from('profiles')
                            .update({ welcome_email_sent: true })
                            .eq('id', data.user.id);

                        const { sendWelcomeNotification } = await import('@/lib/notifications')
                        const email = data.user.email || 'friend';
                        const nameStr = email.split('@')[0];
                        const formattedName = nameStr.charAt(0).toUpperCase() + nameStr.slice(1);
                        await sendWelcomeNotification({ to: email, name: formattedName })
                    }
                } catch (e) {
                    console.error('Failed to trigger welcome email check on callback', e)
                }
            }

            return NextResponse.redirect(`${origin}${next}`)
        }

        console.error('Error exchanging code for session:', error)
    }

    // If we get here, either no code was provided or verification failed
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
