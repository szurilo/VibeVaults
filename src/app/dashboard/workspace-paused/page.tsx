/**
 * Main Responsibility: The member-facing half of the workspace paywall. An
 * owner whose plan lapsed is sent to /dashboard/subscribe, where they can fix
 * it themselves. A member can't pay for somebody else's workspace, so pricing
 * cards would be a dead end — they land here instead, told exactly who has to
 * renew and offered every workspace of theirs that still works.
 *
 * Sensitive Dependencies:
 * - Reached only via the proxy redirect in `src/lib/supabase/proxy.ts`, which
 *   excludes this path from the paywall check (otherwise: redirect loop).
 * - `getViewerWorkspaceLiveness` must run on the USER-SCOPED client; the RPC
 *   behind it derives the workspace set from auth.uid().
 * - Self-heals: if the owner renews, or the user lands here with a healthy
 *   selection, we bounce straight back to /dashboard rather than showing a
 *   stale warning.
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Lock, Mail, CircleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getViewerWorkspaceLiveness, getWorkspaceAccess, isWorkspaceLive } from '@/lib/tier-helpers';
import { SwitchWorkspaceButton } from '@/components/switch-workspace-button';
import { PaywallLockSync } from '@/components/paywall-lock-sync';
import { Button } from '@/components/ui/button';

export default async function WorkspacePausedPage() {
    const supabase = await createClient();
    const cookieStore = await cookies();

    const [{ data: { user } }, { data: workspaces }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('workspaces').select('id, name, owner_id').order('created_at', { ascending: true }),
    ]);

    if (!user) redirect('/auth/login');

    const liveness = await getViewerWorkspaceLiveness(supabase);

    const selectedWorkspaceId = cookieStore.get('selectedWorkspaceId')?.value;
    const paused = (workspaces ?? []).find(
        w => w.id === selectedWorkspaceId && !isWorkspaceLive(liveness, w.id),
    );

    // Nothing is actually paused for this user (owner renewed, or they arrived
    // here by hand). Send them back rather than warning about nothing.
    if (!paused) redirect('/dashboard');

    // An owner belongs on the plan picker, not here. The proxy already routes
    // that way; this is the backstop for a hand-typed URL.
    if (paused.owner_id === user.id) redirect('/dashboard/subscribe');

    const { ownerEmail } = await getWorkspaceAccess(paused.id);

    const availableWorkspaces = (workspaces ?? []).filter(
        w => w.id !== paused.id && isWorkspaceLive(liveness, w.id),
    );

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12">
            {/* Reaching this page at all means the active workspace is locked. */}
            <PaywallLockSync locked />

            <div className="w-full max-w-xl">
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/80 to-white shadow-sm p-8 sm:p-10">
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-600 mx-auto mb-6">
                        <Lock className="w-6 h-6" />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 text-center mb-3">
                        {paused.name} is paused
                    </h1>

                    <p className="text-muted-foreground text-center leading-relaxed">
                        This workspace&apos;s subscription has expired, so it is read-locked for
                        everyone on the team. The workspace owner
                        {ownerEmail ? <> (<span className="font-medium text-gray-700">{ownerEmail}</span>)</> : null}
                        {' '}needs to renew the plan before you can continue working here.
                    </p>

                    <div className="mt-7 rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex gap-3">
                            <CircleAlert className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-muted-foreground leading-relaxed">
                                Nothing has been deleted. Your projects, feedback and conversations
                                are all intact and come straight back the moment the plan is renewed.
                            </div>
                        </div>
                    </div>

                    {ownerEmail && (
                        <Button asChild className="w-full mt-6 h-11 cursor-pointer">
                            <a href={`mailto:${ownerEmail}?subject=${encodeURIComponent(`VibeVaults: ${paused.name} is paused`)}&body=${encodeURIComponent(`Hi,\n\nOur VibeVaults workspace "${paused.name}" is paused because the subscription has expired, so the team can't work in it. Could you renew the plan?\n\nThanks!`)}`}>
                                <Mail className="w-4 h-4" />
                                Email the owner
                            </a>
                        </Button>
                    )}
                </div>

                {availableWorkspaces.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-sm font-semibold text-gray-900 mb-1">
                            Keep working elsewhere
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            {availableWorkspaces.length === 1
                                ? 'This workspace is still fully available to you.'
                                : 'These workspaces are still fully available to you.'}
                        </p>
                        <div className="flex flex-col gap-2">
                            {availableWorkspaces.map(w => (
                                <SwitchWorkspaceButton key={w.id} workspaceId={w.id} workspaceName={w.name} />
                            ))}
                        </div>
                    </div>
                )}

                {/* The two routes that stay open to a locked-out member. Linked
                    from here because the sidebar nav is dimmed, so without these
                    the exits would be reachable only by typing a URL. */}
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8">
                    <Link
                        href="/dashboard/settings/users"
                        className="text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
                    >
                        Leave this workspace
                    </Link>
                    <Link
                        href="/dashboard/account"
                        className="text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
                    >
                        Manage your account
                    </Link>
                </div>
            </div>
        </div>
    );
}
