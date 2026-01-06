import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("key");

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
        where: { apiKey }
    });

    if (!project) {
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
    }

    return NextResponse.json({ project: { name: project.name } });
}

export async function POST(request: Request) {
    const { apiKey, content, type, sender } = await request.json();

    if (!apiKey) {
        return NextResponse.json({ error: "Missing API Key" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
        where: { apiKey }
    });

    if (!project) {
        return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
    }

    await prisma.feedback.create({
        data: {
            content,
            type: type || 'Feature',
            sender,
            projectId: project.id
        }
    });

    return NextResponse.json({ success: true });
}
