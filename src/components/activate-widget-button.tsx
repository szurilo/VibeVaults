/**
 * Main Responsibility: The "Activate widget" control, shared by the embed card
 * in project settings and the post-create embed dialog. Mints a per-device
 * widget identity for the signed-in user and opens the project's site with the
 * token planted, so the widget renders for them there.
 *
 * Sensitive Dependencies:
 * - `window.open` MUST be called synchronously inside the click handler, before
 *   any await, or the pop-up blocker eats the tab. That is also why the button
 *   is disabled until mounted: a click landing before hydration would silently
 *   do nothing (see CLAUDE.md, click-before-hydration).
 * - issueSelfWidgetLink server action (per-device, multi-device by design).
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'
import { issueSelfWidgetLink } from '@/actions/widget-access'

export function ActivateWidgetButton({
    projectId,
    disabled,
    variant = 'outline',
    className,
}: {
    projectId: string
    disabled?: boolean
    variant?: 'default' | 'outline'
    className?: string
}) {
    const [working, setWorking] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hydrated, setHydrated] = useState(false)
    useEffect(() => { setHydrated(true) }, [])

    const activate = async () => {
        setError(null)
        setWorking(true)

        // Synchronously, before any await — see the note above.
        const tab = window.open('about:blank', '_blank')

        try {
            const result = await issueSelfWidgetLink(projectId)
            if (!result.ok) {
                tab?.close()
                if (result.reason === 'no_website_url') {
                    setError('Add a website URL to this project first.')
                } else if (result.reason === 'no_access') {
                    setError('You no longer have access to this project.')
                } else {
                    setError('Could not generate a widget link. Please try again.')
                }
                return
            }
            if (tab) {
                tab.location.href = result.url
            } else {
                // Pop-up blocker — fall back to current-tab navigation.
                window.location.href = result.url
            }
        } catch {
            tab?.close()
            setError('Network error. Please try again.')
        } finally {
            setWorking(false)
        }
    }

    return (
        <div>
            <Button
                type="button"
                variant={variant}
                onClick={activate}
                disabled={!hydrated || working || disabled}
                className={className}
            >
                {working ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Activate widget
            </Button>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
    )
}
