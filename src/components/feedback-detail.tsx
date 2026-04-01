/**
 * Main Responsibility: Full interactive feedback detail view — status updates, deletion,
 * metadata visualization, real-time reply threads, and file attachments.
 *
 * Sensitive Dependencies:
 * - Supabase Client (@/lib/supabase/client) for real-time subscriptions and CRUD operations.
 * - Server Actions (@/actions/feedback) for sending agency replies.
 * - Next.js Router for navigation after delete.
 */
'use client';

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FeedbackStatusSelect } from "./feedback-status-select"
import { cn } from "@/lib/utils"
import { Trash2, Globe, Monitor, Terminal, ChevronRight, Activity, Cpu, MousePointer2, Paperclip, FileText, Image as ImageIcon, AlertCircle, Maximize2 } from "lucide-react"
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
import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Send } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { sendAgencyReplyAction, deleteFeedback } from "@/actions/feedback"
import { toast } from "sonner"
import { FilePreviewImg } from "./file-preview-img"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { type FeedbackData, getStatusStyles, parseUA, isImageFile } from "@/lib/feedback-utils"

interface Attachment {
    id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    mime_type: string;
    uploaded_by?: string | null;
}

interface Reply {
    id: string;
    content: string;
    author_role: string;
    author_name?: string | null;
    created_at: string;
    attachments?: Attachment[];
}

interface FeedbackDetailProps {
    feedback: FeedbackData
    mode: 'view' | 'edit'
}

export function FeedbackDetail({ feedback, mode }: FeedbackDetailProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [replies, setReplies] = useState<Reply[]>([])
    const [isFetchingReplies, setIsFetchingReplies] = useState(false)
    const [newReply, setNewReply] = useState("")
    const [isSendingReply, setIsSendingReply] = useState(false)
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [replyFiles, setReplyFiles] = useState<File[]>([])
    const [replyFileError, setReplyFileError] = useState("")
    const [isUploadingReplyFiles, setIsUploadingReplyFiles] = useState(false)
    const MAX_FILES = 10
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
    const repliesContainerRef = useRef<HTMLDivElement>(null)

    const status = feedback.status || 'open'
    const supabase = createClient()
    const router = useRouter()

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            const el = repliesContainerRef.current
            if (el) el.scrollTop = el.scrollHeight
        })
    }, [])

    const replyCountRef = useRef(0)
    const fetchReplies = useCallback(async () => {
        setIsFetchingReplies(true)
        try {
            const { data, error } = await supabase
                .from('feedback_replies')
                .select('*, feedback_attachments(id, file_name, file_url, file_size, mime_type)')
                .eq('feedback_id', feedback.id)
                .order('created_at', { ascending: true })

            if (error) throw error
            const repliesWithAttachments = (data || []).map(r => ({
                ...r,
                attachments: r.feedback_attachments || [],
                feedback_attachments: undefined,
            }))
            const newCount = repliesWithAttachments.length
            const hadNewReply = newCount > replyCountRef.current
            replyCountRef.current = newCount
            setReplies(repliesWithAttachments)
            if (hadNewReply) scrollToBottom()
        } catch (err) {
            console.error("Error fetching replies:", err)
        } finally {
            setIsFetchingReplies(false)
        }
    }, [feedback.id, supabase, scrollToBottom])

    const fetchAttachments = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('feedback_attachments')
                .select('*')
                .eq('feedback_id', feedback.id)
                .is('reply_id', null)
                .order('created_at', { ascending: true })

            if (error) throw error
            setAttachments(data || [])
        } catch (err) {
            console.error("Error fetching attachments:", err)
        }
    }, [feedback.id, supabase])

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserEmail(data.user?.email ?? null)
        })
    }, [supabase])

    useEffect(() => {
        fetchReplies()
        fetchAttachments()

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
                () => {
                    fetchReplies()
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'feedback_attachments',
                    filter: `feedback_id=eq.${feedback.id}`,
                },
                () => {
                    fetchReplies()
                    fetchAttachments()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feedback.id])

    const handleSendReply = async () => {
        if (!newReply.trim() && replyFiles.length === 0) return
        setIsSendingReply(true)
        try {
            const replyResult = await sendAgencyReplyAction(feedback.id, newReply.trim())

            if (replyResult?.error) {
                toast("Error", { description: replyResult.error, icon: <AlertCircle className="h-4 w-4 text-red-500" /> })
                return
            }

            if (replyFiles.length > 0) {
                setIsUploadingReplyFiles(true)

                // Step 1: Get presigned upload URLs
                const fileMeta = replyFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
                const urlRes = await fetch('/api/dashboard/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feedbackId: feedback.id, files: fileMeta }),
                })
                if (!urlRes.ok) {
                    const err = await urlRes.json().catch(() => ({}))
                    toast("Upload Error", { description: err.error || "Failed to upload files.", icon: <AlertCircle className="h-4 w-4 text-red-500" /> })
                } else {
                    const { projectId, feedbackId: fbId, uploads } = await urlRes.json()

                    // Step 2: Upload each file directly to Supabase Storage
                    const completedFiles = []
                    for (let i = 0; i < uploads.length; i++) {
                        const upload = uploads[i]
                        await fetch(upload.signedUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': upload.mimeType },
                            body: replyFiles[i],
                        })
                        completedFiles.push({
                            fileId: upload.fileId,
                            path: upload.path,
                            fileName: upload.fileName,
                            size: replyFiles[i].size,
                            mimeType: upload.mimeType,
                        })
                    }

                    // Step 3: Confirm uploads
                    await fetch('/api/dashboard/upload/confirm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectId, feedbackId: fbId, replyId: replyResult?.replyId || null, files: completedFiles }),
                    })
                }
                setReplyFiles([])
                setIsUploadingReplyFiles(false)
            }

            setNewReply("")
            fetchReplies()
            fetchAttachments()
        } catch (err) {
            toast("Error", { description: "Failed to send reply.", icon: <AlertCircle className="h-4 w-4 text-red-500" /> })
            setIsUploadingReplyFiles(false)
        } finally {
            setIsSendingReply(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const result = await deleteFeedback(feedback.id)
            if (result?.error) {
                toast("Error", { description: result.error, icon: <AlertCircle className="h-4 w-4 text-red-500" /> })
                setIsDeleting(false)
            } else {
                router.push('/dashboard/feedback')
            }
        } catch (error) {
            toast("Error", { description: "Failed to delete feedback.", icon: <AlertCircle className="h-4 w-4 text-red-500" /> })
            setIsDeleting(false)
        }
    }

    const { browser, os } = parseUA(feedback.metadata?.userAgent)

    return (<>
        <Card className="hover:shadow-lg transition-all duration-300 border-gray-200/60 overflow-hidden flex flex-col bg-white/50 backdrop-blur-sm @container">
            <CardHeader className="pt-5 px-5 space-y-4">
                <div className="flex flex-wrap justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[11px] font-bold text-white uppercase shadow-sm">
                                {feedback.sender.charAt(0)}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex flex-col justify-center gap-0.5">
                            <span className="text-sm font-semibold text-gray-900 break-all">
                                {feedback.sender}
                            </span>
                            <span className="text-gray-400 font-normal text-xs break-all" suppressHydrationWarning>
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
                <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-medium break-all">
                        {feedback.content}
                    </p>
                    {attachments.length > 0 && (
                        <div className="mt-4 pb-2 flex flex-wrap gap-3">
                            {attachments.map((att) => (
                                isImageFile(att.mime_type) ? (
                                    <Sheet key={att.id}>
                                        <SheetTrigger asChild>
                                            <div className="relative rounded-lg overflow-hidden border border-gray-200 cursor-pointer group w-[120px] h-[80px] shadow-sm">
                                                <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                    <div className="bg-white/95 shadow-md text-gray-800 text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                        View
                                                    </div>
                                                </div>
                                            </div>
                                        </SheetTrigger>
                                        <SheetContent className="w-full sm:max-w-5xl h-full flex flex-col p-0">
                                            <div className="px-8 pt-8 flex-none">
                                                <SheetHeader>
                                                    <SheetTitle className="flex items-center gap-2 text-xl">
                                                        <ImageIcon className="w-5 h-5 text-blue-600" />
                                                        {att.file_name}
                                                    </SheetTitle>
                                                    <SheetDescription>
                                                        Uploaded by {att.uploaded_by}
                                                    </SheetDescription>
                                                </SheetHeader>
                                            </div>
                                            <div className="flex-1 min-h-0 flex flex-col px-8 pb-8 mt-6">
                                                <div className="bg-slate-950 rounded-xl flex-1 flex flex-col overflow-hidden ring-1 ring-white/10 shadow-2xl items-center justify-center p-2 sm:p-6 relative">
                                                    <button onClick={() => setFullscreenImage(att.file_url)} className="absolute top-3 right-3 z-10 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg p-2 transition-all cursor-pointer" title="View full size">
                                                        <Maximize2 className="w-4 h-4" />
                                                    </button>
                                                    <img src={att.file_url} alt={att.file_name} className="max-w-full max-h-full object-contain rounded-lg border border-white/10 drop-shadow-2xl cursor-pointer" onClick={() => setFullscreenImage(att.file_url)} />
                                                </div>
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                ) : (
                                    <a
                                        key={att.id}
                                        href={att.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm text-gray-700 shadow-sm"
                                    >
                                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                                        <span className="truncate max-w-[140px]">{att.file_name}</span>
                                    </a>
                                )
                            ))}
                        </div>
                    )}

                </div>

                {mode === 'edit' && feedback.metadata && !feedback.metadata.is_manual && (
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

                            {feedback.metadata.dom_selector && (
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                        <MousePointer2 className="w-3.5 h-3.5 text-gray-400" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Target Element</span>
                                        <span className="text-[11px] text-gray-600 font-medium truncate" title={feedback.metadata.dom_selector}>
                                            {feedback.metadata.dom_selector}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {feedback.metadata.logs && feedback.metadata.logs.length > 0 && (
                                <Sheet>
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
                                    <SheetContent className="w-full sm:max-w-2xl h-full flex flex-col p-0">
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
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-4">
                                {replies.length === 0 && !isFetchingReplies ? null : (
                                    <div ref={repliesContainerRef} className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        {replies.map((reply) => (
                                            <div
                                                key={reply.id}
                                                className={cn(
                                                    "flex flex-col gap-1.5 max-w-[90%]",
                                                    reply.author_name === currentUserEmail ? "ml-auto items-end" : "mr-auto items-start"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 px-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                                        {reply.author_name || 'Unknown'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-300">•</span>
                                                    <span className="text-[10px] text-gray-400" suppressHydrationWarning>
                                                        {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                {reply.content && (
                                                    <div
                                                        className={cn(
                                                            "px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-xs",
                                                            reply.author_name === currentUserEmail
                                                                ? "bg-[#209CEE] text-white rounded-tr-none"
                                                                : "bg-gray-100 text-gray-700 rounded-tl-none border border-gray-200/50"
                                                        )}
                                                    >
                                                        {reply.content}
                                                    </div>
                                                )}
                                                {reply.attachments && reply.attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {reply.attachments.map((att) => (
                                                            isImageFile(att.mime_type) ? (
                                                                <Sheet key={att.id}>
                                                                    <SheetTrigger asChild>
                                                                        <div className="relative rounded-lg overflow-hidden border border-gray-200 cursor-pointer group w-[120px] h-[80px] shadow-sm">
                                                                            <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" />
                                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                                                <div className="bg-white/95 shadow-md text-gray-800 text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                                                    View
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </SheetTrigger>
                                                                    <SheetContent className="w-full sm:max-w-5xl h-full flex flex-col p-0">
                                                                        <div className="px-8 pt-8 flex-none">
                                                                            <SheetHeader>
                                                                                <SheetTitle className="flex items-center gap-2 text-xl">
                                                                                    <ImageIcon className="w-5 h-5 text-blue-600" />
                                                                                    {att.file_name}
                                                                                </SheetTitle>
                                                                                <SheetDescription>
                                                                                    Uploaded by {att.uploaded_by || reply.author_name || 'Unknown'}
                                                                                </SheetDescription>
                                                                            </SheetHeader>
                                                                        </div>
                                                                        <div className="flex-1 min-h-0 flex flex-col px-8 pb-8 mt-6">
                                                                            <div className="bg-slate-950 rounded-xl flex-1 flex flex-col overflow-hidden ring-1 ring-white/10 shadow-2xl items-center justify-center p-2 sm:p-6 relative">
                                                                                <button onClick={() => setFullscreenImage(att.file_url)} className="absolute top-3 right-3 z-10 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg p-2 transition-all cursor-pointer" title="View full size">
                                                                                    <Maximize2 className="w-4 h-4" />
                                                                                </button>
                                                                                <img src={att.file_url} alt={att.file_name} className="max-w-full max-h-full object-contain rounded-lg border border-white/10 drop-shadow-2xl cursor-pointer" onClick={() => setFullscreenImage(att.file_url)} />
                                                                            </div>
                                                                        </div>
                                                                    </SheetContent>
                                                                </Sheet>
                                                            ) : (
                                                                <a
                                                                    key={att.id}
                                                                    href={att.file_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm text-gray-700 shadow-sm"
                                                                >
                                                                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                                                                    <span className="truncate max-w-[140px]">{att.file_name}</span>
                                                                </a>
                                                            )
                                                        ))}
                                                    </div>
                                                )}
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
                                {replyFileError && (
                                    <p className="text-red-500 text-xs mb-2 font-medium">{replyFileError}</p>
                                )}
                                {replyFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {replyFiles.map((file, idx) => (
                                            <div key={idx} className="relative w-12 h-12 rounded-md border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center group">
                                                {file.type.startsWith('image/') ? (
                                                    <FilePreviewImg file={file} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[9px] font-semibold text-gray-500 text-center px-0.5 break-all leading-tight">
                                                        {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                                                    </span>
                                                )}
                                                <button
                                                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 text-white flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                    onClick={() => setReplyFiles(prev => prev.filter((_, i) => i !== idx))}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Textarea
                                    placeholder="Type your reply..."
                                    className="min-h-[80px] pr-20 pt-3 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors resize-none rounded-xl text-[13px]"
                                    value={newReply}
                                    onChange={(e) => setNewReply(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSendReply()
                                        }
                                    }}
                                />
                                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                                    <label className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                        <Paperclip className="w-4 h-4" />
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    const newFiles = Array.from(e.target.files)
                                                    const combined = [...replyFiles, ...newFiles]
                                                    if (combined.length > MAX_FILES) {
                                                        setReplyFileError(`Maximum ${MAX_FILES} files allowed.`)
                                                    } else {
                                                        const oversized = newFiles.find(f => f.size > MAX_FILE_SIZE)
                                                        if (oversized) {
                                                            setReplyFileError(`File "${oversized.name}" exceeds the 10MB limit.`)
                                                        } else {
                                                            setReplyFiles(combined)
                                                            setReplyFileError("")
                                                        }
                                                    }
                                                    e.target.value = ''
                                                }
                                            }}
                                        />
                                    </label>
                                    <Button
                                        size="icon"
                                        className="h-8 w-8 rounded-lg shadow-md transition-all hover:scale-105"
                                        disabled={(!newReply.trim() && replyFiles.length === 0) || isSendingReply}
                                        onClick={handleSendReply}
                                    >
                                        {isSendingReply || isUploadingReplyFiles ? (
                                            <Activity className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4 ml-0.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


            </CardContent>
        </Card>

        {fullscreenImage && createPortal(
            <div
                className="fixed inset-0 z-99999 bg-black/90 flex items-center justify-center cursor-pointer animate-in fade-in duration-200"
                style={{ pointerEvents: 'auto' }}
                onClick={() => setFullscreenImage(null)}
            >
                <img
                    src={fullscreenImage}
                    alt="Full size preview"
                    className="max-w-[95vw] max-h-[95vh] object-contain drop-shadow-2xl"
                />
            </div>,
            document.body
        )}
    </>
    )
}
