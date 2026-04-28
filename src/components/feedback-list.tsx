'use client';

import { useEffect, useState } from 'react';
import { FeedbackListCard } from '@/components/feedback-list-card';
import { SlidersHorizontal } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const ALL_STATUSES = [
    { value: 'open', label: 'Open' },
    { value: 'in progress', label: 'In Progress' },
    { value: 'in review', label: 'In Review' },
    { value: 'completed', label: 'Completed' },
];

const DEFAULT_STATUSES = ['open', 'in progress', 'in review'];
const STORAGE_KEY = 'vv:feedback-status-filter';

function loadStoredStatuses(): string[] {
    if (typeof window === 'undefined') return DEFAULT_STATUSES;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_STATUSES;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return DEFAULT_STATUSES;
        const valid = parsed.filter((s): s is string =>
            typeof s === 'string' && ALL_STATUSES.some(a => a.value === s)
        );
        return valid;
    } catch {
        return DEFAULT_STATUSES;
    }
}

interface FeedbackListProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    feedbacks: any[];
    senderAvatars?: Record<string, string>;
}

export function FeedbackList({ feedbacks, senderAvatars = {} }: FeedbackListProps) {
    const [activeStatuses, setActiveStatuses] = useState<string[]>(DEFAULT_STATUSES);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setActiveStatuses(loadStoredStatuses());
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated || typeof window === 'undefined') return;
        try {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(activeStatuses));
        } catch {
            // sessionStorage unavailable (private mode quota etc.) — silently skip
        }
    }, [activeStatuses, hydrated]);

    const toggleStatus = (status: string) => {
        setActiveStatuses(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const filtered = feedbacks.filter(f => {
        const status = (f.status || 'open').toLowerCase();
        return activeStatuses.includes(status);
    });

    return (
        <>
            <div className="flex justify-end mb-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <SlidersHorizontal className="h-4 w-4" />
                            Status
                            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 leading-none">
                                {activeStatuses.length} / {ALL_STATUSES.length}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {ALL_STATUSES.map(s => (
                            <DropdownMenuCheckboxItem
                                key={s.value}
                                checked={activeStatuses.includes(s.value)}
                                onCheckedChange={() => toggleStatus(s.value)}
                                onSelect={e => e.preventDefault()}
                            >
                                {s.label}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                    <p className="text-gray-500">No feedback matches the selected filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
                    {filtered.map((item) => (
                        <FeedbackListCard
                            key={item.id}
                            feedback={item}
                            replyCount={item.reply_count ?? 0}
                            attachmentCount={item.attachment_count ?? 0}
                            senderAvatarUrl={senderAvatars[item.sender]}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
