/**
 * Main Responsibility: Workspace user management — member list, client invites,
 * plus the two exits: a member leaving, and an owner removing a member or
 * revoking a client.
 *
 * Sensitive Dependencies:
 * - This route is deliberately EXCLUDED from the proxy's workspace paywall
 *   (`src/lib/supabase/proxy.ts`), because those exits live here. Gating it
 *   would leave a member unable to leave a workspace that has stopped working.
 *   Instead, a paused workspace renders in a restricted mode: the roster and
 *   both exits stay live, inviting does not (and `POST /api/workspaces/invites`
 *   rejects it server-side regardless).
 */
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { UserManagement } from "@/components/user-management";
import { isOwnerInMembers } from "@/lib/role-helpers";
import { getViewerWorkspaceLiveness, isWorkspaceLive } from "@/lib/tier-helpers";
import { PaywallLockSync } from "@/components/paywall-lock-sync";

export default async function UserSettingsPage() {
    const supabase = await createClient();

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();

    const { data: workspaces } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: true });

    const cookieStore = await cookies();
    let selectedWorkspaceId = cookieStore.get("selectedWorkspaceId")?.value;

    if (workspaces && workspaces.length > 0) {
        if (!selectedWorkspaceId || !workspaces.some(w => w.id === selectedWorkspaceId)) {
            selectedWorkspaceId = workspaces[0].id;
        }
    } else {
        selectedWorkspaceId = undefined;
    }

    if (!selectedWorkspaceId) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-semibold mb-4">Users</h1>
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                    <p className="text-gray-500">No workspace selected.</p>
                </div>
            </div>
        );
    }

    // Fetch the active workspace info
    const { data: workspace } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', selectedWorkspaceId)
        .single();

    const { data: workspaceMembers } = await supabase
        .from('workspace_members')
        .select('role, created_at, user_id')
        .eq('workspace_id', selectedWorkspaceId)
        .order('created_at', { ascending: true });

    // Fetch corresponding profiles for these members using admin client to bypass RLS
    // so team members can see each other's names without exposing profiles to the public
    const memberIds = workspaceMembers?.map(m => m.user_id) || [];
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase = createAdminClient();
    const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', memberIds);

    const members = workspaceMembers?.map(m => ({
        ...m,
        profiles: profiles?.find(p => p.id === m.user_id)
    })) || [];

    const isOwner = isOwnerInMembers(members, user?.id);

    // Is this workspace paused (its owner's plan lapsed)? Drives the restricted
    // mode below, and keeps the sidebar lock in sync on a soft navigation.
    const liveness = await getViewerWorkspaceLiveness(supabase);
    const workspacePaused = !isWorkspaceLive(liveness, selectedWorkspaceId);

    // Fetch all invites for this workspace using admin client
    // so that members (not just owners) can see client invites
    const { data: allInvites } = await adminSupabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', selectedWorkspaceId)
        .order('created_at', { ascending: false });

    // Members see only client invites; owners see everything
    const invites = isOwner
        ? allInvites
        : allInvites?.filter(i => i.role === 'client') || [];

    return (
        <div>
            <PaywallLockSync locked={workspacePaused} />

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Users {workspace && (
                        <>
                            <span className="text-gray-400 font-normal">/ {workspace.name}</span>
                        </>
                    )}
                </h1>
            </div>

            <UserManagement
                workspaceId={selectedWorkspaceId}
                members={members || []}
                invites={invites || []}
                isOwner={isOwner}
                currentUserId={user?.id}
                currentUserEmail={user?.email}
                workspacePaused={workspacePaused}
                ownerEmail={members.find(m => m.role === 'owner')?.profiles?.email ?? null}
            />
        </div>
    );
}
