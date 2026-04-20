/**
 * Main Responsibility: Notifies a workspace owner (in-app bell + email) when a member
 * leaves their workspace or removes their account entirely. Shared between the leave flow
 * and the account-deletion flow so wording and delivery stay consistent.
 *
 * Sensitive Dependencies:
 * - Admin Supabase client for inserting owner-targeted notifications and reading the owner's email.
 * - sendMemberLeftNotification (./notifications) for the Resend dispatch.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMemberLeftNotification } from '@/lib/notifications';

export type DepartureReason = 'left' | 'account_deleted';

export async function notifyOwnerMemberDeparted({
    workspaceId,
    workspaceName,
    ownerId,
    memberName,
    reason
}: {
    workspaceId: string;
    workspaceName: string;
    ownerId: string;
    memberName: string;
    reason: DepartureReason;
}) {
    const admin = createAdminClient();
    const message = reason === 'account_deleted'
        ? `${memberName} deleted their account and left ${workspaceName}`
        : `${memberName} has left ${workspaceName}`;

    try {
        await admin.from('notifications').insert({
            user_id: ownerId,
            type: 'member_left',
            title: 'Member Left',
            message
        });
    } catch (e) {
        console.error('Failed to insert member-left notification:', e);
    }

    try {
        const { data: ownerProfile } = await admin
            .from('profiles')
            .select('email')
            .eq('id', ownerId)
            .single();

        if (ownerProfile?.email) {
            await sendMemberLeftNotification({
                to: ownerProfile.email,
                workspaceName,
                memberName,
                workspaceId,
                reason
            });
        }
    } catch (e) {
        console.error('Failed to send member-left email:', e);
    }
}
