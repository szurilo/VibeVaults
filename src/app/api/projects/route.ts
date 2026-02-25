import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();
    const { data: projects, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json(projects);
}

export async function POST(req: Request) {
    const body = await req.json();
    const { name, website_url } = body;

    if (!name) {
        return new NextResponse("Project name is required", { status: 400 });
    }

    if (!website_url) {
        return new NextResponse("Website URL is required", { status: 400 });
    }

    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;

    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { data: project, error } = await supabase
        .from("projects")
        .insert({
            name,
            website_url,
            user_id: user.sub
        })
        .select()
        .single();

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json(project);
}
