/**
 * One axis of a pin's offset from its anchor element. `pct` is a fraction of
 * the element's size on that axis and scales with it; `start`/`end` are pixel
 * gaps from the element's near edge, which is what keeps a pin glued to a
 * left-aligned element when the viewport narrows. Written by `resolveAnchor()`
 * in `public/widget.js`.
 */
export interface AnchorAxis {
    ref: 'start' | 'end' | 'pct'
    d: number
}

export interface FeedbackAnchor {
    /** CSS selector for the element the pin is tied to. */
    selector?: string
    /** How the selector was derived, which is what makes it trustworthy or not. */
    selectorKind?: 'id' | 'attr' | 'structural' | 'ambiguous'
    offset?: { x: AnchorAxis; y: AnchorAxis }
    /** The element actually under the cursor, when it differs from the anchor. */
    hitSelector?: string
    hitTag?: string
    elementTag?: string
    elementRect?: { w: number; h: number }
    viewportW?: number
    viewportH?: number
    dpr?: number
    fallback?: { docX: number; docY: number; viewportW: number; docW: number }
}

export interface FeedbackMetadata {
    url?: string
    userAgent?: string
    screen?: string
    viewport?: string
    language?: string
    logs?: Array<{ type: string; time: string; content: string }>
    dom_selector?: string
    is_manual?: boolean
    /** Present on anything pinned from the widget. Absent on dashboard reports. */
    anchor?: FeedbackAnchor
    /** Origin + pathname the pin belongs to, with the query string stripped. */
    page_key?: string
}

export interface FeedbackData {
    id: string
    content: string
    created_at: string
    sender: string
    status?: string
    metadata?: FeedbackMetadata
}

/**
 * Human phrasing for where a pin sits relative to its anchor element, e.g.
 * "40px right, 12px below" or "inside". Returns null when there is no offset
 * to describe. Kept separate from the selector so callers can show the element
 * prominently and the position as secondary detail.
 */
export function describeAnchorOffset(anchor?: FeedbackAnchor): string | null {
    if (!anchor?.offset) return null
    const { x, y } = anchor.offset
    const bits: string[] = []
    if (x.ref === 'end') bits.push(`${Math.round(Math.abs(x.d))}px right`)
    else if (x.ref === 'start') bits.push(`${Math.round(Math.abs(x.d))}px left`)
    if (y.ref === 'end') bits.push(`${Math.round(Math.abs(y.d))}px below`)
    else if (y.ref === 'start') bits.push(`${Math.round(Math.abs(y.d))}px above`)
    return bits.length > 0 ? bits.join(', ') : 'inside'
}

/**
 * How far to trust a pin's selector. An id or a test attribute was written by
 * the site's own author and survives restyling; a structural path is derived
 * from document shape and breaks if the markup is reordered; an ambiguous one
 * matched more than one node, so the widget draws that pin as approximate.
 */
export function describeAnchorConfidence(
    anchor?: FeedbackAnchor
): { label: string; detail: string; tone: 'ok' | 'warn' } | null {
    if (!anchor?.selector) return null
    switch (anchor.selectorKind) {
        case 'id':
        case 'attr':
            return {
                label: 'Exact',
                detail: 'Anchored to an id or test attribute, so it survives restyling.',
                tone: 'ok',
            }
        case 'ambiguous':
            return {
                label: 'Approximate',
                detail: 'The selector matched more than one element, so this pin may have drifted. Trust the screenshot over the position.',
                tone: 'warn',
            }
        default:
            // The common case. Most elements on a real site carry no id, so
            // flagging a derived path as a warning would make almost every pin
            // look broken and train people to ignore the one that matters.
            return {
                label: 'Derived path',
                detail: 'Built from the document structure. Reliable unless that part of the markup is reordered.',
                tone: 'ok',
            }
    }
}

export function getStatusStyles(status: string) {
    switch (status.toLowerCase()) {
        case 'in progress':
            return 'bg-blue-50 text-blue-700 border-blue-100'
        case 'in review':
            return 'bg-amber-50 text-amber-700 border-amber-100'
        case 'completed':
            return 'bg-emerald-50 text-emerald-700 border-emerald-100'
        case 'open':
        default:
            return 'bg-slate-50 text-slate-700 border-slate-100'
    }
}

export function parseUA(ua?: string) {
    if (!ua) return { browser: 'Unknown', os: 'Unknown' }
    let browser = 'Unknown'
    let os = 'Unknown'

    if (ua.includes('Win')) os = 'Windows'
    else if (ua.includes('Mac')) os = 'macOS'
    else if (ua.includes('Linux')) os = 'Linux'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

    if (ua.includes('Edg')) browser = 'Edge'
    else if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Safari')) browser = 'Safari'

    return { browser, os }
}

export function isImageFile(mimeType: string) {
    return mimeType?.startsWith('image/')
}

/**
 * Looks up profile avatar URLs for a list of sender emails.
 * Works with any Supabase client (server or admin).
 */
export async function fetchSenderAvatars(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: { from: (table: string) => any },
    emails: string[]
): Promise<Record<string, string>> {
    if (emails.length === 0) return {}
    const unique = [...new Set(emails)]
    const { data: profiles } = await supabase
        .from('profiles')
        .select('email, avatar_url')
        .in('email', unique)
        .not('avatar_url', 'is', null)
    if (!profiles) return {}
    return Object.fromEntries(
        profiles.map((p: { email: string; avatar_url: string }) => [p.email, p.avatar_url])
    )
}
