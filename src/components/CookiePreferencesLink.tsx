/**
 * Main Responsibility: Footer link that re-opens the cookie preferences dialog.
 * Required by GDPR/ePrivacy: consent must be as easy to withdraw as it was to give.
 *
 * Sensitive Dependencies:
 * - Dispatches `vv:open-cookie-prefs` (defined in src/lib/consent.ts).
 *   CookieConsent.tsx must be mounted in the layout to receive the event.
 */
'use client'

import { OPEN_PREFS_EVENT } from '@/lib/consent'

export function CookiePreferencesLink({ className }: { className?: string }) {
    return (
        <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PREFS_EVENT))}
            className={className ?? 'hover:text-primary transition-colors cursor-pointer'}
        >
            Cookie preferences
        </button>
    )
}
