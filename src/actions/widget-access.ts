/**
 * Main Responsibility: Server-side helpers for the new invite-only widget
 * access model. Issues per-device widget tokens for the authenticated
 * dashboard user (owner/member) and packages them as bootstrap URLs that
 * point at the project's host site. Click → host site → widget.js plants
 * the token in localStorage on that origin → widget renders.
 *
 * Sensitive Dependencies:
 * - Supabase Server Client: identifies the calling user (auth.uid()).
 * - Supabase Admin Client: reads project + website_url and writes
 *   widget_identities (the latter has no RLS write policy by design — it's
 *   server-only via service role).
 * - issueWidgetIdentity from widget-helpers: generates token + persists hash.
 */
'use server';

import fs from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { issueWidgetIdentity } from '@/lib/widget-helpers';
import { sendWidgetAccessRecoveryEmail } from '@/lib/notifications';
import { headers } from 'next/headers';

// In-memory rate limiter for the public recovery action. Per-process,
// resets on cold start — fine for v1, swap for Redis if abuse appears.
const RECOVERY_WINDOW_MS = 10 * 60_000; // 10 minutes
const RECOVERY_MAX_PER_IP = 5;
const RECOVERY_MAX_PER_EMAIL = 3;
const recoveryHits = new Map<string, { count: number; resetAt: number }>();

// Bypass the rate limiter when Playwright tests are running. The bucket is
// process-local and the dev server is reused across runs, so accumulated
// hits trip false positives in tests for the same email/IP. Same pattern
// used by `src/lib/resend.ts` to stub Resend.
const isPlaywrightRun = () => fs.existsSync(path.join(process.cwd(), '.playwright-running'));

function isRecoveryRateLimited(key: string, max: number): boolean {
    if (isPlaywrightRun()) return false;
    const now = Date.now();
    const entry = recoveryHits.get(key);
    if (!entry || now > entry.resetAt) {
        recoveryHits.set(key, { count: 1, resetAt: now + RECOVERY_WINDOW_MS });
        return false;
    }
    entry.count++;
    return entry.count > max;
}

export type IssueSelfWidgetLinkResult =
    | { ok: true; url: string }
    | { ok: false; reason: 'not_authenticated' | 'project_not_found' | 'no_access' | 'no_website_url' | 'internal_error' };

/**
 * Generates a one-click widget bootstrap URL for the logged-in user against
 * a project they have access to. The returned URL is the project's
 * website_url with `?vv_token=<raw>` appended; opening it in the same
 * browser plants the token in that origin's localStorage and the widget
 * starts rendering for that user.
 *
 * Multi-device by design: each call creates a fresh `widget_identities`
 * row, so repeated invocations don't invalidate prior devices.
 */
export async function issueSelfWidgetLink(projectId: string): Promise<IssueSelfWidgetLinkResult> {
    if (!projectId) return { ok: false, reason: 'project_not_found' };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
        return { ok: false, reason: 'not_authenticated' };
    }

    const admin = createAdminClient();

    const { data: project } = await admin
        .from('projects')
        .select('id, workspace_id, website_url')
        .eq('id', projectId)
        .maybeSingle();

    if (!project) return { ok: false, reason: 'project_not_found' };

    // Owners + members get widget access on every project in their workspace.
    // Clients are not supposed to use this path (they have no auth.users row
    // in the new model and reach the dashboard solely via API), so member
    // membership is a sufficient access check.
    const { data: membership } = await admin
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', project.workspace_id)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!membership) return { ok: false, reason: 'no_access' };

    if (!project.website_url) return { ok: false, reason: 'no_website_url' };

    let rawToken: string;
    try {
        rawToken = await issueWidgetIdentity({
            projectId: project.id,
            email: user.email,
            userId: user.id,
        });
    } catch (e) {
        console.error('issueSelfWidgetLink: failed to issue identity', e);
        return { ok: false, reason: 'internal_error' };
    }

    let url: string;
    try {
        const u = new URL(project.website_url);
        u.searchParams.set('vv_token', rawToken);
        url = u.toString();
    } catch {
        // website_url isn't a fully-qualified URL — best-effort fallback that
        // still produces a clickable link (browsers will normalize).
        const sep = project.website_url.includes('?') ? '&' : '?';
        url = `${project.website_url}${sep}vv_token=${encodeURIComponent(rawToken)}`;
    }

    return { ok: true, url };
}

export type RequestRecoveryLinksResult =
    | { ok: true }
    | { ok: false; reason: 'invalid_email' | 'rate_limited' };

/**
 * Public self-service recovery: takes an email, looks up every project that
 * email has widget access to (as a workspace member or as a client invitee),
 * mints fresh bootstrap URLs, and emails them. Always returns a generic
 * success-shaped response to the caller (we never confirm or deny that the
 * email is on file — that would leak workspace membership). Rate-limited per
 * IP and per email.
 */
export async function requestWidgetAccessRecovery(email: string): Promise<RequestRecoveryLinksResult> {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, reason: 'invalid_email' };
    }
    const normalisedEmail = email.trim().toLowerCase();

    const headerStore = await headers();
    const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (isRecoveryRateLimited(`ip:${ip}`, RECOVERY_MAX_PER_IP)) {
        return { ok: false, reason: 'rate_limited' };
    }
    if (isRecoveryRateLimited(`email:${normalisedEmail}`, RECOVERY_MAX_PER_EMAIL)) {
        return { ok: false, reason: 'rate_limited' };
    }

    // From here on, log errors but always return ok:true to prevent
    // enumeration of which emails are valid invitees / members.
    void (async () => {
        try {
            const admin = createAdminClient();

            // --- Member path: find profiles with this email and the projects of all
            // workspaces they belong to ---
            const { data: profile } = await admin
                .from('profiles')
                .select('id')
                .eq('email', normalisedEmail)
                .maybeSingle();

            type Item = { projectName: string; workspaceName: string; url: string };
            const items: Item[] = [];

            if (profile) {
                const { data: memberships } = await admin
                    .from('workspace_members')
                    .select('workspace_id')
                    .eq('user_id', profile.id);

                const workspaceIds = (memberships ?? []).map(m => m.workspace_id);
                if (workspaceIds.length > 0) {
                    const { data: projects } = await admin
                        .from('projects')
                        .select('id, name, website_url, workspace_id, workspaces!inner(name)')
                        .in('workspace_id', workspaceIds);

                    for (const p of (projects ?? [])) {
                        if (!p.website_url) continue;
                        try {
                            const rawToken = await issueWidgetIdentity({
                                projectId: p.id,
                                email: normalisedEmail,
                                userId: profile.id,
                            });
                            const url = new URL(p.website_url);
                            url.searchParams.set('vv_token', rawToken);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const workspaceName = (p.workspaces as any)?.name ?? 'Workspace';
                            items.push({ projectName: p.name, workspaceName, url: url.toString() });
                        } catch (e) {
                            console.error('recovery: failed to issue identity for member project', p.id, e);
                        }
                    }
                }
            }

            // --- Client path: workspace_invites with role='client' for this email ---
            const { data: clientInvites } = await admin
                .from('workspace_invites')
                .select('id, workspace_id, workspaces!inner(name)')
                .eq('email', normalisedEmail)
                .eq('role', 'client');

            for (const inv of (clientInvites ?? [])) {
                const { data: projects } = await admin
                    .from('projects')
                    .select('id, name, website_url')
                    .eq('workspace_id', inv.workspace_id);

                for (const p of (projects ?? [])) {
                    if (!p.website_url) continue;
                    try {
                        const url = new URL(p.website_url);
                        url.searchParams.set('vv_invite', inv.id);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const workspaceName = (inv.workspaces as any)?.name ?? 'Workspace';
                        items.push({ projectName: p.name, workspaceName, url: url.toString() });
                    } catch {
                        // skip projects with malformed website_url
                    }
                }
            }

            if (items.length > 0) {
                await sendWidgetAccessRecoveryEmail({ to: normalisedEmail, items });
            }
        } catch (e) {
            console.error('requestWidgetAccessRecovery: background failure', e);
        }
    })();

    return { ok: true };
}
