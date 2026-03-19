---
name: Realtime Chat Integration
description: Standard operating procedure for extending and maintaining the real-time chat (Subabase Channels & SSE) used in VibeVaults feedback loops.
---

# Realtime Chat Integration in VibeVaults

VibeVaults implements a hybrid real-time architecture to ensure that an Agency (Dashboard) and an End-User (Widget) can communicate seamlessly in real-time.

## 1. The Architecture Model
*   **Dashboard Side (Client Components):** Directly connects to the Supabase Realtime WebSocket to listen for new rows in the `feedback_replies` table.
*   **Widget Side (End-User):** Connects to a Next.js API Route (`src/app/api/widget/stream/route.ts`) which maintains a Server-Sent Event (SSE) connection. The API route holds the Supabase Realtime subscription on behalf of the widget to enforce security.

## 2. Setting Up Dashboard Subscriptions
When adding real-time listeners to the dashboard (e.g., inside `feedback-card.tsx`), follow this exact React hook pattern to avoid memory leaks or duplicate connections:

```tsx
useEffect(() => {
    // 1. Define the unique channel ID (e.g., scoped to the feedback thread)
    const channel = supabase
        .channel(`replies-${feedback.id}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT', // Only listen for new messages
                schema: 'public',
                table: 'feedback_replies',
                filter: `feedback_id=eq.${feedback.id}`, // STRICT FILTERING
            },
            (payload) => {
                const newReply = payload.new;
                // 2. Prevent UI duplication by checking IDs
                setReplies((prev) => {
                    if (prev.some((r) => r.id === newReply.id)) return prev;
                    return [...prev, newReply];
                });
            }
        )
        .subscribe();

    // 3. MANDATORY CLEANUP
    return () => {
        supabase.removeChannel(channel);
    };
}, [feedback.id]);
```

## 3. SSE Stream Handling for the Widget
If modifying the widget's ability to receive streams:
1.  **Never expose Supabase Anon Keys directly to the widget for real-time.** 
2.  The widget fetches a persistent connection to `GET /api/widget/stream?feedbackId=[ID]`.
3.  The API route uses a generic `ReadableStream` controller. When the Supabase channel triggers an event on the server, the server writes JSON chunks (`controller.enqueue()`) directly to the widget.

## 4. Sending Messages
*   When a message is sent from the Dashboard, always use **Server Actions** (`@/actions/feedback.ts`). Do not insert directly from the client.
*   Once the Server Action completes the `INSERT`, the Postgres trigger (Realtime) will automatically broadcast to both the Dashboard (`feedback-card.tsx`) and the SSE Stream (`stream/route.ts`).

## 5. Debugging Realtime
*   If duplicates appear, check if the React `useEffect` is missing a cleanup phase or dependency array.
*   If events are not firing, ensure the `feedback_replies` table has REPLICA IDENTITY FULL or Realtime toggled ON in the Supabase Dashboard. 
