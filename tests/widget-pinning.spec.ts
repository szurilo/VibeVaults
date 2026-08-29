/**
 * Tier 1 — Pinned feedback: anchoring durability and the on-page pin layer
 *
 * Pin-anywhere is what lets a designer flag the things element tagging cannot
 * express, above all the empty space between two elements. Two properties carry
 * that promise, and both fail silently:
 *
 *   1. Durability. A pin is stored relative to an element, never as a raw screen
 *      coordinate, so it survives scrolling, a resize, and a redeploy. The
 *      earlier percentage-only model slid a pin 200px away from the button it
 *      was marking when a 3840px window was narrowed. `/docs/pinning` promises
 *      this works; these tests are what keep that true.
 *   2. The pin layer. Pins render on the customer's live site, so a regression
 *      here is visible to their clients before it is visible to us.
 *
 * No database, dev server, or seeded project: the harness serves the real
 * `public/widget.js` against stubbed endpoints, so these run anywhere and any
 * failure is a genuine behaviour change in the shipped widget.
 */
import { test, expect, type Page } from '@playwright/test';
import { mountWidget, anchor, PAGE_KEY, type StubFeedback } from './utils/widget-harness';
import { describeAnchorOffset, describeAnchorConfidence, type FeedbackAnchor, type AnchorAxis } from '../src/lib/feedback-utils';

const LAYOUT = `
  <div class="hero" style="padding:60px 56px">
    <h1>Headline</h1>
    <div class="row" style="display:flex;gap:14px">
      <button id="see-work" style="padding:14px 26px">See our work</button>
      <button id="book-call" style="padding:14px 26px">Book a call</button>
    </div>
  </div>
  <div class="dead-air" style="height:200px"></div>
  <div class="grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px;padding:0 56px">
    <div class="card" id="c1" style="height:160px;background:#eef">1</div>
    <div class="card" id="c2" style="height:160px;background:#eef">2</div>
    <div class="card" id="c3" style="height:160px;background:#eef">3</div>
  </div>`;

/** Opens the widget panel if it is collapsed. Pins only render while open. */
async function openWidget(page: Page) {
    await page.evaluate(() => {
        const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
        if (!root.querySelector('.popup')!.classList.contains('open')) {
            (root.querySelector('.trigger-btn') as HTMLElement).click();
        }
    });
    await page.waitForTimeout(150);
}

/** Arms placement via the Pin button, then clicks the page to drop one. */
async function dropPin(page: Page, x: number, y: number) {
    await openWidget(page);
    await page.evaluate(() => {
        (document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!
            .querySelector('#vv-action-pin') as HTMLElement).click();
    });
    await page.waitForTimeout(120);
    await page.mouse.move(x, y);
    await page.waitForTimeout(60);
    await page.mouse.click(x, y);
    await expect
        .poll(() => page.evaluate(() =>
            document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!
                .querySelector('#vv-composer')!.classList.contains('open')))
        .toBe(true);
}

const isOpen = (page: Page, sel: string) =>
    page.evaluate((s) => document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!
        .querySelector(s)!.classList.contains('open'), sel);

const clickAction = (page: Page, id: string) =>
    page.evaluate((i) => {
        (document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!
            .querySelector(i) as HTMLElement).click();
    }, id);

/** Viewport coordinates of the pending pin's tip. */
function pendingTip(page: Page) {
    return page.evaluate(() => {
        const m = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!.querySelector('.pin-marker.pending');
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.bottom) };
    });
}

function closeComposer(page: Page) {
    return page.evaluate(() => {
        (document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!
            .querySelector('#vv-composer-close') as HTMLElement).click();
    });
}

test.describe('pin anchoring survives layout change', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 3840, height: 1200 });
    });

    test('a pin beside a left-aligned button keeps its distance when the window narrows', async ({ page }) => {
        await mountWidget(page, { body: LAYOUT });

        const wide = (await page.locator('#book-call').boundingBox())!;
        await dropPin(page, Math.round(wide.x + wide.width + 40), Math.round(wide.y + wide.height / 2));
        const before = (await pendingTip(page))!;
        const gapBefore = Math.round(before.x - (wide.x + wide.width));

        await page.setViewportSize({ width: 1440, height: 1200 });
        await page.waitForTimeout(300);

        const narrow = (await page.locator('#book-call').boundingBox())!;
        const after = (await pendingTip(page))!;
        const gapAfter = Math.round(after.x - (narrow.x + narrow.width));

        // Percentage-of-the-wrapper anchoring used to move this pin to x≈144
        // while the button stayed at x≈344.
        expect(Math.abs(gapAfter - gapBefore)).toBeLessThanOrEqual(3);
    });

    test('a pin in the gap between two cards stays in that gap', async ({ page }) => {
        await mountWidget(page, { body: LAYOUT });

        const a = (await page.locator('#c1').boundingBox())!;
        const b = (await page.locator('#c2').boundingBox())!;
        await dropPin(page, Math.round((a.x + a.width + b.x) / 2), Math.round(a.y + a.height / 2));

        await page.setViewportSize({ width: 1440, height: 1200 });
        await page.waitForTimeout(300);

        const na = (await page.locator('#c1').boundingBox())!;
        const nb = (await page.locator('#c2').boundingBox())!;
        const tip = (await pendingTip(page))!;
        expect(tip.x).toBeGreaterThanOrEqual(Math.round(na.x + na.width) - 2);
        expect(tip.x).toBeLessThanOrEqual(Math.round(nb.x) + 2);
    });

    test('a pin inside a fluid element keeps its proportional position', async ({ page }) => {
        await mountWidget(page, { body: LAYOUT });

        const wide = (await page.locator('#c3').boundingBox())!;
        await dropPin(page, Math.round(wide.x + wide.width * 0.75), Math.round(wide.y + wide.height / 2));

        await page.setViewportSize({ width: 1440, height: 1200 });
        await page.waitForTimeout(300);

        const narrow = (await page.locator('#c3').boundingBox())!;
        const tip = (await pendingTip(page))!;
        expect((tip.x - narrow.x) / narrow.width).toBeCloseTo(0.75, 1);
    });

    test('the pin tip lands exactly on the clicked point', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await mountWidget(page, { body: LAYOUT });

        const gap = (await page.locator('.dead-air').boundingBox())!;
        const x = Math.round(gap.x + gap.width / 2);
        const y = Math.round(gap.y + gap.height / 2);
        await dropPin(page, x, y);

        // The marker is a square rotated 45deg, so its tip is not its box edge.
        const tip = (await pendingTip(page))!;
        expect(Math.abs(tip.x - x)).toBeLessThanOrEqual(2);
        expect(Math.abs(tip.y - y)).toBeLessThanOrEqual(2);
    });

    test('the widget host never intercepts clicks meant for the page', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await mountWidget(page, { body: LAYOUT });

        // Collapsed, the widget must leave the customer's page entirely alone.
        await page.waitForTimeout(200);
        const hit = await page.evaluate(() => {
            const el = document.elementFromPoint(200, 40);
            return el ? el.tagName.toLowerCase() : 'null';
        });
        expect(hit).not.toBe('div#vibe-vaults-widget-host');
        expect(await page.evaluate(() =>
            getComputedStyle(document.querySelector('#vibe-vaults-widget-host')!).pointerEvents)).toBe('none');
    });
});

test.describe('on-page pin layer', () => {
    const PINS: StubFeedback[] = [
        {
            id: 'f3', content: 'third', created_at: '2026-08-27T10:02:00Z',
            anchor: anchor('#c3', { ref: 'pct', d: 0.5 }, { ref: 'pct', d: 0.5 }), page_key: PAGE_KEY,
        },
        {
            id: 'f2', content: 'second', created_at: '2026-08-27T10:01:00Z',
            anchor: anchor('#c1', { ref: 'pct', d: 0.31 }, { ref: 'pct', d: 0.5 }), page_key: PAGE_KEY,
        },
        {
            id: 'f1', content: 'first', created_at: '2026-08-27T10:00:00Z',
            anchor: anchor('#c1', { ref: 'pct', d: 0.3 }, { ref: 'pct', d: 0.5 }), page_key: PAGE_KEY,
        },
        // Belongs to a different page and must never be drawn here.
        {
            id: 'f0', content: 'other page', created_at: '2026-08-27T09:00:00Z',
            anchor: anchor('#c1', { ref: 'pct', d: 0.9 }, { ref: 'pct', d: 0.5 }), page_key: `${PAGE_KEY}other`,
        },
        // Reported from the dashboard, so it has no place on the page at all.
        { id: 'fx', content: 'no anchor', created_at: '2026-08-27T08:00:00Z', anchor: null, page_key: null },
    ];

    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
    });

    test('draws only anchored pins belonging to this page, numbered oldest first', async ({ page }) => {
        const widget = await mountWidget(page, { body: LAYOUT, feedback: PINS });
        await openWidget(page);
        await expect.poll(() => widget.markers().then((m) => m.length)).toBe(2);

        const markers = await widget.markers();
        expect(markers.some((m) => m.cluster && m.label === '2')).toBe(true);
        expect(markers.some((m) => !m.cluster && m.label === '3')).toBe(true);
    });

    test('overlapping pins cluster and fan out on click', async ({ page }) => {
        const widget = await mountWidget(page, { body: LAYOUT, feedback: PINS });
        await openWidget(page);
        await expect.poll(() => widget.markers().then((m) => m.length)).toBe(2);

        await page.evaluate(() => {
            (document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!
                .querySelector('.pin-marker.cluster') as HTMLElement).click();
        });
        await expect.poll(() => widget.markers().then((m) => m.length)).toBe(3);
        expect((await widget.markers()).some((m) => m.cluster)).toBe(false);
    });

    test('clicking a pin opens its thread', async ({ page }) => {
        const widget = await mountWidget(page, { body: LAYOUT, feedback: PINS });
        await openWidget(page);
        await expect.poll(() => widget.markers().then((m) => m.length)).toBe(2);

        await page.evaluate(() => {
            const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
            (root.querySelector('.pin-marker:not(.pending):not(.cluster)') as HTMLElement).click();
        });
        await expect
            .poll(() => page.evaluate(() => {
                const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
                return (root.querySelector('.view-detail') as HTMLElement).style.display;
            }))
            .toBe('flex');
    });

    test('collapsing the widget hides the pins and hands the site back', async ({ page }) => {
        const widget = await mountWidget(page, { body: LAYOUT, feedback: PINS });
        await openWidget(page);
        await expect.poll(() => widget.markers().then((m) => m.length)).toBe(2);

        await page.evaluate(() => {
            (document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!
                .querySelector('.trigger-btn') as HTMLElement).click();
        });
        await expect.poll(() => widget.markers().then((m) => m.length)).toBe(0);
        expect(await page.evaluate(() =>
            !!document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!.querySelector('.capture-overlay'))).toBe(false);

        await openWidget(page);
        await expect.poll(() => widget.markers().then((m) => m.length)).toBe(2);
    });

    test('the Feedback button toggles the list open and closed', async ({ page }) => {
        await mountWidget(page, { body: LAYOUT, feedback: PINS });
        await openWidget(page);

        const listVisible = () => page.evaluate(() =>
            document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!
                .querySelector('.popup')!.classList.contains('list-open'));

        expect(await listVisible()).toBe(false);
        await clickAction(page, '#vv-action-list');
        expect(await listVisible()).toBe(true);
        await clickAction(page, '#vv-action-list');
        expect(await listVisible()).toBe(false);
    });

    test('Pin arms one placement and disarms itself afterwards', async ({ page }) => {
        // Leaving the overlay up would keep swallowing clicks on the customer's
        // own site, so placement has to be one-shot.
        await mountWidget(page, { body: LAYOUT, feedback: PINS });
        await openWidget(page);

        const armed = () => page.evaluate(() =>
            !!document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!.querySelector('.capture-overlay'));

        expect(await armed()).toBe(false);
        await clickAction(page, '#vv-action-pin');
        expect(await armed()).toBe(true);

        const gap = (await page.locator('.dead-air').boundingBox())!;
        await page.mouse.click(Math.round(gap.x + gap.width / 2), Math.round(gap.y + gap.height / 2));
        await expect.poll(() => isOpen(page, '#vv-composer')).toBe(true);
        expect(await armed()).toBe(false);
    });

    test('a freshly submitted pin stays visible without waiting for the next poll', async ({ page }) => {
        // The stub list never returns the new row, so anything still drawn here
        // is the optimistic insert surviving the immediate refetch.
        const widget = await mountWidget(page, { body: LAYOUT, feedback: PINS });
        await openWidget(page);
        await expect.poll(() => widget.markers().then((m) => m.length)).toBe(2);

        const gap = (await page.locator('.dead-air').boundingBox())!;
        await dropPin(page, Math.round(gap.x + gap.width / 2), Math.round(gap.y + gap.height / 2));

        await page.evaluate(() => {
            const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
            (root.querySelector('#vv-composer-text') as HTMLTextAreaElement).value = 'this gap is too big';
            (root.querySelector('#vv-composer-submit') as HTMLElement).click();
        });

        await expect.poll(() => widget.markers().then((m) => m.length)).toBe(3);
        expect(await page.evaluate(() =>
            !!document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!.querySelector('.pin-marker.pending'))).toBe(false);

        const body = widget.submitted()!;
        const metadata = body.metadata as Record<string, unknown>;
        expect(metadata.anchor).toBeTruthy();
        expect(metadata.page_key).toBe(PAGE_KEY);
    });
});

test.describe('pin data recorded for a report', () => {
    test('stores an element-relative anchor, never a raw coordinate', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        const widget = await mountWidget(page, { body: LAYOUT });

        const gap = (await page.locator('.dead-air').boundingBox())!;
        await dropPin(page, Math.round(gap.x + gap.width / 2), Math.round(gap.y + gap.height / 2));
        await page.evaluate(() => {
            const root = document.querySelector('#vibe-vaults-widget-host')!.shadowRoot!;
            (root.querySelector('#vv-composer-text') as HTMLTextAreaElement).value = 'spacing';
            (root.querySelector('#vv-composer-submit') as HTMLElement).click();
        });
        await expect.poll(() => widget.submitted()).not.toBeNull();

        const metadata = widget.submitted()!.metadata as Record<string, unknown>;
        const a = metadata.anchor as { selector?: string; offset?: Record<string, { ref: string; d: number }> };
        expect(a.selector).toBeTruthy();
        // A class chain would be rewritten by any restyle of the very spacing
        // being reported, so selectors must never be built from class names.
        expect(a.selector!.startsWith('.')).toBe(false);
        expect(['start', 'end', 'pct']).toContain(a.offset!.x.ref);
        expect(['start', 'end', 'pct']).toContain(a.offset!.y.ref);
        // page_key must never carry a query string.
        expect(metadata.page_key).toBe(PAGE_KEY);
    });

    test('discarding the composer removes the pending pin', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await mountWidget(page, { body: LAYOUT });

        const gap = (await page.locator('.dead-air').boundingBox())!;
        await dropPin(page, Math.round(gap.x + gap.width / 2), Math.round(gap.y + gap.height / 2));
        await closeComposer(page);

        await expect.poll(() => pendingTip(page)).toBeNull();
    });
});

/**
 * The dashboard reads the same anchor the widget writes. These are pure
 * functions, so they are checked directly rather than through the UI.
 */
test.describe('dashboard anchor description', () => {
    const withOffset = (x: AnchorAxis, y: AnchorAxis): FeedbackAnchor =>
        ({ selector: '#target', selectorKind: 'id', offset: { x, y } });

    test('describes a pin sitting inside its element', () => {
        expect(describeAnchorOffset(withOffset({ ref: 'pct', d: 0.5 }, { ref: 'pct', d: 0.5 }))).toBe('inside');
    });

    test('describes a pin offset from an edge, per axis', () => {
        expect(describeAnchorOffset(withOffset({ ref: 'end', d: 40 }, { ref: 'pct', d: 0.5 }))).toBe('40px right');
        expect(describeAnchorOffset(withOffset({ ref: 'start', d: -30 }, { ref: 'pct', d: 0.5 }))).toBe('30px left');
        expect(describeAnchorOffset(withOffset({ ref: 'end', d: 40 }, { ref: 'end', d: 12 }))).toBe('40px right, 12px below');
        expect(describeAnchorOffset(withOffset({ ref: 'pct', d: 0.5 }, { ref: 'start', d: -8 }))).toBe('8px above');
    });

    test('returns nothing to describe for an unpinned report', () => {
        expect(describeAnchorOffset(undefined)).toBeNull();
        expect(describeAnchorConfidence(undefined)).toBeNull();
        expect(describeAnchorConfidence({ selectorKind: 'id' })).toBeNull();
    });

    test('only an ambiguous selector is flagged as a warning', () => {
        // Most elements on a real site carry no id, so a derived path is the
        // common case. Flagging it would make almost every pin look broken.
        expect(describeAnchorConfidence({ selector: '#a', selectorKind: 'id' })!.tone).toBe('ok');
        expect(describeAnchorConfidence({ selector: '[data-testid=a]', selectorKind: 'attr' })!.tone).toBe('ok');
        expect(describeAnchorConfidence({ selector: 'body > div', selectorKind: 'structural' })!.tone).toBe('ok');
        expect(describeAnchorConfidence({ selector: 'div > p', selectorKind: 'ambiguous' })!.tone).toBe('warn');
    });
});
