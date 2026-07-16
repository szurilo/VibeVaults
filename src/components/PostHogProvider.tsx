/**
 * Main Responsibility: Initializes PostHog client-side analytics and error tracking,
 * gated on user consent (GDPR / ePrivacy). Starts opted-out; opts in only after the
 * user accepts analytics in the consent banner.
 *
 * Initialization is deferred to idle time so posthog-js is not in the initial JS
 * bundle — improves FCP/LCP, especially on auth pages where analytics aren't needed
 * for first paint.
 *
 * Sensitive Dependencies:
 * - posthog-js for client-side analytics, session replays, and error tracking.
 * - Must be wrapped in root layout to capture all page views and errors.
 * - Reacts to `vv:consent-changed` events from src/lib/consent.ts.
 */
'use client'

import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CONSENT_CHANGED_EVENT, readConsent, type ConsentState } from '@/lib/consent'

type PostHogClient = typeof import('posthog-js').default
type ProviderComponent = ComponentType<{ children: ReactNode }>

function applyConsent(posthog: PostHogClient, state: ConsentState | null) {
  if (state?.analytics) {
    posthog.opt_in_capturing()
    posthog.startSessionRecording()
  } else {
    posthog.opt_out_capturing()
    posthog.stopSessionRecording()
  }
}

function patchFetchForServerActions(posthog: PostHogClient) {
  // Server Action failures (e.g. "Failed to find Server Action <id>" after a
  // deploy invalidates old action IDs) don't throw on the client — React's
  // action dispatcher swallows the rejected fetch, so capture_exceptions
  // never sees them. Intercept fetch to spot Server Action requests (they
  // carry a Next-Action header) that respond with an error, forward them to
  // PostHog, and on 404 prompt the user to reload.
  const windowWithPatch = window as Window & { __vvServerActionPatched?: boolean }
  if (windowWithPatch.__vvServerActionPatched) return
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

export function PostHogProvider({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<ProviderComponent | null>(null)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    let cancelled = false

    const idle = (cb: () => void): number => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }
      return w.requestIdleCallback
        ? w.requestIdleCallback(cb, { timeout: 3000 })
        : window.setTimeout(cb, 1500)
    }

    const handle = idle(async () => {
      const [{ default: posthog }, { PostHogProvider: PHProvider }] = await Promise.all([
        import('posthog-js'),
        import('posthog-js/react'),
      ])
      if (cancelled) return

      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: '/ingest',
        ui_host: 'https://eu.posthog.com',
        capture_pageview: 'history_change',
        capture_pageleave: true,
        autocapture: true,
        capture_exceptions: true,
        // Core Web Vitals capture (replaces Vercel Speed Insights) is enabled via
        // remote config: PostHog project settings → "Autocapture web vitals".
        opt_out_capturing_by_default: true,
        disable_session_recording: true,
        mask_all_text: false,
        session_recording: {
          maskAllInputs: true,
        },
      })

      applyConsent(posthog, readConsent())
      window.addEventListener(CONSENT_CHANGED_EVENT, (event) => {
        const detail = (event as CustomEvent<ConsentState | null>).detail
        applyConsent(posthog, detail)
      })

      patchFetchForServerActions(posthog)

      const Wrapper: ProviderComponent = ({ children: c }) => (
        <PHProvider client={posthog}>{c}</PHProvider>
      )
      setProvider(() => Wrapper)
    })

    return () => {
      cancelled = true
      const w = window as Window & { cancelIdleCallback?: (h: number) => void }
      if (w.cancelIdleCallback) w.cancelIdleCallback(handle)
      else clearTimeout(handle)
    }
  }, [])

  if (!Provider) return <>{children}</>
  return <Provider>{children}</Provider>
}
