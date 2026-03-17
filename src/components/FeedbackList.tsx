'use client';

import { useState } from 'react';
import { FeedbackCard } from '@/components/feedback-card';
import { Highlight } from '@/components/Highlight';
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

interface FeedbackListProps {
    feedbacks: any[];
}

export function FeedbackList({ feedbacks }: FeedbackListProps) {
    const [activeStatuses, setActiveStatuses] = useState<string[]>(DEFAULT_STATUSES);

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

    const isFiltered = activeStatuses.length < ALL_STATUSES.length;

    return (
        <>
            <div className="flex justify-end mb-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <SlidersHorizontal className="h-4 w-4" />
                            Status
                            {isFiltered && (
                                <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 leading-none">
                                    {activeStatuses.length}
                                </span>
                            )}
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
                    {filtered.map((item: any) => (
                        <Highlight key={item.id} id={item.id} className="rounded-lg">
                            <FeedbackCard feedback={item} mode="edit" />
                        </Highlight>
                    ))}
                </div>
            )}
        </>
    );
}
