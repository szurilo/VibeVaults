'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Copy, Code } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'


export function GetStartedCard({ project }: { project: any }) {
    const [copied, setCopied] = useState(false)
    const scriptTag = `<script src="https://www.vibe-vaults.com/widget.js" data-key="${project.api_key}" async></script>`

    const copyToClipboard = () => {
        navigator.clipboard.writeText(scriptTag)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card className="mt-8 border-primary/10 bg-primary/5">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Code className="w-5 h-5 text-primary" />
                    Get Started
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-6">
                    Embed the widget on your site just before the closing &lt;/body&gt; tag to start collecting feedback for <strong>{project.name}</strong>.
                </p>
                <div className="flex gap-2">
                    <Input
                        value={scriptTag}
                        readOnly
                        className="bg-white font-mono text-sm border-primary/20"
                    />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={copyToClipboard}
                                className="shrink-0 bg-white hover:bg-primary/5 cursor-pointer border-primary/20"
                            >
                                {copied ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                    <Copy className="w-4 h-4 text-primary" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{copied ? 'Copied!' : 'Copy widget script'}</p>
                        </TooltipContent>
                    </Tooltip>

                </div>
            </CardContent>
        </Card>
    )
}
