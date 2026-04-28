/**
 * Main Responsibility: Versioned cookie/tracking consent storage and helpers.
 * Single source of truth for what's been consented to, with an event channel
 * so the PostHog provider can react when the user changes their choice.
 *
 * Sensitive Dependencies:
 * - localStorage key `CONSENT_KEY` is read by both the consent UI and the
 *   PostHog provider. Bumping CONSENT_VERSION forces re-prompt for everyone
 *   (use when adding a new category).
 * - Custom events `vv:consent-changed` (state updated) and `vv:open-cookie-prefs`
 *   (footer link asking the dialog to open) are the only cross-component channel.
 */

export const CONSENT_VERSION = 1;
export const CONSENT_KEY = 'vv_consent_v1';

export type ConsentState = {
  analytics: boolean;
  timestamp: number;
  version: number;
};

export const CONSENT_CHANGED_EVENT = 'vv:consent-changed';
export const OPEN_PREFS_EVENT = 'vv:open-cookie-prefs';

export function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(analytics: boolean): ConsentState {
  const state: ConsentState = {
    analytics,
    timestamp: Date.now(),
    version: CONSENT_VERSION,
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: state }));
  return state;
}

export function clearConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: null }));
}

// EU/EEA + UK + Switzerland — countries where ePrivacy / GDPR / UK GDPR / FADP apply.
const CONSENT_REQUIRED_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
  'GB', 'IS', 'LI', 'NO', 'CH',
]);

export function requiresConsent(country: string | null | undefined): boolean {
  if (!country) return true; // safest default when geo is unknown
  return CONSENT_REQUIRED_COUNTRIES.has(country.toUpperCase());
}
