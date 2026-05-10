/**
 * Main Responsibility: Auto-bootstrap a freshly-onboarded workspace member's
 * widget access. Called immediately after a `workspace_members` row is
 * created (manual invite acceptance + dashboard auto-accept paths) — mints
 * a per-project `widget_identities` row for the new member and emails them
 * a list of one-click bootstrap links so they can activate the widget on
 * each project's host site without further owner intervention.
 *
 * Sensitive Dependencies:
 * - issueWidgetIdentity (widget-helpers): server-only writer to the
 *   widget_identities table; bypasses RLS via the admin client.
 * - sendMemberWelcomeNotification: Resend transactional email.
 * - getNotificationPrefs: lazily creates the email_preferences row + returns
 *   the unsubscribe token. Respects the localhost dev opt-out.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { issueWidgetIdentity } from '@/lib/widget-helpers';
import { sendMemberWelcomeNotification } from '@/lib/notifications';
import { getNotificationPrefs } from '@/lib/notification-prefs';

type DispatchArgs = {
    workspaceId: string;
    userId: string;
    userEmail: string;
};

/**
 * Fire-and-forget. Issues per-project widget identities for this member,
 * builds bootstrap URLs, and sends one welcome email listing all of them.
 * Errors are logged but never thrown — the welcome email is a nice-to-have
 * on top of the membership write that just succeeded.
 */
export async function dispatchMemberWelcomeBootstrap({ workspaceId, userId, userEmail }: DispatchArgs): Promise<void> {
    try {
        const admin = createAdminClient();

        const [{ data: workspace }, { data: projects }] = await Promise.all([
            admin.from('workspaces').select('name').eq('id', workspaceId).maybeSingle(),
            admin
                .from('projects')
                .select('id, name, website_url')
                .eq('workspace_id', workspaceId)
                .order('created_at', { ascending: true }),
        ]);

        const workspaceName = workspace?.name || 'a workspace';

        const items: { name: string; url: string }[] = [];
        for (const project of (projects ?? [])) {
            if (!project.website_url) continue;
            try {
                const rawToken = await issueWidgetIdentity({
                    projectId: project.id,
                    email: userEmail,
                    userId,
                });
                const url = new URL(project.website_url);
                url.searchParams.set('vv_token', rawToken);
                items.push({ name: project.name, url: url.toString() });
            } catch (e) {
                // website_url may be malformed, or the insert may fail — keep
                // going so the member at least gets the email with the rest.
                console.error('dispatchMemberWelcomeBootstrap: project skipped', project.id, e);
            }
        }

        // Notification prefs are keyed by email — for a brand-new member this
        // creates a default row. We send the welcome regardless of any
        // notify_* preference (it's onboarding, not a recurring notification),
        // but we honor the unsubscribe token so the user can manage prefs
        // from the email footer.
        const { unsubscribeToken } = await getNotificationPrefs(userEmail, 'project_created');

        await sendMemberWelcomeNotification({
            to: userEmail,
            workspaceName,
            projects: items,
            unsubscribeToken,
        });
    } catch (e) {
        console.error('dispatchMemberWelcomeBootstrap: top-level failure', e);
    }
}
