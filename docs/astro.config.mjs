import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://brunoafk.github.io',
  base: '/recon-web',
  integrations: [
    starlight({
      title: 'recon-web',
      description: 'Open-source website reconnaissance and security analysis tool.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/BrunoAFK/recon-web' },
      ],
      editLink: {
        baseUrl: 'https://github.com/BrunoAFK/recon-web/edit/main/docs/',
      },
      customCss: [],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'Configuration', slug: 'getting-started/configuration' },
            { label: 'Your First Scan', slug: 'getting-started/first-scan' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Web UI', slug: 'guides/web-ui' },
            { label: 'REST API', slug: 'guides/rest-api' },
            { label: 'CLI', slug: 'guides/cli' },
            { label: 'Scheduled Scans', slug: 'guides/scheduled-scans' },
            { label: 'Notifications', slug: 'guides/notifications' },
          ],
        },
        {
          label: 'Checks Reference',
          items: [
            { label: 'Overview', slug: 'checks/overview' },
            { label: 'Security', slug: 'checks/security' },
            { label: 'DNS', slug: 'checks/dns' },
            { label: 'Network', slug: 'checks/network' },
            { label: 'Content', slug: 'checks/content' },
            { label: 'Meta', slug: 'checks/meta' },
            { label: 'Performance', slug: 'checks/performance' },
          ],
        },
        {
          label: 'Deployment',
          items: [
            { label: 'Docker (Local Build)', slug: 'deployment/docker-local' },
            { label: 'Docker (Pre-built Images)', slug: 'deployment/docker-remote' },
            { label: 'Kubernetes (Helm)', slug: 'deployment/kubernetes' },
            { label: 'Standalone (Node.js)', slug: 'deployment/standalone' },
          ],
        },
        {
          label: 'Development',
          items: [
            { label: 'Architecture', slug: 'development/architecture' },
            { label: 'Contributing', slug: 'development/contributing' },
            { label: 'Adding a Check', slug: 'development/adding-handlers' },
          ],
        },
      ],
    }),
  ],
});
