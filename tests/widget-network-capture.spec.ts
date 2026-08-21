/**
 * Tier 1 — Privacy: widget failed-request capture
 *
 * `public/widget.js` wraps window.fetch and XMLHttpRequest so failed requests
 * land in the console-log buffer that ships with every feedback report. Two
 * things must hold, and neither is visible in the dashboard until it is already
 * too late:
 *
 *   1. Privacy. Query strings are stripped on the user's device before the log
 *      entry exists, because a host site's query strings routinely carry reset
 *      tokens, access tokens and end-user email addresses. We are the customer's
 *      GDPR processor; storing those would be a breach of what /docs/widget-data
 *      publicly promises.
 *   2. Non-interference. The wrappers sit in the host site's request path. A
 *      swallowed rejection or a dropped response would break a customer's
 *      website, not ours.
 *
 * This is a pure logic test — no browser, no DB, no dev server. It extracts the
 * real block out of widget.js and runs it against a stubbed window, so the test
 * cannot drift away from the shipped code: rename the markers and it fails loud.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const START_MARKER = '    // --- Failed-request capture ---';
const END_MARKER = '    const getMetadata = () => ({';

type LogEntry = { type: string; time: string; content: string };

interface StubWindow {
    location: { href: string };
    fetch: (input?: unknown, opts?: { method?: string }) => Promise<unknown>;
    XMLHttpRequest: typeof FakeXHR;
    __vvNetworkPatched?: boolean;
}

class FakeXHR {
    listeners: Record<string, (() => void)[]> = {};
    status = 0;
    statusText = '';
    // Signature only — widget.js replaces this via the prototype patch.
    open(...args: unknown[]) { void args; /* the real capture happens in widget.js's prototype patch */ }
    send() { /* no-op */ }
    addEventListener(type: string, cb: () => void) { (this.listeners[type] ||= []).push(cb); }
    fire(type: string) { (this.listeners[type] || []).forEach((cb) => cb()); }
}

/** Loads the capture block from widget.js and runs it against a stub window. */
function loadCaptureBlock() {
    const src = readFileSync(path.resolve(__dirname, '../public/widget.js'), 'utf8');
    const start = src.indexOf(START_MARKER);
    const end = src.indexOf(END_MARKER);
    if (start < 0 || end < 0) {
        throw new Error('widget.js capture block markers not found — did the block move or get renamed?');
    }

    const logs: LogEntry[] = [];
    const origin = 'https://www.vibe-vaults.com';
    let fetchCalls = 0;
    let nextResponse: unknown = null;

    const stub: StubWindow = {
        location: { href: 'https://shop.example.com/cart' },
        fetch: async () => {
            fetchCalls++;
            if (nextResponse instanceof Error) throw nextResponse;
            return nextResponse;
        },
        XMLHttpRequest: FakeXHR,
    };

    new Function('logs', 'MAX_LOGS', 'origin', 'window', src.slice(start, end))(logs, 50, origin, stub);

    return {
        logs,
        stub,
        get fetchCalls() { return fetchCalls; },
        /** Drives one request through the patched fetch. */
        async request(response: unknown, url: string, opts?: { method?: string }) {
            nextResponse = response;
            try { await stub.fetch(url, opts); } catch { /* rejections are re-thrown by design */ }
        },
        setResponse(r: unknown) { nextResponse = r; },
        has(sub: string) { return logs.some((l) => l.content.includes(sub)); },
    };
}

const ok = { ok: true, status: 200 };
const failed = (status: number, statusText = '') => ({ ok: false, status, statusText });

test.describe('widget failed-request capture', () => {
    test('records failures only, never successful requests', async () => {
        const w = loadCaptureBlock();
        await w.request(ok, 'https://shop.example.com/api/cart');
        await w.request(failed(500, 'Internal Server Error'), 'https://shop.example.com/api/checkout', { method: 'post' });

        expect(w.has('/api/cart')).toBe(false);
        expect(w.has('POST https://shop.example.com/api/checkout failed: 500 Internal Server Error')).toBe(true);
        expect(w.logs.every((l) => l.type === 'network')).toBe(true);
    });

    test('strips query strings before the entry exists', async () => {
        const w = loadCaptureBlock();
        await w.request(
            failed(500, 'Internal Server Error'),
            'https://shop.example.com/api/reset?access_token=SECRET123&email=jane@example.com'
        );

        const entry = w.logs[0].content;
        expect(entry).toContain('https://shop.example.com/api/reset');
        expect(entry).not.toContain('SECRET123');
        expect(entry).not.toContain('access_token');
        expect(entry).not.toContain('jane@example.com');
        expect(entry).not.toContain('?');
    });

    test('redacts email-shaped path segments', async () => {
        const w = loadCaptureBlock();
        await w.request(failed(404, 'Not Found'), 'https://shop.example.com/users/jane@example.com/orders');

        expect(w.has('/users/[redacted]/orders')).toBe(true);
        expect(w.has('jane@example.com')).toBe(false);
    });

    test('excludes our own widget API traffic', async () => {
        const w = loadCaptureBlock();
        await w.request(failed(404), 'https://www.vibe-vaults.com/api/widget/capture-info', { method: 'POST' });
        await w.request(failed(500), 'blob:https://shop.example.com/abc');

        expect(w.logs).toHaveLength(0);
    });

    test('records network rejections and still re-throws to the host page', async () => {
        const w = loadCaptureBlock();
        w.setResponse(new TypeError('Failed to fetch'));

        await expect(w.stub.fetch('/api/save', { method: 'PUT' })).rejects.toThrow('Failed to fetch');
        expect(w.has('PUT https://shop.example.com/api/save failed: network error')).toBe(true);
        expect(w.fetchCalls).toBeGreaterThan(0);
    });

    test('collapses duplicates and caps the buffer at 15 entries', async () => {
        const w = loadCaptureBlock();
        await w.request(failed(500, 'Internal Server Error'), 'https://shop.example.com/api/checkout?try=1', { method: 'POST' });
        await w.request(failed(500, 'Internal Server Error'), 'https://shop.example.com/api/checkout?try=2', { method: 'POST' });
        expect(w.logs.filter((l) => l.content.includes('/api/checkout'))).toHaveLength(1);

        for (let i = 0; i < 25; i++) {
            await w.request(failed(500), `https://shop.example.com/api/n${i}`);
        }
        expect(w.logs).toHaveLength(15);
    });

    test('captures XHR failures and ignores XHR successes', async () => {
        const w = loadCaptureBlock();

        const bad = new w.stub.XMLHttpRequest();
        bad.open('delete', 'https://shop.example.com/api/items/9?token=abc');
        bad.send();
        bad.status = 403;
        bad.statusText = 'Forbidden';
        bad.fire('load');

        const good = new w.stub.XMLHttpRequest();
        good.open('GET', 'https://shop.example.com/api/ping');
        good.send();
        good.status = 200;
        good.fire('load');

        expect(w.has('DELETE https://shop.example.com/api/items/9 failed: 403 Forbidden')).toBe(true);
        expect(w.has('token=abc')).toBe(false);
        expect(w.has('/api/ping')).toBe(false);
    });
});
