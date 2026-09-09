"use client"

import Link from "next/link"
import WorkspaceSwitcher from "@/components/workspace-switcher"
import ProjectSwitcher from "@/components/project-switcher"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LayoutDashboard, MessageSquare, Settings, LogOut, Users, ExternalLink, Crown, Loader2 } from "lucide-react"
import { isTrialExpired as isTierExpired, type TierSlug } from "@/lib/tier-config"
import { NotificationBell } from "@/components/notification-bell"
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

interface Workspace {
    id: string;
    name: string;
    owner_id: string;
    brand_logo_url?: string | null;
}

interface Project {
    id: string;
    name: string;
    website_url?: string | null;
}

export function AppSidebar({
    workspaces,
    selectedWorkspaceId,
    projects,
    selectedProjectId,
    user,
    tierInfo,
    lockedWorkspaceIds = [],
}: {
    workspaces: Workspace[]
    selectedWorkspaceId?: string
    projects: Project[]
    selectedProjectId?: string
    user: User
    tierInfo?: { tier: TierSlug | null; isTrialing: boolean; trialStarted: boolean }
    /** Workspaces whose OWNER has no active access — locked for every member. */
    lockedWorkspaceIds?: string[]
}) {
    const pathname = usePathname();
    const [isSigningOut, setIsSigningOut] = useState(false);

    // Sign-out must end in a HARD navigation to /api/auth/logout, never a
    // router.push. The browser client clears the auth cookie via document.cookie,
    // but a soft navigation's RSC request can still carry the old cookie — the
    // proxy then decodes the JWT locally and bounces /auth/login back to
    // /dashboard, so the click appears to do nothing. The route handler clears
    // the cookies server-side (Set-Cookie) and 303s to the login page, which no
    // client-side race can undo. Same reasoning as dashboard/layout.tsx.
    const logout = async () => {
        if (isSigningOut) return;
        setIsSigningOut(true);
        try {
            // Global scope so the refresh token is revoked server-side too.
            // Failures here (offline, already-expired session) must not strand
            // the user on the dashboard — the redirect below clears cookies
            // regardless.
            await createClient().auth.signOut();
        } catch {
            // Intentionally ignored; see above.
        }
        window.location.href = "/api/auth/logout";
    };

    const activeWorkspace = workspaces?.find(w => w.id === selectedWorkspaceId) || workspaces?.[0];
    const activeProject = projects?.find(p => p.id === selectedProjectId) || projects?.[0];
    const isOwner = activeWorkspace?.owner_id === user.id;

    // The lock is a property of the WORKSPACE, not of the viewer: a workspace is
    // usable only while its owner pays, so a member of a lapsed owner is locked
    // out exactly like the owner is. `lockedWorkspaceIds` is resolved server-side
    // in dashboard/layout.tsx (the owner's billing row is invisible to members
    // under RLS, so it cannot be derived here).
    const lockedIds = new Set(lockedWorkspaceIds);
    const lockSidebar = !!activeWorkspace && lockedIds.has(activeWorkspace.id);

    // The viewer's OWN expiry, used for the tier badge and its CTA (which
    // describe this user's billing, not the active workspace's state) and for
    // the Create Workspace control.
    const isTrialExpired = !!tierInfo && isTierExpired(tierInfo);

    // Creating a workspace is gated on the VIEWER's own billing, never on the
    // active workspace's. The distinction matters: a member locked out of
    // someone else's lapsed workspace needs Create Workspace as their escape
    // hatch — it is how they start their own trial. `trialStarted` separates
    // "my trial ran out" (lock it, a new workspace would be born locked) from
    // "I never had one" (must stay open), because isTrialExpired() is also true
    // for an invited member who has never owned anything.
    const lockCreateWorkspace = isTrialExpired && !!tierInfo?.trialStarted;

    // While viewing someone ELSE's paused workspace, hide the viewer's own tier
    // badge and its Subscribe/Upgrade CTA. Not merely to reduce clutter: a
    // Subscribe button sitting in the sidebar next to "this workspace is
    // paused" reads as "pay to unlock this workspace", and the viewer's
    // subscription cannot unlock a workspace somebody else owns. A member
    // acting on it would be charged and see nothing change.
    //
    // Their own billing is one workspace-switch away, and the switcher stays
    // clickable precisely so that route is always open.
    const viewingLockedForeignWorkspace = lockSidebar && !isOwner;

    // Derive tier display label. "Expired" falls through for owners whose
    // trial ran out without subscribing — they should still see the badge
    // and a Subscribe link even while their own workspace is locked.
    const tierLabel = tierInfo?.isTrialing
        ? 'Trial'
        : tierInfo?.tier
            ? tierInfo.tier.charAt(0).toUpperCase() + tierInfo.tier.slice(1)
            : tierInfo?.trialStarted ? 'Expired' : null;

    return (
        <Sidebar>
            <SidebarHeader className="bg-white border-b border-gray-100 p-4">
                <div className="flex items-center justify-between px-2">
                    <span className={`font-bold text-xl text-primary ${lockSidebar ? "opacity-50" : ""}`}>
                        {lockSidebar ? (
                            "VibeVaults"
                        ) : (
                            <Link href="/dashboard" className="cursor-pointer block">
                                VibeVaults
                            </Link>
                        )}
                    </span>
                    {!lockSidebar && <NotificationBell userId={user.id} />}
                </div>
            </SidebarHeader>

            <SidebarContent className="bg-white px-2 py-4 gap-6">
                {/* Workspace Group. Two items deliberately stay interactive while
                    the rest of the sidebar is locked, because both are exits:
                      - the switcher, so a user on a paywalled workspace can
                        always navigate to another one;
                      - Users, which hosts the only way for a member to LEAVE a
                        workspace and for an owner to remove a member or revoke a
                        client. That route is excluded from the proxy paywall for
                        the same reason (see src/lib/supabase/proxy.ts), and the
                        sidebar is where people look for it — linking it only
                        from the paywall pages hid it where nobody searches.
                    Anything dimmed carries data-locked="true", which is what the
                    specs assert against rather than Tailwind class strings. */}
                <div className="flex flex-col gap-2">
                    <div className="px-2">
                        <WorkspaceSwitcher
                            workspaces={workspaces || []}
                            selectedWorkspaceId={selectedWorkspaceId}
                            user={user}
                            lockedWorkspaceIds={lockedWorkspaceIds}
                            lockCreateWorkspace={lockCreateWorkspace}
                            trialStarted={!!tierInfo?.trialStarted}
                        />
                    </div>
                    <SidebarMenu>
                        {/* Never dimmed — see the note above. */}
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname === "/dashboard/settings/users"}>
                                <Link href="/dashboard/settings/users" className="font-medium flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>Users</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        {isOwner && (
                            <SidebarMenuItem
                                data-locked={lockSidebar ? "true" : undefined}
                                className={lockSidebar ? "pointer-events-none opacity-50" : ""}
                            >
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
                {selectedWorkspaceId && (
                <div
                    data-locked={lockSidebar ? "true" : undefined}
                    className={`flex flex-col gap-2 ${lockSidebar ? "pointer-events-none opacity-50" : ""}`}
                >
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
                )}
            </SidebarContent>

            <SidebarFooter className="bg-white border-t border-gray-100 p-4">
                {tierLabel && !viewingLockedForeignWorkspace && (
                    <div className="flex items-center justify-between px-2 pb-3">
                        <div className="flex items-center gap-1.5">
                            <Crown className={`w-3.5 h-3.5 ${isTrialExpired ? "text-red-500" : "text-amber-500"}`} />
                            <span className={`text-xs font-semibold ${isTrialExpired ? "text-red-600" : "text-gray-600"}`}>
                                {tierLabel}{tierInfo?.isTrialing ? ' (Pro)' : ''}
                            </span>
                        </div>
                        {(tierInfo?.tier !== 'business') && (
                            <Link href="/dashboard/subscribe" className="text-xs font-semibold text-primary hover:underline">
                                {tierInfo?.tier ? 'Upgrade' : 'Subscribe'}
                            </Link>
                        )}
                    </div>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="w-full justify-start gap-2 h-auto py-2 cursor-pointer">
                            <Avatar className="h-8 w-8 rounded-full border border-gray-200">
                                <AvatarImage src={user.user_metadata?.avatar_url || user.user_metadata?.picture} alt={user.user_metadata?.full_name || "User avatar"} />
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
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56" align="end" side="top" sideOffset={8}>
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
                        <DropdownMenuItem
                            onSelect={(e) => {
                                // Keep the menu mounted while the async sign-out
                                // runs so the pending label stays visible.
                                e.preventDefault();
                                logout();
                            }}
                            disabled={isSigningOut}
                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 flex items-center gap-2"
                        >
                            {isSigningOut
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <LogOut className="w-4 h-4" />}
                            <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
