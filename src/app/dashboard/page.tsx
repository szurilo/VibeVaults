/**
 * Main Responsibility: Server Component rendering the primary dashboard overview. Retrieves exact metrics 
 * via Server Side Supabase Queries (e.g. feedback counts per project) and controls the display of the 
 * `<Onboarding>` component if the user profile hasn't fully set up their first project.
 * 
 * Sensitive Dependencies: 
 * - @/components/Onboarding for handling project creation flows.
 * - next/headers `cookies()` for reading current state. Modifying state here is critical as mismatched DB foreign keys will error (500).
 */
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Onboarding from "@/components/Onboarding";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";




export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const cookieStore = await cookies();
    let selectedWorkspaceId = cookieStore.get("selectedWorkspaceId")?.value;
    const selectedProjectId = cookieStore.get("selectedProjectId")?.value;

    const { data: workspaces } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: true });

    if (workspaces && workspaces.length > 0) {
        if (!selectedWorkspaceId || !workspaces.some(w => w.id === selectedWorkspaceId)) {
            selectedWorkspaceId = workspaces[0].id;
        }
    }

    let projectsQuery = supabase.from('projects').select('*');
    if (selectedWorkspaceId) {
        projectsQuery = projectsQuery.eq('workspace_id', selectedWorkspaceId);
    }
    const { data: projects } = await projectsQuery;

    // Use selected project or default to the first one
    const currentProject = projects?.find(p => p.id === selectedProjectId) || projects?.[0];

    // Check if the user has completed onboarding
    const { data: profile } = await supabase
        .from('profiles')
        .select('has_onboarded, completed_onboarding_steps')
        .single();

    const hasOnboarded = profile?.has_onboarded ?? false;
    const completedSteps: string[] = profile?.completed_onboarding_steps ?? [];

    // Determine the active workspace
    const activeWorkspace = workspaces?.find(w => w.id === selectedWorkspaceId) || workspaces?.[0];
    const isOwner = activeWorkspace?.owner_id === user?.id;

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
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Overview {currentProject && (
                        <>
                            <span className="text-gray-400 font-normal">/ {currentProject.name}</span>
                        </>
                    )}
                </h1>
            </div>

            {!hasOnboarded && (
                <Onboarding
                    workspaceId={selectedWorkspaceId}
                    isOwner={isOwner}
                    completedSteps={completedSteps}
                    hasProjects={!!(projects && projects.length > 0)}
                />
            )}

            {(hasOnboarded || !!(projects && projects.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Link href="/dashboard/feedback" className="block transition-transform hover:scale-[1.02]">
                        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                    Total Feedback
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold text-foreground">{totalFeedback}</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            )}

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle className="text-lg">Questions or Problems?</CardTitle>
                </CardHeader>
                <CardContent>
                    <h2 className="font-semibold text-sm mb-1">Regarding setup:</h2>
                    <p className="text-muted-foreground mb-6">
                        <a href="https://calendly.com/szurilo/30min" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            Book a free 15-minute setup call with the founder.
                        </a>
                    </p>
                    <h2 className="font-semibold text-sm mb-1">Regarding billing:</h2>
                    <p className="text-muted-foreground mb-6">
                        Send us an email at <a href="mailto:support@vibe-vaults.com" className="text-primary hover:underline">support@vibe-vaults.com</a>
                    </p>
                    <h2 className="font-semibold text-sm mb-1">Regarding other issues:</h2>
                    <p className="text-muted-foreground">
                        Please use the widget in the bottom right corner.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

