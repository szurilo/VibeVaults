import React from 'react';

export function ProjectModeBadge({ mode, className = '' }: { mode?: string, className?: string }) {
    const isLive = mode === 'live';
    return (
        <span className={`inline-flex items-center justify-center leading-none uppercase tracking-wider rounded-full font-semibold border ${isLive
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-amber-100 text-amber-700 border-amber-200'
            } ${className}`}>
            {isLive ? 'Live' : 'Staging'}
        </span>
    );
}
