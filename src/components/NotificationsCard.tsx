'use client';

import { useState } from 'react';
import { updateAgencyPreferencesAction, updateEmailFrequencyAction } from '@/actions/preferences';
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
import { Loader2, Check, Mail, Clock, Zap } from 'lucide-react';

interface NotificationsCardProps {
    initialPreferences: {
        notify_new_feedback?: boolean;
        notify_replies?: boolean;
        notify_project_created?: boolean;
        notify_project_deleted?: boolean;
        email_frequency?: 'digest' | 'realtime';
    };
    canUseRealtime?: boolean;
}

export function NotificationsCard({ initialPreferences, canUseRealtime = false }: NotificationsCardProps) {
    const [notifyNewFeedback, setNotifyNewFeedback] = useState(initialPreferences.notify_new_feedback !== false);
    const [notifyReplies, setNotifyReplies] = useState(initialPreferences.notify_replies !== false);
    const [notifyProjectCreated, setNotifyProjectCreated] = useState(initialPreferences.notify_project_created !== false);
    const [notifyProjectDeleted, setNotifyProjectDeleted] = useState(initialPreferences.notify_project_deleted !== false);
    const [emailFrequency, setEmailFrequency] = useState<'digest' | 'realtime'>(initialPreferences.email_frequency || 'digest');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const hasChanged =
        (initialPreferences.notify_new_feedback !== false) !== notifyNewFeedback ||
        (initialPreferences.notify_replies !== false) !== notifyReplies ||
        (initialPreferences.notify_project_created !== false) !== notifyProjectCreated ||
        (initialPreferences.notify_project_deleted !== false) !== notifyProjectDeleted ||
        (canUseRealtime && (initialPreferences.email_frequency || 'digest') !== emailFrequency);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasChanged) return;

        setLoading(true);
        setSuccess(false);

        try {
            await updateAgencyPreferencesAction(notifyNewFeedback, notifyReplies, notifyProjectCreated, notifyProjectDeleted);
            if (canUseRealtime && (initialPreferences.email_frequency || 'digest') !== emailFrequency) {
                await updateEmailFrequencyAction(emailFrequency);
            }
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to update email preferences:', error);
            alert('Failed to save preferences. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="shadow-sm border-gray-200">
            <form onSubmit={handleSave} className="flex flex-col sm:flex-row sm:items-start justify-between w-full">
                <div className="flex-1">
                    <CardHeader>
                        <CardTitle className="font-semibold text-gray-900 flex items-center gap-2">
                            <Mail className="w-5 h-5" />
                            Email Notifications
                        </CardTitle>
                        <CardDescription>
                            Control which email notifications you want to receive. To reduce noise, emails are batched into periodic digests rather than sent individually.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-2">
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
                                onCheckedChange={(c) => { setNotifyNewFeedback(c); setSuccess(false); }}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="notify-agency-replies" className="text-base">Feedback Replies</Label>
                                <p className="text-sm text-gray-500">
                                    Receive an email when someone replies to feedback you&apos;re involved in.
                                </p>
                            </div>
                            <Switch
                                id="notify-agency-replies"
                                checked={notifyReplies}
                                onCheckedChange={(c) => { setNotifyReplies(c); setSuccess(false); }}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="notify-project-created" className="text-base">New Projects</Label>
                                <p className="text-sm text-gray-500">
                                    Receive an email when someone creates a new project in your workspace.
                                </p>
                            </div>
                            <Switch
                                id="notify-project-created"
                                checked={notifyProjectCreated}
                                onCheckedChange={(c) => { setNotifyProjectCreated(c); setSuccess(false); }}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="notify-project-deleted" className="text-base">Deleted Projects</Label>
                                <p className="text-sm text-gray-500">
                                    Receive an email when someone deletes a project in your workspace.
                                </p>
                            </div>
                            <Switch
                                id="notify-project-deleted"
                                checked={notifyProjectDeleted}
                                onCheckedChange={(c) => { setNotifyProjectDeleted(c); setSuccess(false); }}
                            />
                        </div>

                        {canUseRealtime && (
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="email-frequency" className="text-base flex items-center gap-1.5">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                        Realtime Emails
                                    </Label>
                                    <p className="text-sm text-gray-500">
                                        Send each notification immediately instead of batching into digests.
                                    </p>
                                </div>
                                <Switch
                                    id="email-frequency"
                                    checked={emailFrequency === 'realtime'}
                                    onCheckedChange={(c) => { setEmailFrequency(c ? 'realtime' : 'digest'); setSuccess(false); }}
                                />
                            </div>
                        )}

                        {emailFrequency === 'digest' && (
                            <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 border border-blue-100 p-3.5 mt-2">
                                <Clock className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                <p className="text-sm text-blue-700 leading-snug">
                                    Emails are grouped into digests every 15 minutes. The first notification is sent immediately &mdash; follow-ups within the same window are bundled into a single summary email.
                                </p>
                            </div>
                        )}
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
