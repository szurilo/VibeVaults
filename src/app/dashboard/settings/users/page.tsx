import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { UserManagementClient } from "@/components/UserManagementClient";

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
    let selectedProjectId = cookieStore.get("selectedProjectId")?.value;

    if (workspaces && workspaces.length > 0) {
        if (!selectedWorkspaceId || !workspaces.some(w => w.id === selectedWorkspaceId)) {
            selectedWorkspaceId = workspaces[0].id;
        }
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

    // Determine if the current user is an owner of this workspace
    const isOwner = members?.some(m => m.user_id === user?.id && m.role === 'owner') || false;

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

    // Fetch all projects for this workspace to allow sending targeted client invites
    const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', selectedWorkspaceId)
        .order('created_at', { ascending: true });

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Users {workspace && (
                        <>
                            <span className="text-gray-400 font-normal">/ {workspace.name}</span>
                        </>
                    )}
                </h1>
            </div>

            <UserManagementClient
                workspaceId={selectedWorkspaceId}
                members={members || []}
                invites={invites || []}
                projects={projects || []}
                isOwner={isOwner}
                currentUserId={user?.id}
                selectedProjectId={selectedProjectId}
            />
        </div>
    );
}
