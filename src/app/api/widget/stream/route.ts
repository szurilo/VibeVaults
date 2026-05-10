import { createAdminClient } from "@/lib/supabase/admin";
import { corsHeaders, validateApiKey, verifyWidgetToken } from "@/lib/widget-helpers";

// SSE streams must not be cached or statically rendered
export const dynamic = "force-dynamic";

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * SSE endpoint – streams new feedback_replies in real-time.
 *
 * Query params:
 *   - feedbackId : the feedback to watch
 *   - key        : the project API key
 *   - token      : the widget identity token (EventSource cannot send custom
 *                  headers, so the bearer token has to ride in the URL).
 *
 * Validates the token+key, subscribes to Supabase Realtime for INSERTs on
 * feedback_replies (filtered by feedback_id) and UPDATEs on the parent
 * feedback (status changes), and pushes each event over SSE. Sends a heartbeat
 * every 30 s so proxies don't drop the connection.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get("feedbackId");
    const apiKey = searchParams.get("key");
    const token = searchParams.get("token");

    if (!feedbackId || !apiKey) {
        return new Response(
            JSON.stringify({ error: "Missing feedbackId or key" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    if (!token) {
        return new Response(
            JSON.stringify({ error: "Missing token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const { project, error: apiKeyError } = await validateApiKey(apiKey);

    if (apiKeyError || !project) {
        return new Response(
            JSON.stringify({ error: "Invalid API Key" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const identity = await verifyWidgetToken(token, project.id);
    if (!identity) {
        return new Response(
            JSON.stringify({ error: "Widget access not authorized. Request a new access link." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const adminSupabase = createAdminClient();
    const { data: feedback, error: feedbackError } = await adminSupabase
        .from("feedbacks")
        .select("id, project_id")
        .eq("id", feedbackId)
        .eq("project_id", project.id)
        .single();

    if (feedbackError || !feedback) {
        return new Response(
            JSON.stringify({ error: "Feedback not found for this project" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // --- SSE stream ---
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(
                encoder.encode(`event: connected\ndata: ${JSON.stringify({ feedbackId })}\n\n`)
            );

            const channel = adminSupabase
                .channel(`replies-${feedbackId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "feedback_replies",
                        filter: `feedback_id=eq.${feedbackId}`,
                    },
                    (payload) => {
                        try {
                            const data = JSON.stringify(payload.new);
                            controller.enqueue(
                                encoder.encode(`event: new_reply\ndata: ${data}\n\n`)
                            );
                        } catch {
                            // Connection may have been closed
                        }
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "feedback_attachments",
                        filter: `feedback_id=eq.${feedbackId}`,
                    },
                    (payload) => {
                        try {
                            const data = JSON.stringify(payload.new);
                            controller.enqueue(
                                encoder.encode(`event: new_attachment\ndata: ${data}\n\n`)
                            );
                        } catch {
                            // Connection may have been closed
                        }
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "feedbacks",
                        filter: `id=eq.${feedbackId}`,
                    },
                    (payload) => {
                        try {
                            const data = JSON.stringify({ status: payload.new.status });
                            controller.enqueue(
                                encoder.encode(`event: status_update\ndata: ${data}\n\n`)
                            );
                        } catch {
                            // Connection may have been closed
                        }
                    }
                )
                .subscribe();

            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: heartbeat\n\n`));
                } catch {
                    clearInterval(heartbeat);
                }
            }, 30_000);

            request.signal.addEventListener("abort", () => {
                clearInterval(heartbeat);
                adminSupabase.removeChannel(channel);
                try {
                    controller.close();
                } catch {
                    // Already closed
                }
            });
        },
    });

    return new Response(stream, {
        headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
