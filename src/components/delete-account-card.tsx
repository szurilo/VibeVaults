'use client';

import { createClient } from "@/lib/supabase/client";
import { DangerZoneCard } from "@/components/danger-zone-card";

export function DeleteAccountCard() {
    const supabase = createClient();

    const handleDeleteAccount = async () => {
        const response = await fetch("/api/auth/delete-account", {
            method: "DELETE",
        });

        if (!response.ok) {
            throw new Error("Failed to delete account");
        }

        // Clear app localStorage
        localStorage.removeItem('onboarding_collapsed');

        // Clear app cookies
        document.cookie = 'selectedWorkspaceId=; path=/; max-age=0';
        document.cookie = 'selectedProjectId=; path=/; max-age=0';
        document.cookie = 'sidebar_state=; path=/; max-age=0';

        // Use local scope — the auth user is already gone server-side, so a
        // global logout would 403 on the revoke call. Local clears cookies
        // and localStorage without the server round-trip.
        await supabase.auth.signOut({ scope: 'local' });
        // Hard navigation through the logout route, not router.push: a soft
        // navigation's RSC request can still carry the auth cookie, and the
        // proxy decodes the JWT locally (the deleted user still decodes fine),
        // bouncing /auth/login back to /dashboard. The route handler clears the
        // cookies server-side before redirecting.
        window.location.href = "/api/auth/logout";
    };

    return (
        <DangerZoneCard
            entityName="Account"
            description="Permanently delete your account and all associated data."
            dialogTitle="Are you absolutely sure?"
            dialogDescription="This action cannot be undone. This will permanently delete your account and remove your data from our servers."
            onDelete={handleDeleteAccount}
        />
    );
}
