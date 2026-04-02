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
    senderAvatarUrl?: string
}

export function FeedbackCard({ feedback, mode, senderAvatarUrl }: FeedbackCardProps) {
    return <FeedbackDetail feedback={feedback} mode={mode} senderAvatarUrl={senderAvatarUrl} />
}
