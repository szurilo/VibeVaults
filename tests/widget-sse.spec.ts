/**
 * Tier 1 — Real-time chat: Widget SSE stream
 *
 * /api/widget/stream is how the widget's open thread sees new replies without
 * polling. It sits on top of Supabase Realtime (postgres_changes INSERT on
 * feedback_replies). Regressions silently break the "reply appears in the
 * widget as soon as the dashboard sends it" UX — users usually misread this
 * as "chat is broken" rather than "realtime stopped working".
 *
 * Covered:
 *   1. Auth + validation — missing/invalid params, wrong API key, unauthorized
 *      email, cross-project feedbackId all reject before the stream opens.
 *   2. Happy path — opening a stream for a valid feedback then inserting a
 *      reply produces a `new_reply` SSE event with the reply body.
 *   3. Connected event — the stream emits `event: connected` on open (the
 *      widget uses this as "we're live, mark the connection state green").
 *
 * Not covered:
 *   - Heartbeat (30s interval — too slow to wait for in CI).
 *   - Status updates + attachment events (same plumbing; if #2 works those do
 *     too). Worth adding if we hit a regression there.
 *
 * Sensitive Dependencies:
 * - Uses node-native fetch (Playwright's request.get buffers). Stream is
 *   aborted via AbortController on timeout so the process exits cleanly.
 * - Creates a throwaway feedback + reply and cleans them up in afterAll.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';

test.describe.configure({ mode: 'serial' });
test.use({ storageState: { cookies: [], origins: [] } });

const BASE = 'http://127.0.0.1:3000';

/**
 * Open an SSE stream, collect events until `predicate` matches, then abort.
 * Times out after `timeoutMs` if no matching event arrives.
 */
async function collectSseEventUntil(
    url: string,
    predicate: (event: string, data: string) => boolean,
    timeoutMs = 10_000
): Promise<{ event: string; data: string } | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok || !res.body) {
            return null;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) return null;
            buf += decoder.decode(value, { stream: true });

            // SSE frames are terminated by a blank line.
            let frameEnd: number;
            while ((frameEnd = buf.indexOf('\n\n')) !== -1) {
                const frame = buf.slice(0, frameEnd);
                buf = buf.slice(frameEnd + 2);

                const lines = frame.split('\n');
                const event =
                    lines.find(l => l.startsWith('event: '))?.slice(7) ?? 'message';
                const data =
                    lines.find(l => l.startsWith('data: '))?.slice(6) ?? '';

                if (predicate(event, data)) {
                    ctrl.abort(); // end the stream cleanly
                    return { event, data };
                }
            }
        }
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ---------------------------------------------------------------------------
// Auth + validation
// ---------------------------------------------------------------------------

test.describe('GET /api/widget/stream — auth + validation', () => {
    test('missing feedbackId → 400', async () => {
        const seed = getSeedResult();
        const res = await fetch(
            `${BASE}/api/widget/stream?key=${seed.apiKey}&email=${encodeURIComponent(seed.clientEmail)}`
        );
        expect(res.status).toBe(400);
    });

    test('missing email → 400', async () => {
        const seed = getSeedResult();
        const res = await fetch(
            `${BASE}/api/widget/stream?feedbackId=x&key=${seed.apiKey}`
        );
        expect(res.status).toBe(400);
    });

    test('invalid API key → 401', async () => {
        const seed = getSeedResult();
        const res = await fetch(
            `${BASE}/api/widget/stream?feedbackId=x&key=bogus&email=${encodeURIComponent(seed.clientEmail)}`
        );
        expect(res.status).toBe(401);
    });

    test('unauthorized email → 403', async () => {
        const seed = getSeedResult();
        const stranger = `e2e-stranger-sse-${Date.now()}@example.com`;
        const res = await fetch(
            `${BASE}/api/widget/stream?feedbackId=doesnt-matter&key=${seed.apiKey}&email=${encodeURIComponent(stranger)}`
        );
        expect(res.status).toBe(403);
    });

    test('valid key + email but feedbackId not in this project → 404', async () => {
        const seed = getSeedResult();
        const res = await fetch(
            `${BASE}/api/widget/stream?feedbackId=00000000-0000-0000-0000-000000000000&key=${seed.apiKey}&email=${encodeURIComponent(seed.clientEmail)}`
        );
        expect(res.status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// Happy path — open stream → insert reply → receive new_reply event
// ---------------------------------------------------------------------------

test.describe('GET /api/widget/stream — live reply delivery', () => {
    let feedbackId: string;

    test.beforeAll(async () => {
        const seed = getSeedResult();
        const { data } = await supabaseAdmin
            .from('feedbacks')
            .insert({
                project_id: seed.projectId,
                content: 'SSE host feedback',
                type: 'Feature',
                sender: seed.clientEmail,
            })
            .select('id')
            .single();
        feedbackId = data!.id;
    });

    test.afterAll(async () => {
        if (!feedbackId) return;
        await supabaseAdmin.from('notifications').delete().eq('feedback_id', feedbackId);
        await supabaseAdmin.from('feedback_replies').delete().eq('feedback_id', feedbackId);
        await supabaseAdmin.from('feedbacks').delete().eq('id', feedbackId);
    });

    test('stream emits a `connected` event on open', async () => {
        const seed = getSeedResult();
        const url = `${BASE}/api/widget/stream?feedbackId=${feedbackId}&key=${seed.apiKey}&email=${encodeURIComponent(seed.clientEmail)}`;

        const match = await collectSseEventUntil(
            url,
            event => event === 'connected',
            5_000
        );
        expect(match, 'connected event should be emitted immediately').not.toBeNull();
        expect(match!.data).toContain(feedbackId);
    });

    test('inserting a reply produces a `new_reply` event on an open stream', async () => {
        const seed = getSeedResult();
        const url = `${BASE}/api/widget/stream?feedbackId=${feedbackId}&key=${seed.apiKey}&email=${encodeURIComponent(seed.clientEmail)}`;
        const replyMarker = `sse-roundtrip-${Date.now()}`;

        // Kick off stream collection; don't await it yet.
        const streamPromise = collectSseEventUntil(
            url,
            (event, data) => event === 'new_reply' && data.includes(replyMarker),
            15_000
        );

        // Give the subscription ~700ms to land BEFORE the INSERT fires, or the
        // reply can arrive before Realtime starts listening. 700ms is empirical
        // for local Supabase; bump if this flakes.
        await new Promise(r => setTimeout(r, 700));

        await supabaseAdmin
            .from('feedback_replies')
            .insert({
                feedback_id: feedbackId,
                content: replyMarker,
                author_role: 'agency',
                author_name: seed.ownerEmail,
            });

        const match = await streamPromise;
        expect(match, 'SSE must deliver the reply within 15s').not.toBeNull();
        expect(match!.data).toContain(replyMarker);
    });
});
