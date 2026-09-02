/**
 * Main Responsibility: Manages the shareable review link's one control — the
 * pause toggle. The link itself is permanent (projects.review_token is minted
 * by the DB and never rotated), so there is nothing to create or revoke here;
 * pausing blocks new feedback/replies from review-link identities while
 * leaving existing threads visible, Huddlekit-style.
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

export async function setReviewFeedbackPaused(projectId: string, paused: boolean) {
    const supabase = await createClient();

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
