/**
 * Main Responsibility: Cookie/tracking consent UI for GDPR + ePrivacy compliance.
 * Renders a slide-up banner for first-time visitors in consent-required regions,
 * plus a preferences dialog (re-openable from the footer "Cookie preferences"
 * link via the `vv:open-cookie-prefs` event).
 *
 * Sensitive Dependencies:
 * - src/lib/consent.ts is the single source of truth for state + events.
 * - PostHogProvider listens to `vv:consent-changed` and toggles capture/recording.
 * - Visibility logic: banner auto-shows only when (a) no decision recorded AND
 *   (b) the user is in a consent-required region. The dialog is always reachable
 *   via the footer link regardless of region.
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
    OPEN_PREFS_EVENT,
    readConsent,
    writeConsent,
} from '@/lib/consent'

export function CookieConsent({ requireConsent }: { requireConsent: boolean }) {
    const [showBanner, setShowBanner] = useState(false)
    const [showDialog, setShowDialog] = useState(false)
    const [analytics, setAnalytics] = useState(false)

    useEffect(() => {
        const existing = readConsent()
        if (existing) {
            setAnalytics(existing.analytics)
        } else if (requireConsent) {
            setShowBanner(true)
        } else {
            // Outside the EU/EEA/UK/CH: implicit consent (legitimate-interest
            // analytics is allowed in most non-EU jurisdictions, including
            // the US). User can still revoke via the footer "Cookie
            // preferences" link, which will re-open the dialog.
            writeConsent(true)
            setAnalytics(true)
        }

        const onOpenPrefs = () => {
            const current = readConsent()
            setAnalytics(current?.analytics ?? false)
            setShowBanner(false)
            setShowDialog(true)
        }
        window.addEventListener(OPEN_PREFS_EVENT, onOpenPrefs)
        return () => window.removeEventListener(OPEN_PREFS_EVENT, onOpenPrefs)
    }, [requireConsent])

    const acceptAll = () => {
        writeConsent(true)
        setAnalytics(true)
        setShowBanner(false)
        setShowDialog(false)
    }

    const rejectAll = () => {
        writeConsent(false)
        setAnalytics(false)
        setShowBanner(false)
        setShowDialog(false)
    }

    const savePrefs = () => {
        writeConsent(analytics)
        setShowBanner(false)
        setShowDialog(false)
    }

    return (
        <>
            {showBanner && (
                <div
                    role="region"
                    aria-label="Cookie consent"
                    className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6 animate-in slide-in-from-bottom-4 duration-300"
                >
                    <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl p-5 sm:p-6 flex flex-col gap-4">
                        <div>
                            <h2 className="font-bold text-gray-900 text-base mb-1">We value your privacy</h2>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                We use essential cookies to run the service. With your permission, we&apos;d also like to use analytics
                                (PostHog, EU-hosted) to understand how the product is used and find bugs.
                                See our{' '}
                                <Link href="/privacy-policy" className="underline hover:text-gray-900">Privacy Policy</Link>.
                            </p>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <Button variant="ghost" onClick={() => { setShowBanner(false); setShowDialog(true) }}>
                                Customize
                            </Button>
                            <Button variant="outline" onClick={rejectAll}>
                                Reject all
                            </Button>
                            <Button onClick={acceptAll}>
                                Accept all
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cookie preferences</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose what you&apos;re comfortable with. You can change this any time from the &ldquo;Cookie preferences&rdquo; link in the footer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="flex flex-col gap-4 py-2">
                        <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
                            <div>
                                <div className="font-semibold text-gray-900 text-sm">Essential</div>
                                <p className="text-xs text-gray-600 mt-1">
                                    Required for sign-in, billing, and basic site functionality. Always on.
                                </p>
                            </div>
                            <Switch checked disabled aria-label="Essential cookies (always on)" />
                        </div>

                        <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 p-4">
                            <div>
                                <div className="font-semibold text-gray-900 text-sm">Analytics &amp; product improvement</div>
                                <p className="text-xs text-gray-600 mt-1">
                                    Anonymized usage data, error tracking, and session replays via PostHog (EU). Helps us fix bugs and improve the product.
                                </p>
                            </div>
                            <Switch
                                checked={analytics}
                                onCheckedChange={setAnalytics}
                                aria-label="Analytics cookies"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button variant="outline" onClick={rejectAll}>Reject all</Button>
                        <Button variant="outline" onClick={acceptAll}>Accept all</Button>
                        <Button onClick={savePrefs}>Save preferences</Button>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
