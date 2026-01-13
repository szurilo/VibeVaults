import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SECRET_KEY = "secret-key-for-mvp-dev-only"; // TODO: Move to env
const key = new TextEncoder().encode(SECRET_KEY);

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(key);
}

export async function decrypt(input: string): Promise<any> {
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ["HS256"],
        });
        return payload;
    } catch {
        return null; // Invalid token
    }
}

export async function getSession() {
    const session = (await cookies()).get("session")?.value;
    if (!session) return null;
    return await decrypt(session);
}
