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
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function AppSidebar({
    projects,
    selectedProjectId,
}: {
    projects: any[]
    selectedProjectId?: string
}) {
    const router = useRouter();

    const logout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/auth/login");
    };

    return (
        <Sidebar>
            <SidebarHeader className="bg-white border-b border-gray-100 p-4">
                <Link href="/dashboard" className="px-2 cursor-pointer mb-4 block">
                    <span className="font-bold text-xl text-primary">VibeVaults</span>
                </Link>
                <ProjectSwitcher
                    projects={projects || []}
                    selectedProjectId={selectedProjectId}
                />
            </SidebarHeader>

            <SidebarContent className="bg-white px-2 py-4 gap-1">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href="/dashboard" className="font-medium text-gray-600">
                                <span>Overview</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href="/dashboard/feedback" className="font-medium text-gray-600">
                                <span>Feedback</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href="/dashboard/settings" className="font-medium text-gray-600">
                                <span>Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter className="bg-white border-t border-gray-100 p-4">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={logout} className="w-full font-medium text-gray-600 justify-start">
                            <span>Sign Out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
