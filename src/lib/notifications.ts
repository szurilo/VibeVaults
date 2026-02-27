import { resend } from './resend';

const BASE_URL = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://www.vibe-vaults.com';

interface SendFeedbackEmailParams {
    to: string;
    projectName: string;
    content: string;
    sender?: string;
    metadata?: any;
}

export async function sendFeedbackNotification({
    to,
    projectName,
    content,
    sender,
    metadata
}: SendFeedbackEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `New Feedback for ${projectName}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New feedback received!</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            Someone just left feedback for your project <strong>${projectName}</strong>.
                        </p>

                        <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #f1f5f9;">
                            <p style="margin: 0; color: #1a202c; line-height: 1.6; font-size: 16px; font-style: italic;">"${content}"</p>
                        </div>

                        <div style="margin-bottom: 32px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                ${sender ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-size: 14px;">From:</td>
                                    <td style="padding: 8px 0; color: #1a202c; font-size: 14px; font-weight: 600;">${sender}</td>
                                </tr>
                                ` : ''}
                                ${metadata?.url ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-size: 14px;">Page:</td>
                                    <td style="padding: 8px 0; color: #1a202c; font-size: 14px; font-weight: 600;">
                                        <a href="${metadata.url}" style="color: #209CEE; text-decoration: none;">${new URL(metadata.url).pathname}</a>
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
                                You received this because you have notifications enabled for <strong>${projectName}</strong>.
                            </p>
                            
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This is an automatically generated email, please do not reply.<br>
                                If you have questions, reach out to 
                                <a href="mailto:support@vibe-vaults.com" style="color: #EE7220; text-decoration: none; font-weight: 600;">support@vibe-vaults.com</a>
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

interface SendReplyEmailParams {
    to: string;
    projectName: string;
    replyContent: string;
    originalFeedback: string;
}

export async function sendReplyNotification({
    to,
    projectName,
    replyContent,
    originalFeedback
}: SendReplyEmailParams) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `New response for your feedback on ${projectName}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New reply from Support</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            Support has responded to your feedback on <strong>${projectName}</strong>.
                        </p>

                        <div style="background-color: #f0f9ff; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #e0f2fe;">
                            <p style="margin: 0; font-weight: 600; color: #0369a1; font-size: 14px; margin-bottom: 8px;">Support Says:</p>
                            <p style="margin: 0; color: #0369a1; line-height: 1.6;">"${replyContent}"</p>
                        </div>

                        <p style="font-size: 14px; color: #718096; margin-bottom: 8px;">Your original feedback:</p>
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #f1f5f9; border-left: 4px solid #209CEE;">
                            <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.6; font-style: italic;">"${originalFeedback}"</p>
                        </div>
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.<br>
                                If you didn't leave this feedback, please ignore this email.
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
    senderName
}: { to: string, projectName: string, replyContent: string, senderName: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `New reply from ${senderName} (${projectName})`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New client reply!</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            <strong>${senderName}</strong> replied to your feedback thread in <strong>${projectName}</strong>.
                        </p>

                        <div style="background-color: #f0f9ff; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #e0f2fe;">
                            <p style="margin: 0; font-weight: 600; color: #0369a1; font-size: 14px; margin-bottom: 8px;">${senderName} Says:</p>
                            <p style="margin: 0; color: #0369a1; line-height: 1.6;">"${replyContent}"</p>
                        </div>

                        <div style="margin-top: 32px;">
                            <a href="${BASE_URL}/dashboard/feedback" 
                               style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                               Reply in Dashboard
                            </a>
                        </div>
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.<br>
                                This is an automatically generated email, please do not reply.
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
    projectName,
    inviteLink
}: { to: string, projectName: string, inviteLink: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'VibeVaults <notifications@mail.vibe-vaults.com>',
            to,
            subject: `You've been invited to review ${projectName}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">Feedback Invite</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            You have been invited to provide structural and visual feedback for <strong>${projectName}</strong>.
                        </p>
                        
                        <p style="margin-bottom: 32px; font-size: 16px; color: #4a5568;">
                            Click the button below to open the website securely. A feedback widget will appear in the bottom right corner, ready to record your notes.
                        </p>
                        
                        <div style="margin-top: 32px;">
                            <a href="${inviteLink}" 
                               style="display: inline-block; padding: 14px 32px; background-color: #209CEE; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                               Open & Review Site
                            </a>
                        </div>
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                Powered by <a href="${BASE_URL}" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.<br>
                                If you didn't expect this invitation, please ignore this email.
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
                            Hi ${name},
                        </p>

                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            I'm József, the founder of VibeVaults. Thanks for joining the beta! Quick question: what is the #1 problem you're hoping VibeVaults will solve for you today?
                        </p>

                        <p style="margin-bottom: 32px; font-size: 16px; color: #4a5568;">
                            Just reply to this email, I read every single one.
                        </p>
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
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
