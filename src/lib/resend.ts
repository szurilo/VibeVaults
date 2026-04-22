import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

if (!process.env.RESEND_API_KEY) {
    console.warn('VibeVaults: RESEND_API_KEY is not defined');
}

const client = new Resend(process.env.RESEND_API_KEY);

// Checked on every send so it works even when the server was already running
// when Playwright started. Written by tests/global-setup.ts, deleted by global-teardown.ts.
const isPlaywrightRun = () => fs.existsSync(path.join(process.cwd(), '.playwright-running'));

export const resend = {
    emails: {
        send: ((...args: Parameters<typeof client.emails.send>) =>
            isPlaywrightRun() ? Promise.resolve({ data: null, error: null }) : client.emails.send(...args)
        ) as typeof client.emails.send,
    },
    batch: {
        send: ((...args: Parameters<typeof client.batch.send>) =>
            isPlaywrightRun() ? Promise.resolve({ data: null, error: null }) : client.batch.send(...args)
        ) as typeof client.batch.send,
    },
};
