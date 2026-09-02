/**
 * Shareable review link: identity gate bootstrap and the pause state.
 *
 * The review link (`?vv_review=<projects.review_token>`) is the no-invite
 * capture path: anyone opening it self-identifies with a name + email, the
 * widget exchanges the review token for a per-device identity, and from then
 * on behaves exactly like an invited client. Two behaviours here fail silently
 * and would be visible on a customer's site before ours:
 *
 *   1. The gate. If it stops appearing, the review link a customer already
 *      shared with their client does nothing at all.
 *   2. Pause semantics. A paused reviewer must be blocked from writing but
 *      keep browsing — and above all a pause 403 must NOT be treated as a
 *      revoked token, which would wipe the reviewer's identity.
 *
 * Same harness as widget-pinning: the real `public/widget.js` against stubbed
 * endpoints, no database or dev server.
 */
import { test, expect, type Page } from '@playwright/test';
import { mountWidget, REVIEW_TOKEN } from './utils/widget-harness';

const BODY = `<div style="padding:60px"><button id="cta" style="padding:14px 26px">Buy now</button></div>`;

const shadowEval = (page: Page, script: string) =>
    page.evaluate(`(() => {
        const root = document.querySelector('#vibe-vaults-widget-host').shadowRoot;
        return (${script})(root);
    })()`);

async function fillGateAndStart(page: Page, name: string, email: string) {
    await shadowEval(page, `(root) => {
        root.querySelector('#vv-review-name').value = ${JSON.stringify(name)};
        root.querySelector('#vv-review-email').value = ${JSON.stringify(email)};
        root.querySelector('#vv-review-start').click();
    }`);
}

test.describe('review link identity gate', () => {
    test('shows the gate, strips the URL param, and exchanges name + email for a token', async ({ page }) => {
        const widget = await mountWidget(page, { body: BODY, reviewBootstrap: true });

        // Param stripped so the review token cannot leak via referrer/share.
        expect(page.url()).not.toContain('vv_review');

        // Gate is open, widget panel is not.
        expect(await shadowEval(page, `(root) => root.querySelector('#vv-review-gate').classList.contains('open')`)).toBe(true);
        expect(await shadowEval(page, `(root) => root.querySelector('.popup').classList.contains('open')`)).toBe(false);

        await fillGateAndStart(page, 'Jane Reviewer', 'jane@example.com');

        // Exchange carried the review token and the self-declared identity.
        await expect.poll(() => widget.exchanged()).not.toBeNull();
        expect(widget.exchanged()).toMatchObject({
            reviewToken: REVIEW_TOKEN,
            name: 'Jane Reviewer',
            email: 'jane@example.com',
        });

        // Token planted, gate gone, widget auto-opened on the pin bar.
        await expect.poll(() =>
            page.evaluate(() => localStorage.getItem('vv_token_harness-key'))
        ).toBe('harness-token');
        expect(await shadowEval(page, `(root) => root.querySelector('#vv-review-gate').classList.contains('open')`)).toBe(false);
        await expect.poll(() =>
            shadowEval(page, `(root) => root.querySelector('.popup').classList.contains('open')`)
        ).toBe(true);
    });

    test('rejects a missing name and a malformed email without calling the server', async ({ page }) => {
        const widget = await mountWidget(page, { body: BODY, reviewBootstrap: true });

        await fillGateAndStart(page, '', 'jane@example.com');
        expect(await shadowEval(page, `(root) => root.querySelector('#vv-review-error').textContent`)).toContain('name');

        await fillGateAndStart(page, 'Jane', 'not-an-email');
        expect(await shadowEval(page, `(root) => root.querySelector('#vv-review-error').textContent`)).toContain('email');

        expect(widget.exchanged()).toBeNull();
    });

    test('backdrop click dismisses the gate and hides the widget instead of trapping the visitor', async ({ page }) => {
        await mountWidget(page, { body: BODY, reviewBootstrap: true });

        await shadowEval(page, `(root) => root.querySelector('#vv-review-gate').click()`);

        expect(await shadowEval(page, `(root) => root.querySelector('#vv-review-gate').classList.contains('open')`)).toBe(false);
        expect(await page.evaluate(() =>
            (document.querySelector('#vibe-vaults-widget-host') as HTMLElement).style.display
        )).toBe('none');
    });
});

test.describe('review pause', () => {
    test('paused config shows the banner and refuses to arm pin placement', async ({ page }) => {
        await mountWidget(page, { body: BODY, reviewPaused: true });

        await shadowEval(page, `(root) => root.querySelector('.trigger-btn').click()`);
        await page.waitForTimeout(100);

        // Banner visible inside the open panel.
        expect(await shadowEval(page, `(root) =>
            getComputedStyle(root.querySelector('#vv-paused-note')).display
        `)).not.toBe('none');

        // Pin refuses to arm: no capture overlay appears, a toast explains why.
        await shadowEval(page, `(root) => root.querySelector('#vv-action-pin').click()`);
        await page.waitForTimeout(100);
        expect(await shadowEval(page, `(root) => !!root.querySelector('.capture-overlay')`)).toBe(false);
        expect(await shadowEval(page, `(root) => root.querySelector('.vv-toast')?.textContent ?? ''`)).toContain('paused');
    });

    test('a mid-session pause 403 flips to paused without wiping the identity', async ({ page }) => {
        await mountWidget(page, {
            body: BODY,
            submitResponse: {
                status: 403,
                body: JSON.stringify({ error: 'Feedback is paused for this review link.', code: 'review_paused' }),
            },
        });

        // Arm, pin the button, submit.
        await shadowEval(page, `(root) => root.querySelector('.trigger-btn').click()`);
        await page.waitForTimeout(100);
        await shadowEval(page, `(root) => root.querySelector('#vv-action-pin').click()`);
        await page.waitForTimeout(120);
        await page.mouse.click(120, 90);
        await expect.poll(() =>
            shadowEval(page, `(root) => root.querySelector('#vv-composer').classList.contains('open')`)
        ).toBe(true);
        await shadowEval(page, `(root) => {
            root.querySelector('#vv-composer-text').value = 'Broken button';
            root.querySelector('#vv-composer-submit').click();
        }`);

        // The widget switched into the paused state...
        await expect.poll(() =>
            shadowEval(page, `(root) => root.querySelector('.launcher').parentElement.classList.contains('review-paused')`)
        ).toBe(true);

        // ...but the identity survived: token intact, widget still visible.
        expect(await page.evaluate(() => localStorage.getItem('vv_token_harness-key'))).toBe('harness-token');
        expect(await page.evaluate(() =>
            (document.querySelector('#vibe-vaults-widget-host') as HTMLElement).style.display
        )).not.toBe('none');
    });
});
