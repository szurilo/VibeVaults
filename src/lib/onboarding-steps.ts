/**
 * Main Responsibility: Shared onboarding step definitions used by both
 * the server-side dashboard page and the client-side Onboarding component.
 */

export interface OnboardingStep {
    id: string;
    label: string;
    href: string;
    recommended?: boolean;
    /** 'dialog' opens the create-project dialog */
    action?: 'dialog';
}

export const OWNER_STEPS: OnboardingStep[] = [
    { id: 'create_project', label: 'Create a project', href: '/dashboard', recommended: true, action: 'dialog' },
    { id: 'embed_widget', label: 'Embed project widget on your site', href: '/dashboard/project-settings#embed-widget', recommended: true },
    { id: 'invite_members', label: 'Invite Team members to the workspace', href: '/dashboard/settings/users#invite-users' },
    { id: 'invite_clients', label: 'Invite Clients to the workspace', href: '/dashboard/settings/users#invite-users', recommended: true },
    { id: 'create_feedback_member', label: 'Create Feedback as a Team member', href: '/dashboard/feedback#add-feedback' },
    { id: 'customize_workspace', label: 'Customize the workspace', href: '/dashboard/settings#workspace-settings' },
    { id: 'customize_project', label: 'Customize the project', href: '/dashboard/project-settings#edit-project' },
    { id: 'share_board', label: 'Share read-only Project Board', href: '/dashboard/project-settings#share-board' },
];

export const MEMBER_STEPS: OnboardingStep[] = [
    { id: 'create_project', label: 'Create a project', href: '/dashboard', recommended: true, action: 'dialog' },
    { id: 'embed_widget', label: 'Embed project widget on your site', href: '/dashboard/project-settings#embed-widget', recommended: true },
    { id: 'create_feedback_member', label: 'Create Feedback as a Team member', href: '/dashboard/feedback#add-feedback' },
    { id: 'customize_project', label: 'Customize the project', href: '/dashboard/project-settings#edit-project' },
    { id: 'share_board', label: 'Share read-only Project Board', href: '/dashboard/project-settings#share-board' },
];
