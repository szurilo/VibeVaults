import { resend } from './resend';

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
    // We strictly use metadata.url's origin if available to ensure we link to the correct domain (staging/live).
    // Otherwise, we fallback to the main production URL. We avoid process.env.VERCEL_URL as it points to the preview deployment.
    let baseUrl = 'https://vibe-vaults.com';

    if (metadata?.url) {
        try {
            baseUrl = new URL(metadata.url).origin;
        } catch (e) {
            console.error('Failed to parse metadata.url:', metadata.url);
        }
    }

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
                        
                        <a href="${baseUrl}/dashboard/feedback" 
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
                                Powered by <a href="https://vibe-vaults.com" style="color: #209CEE; text-decoration: none; font-weight: 600;">VibeVaults</a>.<br>
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
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, sans-serif;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7;">
                        <h2 style="margin: 0 0 20px; color: #1a202c;">New client reply!</h2>
                        <p style="margin-bottom: 24px;"><strong>${senderName}</strong> replied to your feedback thread in <strong>${projectName}</strong>.</p>
                        <div style="background-color: #f0f9ff; padding: 24px; border-radius: 12px; border: 1px solid #e0f2fe;">
                            <p style="margin: 0; color: #0369a1; line-height: 1.6;">"${replyContent}"</p>
                        </div>
                        <div style="margin-top: 32px;">
                            <a href="https://vibe-vaults.com/dashboard/feedback" style="display: inline-block; padding: 12px 24px; background-color: #209CEE; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Reply in Dashboard</a>
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

export async function sendLiveFeedbackNotification({
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
            subject: `Feedback from Widget: ${projectName}`,
            html: `
                <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
                    <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">New live feedback</h2>
                        
                        <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                            You received a new submission from your widget on <strong>${projectName}</strong>.
                        </p>

                        <div style="background-color: #f0fdf4; padding: 24px; border-radius: 12px; margin-bottom: 32px; border: 1px solid #dcfce3;">
                            <p style="margin: 0; font-weight: 600; color: #166534; font-size: 14px; margin-bottom: 8px;">Message:</p>
                            <p style="margin: 0; color: #166534; line-height: 1.6;">"${content}"</p>
                        </div>

                        <div style="margin-bottom: 32px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                ${sender ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-size: 14px;">From:</td>
                                    <td style="padding: 8px 0; color: #1a202c; font-size: 14px; font-weight: 600;">
                                        <a href="mailto:${sender}" style="color: #209CEE; text-decoration: none;">${sender}</a>
                                    </td>
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
                        
                        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 12px; color: #a0aec0; margin: 0;">
                                This project is currently operating in <strong>Live Mode</strong>.<br>
                                Powered by <a href="https://vibe-vaults.com" style="color: #10b981; text-decoration: none; font-weight: 600;">VibeVaults</a>.
                            </p>
                        </div>
                        
                    </div>
                </div>
            `
        });
        return { data, error };
    } catch (e) {
        console.error('Error in sendLiveFeedbackNotification:', e);
        return { data: null, error: e };
    }
}
