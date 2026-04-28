/**
 * Tier 1 — Data-integrity: Widget presigned upload flow
 *
 * End-to-end verification of the three-step presigned upload pipeline that
 * bypasses Vercel's 4.5MB Hobby body limit:
 *
 *   1. POST /api/widget/upload          → returns signed URLs + fileIds
 *   2. PUT  <signed url>                 → client uploads directly to storage
 *   3. POST /api/widget/upload/confirm   → verifies the object landed + inserts
 *                                           a feedback_attachments row
 *
 * Why this is high-priority: regressions here can (a) reintroduce the 4.5MB
 * cliff, (b) create orphaned storage objects, (c) let unauthorized senders
 * upload via the widget, (d) bypass the tier storage cap.
 *
 * Negative cases covered here:
 *   - Missing API key / sender → 400
 *   - Unauthorized sender email → 403
 *   - Disallowed MIME type → 400
 *   - Oversized file → 400
 *   - Confirm with wrong projectId → 403
 *   - Confirm without actually uploading first → 400 (storage list is empty)
 *
 * Sensitive Dependencies:
 * - Uses the seeded client's email for the happy path — it has a matching
 *   workspace_invites row so verifyWidgetEmail() accepts it.
 * - Cleans up the attachment row + storage object in afterAll.
 */

import { test, expect } from '@playwright/test';
import { supabaseAdmin } from './utils/supabase-admin';
import { getSeedResult } from './utils/seed-result';
import { AUTH_FILES } from './fixtures/test-data';

test.describe.configure({ mode: 'serial' });

// Widget endpoints are public — no auth cookies.
test.use({ storageState: AUTH_FILES.empty });

// Minimal valid PNG (1×1 transparent pixel) — keeps the storage round-trip cheap.
const PNG_BYTES = Buffer.from(
    '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489' +
        '0000000D49444154789C63000100000005000104000000000B40010000000049454E44AE426082',
    'hex'
);

const createdPaths: string[] = [];
const createdAttachmentIds: string[] = [];

test.afterAll(async () => {
    for (const id of createdAttachmentIds) {
        await supabaseAdmin.from('feedback_attachments').delete().eq('id', id);
    }
    if (createdPaths.length) {
        await supabaseAdmin.storage.from('feedback-attachments').remove(createdPaths);
    }
});

// ---------------------------------------------------------------------------
// Happy path — three-step pipeline produces a persisted attachment row.
// ---------------------------------------------------------------------------

test.describe('Widget upload — happy path', () => {
    test('upload → PUT to signed URL → confirm → row exists', async ({ request }) => {
        const seed = getSeedResult();

        // Step 1 — request presigned URLs.
        const presignRes = await request.post('/api/widget/upload', {
            data: {
                apiKey: seed.apiKey,
                senderEmail: seed.clientEmail,
                files: [{ name: 'pixel.png', size: PNG_BYTES.length, type: 'image/png' }],
            },
        });
        expect(presignRes.status(), `presign status: ${presignRes.status()}`).toBe(200);
        const presign = await presignRes.json();
        expect(presign.uploads).toHaveLength(1);
        const upload = presign.uploads[0];
        createdPaths.push(upload.path);

        // Step 2 — PUT the bytes at the signed URL. Supabase signed URLs accept
        // a direct PUT with the file body and x-upsert header.
        const putRes = await request.put(upload.signedUrl, {
            headers: {
                'Content-Type': 'image/png',
                'x-upsert': 'true',
            },
            data: PNG_BYTES,
        });
        expect(putRes.ok(), `PUT status: ${putRes.status()}`).toBeTruthy();

        // Step 3 — confirm. This verifies the object exists in storage and
        // inserts the feedback_attachments row.
        const confirmRes = await request.post('/api/widget/upload/confirm', {
            data: {
                apiKey: seed.apiKey,
                senderEmail: seed.clientEmail,
                projectId: presign.projectId,
                feedbackId: null,
                replyId: null,
                files: [
                    {
                        fileId: upload.fileId,
                        path: upload.path,
                        fileName: upload.fileName,
                        size: PNG_BYTES.length,
                        mimeType: upload.mimeType,
                    },
                ],
            },
        });
        expect(confirmRes.status(), `confirm status: ${confirmRes.status()}`).toBe(200);
        const confirmBody = await confirmRes.json();
        expect(confirmBody.attachments).toHaveLength(1);
        createdAttachmentIds.push(confirmBody.attachments[0].id);

        // DB row assertion — the contract the dashboard reads from.
        const { data: row } = await supabaseAdmin
            .from('feedback_attachments')
            .select('id, project_id, uploaded_by, file_size, mime_type')
            .eq('id', upload.fileId)
            .single();
        expect(row?.project_id).toBe(seed.projectId);
        expect(row?.uploaded_by).toBe(seed.clientEmail);
        expect(row?.file_size).toBe(PNG_BYTES.length);
        expect(row?.mime_type).toBe('image/png');
    });
});

// ---------------------------------------------------------------------------
// Negative cases — each should reject BEFORE producing a signed URL or row.
// ---------------------------------------------------------------------------

test.describe('Widget upload — rejections', () => {
    test('missing apiKey → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/upload', {
            data: {
                senderEmail: seed.clientEmail,
                files: [{ name: 'x.png', size: 10, type: 'image/png' }],
            },
        });
        expect(res.status()).toBe(400);
    });

    test('unauthorized sender email → 403', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/upload', {
            data: {
                apiKey: seed.apiKey,
                senderEmail: `random-${Date.now()}@example.com`,
                files: [{ name: 'x.png', size: 10, type: 'image/png' }],
            },
        });
        expect(res.status()).toBe(403);
    });

    test('disallowed MIME type → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/upload', {
            data: {
                apiKey: seed.apiKey,
                senderEmail: seed.clientEmail,
                files: [{ name: 'evil.exe', size: 10, type: 'application/x-msdownload' }],
            },
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/not allowed/i);
    });

    test('oversized file (>10MB) → 400', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/upload', {
            data: {
                apiKey: seed.apiKey,
                senderEmail: seed.clientEmail,
                files: [{ name: 'big.png', size: 11 * 1024 * 1024, type: 'image/png' }],
            },
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/10MB|exceeds/i);
    });

    test('confirm with wrong projectId → 403', async ({ request }) => {
        const seed = getSeedResult();
        const res = await request.post('/api/widget/upload/confirm', {
            data: {
                apiKey: seed.apiKey,
                senderEmail: seed.clientEmail,
                projectId: '00000000-0000-0000-0000-000000000000',
                files: [
                    {
                        fileId: 'anything',
                        path: 'anything/anything.png',
                        fileName: 'x.png',
                        size: 10,
                        mimeType: 'image/png',
                    },
                ],
            },
        });
        expect(res.status()).toBe(403);
        const body = await res.json();
        expect(body.error).toMatch(/mismatch/i);
    });

    test('confirm without a prior upload → 400 (storage listing is empty)', async ({ request }) => {
        const seed = getSeedResult();
        const bogusPath = `${seed.projectId}/does-not-exist-${Date.now()}.png`;
        const res = await request.post('/api/widget/upload/confirm', {
            data: {
                apiKey: seed.apiKey,
                senderEmail: seed.clientEmail,
                projectId: seed.projectId,
                files: [
                    {
                        fileId: 'anything',
                        path: bogusPath,
                        fileName: 'ghost.png',
                        size: 10,
                        mimeType: 'image/png',
                    },
                ],
            },
        });
        expect(res.status()).toBe(400);

        // No attachment row must exist for this fileId.
        const { data: row } = await supabaseAdmin
            .from('feedback_attachments')
            .select('id')
            .eq('id', 'anything')
            .maybeSingle();
        expect(row).toBeNull();
    });
});
