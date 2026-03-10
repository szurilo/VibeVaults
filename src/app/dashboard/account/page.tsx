import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { NotificationsCard } from "@/components/NotificationsCard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AccountPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const adminSupabase = createAdminClient();
    const { data: preferences } = await adminSupabase
        .from('email_preferences')
        .select('*')
        .eq('email', user.email)
        .single();

    const initialPreferences = {
        notify_new_feedback: preferences?.notify_new_feedback ?? true,
        notify_replies: preferences?.notify_replies ?? true,
        notify_project_created: preferences?.notify_project_created ?? true,
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                    Account
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-full space-y-6">
                    <NotificationsCard initialPreferences={initialPreferences} />
                    <DeleteAccountCard />
                </div>
            </div>
        </div>
    );
}
