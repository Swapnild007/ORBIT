import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/ORBIT/',
    name: 'ORBIT Personal Environment',
    short_name: 'ORBIT',
    description: 'A personal digital environment for your work, ideas, and everyday tools.',
    start_url: '/ORBIT/',
    scope: '/ORBIT/',
    display: 'standalone',
    display_override: ['standalone'],
    orientation: 'any',
    background_color: '#eaf1fa',
    theme_color: '#eaf1fa',
    categories: ['productivity', 'utilities'],
    icons: [
      {
        src: '/ORBIT/orbit-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
