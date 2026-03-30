'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceId?: string;
}

export function CreateProjectDialog({ open, onOpenChange, workspaceId }: CreateProjectDialogProps) {
    const router = useRouter();
    const [projectName, setProjectName] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Clear error whenever the dialog opens
    useEffect(() => {
        if (open) setError('');
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
                onOpenChange(false);
                router.refresh();
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
