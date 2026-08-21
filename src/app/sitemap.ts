import type { MetadataRoute } from 'next'
import { allComparisons } from '@/lib/compare-data'
import { docsPages } from '@/lib/docs-data'

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

    const compareUrls: MetadataRoute.Sitemap = [
        {
            url: `${baseUrl}/compare`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.7,
        },
        ...allComparisons.map((c) => ({
            url: `${baseUrl}/compare/${c.slug}`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.7,
        })),
    ]

    const docUrls: MetadataRoute.Sitemap = [
        {
            url: `${baseUrl}/docs`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        ...docsPages.map((d) => ({
            url: `${baseUrl}/docs/${d.slug}`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.5,
        })),
    ]

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 1,
        },
        {
            url: `${baseUrl}/pricing`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        ...compareUrls,
        ...docUrls,
        {
            url: `${baseUrl}/terms-of-service`,
            lastModified: new Date(),
            changeFrequency: 'yearly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/privacy-policy`,
            lastModified: new Date(),
            changeFrequency: 'yearly',
            priority: 0.3,
        },
    ]
}
