'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { XIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function Onboarding() {
    const router = useRouter();
    const [projectName, setProjectName] = useState('');
    const [isDismissed, setIsDismissed] = useState(false);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim()) return;

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projectName }),
            });

            if (res.ok) {
                const newProject = await res.json();
                document.cookie = `selectedProjectId=${newProject.id}; path=/; max-age=31536000`;
                router.refresh();
            }
        } catch (error) {
            console.error('Failed to create project:', error);
        }
    };

    if (isDismissed) return null;

    return (
        <TooltipProvider>
            <Card className="bg-primary/5 border-primary/20 mb-8 relative">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsDismissed(true)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            <XIcon className="w-5 h-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Dismiss</p>
                    </TooltipContent>
                </Tooltip>

                <CardHeader className="max-w-2xl px-8 pt-8 pb-4">

                    <CardTitle className="text-2xl">Welcome to VibeVaults! 🚀</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground/80">
                        Let's get started by creating your first project. Enter a project name below to generate your API key and start collecting feedback.
                    </CardDescription>
                </CardHeader>

                <CardContent className="max-w-2xl px-8 pb-8">
                    <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-3">
                        <Input
                            type="text"
                            placeholder="e.g. My Awesome App"
                            className="flex-1 bg-white"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            autoFocus
                        />
                        <Button type="submit" disabled={!projectName.trim()} className="px-8 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer">
                            Create Project
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}

