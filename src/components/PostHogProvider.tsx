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
import { toast } from 'sonner'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    capture_pageview: false, // We capture manually for Next.js route changes
    capture_pageleave: true,
    autocapture: true,
    capture_exceptions: true,
  })

  // Without Vercel Skew Protection (Pro plan), old clients can't be routed
  // back to their original deployment, so post-deploy Server Action 404s are
  // unavoidable. Mitigate by (a) proactively detecting deployment changes via
  // the `x-vercel-id` response header and prompting reload before the user
  // hits a dead action, and (b) reporting any actual Server Action failures
  // to PostHog (capture_exceptions misses them — the rejected fetch is
  // swallowed by React's action dispatcher) and offering a recovery toast.
  const windowWithPatch = window as Window & { __vvServerActionPatched?: boolean }
  if (!windowWithPatch.__vvServerActionPatched) {
    windowWithPatch.__vvServerActionPatched = true
    const bundleDeploymentId = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID ?? null
    let staleDeploymentNotified = false
    const promptReload = (description: string) => {
      toast('App update available', {
        description,
        duration: Infinity,
        action: { label: 'Reload', onClick: () => window.location.reload() },
      })
    }
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      try {
        const [input, init] = args
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        const actionId = headers.get('next-action')

        // Vercel's x-vercel-id encodes the deployment as the suffix after `::`.
        if (bundleDeploymentId && !staleDeploymentNotified) {
          const vercelId = response.headers.get('x-vercel-id')
          const responseDeploymentId = vercelId?.split('::').pop() ?? null
          if (responseDeploymentId && responseDeploymentId !== bundleDeploymentId) {
            staleDeploymentNotified = true
            promptReload('A newer version was just deployed. Reload to avoid errors.')
          }
        }

        if (actionId && !response.ok) {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
          posthog.captureException(
            new Error(`Server Action ${response.status}: ${actionId}`),
            {
              source: 'server-action-client',
              actionId,
              status: response.status,
              url,
              deploymentId: bundleDeploymentId,
            }
          )
          if (response.status === 404 && !staleDeploymentNotified) {
            staleDeploymentNotified = true
            promptReload('The app was just updated and that action is no longer available. Reload to continue.')
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
