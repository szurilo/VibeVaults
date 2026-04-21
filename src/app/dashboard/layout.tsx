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
import { sendWelcomeNotification } from "@/lib/notifications";

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
        { data: initialWorkspaces }
    ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("workspaces").select("*").order("created_at", { ascending: true })
    ]);

    if (!user) {
        // Bounce through the logout route so cookies actually get cleared.
        // A direct signOut() here silently no-ops because Server Components
        // can't write cookies, and the proxy's local JWT decode would then
        // keep redirecting /auth/login back to /dashboard.
        redirect("/api/auth/logout");
    }

    // `initialWorkspaces` is a snapshot taken BEFORE the auto-accept below may add a
    // new membership. `workspaces` is reassigned to a fresh read when that happens,
    // otherwise the sidebar renders "No Workspace" until the user refreshes.
    let workspaces = initialWorkspaces;

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
                    const { error: insertError } = await adminSupabase
                        .from("workspace_members")
                        .insert({
                            workspace_id: invite.workspace_id,
                            user_id: user.id,
                            role: invite.role
                        });

                    if (insertError) {
                        console.error("Failed to accept invite:", insertError);
                        continue; // Don't delete the invite if we couldn't add the member
                    }
                }

                // Track this workspace ID to auto-select it later
                autoSelectedWorkspaceId = invite.workspace_id;

                // Delete invite only after successful member insert (or if already a member)
                await adminSupabase
                    .from("workspace_invites")
                    .delete()
                    .eq("id", invite.id);
            }
        }
    }

    // If we just joined a workspace above, the initial parallel fetch is stale.
    // Re-read via the admin client — NOT the user-scoped one. Reason: Next.js
    // Request Memoization dedupes identical fetch() calls within a single server
    // render, so a second user-scoped `supabase.from("workspaces").select("*")`
    // would reuse the pre-insert response without hitting the DB. The admin
    // client sends a different Authorization header, which changes the memo key
    // and forces a real round-trip. RLS is not the issue here — memoization is.
    if (autoSelectedWorkspaceId) {
        const adminSupabase = createAdminClient();
        const { data: memberships } = await adminSupabase
            .from("workspace_members")
            .select("workspace_id")
            .eq("user_id", user.id);

        if (memberships && memberships.length > 0) {
            const workspaceIds = memberships.map((m) => m.workspace_id);
            const { data: refreshedWorkspaces } = await adminSupabase
                .from("workspaces")
                .select("*")
                .in("id", workspaceIds)
                .order("created_at", { ascending: true });
            workspaces = refreshedWorkspaces;
        }
    }

    // Send welcome email once per user, on first dashboard visit after they own
    // a workspace. Covers both the DB-trigger auto-create path and the manual
    // createWorkspaceAction path. Atomic update (eq welcome_email_sent=false)
    // guards against races from concurrent requests.
    const ownsAnyWorkspace = workspaces?.some(w => w.owner_id === user.id) ?? false;
    if (ownsAnyWorkspace) {
        const { data: claimed } = await supabase
            .from("profiles")
            .update({ welcome_email_sent: true })
            .eq("id", user.id)
            .eq("welcome_email_sent", false)
            .select("id");

        if (claimed && claimed.length > 0) {
            const email = user.email || 'friend';
            const nameStr = email.split('@')[0];
            const formattedName = nameStr.charAt(0).toUpperCase() + nameStr.slice(1);
            sendWelcomeNotification({ to: email, name: formattedName }).catch(e =>
                console.error('Failed to send welcome email:', e)
            );
        }
    }

    // Fetch tier info early — needed both for the sidebar and for picking a
    // sensible default workspace when the user's trial has expired.
    const tierInfo = await getUserTier(user.id);
    const isTrialExpired = !tierInfo.isTrialing && !tierInfo.tier;

    let selectedWorkspaceId = cookieStore.get("selectedWorkspaceId")?.value;

    // Determine which workspace should be active. We honor the cookie whenever
    // it points at a workspace the user is still a member of — including their
    // own paywalled workspaces. The proxy handles the redirect-to-subscribe
    // concern; the layout's job is to render the sidebar consistently with
    // what the user actually chose. When picking a default (no cookie yet),
    // we prefer an invited workspace for expired users so they land somewhere
    // usable on a fresh login instead of on the paywall.
    if (autoSelectedWorkspaceId) {
        selectedWorkspaceId = autoSelectedWorkspaceId;
    } else if (workspaces && workspaces.length > 0) {
        const cookiePointsToValidWorkspace =
            selectedWorkspaceId && workspaces.some(w => w.id === selectedWorkspaceId);
        if (!cookiePointsToValidWorkspace) {
            const invited = workspaces.find(w => w.owner_id !== user.id);
            selectedWorkspaceId = (isTrialExpired && invited ? invited : workspaces[0]).id;
        }
    } else {
        selectedWorkspaceId = undefined;
    }


    // Now fetch projects for the active workspace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
