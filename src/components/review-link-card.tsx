/**
 * Main Responsibility: Surfaces the project's permanent shareable review link
 * (the hosted `/review/<review_token>` page) with copy/open actions and the
 * pause toggle. The whole card is withheld by the project-settings page until
 * the widget has been seen loading on the site (`widget_last_seen_at`), so a
 * link that would land guests on the "not set up yet" page is never shown.
 * The link is never rotated or disabled, only paused.
 *
 * Sensitive Dependencies:
 * - setReviewFeedbackPaused server action (user-scoped, RLS-enforced).
 * - projects.review_token / review_feedback_paused / widget_last_seen_at from
 *   the server component's user-scoped `select('*')` on the project-settings
 *   page (widget_last_seen_at is stamped by the widget heartbeat).
 */
'use client'

import { useEffect, useState } from 'react'
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
import { AlertCircle, Check, Copy, ExternalLink, MessageSquarePlus, PauseCircle } from 'lucide-react'
import { toast } from 'sonner'
import { setReviewFeedbackPaused } from '@/actions/review-link'
import { hostedReviewUrl } from '@/lib/review-url'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Project {
    id: string;
    name: string;
    website_url?: string | null;
    review_token?: string | null;
    review_feedback_paused?: boolean;
    widget_last_seen_at?: string | null;
}

export function ReviewLinkCard({ project }: { project: Project }) {
    const [paused, setPaused] = useState(project.review_feedback_paused || false)
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        setPaused(project.review_feedback_paused || false)
    }, [project.review_feedback_paused])

    const [origin, setOrigin] = useState('')
    useEffect(() => {
        setOrigin(window.location.origin)
    }, [])

    // Hosted link on OUR domain: the guest identifies there, then gets
    // redirected onto the site with a planted token — so the link keeps
    // working (or fails with a helpful page) whatever state the embed is in.
    const reviewUrl = project.website_url && project.review_token && origin
        ? hostedReviewUrl(origin, project.review_token)
        : ''

    const handlePauseToggle = async (checked: boolean) => {
        setLoading(true)
        const previousState = paused
        setPaused(checked)
        try {
            const result = await setReviewFeedbackPaused(project.id, checked)
            if (result?.error) {
                toast("Error", { description: result.error, icon: <AlertCircle className="h-4 w-4 text-red-500" /> })
                setPaused(previousState)
            }
        } catch {
            toast("Error", { description: "Failed to update review feedback.", icon: <AlertCircle className="h-4 w-4 text-red-500" /> })
            setPaused(previousState)
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = () => {
        if (!reviewUrl) return
        navigator.clipboard.writeText(reviewUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card className="border-violet-100 bg-violet-50/30">
            <CardHeader>
                <div className="space-y-1">
                    <CardTitle className="text-violet-900 flex items-center gap-2">
                        <MessageSquarePlus className="w-5 h-5" />
                        Shareable Review Link
                    </CardTitle>
                    <CardDescription className="text-violet-700/80">
                        Anyone who opens this link can leave feedback on your site as a Guest after entering their name and email. No invite needed — share it in an email, a chat, or a ticket.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                {reviewUrl ? (
                    <>
                        <div className="flex gap-2">
                            <Input
                                value={reviewUrl}
                                readOnly
                                className="bg-white font-mono text-sm"
                            />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={copyToClipboard}
                                        className="shrink-0 bg-white hover:bg-violet-50 cursor-pointer"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{copied ? 'Copied!' : 'Copy review link'}</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        asChild
                                        className="shrink-0 bg-white hover:bg-violet-50 cursor-pointer"
                                    >
                                        <a href={reviewUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="w-4 h-4 text-gray-600" />
                                        </a>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Open review link</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="flex items-center justify-between mt-4 rounded-lg border border-violet-100 bg-white px-4 py-3">
                            <div className="flex items-start gap-2 pr-4">
                                <PauseCircle className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">Pause review feedback</p>
                                    <p className="text-xs text-gray-500">
                                        Reviewers keep seeing existing feedback, but new pins and replies are blocked until you resume. The link keeps working.
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={paused}
                                onCheckedChange={handlePauseToggle}
                                disabled={loading}
                                className="cursor-pointer"
                            />
                        </div>
                        {paused && (
                            <p className="text-xs text-amber-600 mt-3">
                                Review feedback is paused — visitors on the review link can browse but not submit.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-violet-700/80">
                        Set your project&apos;s website URL above to get your review link.
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
