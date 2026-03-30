/**
 * Main Responsibility: Wraps the entire dashboard architecture. Fetches and validates the user's active 
 * workspaces and projects based on stored cookies, processes pending email invitations, and provisions 
 * context providers (Notifications, Sidebar).
 * 
 * Sensitive Dependencies: 
 * - next/headers (cookies) for retrieving and managing selected states (`selectedWorkspaceId`).
 * - @/lib/supabase/server for sensitive data interactions and RLS enforcement.
 * - GlobalNotificationProvider for real-time app-wide notifications.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalNotificationProvider } from "@/components/global-notification-provider";
import { getUserTier } from "@/lib/tier-helpers";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const cookieStore = await cookies();

    // Parallelize user and workspace fetching
    const [
        { data: { user } },
        { data: workspaces }
    ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("workspaces").select("*").order("created_at", { ascending: true })
    ]);

    if (!user) {
        redirect("/auth/login");
    }

    // Auto-accept pending member workspace invites for this email.
    let autoSelectedWorkspaceId: string | undefined;
    if (user.email) {
        const adminSupabase = createAdminClient();
        const { data: myInvites } = await adminSupabase
            .from("workspace_invites")
            .select("*")
            .eq("email", user.email)
            .neq("role", "client");

        if (myInvites && myInvites.length > 0) {
            for (const invite of myInvites) {
                // Check if already a member just in case
                const { data: existing } = await adminSupabase
                    .from("workspace_members")
                    .select("role")
                    .eq("workspace_id", invite.workspace_id)
                    .eq("user_id", user.id)
                    .single();

                if (!existing) {
                    await adminSupabase
                        .from("workspace_members")
                        .insert({
                            workspace_id: invite.workspace_id,
                            user_id: user.id,
                            role: invite.role
                        });
                }

                // Track this workspace ID to auto-select it later
                autoSelectedWorkspaceId = invite.workspace_id;

                // Delete invite
                await adminSupabase
                    .from("workspace_invites")
                    .delete()
                    .eq("id", invite.id);
            }
        }
    }

    let selectedWorkspaceId = cookieStore.get("selectedWorkspaceId")?.value;

    // Determine which workspace should be active
    if (autoSelectedWorkspaceId) {
        selectedWorkspaceId = autoSelectedWorkspaceId;
    } else if (workspaces && workspaces.length > 0) {
        if (!selectedWorkspaceId || !workspaces.some(w => w.id === selectedWorkspaceId)) {
            selectedWorkspaceId = workspaces[0].id;
        }
    } else {
        selectedWorkspaceId = undefined;
    }


    // Now fetch projects for the active workspace
    let projects: any[] | null = null;
    if (selectedWorkspaceId) {
        const { data } = await supabase
            .from("projects")
            .select("*")
            .eq("workspace_id", selectedWorkspaceId)
            .order("created_at", { ascending: true });
        projects = data;
    }

    let selectedProjectId = cookieStore.get("selectedProjectId")?.value;

    // If no selected project in cookie, or project no longer exists in this workspace, default to the first one
    if (projects && projects.length > 0) {
        if (!selectedProjectId || !projects.some(p => p.id === selectedProjectId)) {
            selectedProjectId = projects[0].id;
        }
    } else {
        // Clear stale project selection if workspace has no projects
        selectedProjectId = undefined;
    }



    const cookie = cookieStore.get("sidebar_state");
    const defaultOpen = cookie ? cookie.value === "true" : true;

    // Fetch tier info for sidebar display
    const tierInfo = await getUserTier(user.id);

    return (
        <GlobalNotificationProvider userId={user.id}>
            <SidebarProvider defaultOpen={defaultOpen}>
                <AppSidebar
                    workspaces={workspaces || []}
                    selectedWorkspaceId={selectedWorkspaceId}
                    projects={projects || []}
                    selectedProjectId={selectedProjectId}
                    user={user}
                    tierInfo={{ tier: tierInfo.tier, isTrialing: tierInfo.isTrialing }}
                />
                <main className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
                    <div className="p-4 bg-white border-b border-gray-200 md:hidden flex items-center gap-2">
                        <SidebarTrigger />
                        <span className="font-bold text-lg text-primary">VibeVaults</span>
                    </div>
                    {/* On desktop we might want the trigger or just rely on the sidebar state? 
                        Usually the sidebar remains open on desktop. 
                        Let's just put the trigger for mobile usage primarily, as requested.
                    */}
                    <div className="p-8">
                        {children}
                    </div>
                </main>
            </SidebarProvider>
        </GlobalNotificationProvider>
    );
}
