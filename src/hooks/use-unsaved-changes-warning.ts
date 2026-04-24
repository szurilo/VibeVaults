'use client';

import { useEffect } from 'react';

const MESSAGE = 'You have unsaved changes. Are you sure you want to leave?';

/**
 * Warns the user before they abandon unsaved form changes.
 * Covers tab close / reload / URL bar typing via `beforeunload`, and
 * Next.js App Router client-side navigation by intercepting anchor clicks
 * in the capture phase before `<Link>`'s handler runs.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
    useEffect(() => {
        if (!isDirty) return;

        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };

        const onClick = (e: MouseEvent) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (e.defaultPrevented) return;

            const anchor = (e.target as HTMLElement | null)?.closest('a');
            if (!anchor) return;
            if (anchor.target && anchor.target !== '_self') return;
            if (anchor.hasAttribute('download')) return;

            const href = anchor.getAttribute('href');
            if (!href) return;

            let url: URL;
            try {
                url = new URL(href, window.location.href);
            } catch {
                return;
            }
            if (url.origin !== window.location.origin) return;
            // Same-page hash link — not a navigation
            if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;

            if (!window.confirm(MESSAGE)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('click', onClick, true);

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('click', onClick, true);
        };
    }, [isDirty]);
}
