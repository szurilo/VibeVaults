'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { Plus, ChevronsUpDown } from 'lucide-react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    const [showNewWorkspaceDialog, setShowNewWorkspaceDialog] = useState(false);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const cookieValue = typeof document !== 'undefined' ? document.cookie
            .split('; ')
            .find(row => row.startsWith('selectedWorkspaceId='))
            ?.split('=')[1] : null;

        if (selectedWorkspaceId && selectedWorkspaceId !== cookieValue) {
            document.cookie = `selectedWorkspaceId=${selectedWorkspaceId}; path=/; max-age=31536000`;
            router.refresh();
        }
    }, [selectedWorkspaceId, router]);

    const handleWorkspaceChange = (workspaceId: string) => {
        document.cookie = `selectedWorkspaceId=${workspaceId}; path=/; max-age=31536000`;
        document.cookie = `selectedProjectId=; path=/; max-age=0`;
        router.refresh();
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            const { createWorkspaceAction } = await import('@/actions/workspaces');
            const newWorkspaceId = await createWorkspaceAction(name.trim());
            document.cookie = `selectedWorkspaceId=${newWorkspaceId}; path=/; max-age=31536000`;
            document.cookie = `selectedProjectId=; path=/; max-age=0`;
            setShowNewWorkspaceDialog(false);
            setName('');
            router.refresh();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!workspaces || workspaces.length === 0) {
        return null;
    }

    const activeWorkspace = workspaces.find(w => w.id === selectedWorkspaceId) || workspaces[0];
    const hasOwnWorkspace = workspaces.some(w => w.owner_id === user.id);

    const ownedWorkspaces = workspaces.filter(w => w.owner_id === user.id);
    const invitedWorkspaces = workspaces.filter(w => w.owner_id !== user.id);

    return (
        <Dialog open={showNewWorkspaceDialog} onOpenChange={setShowNewWorkspaceDialog}>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton size="lg" className="w-full justify-between gap-2 h-auto py-2 cursor-pointer bg-white border border-gray-100 shadow-sm hover:bg-gray-50">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Avatar className="h-8 w-8 rounded-md border border-gray-200 shrink-0">
                                        <AvatarImage src={activeWorkspace?.brand_logo_url} alt={activeWorkspace?.name} className="object-contain" />
                                        <AvatarFallback className="bg-primary/10 text-primary rounded-md">
                                            {activeWorkspace?.name.charAt(0).toUpperCase() || "W"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col items-start text-sm overflow-hidden flex-1">
                                        <span className="truncate font-medium w-full text-left">
                                            {activeWorkspace?.name}
                                        </span>
                                        <span className="truncate text-xs text-gray-500 w-full text-left">
                                            Current Workspace
                                        </span>
                                    </div>
                                </div>
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent className="w-64" align="start" side="bottom" sideOffset={8}>
                            {ownedWorkspaces.length > 0 && (
                                <>
                                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Owned Workspaces
                                    </DropdownMenuLabel>
                                    {ownedWorkspaces.map(w => (
                                        <DropdownMenuItem
                                            key={w.id}
                                            onSelect={() => handleWorkspaceChange(w.id)}
                                            className="cursor-pointer flex items-center gap-2"
                                        >
                                            <Avatar className="h-6 w-6 rounded-md border border-gray-100">
                                                <AvatarImage src={w.brand_logo_url} alt={w.name} className="object-contain" />
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs rounded-md">
                                                    {w.name.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="truncate font-medium">{w.name}</span>
                                        </DropdownMenuItem>
                                    ))}
                                    {invitedWorkspaces.length > 0 && <DropdownMenuSeparator />}
                                </>
                            )}

                            {invitedWorkspaces.length > 0 && (
                                <>
                                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Invited Workspaces
                                    </DropdownMenuLabel>
                                    {invitedWorkspaces.map(w => (
                                        <DropdownMenuItem
                                            key={w.id}
                                            onSelect={() => handleWorkspaceChange(w.id)}
                                            className="cursor-pointer flex items-center gap-2"
                                        >
                                            <Avatar className="h-6 w-6 rounded-md border border-gray-100">
                                                <AvatarImage src={w.brand_logo_url} alt={w.name} className="object-contain" />
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs rounded-md">
                                                    {w.name.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="truncate font-medium">{w.name}</span>
                                        </DropdownMenuItem>
                                    ))}
                                </>
                            )}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={() => setShowNewWorkspaceDialog(true)}
                                className="cursor-pointer flex items-center gap-2 text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Create Workspace</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>

            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Create Workspace</DialogTitle>
                </DialogHeader>
                {!hasOwnWorkspace && (
                    <div className="bg-blue-50 border border-blue-100/50 text-blue-800 p-4 rounded-md text-sm font-medium">
                        By creating your own workspace you are subscribing to VibeVaults and will start your 14 days trial.
                    </div>
                )}
                <form onSubmit={handleCreateSubmit} className="space-y-4">
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
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => setShowNewWorkspaceDialog(false)}
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
