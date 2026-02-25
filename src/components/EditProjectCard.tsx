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
import { Loader2, Check, Settings } from 'lucide-react';

interface EditProjectCardProps {
    project: {
        id: string;
        name: string;
        website_url?: string;
    };
}

export function EditProjectCard({ project }: EditProjectCardProps) {
    const [name, setName] = useState(project.name);
    const [websiteUrl, setWebsiteUrl] = useState(project.website_url || '');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    // Sync state with props when project changes
    useEffect(() => {
        setName(project.name);
        setWebsiteUrl(project.website_url || '');
    }, [project.name, project.website_url]);

    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !websiteUrl.trim() || (name === project.name && websiteUrl === (project.website_url || ''))) return;

        setLoading(true);
        setSuccess(false);

        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    name: name.trim(),
                    website_url: websiteUrl.trim()
                })
                .eq('id', project.id);

            if (error) throw error;

            setSuccess(true);
            router.refresh();

            // Success state duration
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to update project name:', error);
            alert('Failed to update project name. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="shadow-sm border-gray-200">
            <form onSubmit={handleUpdateName} className="flex flex-col sm:flex-row sm:items-center justify-between w-full">
                <div className="flex-1">
                    <CardHeader>
                        <CardTitle className="font-semibold text-gray-900 flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Project Settings
                        </CardTitle>
                        <CardDescription>
                            Update your project details and name.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <Label htmlFor="projectName">Project Name</Label>
                                <Input
                                    id="projectName"
                                    placeholder="e.g. My Client's App"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="max-w-md focus-visible:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="websiteUrl">Website URL</Label>
                                <Input
                                    id="websiteUrl"
                                    type="url"
                                    placeholder="https://client-site.com"
                                    value={websiteUrl}
                                    onChange={(e) => setWebsiteUrl(e.target.value)}
                                    className="max-w-md focus-visible:ring-primary"
                                />
                            </div>
                        </div>
                    </CardContent>
                </div>
                <div className="px-6 mt-4 sm:mt-0 sm:px-0 sm:pr-6 shrink-0">
                    <Button
                        type="submit"
                        disabled={loading || !name.trim() || !websiteUrl.trim() || (name === project.name && websiteUrl === (project.website_url || ''))}
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
