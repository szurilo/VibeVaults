/**
 * Main Responsibility: Top-level React error boundary. Catches rendering errors that escape
 * per-route error.tsx boundaries and reports them to PostHog before showing fallback UI.
 *
 * Sensitive Dependencies:
 * - Must be a Client Component (uses useEffect).
 * - Must include its own <html> and <body> — it replaces the root layout when it renders.
 */
'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    posthog.captureException(error)
  }, [error])

  return (
    <html>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>We&apos;ve been notified and are looking into it. Please try refreshing the page.</p>
      </body>
    </html>
  )
}
