import { resend } from './resend';

interface SendFeedbackEmailParams {
    to: string;
    projectName: string;
    content: string;
    type: string;
    sender?: string;
    metadata?: any;
}

export async function sendFeedbackNotification({
    to,
    projectName,
    content,
    type,
    sender,
    metadata
}: SendFeedbackEmailParams) {
    const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

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
                                ${type ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #718096; font-size: 14px; width: 100px;">Type:</td>
                                    <td style="padding: 8px 0; color: #1a202c; font-size: 14px; font-weight: 600;">${type}</td>
                                </tr>
                                ` : ''}
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
