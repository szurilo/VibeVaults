import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FeedbackCard } from "@/components/feedback-card";
import { cookies } from "next/headers";

export default async function FeedbackListPage() {
    const supabase = await createClient();

    // Fetch projects for the user
    const { data: projects } = await supabase
        .from('projects')
        .select('*');

    const cookieStore = await cookies();
    const selectedProjectId = cookieStore.get("selectedProjectId")?.value;

    // Use selected project or default to the first one
    const currentProject = projects?.find(p => p.id === selectedProjectId) || projects?.[0];

    // Fetch feedbacks, filtering by current project if available
    let query = supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

    if (currentProject) {
        query = query.eq('project_id', currentProject.id);
    }

    const { data: feedbacks } = await query;

    if (!feedbacks) {
        // Handle error gracefully or redirect
        return <div>Error loading feedback</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900">
                    Feedbacks {currentProject && <span className="text-gray-400 font-normal">/ {currentProject.name}</span>}
                </h1>
            </div>

            {feedbacks.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                    <p className="text-gray-500">No feedback received yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {feedbacks.map((item: any) => (
                        <FeedbackCard key={item.id} feedback={item} mode="edit" />
                    ))}
                </div>
            )}
        </div>
    );
}
