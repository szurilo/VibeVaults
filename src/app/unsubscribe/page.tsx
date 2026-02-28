import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import UnsubscribeForm from "./UnsubscribeForm";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const params = await searchParams;
    const token = params.token;

    if (!token) {
        return notFound();
    }

    const supabase = createAdminClient();
    const { data: preference } = await supabase
        .from("email_preferences")
        .select("*")
        .eq("unsubscribe_token", token)
        .single();

    if (!preference) {
        return notFound();
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', preference.email)
        .maybeSingle();

    const isAgency = !!profile;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Email Preferences
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Manage notifications for <span className="font-semibold">{preference.email}</span>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <UnsubscribeForm initialPreferences={preference} token={token} isAgency={isAgency} />
                </div>
            </div>
        </div>
    );
}
