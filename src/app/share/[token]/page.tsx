import { createAdminClient } from '@/lib/supabase/admin'
import { FeedbackCard } from '@/components/feedback-card'
import Link from 'next/link'
import { Clock, ExternalLink } from 'lucide-react'
import { getWorkspaceOwnerTier } from '@/lib/tier-helpers'

// Define Feedback type for clarity
type Feedback = {
    id: string
    content: string
    created_at: string
    sender: string
    status?: string
}

export default async function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const supabase = createAdminClient()

    // 1. Fetch Project
    const { data: project } = await supabase
        .from('projects')
        .select('id, name, is_sharing_enabled, share_token, workspace_id, website_url')
        .eq('share_token', token)
        .single()

    // Security check: must exist AND be enabled
    if (!project || !project.is_sharing_enabled) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="text-center bg-white p-8 rounded-lg shadow-sm border max-w-md w-full">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <p className="text-gray-600 mb-8">Project not found or sharing is disabled.</p>
                    <Link href="/" className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium bg-primary text-white hover:bg-primary/90 transition-colors w-full">
                        Go to VibeVaults
                    </Link>
                </div>
            </div>
        )
    }

    // Tier check: owner must be on a plan that allows public dashboard
    const { effectiveLimits } = await getWorkspaceOwnerTier(project.workspace_id)
    if (!effectiveLimits.publicDashboard) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="text-center bg-white p-8 rounded-lg shadow-sm border max-w-md w-full">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <p className="text-gray-600 mb-8">Project not found or sharing is disabled.</p>
                    <Link href="/" className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium bg-primary text-white hover:bg-primary/90 transition-colors w-full">
                        Go to VibeVaults
                    </Link>
                </div>
            </div>
        )
    }

    // 2. Fetch Feedback (if project valid)
    const { data: feedbackData } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })

    const feedbacks = (feedbackData || []) as Feedback[]



    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-xl text-gray-900 truncate max-w-[200px] sm:max-w-md">
                            {project.name}
                        </h1>
                        {project.website_url && (
                            <a
                                href={project.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors truncate max-w-[200px]"
                                title={project.website_url}
                            >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate hidden sm:inline">{project.website_url.replace(/^https?:\/\//, '')}</span>
                            </a>
                        )}
                    </div>
                    <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                        Public Board
                    </span>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-3">
                        Feedbacks
                        <span className="text-sm font-normal text-gray-500 bg-white border border-gray-200 px-2.5 py-0.5 rounded-full shadow-sm">
                            {feedbacks.length}
                        </span>
                    </h2>
                </div>

                {feedbacks.length === 0 ? (
                    <div className="bg-white border text-center py-20 px-4 rounded-xl shadow-sm border-dashed">
                        <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No feedback yet</h3>
                        <p className="text-gray-500 max-w-sm mx-auto text-sm">
                            {"This project hasn't received any feedback submissions yet."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {feedbacks.map((f) => (
                            <FeedbackCard key={f.id} feedback={f} mode="view" />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
