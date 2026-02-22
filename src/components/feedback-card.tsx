'use client';

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FeedbackStatusSelect } from "./feedback-status-select"
import { cn } from "@/lib/utils"
import { Calendar, Trash2, Globe, Monitor, Terminal, Info, ChevronRight, Activity, Cpu } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useCallback } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { MessageSquare, Send, User2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { sendAgencyReplyAction } from "@/actions/feedback"

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

interface FeedbackMetadata {
    url?: string
    userAgent?: string
    screen?: string
    viewport?: string
    language?: string
    logs?: Array<{ type: string; time: string; content: string }>
}

interface FeedbackCardProps {
    feedback: {
        id: string
        content: string
        created_at: string
        sender: string
        status?: string
        metadata?: FeedbackMetadata
    }
    mode: 'view' | 'edit'
}

export function FeedbackCard({ feedback, mode }: FeedbackCardProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [replies, setReplies] = useState<any[]>([])
    const [isFetchingReplies, setIsFetchingReplies] = useState(false)
    const [newReply, setNewReply] = useState("")
    const [isSendingReply, setIsSendingReply] = useState(false)
    const [showReplies, setShowReplies] = useState(false)

    const status = feedback.status || 'open'
    const supabase = createClient()
    const router = useRouter()

    const fetchReplies = useCallback(async () => {
        setIsFetchingReplies(true)
        try {
            const { data, error } = await supabase
                .from('feedback_replies')
                .select('*')
                .eq('feedback_id', feedback.id)
                .order('created_at', { ascending: true })

            if (error) throw error
            setReplies(data || [])
        } catch (err) {
            console.error("Error fetching replies:", err)
        } finally {
            setIsFetchingReplies(false)
        }
    }, [feedback.id, supabase])

    useEffect(() => {
        fetchReplies()

        // Subscribe to Realtime for new replies on this feedback
        const channel = supabase
            .channel(`replies-${feedback.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'feedback_replies',
                    filter: `feedback_id=eq.${feedback.id}`,
                },
                (payload) => {
                    const newReply = payload.new as any
                    setReplies((prev) => {
                        // Avoid duplicates
                        if (prev.some((r) => r.id === newReply.id)) return prev
                        return [...prev, newReply]
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feedback.id])

    const handleSendReply = async () => {
        if (!newReply.trim()) return
        setIsSendingReply(true)
        try {
            await sendAgencyReplyAction(feedback.id, newReply)
            setNewReply("")
            fetchReplies() // Refresh list
        } catch (err) {
            console.error("Error sending reply:", err)
            alert("Failed to send reply")
        } finally {
            setIsSendingReply(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from('feedbacks')
                .delete()
                .eq('id', feedback.id)

            if (error) throw error

            router.refresh()
        } catch (error) {
            console.error(error)
            alert("Failed to delete feedback")
            setIsDeleting(false)
        }
    }

    const getStatusStyles = (status: string) => {
        switch (status.toLowerCase()) {
            case 'in progress':
                return 'bg-blue-50 text-blue-700 border-blue-100'
            case 'in review':
                return 'bg-amber-50 text-amber-700 border-amber-100'
            case 'completed':
                return 'bg-emerald-50 text-emerald-700 border-emerald-100'
            case 'open':
            default:
                return 'bg-slate-50 text-slate-700 border-slate-100'
        }
    }

    const parseUA = (ua?: string) => {
        if (!ua) return { browser: 'Unknown', os: 'Unknown' }
        let browser = 'Unknown'
        let os = 'Unknown'

        if (ua.includes('Win')) os = 'Windows'
        else if (ua.includes('Mac')) os = 'macOS'
        else if (ua.includes('Linux')) os = 'Linux'
        else if (ua.includes('Android')) os = 'Android'
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

        if (ua.includes('Edg')) browser = 'Edge'
        else if (ua.includes('Chrome')) browser = 'Chrome'
        else if (ua.includes('Firefox')) browser = 'Firefox'
        else if (ua.includes('Safari')) browser = 'Safari'

        return { browser, os }
    }

    const { browser, os } = parseUA(feedback.metadata?.userAgent)

    return (
        <Card className="group hover:shadow-lg transition-all duration-300 border-gray-200/60 overflow-hidden flex flex-col bg-white/50 backdrop-blur-sm @container">
            <CardHeader className="pt-5 px-5 space-y-4">
                <div className="flex flex-wrap justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3 min-w-[200px] flex-1">
                        <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[11px] font-bold text-white uppercase shadow-sm">
                                {feedback.sender.charAt(0)}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex flex-col min-w-0 justify-center gap-0.5">
                            <span className="text-sm font-semibold text-gray-900 truncate" title={feedback.sender}>
                                {feedback.sender}
                            </span>
                            <span className="text-gray-400 font-normal text-xs truncate">
                                {new Date(feedback.created_at).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {mode === 'edit' ? (
                            <>
                                <FeedbackStatusSelect id={feedback.id} initialStatus={status} />
                                <TooltipProvider>
                                    <AlertDialog>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-400 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                                        disabled={isDeleting}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Delete feedback</p>
                                            </TooltipContent>
                                        </Tooltip>

                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Feedback?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This feedback will be permanently removed.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={handleDelete}
                                                    className="cursor-pointer"
                                                    variant="destructive"
                                                >
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TooltipProvider>
                            </>
                        ) : (
                            <span className={cn(
                                "text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest border shadow-sm transition-colors",
                                getStatusStyles(status)
                            )}>
                                {status}
                            </span>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-5 flex-1 flex flex-col">
                <div className="flex-1">
                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {feedback.content}
                    </p>
                </div>

                {mode === 'edit' && feedback.metadata && (
                    <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                    <Globe className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Source URL</span>
                                    <a
                                        href={feedback.metadata.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-blue-600 font-medium hover:underline"
                                        title={feedback.metadata.url}
                                    >
                                        {feedback.metadata.url ? new URL(feedback.metadata.url).hostname : 'N/A'}
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                    <Cpu className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">System</span>
                                    <span className="text-[11px] text-gray-600 font-medium">
                                        {browser} on {os}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                    <Monitor className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Display</span>
                                    <span className="text-[11px] text-gray-600 font-medium">
                                        {feedback.metadata.screen || 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {feedback.metadata.logs && feedback.metadata.logs.length > 0 && (
                                <Sheet onOpenChange={(open) => {
                                    const widget = document.getElementById('vibe-vaults-widget-host');
                                    if (widget) {
                                        widget.style.display = open ? 'none' : '';
                                    }
                                }}>
                                    <SheetTrigger asChild>
                                        <button className="flex items-center gap-2.5 min-w-0 group cursor-pointer text-left">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                                <Terminal className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Console Logs</span>
                                                <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                                                    View {feedback.metadata.logs.length} logs <ChevronRight className="w-3 h-3" />
                                                </span>
                                            </div>
                                        </button>
                                    </SheetTrigger>
                                    <SheetContent className="sm:max-w-2xl h-full flex flex-col p-0">
                                        <div className="px-8 pt-8 flex-none">
                                            <SheetHeader>
                                                <SheetTitle className="flex items-center gap-2 text-xl">
                                                    <Terminal className="w-5 h-5 text-blue-600" />
                                                    Console logs
                                                </SheetTitle>
                                                <SheetDescription>
                                                    Recorded during the feedback session on {feedback.metadata.url}
                                                </SheetDescription>
                                            </SheetHeader>
                                        </div>

                                        <div className="flex-1 min-h-0 flex flex-col px-8">
                                            <div className="bg-slate-950 rounded-xl p-6 font-mono text-[11px] flex-1 flex flex-col overflow-hidden ring-1 ring-white/10 shadow-2xl">
                                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                                    {feedback.metadata.logs.map((log, i) => (
                                                        <div key={i} className="flex gap-4 border-b border-white/5 py-3 px-3 -mx-2 hover:bg-white/[0.07] transition-all duration-200 group/log rounded-lg">
                                                            <span className="text-slate-500 shrink-0 font-medium tabular-nums text-[10px] pt-0.5">{log.time}</span>
                                                            <span className={cn(
                                                                "shrink-0 font-bold uppercase tracking-tighter text-[9px] px-1.5 py-0.5 rounded h-fit self-start",
                                                                log.type === 'error' ? "bg-red-500/20 text-red-400 border border-red-500/20" :
                                                                    log.type === 'warn' ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" :
                                                                        "bg-blue-500/20 text-blue-400 border border-blue-500/20"
                                                            )}>
                                                                {log.type}
                                                            </span>
                                                            <span className="text-slate-300 break-all whitespace-pre-wrap flex-1 leading-relaxed">
                                                                {log.content.replace(/%c/g, '')}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="px-8 pb-8 flex-none space-y-6">
                                            <Separator className="bg-gray-100" />
                                            <div className="grid grid-cols-2 gap-8 text-xs">
                                                <div className="space-y-2">
                                                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">User Agent</p>
                                                    <p className="text-gray-600 leading-relaxed font-medium break-all">{feedback.metadata.userAgent}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Viewport / Screen</p>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-gray-400">Viewport</span>
                                                            <span className="text-gray-700 font-bold">{feedback.metadata.viewport || 'N/A'}</span>
                                                        </div>
                                                        <Separator orientation="vertical" className="h-4" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-gray-400">Screen</span>
                                                            <span className="text-gray-700 font-bold">{feedback.metadata.screen}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            )}
                        </div>
                    </div>
                )}

                {mode === 'edit' && (
                    <div className="mt-6 pt-5 border-t border-gray-100">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 px-3 text-[11px] font-semibold flex items-center gap-2",
                                showReplies ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "text-gray-500"
                            )}
                            onClick={() => setShowReplies(!showReplies)}
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {replies.length > 0 ? `${replies.length} Replies` : 'Write Reply'}
                        </Button>

                        {showReplies && (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-4">
                                    {replies.length === 0 && !isFetchingReplies ? (
                                        <div className="text-center py-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">No conversation yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {replies.map((reply) => (
                                                <div
                                                    key={reply.id}
                                                    className={cn(
                                                        "flex flex-col gap-1.5 max-w-[90%]",
                                                        reply.author_role === 'agency' ? "ml-auto items-end" : "mr-auto items-start"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 px-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                                            {reply.author_role === 'agency' ? 'Support' : feedback.sender}
                                                        </span>
                                                        <span className="text-[10px] text-gray-300">•</span>
                                                        <span className="text-[10px] text-gray-400">
                                                            {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-xs",
                                                            reply.author_role === 'agency'
                                                                ? "bg-[#209CEE] text-white rounded-tr-none"
                                                                : "bg-gray-100 text-gray-700 rounded-tl-none border border-gray-200/50"
                                                        )}
                                                    >
                                                        {reply.content}
                                                    </div>
                                                </div>
                                            ))}
                                            {isFetchingReplies && (
                                                <div className="flex justify-center py-2">
                                                    <Activity className="w-4 h-4 text-gray-300 animate-spin" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="relative group">
                                    <Textarea
                                        placeholder="Type your reply..."
                                        className="min-h-[80px] pr-12 pt-3 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors resize-none rounded-xl text-[13px]"
                                        value={newReply}
                                        onChange={(e) => setNewReply(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendReply()
                                            }
                                        }}
                                    />
                                    <Button
                                        size="icon"
                                        className="absolute bottom-2.5 right-2.5 h-8 w-8 rounded-lg shadow-md transition-all hover:scale-105"
                                        disabled={!newReply.trim() || isSendingReply}
                                        onClick={handleSendReply}
                                    >
                                        {isSendingReply ? (
                                            <Activity className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4 ml-0.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}


            </CardContent>
        </Card>
    )
}
