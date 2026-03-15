'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Wraps content with an ID. On mount (or hash change), checks if the
 * URL hash matches this element's ID and applies a pulsating animation + scroll into view.
 * Works with Next.js client-side navigation where CSS :target doesn't fire.
 */
export function Highlight({
    id,
    className,
    children,
}: {
    id: string;
    className?: string;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);

    const deactivate = useCallback(() => {
        ref.current?.classList.remove('pulse-active', 'highlight-persist');
    }, []);

    const activate = useCallback(() => {
        if (window.location.hash === `#${id}` && ref.current) {
            ref.current.classList.remove('pulse-active', 'highlight-persist');
            // Force reflow so re-adding the class restarts the animation
            void ref.current.offsetWidth;
            ref.current.classList.add('pulse-active', 'highlight-persist');
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [id]);

    useEffect(() => {
        activate();

        const onHashChange = () => activate();
        window.addEventListener('hashchange', onHashChange);

        // Remove highlight when the user clicks outside this element
        const onClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                deactivate();
            }
        };
        document.addEventListener('click', onClickOutside);

        return () => {
            window.removeEventListener('hashchange', onHashChange);
            document.removeEventListener('click', onClickOutside);
        };
    }, [activate, deactivate]);

    return (
        <div ref={ref} id={id} className={className}>
            {children}
        </div>
    );
}
