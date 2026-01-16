import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await getSession();
    if (!session || !session.user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

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
    const session = await getSession();
    if (!session || !session.user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
        return new NextResponse("Project name is required", { status: 400 });
    }

    const supabase = await createClient();
    const { data: project, error } = await supabase
        .from("projects")
        .insert({
            name,
            user_id: session.user.id
        })
        .select()
        .single();

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json(project);
}
