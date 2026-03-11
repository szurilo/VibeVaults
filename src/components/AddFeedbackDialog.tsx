'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { addManualFeedbackAction } from '@/actions/feedback';

export function AddFeedbackDialog({ projectId }: { projectId: string }) {
    const [open, setOpen] = useState(false);
    const [content, setContent] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.MouseEvent) => {
        e.preventDefault();

        const trimmed = content.trim();
        if (!trimmed) {
            setErrorMsg('Feedback content is required');
            return;
        }

        // Close dialog immediately, then fire the action
        setOpen(false);
        setContent('');

        try {
            await addManualFeedbackAction(projectId, trimmed);
        } catch (error: any) {
            console.error('Failed to add feedback:', error);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) {
                setContent('');
                setErrorMsg('');
            }
        }}>
            <AlertDialogTrigger asChild>
                <Button className="cursor-pointer flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add feedback
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Add Feedback</AlertDialogTitle>
                    <AlertDialogDescription>
                        Leave a note or create feedback directly on the board.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="py-4">
                    <Textarea
                        placeholder="Describe the problem or suggestion..."
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                            if (errorMsg) setErrorMsg('');
                        }}
                        className="min-h-[120px] resize-none"
                    />
                    {errorMsg && (
                        <p className="text-red-500 text-sm mt-2 font-medium">{errorMsg}</p>
                    )}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                    <Button
                        onClick={handleSubmit}
                        disabled={!content.trim()}
                        className="cursor-pointer"
                    >
                        Add Feedback
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
