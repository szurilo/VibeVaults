/**
 * Main Responsibility: Shared Supabase admin client for E2E test infrastructure.
 * Used by global-setup, seed, and cleanup helpers.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SECRET_KEY is not set. Make sure .env.local contains it.');
}

export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Generate a magic link URL for a given email (bypasses real email delivery).
 * Returns a URL pointing at the app's /auth/confirm page.
 */
export async function generateMagicLink(email: string): Promise<string> {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
    });

    if (error || !data.properties.action_link) {
        throw new Error(`Failed to generate magic link for ${email}: ${error?.message}`);
    }

    const url = new URL(data.properties.action_link);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type');

    if (!token || !type) {
        throw new Error(`Could not extract token/type from magic link: ${data.properties.action_link}`);
    }

    return `http://127.0.0.1:3000/auth/confirm?token_hash=${token}&type=${type}`;
}

/**
 * Clean up all E2E test users whose email matches the "e2e-" prefix.
 * Uses the admin API so cascading deletes (workspaces, projects, etc.) fire normally.
 */
export async function cleanupTestUsers(emailPrefix: string): Promise<void> {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (!users?.users) return;

    const testUsers = users.users.filter(u => u.email?.startsWith(emailPrefix));
    for (const u of testUsers) {
        await supabaseAdmin.auth.admin.deleteUser(u.id);
    }
}
