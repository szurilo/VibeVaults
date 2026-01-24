
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${location.origin}/auth/confirm`,
            },
        });

        if (error) {
            console.error('Error sending magic link:', error);
            setError(error.message);
            setLoading(false);
        } else {
            console.log('Magic link requested for:', email);
            setSubmitted(true);
            setLoading(false);
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
                    <div className="w-full max-w-[400px] bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center">
                        <div className="mb-4">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold mb-2 text-gray-900">Check your inbox</h1>
                        <p className="text-gray-500 mb-6">
                            We've sent a magic link to <span className="font-semibold text-gray-900">{email}</span>.
                            <br />Click the link to complete your signup.
                        </p>
                        <div className="mt-6">
                            <Link href="/login" className="text-sm font-medium text-primary hover:text-primary/80">
                                Back to login
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-[400px] bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold mb-2 text-gray-900">Create your account</h1>
                            <p className="text-gray-500 text-sm">Sign up with your email via Magic Link</p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-700">Email</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 inline-flex items-center justify-center px-4 py-2 rounded-md font-medium text-white bg-secondary hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                                {loading ? 'Sending Magic Link...' : 'Send Magic Link'}
                            </button>
                            <p className="text-xs text-center text-gray-500 mt-2">
                                By continuing, you agree to our{' '}
                                <Link href="/terms-of-service" className="underline hover:text-gray-900">Terms of Service</Link>
                                {' '}and{' '}
                                <Link href="/privacy-policy" className="underline hover:text-gray-900">Privacy Policy</Link>.
                            </p>
                        </form>

                        <div className="mt-6 text-center text-sm text-gray-500">
                            Already have an account?{' '}
                            <Link href="/auth/login" className="font-medium text-primary hover:text-primary/80">
                                Sign in
                            </Link>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
