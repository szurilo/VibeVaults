/**
 * Main Responsibility: Landing page for workspace invitation links. Validates the
 * invite token, inspects the viewer's auth state, and either (a) auto-accepts the
 * invite for the matching logged-in user, (b) shows a sign-in surface for guests
 * (magic link + Google OAuth), (c) shows an email-mismatch recovery view, or (d)
 * shows an invalid-invite view.
 *
 * GDPR note: no auth.users record exists until the visitor actively clicks one of
 * the sign-in options. The prior flow pre-created accounts at invite time.
 *
 * Sensitive Dependencies:
 * - Supabase Server Client (@/lib/supabase/server) for auth lookup.
 * - Supabase Admin Client (@/lib/supabase/admin) for invite row fetch (pre-auth
 *   visitors have no RLS access to workspace_invites).
 * - acceptInvite server action for the membership write in the auto-accept branch.
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { acceptInvite } from '@/actions/invites';
import { AcceptInviteClient } from './AcceptInviteClient';
import { SignOutAndReturnButton } from './SignOutAndReturnButton';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, UserX } from 'lucide-react';

type PageProps = {
    searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitePage({ searchParams }: PageProps) {
    const { token } = await searchParams;

    if (!token) {
        return <InvalidInviteView />;
    }

    const admin = createAdminClient();
    const { data: invite } = await admin
        .from('workspace_invites')
        .select('id, workspace_id, email, role')
        .eq('id', token)
        .maybeSingle();

    if (!invite) {
        // Could be: invite revoked, already accepted, or bad token.
        return <InvalidInviteView />;
    }

    const { data: workspace } = await admin
        .from('workspaces')
        .select('name, owner_id')
        .eq('id', invite.workspace_id)
        .maybeSingle();

    let inviterName = 'A colleague';
    if (workspace?.owner_id) {
        const { data: ownerProfile } = await admin
            .from('profiles')
            .select('full_name, email')
            .eq('id', workspace.owner_id)
            .maybeSingle();
        inviterName = ownerProfile?.full_name || ownerProfile?.email || inviterName;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user && user.email) {
        if (user.email.toLowerCase() === invite.email.toLowerCase()) {
            // Auto-accept: user is logged in as the invited email.
            const result = await acceptInvite(token);
            if (result.ok) {
                // Reuse existing deep-link handler to set selectedWorkspaceId cookie.
                redirect(`/api/email-redirect?workspace=${result.workspaceId}&page=feedback`);
            }
            // Fall through to invalid view on unexpected failure.
            return <InvalidInviteView />;
        }

        return (
            <EmailMismatchView
                signedInAs={user.email}
                inviteEmail={invite.email}
                workspaceName={workspace?.name || 'this workspace'}
                token={invite.id}
            />
        );
    }

    return (
        <AcceptInviteClient
            token={invite.id}
            inviteEmail={invite.email}
            workspaceName={workspace?.name || 'a workspace'}
            inviterName={inviterName}
        />
    );
}

function InvalidInviteView() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md text-center shadow-lg">
                <CardHeader className="space-y-4">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-red-100 p-3">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-extrabold tracking-tight">
                            Invite not found
                        </CardTitle>
                        <CardDescription className="text-base">
                            This invitation link is invalid, has expired, or has already been used.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="text-left">
                    <div className="bg-muted/50 rounded-lg p-4 text-sm">
                        <p className="font-medium text-foreground mb-2">What you can do:</p>
                        <ul className="space-y-1.5">
                            <li className="flex items-center text-muted-foreground">
                                <span className="mr-2 text-primary">•</span>
                                If you already accepted, sign in to reach your dashboard
                            </li>
                            <li className="flex items-center text-muted-foreground">
                                <span className="mr-2 text-primary">•</span>
                                Otherwise, ask the workspace owner to send a new invite
                            </li>
                        </ul>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 pt-2">
                    <Button asChild className="w-full h-10" variant="default">
                        <Link href="/auth/login">Go to sign in</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

function EmailMismatchView({
    signedInAs,
    inviteEmail,
    workspaceName,
    token,
}: {
    signedInAs: string;
    inviteEmail: string;
    workspaceName: string;
    token: string;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md text-center shadow-lg">
                <CardHeader className="space-y-4">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-amber-100 p-3">
                            <UserX className="h-8 w-8 text-amber-600" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-extrabold tracking-tight">
                            Wrong account
                        </CardTitle>
                        <CardDescription className="text-base">
                            {`You're signed in as `}
                            <span className="font-semibold text-foreground">{signedInAs}</span>
                            {`, but this invite for ${workspaceName} is addressed to `}
                            <span className="font-semibold text-foreground">{inviteEmail}</span>.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="text-left">
                    <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                        Sign out, then open the invite link again and sign in with{' '}
                        <span className="font-medium text-foreground">{inviteEmail}</span>.
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 pt-2">
                    <SignOutAndReturnButton token={token} />
                    <Button asChild variant="outline" className="w-full h-10">
                        <Link href="/dashboard">Continue as {signedInAs}</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
