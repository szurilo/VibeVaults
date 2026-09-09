/**
 * Main Responsibility: The shareable review link's one management control —
 * the pause toggle. The link itself is permanent (projects.review_token is
 * minted by the DB and never rotated), so there is nothing to create or
 * revoke here; pausing blocks new feedback/replies from review-link
 * identities while leaving existing threads visible, Huddlekit-style.
 *
 * Guest redemption lives elsewhere on purpose: `src/lib/review-redeem.ts`
 * behind the `/api/review/redeem` route handler, because Next.js blocks
 * server-action redirects to external hosts and the guest has to end up on
 * the customer's own domain.
 *
 * Sensitive Dependencies:
 * - Supabase Server Client: the update runs user-scoped, so RLS enforces that
 *   only workspace members can flip the flag.
 * - /api/widget/* enforcement: the flag is read by authenticateWidgetRequest
 *   on every widget write — this action is the only writer.
 */
'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkProjectWorkspaceActive } from "@/lib/tier-helpers";

export async function setReviewFeedbackPaused(projectId: string, paused: boolean) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "You must be logged in to change this." };

    // Billing gate. Moot for the widget itself (validateApiKey already blocks a
    // lapsed owner's widget outright), but the control must not look functional
    // while the rest of the workspace is locked.
    const workspacePaused = await checkProjectWorkspaceActive(projectId, user.id);
    if (workspacePaused) return { error: workspacePaused };

    const { error } = await supabase
        .from('projects')
        .update({ review_feedback_paused: paused })
        .eq('id', projectId);

    if (error) {
        console.error("Failed to update review pause:", error);
        return { error: paused ? "Failed to pause review feedback." : "Failed to resume review feedback." };
    }

    revalidatePath('/dashboard/project-settings');
    return { error: null };
}
