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

interface SendFeedbackEmailParams {
    to: string;
    projectName: string;
    content: string;
    sender?: string;
    metadata?: any;
    unsubscribeToken?: string;
}

export async function sendFeedbackNotification({
    to,
    projectName,
    content,
    sender,
    metadata,
    unsubscribeToken
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
                        
                        <a href="${BASE_URL}/dashboard/feedback" 
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
}

export async function sendProjectCreatedNotification({
    to,
    projectName,
    creatorName,
    workspaceName,
    unsubscribeToken
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
                        
                        <a href="${BASE_URL}/dashboard" 
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
        console.error('Error in sendProjectCreatedNotification:', e);
        return { data: null, error: e };
    }
}

interface SendReplyEmailParams {
    to: string;
    projectName: string;
    replyContent: string;
    originalFeedback: string;
    unsubscribeToken?: string;
}

export async function sendReplyNotification({
    to,
    projectName,
    replyContent,
    originalFeedback,
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
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New reply from Support</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            Support has responded to your feedback on <strong>${esc(projectName)}</strong>.
                        </p>

                        <div style="background-color: #f0f9ff; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #e0f2fe;">
                            <p style="margin: 0; font-weight: 600; color: #0369a1; font-size: 14px; margin-bottom: 8px;">Support Says:</p>
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
    senderName,
    unsubscribeToken
}: { to: string, projectName: string, replyContent: string, senderName: string, unsubscribeToken?: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `New reply from ${esc(senderName)} (${esc(projectName)})`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New client reply!</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            <strong>${esc(senderName)}</strong> replied to your feedback thread in <strong>${esc(projectName)}</strong>.
                        </p>

                        <div style="background-color: #f0f9ff; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #e0f2fe;">
                            <p style="margin: 0; font-weight: 600; color: #0369a1; font-size: 14px; margin-bottom: 8px;">${esc(senderName)} Says:</p>
                            <p style="margin: 0; color: #0369a1; line-height: 1.6;">"${esc(replyContent)}"</p>
                        </div>

                        <div style="margin-top: 32px;">
                            <a href="${BASE_URL}/dashboard/feedback" 
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
