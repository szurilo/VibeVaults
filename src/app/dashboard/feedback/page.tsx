import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function FeedbackListPage() {
    const session = await getSession();
    if (!session) redirect("/login");

    const supabase = await createClient();
    const { data: feedbacks } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

    if (!feedbacks) {
        // Handle error gracefully or redirect
        return <div>Error loading feedback</div>;
    }

    return (
        <div>
            <h1 className="text-2xl font-semibold mb-8 text-gray-900">Incoming Feedback</h1>

            {feedbacks.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
                    <p className="text-gray-500">No feedback received yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {feedbacks.map((item: any) => (
                        <div key={item.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                                    {item.type}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {new Date(item.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-gray-700 text-sm mb-4 flex-1">
                                {item.content}
                            </p>
                            {item.sender && (
                                <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
                                    From: <span className="font-medium">{item.sender}</span>
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
