"use client"

/**
 * Main Responsibility: the "where on the page" tile for a pinned report or a
 * pinned reply — selector, offset from it, and a confidence read on hover.
 * Shared so the header tile and the reply-bubble tile can never disagree on
 * how an anchor is described.
 *
 * Sensitive Dependencies: `describeAnchorOffset` / `describeAnchorConfidence`
 * in `lib/feedback-utils.ts` are the single source for the phrasing; the
 * anchor shape itself is written by `resolveAnchor()` in `public/widget.js`.
 */

import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { type FeedbackAnchor, describeAnchorOffset, describeAnchorConfidence } from "@/lib/feedback-utils"

interface PinnedOnTileProps {
    anchor: FeedbackAnchor
    /** Tile caption, e.g. "Pinned On" or "Reply pin b". */
    label: string
    /** Shown after the selector when the pin was left on another page than the report. */
    pagePath?: string | null
    className?: string
}

export function PinnedOnTile({ anchor, label, pagePath, className }: PinnedOnTileProps) {
    const offset = describeAnchorOffset(anchor)
    const confidence = describeAnchorConfidence(anchor)
    // A pin dropped in empty space has no element to tie to, only document
    // coordinates. Saying so beats hiding the tile, which read as "not pinned".
    const free = !anchor.selector

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("flex items-center gap-2.5 min-w-0 cursor-help", className)}>
                        <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                            confidence?.tone === 'warn' ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-blue-500"
                        )}>
                            <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                {label}
                            </span>
                            <span className="text-[11px] text-gray-600 font-medium truncate">
                                {free ? 'Free position on the page' : anchor.selector}
                                {offset && offset !== 'inside' && (
                                    <span className="text-gray-400"> · {offset}</span>
                                )}
                                {pagePath && (
                                    <span className="text-gray-400"> · on {pagePath}</span>
                                )}
                            </span>
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    {free ? (
                        <p className="text-[11px]">
                            Not tied to an element, so it is placed from stored page coordinates and may drift if the layout changes. Trust the screenshot over the position.
                        </p>
                    ) : (
                        <p className="font-mono text-[11px] break-all">{anchor.selector}</p>
                    )}
                    {offset && (
                        <p className="mt-1 text-[11px]">
                            Pin sits {offset === 'inside' ? 'inside this element' : `${offset} of this element`}.
                        </p>
                    )}
                    {confidence && (
                        <p className="mt-1 text-[11px]">
                            <strong>{confidence.label}.</strong> {confidence.detail}
                        </p>
                    )}
                    {/* opacity, not a muted-foreground token: the tooltip surface is
                        dark, so the light-theme muted colour is nearly invisible on it. */}
                    {anchor.viewportW && (
                        <p className="mt-1 text-[11px] opacity-70">
                            Reported at {anchor.viewportW}px wide.
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
