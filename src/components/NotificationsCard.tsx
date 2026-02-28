'use client';

import { useState } from 'react';
import { updateAgencyPreferencesAction } from '@/actions/preferences';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Loader2, Check, Bell } from 'lucide-react';

interface NotificationsCardProps {
    initialPreferences: {
        notify_new_feedback?: boolean;
        notify_replies?: boolean;
    };
}

export function NotificationsCard({ initialPreferences }: NotificationsCardProps) {
    const [notifyNewFeedback, setNotifyNewFeedback] = useState(initialPreferences.notify_new_feedback !== false);
    const [notifyReplies, setNotifyReplies] = useState(initialPreferences.notify_replies !== false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const hasChanged =
            (initialPreferences.notify_new_feedback !== false) !== notifyNewFeedback ||
            (initialPreferences.notify_replies !== false) !== notifyReplies;

        if (!hasChanged) return;

        setLoading(true);
        setSuccess(false);

        try {
            await updateAgencyPreferencesAction(notifyNewFeedback, notifyReplies);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to update email preferences:', error);
            alert('Failed to save preferences. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const hasChanged =
        (initialPreferences.notify_new_feedback !== false) !== notifyNewFeedback ||
        (initialPreferences.notify_replies !== false) !== notifyReplies;

    return (
        <Card className="shadow-sm border-gray-200">
            <form onSubmit={handleSave} className="flex flex-col sm:flex-row sm:items-start justify-between w-full">
                <div className="flex-1">
                    <CardHeader>
                        <CardTitle className="font-semibold text-gray-900 flex items-center gap-2">
                            <Bell className="w-5 h-5" />
                            Email Notifications
                        </CardTitle>
                        <CardDescription>
                            Control which email notifications you want to receive.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-2">
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
                                onCheckedChange={(c) => { setNotifyNewFeedback(c); setSuccess(false); }}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="notify-agency-replies" className="text-base">Feedback Replies</Label>
                                <p className="text-sm text-gray-500">
                                    Receive an email when a client replies to an existing feedback thread.
                                </p>
                            </div>
                            <Switch
                                id="notify-agency-replies"
                                checked={notifyReplies}
                                onCheckedChange={(c) => { setNotifyReplies(c); setSuccess(false); }}
                            />
                        </div>
                    </CardContent>
                </div>
                <div className="px-6 mt-4 sm:mt-6 sm:px-0 sm:pr-6 shrink-0 pb-6 sm:pb-0">
                    <Button
                        type="submit"
                        disabled={loading || !hasChanged}
                        className="cursor-pointer min-w-[100px]"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : success ? (
                            <span className="flex items-center gap-2">
                                <Check className="h-4 w-4" /> Saved
                            </span>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
