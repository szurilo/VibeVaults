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

export function AppSidebar({
    projects,
    selectedProjectId,
}: {
    projects: any[]
    selectedProjectId?: string
}) {
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
                        <form action="/api/auth/signout" method="POST" className="w-full">
                            <SidebarMenuButton type="submit" className="w-full font-medium text-gray-600 justify-start">
                                <span>Sign Out</span>
                            </SidebarMenuButton>
                        </form>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
