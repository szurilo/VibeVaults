export interface FeedbackMetadata {
    url?: string
    userAgent?: string
    screen?: string
    viewport?: string
    language?: string
    logs?: Array<{ type: string; time: string; content: string }>
    dom_selector?: string
    is_manual?: boolean
}

export interface FeedbackData {
    id: string
    content: string
    created_at: string
    sender: string
    status?: string
    metadata?: FeedbackMetadata
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
