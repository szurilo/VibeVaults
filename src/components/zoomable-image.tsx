"use client";

import React from "react";
import { createPortal } from "react-dom";

/**
 * Main Responsibility: Wraps arbitrary image content in a click-to-enlarge
 * trigger that opens a full-screen lightbox overlay (portal to document.body,
 * Escape / click to close). Shared by the landing feature grid and the
 * /compare pages so the zoom behaviour is implemented once.
 *
 * Usage: pass the inline image (e.g. a next/image) as children, `className`
 * styles the trigger button, and `src` is the full-resolution image shown in
 * the overlay.
 */
export function ZoomableImage({
    src,
    alt,
    className,
    children,
}: {
    src: string;
    alt: string;
    className?: string;
    children: React.ReactNode;
}) {
    const [isFullscreen, setIsFullscreen] = React.useState(false);

    React.useEffect(() => {
        if (!isFullscreen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsFullscreen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isFullscreen]);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                aria-label={`Enlarge: ${alt}`}
                className={className}
            >
                {children}
            </button>

            {isFullscreen &&
                createPortal(
                    <div
                        className="fixed inset-0 z-99999 bg-black/90 flex items-center justify-center cursor-zoom-out animate-in fade-in duration-200"
                        onClick={() => setIsFullscreen(false)}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={src}
                            alt={alt}
                            className="max-w-[95vw] max-h-[95vh] object-contain drop-shadow-2xl"
                        />
                    </div>,
                    document.body
                )}
        </>
    );
}
