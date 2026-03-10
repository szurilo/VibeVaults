import { createClient } from '@supabase/supabase-js';
import { Page } from '@playwright/test';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SECRET_KEY is not set. Make sure .env.local contains it.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function getMagicLink(page: Page, email: string) {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
    });

    if (error) {
        throw new Error(`Failed to generate magic link: ${error.message}`);
    }

    if (!data.properties.action_link) {
        throw new Error('Magic link generation did not return an action_link');
    }

    // `generateLink` returns something like: http://127.0.0.1:54321/auth/v1/verify?token=YOUR_TOKEN&type=signup&redirect_to=...
    // But our app's custom confirmation page is at /auth/confirm
    // So we extract the token from the action_link URL and build our own redirect URL
    const actionLink = data.properties.action_link;
    const url = new URL(actionLink);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type');

    if (!token) {
        throw new Error("Could not find token in generated action_link: " + actionLink);
    }
    
    if (!type) {
        throw new Error("Could not find type in generated action_link: " + actionLink);
    }

    // Build the URL that exactly matches what the email template provides
    return `http://127.0.0.1:3000/auth/confirm?token_hash=${token}&type=${type}`;
}
