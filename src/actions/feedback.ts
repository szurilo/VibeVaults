'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateFeedbackStatus(id: string, status: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('feedbacks')
        .update({ status })
        .eq('id', id);

    if (error) {
        throw new Error('Failed to update feedback status');
    }

    revalidatePath('/dashboard/feedback');
}
