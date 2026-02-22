# kubemcp-docs

Documentation site for the `kubemcp.io` Kubernetes operator, built with Astro + Starlight and
deployed to Cloudflare Pages.

## Stack

- Astro (`astro`)
- Starlight (`@astrojs/starlight`)
- TypeScript script runtime (`tsx`)
- YAML parsing for CRD docs generation (`yaml`)
- Biome for linting/formatting (`@biomejs/biome`)

## Repository layout

```text
.
├── ext/kube-mcp/                  # Git submodule: upstream operator source
├── scripts/generate-schema-docs.ts # Generates CRD reference docs
├── src/content/docs/              # Starlight docs content
│   └── reference/                 # Auto-generated CRD reference pages
├── src/assets/                    # Site logo/icon assets used by Astro
├── public/                        # Static public assets (favicon/OG image)
└── .github/workflows/deploy.yml   # CI + tag-gated deploy pipeline
```

## Prerequisites

- Node.js 20+
- npm
- Git with submodule support

## Local development

Install dependencies:

```bash
npm ci
```

Start local docs server:

```bash
npm run dev
```

`dev` runs schema generation first, then starts Astro.

Production-like preview:

```bash
npm run build
npm run preview
```

## Scripts

- `npm run dev` - Generate CRD reference docs, then run Astro dev server.
- `npm run build` - Generate CRD reference docs, then build static site into `dist/`.
- `npm run preview` - Preview the built static output.
- `npm run generate:schemas` - Generate `src/content/docs/reference/*.mdx` from CRDs.
- `npm run check:schemas` - Regenerate CRD reference docs and fail if tracked generated files differ.
- `npm run validate:tag -- <tag>` - Validate docs release tag format.
- `npm run hooks:install` - Configure git to use repository hooks in `.githooks/`.
- `npm run lint` - Run Biome checks (`biome ci .`).
- `npm run format` - Apply Biome formatting (`biome format --write .`).

## CRD reference generation

`scripts/generate-schema-docs.ts` reads:

- `ext/kube-mcp/crd/*-crd.yaml`
- `ext/kube-mcp/crd/examples.yaml`

It writes:

- `src/content/docs/reference/mcpserver.mdx`
- `src/content/docs/reference/mcptool.mdx`
- `src/content/docs/reference/mcpprompt.mdx`
- `src/content/docs/reference/mcpresource.mdx`

Do not hand-edit files in `src/content/docs/reference/`; regenerate instead.

## Upstream submodule policy

The `ext/kube-mcp` submodule should be pinned to a specific upstream commit that corresponds to the
operator version you are documenting.

Current pinned commit:

- `42da9dcb4adc0871233f143556b62237da9fdc2a`

When updating the submodule, also verify docs and install snippets that reference pinned upstream
content.

## CI and deployment

Workflow: `.github/workflows/deploy.yml`

Triggers:

- Push to `main`
- Pull request targeting `main`
- Push tags matching `v*`

Behavior:

- `main` + PR runs: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run check:schemas`, `npm run build`
- Tag runs additionally upload build artifact and deploy to Cloudflare Pages

Deploy secrets used by workflow:

- `PUBLISH_THE_DOCS` (Cloudflare API token)
- `PUBLISH_ACCOUNT_ID` (Cloudflare account ID)

Deploy command:

- `pages deploy dist/ --project-name=kubemcp-docs`

## Release/tag policy

Production deploys are tag-gated. Example:

```bash
git tag v0.1.0d1
git push origin v0.1.0d1
```

Docs tag format policy:

- `<kube-mcp-tag>d<docs-major.minor.patch>`
- The `d` segment denotes a docs release number that is independent from core `kube-mcp` releases.
- Multiple docs releases may be published for the same upstream `kube-mcp` tag/commit.

Before tagging, ensure `ext/kube-mcp` is pinned to the intended upstream commit.

Docs release notes are tracked in `CHANGELOG.md`.

## Git hooks

Install repo-managed hooks once per clone:

```bash
npm run hooks:install
```

The `pre-push` hook validates pushed tags against the docs release pattern.
You can validate on demand with:

```bash
npm run validate:tag -- v0.1.0d1
```

## Brand assets

Primary source assets are in `.logo/`:

- `.logo/kube_mcp_logo_alpha.png`
- `.logo/kube_mcp_logo.png`
- `.logo/kube_mcp_icon.png`
- `.logo/kube_mcp_icon.svg`

Site assets currently used by Astro:

- `src/assets/logo.png`
- `src/assets/icon.png`
- `public/og-image.png`
- `public/favicon.png`

## License

Creative Commons Attribution 4.0 International (`CC-BY-4.0`).
