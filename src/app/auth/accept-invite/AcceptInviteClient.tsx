/**
 * Main Responsibility: Client-side sign-in surface for workspace invitees. Offers
 * magic link (locked to the invited email) and Google OAuth. The existing ToS /
 * Privacy disclaimer serves as the GDPR consent moment — no auth record exists
 * before the user actively submits one of these options.
 *
 * Sensitive Dependencies:
 * - Supabase browser client for signInWithOtp / signInWithOAuth.
 * - Turnstile captcha (same as login/register surfaces).
 * - auth_redirect cookie: the magic-link `/auth/confirm` page reads this after
 *   OTP verification to return the user to the invite acceptance URL.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Turnstile } from '@marsidev/react-turnstile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail } from 'lucide-react';

type Props = {
    token: string;
    inviteEmail: string;
    workspaceName: string;
    inviterName: string;
};

export function AcceptInviteClient({ token, inviteEmail, workspaceName, inviterName }: Props) {
    const [loading, setLoading] = useState<'magic' | 'google' | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [devMailpitHint, setDevMailpitHint] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [captchaToken, setCaptchaToken] = useState<string>();

    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;
    const inviteReturnPath = `/auth/accept-invite?token=${encodeURIComponent(token)}`;

    async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        if (turnstileSiteKey && !captchaToken) {
            setError('Please wait for the security check to complete.');
            return;
        }

        setLoading('magic');

        const supabase = createClient();

        // Persist the invite return path so /auth/confirm sends the user back here
        // after OTP verification (same mechanism as the main login form).
        document.cookie = `auth_redirect=${encodeURIComponent(inviteReturnPath)}; path=/; max-age=600; SameSite=Lax`;

        const options: { emailRedirectTo: string; captchaToken?: string } = {
            emailRedirectTo: `${location.origin}/auth/confirm`,
        };
        if (turnstileSiteKey && captchaToken) {
            options.captchaToken = captchaToken;
        }

        const { error: otpError } = await supabase.auth.signInWithOtp({
            email: inviteEmail,
            options,
        });

        if (otpError) {
            console.error('Error sending magic link:', otpError);
            setError(otpError.message);
            setLoading(null);
        } else {
            setSubmitted(true);
            setLoading(null);
            if (process.env.NODE_ENV === 'development') {
                setDevMailpitHint(true);
            }
        }
    }

    async function handleGoogle() {
        setError(null);
        setLoading('google');
        const supabase = createClient();

        const callbackUrl = `${location.origin}/auth/callback?next=${encodeURIComponent(inviteReturnPath)}`;

        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: callbackUrl,
                // Force the Google account chooser to appear every time. Without this,
                // a user who just signed out of Supabase to accept an invite for a
                // different email gets silently re-authed into the same Google account,
                // making the mismatch recovery flow impossible to escape.
                queryParams: { prompt: 'select_account' },
            },
        });

        if (oauthError) {
            console.error('Google sign-in error:', oauthError);
            setError(oauthError.message);
            setLoading(null);
        }
    }

    return (
        <div className="min-h-screen flex flex-col">
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="px-8 py-4 max-w-7xl mx-auto w-full">
                    <Link href="/" className="font-bold text-2xl tracking-tight text-primary hover:opacity-90 transition-opacity">
                        VibeVaults
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center bg-gray-50 p-4">
                {submitted ? (
                    <Card className="w-full max-w-[440px] text-center shadow-lg">
                        <CardHeader className="space-y-4">
                            <div className="flex justify-center">
                                <div className="rounded-full bg-green-100 p-3">
                                    <Mail className="h-8 w-8 text-green-600" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <CardTitle className="text-2xl font-extrabold tracking-tight">
                                    Check your inbox
                                </CardTitle>
                                <CardDescription className="text-base">
                                    {"We've sent a magic link to "}
                                    <span className="font-semibold text-foreground">{inviteEmail}</span>.
                                    <br />
                                    Click the link to accept your invitation to {workspaceName}.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        {devMailpitHint && (
                            <CardContent>
                                <a
                                    href="http://localhost:54324"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium hover:bg-amber-100 transition-colors"
                                >
                                    Dev: Open Mailpit to find the magic link
                                </a>
                            </CardContent>
                        )}
                    </Card>
                ) : (
                    <div className="w-full max-w-[440px] bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold mb-2 text-gray-900">
                                {"You've been invited"}
                            </h1>
                            <p className="text-gray-500 text-sm">
                                <span className="font-semibold text-gray-900">{inviterName}</span>
                                {' invited you to join '}
                                <span className="font-semibold text-gray-900">{workspaceName}</span>.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleMagicLink} className="flex flex-col gap-4" noValidate>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-700">
                                    Your email
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={inviteEmail}
                                    disabled
                                    readOnly
                                    aria-label="Invited email address (cannot be changed)"
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Invites are tied to this address. To use a different email, ask the workspace owner for a new invite.
                                </p>
                            </div>

                            {turnstileSiteKey && (
                                <div className="flex justify-center w-full min-h-[65px]">
                                    <Turnstile
                                        siteKey={turnstileSiteKey}
                                        onSuccess={(t) => setCaptchaToken(t)}
                                        onError={() => setError('Security check failed. Please refresh the page.')}
                                        onExpire={() => setCaptchaToken(undefined)}
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading !== null}
                                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-white bg-secondary hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                                {loading === 'magic' && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loading === 'magic' ? 'Sending Magic Link...' : 'Continue with Magic Link'}
                            </button>

                            <p className="text-xs text-center text-gray-500 mt-2">
                                By continuing, you agree to our{' '}
                                <Link href="/terms-of-service" className="underline hover:text-gray-900">Terms of Service</Link>
                                {' '}and{' '}
                                <Link href="/privacy-policy" className="underline hover:text-gray-900">Privacy Policy</Link>.
                            </p>
                        </form>

                        <div className="mt-6">
                            <div className="relative mb-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-gray-500">Or</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleGoogle}
                                disabled={loading !== null}
                                className="w-full inline-flex items-center justify-center gap-3 px-4 py-2 rounded-md font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
                                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
                                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
                                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
                                </svg>
                                {loading === 'google' ? 'Redirecting...' : 'Continue with Google'}
                            </button>
                            <p className="text-xs text-center text-gray-500 mt-3">
                                Use the Google account tied to{' '}
                                <span className="font-medium text-gray-700">{inviteEmail}</span>.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
