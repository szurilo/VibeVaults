'use client';

import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { requestWidgetAccessRecovery } from '@/actions/widget-access';

export function AccessForm() {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const trimmed = email.trim();
        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError('Please enter a valid email address.');
            return;
        }

        setSubmitting(true);
        try {
            const result = await requestWidgetAccessRecovery(trimmed);
            if (!result.ok) {
                if (result.reason === 'rate_limited') {
                    setError('Too many requests. Please try again in a few minutes.');
                } else {
                    setError('Please enter a valid email address.');
                }
                return;
            }
            setSubmitted(true);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <div className="text-center py-4">
                <div className="rounded-full bg-green-100 p-3 inline-flex mb-4">
                    <Mail className="h-7 w-7 text-green-600" />
                </div>
                <p className="text-base font-semibold text-gray-900 mb-1">Check your inbox</p>
                <p className="text-sm text-gray-500">
                    If <span className="font-medium text-gray-700">{email}</span> is on file, fresh widget links are on their way.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-700">
                    Your email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3 py-2 border rounded-md border-gray-300 bg-white text-gray-900"
                />
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-white bg-secondary hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Sending links…' : 'Send my widget links'}
            </button>
        </form>
    );
}
