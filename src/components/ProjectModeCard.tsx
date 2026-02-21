'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Loader2, Check, MessageSquare, Send } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ProjectModeCardProps {
    project: {
        id: string;
        mode?: string;
        support_email?: string | null;
    };
}

export function ProjectModeCard({ project }: ProjectModeCardProps) {
    const [mode, setMode] = useState(project.mode || 'staging');
    const [supportEmail, setSupportEmail] = useState(project.support_email || '');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        setMode(project.mode || 'staging');
        setSupportEmail(project.support_email || '');
    }, [project.mode, project.support_email]);

    const hasChanges = mode !== (project.mode || 'staging') || supportEmail !== (project.support_email || '');
    const isLiveModeValid = mode === 'staging' || (mode === 'live' && supportEmail.includes('@'));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasChanges || !isLiveModeValid) return;

        setLoading(true);
        setSuccess(false);

        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    mode,
                    support_email: supportEmail.trim() || null
                })
                .eq('id', project.id);

            if (error) throw error;

            setSuccess(true);
            router.refresh();

            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to update project mode:', error);
            alert('Failed to update mode settings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="shadow-sm border-gray-200">
            <form onSubmit={handleSave} className="flex flex-col sm:flex-row sm:items-center justify-between w-full">
                <div className="flex-1">
                    <CardHeader>
                        <CardTitle className="font-semibold text-gray-900 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            Widget Mode (Premium)
                        </CardTitle>
                        <CardDescription>
                            Configure how you want to receive feedback. Use Staging to review feedback in the dashboard, or Live to send feedback directly to an email inbox.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2 pt-6">
                            <Label htmlFor="mode">Operating Mode</Label>
                            <Select value={mode} onValueChange={setMode}>
                                <SelectTrigger className="max-w-md focus:ring-primary">
                                    <SelectValue placeholder="Select a mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="staging">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                            <span>Staging (Dashboard Review)</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="live">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span>Live (Direct-to-Email)</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {mode === 'live' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Label htmlFor="supportEmail" className="flex items-center gap-2 text-primary">
                                    <Send className="w-3.5 h-3.5" />
                                    Support Email Address
                                </Label>
                                <Input
                                    id="supportEmail"
                                    type="email"
                                    placeholder="support@youragency.com"
                                    value={supportEmail}
                                    onChange={(e) => setSupportEmail(e.target.value)}
                                    className="max-w-md focus-visible:ring-primary border-primary/20"
                                />
                                <p className="text-xs text-muted-foreground">
                                    All widget submissions will be forwarded directly to this address without saving to the dashboard.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </div>
                <div className="px-6 mt-4 sm:mt-0 sm:px-0 sm:pr-6 shrink-0">
                    <Button
                        type="submit"
                        disabled={loading || !hasChanges || !isLiveModeValid}
                        className="cursor-pointer min-w-[120px]"
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
