/**
 * Tier 1 — UX wiring: Notification navigation
 *
 * When a user clicks a bell notification, `navigateToNotification` must:
 *   1. Look up the notification's project and set `selectedWorkspaceId`
 *      to the project's workspace (even if the user was elsewhere).
 *   2. Set `selectedProjectId` to the notification's project_id.
 *   3. Route to `/dashboard/feedback/<feedbackId>` (or the list if no
 *      feedback_id on a workspace-level notification).
 *
 * Why high-value: the sidebar and the "back to list" button read these
 * cookies. A regression means clicking a notification takes the user to a
 * dashboard screen that doesn't match the sidebar — the worst kind of bug
 * because it looks like the app is lying about where they are.
 *
 * Sensitive Dependencies:
 * - Seeds a notification directly into the `notifications` table so we don't
 *   depend on triggers/timing. Cleans up in afterAll.
 * - Deliberately presets the cookies to garbage before clicking, so the
 *   assertion is "they actually got replaced", not "they happened to match".
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });
test.use({ storageState: AUTH_FILES.owner });

const GARBAGE_UUID = '00000000-0000-0000-0000-00000000dead';
const createdNotifIds: string[] = [];
const createdFeedbackIds: string[] = [];

test.afterAll(async () => {
    if (createdNotifIds.length) {
        await supabaseAdmin
            .from('notifications')
            .delete()
            .in('id', createdNotifIds);
    }
    if (createdFeedbackIds.length) {
        // Notifications may have also been created by the insert trigger; sweep.
        await supabaseAdmin
            .from('notifications')
            .delete()
            .in('feedback_id', createdFeedbackIds);
        await supabaseAdmin
            .from('feedbacks')
            .delete()
            .in('id', createdFeedbackIds);
    }
});

async function seedFeedbackAndNotification(opts: {
    title: string;
    message: string;
}) {
    const seed = getSeedResult();
    const { data: fb } = await supabaseAdmin
        .from('feedbacks')
        .insert({
            project_id: seed.projectId,
            content: opts.message,
            type: 'Feature',
            sender: seed.clientEmail,
        })
        .select('id')
        .single();
    createdFeedbackIds.push(fb!.id);

    // The feedback insert trigger already created a new_feedback notification
    // for the owner — rather than racing against that, create our own distinct
    // notification row with a unique title and use that as our click target.
    const { data: notif } = await supabaseAdmin
        .from('notifications')
        .insert({
            user_id: seed.ownerId,
            project_id: seed.projectId,
            feedback_id: fb!.id,
            type: 'new_feedback',
            title: opts.title,
            message: opts.message,
            is_read: false,
        })
        .select('id')
        .single();
    createdNotifIds.push(notif!.id);

    return { feedbackId: fb!.id, notificationId: notif!.id };
}

test('clicking a notification sets workspace + project cookies and navigates to the feedback', async ({ page, context }) => {
    const seed = getSeedResult();
    const title = `E2E nav click me ${Date.now()}`;
    const { feedbackId } = await seedFeedbackAndNotification({
        title,
        message: 'please-click-me notification body',
    });

    // Preset cookies to garbage so the test can observe them being REPLACED,
    // not happening to already match.
    await context.addCookies([
        {
            name: 'selectedWorkspaceId',
            value: GARBAGE_UUID,
            url: 'http://127.0.0.1:3000',
        },
        {
            name: 'selectedProjectId',
            value: GARBAGE_UUID,
            url: 'http://127.0.0.1:3000',
        },
    ]);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open the bell. It's the Button rendering the Bell icon — the only one
    // in the header with an unread badge when we have unread notifications.
    // Anchor on the badge text "new" (visible because we seeded unread rows).
    const bellButton = page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-bell') })
        .first();
    await expect(bellButton).toBeVisible({ timeout: 10_000 });
    await bellButton.click();

    // Sheet opens with title "Notifications".
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({ timeout: 5_000 });

    // Click the notification by its unique title.
    const target = page.getByText(title).first();
    await expect(target).toBeVisible({ timeout: 5_000 });
    await target.click();

    // URL should land on the feedback detail.
    await page.waitForURL(new RegExp(`/dashboard/feedback/${feedbackId}`), { timeout: 10_000 });

    // Cookies should now be scoped to the notification's workspace + project.
    const cookies = await context.cookies();
    const ws = cookies.find(c => c.name === 'selectedWorkspaceId');
    const proj = cookies.find(c => c.name === 'selectedProjectId');

    expect(ws?.value, 'selectedWorkspaceId must match the notification project\'s workspace').toBe(seed.workspaceId);
    expect(proj?.value, 'selectedProjectId must match the notification project').toBe(seed.projectId);
});

test('workspace-level notification (project_id = null) routes to /dashboard without touching project cookie', async ({ page, context }) => {
    const seed = getSeedResult();

    // Seed a workspace-level notification (e.g. member-departed style).
    const title = `E2E ws-level nav ${Date.now()}`;
    const { data: notif } = await supabaseAdmin
        .from('notifications')
        .insert({
            user_id: seed.ownerId,
            project_id: null,
            feedback_id: null,
            type: 'member_departed',
            title,
            message: 'workspace-level notification',
            is_read: false,
        })
        .select('id')
        .single();
    createdNotifIds.push(notif!.id);

    // Set a known selectedProjectId; a workspace-level notification must not
    // change it (navigateToNotification only touches cookies when project_id
    // is present).
    await context.addCookies([
        {
            name: 'selectedProjectId',
            value: seed.projectId,
            url: 'http://127.0.0.1:3000',
        },
    ]);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const bellButton = page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-bell') })
        .first();
    await bellButton.click();

    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({ timeout: 5_000 });
    const target = page.getByText(title).first();
    await expect(target).toBeVisible();
    await target.click();

    // Should land on /dashboard (list root), NOT /dashboard/feedback.
    await page.waitForURL(/\/dashboard(?!\/feedback)(?:$|\/|\?)/, { timeout: 10_000 });

    // selectedProjectId must be untouched.
    const cookies = await context.cookies();
    const proj = cookies.find(c => c.name === 'selectedProjectId');
    expect(
        proj?.value,
        'workspace-level notification must NOT overwrite selectedProjectId'
    ).toBe(seed.projectId);
});
