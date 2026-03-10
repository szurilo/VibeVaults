import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function optionsResponse() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export function corsError(message: string, status: number) {
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
}

export function corsSuccess(data: object) {
    return NextResponse.json(data, { headers: corsHeaders });
}

/**
 * Validates a widget API key and returns the project row.
 * Returns `{ project }` on success or `{ error, status }` on failure.
 */
export async function validateApiKey(apiKey: string) {
    const supabase = await createClient();
    const { data: projects, error } = await supabase.rpc('get_project_by_api_key', { key_param: apiKey });

    if (error || !projects || projects.length === 0) {
        return { project: null, error: "Invalid API Key", status: 401 };
    }

    return { project: projects[0], error: null, status: 200 };
}
