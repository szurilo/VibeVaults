import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    (await cookies()).delete("session");
    return NextResponse.redirect(new URL("/login", request.url));
}
