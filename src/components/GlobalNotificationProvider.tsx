/**
 * Main Responsibility: Wraps the application to provide a sticky `Toaster` component for UI alerts, 
 * and actively listens to Supabase Realtime subscriptions to push new dashboard notifications globally.
 * 
 * Sensitive Dependencies: 
 * - @/lib/supabase/client for maintaining a robust websocket connection to the `notifications` table.
 * - `CustomEvent` ('vibe-new-notification') which acts as a bridge to force the NotificationBell component to refresh.
 */
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
            .channel('global-notifications-' + userId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    // Dispatch custom event to tell NotificationBell to refresh
                    window.dispatchEvent(new CustomEvent('vibe-new-notification', { detail: payload.new }))

                    const notification = payload.new;
                    toast(notification.title, {
                        description: notification.message,
                        action: {
                            label: "View",
                            onClick: () => {
                                // Tell NotificationBell to mark this notification as read
                                window.dispatchEvent(new CustomEvent('vibe-notification-viewed', { detail: notification }));

                                if (notification.project_id) {
                                    // Navigate to the project dashboard with feedback anchor
                                    document.cookie = `selectedProjectId=${notification.project_id}; path=/`;
                                    const hash = notification.feedback_id ? `#${notification.feedback_id}` : '';
                                    router.push(`/dashboard/feedback${hash}`);
                                    router.refresh();

                                    // If already on /dashboard/feedback, router.push won't fire hashchange,
                                    // so set the hash directly to trigger Highlight's listener.
                                    if (notification.feedback_id && window.location.pathname === '/dashboard/feedback') {
                                        requestAnimationFrame(() => {
                                            window.location.hash = '';
                                            window.location.hash = notification.feedback_id;
                                        });
                                    }
                                } else {
                                    // Workspace-level notification (member removed/left)
                                    router.push('/dashboard');
                                    router.refresh();
                                }
                            }
                        },
                        duration: 8000,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, supabase, router])

    return (
        <>
            {children}
            <Toaster position="bottom-right" />
        </>
    )
}
