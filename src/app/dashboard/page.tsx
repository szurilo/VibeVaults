import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Onboarding from "@/components/Onboarding";

export default async function DashboardPage() {
    const session = await getSession();

    if (!session || !session.user) {
        redirect("/login");
    }

    const supabase = await createClient();

    // Fetch all projects for the user
    const { data: projects } = await supabase
        .from('projects')
        .select('*');

    const cookieStore = await cookies();
    const selectedProjectId = cookieStore.get("selectedProjectId")?.value;

    // Use selected project or default to the first one
    const currentProject = projects?.find(p => p.id === selectedProjectId) || projects?.[0];

    // If no projects exist, show onboarding
    if (!projects || projects.length === 0) {
        return (
            <div>
                <h1 className="text-2xl font-semibold mb-8 text-gray-900">Overview</h1>
                <Onboarding />
            </div>
        );
    }

    // RLS policies ensure we only count feedback for the user's projects
    // But we filter by project_id if one is selected
    let query = supabase
        .from('feedbacks')
        .select('*', { count: 'exact', head: true });

    if (currentProject) {
        query = query.eq('project_id', currentProject.id);
    }

    const { count } = await query;
    const totalFeedback = count || 0;

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900">
                    Overview {currentProject && <span className="text-gray-400 font-normal">/ {currentProject.name}</span>}
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Total Feedback</h3>
                    <p className="text-3xl font-bold text-gray-900">{totalFeedback}</p>
                </div>
            </div>

            {currentProject && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mt-8">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900">Get Started</h2>
                    <p className="text-gray-500 mb-6">
                        Embed the widget on your site just before the closing &lt;/body&gt; tag to start collecting feedback for <strong>{currentProject.name}</strong>.
                    </p>
                    <div className="bg-gray-50 p-4 rounded-md font-mono text-sm text-gray-800 break-all">
                        &lt;script src="https://vibe-vaults.com/widget.js" data-key="{currentProject.api_key}"&gt;&lt;/script&gt;
                    </div>
                </div>
            )}
        </div>
    );
}

