import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const body = await request.json();
    const { email, password } = body;

    const user = await prisma.user.findUnique({
        where: { email },
    });

    // Simple clean text password check for MVP
    if (!user || user.password !== password) {
        return NextResponse.json(
            { error: "Invalid credentials" },
            { status: 401 }
        );
    }

    // Create session
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
    const session = await encrypt({ user: { id: user.id, email: user.email }, expires });

    (await cookies()).set("session", session, { expires, httpOnly: true });

    return NextResponse.json({ success: true });
}
