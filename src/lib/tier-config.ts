/**
 * Main Responsibility: Single source of truth for all tier definitions, limits,
 * Stripe price/product mappings, and display data used by pricing UI components.
 *
 * Sensitive Dependencies:
 * - Environment variables for Stripe price/product IDs
 * - Used by tier-helpers.ts for enforcement, webhook for tier resolution, UI for display
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TierSlug = 'starter' | 'pro' | 'business';
export type BillingInterval = 'monthly' | 'yearly';

export interface TierLimits {
    maxWorkspaces: number;       // Infinity for unlimited
    maxProjects: number;         // Infinity for unlimited
    maxTeamMembers: number;      // per workspace, excludes owner & clients
    storageBytes: number;        // per account (all workspaces combined)
    emailFrequencies: ('digest' | 'realtime')[];
    showBranding: boolean;
    publicDashboard: boolean;
    prioritySupport: boolean;
}

export interface TierFeature {
    label: string;
    starter: string | boolean;
    pro: string | boolean;
    business: string | boolean;
}

// ---------------------------------------------------------------------------
// Limits per tier
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const TIER_LIMITS: Record<TierSlug, TierLimits> = {
    starter: {
        maxWorkspaces: 1,
        maxProjects: 3,
        maxTeamMembers: 2,
        storageBytes: 500 * MB,
        emailFrequencies: ['digest'],
        showBranding: true,
        publicDashboard: false,
        prioritySupport: false,
    },
    pro: {
        maxWorkspaces: 3,
        maxProjects: 10,
        maxTeamMembers: 10,
        storageBytes: 5 * GB,
        emailFrequencies: ['digest', 'realtime'],
        showBranding: false,
        publicDashboard: true,
        prioritySupport: false,
    },
    business: {
        maxWorkspaces: Infinity,
        maxProjects: Infinity,
        maxTeamMembers: Infinity,
        storageBytes: 50 * GB,
        emailFrequencies: ['digest', 'realtime'],
        showBranding: false,
        publicDashboard: true,
        prioritySupport: true,
    },
};

/**
 * Returns the effective limits for a tier.
 * `null` (trial / no subscription yet) is treated as Pro.
 */
export function getTierLimits(tier: TierSlug | null): TierLimits {
    return TIER_LIMITS[tier ?? 'pro'];
}

// ---------------------------------------------------------------------------
// Stripe price & product mappings (populated from env vars)
// ---------------------------------------------------------------------------

export const STRIPE_PRICES: Record<TierSlug, Record<BillingInterval, string>> = {
    starter: {
        monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
        yearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? '',
    },
    pro: {
        monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
        yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? '',
    },
    business: {
        monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? '',
        yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY ?? '',
    },
};

export const STRIPE_PRODUCTS: Record<TierSlug, string> = {
    starter: process.env.STRIPE_PRODUCT_STARTER ?? '',
    pro: process.env.STRIPE_PRODUCT_PRO ?? '',
    business: process.env.STRIPE_PRODUCT_BUSINESS ?? '',
};

/** All valid Stripe price IDs (for checkout validation). */
export function getAllPriceIds(): string[] {
    return Object.values(STRIPE_PRICES).flatMap(intervals =>
        Object.values(intervals)
    ).filter(Boolean);
}

/** Resolve a Stripe price ID → tier slug. Returns null if unknown. */
export function getTierFromPriceId(priceId: string): TierSlug | null {
    for (const [tier, intervals] of Object.entries(STRIPE_PRICES)) {
        if (intervals.monthly === priceId || intervals.yearly === priceId) {
            return tier as TierSlug;
        }
    }
    return null;
}

/** Resolve a Stripe product ID → tier slug. Returns null if unknown. */
export function getTierFromProductId(productId: string): TierSlug | null {
    for (const [tier, prodId] of Object.entries(STRIPE_PRODUCTS)) {
        if (prodId === productId) return tier as TierSlug;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Display data (used by PricingCards component)
// ---------------------------------------------------------------------------

export const YEARLY_DISCOUNT = 0.20; // 20% off

export interface TierDisplay {
    slug: TierSlug;
    name: string;
    tagline: string;
    monthlyPrice: number;
    yearlyPricePerMonth: number;   // monthly equivalent when billed yearly
    yearlyTotal: number;           // annual total
    highlighted: boolean;          // true for Pro ("Recommended")
    features: string[];            // bullet points for cards
}

export const TIER_DISPLAY: TierDisplay[] = [
    {
        slug: 'starter',
        name: 'Starter',
        tagline: 'For freelancers getting started',
        monthlyPrice: 29,
        yearlyPricePerMonth: parseFloat((29 * (1 - YEARLY_DISCOUNT)).toFixed(2)),
        yearlyTotal: parseFloat((29 * 12 * (1 - YEARLY_DISCOUNT)).toFixed(2)),
        highlighted: false,
        features: [
            '1 workspace',
            '3 projects',
            '2 team members',
            'Unlimited feedbacks & clients',
            'Real-time chat',
            'VibeVaults branding on widget',
        ],
    },
    {
        slug: 'pro',
        name: 'Pro',
        tagline: 'For growing teams and agencies',
        monthlyPrice: 49,
        yearlyPricePerMonth: parseFloat((49 * (1 - YEARLY_DISCOUNT)).toFixed(2)),
        yearlyTotal: parseFloat((49 * 12 * (1 - YEARLY_DISCOUNT)).toFixed(2)),
        highlighted: true,
        features: [
            '3 workspaces',
            '10 projects',
            '10 team members',
            'Unlimited feedbacks & clients',
            'Real-time chat',
            'Team collaboration & role-based access',
            'Public dashboard for stakeholders',
            'No branding on widget',
        ],
    },
    {
        slug: 'business',
        name: 'Business',
        tagline: 'For agencies at scale',
        monthlyPrice: 149,
        yearlyPricePerMonth: parseFloat((149 * (1 - YEARLY_DISCOUNT)).toFixed(2)),
        yearlyTotal: parseFloat((149 * 12 * (1 - YEARLY_DISCOUNT)).toFixed(2)),
        highlighted: false,
        features: [
            'Everything in Pro',
            'Unlimited workspaces',
            'Unlimited projects',
            'Unlimited team members',
            'Priority support',
        ],
    },
];

/**
 * Full feature comparison for the /pricing page table.
 * `true`/`false` render as check/cross icons; strings render as text.
 */
export const FEATURE_COMPARISON: TierFeature[] = [
    { label: 'Workspaces', starter: '1', pro: '3', business: 'Unlimited' },
    { label: 'Projects', starter: '3', pro: '10', business: 'Unlimited' },
    { label: 'Team members', starter: '2', pro: '10', business: 'Unlimited' },
    { label: 'Feedbacks & clients', starter: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
    { label: 'Real-time chat', starter: true, pro: true, business: true },
    { label: 'Role-based access', starter: true, pro: true, business: true },
    { label: 'Email notifications (digest)', starter: true, pro: true, business: true },
    { label: 'Email notifications (realtime)', starter: false, pro: true, business: true },
    { label: 'Widget branding removal', starter: false, pro: true, business: true },
    { label: 'Public dashboard sharing', starter: false, pro: true, business: true },
    { label: 'File storage', starter: '500 MB', pro: '5 GB', business: '50 GB' },
    { label: 'Priority support', starter: false, pro: false, business: true },
];

// ---------------------------------------------------------------------------
// Access predicates (pure — shared by server + client, no DB calls)
// ---------------------------------------------------------------------------

type AccessProfile = {
    subscription_status?: string | null;
    trial_ends_at?: string | null;
};

/** True if the profile is actively subscribed. */
export function isSubscribed(profile: AccessProfile | null | undefined): boolean {
    return profile?.subscription_status === 'active';
}

/** True if the profile is inside an active trial window. */
export function isTrialActive(profile: AccessProfile | null | undefined): boolean {
    return !!profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
}

/**
 * True if the account has access right now — either subscribed OR in trial.
 * Single source of truth for the widget gate, proxy paywall, and tier resolution.
 */
export function hasActiveAccess(profile: AccessProfile | null | undefined): boolean {
    return isSubscribed(profile) || isTrialActive(profile);
}

/** True if the tier info indicates an expired trial (no active sub and not trialing). */
export function isTrialExpired(info: { isTrialing: boolean; tier: TierSlug | null }): boolean {
    return !info.isTrialing && !info.tier;
}
