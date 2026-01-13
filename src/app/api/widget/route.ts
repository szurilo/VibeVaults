import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("key");

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: projects, error } = await supabase.rpc('get_project_by_key', { key_param: apiKey });

    if (error || !projects || projects.length === 0) {
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
    }

    const project = projects[0];

    return NextResponse.json({ project: { name: project.name } });
}

export async function POST(request: Request) {
    const { apiKey, content, type, sender } = await request.json();

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: projects, error: projectError } = await supabase.rpc('get_project_by_key', { key_param: apiKey });

    if (projectError || !projects || projects.length === 0) {
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
    }

    const project = projects[0];

    await supabase.from('feedbacks').insert({
        content,
        type: type || 'Feature',
        sender,
        project_id: project.id
    });

    return NextResponse.json({ success: true });
}
