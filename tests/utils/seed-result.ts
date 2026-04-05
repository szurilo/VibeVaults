/**
 * Main Responsibility: Read the seed result written by global-setup.
 * Tests import this to get IDs, API keys, etc.
 */

import fs from 'fs';
import path from 'path';
import type { SeedResult } from '../fixtures/seed';

const SEED_FILE = path.join(__dirname, '../.auth/seed-result.json');

let _cached: SeedResult | null = null;

export function getSeedResult(): SeedResult {
    if (_cached) return _cached;
    if (!fs.existsSync(SEED_FILE)) {
        throw new Error('Seed result file not found. Did global-setup run?');
    }
    _cached = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
    return _cached!;
}
