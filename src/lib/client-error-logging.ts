/**
 * Main Responsibility: Centralised client-side error reporter used by `catch`
 * blocks that previously did `console.error` + generic `alert`. Logs the
 * structured error (message + statusCode + caller-supplied extras) to the
 * console and forwards it to PostHog via captureException — caught errors
 * are invisible to `capture_exceptions: true`, so they must be reported
 * explicitly. Returns the underlying error message so the caller can show
 * a useful alert instead of "Please try again."
 *
 * Sensitive Dependencies: posthog-js is initialised lazily in PostHogProvider
 * at idle time and is opted-out by default on localhost / before consent, so
 * captureException is wrapped in try/catch — telemetry must never break the
 * user's flow.
 */
import posthog from 'posthog-js';

export function reportClientError(
    error: unknown,
    context: string,
    extra: Record<string, unknown> = {}
): string {
    const err = error as { message?: string; statusCode?: string | number } | undefined;
    const message = err?.message ?? (typeof error === 'string' ? error : 'Unknown error');
    const statusCode = err?.statusCode;
    console.error(`[${context}]`, { message, statusCode, ...extra, error });
    try {
        posthog.captureException(
            error instanceof Error ? error : new Error(message),
            { context, statusCode, ...extra }
        );
    } catch {
        // Never let telemetry break the user's flow.
    }
    return message;
}
