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
import { XIcon, Settings, Share2, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { completeOnboardingAction } from '@/actions/onboarding';
import Link from 'next/link';

export default function Onboarding() {
    const router = useRouter();
    const [projectName, setProjectName] = useState('');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim() || loading) return;

        setLoading(true);
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projectName }),
            });

            if (res.ok) {
                const newProject = await res.json();
                document.cookie = `selectedProjectId=${newProject.id}; path=/; max-age=31536000`;
                setStep(2);
            }
        } catch (error) {
            console.error('Failed to create project:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFinishOnboarding = async () => {
        try {
            await completeOnboardingAction();
            router.refresh();
        } catch (error) {
            console.error('Failed to finish onboarding:', error);
        }
    };

    if (step === 1) {
        return (
            <TooltipProvider>
                <Card className="bg-primary/5 border-primary/20 mb-8 relative">
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
                                disabled={loading}
                            />
                            <Button type="submit" disabled={!projectName.trim() || loading} className="px-8 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer">
                                {loading ? 'Creating...' : 'Create Project'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider>
            <Card className="bg-primary/5 border-primary/20 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleFinishOnboarding}
                                className="text-muted-foreground hover:text-foreground hover:bg-primary/10 cursor-pointer"
                            >
                                <XIcon className="w-5 h-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Finish Onboarding</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <CardHeader className="max-w-2xl px-8 pt-8 pb-4">
                    <CardTitle className="text-2xl">Your project is ready! 🎊</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground/80">
                        You're all set to start collecting feedback. Here's how to get the most out of VibeVaults:
                    </CardDescription>
                </CardHeader>

                <CardContent className="max-w-3xl px-8 pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <div className="flex gap-4 p-4 bg-white rounded-xl border border-primary/10 shadow-sm transition-all hover:shadow-md">
                            <div className="p-2 bg-primary/5 rounded-lg h-fit">
                                <Settings className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground mb-1">Embed Widget</h3>
                                <p className="text-sm text-muted-foreground">
                                    Copy the script from settings and paste it into your website.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 bg-white rounded-xl border border-primary/10 shadow-sm transition-all hover:shadow-md">
                            <div className="p-2 bg-primary/5 rounded-lg h-fit">
                                <Share2 className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground mb-1">Share Project</h3>
                                <p className="text-sm text-muted-foreground">
                                    Enable sharing to let others view your project's feedback live.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <Button asChild className="w-full sm:w-auto px-8 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer">
                            <Link href="/dashboard/settings" onClick={handleFinishOnboarding}>
                                Head to Settings
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </Link>
                        </Button>
                        <button
                            onClick={handleFinishOnboarding}
                            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
                        >
                            I'll do this later
                        </button>
                    </div>
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}

