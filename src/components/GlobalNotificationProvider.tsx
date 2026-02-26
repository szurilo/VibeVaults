"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Toaster } from "@/components/ui/sonner"

export function GlobalNotificationProvider({ children, userId }: { children: React.ReactNode, userId: string }) {
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel('global-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const notification = payload.new;

                    // Dispatch custom event to tell NotificationBell to refresh
                    window.dispatchEvent(new CustomEvent('vibe-new-notification', { detail: notification }))

                    toast(notification.title, {
                        description: notification.message,
                        action: {
                            label: "View",
                            onClick: () => {
                                // Navigate to the project dashboard
                                document.cookie = `selectedProjectId=${notification.project_id}; path=/`;
                                router.push("/dashboard/feedback");
                                router.refresh();
                            }
                        },
                        duration: 8000,
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, supabase, router])

    return (
        <>
            {children}
            <Toaster position="bottom-right" richColors />
        </>
    )
}
