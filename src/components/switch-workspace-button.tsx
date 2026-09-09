/**
 * Main Responsibility: In-page escape hatch from a paused workspace. Writes the
 * `selectedWorkspaceId` cookie and hard-navigates so the proxy re-evaluates the
 * paywall against the newly selected workspace.
 *
 * Sensitive Dependencies:
 * - Cookie names must match `dashboard/layout.tsx` and `workspace-switcher.tsx`
 *   (`selectedWorkspaceId` / `selectedProjectId`).
 * - A hard `window.location.assign` is deliberate, not laziness: a client-side
 *   router.push keeps the shared dashboard layout mounted, so the sidebar would
 *   hold its old props (stale workspace, stale lock state) until something
 *   forced a re-fetch. Same reasoning as `workspace-switcher.tsx`.
 */
'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SwitchWorkspaceButton({
    workspaceId,
    workspaceName,
}: {
    workspaceId: string;
    workspaceName: string;
}) {
    const [switching, setSwitching] = useState(false);

    const switchTo = () => {
        if (switching) return;
        setSwitching(true);
        document.cookie = `selectedWorkspaceId=${workspaceId}; path=/; max-age=31536000`;
        document.cookie = `selectedProjectId=; path=/; max-age=0`;
        window.location.assign('/dashboard');
    };

    return (
        <Button
            variant="outline"
            onClick={switchTo}
            disabled={switching}
            className="w-full justify-between gap-2 h-auto py-3 px-4 cursor-pointer bg-white hover:bg-gray-50"
        >
            <span className="truncate font-medium text-left">{workspaceName}</span>
            {switching
                ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                : <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
        </Button>
    );
}
