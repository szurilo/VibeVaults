/**
 * Main Responsibility: Secure API endpoints for listing or inserting Projects. Heavily restricted by 
 * database-level RLS policies to ensure users only access or mutate data within their active workspaces (single-owned, multi-joined).
 * 
 * Sensitive Dependencies: 
 * - @/lib/supabase/server to safely execute DB transactions securely impersonating the calling user.
 * - next/headers (cookies) to lock REST `GET` returns directly to the user's `selectedWorkspaceId`.
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

import { cookies } from "next/headers";

export async function GET() {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("selectedWorkspaceId")?.value;

    let query = supabase.from("projects").select("*").order("created_at", { ascending: false });

    if (workspaceId) {
        query = query.eq("workspace_id", workspaceId);
    }

    const { data: projects, error } = await query;

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json(projects);
}

export async function POST(req: Request) {
    const body = await req.json();
    const { name, website_url, workspace_id } = body;

    if (!name) {
        return new NextResponse("Project name is required", { status: 400 });
    }

    if (!website_url) {
        return new NextResponse("Website URL is required", { status: 400 });
    }

    if (!workspace_id) {
        return new NextResponse("Workspace ID is required", { status: 400 });
    }

    const supabase = await createClient();
    // User auth context is securely handled by the `auth` object, we don't need getClaims for RLS if RLS is enabled,
    // but we can enforce server-side validation here.
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user || userError) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { data: project, error } = await supabase
        .from("projects")
        .insert({
            name,
            website_url,
            user_id: user.id, // we still keep user_id as the creator
            workspace_id
        })
        .select()
        .single();

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json(project);
}
