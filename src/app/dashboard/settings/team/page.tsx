import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { TeamManagementClient } from "@/components/TeamManagementClient";
import { DeleteWorkspaceCard } from "@/components/DeleteWorkspaceCard";

export default async function TeamSettingsPage() {
    const supabase = await createClient();

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();

    const { data: workspaces } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

    const cookieStore = await cookies();
    let selectedWorkspaceId = cookieStore.get("selectedWorkspaceId")?.value;

    if (workspaces && workspaces.length > 0) {
        if (!selectedWorkspaceId || !workspaces.some(w => w.id === selectedWorkspaceId)) {
            selectedWorkspaceId = workspaces[0].id;
        }
    }

    if (!selectedWorkspaceId) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-semibold mb-4">Team Management</h1>
                <p>No workspace selected.</p>
                <div className="mt-4 p-4 bg-gray-100 rounded text-sm font-mono overflow-auto">
                    <p>Debug Info:</p>
                    <p>User ID: {user?.id || 'none'}</p>
                    <p>Workspaces count: {workspaces?.length || 0}</p>
                    <p>Cookie Workspace ID: {cookieStore.get("selectedWorkspaceId")?.value || 'none'}</p>
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

    // Fetch corresponding profiles for these members
    const memberIds = workspaceMembers?.map(m => m.user_id) || [];
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', memberIds);

    const members = workspaceMembers?.map(m => ({
        ...m,
        profiles: profiles?.find(p => p.id === m.user_id)
    })) || [];

    // Fetch all pending invites for this workspace
    const { data: invites } = await supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', selectedWorkspaceId)
        .order('created_at', { ascending: false });

    // Determine if the current user is an owner of this workspace
    const isOwner = members?.some(m => m.user_id === user?.id && m.role === 'owner') || false;

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Team Members {workspace && (
                        <>
                            <span className="text-gray-400 font-normal">/ {workspace.name}</span>
                        </>
                    )}
                </h1>
            </div>

            <TeamManagementClient
                workspaceId={selectedWorkspaceId}
                members={members || []}
                invites={invites || []}
                isOwner={isOwner}
            />

            {isOwner && workspace && (
                <div className="mt-12">
                    <DeleteWorkspaceCard workspace={workspace} />
                </div>
            )}
        </div>
    );
}
