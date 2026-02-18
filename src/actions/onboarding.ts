'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function completeOnboardingAction() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    const { error } = await supabase
        .from("profiles")
        .update({ has_onboarded: true })
        .eq("id", user.id);

    if (error) {
        console.error("Failed to complete onboarding:", error);
        throw error;
    }

    revalidatePath("/dashboard");
}
