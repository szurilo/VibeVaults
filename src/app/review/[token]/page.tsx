/**
 * Main Responsibility: Public hosted entry point for the shareable review
 * link (`/review/<projects.review_token>`). Shows the guest identity gate on
 * OUR domain, so the link works (or fails with a helpful page) regardless of
 * the state of the customer's site — the two failure modes this exists for
 * are a missing widget embed and a stale embed API key.
 *
 * The gate is a plain server-rendered form that POSTs to
 * /api/review/redeem — deliberately no client-side submit handler. Guests
 * arrive on unknown devices and connections, and a click that lands before
 * React hydrates would native-submit and silently reload the page. With a
 * real form + a 303 from the route handler, the flow works with no client JS
 * at all.
 *
 * Sensitive Dependencies:
 * - Supabase Admin Client: anonymous visitors, the unguessable review token
 *   is the credential; RLS does not apply.
 * - checkOwnerAccess: a lapsed owner's projects must not accept new guests.
 * - projects.widget_last_seen_at: null means the widget never loaded on the
 *   site, so the gate is replaced by a "not set up yet" notice.
 * - /api/review/redeem: the form target; its `?error=` codes are rendered
 *   here (ERROR_MESSAGES).
 * - Excluded from the auth gate in src/lib/supabase/proxy.ts (`/review`).
 */
import { SiteHeader } from '@/components/landing/site-header';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkOwnerAccess } from '@/lib/widget-helpers';

export const metadata = {
    title: 'Leave feedback — VibeVaults',
    description: 'Review a website and leave pinned feedback.',
};

const ERROR_MESSAGES: Record<string, string> = {
    invalid_input: 'Please enter your name and a valid email address.',
    invalid_link: "This review link isn't valid any more. Ask for a fresh one.",
    inactive: "This project isn't accepting feedback right now.",
    not_set_up: "The site isn't set up for review yet. Let the person who sent you this link know.",
    rate_limited: 'Too many attempts. Please try again in a few minutes.',
    internal_error: 'Something went wrong. Please try again.',
};

function Notice({ title, body }: { title: string; body: string }) {
    return (
        <div className="text-center">
            <h1 className="text-2xl font-bold mb-2 text-gray-900">{title}</h1>
            <p className="text-gray-500 text-sm">{body}</p>
        </div>
    );
}

export default async function ReviewEntryPage({
    params,
    searchParams,
}: {
    params: Promise<{ token: string }>;
    searchParams: Promise<{ error?: string }>;
}) {
    const { token } = await params;
    const { error } = await searchParams;
    const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.internal_error) : null;

    const admin = createAdminClient();
    const { data: project } = await admin
        .from('projects')
        .select('id, name, workspace_id, website_url, widget_last_seen_at')
        .eq('review_token', token)
        .maybeSingle();

    let content: React.ReactNode;

    if (!project || !project.website_url) {
        content = (
            <Notice
                title="This review link isn't valid"
                body="The link may have been copied incompletely. Ask the person who sent it to share it again."
            />
        );
    } else {
        const access = await checkOwnerAccess(project.workspace_id);
        if (!access.ok) {
            content = (
                <Notice
                    title="Reviews are currently unavailable"
                    body="This project isn't accepting feedback right now. Please contact the person who sent you this link."
                />
            );
        } else if (!project.widget_last_seen_at) {
            content = (
                <Notice
                    title="This site isn't set up for review yet"
                    body="The feedback widget hasn't been installed on the site. Let the person who sent you this link know, and try again once they've finished setting up."
                />
            );
        } else {
            let siteHost = project.website_url;
            try { siteHost = new URL(project.website_url).host; } catch { /* show as stored */ }
            content = (
                <>
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold mb-2 text-gray-900">
                            Review {project.name}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            You&apos;ve been invited to leave feedback on <span className="font-medium text-gray-700">{siteHost}</span>. Tell us who you are, then you&apos;ll be taken to the site to start pinning.
                        </p>
                    </div>
                    {errorMessage && (
                        <div className="p-3 mb-4 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                            {errorMessage}
                        </div>
                    )}
                    <form action="/api/review/redeem" method="POST" className="flex flex-col gap-4">
                        <input type="hidden" name="token" value={token} />
                        <div>
                            <label htmlFor="reviewer-name" className="block text-sm font-medium mb-1 text-gray-700">
                                Your name
                            </label>
                            <input
                                id="reviewer-name"
                                name="name"
                                type="text"
                                maxLength={100}
                                placeholder="Jane Doe"
                                autoComplete="name"
                                required
                                className="w-full px-3 py-2 border rounded-md border-gray-300 bg-white text-gray-900"
                            />
                        </div>
                        <div>
                            <label htmlFor="reviewer-email" className="block text-sm font-medium mb-1 text-gray-700">
                                Your email
                            </label>
                            <input
                                id="reviewer-email"
                                name="email"
                                type="email"
                                maxLength={254}
                                placeholder="jane@example.com"
                                autoComplete="email"
                                required
                                className="w-full px-3 py-2 border rounded-md border-gray-300 bg-white text-gray-900"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-white bg-secondary hover:bg-secondary/90 transition-colors cursor-pointer"
                        >
                            Start reviewing
                        </button>
                    </form>
                    <p className="text-xs text-center text-gray-500 mt-6">
                        Your name labels your feedback for the project team; your email is used for reply notifications. No account is created.
                    </p>
                </>
            );
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <SiteHeader minimal />
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-[440px] bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                    {content}
                </div>
            </main>
        </div>
    );
}
