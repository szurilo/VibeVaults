/**
 * Unsubscribe must never require a login.
 *
 * Every notification email carries this link, and its recipients include
 * guests and invited clients who have no account at all — an auth gate here
 * makes the opt-out permanently impossible for them, which is a compliance
 * problem, not just bad UX. `/unsubscribe` was in exactly that state until
 * it was added to the public-path list in `src/lib/supabase/proxy.ts`, so
 * these tests pin it.
 *
 * Also covers the RFC 8058 one-click endpoint referenced by the
 * `List-Unsubscribe` header: mail providers POST it unauthenticated and
 * expect a 2xx.
 *
 * State care: mutates one `email_preferences` row, saved and restored.
 */
import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { AUTH_FILES } from './fixtures/test-data';

test.describe('unsubscribe is reachable without an account', () => {
    test.use({ storageState: AUTH_FILES.empty });

    let token: string;
    let saved: Record<string, boolean>;

    test.beforeAll(async () => {
        const { data } = await supabaseAdmin
            .from('email_preferences')
            .select('unsubscribe_token, notify_replies, notify_new_feedback, notify_project_created, notify_project_deleted')
            .not('unsubscribe_token', 'is', null)
            .limit(1)
            .single();
        token = data!.unsubscribe_token;
        saved = {
            notify_replies: data!.notify_replies,
            notify_new_feedback: data!.notify_new_feedback,
            notify_project_created: data!.notify_project_created,
            notify_project_deleted: data!.notify_project_deleted,
        };
    });

    test.afterAll(async () => {
        await supabaseAdmin.from('email_preferences').update(saved).eq('unsubscribe_token', token);
    });

    test('the preferences page renders instead of redirecting to login', async ({ page }) => {
        const res = await page.goto(`/unsubscribe?token=${token}`);
        expect(res?.status()).toBe(200);
        expect(new URL(page.url()).pathname).toBe('/unsubscribe');
        await expect(page.getByText('Email Preferences')).toBeVisible();
    });

    test('one-click POST unsubscribes and answers 2xx', async ({ request }) => {
        const res = await request.post(`/api/unsubscribe?token=${token}`);
        expect(res.status()).toBe(200);

        const { data } = await supabaseAdmin
            .from('email_preferences')
            .select('notify_replies, notify_new_feedback, notify_project_created, notify_project_deleted')
            .eq('unsubscribe_token', token)
            .single();
        expect(data).toMatchObject({
            notify_replies: false,
            notify_new_feedback: false,
            notify_project_created: false,
            notify_project_deleted: false,
        });
    });

    test('GET on the one-click endpoint hands off to the preferences page', async ({ request }) => {
        const res = await request.get(`/api/unsubscribe?token=${token}`, { maxRedirects: 0 });
        expect(res.status()).toBe(303);
        expect(res.headers()['location']).toContain(`/unsubscribe?token=${token}`);
    });
});
