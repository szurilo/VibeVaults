/**
 * Main Responsibility:
 *   Factory for the browser-side Supabase client used by React components and
 *   hooks. Configures the session cookie to carry only access + refresh tokens
 *   (`encode: 'tokens-only'`) so the auth cookie stays small enough for
 *   Realtime WebSocket upgrades and proxies with tight header buffers.
 *
 * Sensitive Dependencies:
 *   - Relies on the `cookie` package (direct dependency) for parse/serialize.
 *   - `@supabase/ssr` is pinned to 0.8.0 because `cookies.encode` is marked
 *     @experimental and API shape could change between minor versions.
 *   - The custom `getAll`/`setAll` below replicate the library's own default
 *     `document.cookie` handlers — they are REQUIRED when passing `encode`
 *     because any `cookies` object disables the library's built-in browser
 *     fallback. Source: @supabase/ssr/src/cookies.ts (noHintGetAll + setAll).
 *   - Any code that reads `session.user.*` from `getSession()` will break;
 *     use `supabase.auth.getUser()` or `getClaims()` instead.
 */

import { createBrowserClient } from '@supabase/ssr'
import { parse, serialize } from 'cookie'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                encode: 'tokens-only',
                getAll() {
                    if (typeof document === 'undefined') return []
                    const parsed = parse(document.cookie)
                    return Object.keys(parsed).map((name) => ({
                        name,
                        value: parsed[name] ?? '',
                    }))
                },
                setAll(cookiesToSet) {
                    if (typeof document === 'undefined') return
                    cookiesToSet.forEach(({ name, value, options }) => {
                        document.cookie = serialize(name, value, options)
                    })
                },
            },
            // When encode is 'tokens-only', the library tries to access
            // window.localStorage as the default userStorage — which crashes
            // during SSR pre-rendering. Provide a no-op storage for SSR;
            // in the browser the singleton is created on hydration where
            // localStorage is available.
            auth: {
                userStorage: typeof window !== 'undefined'
                    ? window.localStorage
                    : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
            },
        }
    )
}
