/**
 * Main Responsibility: Displays a dropdown allowing users to jump between their accessible 
 * workspaces (single-owned, multi-joined). Synchronizes and enforces the chosen workspace in the client cookies.
 * 
 * Sensitive Dependencies: 
 * - document.cookie for mutating the `selectedWorkspaceId` variable and wiping out the `selectedProjectId`.
 * - Next.js Router for causing a hard refresh of the encompassing DashboardLayout after state changes.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js';
import { Plus } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export default function WorkspaceSwitcher({
    workspaces,
    selectedWorkspaceId,
    user
}: {
    workspaces: any[],
    selectedWorkspaceId?: string,
    user: User
}) {
    const router = useRouter();

    useEffect(() => {
        // If we have workspaces and no selected ID from prop or if the cookie is missing, set it.
        const cookieValue = typeof document !== 'undefined' ? document.cookie
            .split('; ')
            .find(row => row.startsWith('selectedWorkspaceId='))
            ?.split('=')[1] : null;

        if (selectedWorkspaceId && selectedWorkspaceId !== cookieValue) {
            document.cookie = `selectedWorkspaceId=${selectedWorkspaceId}; path=/; max-age=31536000`;
        }
    }, [selectedWorkspaceId]);

    const handleWorkspaceChange = (workspaceId: string) => {
        document.cookie = `selectedWorkspaceId=${workspaceId}; path=/; max-age=31536000`;
        // Clear the selected project when switching workspaces so it defaults to the new workspace's first project
        document.cookie = `selectedProjectId=; path=/; max-age=0`;
        router.refresh();
    };

    if (!workspaces || workspaces.length === 0) {
        return null;
    }

    const hasOwnWorkspace = workspaces.some(w => w.owner_id === user.id);

    return (
        <div className="flex flex-col gap-4 mb-4">
            <div className="space-y-1.5 px-3">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Workspace
                    </Label>
                    {hasOwnWorkspace && <AddWorkspaceDialog hasOwnWorkspace={hasOwnWorkspace} />}
                </div>
                <Select
                    value={selectedWorkspaceId || ''}
                    onValueChange={handleWorkspaceChange}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a workspace" />
                    </SelectTrigger>
                    <SelectContent>
                        {workspaces.map((workspace) => (
                            <SelectItem key={workspace.id} value={workspace.id}>
                                <div className="flex items-center justify-between gap-3 w-full pr-1">
                                    <span className="truncate">{workspace.name}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {!hasOwnWorkspace && (
                    <div className="pt-2">
                        <AddWorkspaceDialog hasOwnWorkspace={hasOwnWorkspace} />
                    </div>
                )}
            </div>
        </div>
    );
}

function AddWorkspaceDialog({ hasOwnWorkspace }: { hasOwnWorkspace?: boolean }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            const { createWorkspaceAction } = await import('@/actions/workspaces');
            const newWorkspaceId = await createWorkspaceAction(name.trim());
            document.cookie = `selectedWorkspaceId=${newWorkspaceId}; path=/; max-age=31536000`;
            document.cookie = `selectedProjectId=; path=/; max-age=0`;
            setOpen(false);
            setName('');
            router.refresh();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {hasOwnWorkspace ? (
                    <Button variant="ghost" size="icon" className="h-4 w-4 rounded-sm text-muted-foreground hover:bg-transparent cursor-pointer">
                        <Plus className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors shadow-sm">
                        Create workspace
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Workspace</DialogTitle>
                </DialogHeader>
                {!hasOwnWorkspace && (
                    <div className="bg-blue-50 border border-blue-100/50 text-blue-800 p-4 rounded-md text-sm font-medium">
                        By creating your own workspace you are subscribing to VibeVaults and will start your 14 days trial.
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2 max-w-sm mt-2">
                        <Label htmlFor="workspaceName">Workspace Name</Label>
                        <Input
                            id="workspaceName"
                            placeholder="e.g. My Agency"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!name.trim() || loading} className="cursor-pointer">
                            {loading ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
