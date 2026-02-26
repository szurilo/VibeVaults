"use client"

import Link from "next/link"
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
import { LayoutDashboard, MessageSquare, Settings, LogOut } from "lucide-react"
import { NotificationBell } from "@/components/NotificationBell"

export function AppSidebar({
    projects,
    selectedProjectId,
    userId,
}: {
    projects: any[]
    selectedProjectId?: string
    userId: string
}) {
    const router = useRouter();
    const pathname = usePathname();

    const logout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/auth/login");
    };

    return (
        <Sidebar>
            <SidebarHeader className="bg-white border-b border-gray-100 p-4">
                <div className="flex items-center justify-between mb-4 px-2">
                    <Link href="/dashboard" className="cursor-pointer block">
                        <span className="font-bold text-xl text-primary">VibeVaults</span>
                    </Link>
                    <NotificationBell userId={userId} />
                </div>
                <ProjectSwitcher
                    projects={projects || []}
                    selectedProjectId={selectedProjectId}
                />
            </SidebarHeader>

            <SidebarContent className="bg-white px-2 py-4 gap-1">
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
                        <SidebarMenuButton asChild isActive={pathname === "/dashboard/settings"}>
                            <Link href="/dashboard/settings" className="font-medium flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                <span>Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter className="bg-white border-t border-gray-100 p-4">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <button onClick={logout} className="font-medium flex items-center gap-2 cursor-pointer">
                                <LogOut className="w-4 h-4" />
                                <span>Sign Out</span>
                            </button>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
