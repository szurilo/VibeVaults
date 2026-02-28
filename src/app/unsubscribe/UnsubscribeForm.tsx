'use client';

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { updatePreferencesAction } from "@/actions/preferences";

export default function UnsubscribeForm({ initialPreferences, token, isAgency }: { initialPreferences: any, token: string, isAgency?: boolean }) {
    const [notifyNewFeedback, setNotifyNewFeedback] = useState(initialPreferences.notify_new_feedback !== false);
    const [notifyReplies, setNotifyReplies] = useState(initialPreferences.notify_replies);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        setSuccess(false);
        try {
            await updatePreferencesAction(token, notifyReplies, isAgency ? notifyNewFeedback : undefined);
            setSuccess(true);
        } catch (error) {
            console.error("Failed to update preferences", error);
            alert("Failed to save changes.");
        } finally {
            setLoading(false);
        }
    };

    const hasChanged =
        notifyReplies !== initialPreferences.notify_replies ||
        (isAgency && notifyNewFeedback !== (initialPreferences.notify_new_feedback !== false));

    return (
        <div className="space-y-6">
            {isAgency && (
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="notify-new-feedback" className="text-base">New Feedback</Label>
                        <p className="text-sm text-gray-500">
                            Receive an email when a client leaves new feedback on your projects.
                        </p>
                    </div>
                    <Switch
                        id="notify-new-feedback"
                        checked={notifyNewFeedback}
                        onCheckedChange={(checked) => { setNotifyNewFeedback(checked); setSuccess(false); }}
                    />
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label htmlFor="notify-replies" className="text-base">Reply Notifications</Label>
                    <p className="text-sm text-gray-500">
                        Receive an email when {isAgency ? "a client" : "the agency"} replies to your feedback.
                    </p>
                </div>
                <Switch
                    id="notify-replies"
                    checked={notifyReplies}
                    onCheckedChange={(checked) => { setNotifyReplies(checked); setSuccess(false); }}
                />
            </div>

            <Button
                onClick={handleSave}
                disabled={loading || (!hasChanged && !success)}
                className="w-full"
            >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {success ? "Saved successfully!" : "Save preferences"}
            </Button>
        </div>
    );
}
