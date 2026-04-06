/**
 * Main Responsibility: Runs once after the entire Playwright suite.
 * Cleans up all E2E test users (emails matching "e2e-*@example.com")
 * so they don't accumulate across test runs.
 *
 * Sensitive Dependencies:
 * - utils/supabase-admin.ts (admin client + cleanup helper)
 */

import { cleanupTestUsers } from './utils/supabase-admin';

export default async function globalTeardown(): Promise<void> {
    console.log('[global-teardown] Cleaning up E2E test users...');
    await cleanupTestUsers('e2e-');
    console.log('[global-teardown] Done.');
}
