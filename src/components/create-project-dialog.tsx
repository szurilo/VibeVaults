'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check, Copy, PartyPopper } from 'lucide-react';
import { buildReviewUrl } from '@/lib/review-url';

interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceId?: string;
}

interface CreatedProject {
    id: string;
    name: string;
    website_url?: string | null;
    review_token?: string | null;
}

export function CreateProjectDialog({ open, onOpenChange, workspaceId }: CreateProjectDialogProps) {
    const router = useRouter();
    const [projectName, setProjectName] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // When set, the dialog shows the post-create success step with the
    // project's shareable review link instead of the form.
    const [created, setCreated] = useState<CreatedProject | null>(null);
    const [copied, setCopied] = useState(false);

    // Clear error + any previous success step whenever the dialog opens
    useEffect(() => {
        if (open) { setError(''); setCreated(null); setCopied(false); }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim() || !websiteUrl.trim()) return;

        setLoading(true);
        setError('');
        try {
            const match = document.cookie.match(new RegExp('(^| )selectedWorkspaceId=([^;]+)'));
            const currentWorkspaceId = match ? match[2] : workspaceId;

            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: projectName,
                    website_url: websiteUrl,
                    workspace_id: currentWorkspaceId,
                }),
            });

            if (res.ok) {
                const newProject = await res.json();
                document.cookie = `selectedProjectId=${newProject.id}; path=/; max-age=31536000`;
                setProjectName('');
                setWebsiteUrl('');
                // Refresh behind the dialog, then show the success step with
                // the review link instead of closing.
                router.refresh();
                setCreated(newProject);
            } else {
                const text = await res.text();
                let message = 'Failed to create project. Please try again.';
                try { message = JSON.parse(text)?.error || text || message; } catch { message = text || message; }
                setError(message);
            }
        } catch (error) {
            console.error('Failed to create project:', error);
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const reviewUrl = created?.website_url && created?.review_token
        ? buildReviewUrl(created.website_url, created.review_token)
        : '';

    const copyReviewUrl = () => {
        if (!reviewUrl) return;
        navigator.clipboard.writeText(reviewUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (created) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PartyPopper className="w-5 h-5 text-violet-500" />
                            {created.name} is ready
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {reviewUrl ? (
                            <>
                                <p className="text-sm text-gray-600">
                                    Share this review link with anyone who should give feedback. They open it, enter their name and email, and can start pinning right away — no invite needed.
                                </p>
                                <div className="flex gap-2">
                                    <Input value={reviewUrl} readOnly className="font-mono text-sm" />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={copyReviewUrl}
                                        className="shrink-0 cursor-pointer"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-gray-600">
                                Your project was created. Head to project settings to share it or embed the widget.
                            </p>
                        )}
                        <p className="text-xs text-gray-500">
                            Want the widget on your site permanently? Grab the embed snippet in{' '}
                            <Link
                                href="/dashboard/project-settings#share-or-embed"
                                className="text-violet-600 hover:underline"
                                onClick={() => onOpenChange(false)}
                            >
                                project settings
                            </Link>.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={() => onOpenChange(false)} className="cursor-pointer">
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setError(''); }}>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Create Project</DialogTitle>
                </DialogHeader>
                {error && (
                    <div className="bg-red-50 border border-red-100/50 text-red-800 p-4 rounded-md text-sm font-medium">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2 max-w-sm mt-2">
                        <Label htmlFor="createProjectName">Project Name</Label>
                        <Input
                            id="createProjectName"
                            type="text"
                            placeholder="e.g. My Website"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2 max-w-sm">
                        <Label htmlFor="createWebsiteUrl">Website URL</Label>
                        <Input
                            id="createWebsiteUrl"
                            type="url"
                            placeholder="https://example.com"
                            value={websiteUrl}
                            onChange={(e) => setWebsiteUrl(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!projectName.trim() || !websiteUrl.trim() || loading} className="cursor-pointer">
                            {loading ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
