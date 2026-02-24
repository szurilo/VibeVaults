import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
    console.warn('VibeVaults: RESEND_API_KEY is not defined');
}

export const resend = new Resend(process.env.RESEND_API_KEY);
