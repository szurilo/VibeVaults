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

export async function toggleOnboardingStepAction(stepId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from("profiles")
        .select("completed_onboarding_steps")
        .eq("id", user.id)
        .single();

    const current: string[] = profile?.completed_onboarding_steps ?? [];
    const updated = current.includes(stepId)
        ? current.filter(s => s !== stepId)
        : [...current, stepId];

    const { error } = await supabase
        .from("profiles")
        .update({ completed_onboarding_steps: updated })
        .eq("id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
}
