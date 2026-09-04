/**
 * Main Responsibility: RFC 8058 one-click unsubscribe endpoint, referenced by
 * the `List-Unsubscribe` header on every notification email. POST turns off
 * all notification preferences for the token's email and answers 200; GET
 * hands the recipient to the normal preferences page so the same URL works if
 * a mail client simply opens it.
 *
 * Why it exists: Gmail/Yahoo bulk-sender rules require a one-click opt-out
 * that responds to POST. The `/unsubscribe` page is a Server Component and
 * cannot handle POST itself, so the header points here instead.
 *
 * Sensitive Dependencies:
 * - `email_preferences.unsubscribe_token` is the credential; recipients have
 *   no session (guests and invited clients have no account at all), so this
 *   uses the admin client and MUST stay excluded from the auth gate in
 *   src/lib/supabase/proxy.ts (`/api/unsubscribe`).
 * - Mail providers fetch this URL unauthenticated and expect 200/202.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function tokenFrom(request: Request): string | null {
    return new URL(request.url).searchParams.get("token");
}

export async function GET(request: Request) {
    const token = tokenFrom(request);
    if (!token) return new NextResponse("Missing token", { status: 400 });
    return NextResponse.redirect(
        new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, request.url),
        303,
    );
}

export async function POST(request: Request) {
    const token = tokenFrom(request);
    if (!token) return new NextResponse("Missing token", { status: 400 });

    const supabase = createAdminClient();

    // One-click means "stop sending me these", so every notification type is
    // turned off. The recipient can re-enable individual ones on the page.
    const { error } = await supabase
        .from("email_preferences")
        .update({
            notify_replies: false,
            notify_new_feedback: false,
            notify_project_created: false,
            notify_project_deleted: false,
        })
        .eq("unsubscribe_token", token);

    // An unknown token is answered 200 as well: mail providers retry or flag
    // non-2xx responses, and telling a caller whether a token exists leaks
    // nothing useful to a legitimate recipient anyway.
    if (error) {
        console.error("one-click unsubscribe failed:", error);
        return new NextResponse("Unable to process right now", { status: 500 });
    }

    return new NextResponse("Unsubscribed", { status: 200 });
}
