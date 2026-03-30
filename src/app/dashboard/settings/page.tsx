import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { WorkspaceSettingsCard } from "@/components/workspace-settings-card";
import { DeleteWorkspaceCard } from "@/components/delete-workspace-card";
import { Highlight } from "@/components/highlight";

export default async function WorkspaceSettingsPage() {
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
                <h1 className="text-2xl font-semibold mb-4">Workspace Settings</h1>
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
        .select('role, user_id')
        .eq('workspace_id', selectedWorkspaceId)
        .order('created_at', { ascending: true });

    // Determine if the current user is an owner of this workspace
    const isOwner = workspaceMembers?.some(m => m.user_id === user?.id && m.role === 'owner') || false;

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Workspace Settings {workspace && (
                        <>
                            <span className="text-gray-400 font-normal">/ {workspace.name}</span>
                        </>
                    )}
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full space-y-6">
                    {workspace && isOwner ? (
                        <>
                            <Highlight id="workspace-settings" className="rounded-xl">
                                <WorkspaceSettingsCard workspace={workspace} />
                            </Highlight>
                            <DeleteWorkspaceCard workspace={workspace} />
                        </>
                    ) : workspace ? (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                            <p className="text-gray-500">Only workspace owners can manage settings.</p>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
