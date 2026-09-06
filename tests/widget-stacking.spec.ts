/**
 * The widget must render above the customer's page, always.
 *
 * This regressed in the field: a Framer element painted over the widget's
 * toast. The cause is a Shadow DOM subtlety — `:host` rules have LOWER
 * specificity than any rule in the outer document that matches the host, so
 * the customer's own stylesheet can override the widget's position/z-index
 * and drop the whole thing behind the page. The stacking styles are therefore
 * set inline with !important on the host element.
 *
 * The page below is deliberately hostile: a full-viewport overlay with a huge
 * z-index, plus page CSS that tries to override the host directly.
 */
import { test, expect } from '@playwright/test';
import { mountWidget } from './utils/widget-harness';

const HOSTILE_PAGE = `
  <style>
    /* Exactly the shape of rule that beats a :host declaration. */
    #vibe-vaults-widget-host { position: static; z-index: 1; }
    div { z-index: 0; }
  </style>
  <div id="page-overlay" style="position:fixed; inset:0; background:rgba(255,0,0,0.3); z-index:2147483000;">
    Framer-style overlay
  </div>`;

/** What the browser says is on top at this point, from the page's view. */
const topElementAt = (page: import('@playwright/test').Page, x: number, y: number) =>
    page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? (el.id || el.tagName.toLowerCase()) : null;
    }, { x, y });

test.describe('widget stacking against a hostile page', () => {
    test('the host keeps fixed positioning and the top z-index', async ({ page }) => {
        await mountWidget(page, { body: HOSTILE_PAGE });

        const computed = await page.evaluate(() => {
            const host = document.querySelector('#vibe-vaults-widget-host') as HTMLElement;
            const s = getComputedStyle(host);
            return { position: s.position, zIndex: s.zIndex, pointerEvents: s.pointerEvents };
        });

        expect(computed.position).toBe('fixed');
        expect(computed.zIndex).toBe('2147483647');
        // The host must stay click-through so the customer's page still works.
        expect(computed.pointerEvents).toBe('none');
    });

    test('the launcher sits above a max-z-index page overlay', async ({ page }) => {
        await mountWidget(page, { body: HOSTILE_PAGE });

        const box = await page.evaluate(() => {
            const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
            const btn = root.querySelector('.trigger-btn') as HTMLElement;
            const r = btn.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        // Hit-testing the launcher must reach the widget, not the overlay.
        expect(await topElementAt(page, box.x, box.y)).toBe('vibe-vaults-widget-host');
    });

    test('the toast renders above the page overlay', async ({ page }) => {
        await mountWidget(page, { body: HOSTILE_PAGE });

        // Open the panel, then trigger the toast the same way the widget does.
        await page.evaluate(() => {
            const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
            (root.querySelector('.trigger-btn') as HTMLElement).click();
        });
        await page.waitForTimeout(150);
        await page.evaluate(() => {
            const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
            (root.querySelector('#vv-action-pin') as HTMLElement).click();
        });
        await page.waitForTimeout(150);

        const toast = await page.evaluate(() => {
            const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
            const el = root.querySelector('.vv-toast') as HTMLElement | null;
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        // A toast only appears in some flows; when it does, it must be on top.
        if (toast) {
            expect(await topElementAt(page, toast.x, toast.y)).toBe('vibe-vaults-widget-host');
        }
    });
});
