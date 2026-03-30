import { createClient } from "@/lib/supabase/server";
import { FeedbackDetail } from "@/components/FeedbackDetail";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: feedback, error } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !feedback) {
        notFound();
    }

    return (
        <div className="max-w-3xl mx-auto">
            <Link
                href="/dashboard/feedback"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6 group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Back to Feedbacks
            </Link>

            <FeedbackDetail feedback={feedback} mode="edit" />
        </div>
    );
}
