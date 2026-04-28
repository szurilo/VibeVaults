/**
 * Main Responsibility: Initializes PostHog client-side analytics and error tracking,
 * gated on user consent (GDPR / ePrivacy). Starts opted-out; opts in only after the
 * user accepts analytics in the consent banner.
 *
 * Sensitive Dependencies:
 * - posthog-js for client-side analytics, session replays, and error tracking.
 * - Must be wrapped in root layout to capture all page views and errors.
 * - Reacts to `vv:consent-changed` events from src/lib/consent.ts.
 */
'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CONSENT_CHANGED_EVENT, readConsent, type ConsentState } from '@/lib/consent'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    capture_pageview: false, // We capture manually for Next.js route changes
    capture_pageleave: true,
    autocapture: true,
    capture_exceptions: true,
    // GDPR / ePrivacy: don't track or record until the user explicitly accepts.
    opt_out_capturing_by_default: true,
    disable_session_recording: true,
    // Belt-and-braces input masking for whenever recording does start.
    mask_all_text: false,
    session_recording: {
      maskAllInputs: true,
    },
  })

  applyConsent(readConsent())
  window.addEventListener(CONSENT_CHANGED_EVENT, (event) => {
    const detail = (event as CustomEvent<ConsentState | null>).detail
    applyConsent(detail)
  })

  // Server Action failures (e.g. "Failed to find Server Action <id>" after a
  // deploy invalidates old action IDs) don't throw on the client — React's
  // action dispatcher swallows the rejected fetch, so capture_exceptions
  // never sees them. Intercept fetch to spot Server Action requests (they
  // carry a Next-Action header) that respond with an error, forward them to
  // PostHog, and on 404 prompt the user to reload.
  const windowWithPatch = window as Window & { __vvServerActionPatched?: boolean }
  if (!windowWithPatch.__vvServerActionPatched) {
    windowWithPatch.__vvServerActionPatched = true
    let reloadPrompted = false
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      try {
        const [input, init] = args
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        const actionId = headers.get('next-action')
        if (actionId && !response.ok) {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
          posthog.captureException(
            new Error(`Server Action ${response.status}: ${actionId}`),
            {
              source: 'server-action-client',
              actionId,
              status: response.status,
              url,
            }
          )
          if (response.status === 404 && !reloadPrompted) {
            reloadPrompted = true
            toast('App update available', {
              description: 'The app was just updated and that action is no longer available. Reload to continue.',
              duration: Infinity,
              action: { label: 'Reload', onClick: () => window.location.reload() },
            })
          }
        }
      } catch {
        // Never let telemetry break the user's request.
      }
      return response
    }
  }
}

function applyConsent(state: ConsentState | null) {
  if (state?.analytics) {
    posthog.opt_in_capturing()
    posthog.startSessionRecording()
  } else {
    posthog.opt_out_capturing()
    posthog.stopSessionRecording()
  }
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname
      const search = searchParams.toString()
      if (search) url += '?' + search
      posthog.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams, posthog])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
