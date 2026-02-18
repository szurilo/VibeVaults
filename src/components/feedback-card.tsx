'use client';

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FeedbackStatusSelect } from "./feedback-status-select"
import { cn } from "@/lib/utils"
import { Calendar, Trash2 } from "lucide-react"
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
import { deleteFeedback } from "@/actions/feedback"
import { useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface FeedbackCardProps {
    feedback: {
        id: string
        content: string
        created_at: string
        sender?: string
        status?: string
    }
    mode: 'view' | 'edit'
}

export function FeedbackCard({ feedback, mode }: FeedbackCardProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const status = feedback.status || 'open'
    const supabase = createClient()
    const router = useRouter()

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

    return (
        <Card className="group hover:shadow-lg transition-all duration-300 border-gray-200/60 overflow-hidden flex flex-col h-full bg-white/50 backdrop-blur-sm">
            <CardHeader className="pb-3 pt-5 px-5 space-y-4">
                <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[11px] uppercase font-bold tracking-wider">
                            {new Date(feedback.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
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

            <CardContent className="px-5 pb-6 flex-1 flex flex-col">
                <div className="flex-1">
                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {feedback.content}
                    </p>
                </div>

                {feedback.sender && (
                    <div className="pt-5 mt-6 border-t border-gray-50 flex items-center gap-3">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[11px] font-bold text-white uppercase shadow-sm">
                                {feedback.sender.charAt(0)}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-gray-900 truncate" title={feedback.sender}>
                                {feedback.sender}
                            </span>
                            <span className="text-[10px] text-gray-500">Sender</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
