'use client';

import * as React from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { updateFeedbackStatus } from '@/actions/feedback';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';

interface FeedbackStatusSelectProps {
    id: string;
    initialStatus: string;
}

export function FeedbackStatusSelect({ id, initialStatus }: FeedbackStatusSelectProps) {
    const [status, setStatus] = React.useState(initialStatus);

    const handleStatusChange = async (newStatus: string) => {
        setStatus(newStatus); // Optimistic update
        try {
            await updateFeedbackStatus(id, newStatus);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update status';
            toast("Error", { description: message, icon: <AlertCircle className="h-4 w-4 text-red-500" /> });
            setStatus(initialStatus); // Revert on error
        }
    };

    return (
        <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in progress">In Progress</SelectItem>
                <SelectItem value="in review">In Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
        </Select>
    );
}
