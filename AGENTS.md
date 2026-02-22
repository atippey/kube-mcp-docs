# AGENTS.md

This file defines working rules for coding agents and collaborators in `kubemcp-docs`.

## Mission

Ship a high-quality static documentation site for `kubemcp.io` using Astro Starlight, with CRD
reference docs generated from the upstream `kube-mcp` submodule.

## Ground rules

- Keep docs changes scoped to this repository. Do not modify operator behavior in `ext/kube-mcp`.
- Treat `src/content/docs/reference/*.mdx` as generated artifacts. Never hand-edit them.
- Prefer reproducible, pinned references in docs over floating `main` URLs.
- Keep examples aligned with current upstream API group and CRD schema.

## Source of truth

- Upstream code and CRDs: `ext/kube-mcp`
- CRD schema docs generator: `scripts/generate-schema-docs.ts`
- Docs framework config: `astro.config.mjs`
- Lint/format config: `biome.json`
- CI/deploy pipeline: `.github/workflows/deploy.yml`

## Required local workflow

1. Install dependencies:
   - `npm ci`
2. Regenerate schema docs when CRDs or examples change:
   - `npm run generate:schemas`
3. Run lint and type checks:
   - `npm run lint`
   - `npx tsc --noEmit`
4. Verify generated reference docs are up to date:
   - `npm run check:schemas`
5. Validate release tag format when preparing a release:
   - `npm run validate:tag -- <tag>`
6. Build and verify output:
   - `npm run build`

For local iteration:

- `npm run dev` (already runs schema generation first)

## Generated reference docs

The generator reads:

- `ext/kube-mcp/crd/*-crd.yaml`
- `ext/kube-mcp/crd/examples.yaml`

The generator writes:

- `src/content/docs/reference/mcpserver.mdx`
- `src/content/docs/reference/mcptool.mdx`
- `src/content/docs/reference/mcpprompt.mdx`
- `src/content/docs/reference/mcpresource.mdx`

If generated output is wrong, fix the generator or upstream schema, then regenerate.

## Content and navigation

- Keep sidebar and content structure synchronized with files in `src/content/docs/`.
- Use internal links between guides and reference pages.
- Use a professional, concise tone in docs content.

## Branding assets

Master logo/icon files are in `.logo/` and currently include PNG + SVG icon variants.

- `.logo/kube_mcp_icon.svg`

Site consumes copied assets in:

- `src/assets/`
- `public/`

When updating logos/icons, update both source-controlled site assets and any references in config.

## CI and deployment policy

Workflow: `.github/workflows/deploy.yml`

- Pushes to `main` and PRs to `main` run build validation only.
- Deploy runs only for tag refs matching `v*`.
- Cloudflare Pages deploy command:
  - `pages deploy dist/ --project-name=kubemcp-docs`
- Required GitHub secrets:
  - `PUBLISH_THE_DOCS`
  - `PUBLISH_ACCOUNT_ID`

## Tag/release policy

- Docs releases are tag-gated.
- Expected tag shape: `<kube-mcp-tag>d<docs-major.minor.patch>`
- Keep the `d` suffix pattern; docs release numbering is intentionally independent from core
  `kube-mcp` release numbering.
- It is valid to publish multiple docs releases for one upstream `kube-mcp` version by incrementing
  only the docs portion after `d`.
- Before creating a docs tag, confirm `ext/kube-mcp` is pinned to the intended upstream commit.
- Update `CHANGELOG.md` for every docs release.

## Formatting and linting

- Use Biome for linting and formatting.
- Config file: `biome.json`
- Commands:
  - `npm run lint`
  - `npm run format`

Biome excludes generated/build artifacts and generated reference docs by configuration.

## Git hooks

- Hook directory: `.githooks/`
- Install with: `npm run hooks:install`
- `pre-push` enforces docs tag format validation for pushed tags.

## Things to avoid

- Do not commit changes to `dist/` or `.astro/`.
- Do not bypass schema generation by manually editing `reference/*.mdx`.
- Do not switch deployment behavior from tag-gated to branch-gated without explicit approval.
