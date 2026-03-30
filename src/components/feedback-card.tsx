/**
 * Main Responsibility: Thin wrapper around FeedbackDetail for backward compatibility.
 * Used by the share page (src/app/share/[token]/page.tsx) which imports FeedbackCard.
 */
'use client';

import { FeedbackDetail } from "./feedback-detail"
import { type FeedbackData } from "@/lib/feedback-utils"

interface FeedbackCardProps {
    feedback: FeedbackData
    mode: 'view' | 'edit'
}

export function FeedbackCard({ feedback, mode }: FeedbackCardProps) {
    return <FeedbackDetail feedback={feedback} mode={mode} />
}
