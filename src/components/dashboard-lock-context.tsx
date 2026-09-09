/**
 * Main Responsibility: Exposes the dashboard layout's server-resolved lock state
 * to client components rendered inside it (notably the paywall pages, which need
 * to know whether the cached sidebar already agrees with them).
 *
 * Holds no state of its own — it only forwards server props — so there is no
 * second source of truth for "is this workspace locked". The sidebar keeps
 * reading the same server props directly.
 *
 * Sensitive Dependencies:
 * - Provided by `src/app/dashboard/layout.tsx`, whose value can be STALE on a
 *   soft navigation (the App Router caches layout segments). That staleness is
 *   the entire point: `PaywallLockSync` detects it by comparison.
 */
'use client';

import { createContext, useContext, useMemo } from 'react';

interface DashboardLockValue {
    /** Whether the workspace the layout rendered as active is locked. */
    activeWorkspaceLocked: boolean;
}

const DashboardLockContext = createContext<DashboardLockValue>({ activeWorkspaceLocked: false });

export function DashboardLockProvider({
    activeWorkspaceLocked,
    children,
}: {
    activeWorkspaceLocked: boolean;
    children: React.ReactNode;
}) {
    const value = useMemo(() => ({ activeWorkspaceLocked }), [activeWorkspaceLocked]);
    return <DashboardLockContext.Provider value={value}>{children}</DashboardLockContext.Provider>;
}

export function useDashboardLock(): DashboardLockValue {
    return useContext(DashboardLockContext);
}
