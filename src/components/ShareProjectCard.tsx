'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Check, Copy, ExternalLink, Link as LinkIcon, Lock } from 'lucide-react'
import Link from 'next/link'
import { toggleProjectSharing } from '@/actions/project-sharing'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'


export function ShareProjectCard({ project }: { project: any }) {
    const [isEnabled, setIsEnabled] = useState(project.is_sharing_enabled || false)
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    const [origin, setOrigin] = useState('')

    useEffect(() => {
        setOrigin(window.location.origin)
    }, [])

    const shareUrl = project.share_token && origin ? `${origin}/share/${project.share_token}` : ''

    const handleToggle = async (checked: boolean) => {
        setLoading(true)
        // Optimistic update
        const previousState = isEnabled
        setIsEnabled(checked)

        try {
            await toggleProjectSharing(project.id, checked)
        } catch (error) {
            console.error(error)
            setIsEnabled(previousState)
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = () => {
        if (!shareUrl) return
        navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card className="border-blue-100 bg-blue-50/30">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-blue-900 flex items-center gap-2">
                            <LinkIcon className="w-5 h-5" />
                            Share Project
                        </CardTitle>
                        <CardDescription className="text-blue-700/80">
                            Allow anyone with the link to view this project's feedback.
                        </CardDescription>
                    </div>
                    <Switch
                        checked={isEnabled}
                        onCheckedChange={handleToggle}
                        disabled={loading}
                        className="cursor-pointer"
                    />
                </div>
            </CardHeader>
            {isEnabled && (
                <CardContent>
                    <div className="flex gap-2">
                        <Input
                            value={shareUrl}
                            readOnly
                            className="bg-white font-mono text-sm"
                        />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={copyToClipboard}
                                    className="shrink-0 bg-white hover:bg-blue-50 cursor-pointer"
                                >
                                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{copied ? 'Copied!' : 'Copy share link'}</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    asChild
                                    className="shrink-0 bg-white hover:bg-blue-50 cursor-pointer"
                                >
                                    <Link href={`/share/${project.share_token}`} target="_blank">
                                        <ExternalLink className="w-4 h-4 text-gray-600" />
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Open public link</p>
                            </TooltipContent>
                        </Tooltip>

                    </div>
                    <p className="text-xs text-blue-600/70 mt-3 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        This link is read-only. Visitors cannot delete or modify feedback.
                    </p>
                </CardContent>
            )}
        </Card>
    )
}
