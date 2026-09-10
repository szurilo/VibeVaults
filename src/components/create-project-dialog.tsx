'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check, Copy, Loader2, PartyPopper } from 'lucide-react';
import { ActivateWidgetButton } from '@/components/activate-widget-button';
import { getWidgetEmbedStatus } from '@/actions/widget-access';

interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceId?: string;
}

interface CreatedProject {
    id: string;
    name: string;
    api_key: string;
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
    // Whether widget.js has been seen loading on the project's site. Stamped
    // by the widget heartbeat, so it flips on its own once the customer pastes
    // the snippet — no "I've done it" button to lie to.
    const [embedded, setEmbedded] = useState(false);

    // Clear error + any previous embed step whenever the dialog opens
    useEffect(() => {
        if (open) { setError(''); setCreated(null); setCopied(false); setEmbedded(false); }
    }, [open]);

    // Poll for the embed while the step is on screen. Stops as soon as it is
    // detected, and on unmount, so a dialog left open cannot poll forever.
    useEffect(() => {
        if (!open || !created || embedded) return;
        let cancelled = false;
        const timer = setInterval(async () => {
            try {
                const status = await getWidgetEmbedStatus(created.id);
                if (!cancelled && status.embedded) setEmbedded(true);
            } catch { /* transient — the next tick retries */ }
        }, 3000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [open, created, embedded]);

    const scriptTag = created
        ? `<script src="${process.env.NEXT_PUBLIC_APP_URL}/widget.js" data-key="${created.api_key}" async></script>`
        : '';

    const copySnippet = () => {
        if (!scriptTag) return;
        navigator.clipboard.writeText(scriptTag);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                // Move the page behind the dialog onto the new project's
                // dashboard before showing the success step. The user may have
                // started this from an entity-scoped route (a feedback thread
                // belonging to the OLD project) which loads its row by URL id,
                // so a plain refresh would leave them staring at the previous
                // project's record once the dialog closes.
                router.push('/dashboard');
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

    if (created) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                {/* Much wider than the default sm:max-w-lg so the whole embed
                    snippet is readable at a glance. The `sm:` prefix means
                    phones keep the default full-width-minus-margin sizing. */}
                <DialogContent showCloseButton={false} className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PartyPopper className="w-5 h-5 text-violet-500" />
                            {created.name} is ready
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Paste this snippet just before the closing <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">&lt;/body&gt;</code> tag on your site. We&apos;ll notice it automatically.
                        </p>
                        <div className="flex gap-2">
                            <textarea
                                value={scriptTag}
                                readOnly
                                rows={2}
                                onFocus={(e) => e.currentTarget.select()}
                                aria-label="Widget embed snippet"
                                className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs leading-relaxed break-all shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={copySnippet}
                                className="shrink-0 cursor-pointer"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                            </Button>
                        </div>

                        {embedded ? (
                            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 space-y-3">
                                <p className="text-sm text-green-800 flex items-center gap-2">
                                    <Check className="w-4 h-4 shrink-0" />
                                    Widget detected on your site.
                                </p>
                                <p className="text-xs text-green-700">
                                    Activate it on this device to see it, then share the review link from project settings.
                                </p>
                                <ActivateWidgetButton projectId={created.id} variant="default" />
                            </div>
                        ) : (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                                <p className="text-sm text-gray-600 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin shrink-0 text-gray-400" />
                                    Waiting for the widget to load on your site…
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    You can close this and finish later — the snippet is always in{' '}
                                    <Link
                                        href="/dashboard/project-settings#share-or-embed"
                                        className="underline"
                                        onClick={() => onOpenChange(false)}
                                    >
                                        project settings
                                    </Link>.
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant={embedded ? 'outline' : 'default'}
                            onClick={() => onOpenChange(false)}
                            className="cursor-pointer"
                        >
                            {embedded ? 'Done' : 'Cancel'}
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
