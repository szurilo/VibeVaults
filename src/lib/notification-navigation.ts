/**
 * Main Responsibility: Shared navigation helper for notification clicks (bell + toast).
 * Resolves the target project's workspace and updates both `selectedWorkspaceId` and
 * `selectedProjectId` cookies before routing, so the sidebar/back-button land on the
 * same workspace+project the notification belongs to.
 *
 * Sensitive Dependencies:
 * - Cookie names/options must match workspace-switcher.tsx (path=/, max-age=31536000).
 * - Relies on `projects.workspace_id` being readable by the current user via RLS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { useRouter } from "next/navigation";

type Router = ReturnType<typeof useRouter>;

interface NotificationTarget {
    project_id: string | null;
    feedback_id: string | null;
}

export async function navigateToNotification(
    notification: NotificationTarget,
    router: Router,
    supabase: SupabaseClient
) {
    if (notification.project_id) {
        // Look up the workspace for this project so the sidebar + back button land correctly.
        const { data: project } = await supabase
            .from("projects")
            .select("workspace_id")
            .eq("id", notification.project_id)
            .single();

        if (project?.workspace_id) {
            document.cookie = `selectedWorkspaceId=${project.workspace_id}; path=/; max-age=31536000`;
        }
        document.cookie = `selectedProjectId=${notification.project_id}; path=/; max-age=31536000`;

        if (notification.feedback_id) {
            router.push(`/dashboard/feedback/${notification.feedback_id}`);
        } else {
            router.push("/dashboard/feedback");
        }
    } else {
        // Workspace-level notification (member removed/left)
        router.push("/dashboard");
    }
    router.refresh();
}
