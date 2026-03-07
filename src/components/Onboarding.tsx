/**
 * Main Responsibility: Handles onboarding for new users.
 * - Role-specific checklist with collapse/expand, inline project
 *   creation dialog, anchor navigation with glow, recommended badges,
 *   and smart client feedback link.
 *
 * Sensitive Dependencies:
 * - /api/projects POST route which requires a validated `workspaceId` prop.
 * - @/actions/onboarding for toggling steps and finalizing onboarding.
 * - document.cookie for directly setting `selectedProjectId`.
 * - localStorage for collapsed/expanded UI state.
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { XIcon, ExternalLink, ChevronDown, Star } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { completeOnboardingAction, toggleOnboardingStepAction } from '@/actions/onboarding';
import Link from 'next/link';

interface OnboardingStep {
    id: string;
    label: string;
    href: string;
    recommended?: boolean;
    /** 'dialog' opens the create-project dialog */
    action?: 'dialog';
}

function getOwnerSteps(): OnboardingStep[] {
    return [
        { id: 'create_project', label: 'Create a project', href: '/dashboard', recommended: true, action: 'dialog' },
        { id: 'embed_widget', label: 'Embed project widget on your site', href: '/dashboard/project-settings#embed-widget', recommended: true },
        { id: 'invite_members', label: 'Invite Team members to the workspace', href: '/dashboard/settings/users#invite-users' },
        { id: 'invite_clients', label: 'Invite Clients to the workspace', href: '/dashboard/settings/users#invite-users', recommended: true },
        { id: 'create_feedback_member', label: 'Create Feedback as a Team member', href: '/dashboard/feedback' },
        { id: 'customize_workspace', label: 'Customise the workspace', href: '/dashboard/settings#workspace-settings' },
        { id: 'customize_project', label: 'Customise the project', href: '/dashboard/project-settings#edit-project' },
        { id: 'share_board', label: 'Share read-only Project Board', href: '/dashboard/project-settings#share-board' },
    ];
}

const MEMBER_STEPS: OnboardingStep[] = [
    { id: 'create_feedback_member', label: 'Create Feedback as a Team member', href: '/dashboard/feedback' },
];

interface OnboardingProps {
    workspaceId?: string;
    isOwner?: boolean;
    completedSteps?: string[];
    hasProjects?: boolean;
}

export default function Onboarding({
    workspaceId,
    isOwner = true,
    completedSteps = [],
    hasProjects = false,
}: OnboardingProps) {
    const router = useRouter();
    const [localCompleted, setLocalCompleted] = useState<string[]>(completedSteps);
    const [collapsed, setCollapsed] = useState(false);
    const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);

    const steps = isOwner ? getOwnerSteps() : MEMBER_STEPS;

    // Restore collapsed state from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('onboarding_collapsed');
        if (stored === 'true') setCollapsed(true);
    }, []);

    // "Create a project" is auto-checked if projects exist
    const isStepCompleted = (stepId: string) => {
        if (stepId === 'create_project' && hasProjects) return true;
        return localCompleted.includes(stepId);
    };

    const completedCount = steps.filter(s => isStepCompleted(s.id)).length;

    const handleCollapse = () => {
        setCollapsed(true);
        localStorage.setItem('onboarding_collapsed', 'true');
    };

    const handleExpand = () => {
        setCollapsed(false);
        localStorage.removeItem('onboarding_collapsed');
    };

    const handleToggleStep = async (stepId: string) => {
        if (stepId === 'create_project' && hasProjects) return;

        const wasCompleted = localCompleted.includes(stepId);
        const newCompleted = wasCompleted
            ? localCompleted.filter(s => s !== stepId)
            : [...localCompleted, stepId];

        setLocalCompleted(newCompleted);

        try {
            await toggleOnboardingStepAction(stepId);

            const nowAllDone = steps.every(s => {
                if (s.id === 'create_project' && hasProjects) return true;
                return newCompleted.includes(s.id);
            });

            if (nowAllDone) {
                localStorage.removeItem('onboarding_collapsed');
                await completeOnboardingAction();
                router.refresh();
            }
        } catch {
            setLocalCompleted(wasCompleted
                ? [...localCompleted]
                : localCompleted.filter(s => s !== stepId)
            );
        }
    };


    const handleStepGoClick = (item: OnboardingStep) => {
        if (item.action === 'dialog') {
            // "Create a project" → open inline dialog
            if (!hasProjects) {
                setShowCreateProjectDialog(true);
            }
            return;
        }
        // Default: navigate via Link (handled by the Link component)
    };

    const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

    // Collapsed mini-banner
    if (collapsed) {
        return (
            <>
                <Card className="bg-primary/5 border-primary/20 mb-8">
                    <div className="flex items-center justify-between px-6 py-3">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-foreground">
                                📋 Getting Started: {completedCount}/{steps.length} steps completed
                            </span>
                            <div className="w-24 bg-gray-200 rounded-full h-1.5 hidden sm:block">
                                <div
                                    className="bg-primary rounded-full h-1.5 transition-all duration-500 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExpand}
                            className="text-primary hover:text-primary hover:bg-primary/10 cursor-pointer flex items-center gap-1"
                        >
                            <ChevronDown className="w-4 h-4" />
                            Resume
                        </Button>
                    </div>
                </Card>

                <CreateProjectDialog
                    open={showCreateProjectDialog}
                    onOpenChange={setShowCreateProjectDialog}
                    workspaceId={workspaceId}
                />
            </>
        );
    }

    // Full expanded checklist card
    return (
        <TooltipProvider>
            <Card className="bg-primary/5 border-primary/20 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCollapse}
                                className="text-muted-foreground hover:text-foreground hover:bg-primary/10 cursor-pointer"
                            >
                                <XIcon className="w-5 h-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Minimise</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <CardHeader className="max-w-2xl px-8 pt-8 pb-4">
                    <CardTitle className="text-2xl">
                        {isOwner ? 'Getting Started 🚀' : 'Welcome to the workspace! 👋'}
                    </CardTitle>
                    <CardDescription className="text-lg text-muted-foreground/80">
                        {isOwner
                            ? 'Complete these steps to get the most out of VibeVaults.'
                            : 'Here\'s what you can do in this workspace.'}
                    </CardDescription>
                </CardHeader>

                <CardContent className="max-w-2xl px-8 pb-8">
                    {/* Progress bar */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">
                                {completedCount}/{steps.length} completed
                            </span>
                            <span className="text-sm font-medium text-muted-foreground">
                                {progressPercent}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-primary rounded-full h-2 transition-all duration-500 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Checklist */}
                    <div className="space-y-3">
                        {steps.map((item) => {
                            const checked = isStepCompleted(item.id);
                            const isAutoChecked = item.id === 'create_project' && hasProjects;
                            const isGoDisabled = item.action === 'dialog' && hasProjects;

                            const goButtonContent = (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`cursor-pointer shrink-0 ${isGoDisabled
                                        ? 'text-muted-foreground opacity-50 cursor-not-allowed'
                                        : 'text-primary hover:text-primary hover:bg-primary/10'
                                        }`}
                                    disabled={isGoDisabled}
                                    onClick={item.action ? (e) => { e.preventDefault(); handleStepGoClick(item); } : undefined}
                                >
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline">Go</span>
                                </Button>
                            );

                            return (
                                <div
                                    key={item.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${checked
                                        ? 'bg-white/60 border-primary/20'
                                        : 'bg-white border-gray-200 hover:border-primary/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            id={item.id}
                                            checked={checked}
                                            disabled={isAutoChecked}
                                            onCheckedChange={() => handleToggleStep(item.id)}
                                            className="cursor-pointer"
                                        />
                                        <label
                                            htmlFor={item.id}
                                            className={`text-sm font-medium select-none ${checked
                                                ? 'text-muted-foreground line-through cursor-pointer'
                                                : 'text-foreground cursor-pointer'
                                                }`}
                                        >
                                            {item.label}
                                        </label>
                                        {item.recommended && !checked && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                <Star className="w-2.5 h-2.5" />
                                                Recommended
                                            </span>
                                        )}
                                    </div>
                                    {/* Go button: use Link for navigation, button for actions */}
                                    {item.action || isGoDisabled ? (
                                        goButtonContent
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                            className="text-primary hover:text-primary hover:bg-primary/10 cursor-pointer shrink-0"
                                        >
                                            <Link href={item.href}>
                                                <ExternalLink className="w-4 h-4 mr-1" />
                                                <span className="hidden sm:inline">Go</span>
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Collapse */}
                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={handleCollapse}
                            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 cursor-pointer"
                        >
                            I'll explore on my own
                        </button>
                    </div>
                </CardContent>
            </Card>

            <CreateProjectDialog
                open={showCreateProjectDialog}
                onOpenChange={setShowCreateProjectDialog}
                workspaceId={workspaceId}
            />
        </TooltipProvider>
    );
}


