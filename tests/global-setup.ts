/**
 * Main Responsibility: Runs once before the entire Playwright suite.
 * Seeds the database with three test users (owner, member, client),
 * a workspace, and a project. Creates authenticated browser sessions
 * for each role so tests can pick the role they need.
 *
 * Sensitive Dependencies:
 * - fixtures/seed.ts (data seeding)
 * - utils/supabase-admin.ts (magic link generation)
 * - fixtures/test-data.ts (email constants, auth file paths)
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { seedTestData, type SeedResult } from './fixtures/seed';
import { generateMagicLink } from './utils/supabase-admin';
import { TEST_USERS, AUTH_FILES } from './fixtures/test-data';

/** File where seed results (IDs, API key) are persisted for test consumption. */
export const SEED_FILE = path.join(__dirname, '.auth/seed-result.json');

/** localStorage entry that suppresses the cookie consent banner. */
const CONSENT_LOCALSTORAGE = {
    name: 'vv_consent_v1',
    value: JSON.stringify({ analytics: true, timestamp: Date.now(), version: 1 }),
};

/** Inject the consent localStorage entry into a saved storageState file. */
function seedConsentInStorageState(storageFile: string): void {
    const raw = fs.readFileSync(storageFile, 'utf-8');
    const state = JSON.parse(raw) as {
        cookies: unknown[];
        origins: { origin: string; localStorage: { name: string; value: string }[] }[];
    };
    const targetOrigin = 'http://127.0.0.1:3000';
    let origin = state.origins.find((o) => o.origin === targetOrigin);
    if (!origin) {
        origin = { origin: targetOrigin, localStorage: [] };
        state.origins.push(origin);
    }
    origin.localStorage = (origin.localStorage ?? []).filter((e) => e.name !== CONSENT_LOCALSTORAGE.name);
    origin.localStorage.push(CONSENT_LOCALSTORAGE);
    fs.writeFileSync(storageFile, JSON.stringify(state, null, 2));
}

/**
 * Authenticate a user via magic link and save the browser session to disk.
 * Also seeds the cookie-consent localStorage entry so the banner doesn't
 * intercept clicks in tests using this storage state.
 */
async function createAuthSession(email: string, storageFile: string): Promise<void> {
    const magicLink = await generateMagicLink(email);

    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto(magicLink);
    // Wait for the confirm page to verify and redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 30_000 });

    // Persist browser state
    fs.mkdirSync(path.dirname(storageFile), { recursive: true });
    await page.context().storageState({ path: storageFile });

    await browser.close();

    seedConsentInStorageState(storageFile);
}

/** Write an "empty" storage state with consent pre-seeded. */
function writeEmptyStorageWithConsent(storageFile: string): void {
    const state = {
        cookies: [] as unknown[],
        origins: [
            {
                origin: 'http://127.0.0.1:3000',
                localStorage: [CONSENT_LOCALSTORAGE],
            },
        ],
    };
    fs.mkdirSync(path.dirname(storageFile), { recursive: true });
    fs.writeFileSync(storageFile, JSON.stringify(state, null, 2));
}

export default async function globalSetup(): Promise<void> {
    // Disable email sending for the duration of the test suite (checked in src/lib/resend.ts).
    fs.writeFileSync(path.join(process.cwd(), '.playwright-running'), '');

    // 1. Seed the database with all test data
    console.log('[global-setup] Seeding test data...');
    const seed: SeedResult = await seedTestData();

    // Persist seed result so tests can read IDs and API key
    fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
    fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));

    // 2. Write the widget test HTML page with the real API key
    const widgetHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>E2E Widget Test</title></head>
<body>
  <h1>E2E Widget Test Page</h1>
  <p>This page embeds the VibeVaults widget for E2E testing.</p>
  <script src="http://127.0.0.1:3000/widget.js" data-key="${seed.apiKey}" async></script>
</body>
</html>`;
    fs.writeFileSync(path.join(__dirname, 'widget-test.html'), widgetHtml);

    // 3. Create authenticated sessions for each role
    console.log('[global-setup] Creating owner auth session...');
    await createAuthSession(TEST_USERS.owner.email, AUTH_FILES.owner);

    console.log('[global-setup] Creating member auth session...');
    await createAuthSession(TEST_USERS.member.email, AUTH_FILES.member);

    // Client doesn't need a dashboard session (uses widget only),
    // but we still create one for tests that need to verify client access.
    console.log('[global-setup] Creating client auth session...');
    await createAuthSession(TEST_USERS.client.email, AUTH_FILES.client);

    // 4. Write an "empty" storage state with consent pre-seeded for
    //    signed-out tests (auth-roundtrip, register flows, share pages, etc.).
    writeEmptyStorageWithConsent(AUTH_FILES.empty);

    console.log('[global-setup] Done.');
}
