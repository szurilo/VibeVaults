import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'VibeVaults',
        short_name: 'VibeVaults',
        description: 'Collect and manage customer feedback with VibeVaults.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#209CEE',
        icons: [
            {
                src: '/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/android-chrome-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}