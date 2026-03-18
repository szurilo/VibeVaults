"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Bell, Check, CheckCircle2, Circle, MessageSquare, PlusCircle, Trash2, XIcon, UserMinus, LogOut } from "lucide-react"
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

export function NotificationBell({ userId }: { userId: string }) {
    const supabase = createClient()
    const router = useRouter()
    const [notifications, setNotifications] = useState<any[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    const fetchNotifications = useCallback(async () => {
        if (!userId) return

        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)

        if (data) {
            setNotifications(data)
            setUnreadCount(data.filter(n => !n.is_read).length)
        }
    }, [userId, supabase])

    useEffect(() => {
        fetchNotifications()

        // We don't subscribe to Realtime here because GlobalNotificationProvider already does it!
        // We can just listen to a custom event from the provider to avoid duplicate subscriptions
        const handleNewNotification = () => {
            fetchNotifications()
        }

        const handleNotificationViewed = (e: Event) => {
            const notification = (e as CustomEvent).detail;
            if (notification?.id) {
                markAsRead(notification.id);
            }
        }

        window.addEventListener('vibe-new-notification', handleNewNotification)
        window.addEventListener('vibe-notification-viewed', handleNotificationViewed)
        return () => {
            window.removeEventListener('vibe-new-notification', handleNewNotification)
            window.removeEventListener('vibe-notification-viewed', handleNotificationViewed)
        }
    }, [fetchNotifications])

    const markAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
    }

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false)
    }

    const clearAll = async () => {
        setNotifications([])
        setUnreadCount(0)

        await supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId)
    }

    const handleNotificationClick = async (notification: any) => {
        if (!notification.is_read) {
            await markAsRead(notification.id)
        }
        setIsOpen(false)

        if (notification.project_id) {
            // Navigate by setting cookie and routing to feedback page with anchor
            document.cookie = `selectedProjectId=${notification.project_id}; path=/`;
            const hash = notification.feedback_id ? `#${notification.feedback_id}` : '';
            router.push(`/dashboard/feedback${hash}`);
        } else {
            // Workspace-level notification (member removed/left)
            router.push('/dashboard');
        }
        router.refresh();

        // If already on /dashboard/feedback, router.push won't fire a native hashchange,
        // so set the hash directly to trigger Highlight's listener.
        if (notification.project_id && notification.feedback_id && window.location.pathname === '/dashboard/feedback') {
            requestAnimationFrame(() => {
                window.location.hash = notification.feedback_id;
            });
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative cursor-pointer hover:bg-gray-100 rounded-full h-8 w-8">
                    <Bell className="w-4 h-4 text-gray-600" />
                    {unreadCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] font-semibold shadow-sm">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="top" showCloseButton={false} className="w-full sm:max-w-md mx-auto max-h-[85vh] p-0 flex flex-col bg-gray-50 border-gray-200 sm:rounded-b-xl sm:border-x sm:border-b shadow-xl overflow-hidden">
                <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm z-10 sm:rounded-b-none sm:rounded-none">
                    <SheetHeader className="p-0 text-left">
                        <SheetTitle className="text-lg font-bold flex items-center gap-2 m-0 text-gray-900">
                            Notifications
                            {unreadCount > 0 && (
                                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                                    {unreadCount} new
                                </span>
                            )}
                        </SheetTitle>
                    </SheetHeader>
                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-[11px] h-7 px-2 text-gray-500 hover:text-gray-900 cursor-pointer"
                                onClick={markAllAsRead}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Mark all read
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-[11px] h-7 px-2 text-gray-500 hover:text-red-600 cursor-pointer"
                                onClick={clearAll}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                Clear all
                            </Button>
                        )}
                        <SheetClose className="rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden cursor-pointer">
                            <XIcon className="size-4" />
                            <span className="sr-only">Close</span>
                        </SheetClose>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                <Bell className="w-8 h-8 text-gray-300" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900">All caught up!</h3>
                                <p className="text-xs text-gray-500 mt-1">You don&apos;t have any notifications right now.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {notifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={cn(
                                        "w-full flex items-start text-left gap-3 p-4 transition-colors hover:bg-white cursor-pointer group last:sm:rounded-b-xl",
                                        !notification.is_read ? "bg-blue-50/50" : "bg-transparent"
                                    )}
                                >
                                    <div className={cn(
                                        "mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-colors",
                                        notification.type === 'new_feedback' ? "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200"
                                            : (notification.type === 'member_removed' || notification.type === 'member_left') ? "bg-amber-100 text-amber-600 group-hover:bg-amber-200"
                                            : "bg-blue-100 text-blue-600 group-hover:bg-blue-200"
                                    )}>
                                        {notification.type === 'new_feedback' ? (
                                            <PlusCircle className="w-4 h-4" />
                                        ) : notification.type === 'member_removed' ? (
                                            <UserMinus className="w-4 h-4" />
                                        ) : notification.type === 'member_left' ? (
                                            <LogOut className="w-4 h-4" />
                                        ) : (
                                            <MessageSquare className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className={cn(
                                                "text-[13px] leading-tight",
                                                !notification.is_read ? "font-bold text-gray-900" : "font-medium text-gray-700"
                                            )}>
                                                {notification.title}
                                            </h4>
                                            {!notification.is_read && (
                                                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1"></div>
                                            )}
                                        </div>
                                        <p className={cn(
                                            "text-xs leading-relaxed line-clamp-2",
                                            !notification.is_read ? "text-gray-600 font-medium" : "text-gray-500"
                                        )}>
                                            {notification.message}
                                        </p>
                                        <span className="text-[10px] text-gray-400 font-medium mt-1">
                                            {new Date(notification.created_at).toLocaleString([], {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
