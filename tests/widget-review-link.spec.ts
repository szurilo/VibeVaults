/**
 * Shareable review link: widget-side bootstrap params and the pause state.
 *
 * The guest identity gate lives on the hosted /review/<token> page (tested
 * server-backed in review-entry.spec.ts). What the widget itself owns:
 *
 *   1. `vv_token` + `vv_key`: the hosted page redirects here with a planted
 *      token and the project's real API key — the widget must adopt that key
 *      for every call, or a stale embed-snippet key strands the session.
 *   2. Pause semantics. A paused guest must be blocked from writing but keep
 *      browsing — and above all a pause 403 must NOT be treated as a revoked
 *      token, which would wipe the guest's identity.
 *
 * Same harness as widget-pinning: the real `public/widget.js` against stubbed
 * endpoints, no database or dev server.
 */
import { test, expect, type Page } from '@playwright/test';
import { mountWidget } from './utils/widget-harness';

const BODY = `<div style="padding:60px"><button id="cta" style="padding:14px 26px">Buy now</button></div>`;

const shadowEval = (page: Page, script: string) =>
    page.evaluate(`(() => {
        const root = document.querySelector('#vibe-vaults-widget-host').shadowRoot;
        return (${script})(root);
    })()`);

test.describe('review link bootstrap params', () => {
    test('vv_token + vv_key plants the token and remaps the API key past a stale embed key', async ({ page }) => {
        const widget = await mountWidget(page, {
            body: BODY,
            extraParams: '&vv_key=fresh-project-key',
        });

        // Params stripped so tokens cannot leak via referrer/share.
        expect(page.url()).not.toContain('vv_token');
        expect(page.url()).not.toContain('vv_key');

        // Calls carry the hosted page's key, not the embed snippet's key...
        await expect.poll(() => widget.lastConfigKey()).toBe('fresh-project-key');
        // ...the remap is persisted per embed key so reloads keep working...
        expect(await page.evaluate(() => localStorage.getItem('vv_apikey_harness-key'))).toBe('fresh-project-key');
        // ...and the identity token stays under the embed-key-derived storage key.
        expect(await page.evaluate(() => localStorage.getItem('vv_token_harness-key'))).toBe('harness-token');
    });

    test('a bare vv_token clears a stale key remap', async ({ page }) => {
        await page.addInitScript(() => {
            try { localStorage.setItem('vv_apikey_harness-key', 'dead-old-key'); } catch { /* ignore */ }
        });
        const widget = await mountWidget(page, { body: BODY });

        await expect.poll(() => widget.lastConfigKey()).toBe('harness-key');
        expect(await page.evaluate(() => localStorage.getItem('vv_apikey_harness-key'))).toBeNull();
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
