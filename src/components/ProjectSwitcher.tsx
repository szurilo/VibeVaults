'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronsUpDown, FolderOpen } from 'lucide-react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';

export default function ProjectSwitcher({
    projects,
    selectedProjectId,
    selectedWorkspaceId
}: {
    projects: any[],
    selectedProjectId?: string,
    selectedWorkspaceId?: string
}) {
    const router = useRouter();
    const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);

    useEffect(() => {
        const cookieValue = typeof document !== 'undefined' ? document.cookie
            .split('; ')
            .find(row => row.startsWith('selectedProjectId='))
            ?.split('=')[1] : null;

        if (selectedProjectId && selectedProjectId !== cookieValue) {
            document.cookie = `selectedProjectId=${selectedProjectId}; path=/; max-age=31536000`;
            router.refresh();
        }
    }, [selectedProjectId, router]);

    const handleProjectChange = (projectId: string) => {
        document.cookie = `selectedProjectId=${projectId}; path=/; max-age=31536000`;
        router.refresh();
    };

    const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton size="lg" className="w-full justify-between gap-2 h-auto py-2 cursor-pointer bg-white border border-gray-100 shadow-sm hover:bg-gray-50">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Avatar className="h-8 w-8 rounded-md border border-gray-200 shrink-0 bg-gray-50 flex items-center justify-center">
                                        <FolderOpen className="w-4 h-4 text-gray-500" />
                                    </Avatar>
                                    <div className="flex flex-col items-start text-sm overflow-hidden flex-1">
                                        <span className="truncate font-medium w-full text-left">
                                            {activeProject ? activeProject.name : 'No projects'}
                                        </span>
                                        <span className="truncate text-xs text-gray-500 w-full text-left">
                                            Current Project
                                        </span>
                                    </div>
                                </div>
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent className="w-64" align="start" side="bottom" sideOffset={8}>
                            {projects.length > 0 && (
                                <>
                                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Your Projects
                                    </DropdownMenuLabel>
                                    {projects.map((project) => (
                                        <DropdownMenuItem
                                            key={project.id}
                                            onSelect={() => handleProjectChange(project.id)}
                                            className="cursor-pointer flex items-center gap-2"
                                        >
                                            <Avatar className="h-6 w-6 rounded-md border border-gray-100 bg-gray-50 flex shrink-0 items-center justify-center">
                                                <FolderOpen className="w-3 h-3 text-gray-500" />
                                            </Avatar>
                                            <span className="truncate font-medium">{project.name}</span>
                                        </DropdownMenuItem>
                                    ))}
                                </>
                            )}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={() => setShowNewProjectDialog(true)}
                                className="cursor-pointer flex items-center gap-2 text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Create Project</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>

            <CreateProjectDialog
                open={showNewProjectDialog}
                onOpenChange={setShowNewProjectDialog}
                workspaceId={selectedWorkspaceId}
            />
        </>
    );
}

