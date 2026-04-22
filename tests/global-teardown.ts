/**
 * Main Responsibility: Runs once after the entire Playwright suite.
 * Cleans up all E2E test users (emails matching "e2e-*@example.com")
 * so they don't accumulate across test runs.
 *
 * Sensitive Dependencies:
 * - utils/supabase-admin.ts (admin client + cleanup helper)
 */

import fs from 'fs';
import path from 'path';
import { cleanupTestUsers } from './utils/supabase-admin';

export default async function globalTeardown(): Promise<void> {
    console.log('[global-teardown] Cleaning up E2E test users...');
    await cleanupTestUsers('e2e-');

    // Re-enable email sending now that the suite is done.
    const flag = path.join(process.cwd(), '.playwright-running');
    if (fs.existsSync(flag)) fs.unlinkSync(flag);

    console.log('[global-teardown] Done.');
}
