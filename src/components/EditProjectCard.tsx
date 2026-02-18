'use client';

import { useState } from 'react';
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
    };
}

export function EditProjectCard({ project }: EditProjectCardProps) {
    const [name, setName] = useState(project.name);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || name === project.name) return;

        setLoading(true);
        setSuccess(false);

        try {
            const { error } = await supabase
                .from('projects')
                .update({ name: name.trim() })
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
            <CardHeader>
                <CardTitle className="font-semibold text-gray-900 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Project Settings
                </CardTitle>
                <CardDescription>
                    Update your project details and name.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdateName}>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-end gap-4">
                        <div className="space-y-2 flex-1">
                            <Label htmlFor="projectName">Project Name</Label>
                            <Input
                                id="projectName"
                                placeholder="e.g. My Awesome App"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="max-w-md focus-visible:ring-primary"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={loading || !name.trim() || name === project.name}
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
                </CardContent>
            </form>
        </Card>
    );
}
