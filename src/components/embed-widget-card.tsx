'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Check, Copy, Code, ExternalLink, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { issueSelfWidgetLink } from '@/actions/widget-access'

type EmbedWidgetCardProps = {
    project: {
        id: string
        api_key: string
        name: string
        website_url?: string | null
    }
}

export function EmbedWidgetCard({ project }: EmbedWidgetCardProps) {
    const [copied, setCopied] = useState(false)
    const [openingWidget, setOpeningWidget] = useState(false)
    const [openError, setOpenError] = useState<string | null>(null)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!
    const scriptTag = `<script src="${baseUrl}/widget.js" data-key="${project.api_key}" async></script>`

    const copyToClipboard = () => {
        navigator.clipboard.writeText(scriptTag)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const openWidgetOnSite = async () => {
        setOpenError(null)
        setOpeningWidget(true)

        // Open a blank tab synchronously *first*, then navigate it after the
        // server action resolves. Browsers block window.open() invoked after an
        // await because it's no longer attached to the original click gesture.
        const tab = window.open('about:blank', '_blank')

        try {
            const result = await issueSelfWidgetLink(project.id)
            if (!result.ok) {
                tab?.close()
                if (result.reason === 'no_website_url') {
                    setOpenError('Add a website URL to this project first.')
                } else if (result.reason === 'no_access') {
                    setOpenError('You no longer have access to this project.')
                } else {
                    setOpenError('Could not generate a widget link. Please try again.')
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
            setOpenError('Network error. Please try again.')
        } finally {
            setOpeningWidget(false)
        }
    }

    return (
        <Card className="border-blue-100 bg-blue-50/30">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-blue-900 flex items-center gap-2">
                            <Code className="w-5 h-5" />
                            Embed widget
                        </CardTitle>
                        <CardDescription className="text-blue-700/80">
                            Embed the widget on your site just before the closing &lt;/body&gt; tag to start collecting feedback.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2">
                    <Input
                        value={scriptTag}
                        readOnly
                        className="bg-white font-mono text-sm border-blue-100"
                    />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={copyToClipboard}
                                className="shrink-0 bg-white hover:bg-blue-50 cursor-pointer border-blue-100"
                            >
                                {copied ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                    <Copy className="w-4 h-4 text-gray-600" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{copied ? 'Copied!' : 'Copy widget script'}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
                <p className="text-xs text-blue-600/70 mt-3">
                    This script is uniquely generated for <strong>{project.name}</strong>.
                </p>

                <div className="mt-5 pt-4 border-t border-blue-100/70">
                    <p className="text-sm font-medium text-blue-900 mb-1">Open the widget on your site</p>
                    <p className="text-xs text-blue-700/80 mb-3">
                        Once the widget is embedded, click below to open <strong>{project.website_url || 'your site'}</strong> with widget access activated for your account on this device.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={openWidgetOnSite}
                        disabled={openingWidget || !project.website_url}
                        className="bg-white hover:bg-blue-50 border-blue-100 cursor-pointer"
                    >
                        {openingWidget ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <ExternalLink className="w-4 h-4 mr-2" />
                        )}
                        Open widget on site
                    </Button>
                    {!project.website_url && (
                        <p className="text-xs text-amber-700 mt-2">
                            Add a website URL above to enable this.
                        </p>
                    )}
                    {openError && (
                        <p className="text-xs text-red-600 mt-2">{openError}</p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
