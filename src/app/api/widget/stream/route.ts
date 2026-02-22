import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// SSE streams must not be cached or statically rendered
export const dynamic = "force-dynamic";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * SSE endpoint – streams new feedback_replies in real-time.
 *
 * Query params:
 *   - feedbackId : the feedback to watch
 *   - key        : the project API key (used for auth)
 *
 * The route validates the API key, subscribes to Supabase Realtime for
 * INSERTs on the feedback_replies table filtered by feedback_id, and
 * pushes each new row as an SSE "message" event.  A heartbeat is sent
 * every 30 s to keep the connection alive through proxies.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get("feedbackId");
    const apiKey = searchParams.get("key");

    if (!feedbackId || !apiKey) {
        return new Response(
            JSON.stringify({ error: "Missing feedbackId or key" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // --- Auth: validate API key + feedback ownership ---
    const supabase = await createClient();
    const { data: projects, error: projectError } = await supabase.rpc(
        "get_project_by_api_key",
        { key_param: apiKey }
    );

    if (projectError || !projects || projects.length === 0) {
        return new Response(
            JSON.stringify({ error: "Invalid API Key" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const project = projects[0];

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
            // Send an initial "connected" event
            controller.enqueue(
                encoder.encode(`event: connected\ndata: ${JSON.stringify({ feedbackId })}\n\n`)
            );

            // Subscribe to realtime INSERTs on feedback_replies for this feedback
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
                .subscribe();

            // Heartbeat every 30s to keep connection alive through proxies
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: heartbeat\n\n`));
                } catch {
                    clearInterval(heartbeat);
                }
            }, 30_000);

            // Cleanup when the client disconnects
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
            "X-Accel-Buffering": "no", // Disable Nginx buffering
        },
    });
}
