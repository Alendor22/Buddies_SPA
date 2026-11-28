import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Buddies',
    short_name: 'Buddies',
    description: 'Dog identity, safety, walking, and community network',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0757d4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
}
