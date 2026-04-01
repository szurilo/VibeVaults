/**
 * Main Responsibility: Receives new-user signup events from a Supabase DB trigger (via pg_net)
 * and sends an admin notification email via Resend.
 *
 * Sensitive Dependencies:
 * - SIGNUP_NOTIFY_SECRET env var — shared secret validated against the `secret` query param sent by pg_net.
 * - ADMIN_EMAIL env var — recipient of the notification email.
 * - sendNewSignupNotification in lib/notifications.ts for the actual email send.
 */
import { NextResponse } from 'next/server';
import { sendNewSignupNotification } from '@/lib/notifications';

export async function POST(request: Request) {
    const secret = new URL(request.url).searchParams.get('secret');
    if (secret !== process.env.SIGNUP_NOTIFY_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { email?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const userEmail = body.email;
    if (!userEmail) {
        return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    await sendNewSignupNotification({ userEmail });

    return NextResponse.json({ ok: true });
}
