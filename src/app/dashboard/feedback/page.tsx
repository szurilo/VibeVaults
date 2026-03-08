import { createClient } from "@/lib/supabase/server";
import { FeedbackCard } from "@/components/feedback-card";
import { cookies } from "next/headers";
import { AddFeedbackDialog } from "@/components/AddFeedbackDialog";


export default async function FeedbackListPage() {
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

    // Fetch feedbacks, filtering by current project if available
    let feedbacks: any[] = [];
    if (currentProject) {
        const { data } = await supabase
            .from('feedbacks')
            .select('*')
            .eq('project_id', currentProject.id)
            .order('created_at', { ascending: false });
        if (data) feedbacks = data;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Feedbacks {currentProject && (
                        <>
                            <span className="text-gray-400 font-normal">/ {currentProject.name}</span>
                        </>
                    )}
                </h1>
                {currentProject && (
                    <AddFeedbackDialog projectId={currentProject.id} />
                )}
            </div>

            {!currentProject ? (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                    <p className="text-gray-500">Create a project first to view feedback.</p>
                </div>
            ) : feedbacks.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                    <p className="text-gray-500">No feedback received yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
                    {feedbacks.map((item: any) => (
                        <FeedbackCard key={item.id} feedback={item} mode="edit" />
                    ))}
                </div>
            )}
        </div>
    );
}
