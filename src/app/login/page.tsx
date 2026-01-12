'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (res.ok) {
                router.push('/dashboard');
            } else {
                setError('Invalid credentials');
            }
        } catch (err) {
            setError('Something went wrong');
        } finally {
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
                <div className="w-full max-w-[400px] bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold mb-2 text-gray-900">Welcome Back</h1>
                        <p className="text-gray-500 text-sm">Sign in to your account</p>
                    </div>

                    {error && <div className="text-red-500 text-sm mb-4 text-center">{error}</div>}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
                            <input
                                name="email"
                                type="email"
                                placeholder="demo@vibevaults.app"
                                defaultValue="demo@vibevaults.app"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">Password</label>
                            <input
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                defaultValue="demo"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <button type="submit" disabled={loading} className="w-full mt-2 inline-flex items-center justify-center px-4 py-2 rounded-md font-medium text-white bg-secondary hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500">
                        Don't have an account?{' '}
                        <Link href="/register" className="font-medium text-primary hover:text-primary/80">
                            Sign up
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
