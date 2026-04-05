"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";

export function FeedbackDeletedToast() {
    const router = useRouter();

    useEffect(() => {
        toast("Feedback not found", {
            id: "feedback-deleted",
            description: "This feedback no longer exists — it may have been deleted.",
            icon: <Info className="h-4 w-4 text-blue-500" />,
        });
        // Strip the query param so a refresh doesn't re-fire the toast
        router.replace("/dashboard/feedback");
    }, [router]);

    return null;
}
