/**
 * Main Responsibility: Reports server-side errors (Server Components, Server Actions, API routes)
 * to PostHog via the onRequestError hook. Next.js 15+ built-in mechanism.
 *
 * Sensitive Dependencies:
 * - posthog-node for server-side capture (separate SDK from posthog-js).
 * - Only runs in Node.js runtime, skipped for edge routes.
 */
export async function register() {
  // No-op — required export for Next.js instrumentation
}

export const onRequestError: import('next/dist/server/instrumentation/types').InstrumentationOnRequestError = async (
  err,
  request,
  context
) => {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  const { PostHog } = await import('posthog-node')
  const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: 'https://eu.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  })

  const error = err as Error
  posthog.captureException(error, undefined, {
    path: request.path,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  })

  await posthog.shutdown()
}
