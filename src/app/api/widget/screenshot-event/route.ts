/**
 * Main Responsibility: Receives screenshot-capture telemetry beacons from the
 * embeddable widget and forwards them to PostHog. Used to size the impact of
 * the known Firefox+GPU foreignObject rasterization bug — once we have enough
 * data points to know whether it affects 0.1% or 30% of Firefox users, we can
 * decide whether the canvas-substitute workaround is worth shipping.
 *
 * Sensitive Dependencies:
 * - posthog-node for server-side capture (separate SDK from posthog-js).
 * - @/lib/widget-helpers for CORS headers and rate limiting.
 */
import { NextRequest } from "next/server";
import { corsError, corsSuccess, optionsResponse, isRateLimited } from "@/lib/widget-helpers";

export async function OPTIONS() {
    return optionsResponse();
}

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (isRateLimited(ip, "widget-screenshot-event")) {
        return corsError("Too many requests", 429);
    }

    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        return corsSuccess({ ok: true });
    }

    try {
        const body = await request.json();
        const {
            apiKey,
            outcome,
            browser,
            userAgent,
            url,
            gpuVendor,
            gpuRenderer,
            devicePixelRatio,
            viewportWidth,
            viewportHeight,
            durationMs,
        } = body;

        if (!apiKey || !outcome) {
            return corsError("Missing required fields", 400);
        }

        const { PostHog } = await import("posthog-node");
        const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
            host: "https://eu.i.posthog.com",
            flushAt: 1,
            flushInterval: 0,
        });

        posthog.capture({
            distinctId: `widget:${apiKey}`,
            event: "widget_screenshot_capture",
            properties: {
                outcome: String(outcome).slice(0, 32),
                browser: browser ? String(browser).slice(0, 32) : undefined,
                $useragent: userAgent ? String(userAgent).slice(0, 500) : undefined,
                page_url: url ? String(url).slice(0, 2000) : undefined,
                gpu_vendor: gpuVendor ? String(gpuVendor).slice(0, 200) : undefined,
                gpu_renderer: gpuRenderer ? String(gpuRenderer).slice(0, 300) : undefined,
                device_pixel_ratio: typeof devicePixelRatio === "number" ? devicePixelRatio : undefined,
                viewport_width: typeof viewportWidth === "number" ? viewportWidth : undefined,
                viewport_height: typeof viewportHeight === "number" ? viewportHeight : undefined,
                duration_ms: typeof durationMs === "number" ? durationMs : undefined,
            },
        });

        await posthog.shutdown();
        return corsSuccess({ ok: true });
    } catch {
        return corsError("Invalid request", 400);
    }
}
