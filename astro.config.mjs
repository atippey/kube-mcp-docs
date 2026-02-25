import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kubemcp.io',
  output: 'static',
  integrations: [
    starlight({
      title: 'kubemcp.io',
      description: 'Kubernetes-native MCP server operator',
      defaultLocale: 'root',
      logo: {
        src: './src/assets/icon.png',
        alt: 'kubemcp.io',
      },
      favicon: '/favicon.png',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/atippey/kube-mcp' }],
      expressiveCode: {
        themes: ['github-dark', 'github-light'],
      },
      components: {
        Footer: './src/components/Footer.astro',
      },
      sidebar: [
        { label: 'Overview', link: '/' },
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', link: '/getting-started/installation/' },
            { label: 'Quickstart', link: '/getting-started/quickstart/' },
            { label: 'Concepts', link: '/getting-started/concepts/' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Creating Tools', link: '/guides/creating-tools/' },
            { label: 'Multi Tool', link: '/guides/multi-tool/' },
            { label: 'Prompts & Resources', link: '/guides/prompts-resources/' },
            { label: 'Networking', link: '/guides/networking/' },
            { label: 'Observability', link: '/guides/observability/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'MCPServer', link: '/reference/mcpserver/' },
            { label: 'MCPTool', link: '/reference/mcptool/' },
            { label: 'MCPPrompt', link: '/reference/mcpprompt/' },
            { label: 'MCPResource', link: '/reference/mcpresource/' },
          ],
        },
        {
          label: 'Project',
          items: [
            { label: 'Roadmap', link: '/project/roadmap/' },
            { label: 'Contributing', link: '/project/contributing/' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
      head: [
        { tag: 'meta', attrs: { property: 'og:title', content: 'kubemcp.io' } },
        {
          tag: 'meta',
          attrs: {
            property: 'og:description',
            content: 'Kubernetes-native MCP server operator',
          },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://kubemcp.io/og-image.png' },
        },
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
      ],
    }),
  ],
});
