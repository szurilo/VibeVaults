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
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <h2 style="color: #111827; margin-top: 0;">New feedback received!</h2>
                    <p style="color: #4b5563; font-size: 16px;">Someone just left feedback for your project <strong>${projectName}</strong>.</p>
                    
                    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0;">
                        <p style="margin: 0; color: #111827; line-height: 1.5; font-size: 15px;">"${content}"</p>
                    </div>

                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Type:</td>
                            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${type}</td>
                        </tr>
                        ${sender ? `
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">From:</td>
                            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${sender}</td>
                        </tr>
                        ` : ''}
                        ${metadata?.url ? `
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Page:</td>
                            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">
                                <a href="${metadata.url}" style="color: #209CEE; text-decoration: none;">${new URL(metadata.url).pathname}</a>
                            </td>
                        </tr>
                        ` : ''}
                    </table>

                    <div style="margin-top: 32px; text-align: center;">
                        <a href="${baseUrl}/dashboard/feedback" 
                           style="background-color: #209CEE; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                            View in Dashboard
                        </a>
                    </div>

                    <hr style="margin-top: 40px; border: 0; border-top: 1px solid #e5e7eb;" />
                    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                        You received this because you have notifications enabled for ${projectName}.
                    </p>
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
