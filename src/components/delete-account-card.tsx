'use client';

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DangerZoneCard } from "@/components/danger-zone-card";

export function DeleteAccountCard() {
    const router = useRouter();
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

        await supabase.auth.signOut();
        router.push("/auth/login");
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
