
import { createClient } from "@/lib/supabase/server";

export async function getSession() {
    const supabase = await createClient();
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;
        return { user };
    } catch (error) {
        return null;
    }
}
