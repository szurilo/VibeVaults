"use client"

import Link from "next/link"
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher"
import ProjectSwitcher from "@/components/ProjectSwitcher"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LayoutDashboard, MessageSquare, Settings, LogOut, Users, ExternalLink } from "lucide-react"
import { NotificationBell } from "@/components/NotificationBell"
import { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AppSidebar({
    workspaces,
    selectedWorkspaceId,
    projects,
    selectedProjectId,
    user,
}: {
    workspaces: any[]
    selectedWorkspaceId?: string
    projects: any[]
    selectedProjectId?: string
    user: User
}) {
    const router = useRouter();
    const pathname = usePathname();

    const logout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/auth/login");
    };

    const activeWorkspace = workspaces?.find(w => w.id === selectedWorkspaceId) || workspaces?.[0];
    const activeProject = projects?.find(p => p.id === selectedProjectId) || projects?.[0];
    const isOwner = activeWorkspace?.owner_id === user.id;
    const isSubscribePage = pathname === "/dashboard/subscribe";

    return (
        <Sidebar>
            <SidebarHeader className="bg-white border-b border-gray-100 p-4">
                <div className="flex items-center justify-between px-2">
                    <span className={`font-bold text-xl text-primary ${isSubscribePage ? "opacity-50" : ""}`}>
                        {isSubscribePage ? (
                            "VibeVaults"
                        ) : (
                            <Link href="/dashboard" className="cursor-pointer block">
                                VibeVaults
                            </Link>
                        )}
                    </span>
                    {!isSubscribePage && <NotificationBell userId={user.id} />}
                </div>
            </SidebarHeader>

            <SidebarContent className={`bg-white px-2 py-4 gap-6 ${isSubscribePage ? "pointer-events-none opacity-50" : ""}`}>
                {/* Workspace Group */}
                <div className="flex flex-col gap-2">
                    <div className="px-2">
                        <WorkspaceSwitcher
                            workspaces={workspaces || []}
                            selectedWorkspaceId={selectedWorkspaceId}
                            user={user}
                        />
                    </div>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname === "/dashboard/settings/users"}>
                                <Link href="/dashboard/settings/users" className="font-medium flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>Users</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        {isOwner && (
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname === "/dashboard/settings"}>
                                    <Link href="/dashboard/settings" className="font-medium flex items-center gap-2">
                                        <Settings className="w-4 h-4" />
                                        <span>Settings</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </div>

                {/* Projects Group */}
                <div className="flex flex-col gap-2">
                    <div className="px-2">
                        <ProjectSwitcher
                            projects={projects || []}
                            selectedProjectId={selectedProjectId}
                            selectedWorkspaceId={selectedWorkspaceId}
                        />
                    </div>
                    {activeProject?.website_url && (
                        <a
                            href={activeProject.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-1 text-xs text-muted-foreground hover:text-primary transition-colors truncate"
                            title={activeProject.website_url}
                        >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{activeProject.website_url.replace(/^https?:\/\//, '')}</span>
                        </a>
                    )}
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname === "/dashboard"}>
                                <Link href="/dashboard" className="font-medium flex items-center gap-2">
                                    <LayoutDashboard className="w-4 h-4" />
                                    <span>Overview</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>

                        <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname === "/dashboard/feedback"}>
                                <Link href="/dashboard/feedback" className="font-medium flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    <span>Feedback</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>

                        <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname === "/dashboard/project-settings"}>
                                <Link href="/dashboard/project-settings" className="font-medium flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    <span>Project Settings</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>
            </SidebarContent>

            <SidebarFooter className="bg-white border-t border-gray-100 p-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="w-full justify-start gap-2 h-auto py-2 cursor-pointer">
                            <Avatar className="h-8 w-8 rounded-full border border-gray-200">
                                <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.full_name || "User avatar"} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                    {(user.user_metadata?.full_name || user.email || "?").charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start text-sm overflow-hidden flex-1">
                                <span className="truncate font-medium w-full text-left">
                                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                                </span>
                                <span className="truncate text-xs text-gray-500 w-full text-left">
                                    {user.email}
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" side="right" sideOffset={8}>
                        <DropdownMenuLabel className="font-normal flex flex-col items-start gap-1 p-2">
                            <span className="truncate font-medium w-full">
                                {user.user_metadata?.full_name || user.email?.split('@')[0]}
                            </span>
                            <span className="truncate text-xs text-gray-500 w-full">
                                {user.email}
                            </span>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/account" className="cursor-pointer flex w-full items-center gap-2">
                                <Settings className="w-4 h-4" />
                                <span>Account</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 flex items-center gap-2">
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
