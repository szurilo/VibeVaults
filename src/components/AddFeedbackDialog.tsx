'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Paperclip, AlertCircle, Activity } from 'lucide-react';
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
import { toast } from 'sonner';

export function AddFeedbackDialog({ projectId }: { projectId: string }) {
    const [open, setOpen] = useState(false);
    const [content, setContent] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.MouseEvent) => {
        e.preventDefault();

        const trimmed = content.trim();
        if (!trimmed && files.length === 0) {
            setErrorMsg('Feedback content or attachment is required');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await addManualFeedbackAction(projectId, trimmed || '');

            // Upload files if any
            if (files.length > 0 && result?.feedback_id) {
                const formData = new FormData();
                formData.append('feedbackId', result.feedback_id);
                for (const f of files) formData.append('files', f);

                await fetch('/api/dashboard/upload', {
                    method: 'POST',
                    body: formData,
                });
            }

            setOpen(false);
            setContent('');
            setFiles([]);
        } catch (error: any) {
            console.error('Failed to add feedback:', error);
            toast("Error", { description: error?.message || "Failed to add feedback", icon: <AlertCircle className="h-4 w-4 text-red-500" /> });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) {
                setContent('');
                setErrorMsg('');
                setFiles([]);
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
                    <div className="relative">
                        <Textarea
                            placeholder="Describe the problem or suggestion..."
                            value={content}
                            onChange={(e) => {
                                setContent(e.target.value);
                                if (errorMsg) setErrorMsg('');
                            }}
                            className="min-h-[120px] pr-12 resize-none overflow-x-hidden field-sizing-fixed"
                        />
                        <label className="absolute bottom-2.5 right-2.5 h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                            <Paperclip className="w-4 h-4" />
                            <input
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files) {
                                        setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                        e.target.value = '';
                                        if (errorMsg) setErrorMsg('');
                                    }
                                }}
                            />
                        </label>
                    </div>
                    {files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {files.map((file, idx) => (
                                <div key={idx} className="relative w-12 h-12 rounded-md border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center group">
                                    {file.type.startsWith('image/') ? (
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt={file.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-[9px] font-semibold text-gray-500 text-center px-0.5 break-all leading-tight">
                                            {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                                        </span>
                                    )}
                                    <button
                                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 text-white flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {errorMsg && (
                        <p className="text-red-500 text-sm mt-2 font-medium">{errorMsg}</p>
                    )}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                    <Button
                        onClick={handleSubmit}
                        disabled={(!content.trim() && files.length === 0) || isSubmitting}
                        className="cursor-pointer"
                    >
                        {isSubmitting ? (
                            <><Activity className="w-4 h-4 animate-spin mr-1.5" /> Adding...</>
                        ) : (
                            'Add Feedback'
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
