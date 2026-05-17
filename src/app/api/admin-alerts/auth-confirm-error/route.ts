/**
 * Main Responsibility: Receives diagnostic beacons from /auth/confirm whenever
 * the page shows the "Verification Failed" UI. Emails ADMIN_EMAIL instantly via
 * Resend so we hear about the issue as it happens — it's rare and not locally
 * reproducible, so we need real signal from real users.
 *
 * Sensitive Dependencies:
 * - ADMIN_EMAIL env var; if unset, the route is a no-op (200).
 * - @/lib/widget-helpers#isRateLimited for IP-based throttling.
 * - @/lib/resend for the actual send (Playwright-aware).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/widget-helpers';
import { resend } from '@/lib/resend';

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function POST(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (isRateLimited(ip, 'admin-auth-confirm-error')) {
        return NextResponse.json({ ok: true }, { status: 429 });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return NextResponse.json({ ok: true });

    try {
        const body = await request.json();
        const errorMessage = String(body.errorMessage ?? '').slice(0, 500);
        const type = String(body.type ?? '').slice(0, 32);
        const tokenPrefix = String(body.tokenPrefix ?? '').slice(0, 16);
        const hadPriorSession = body.hadPriorSession === true;
        const userAgent = String(body.userAgent ?? '').slice(0, 500);
        const url = String(body.url ?? '').slice(0, 2000);

        await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to: adminEmail,
            subject: `[VibeVaults] auth/confirm error: ${errorMessage || 'unknown'}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2d3748; padding: 24px;">
                    <h2 style="margin: 0 0 16px;">Auth confirm error</h2>
                    <p>A user just saw the "Verification Failed" screen.</p>
                    <table style="border-collapse: collapse; font-size: 14px;">
                        <tr><td style="padding: 4px 12px 4px 0; color: #718096;">Error</td><td><code>${esc(errorMessage)}</code></td></tr>
                        <tr><td style="padding: 4px 12px 4px 0; color: #718096;">OTP type</td><td>${esc(type)}</td></tr>
                        <tr><td style="padding: 4px 12px 4px 0; color: #718096;">Token prefix</td><td><code>${esc(tokenPrefix)}</code></td></tr>
                        <tr><td style="padding: 4px 12px 4px 0; color: #718096;">Prior session</td><td>${hadPriorSession ? 'yes' : 'no'}</td></tr>
                        <tr><td style="padding: 4px 12px 4px 0; color: #718096;">URL</td><td>${esc(url)}</td></tr>
                        <tr><td style="padding: 4px 12px 4px 0; color: #718096;">User agent</td><td>${esc(userAgent)}</td></tr>
                        <tr><td style="padding: 4px 12px 4px 0; color: #718096;">IP</td><td>${esc(ip)}</td></tr>
                        <tr><td style="padding: 4px 12px 4px 0; color: #718096;">At</td><td>${new Date().toUTCString()}</td></tr>
                    </table>
                </div>
            `,
        });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
}
