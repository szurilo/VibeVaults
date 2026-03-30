/**
 * Main Responsibility: Orchestrates all transactional email templates and dispatch functions across the platform 
 * (e.g., feedback notifications, agency replies, workspace/client invites).
 * 
 * Sensitive Dependencies: 
 * - Resend API Client (./resend) for securely delivering emails without exposing API keys to the client.
 * - Environment Variable (NEXT_PUBLIC_APP_URL) to dynamically route links per environment.
 */
import { resend } from './resend';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL!;

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Build a deep-link URL that sets workspace/project cookies and redirects to the target page.
 */
function emailRedirectUrl(params: {
    page?: string;
    workspaceId?: string;
    projectId?: string;
    feedbackId?: string;
}): string {
    const url = new URL('/api/email-redirect', BASE_URL);
    if (params.page) url.searchParams.set('page', params.page);
    if (params.workspaceId) url.searchParams.set('workspace', params.workspaceId);
    if (params.projectId) url.searchParams.set('project', params.projectId);
    if (params.feedbackId) url.searchParams.set('feedback', params.feedbackId);
    return url.toString();
}

interface SendFeedbackEmailParams {
    to: string;
    projectName: string;
    content: string;
    sender?: string;
    metadata?: any;
    unsubscribeToken?: string;
    workspaceId?: string;
    projectId?: string;
}

export async function sendFeedbackNotification({
    to,
    projectName,
    content,
    sender,
    metadata,
    unsubscribeToken,
    workspaceId,
    projectId
}: SendFeedbackEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `New Feedback for ${esc(projectName)}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New feedback received!</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            Someone just left feedback for your project <strong>${esc(projectName)}</strong>.
                        </p>

                        <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #f1f5f9;">
                            <p style="margin: 0; color: #1a202c; line-height: 1.6; font-size: 16px; font-style: italic;">"${esc(content)}"</p>
                        </div>

                        <div style="margin-bottom: 32px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                ${sender ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-size: 14px;">From:</td>
                                    <td style="padding: 8px 0; color: #1a202c; font-size: 14px; font-weight: 600;">${esc(sender)}</td>
                                </tr>
                                ` : ''}
                                ${metadata?.url ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-size: 14px;">Page:</td>
                                    <td style="padding: 8px 0; color: #1a202c; font-size: 14px; font-weight: 600;">
                                        <a href="${metadata.url}" style="color: #209CEE; text-decoration: none;">${metadata.url}</a>
                                    </td>
                                </tr>
                                ` : ''}
                            </table>
                        </div>
                        
                        <a href="${emailRedirectUrl({ page: 'feedback', workspaceId, projectId })}"
                           style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                           View in Dashboard
                        </a>

                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>

                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>

                    </div>
                </div>
            `
        });

        if (error) {
            console.error('Failed to send Resend email:', error);
        }

        return { data, error };
    } catch (e) {
        console.error('Error in sendFeedbackNotification:', e);
        return { data: null, error: e };
    }
}

interface SendProjectCreatedEmailParams {
    to: string;
    projectName: string;
    creatorName: string;
    workspaceName: string;
    unsubscribeToken?: string;
    workspaceId?: string;
    projectId?: string;
}

export async function sendProjectCreatedNotification({
    to,
    projectName,
    creatorName,
    workspaceName,
    unsubscribeToken,
    workspaceId,
    projectId
}: SendProjectCreatedEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `New Project: ${esc(projectName)} in ${esc(workspaceName)}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New Project Created!</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            <strong>${esc(creatorName)}</strong> has created a new project <strong>${esc(projectName)}</strong> in your workspace <strong>${esc(workspaceName)}</strong>.
                        </p>

                        <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #f1f5f9;">
                            <p style="margin: 0; color: #1a202c; line-height: 1.6; font-size: 16px;">
                                You can now start collecting feedback and managing tasks for this project.
                            </p>
                        </div>
                        
                        <a href="${emailRedirectUrl({ page: 'feedback', workspaceId, projectId })}"
                           style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                           Go to Project
                        </a>

                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>

                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>

                    </div>
                </div>
            `
        });

        if (error) {
            console.error('Failed to send Resend email:', error);
        }

        return { data, error };
    } catch (e) {
        console.error('Error in sendProjectCreatedNotification:', e);
        return { data: null, error: e };
    }
}

interface SendProjectDeletedEmailParams {
    to: string;
    projectName: string;
    deleterName: string;
    workspaceName: string;
    unsubscribeToken?: string;
    workspaceId?: string;
}

export async function sendProjectDeletedNotification({
    to,
    projectName,
    deleterName,
    workspaceName,
    unsubscribeToken,
    workspaceId
}: SendProjectDeletedEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `Project Deleted: ${esc(projectName)} from ${esc(workspaceName)}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">Project Deleted</h2>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            <strong>${esc(deleterName)}</strong> has deleted the project <strong>${esc(projectName)}</strong> from your workspace <strong>${esc(workspaceName)}</strong>.
                        </p>

                        <div style="background-color: #fef2f2; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #fee2e2;">
                            <p style="margin: 0; color: #991b1b; line-height: 1.6; font-size: 16px;">
                                All feedbacks and attachments associated with this project have been permanently removed.
                            </p>
                        </div>

                        <a href="${emailRedirectUrl({ workspaceId })}"
                           style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                           Go to Dashboard
                        </a>

                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>

                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>

                    </div>
                </div>
            `
        });

        if (error) {
            console.error('Failed to send Resend email:', error);
        }

        return { data, error };
    } catch (e) {
        console.error('Error in sendProjectDeletedNotification:', e);
        return { data: null, error: e };
    }
}

interface SendReplyEmailParams {
    to: string;
    projectName: string;
    replyContent: string;
    originalFeedback: string;
    sender: string;
    unsubscribeToken?: string;
}

export async function sendReplyNotification({
    to,
    projectName,
    replyContent,
    originalFeedback,
    sender,
    unsubscribeToken
}: SendReplyEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `New response for your feedback on ${esc(projectName)}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New reply received!</h2>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            <strong>${esc(sender)}</strong> has responded to your feedback on <strong>${esc(projectName)}</strong>.
                        </p>

                        <div style="background-color: #f0f9ff; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #e0f2fe;">
                            <p style="margin: 0; font-weight: 600; color: #0369a1; font-size: 14px; margin-bottom: 8px;">Says:</p>
                            <p style="margin: 0; color: #0369a1; line-height: 1.6;">"${esc(replyContent)}"</p>
                        </div>

                        <p style="font-size: 14px; color: #718096; margin-bottom: 8px;">Your original feedback:</p>
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #f1f5f9; border-left: 4px solid #209CEE;">
                            <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.6; font-style: italic;">"${esc(originalFeedback)}"</p>
                        </div>
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>

                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>
                        
                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        console.error('Error in sendReplyNotification:', e);
        return { data: null, error: e };
    }
}

export async function sendAgencyReplyNotification({
    to,
    projectName,
    replyContent,
    sender,
    unsubscribeToken,
    workspaceId,
    projectId,
    feedbackId
}: { to: string, projectName: string, replyContent: string, sender: string, unsubscribeToken?: string, workspaceId?: string, projectId?: string, feedbackId?: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `New reply from ${esc(sender)} (${esc(projectName)})`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New client reply!</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            <strong>${esc(sender)}</strong> replied to your feedback thread in <strong>${esc(projectName)}</strong>.
                        </p>

                        <div style="background-color: #f0f9ff; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #e0f2fe;">
                            <p style="margin: 0; font-weight: 600; color: #0369a1; font-size: 14px; margin-bottom: 8px;">${esc(sender)} Says:</p>
                            <p style="margin: 0; color: #0369a1; line-height: 1.6;">"${esc(replyContent)}"</p>
                        </div>

                        <div style="margin-top: 32px;">
                            <a href="${emailRedirectUrl({ page: 'feedback', workspaceId, projectId, feedbackId })}"
                               style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                               Reply in Dashboard
                            </a>
                        </div>
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>

                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to 
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>

                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        return { data: null, error: e };
    }
}

export async function sendClientInviteNotification({
    to,
    workspaceName,
    projects,
    unsubscribeToken
}: { to: string, workspaceName: string, projects: { name: string, url: string }[], unsubscribeToken?: string }) {
    try {
        const firstProject = projects[0];

        const projectListHtml = projects.length > 0
            ? projects.map(p => `
                <tr>
                    <td style="padding: 8px 0; vertical-align: middle;">
                        <span style="font-size: 14px; font-weight: 600; color: #1a202c;">${esc(p.name)}</span>
                    </td>
                    <td style="padding: 8px 0; vertical-align: middle; text-align: right;">
                        <a href="${p.url}" style="font-size: 13px; color: #209CEE; text-decoration: none; font-weight: 500;">Visit site &rarr;</a>
                    </td>
                </tr>
            `).join('')
            : '';

        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `You've been invited to provide feedback for ${esc(workspaceName)}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">Feedback Invite</h2>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            You have been invited to provide structural and visual feedback for <strong>${esc(workspaceName)}</strong>.
                        </p>

                        <p style="margin-bottom: 32px; font-size: 16px; color: #4a5568;">
                            A feedback widget will appear in the bottom right corner of each site, ready to record your notes.
                        </p>

                        ${projectListHtml ? `
                        <div style="background-color: #f9fafb; padding: 16px 20px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #f1f5f9;">
                            <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #718096; text-transform: uppercase; letter-spacing: 0.05em;">Projects</p>
                            <table style="width: 100%; border-collapse: collapse;">
                                ${projectListHtml}
                            </table>
                        </div>
                        ` : ''}

                        ${firstProject ? `
                        <div style="margin-top: 32px;">
                            <a href="${firstProject.url}"
                               style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                               Get Started
                            </a>
                            ${projects.length > 1 ? `<p style="margin-top: 12px; font-size: 13px; color: #718096;">You have access to all projects in this workspace.</p>` : ''}
                        </div>
                        ` : ''}

                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>

                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>

                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        return { data: null, error: e };
    }
}

export async function sendWorkspaceInviteNotification({
    to,
    inviterName,
    workspaceName,
    inviteLink,
    unsubscribeToken
}: { to: string, inviterName: string, workspaceName: string, inviteLink: string, unsubscribeToken?: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `You've been invited to join ${esc(workspaceName)} on VibeVaults`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">Workspace Invite</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            <strong>${esc(inviterName)}</strong> has invited you to join their workspace <strong>${esc(workspaceName)}</strong> on VibeVaults.
                        </p>
                        
                        <p style="margin-bottom: 32px; font-size: 16px; color: #4a5568;">
                            Click the button below to accept the invitation and access the workspace's projects.
                        </p>
                        
                        <div style="margin-top: 32px;">
                            <a href="${inviteLink}" 
                               style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                               Accept Invitation
                            </a>
                        </div>
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>

                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>

                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        return { data: null, error: e };
    }
}

export async function sendMemberRemovedNotification({
    to,
    workspaceName,
    removedByName,
    workspaceId
}: { to: string, workspaceName: string, removedByName: string, workspaceId?: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `You've been removed from ${esc(workspaceName)}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">Access Revoked</h2>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            <strong>${esc(removedByName)}</strong> has removed you from the workspace <strong>${esc(workspaceName)}</strong>.
                        </p>

                        <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #f1f5f9;">
                            <p style="margin: 0; color: #1a202c; line-height: 1.6; font-size: 16px;">
                                You no longer have access to the projects and feedback in this workspace. If you believe this was a mistake, please contact the workspace owner.
                            </p>
                        </div>

                        <a href="${BASE_URL}/dashboard"
                           style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">
                           Go to Dashboard
                        </a>

                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>

                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        console.error('Error in sendMemberRemovedNotification:', e);
        return { data: null, error: e };
    }
}

export async function sendMemberLeftNotification({
    to,
    workspaceName,
    memberName,
    workspaceId
}: { to: string, workspaceName: string, memberName: string, workspaceId?: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `${esc(memberName)} left ${esc(workspaceName)}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">Member Left</h2>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            <strong>${esc(memberName)}</strong> has left your workspace <strong>${esc(workspaceName)}</strong>.
                        </p>

                        <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #f1f5f9;">
                            <p style="margin: 0; color: #1a202c; line-height: 1.6; font-size: 16px;">
                                They will no longer have access to the projects and feedback in this workspace.
                            </p>
                        </div>

                        <a href="${emailRedirectUrl({ page: 'users', workspaceId })}"
                           style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">
                           Manage Members
                        </a>

                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>

                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        console.error('Error in sendMemberLeftNotification:', e);
        return { data: null, error: e };
    }
}

export async function sendWelcomeNotification({
    to,
    name = 'there'
}: { to: string, name?: string }) {
    try {
        const sendAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        const { data, error } = await resend.emails.send({
            from: 'József <jozsef@mail.vibe-vaults.com>',
            replyTo: 'jozsef@vibe-vaults.com',
            to,
            subject: 'Quick question about VibeVaults',
            scheduledAt: sendAt,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            Hi ${esc(name)},
                        </p>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            I'm József, the founder of VibeVaults. Thanks for joining the beta! Quick question: what is the #1 problem you're hoping VibeVaults will solve for you today?
                        </p>

                        <p style="margin-bottom: 32px; font-size: 16px; color: #4a5568;">
                            Just reply to this email, I read every single one.
                        </p>
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <table style="border-collapse: collapse; margin-bottom: 16px;">
                                <tr>
                                    <td style="vertical-align: middle; padding-right: 14px;">
                                        <img src="${BASE_URL}/avatar.jpg" alt="József Tar" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; display: block;" />
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a202c;">József Tar</p>
                                        <p style="margin: 0; font-size: 13px; color: #718096;">Founder, VibeVaults</p>
                                    </td>
                                </tr>
                            </table>
                        </div>

                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        return { data: null, error: e };
    }
}

// ─── Digest Email Templates ────────────────────────────────────────────────

interface DigestFeedbackItem {
    content: string;
    sender?: string;
    projectName: string;
    workspaceId?: string;
    projectId?: string;
}

export async function sendFeedbackDigestEmail({
    to,
    items,
    unsubscribeToken
}: { to: string; items: DigestFeedbackItem[]; unsubscribeToken?: string }) {
    const count = items.length;
    const projectNames = [...new Set(items.map(i => i.projectName))];
    const projectLabel = projectNames.length === 1 ? esc(projectNames[0]) : `${projectNames.length} projects`;

    const itemsHtml = items.slice(0, 10).map(item => `
        <div style="padding: 12px 16px; border-left: 3px solid #209CEE; margin-bottom: 12px; background: #f9fafb; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 4px; font-size: 13px; color: #718096;">${esc(item.projectName)}${item.sender ? ` &mdash; ${esc(item.sender)}` : ''}</p>
            <p style="margin: 0; font-size: 15px; color: #1a202c; line-height: 1.5;">"${esc(item.content.slice(0, 200))}${item.content.length > 200 ? '…' : ''}"</p>
        </div>
    `).join('');

    const moreHtml = count > 10 ? `<p style="font-size: 14px; color: #718096; margin-bottom: 24px;">…and ${count - 10} more</p>` : '';

    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `${count} new feedback${count > 1 ? 's' : ''} for ${projectLabel}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">${count} new feedback${count > 1 ? 's' : ''} received</h2>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            Here's a summary of recent feedback for <strong>${projectLabel}</strong>.
                        </p>

                        ${itemsHtml}
                        ${moreHtml}

                        <a href="${emailRedirectUrl({ page: 'feedback', workspaceId: items[0]?.workspaceId, projectId: items[0]?.projectId })}"
                           style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">
                           View All in Dashboard
                        </a>

                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>
                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        console.error('Error in sendFeedbackDigestEmail:', e);
        return { data: null, error: e };
    }
}

interface DigestReplyItem {
    replyContent: string;
    sender: string;
    projectName: string;
    feedbackContentPreview?: string;
    workspaceId?: string;
    projectId?: string;
}

export async function sendReplyDigestEmail({
    to,
    items,
    unsubscribeToken
}: { to: string; items: DigestReplyItem[]; unsubscribeToken?: string }) {
    const count = items.length;

    const itemsHtml = items.slice(0, 10).map(item => `
        <div style="padding: 12px 16px; border-left: 3px solid #0369a1; margin-bottom: 12px; background: #f0f9ff; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 4px; font-size: 13px; color: #718096;">${esc(item.projectName)} &mdash; ${esc(item.sender)}</p>
            <p style="margin: 0; font-size: 15px; color: #0369a1; line-height: 1.5;">"${esc(item.replyContent.slice(0, 200))}${item.replyContent.length > 200 ? '…' : ''}"</p>
            ${item.feedbackContentPreview ? `<p style="margin: 6px 0 0; font-size: 13px; color: #718096; font-style: italic;">Re: "${esc(item.feedbackContentPreview.slice(0, 100))}${item.feedbackContentPreview.length > 100 ? '…' : ''}"</p>` : ''}
        </div>
    `).join('');

    const moreHtml = count > 10 ? `<p style="font-size: 14px; color: #718096; margin-bottom: 24px;">…and ${count - 10} more</p>` : '';

    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `${count} new repl${count > 1 ? 'ies' : 'y'} on your feedback`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">${count} new repl${count > 1 ? 'ies' : 'y'}</h2>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            Here's a summary of recent replies on your feedback threads.
                        </p>

                        ${itemsHtml}
                        ${moreHtml}

                        <a href="${emailRedirectUrl({ page: 'feedback', workspaceId: items[0]?.workspaceId, projectId: items[0]?.projectId })}"
                           style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">
                           View in Dashboard
                        </a>

                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>
                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        console.error('Error in sendReplyDigestEmail:', e);
        return { data: null, error: e };
    }
}

interface DigestProjectEventItem {
    projectName: string;
    actorName: string;
    workspaceName: string;
    type: 'created' | 'deleted';
    workspaceId?: string;
    projectId?: string;
}

export async function sendProjectEventDigestEmail({
    to,
    items,
    unsubscribeToken
}: { to: string; items: DigestProjectEventItem[]; unsubscribeToken?: string }) {
    const count = items.length;

    const itemsHtml = items.slice(0, 10).map(item => `
        <div style="padding: 12px 16px; border-left: 3px solid ${item.type === 'deleted' ? '#ef4444' : '#22c55e'}; margin-bottom: 12px; background: #f9fafb; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 4px; font-size: 13px; color: #718096;">${esc(item.workspaceName)}</p>
            <p style="margin: 0; font-size: 15px; color: #1a202c; line-height: 1.5;">
                <strong>${esc(item.actorName)}</strong> ${item.type === 'deleted' ? 'deleted' : 'created'} the project <strong>"${esc(item.projectName)}"</strong>
            </p>
        </div>
    `).join('');

    const moreHtml = count > 10 ? `<p style="font-size: 14px; color: #718096; margin-bottom: 24px;">…and ${count - 10} more</p>` : '';

    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `${count} project update${count > 1 ? 's' : ''} in your workspace`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">${count} project update${count > 1 ? 's' : ''}</h2>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            Here's a summary of recent project changes in your workspace.
                        </p>

                        ${itemsHtml}
                        ${moreHtml}

                        <a href="${emailRedirectUrl({ workspaceId: items[0]?.workspaceId })}"
                           style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">
                           Go to Dashboard
                        </a>

                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 13px; color: #718096; margin-bottom: 8px;">
                                You received this because you have notifications enabled.
                                ${unsubscribeToken ? `<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color: #718096; text-decoration: underline;">Manage email preferences</a>` : ''}
                            </p>
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a><br>
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>
                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        console.error('Error in sendProjectEventDigestEmail:', e);
        return { data: null, error: e };
    }
}

// ─── Resend Batch API Helper ───────────────────────────────────────────────

interface BatchEmailParams {
    from: string;
    to: string;
    subject: string;
    html: string;
}

/**
 * Send multiple emails in a single Resend batch API call.
 * Falls back to individual sends if batch fails.
 */
export async function sendBatchEmails(emails: BatchEmailParams[]) {
    if (emails.length === 0) return;
    if (emails.length === 1) {
        return resend.emails.send(emails[0]);
    }

    try {
        const { data, error } = await resend.batch.send(emails);
        if (error) {
            console.error('VibeVaults: Batch send failed, falling back to individual sends', error);
            for (const email of emails) {
                await resend.emails.send(email);
            }
        }
        return { data, error };
    } catch (e) {
        console.error('VibeVaults: Batch send exception, falling back to individual sends', e);
        for (const email of emails) {
            try { await resend.emails.send(email); } catch { /* best effort */ }
        }
        return { data: null, error: e };
    }
}
