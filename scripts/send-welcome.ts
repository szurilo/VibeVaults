/**
 * One-off script to manually send a welcome email immediately (no scheduling delay).
 * Usage: npx tsx --env-file=.env.local scripts/send-welcome.ts
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);
const PROD_URL = 'https://vibe-vaults.com';

const TO = 'szurilo@gmail.com';
const NAME = 'there';

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
    const { data, error } = await resend.emails.send({
        from: 'József <jozsef@mail.vibe-vaults.com>',
        replyTo: 'jozsef@vibe-vaults.com',
        to: TO,
        subject: 'Quick question about VibeVaults',
        html: `
        <div style="background-color: #fdfdfd; padding: 60px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6;">
            <div style="max-width: 540px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

                <p style="margin-bottom: 24px; font-size: 16px; color: #4a5568;">
                    Hi ${esc(NAME)},
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
                                <img src="${PROD_URL}/avatar.jpg" alt="József Tar" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; display: block;" />
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

    if (error) {
        console.error('Failed to send email:', error);
        process.exit(1);
    }

    console.log('Email sent successfully!', data);
}

main();
