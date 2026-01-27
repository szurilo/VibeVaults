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
    const { name } = body;

    if (!name) {
        return new NextResponse("Project name is required", { status: 400 });
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
            user_id: user.sub
        })
        .select()
        .single();

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    // Mark onboarding as completed when the first project is created
    const { error: profileError } = await supabase
        .from("profiles")
        .update({ has_onboarded: true })
        .eq("id", user.sub);

    if (profileError) {
        console.error("Failed to update profile onboarding status:", profileError);
    }

    return NextResponse.json(project);
}
