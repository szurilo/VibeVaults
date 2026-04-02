'use client';

import Link from "next/link"
import { cn } from "@/lib/utils"
import { MessageSquare, Paperclip } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getStatusStyles } from "@/lib/feedback-utils"
import { motion } from "framer-motion"

interface FeedbackListCardProps {
    feedback: {
        id: string
        content: string
        created_at: string
        sender: string
        status?: string
    }
    replyCount: number
    attachmentCount: number
    senderAvatarUrl?: string
}

export function FeedbackListCard({ feedback, replyCount, attachmentCount, senderAvatarUrl }: FeedbackListCardProps) {
    const status = feedback.status || 'open'
    const snippet = feedback.content.length > 120
        ? feedback.content.slice(0, 120) + '...'
        : feedback.content

    return (
        <Link href={`/dashboard/feedback/${feedback.id}`}>
            <motion.div
                whileHover={{ scale: 1.01, y: -2 }}
                transition={{ duration: 0.15 }}
            >
                <Card className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-gray-200/60 bg-white/50 backdrop-blur-sm">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                    {senderAvatarUrl ? (
                                        <img
                                            src={senderAvatarUrl}
                                            alt=""
                                            className="w-8 h-8 rounded-full object-cover shadow-sm"
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[11px] font-bold text-white uppercase shadow-sm">
                                            {feedback.sender.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <span className="text-sm font-semibold text-gray-900 truncate">
                                    {feedback.sender}
                                </span>
                            </div>
                            <span className={cn(
                                "text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest border shadow-sm transition-colors shrink-0",
                                getStatusStyles(status)
                            )}>
                                {status}
                            </span>
                        </div>

                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-4">
                            {snippet}
                        </p>

                        <div className="flex items-center justify-between text-xs text-gray-400">
                            <div className="flex items-center gap-4">
                                {replyCount > 0 && (
                                    <span className="flex items-center gap-1.5 font-medium">
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        {replyCount}
                                    </span>
                                )}
                                {attachmentCount > 0 && (
                                    <span className="flex items-center gap-1.5 font-medium">
                                        <Paperclip className="w-3.5 h-3.5" />
                                        {attachmentCount}
                                    </span>
                                )}
                            </div>
                            <span className="font-medium" suppressHydrationWarning>
                                {new Date(feedback.created_at).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </Link>
    )
}
