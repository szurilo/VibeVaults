/**
 * Main Responsibility: Initializes PostHog client-side analytics and error tracking.
 * Only loads in production to avoid polluting dev data.
 *
 * Sensitive Dependencies:
 * - posthog-js for client-side analytics, session replays, and error tracking.
 * - Must be wrapped in root layout to capture all page views and errors.
 */
'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    capture_pageview: false, // We capture manually for Next.js route changes
    capture_pageleave: true,
    autocapture: true,
    capture_exceptions: true,
  })

  // Server Action failures (e.g. "Failed to find Server Action <id>" after a
  // deploy invalidates old action IDs) don't throw on the client — React's
  // action dispatcher handles the rejected fetch internally, so
  // capture_exceptions never sees them. Intercept fetch to spot Server Action
  // requests (they carry a Next-Action header) that respond with an error and
  // forward them to PostHog manually. Also surfaces to the user so they can
  // refresh instead of silently clicking a dead button.
  const windowWithPatch = window as Window & { __vvServerActionPatched?: boolean }
  if (!windowWithPatch.__vvServerActionPatched) {
    windowWithPatch.__vvServerActionPatched = true
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
              deploymentId: process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID ?? null,
            }
          )
          if (response.status === 404) {
            // Stale client hitting a new deployment — tell the user to refresh.
            const shouldReload = window.confirm(
              'The app was just updated. Reload to continue?'
            )
            if (shouldReload) window.location.reload()
          }
        }
      } catch {
        // Never let telemetry break the user's request.
      }
      return response
    }
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
