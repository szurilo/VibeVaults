/**
 * Main Responsibility: Tiny in-memory rate limiter for public server actions
 * (per-process, resets on cold start — fine for v1, swap for Redis if abuse
 * appears). Shared by widget-access recovery and the review-link redeem.
 *
 * Sensitive Dependencies:
 * - `.playwright-running` flag file (written by tests/global-setup.ts): the
 *   limiter is bypassed during E2E runs because the bucket is process-local
 *   and the dev server is reused across runs, so accumulated hits trip false
 *   positives. Same pattern as `src/lib/resend.ts`.
 */
import fs from 'fs';
import path from 'path';

export const isPlaywrightRun = () => fs.existsSync(path.join(process.cwd(), '.playwright-running'));

export function createActionRateLimiter(windowMs: number) {
    const hits = new Map<string, { count: number; resetAt: number }>();

    return function isRateLimited(key: string, max: number): boolean {
        if (isPlaywrightRun()) return false;
        const now = Date.now();
        const entry = hits.get(key);
        if (!entry || now > entry.resetAt) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            return false;
        }
        entry.count++;
        return entry.count > max;
    };
}
