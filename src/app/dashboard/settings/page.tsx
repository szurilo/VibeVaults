import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { EditProjectCard } from "@/components/EditProjectCard";
import { ProjectModeCard } from "@/components/ProjectModeCard";
import { ShareProjectCard } from "@/components/ShareProjectCard";
import { EmbedWidgetCard } from "@/components/EmbedWidgetCard";
import { ProjectModeBadge } from "@/components/ProjectModeBadge";

export default async function SettingsPage() {
    const supabase = await createClient();

    // Fetch all projects to find selected
    const { data: projects } = await supabase
        .from('projects')
        .select('*');

    const cookieStore = await cookies();
    const selectedProjectId = cookieStore.get("selectedProjectId")?.value;

    // Use selected project or default to the first one
    const currentProject = projects?.find(p => p.id === selectedProjectId) || projects?.[0];

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Settings {currentProject && (
                        <>
                            <span className="text-gray-400 font-normal">/ {currentProject.name}</span>
                            <ProjectModeBadge mode={currentProject.mode} className="text-[10px] px-2 py-0.5 translate-y-0.5" />
                        </>
                    )}
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full space-y-6">
                    {currentProject && (
                        <>
                            <EditProjectCard project={currentProject} />
                            <ProjectModeCard project={currentProject} />
                            <EmbedWidgetCard project={currentProject} />
                            <ShareProjectCard project={currentProject} />
                        </>
                    )}

                    <DeleteAccountCard project={currentProject} />
                </div>
            </div>
        </div>
    );
}
