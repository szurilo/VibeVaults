/**
 * Main Responsibility: Wraps the application to provide a sticky `Toaster` component for UI alerts,
 * and actively listens to Supabase Realtime subscriptions to push new dashboard notifications globally.
 *
 * Sensitive Dependencies:
 * - @/lib/supabase/client for maintaining a robust websocket connection to the `notifications` table.
 * - `CustomEvent` ('vibe-new-notification') which acts as a bridge to force the NotificationBell component to refresh.
 *
 * Resilience note: the Realtime channel is created once on mount but the socket can drop silently
 * (tab backgrounded, laptop sleep, network blip, transient CHANNEL_ERROR/TIMED_OUT, or an access
 * token expiring out from under the postgres_changes RLS check). Without recovery, notifications
 * stop arriving until a full page reload. We therefore watch the subscribe status and re-join on
 * failure, re-subscribe when the tab regains visibility or the network returns, and re-auth the
 * Realtime socket on token refresh so RLS-filtered postgres_changes keep flowing.
 */
"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { navigateToNotification } from "@/lib/notification-navigation"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { Toaster } from "@/components/ui/sonner"

export function GlobalNotificationProvider({ children, userId }: { children: React.ReactNode, userId: string }) {
    const supabase = createClient()
    const router = useRouter()

    // Keep the latest router in a ref so the toast action closure never goes stale,
    // while the subscription effect itself only depends on userId. Assigning in an
    // effect (not during render) avoids React 19's "cannot access refs during render".
    const routerRef = useRef(router)
    useEffect(() => {
        routerRef.current = router
    }, [router])

    useEffect(() => {
        if (!userId) return;

        let channel: RealtimeChannel | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let retryDelay = 1000; // exponential backoff, capped
        let disposed = false;

        const handleInsert = (payload: { new: Record<string, unknown> & { title?: string; message?: string; project_id?: string | null; feedback_id?: string | null } }) => {
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
                        navigateToNotification(
                            { project_id: notification.project_id ?? null, feedback_id: notification.feedback_id ?? null },
                            routerRef.current,
                            supabase
                        );
                    }
                },
                duration: 8000,
            });
        };

        // The #1 cause of a permanently-dead channel is an expired JWT: realtime-js
        // reconnects the socket and auto-rejoins on its own, but always with the
        // token it last held. supabase-js's auto-refresh ticker is frozen while the
        // tab sleeps, so after a laptop-lid-close that token can be hours stale and
        // the server rejects every rejoin with "InvalidJWTToken: Token has expired"
        // — forever, until reload. So before every (re)subscribe we refresh the
        // access token when it's expired and push the fresh JWT into the socket.
        const ensureFreshAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                let token = session?.access_token;
                // expires_at is in seconds; refresh if expired or within 30s of it.
                if (session?.expires_at && session.expires_at * 1000 < Date.now() + 30_000) {
                    const { data: refreshed } = await supabase.auth.refreshSession();
                    token = refreshed.session?.access_token ?? token;
                }
                if (token) {
                    // An explicitly-set token is preserved across removeChannel/resubscribe.
                    await supabase.realtime.setAuth(token);
                }
            } catch {
                // Refresh can fail (offline, rotated refresh token). Fall through and
                // still attempt the join; the status handler keeps retrying with backoff.
            }
        };

        const reconnect = async () => {
            await ensureFreshAuth();
            if (disposed) return;
            subscribe();
        };

        const scheduleReconnect = () => {
            if (disposed || retryTimer) return;
            retryTimer = setTimeout(() => {
                retryTimer = null;
                retryDelay = Math.min(retryDelay * 2, 30000);
                void reconnect();
            }, retryDelay);
        };

        const subscribe = () => {
            if (disposed) return;
            // Tear down any prior channel instance before re-joining so we never
            // leak a half-dead channel or stack duplicate subscriptions.
            if (channel) {
                supabase.removeChannel(channel);
                channel = null;
            }

            channel = supabase
                .channel('global-notifications-' + userId)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${userId}`,
                    },
                    handleInsert
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        retryDelay = 1000; // healthy again — reset backoff
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        scheduleReconnect();
                    }
                });
        };

        // On wake (tab visible again / network back) the socket may have died
        // silently; force an immediate token-refreshing reconnect instead of
        // waiting out the backoff.
        const handleWake = () => {
            if (disposed) return;
            if (document.visibilityState === 'hidden') return;
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
            retryDelay = 1000;
            void reconnect();
        };

        // On token refresh, push the new JWT to the Realtime socket so the
        // RLS-authorized postgres_changes subscription doesn't expire out.
        const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
                handleWake();
            }
        });

        document.addEventListener('visibilitychange', handleWake);
        window.addEventListener('online', handleWake);

        // Initial join goes through reconnect() so it too refreshes a stale token
        // (the component can mount in a long-open SPA whose token already expired).
        void reconnect();

        return () => {
            disposed = true;
            if (retryTimer) clearTimeout(retryTimer);
            document.removeEventListener('visibilitychange', handleWake);
            window.removeEventListener('online', handleWake);
            authSub.subscription.unsubscribe();
            if (channel) supabase.removeChannel(channel);
        };
    }, [userId, supabase])

    return (
        <>
            {children}
            <Toaster position="bottom-right" />
        </>
    )
}
