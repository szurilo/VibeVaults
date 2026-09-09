/**
 * Main Responsibility: Keeps the sidebar's lock state honest on soft
 * navigations. The dashboard layout resolves which workspaces are locked, but
 * /dashboard/subscribe and /dashboard/workspace-paused share that layout, and
 * the App Router caches layout segments on the client. So when the proxy
 * redirects a soft navigation (a sidebar click by an owner whose trial just
 * lapsed), Next.js swaps only the PAGE segment and reuses the cached,
 * pre-expiry sidebar — every click bounces back to the paywall while the nav
 * still looks fully enabled. Only a manual refresh fixed it.
 *
 * The page segment is always freshly rendered, so it knows the truth. This
 * component compares the page's verdict against what the layout handed down and
 * calls router.refresh() only when they disagree, re-rendering the layout (and
 * with it the sidebar).
 *
 * Sensitive Dependencies:
 * - Must be rendered by every route excluded from the proxy's paywall check
 *   that a locked-out user can land on, with `locked` reflecting that route's
 *   own server-side verdict.
 * - `locked` must NOT be hardcoded true on /dashboard/subscribe: a healthy
 *   owner reaches that page voluntarily via the footer's Upgrade link, and
 *   dimming their nav would strand them on the pricing page.
 * - Deliberately refresh-on-mismatch rather than refresh-on-mount: an
 *   unconditional refresh would add a wasted server round trip to every hard
 *   load, where the layout is already correct.
 */
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardLock } from '@/components/dashboard-lock-context';

export function PaywallLockSync({ locked }: { locked: boolean }) {
    const router = useRouter();
    const { activeWorkspaceLocked } = useDashboardLock();

    // One refresh per mismatch, so a refresh that somehow doesn't settle the
    // disagreement can't turn into a loop.
    const refreshedFor = useRef<boolean | null>(null);

    useEffect(() => {
        if (activeWorkspaceLocked === locked) return;
        if (refreshedFor.current === locked) return;
        refreshedFor.current = locked;
        router.refresh();
    }, [activeWorkspaceLocked, locked, router]);

    return null;
}
