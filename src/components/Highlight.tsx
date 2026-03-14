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

    const activate = useCallback(() => {
        if (window.location.hash === `#${id}` && ref.current) {
            ref.current.classList.remove('pulse-active');
            // Force reflow so re-adding the class restarts the animation
            void ref.current.offsetWidth;
            ref.current.classList.add('pulse-active');
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const timeout = setTimeout(() => {
                ref.current?.classList.remove('pulse-active');
            }, 4000);

            return () => clearTimeout(timeout);
        }
    }, [id]);

    useEffect(() => {
        const cleanup = activate();

        const onHashChange = () => activate();
        window.addEventListener('hashchange', onHashChange);

        return () => {
            cleanup?.();
            window.removeEventListener('hashchange', onHashChange);
        };
    }, [activate]);

    return (
        <div ref={ref} id={id} className={className}>
            {children}
        </div>
    );
}
