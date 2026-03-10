import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

export const AUTH_FILE = path.join(__dirname, '.auth/user.json');

export default async function globalSetup() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseServiceKey) {
        throw new Error('SUPABASE_SECRET_KEY is not set.');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const testEmail = `e2e-preauth-${Date.now()}@example.com`;

    // Create a magic link for the pre-auth test user
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: testEmail,
    });

    if (error || !data.properties.action_link) {
        throw new Error(`Failed to generate magic link: ${error?.message}`);
    }

    const url = new URL(data.properties.action_link);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type');

    if (!token || !type) throw new Error('Could not extract token/type from magic link');

    const magicLink = `http://127.0.0.1:3000/auth/confirm?token_hash=${token}&type=${type}`;

    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Authenticate via magic link
    await page.goto(magicLink);
    await page.waitForURL('**/dashboard**', { timeout: 30000 });

    // Complete onboarding: create a project
    await page.locator('text=Getting Started 🚀').waitFor({ state: 'visible', timeout: 15000 });
    const createProjectRow = page.locator('div').filter({ has: page.locator('label', { hasText: 'Create a project' }) }).first();
    await createProjectRow.getByRole('button', { name: /go/i }).click();

    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.locator('#createProjectName').fill('E2E Test Project');
    await page.locator('#createWebsiteUrl').fill('https://e2e-test.example.com');
    await page.getByRole('dialog').getByRole('button', { name: /^create$/i }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    // Dismiss onboarding
    await page.getByText("I'll explore on my own").waitFor({ state: 'visible' });
    await page.getByText("I'll explore on my own").click();

    // Mark the user as fully onboarded in the DB so pages render without the onboarding card
    const userId = data.user?.id;
    if (userId) {
        await supabaseAdmin
            .from('profiles')
            .update({ has_onboarded: true })
            .eq('id', userId);
    }

    // Persist browser auth state for all pre-auth tests
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    await page.context().storageState({ path: AUTH_FILE });

    await browser.close();
}
