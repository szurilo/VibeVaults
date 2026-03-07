'use client';

import { useEffect, useRef } from 'react';

/**
 * Wraps content with an anchor ID. On mount, checks if the URL hash matches
 * this element's ID and applies a glow animation + scroll into view.
 * Works with Next.js client-side navigation where CSS :target doesn't fire.
 */
export function AnchorHighlight({
    id,
    className,
    children,
}: {
    id: string;
    className?: string;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.location.hash === `#${id}` && ref.current) {
            ref.current.classList.add('anchor-glow-active');
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const timeout = setTimeout(() => {
                ref.current?.classList.remove('anchor-glow-active');
            }, 2500);

            return () => clearTimeout(timeout);
        }
    }, [id]);

    return (
        <div ref={ref} id={id} className={className}>
            {children}
        </div>
    );
}
