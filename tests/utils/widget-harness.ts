/**
 * Main Responsibility: Mounts the real `public/widget.js` on a synthetic host
 * page with every VibeVaults endpoint stubbed, so widget behaviour can be
 * driven in a browser without a database, a dev server, or a seeded project.
 *
 * Sensitive Dependencies:
 * - Serves the actual `public/widget.js`, so these tests fail when the shipped
 *   file changes behaviour. That is the point; do not swap in a copy.
 * - The widget derives its API origin from its own script src, so the stub host
 *   must serve both the page and the script from the same origin.
 */
import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const HOST = 'https://widget-harness.test';
export const PAGE_KEY = `${HOST}/`;
const API_KEY = 'harness-key';

export interface StubFeedback {
    id: string;
    content: string;
    sender?: string;
    status?: string;
    created_at: string;
    reply_count?: number;
    attachments?: unknown[];
    anchor?: unknown;
    page_key?: string | null;
}

/** Builds the anchor shape `public/widget.js` writes into feedback metadata. */
export function anchor(
    selector: string,
    x: { ref: 'start' | 'end' | 'pct'; d: number },
    y: { ref: 'start' | 'end' | 'pct'; d: number },
) {
    return {
        selector,
        selectorKind: 'id',
        offset: { x, y },
        fallback: { docX: 100, docY: 100, viewportW: 1280, docW: 1280 },
    };
}

export interface Harness {
    /** Body markup for the synthetic host page, without the widget script tag. */
    body: string;
    /** Rows the stubbed list endpoint returns. */
    feedback?: StubFeedback[];
    /**
     * Mount via `?vv_review=` (shareable review link) instead of `?vv_token=`.
     * No token is pre-planted; the widget must show the identity gate.
     */
    reviewBootstrap?: boolean;
    /** Value of `reviewPaused` in the stubbed config response. */
    reviewPaused?: boolean;
    /** Override for the stubbed POST /api/widget response (default: success). */
    submitResponse?: { status: number; body: string };
}

export interface MountedWidget {
    /** The most recent POST body the widget sent to /api/widget, if any. */
    submitted: () => Record<string, unknown> | null;
    /** The most recent POST body sent to /api/widget/identity/exchange, if any. */
    exchanged: () => Record<string, unknown> | null;
    /** Saved pin markers currently painted, in DOM order. */
    markers: () => Promise<{ label: string; cluster: boolean; approximate: boolean }[]>;
}

export const REVIEW_TOKEN = 'harness-review-token';

export async function mountWidget(page: Page, opts: Harness): Promise<MountedWidget> {
    const widgetJs = readFileSync(path.join(process.cwd(), 'public', 'widget.js'), 'utf8');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        *{box-sizing:border-box} body{margin:0;font-family:sans-serif}
      </style></head><body>${opts.body}
      <script src="${HOST}/widget.js" data-key="${API_KEY}"></script></body></html>`;

    let submitted: Record<string, unknown> | null = null;
    let exchanged: Record<string, unknown> | null = null;

    await page.route('**', async (route: Route) => {
        const url = route.request().url();
        // snapdom is fetched from a CDN; failing it fast keeps the tests offline
        // and exercises the capture-failure path rather than hanging on it.
        if (url.includes('cdn.jsdelivr.net')) return route.abort();
        if (url.includes('/api/widget/capture-info')) return route.fulfill({ status: 200, body: '{}' });
        if (url.includes('/api/widget/stream')) return route.abort();
        if (url.includes('/api/widget/errors')) return route.fulfill({ status: 200, body: '{}' });
        if (url.includes('/api/widget/identity/exchange')) {
            const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
            exchanged = body;
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ token: 'harness-token', email: body.email ?? 'client@example.com' }),
            });
        }
        if (url.includes('/api/widget/reply')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{"replies":[]}' });
        }
        if (url.includes('/api/widget/feedback')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ feedback: opts.feedback ?? [] }),
            });
        }
        if (/\/api\/widget(\?|$)/.test(url)) {
            if (route.request().method() === 'POST') {
                submitted = JSON.parse(route.request().postData() || '{}');
                return route.fulfill({
                    status: opts.submitResponse?.status ?? 200,
                    contentType: 'application/json',
                    body: opts.submitResponse?.body ?? '{"success":true,"feedback_id":"harness-new"}',
                });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    identity: { email: 'client@example.com' },
                    notifyReplies: true,
                    showBranding: false,
                    reviewPaused: opts.reviewPaused ?? false,
                }),
            });
        }
        if (url.includes('/widget.js')) {
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: widgetJs });
        }
        if (url.startsWith(HOST)) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: html });
        }
        return route.abort();
    });

    // `?vv_token=` is the owner/member bootstrap path: the widget plants the raw
    // token in localStorage and renders without an invite exchange.
    // `?vv_review=` is the shareable review link: no token exists yet, and the
    // widget becomes visible only to show the identity gate.
    await page.goto(opts.reviewBootstrap
        ? `${HOST}/?vv_review=${REVIEW_TOKEN}`
        : `${HOST}/?vv_token=harness-token`);
    await page.waitForFunction(() => {
        const host = document.querySelector('#vibe-vaults-widget-host') as HTMLElement | null;
        return !!host && host.style.display !== 'none';
    }, undefined, { timeout: 10_000 });

    return {
        submitted: () => submitted,
        exchanged: () => exchanged,
        markers: () =>
            page.evaluate(() => {
                const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
                return Array.from(root.querySelectorAll('.pin-marker:not(.pending)')).map((m) => ({
                    label: (m.textContent || '').trim(),
                    cluster: m.classList.contains('cluster'),
                    approximate: m.classList.contains('approximate'),
                }));
            }),
    };
}
