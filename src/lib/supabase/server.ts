/**
 * Main Responsibility:
 *   Factory for Supabase clients used in Server Components, Server Actions,
 *   and Route Handlers. Configures the session cookie to carry only access
 *   and refresh tokens (`encode: 'tokens-only'`) so the cookie stays small
 *   enough for Realtime WebSocket upgrades and proxies with tight header
 *   buffers. Must use the SAME `encode` value as the browser client.
 *
 * Sensitive Dependencies:
 *   - `@supabase/ssr` pinned to 0.8.0 (`encode` is @experimental).
 *   - `encode` MUST be identical between createBrowserClient and
 *     createServerClient, otherwise cookie format depends on which side
 *     wrote last and sessions will be corrupted.
 *   - Code reading `session.user.*` from `getSession()` will break; use
 *     `supabase.auth.getUser()` or `getClaims()` instead.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                encode: 'tokens-only',
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have proxy refreshing
                        // user sessions.
                    }
                },
            }
        }
    )
}
