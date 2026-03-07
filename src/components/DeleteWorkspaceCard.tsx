'use client';

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DangerZoneCard } from "@/components/DangerZoneCard";

interface DeleteWorkspaceCardProps {
    workspace: {
        id: string;
        name: string;
    };
}

export function DeleteWorkspaceCard({ workspace }: DeleteWorkspaceCardProps) {
    const router = useRouter();
    const supabase = createClient();

    const handleDeleteWorkspace = async () => {
        if (!workspace) return;

        const { error } = await supabase
            .from('workspaces')
            .delete()
            .eq('id', workspace.id);

        if (error) throw error;

        document.cookie = 'selectedWorkspaceId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'selectedProjectId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        router.push("/dashboard");
        router.refresh();
    };

    return (
        <DangerZoneCard
            entityName="Workspace"
            description={<>Permanently delete <span className="font-semibold text-gray-700">{workspace.name}</span>, all its projects, and all the feedbacks within those projects.</>}
            dialogTitle={`Delete workspace "${workspace.name}"?`}
            dialogDescription="This action cannot be undone. This will permanently delete your workspace, all projects contained within it, and all feedback inside those projects."
            onDelete={handleDeleteWorkspace}
            className="mt-8"
        />
    );
}
