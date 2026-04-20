import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Used when a server component detects a stale session (e.g. the user was
// deleted server-side but the JWT still decodes locally in the proxy).
// Server components can't write cookies — Route Handlers can — so we bounce
// through here to clear the Supabase session cookies, then redirect onward.
export async function GET(request: Request) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });

    const url = new URL("/auth/login", request.url);
    return NextResponse.redirect(url, 303);
}
