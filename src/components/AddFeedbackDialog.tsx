'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
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
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.MouseEvent) => {
        e.preventDefault();

        if (!content.trim()) {
            setErrorMsg('Feedback content is required');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            await addManualFeedbackAction(projectId, content.trim());
            setOpen(false);
            setContent('');
        } catch (error: any) {
            console.error('Failed to add feedback:', error);
            setErrorMsg(error.message || 'Failed to add feedback');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={(newOpen) => {
            if (!newOpen && loading) return; // Prevent closing while loading
            setOpen(newOpen);
            if (!newOpen) {
                // Reset state when closing
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
                        disabled={loading}
                    />
                    {errorMsg && (
                        <p className="text-red-500 text-sm mt-2 font-medium">{errorMsg}</p>
                    )}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading} className="cursor-pointer">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleSubmit}
                        disabled={loading || !content.trim()}
                        className="cursor-pointer"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {loading ? 'Adding...' : 'Add Feedback'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
