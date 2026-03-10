/**
 * Main Responsibility: Centralized page for managing project-specific settings within a selected workspace.
 * Responsible for displaying current active project metadata, email preferences, widget embeds, and destructive actions.
 * 
 * Sensitive Dependencies: 
 * - Next.js Headers (cookies) to persist state identifying `selectedWorkspaceId` and `selectedProjectId`.
 * - Supabase Admin Client (@/lib/supabase/admin) for fetching sensitive email preferences detached from public profiles.
 * - Project Cards components mapping individual update requests (Edit/Share/Delete).
 */
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { DeleteProjectCard } from "@/components/DeleteProjectCard";
import { EditProjectCard } from "@/components/EditProjectCard";

import { ShareProjectCard } from "@/components/ShareProjectCard";
import { EmbedWidgetCard } from "@/components/EmbedWidgetCard";
import { AnchorHighlight } from "@/components/AnchorHighlight";


export default async function SettingsPage() {
    const supabase = await createClient();

    const cookieStore = await cookies();
    const selectedWorkspaceId = cookieStore.get("selectedWorkspaceId")?.value;
    const selectedProjectId = cookieStore.get("selectedProjectId")?.value;

    let projectsQuery = supabase.from('projects').select('*');
    if (selectedWorkspaceId) {
        projectsQuery = projectsQuery.eq('workspace_id', selectedWorkspaceId).order('created_at', { ascending: true });
    }
    const { data: projects } = await projectsQuery;

    // Use selected project or default to the first one
    const currentProject = projects?.find(p => p.id === selectedProjectId) || projects?.[0];

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Project Settings {currentProject && (
                        <>
                            <span className="text-gray-400 font-normal">/ {currentProject.name}</span>
                        </>
                    )}
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full space-y-6">
                    {currentProject ? (
                        <>
                            <AnchorHighlight id="edit-project" className="rounded-xl">
                                <EditProjectCard project={currentProject} />
                            </AnchorHighlight>
                            <AnchorHighlight id="embed-widget" className="rounded-xl">
                                <EmbedWidgetCard project={currentProject} />
                            </AnchorHighlight>
                            <AnchorHighlight id="share-board" className="rounded-xl">
                                <ShareProjectCard project={currentProject} />
                            </AnchorHighlight>
                            <DeleteProjectCard project={currentProject} />
                        </>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                            <p className="text-gray-500">Create a project first to manage settings.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
