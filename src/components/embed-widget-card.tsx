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
import { Check, Copy, Code } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ActivateWidgetButton } from '@/components/activate-widget-button'

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!
    const scriptTag = `<script src="${baseUrl}/widget.js" data-key="${project.api_key}" async></script>`

    const copyToClipboard = () => {
        navigator.clipboard.writeText(scriptTag)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
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
                    <p className="text-sm font-medium text-blue-900 mb-1">Activate widget</p>
                    <p className="text-xs text-blue-700/80 mb-3">
                        Use this whenever the widget doesn&apos;t appear on <strong>{project.website_url || 'your site'}</strong> — typically the first time you visit on each new device or browser, or after you&apos;ve cleared your browser data. Each click activates the widget for your account on the current device.
                    </p>
                    <ActivateWidgetButton projectId={project.id} disabled={!project.website_url} />
                    {!project.website_url && (
                        <p className="text-xs text-amber-700 mt-2">
                            Add a website URL above to enable this.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
