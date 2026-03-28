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
    const [notifyProjectCreated, setNotifyProjectCreated] = useState(initialPreferences.notify_project_created !== false);
    const [notifyProjectDeleted, setNotifyProjectDeleted] = useState(initialPreferences.notify_project_deleted !== false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        setSuccess(false);
        try {
            await updatePreferencesAction(token, notifyReplies, isAgency ? notifyNewFeedback : undefined, isAgency ? notifyProjectCreated : undefined, isAgency ? notifyProjectDeleted : undefined);
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
        (isAgency && notifyNewFeedback !== (initialPreferences.notify_new_feedback !== false)) ||
        (isAgency && notifyProjectCreated !== (initialPreferences.notify_project_created !== false)) ||
        (isAgency && notifyProjectDeleted !== (initialPreferences.notify_project_deleted !== false));

    return (
        <div className="space-y-6">
            {isAgency && (
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="notify-new-feedback" className="text-base">New Feedback</Label>
                        <p className="text-sm text-gray-500">
                            Receive an email when someone leaves new feedback on your projects.
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
                        Receive an email when {isAgency ? "someone" : "the agency"} replies to your feedback.
                    </p>
                </div>
                <Switch
                    id="notify-replies"
                    checked={notifyReplies}
                    onCheckedChange={(checked) => { setNotifyReplies(checked); setSuccess(false); }}
                />
            </div>

            {isAgency && (
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="notify-project-created" className="text-base">New Projects</Label>
                        <p className="text-sm text-gray-500">
                            Receive an email when a new project is created in your workspace.
                        </p>
                    </div>
                    <Switch
                        id="notify-project-created"
                        checked={notifyProjectCreated}
                        onCheckedChange={(checked) => { setNotifyProjectCreated(checked); setSuccess(false); }}
                    />
                </div>
            )}

            {isAgency && (
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="notify-project-deleted" className="text-base">Deleted Projects</Label>
                        <p className="text-sm text-gray-500">
                            Receive an email when a project is deleted from your workspace.
                        </p>
                    </div>
                    <Switch
                        id="notify-project-deleted"
                        checked={notifyProjectDeleted}
                        onCheckedChange={(checked) => { setNotifyProjectDeleted(checked); setSuccess(false); }}
                    />
                </div>
            )}

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
