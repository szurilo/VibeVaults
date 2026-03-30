'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Main Responsibility: Wraps content with an ID and applies pulsating highlight
 * animation + dark backdrop overlay when navigated to via URL hash.
 * The target element is visually lifted above the overlay using a fixed-position
 * clone so it is never trapped by parent stacking contexts.
 *
 * Sensitive Dependencies:
 * - globals.css for .pulse-active, .highlight-persist, and related keyframes.
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
    const [active, setActive] = useState(false);

    useEffect(() => {
        const check = () => {
            if (window.location.hash !== `#${id}` || !ref.current) return;

            const target = ref.current;

            // Scroll into view first, then activate after scroll settles
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => setActive(true), 500);
        };

        // Check on mount
        check();

        // Re-check when hash changes (e.g. notification click while already on /feedback)
        window.addEventListener('hashchange', check);
        return () => window.removeEventListener('hashchange', check);
    }, [id]);

    // Create overlay + floating clone of the target element above it
    useEffect(() => {
        if (!active || !ref.current) return;

        const target = ref.current;

        // Create full-screen overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.backdropFilter = 'blur(2px)';
        overlay.style.zIndex = '9998';
        overlay.style.cursor = 'pointer';
        document.body.appendChild(overlay);

        // Create a fixed-position clone of the target that sits above the overlay
        const clone = target.cloneNode(true) as HTMLElement;
        const rect = target.getBoundingClientRect();
        clone.style.position = 'fixed';
        clone.style.top = `${rect.top}px`;
        clone.style.left = `${rect.left}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.zIndex = '9999';
        clone.style.pointerEvents = 'none';
        clone.style.margin = '0';
        clone.classList.add('pulse-active', 'highlight-persist');
        document.body.appendChild(clone);

        // Hide the original so there's no visual duplication
        const prevVisibility = target.style.visibility;
        target.style.visibility = 'hidden';

        // Clicking the overlay (anywhere outside the clone) dismisses
        const dismiss = () => setActive(false);
        overlay.addEventListener('click', dismiss);

        return () => {
            overlay.removeEventListener('click', dismiss);
            overlay.remove();
            clone.remove();
            target.style.visibility = prevVisibility;
        };
    }, [active]);

    return (
        <div
            ref={ref}
            id={id}
            className={className}
        >
            {children}
        </div>
    );
}
